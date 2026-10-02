/**
 * Service worker registration, install prompt and update handling.
 *
 * Kept in its own module so `main.tsx` stays a five-line bootstrap and the
 * PWA concerns can be reasoned about in one place.
 *
 * Nothing here is required for the app to work — it is a progressive
 * enhancement. If registration fails, the app simply keeps running from the
 * network as usual.
 */

export type InstallState = {
  /** An install prompt is available and the user has not dismissed it. */
  canInstall: boolean
  /** A newer build is cached and waiting. */
  updateReady: boolean
  installed: boolean
}

type Listener = (state: InstallState) => void

const state: InstallState = {
  canInstall: false,
  updateReady: false,
  // Standalone means it was launched from the home screen.
  installed: window.matchMedia('(display-mode: standalone)').matches,
}

const listeners = new Set<Listener>()

let deferredPrompt: BeforeInstallPromptEvent | null = null

/** Not in lib.dom yet, but Chrome and Edge both fire this. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function emit() {
  for (const listener of listeners) listener(state)
}

export function subscribeToInstallState(listener: Listener): () => void {
  listeners.add(listener)
  listener(state)
  return () => listeners.delete(listener)
}

/** Shows the native "Add to home screen" sheet. Resolves to whether it worked. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  const prompt = deferredPrompt
  deferredPrompt = null
  state.canInstall = false
  emit()
  try {
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') state.installed = true
    emit()
    return outcome === 'accepted'
  } catch {
    return false
  }
}

/** Activates a waiting worker so the next load picks up the new build. */
export function applyUpdate() {
  navigator.serviceWorker?.getRegistration().then(
    (registration) => registration?.waiting?.postMessage('skip-waiting'),
    // Nothing to activate - carry on and let the next load pick it up.
    () => {},
  )
  window.location.reload()
}

export type WorkerStatus = {
  supported: boolean
  /** A secure context - the browser will not run a worker without one. */
  secureContext: boolean
  registered: boolean
  /** The worker has an active, activated instance. */
  active: boolean
  /** An active worker is in charge of this page. */
  controlling: boolean
  /** Every precached file is present, so the app will open with no network. */
  offlineReady: boolean
  /** The shell and entry script are cached, so a launch will at least boot. */
  bootable: boolean
  /** Which build's cache is answering launches, which may not be this build. */
  servedBy: string | null
  /** True when the cache answering launches holds every asset its shell asks for. */
  servedComplete: boolean
  servingAssets: number
  servingWanted: number
  /** The cache this build wrote to. */
  cache: string | null
  /** Every cache belonging to the app, newest build first. */
  caches: string[]
  entryCount: number
  expected: number
  missing: string[]
  /** Of those, the ones whose absence means a blank screen rather than a gap. */
  criticalMissing: string[]
  scope: string | null
  scriptUrl: string | null
  /** Why registration failed, if it did. Previously discarded entirely. */
  error: string | null
  /** Set when /sw.js itself is being served as something other than a script. */
  scriptProblem: string | null
}

const emptyStatus = (): WorkerStatus => ({
  supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  secureContext: typeof window !== 'undefined' && window.isSecureContext,
  registered: false,
  active: false,
  controlling: false,
  offlineReady: false,
  bootable: false,
  servedBy: null,
  servedComplete: false,
  servingAssets: 0,
  servingWanted: 0,
  cache: null,
  caches: [],
  entryCount: 0,
  expected: 0,
  missing: [],
  criticalMissing: [],
  scope: null,
  scriptUrl: null,
  error: null,
  scriptProblem: null,
})

/** Registration failures, kept so the Profile screen can show them. */
let registrationError: string | null = null

export function workerError(): string | null {
  return registrationError
}

/**
 * Checks that the host is actually serving the worker as a worker.
 *
 * A deployment that rewrites unknown paths to index.html returns the app's HTML
 * for /sw.js, with a 200 and a text/html content type. The browser refuses to
 * register that, reports it as a MIME error nobody sees, and the result is an
 * app that works perfectly online and has no offline support at all. It is the
 * single most common way a PWA loses offline support on a host that works fine
 * in a browser, and until now it was completely invisible from inside the app.
 *
 * Only a positive answer counts as a fault. A failed request, a proxy error, or
 * being offline at all is the network being unavailable, not the deployment
 * being wrong - and reporting those would paint a working offline app as broken
 * every single time somebody opened it on a train.
 */
export async function workerScriptProblem(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null
  if (!window.isSecureContext) {
    return 'This page is not a secure context, so browsers refuse to run a service worker here. Use https:// (a plain http:// address on a phone never registers one, which is why the installed app then opens nothing offline).'
  }
  // With no connection there is no deployment to criticise, and the cache is the
  // thing actually being judged.
  if (!navigator.onLine) return null
  try {
    // Bounded, and it has to be. A phone with no route still resolves the
    // hostname often enough that this fetch can sit in a TCP connect timeout
    // for tens of seconds, and a diagnostics panel that hangs is worse than no
    // diagnostics panel at all.
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 4000)
    let response: Response
    try {
      response = await fetch('sw.js', { cache: 'no-store', signal: controller.signal })
    } finally {
      window.clearTimeout(timer)
    }
    const type = (response.headers.get('content-type') || '').toLowerCase()
    if (!response.ok) {
      // A gateway or proxy status means the request never reached the host that
      // serves the app. That is the network failing, not the deployment, and the
      // only one that says anything about the deployment is the file genuinely
      // not being there.
      if (response.status === 404 || response.status === 410) {
        return `/sw.js is missing from the deployment (answered ${response.status}). The browser cannot install a service worker without it, so the app has no offline copy.`
      }
      return null
    }
    if (!/javascript|ecmascript/.test(type)) {
      return `/sw.js is being served as "${type || 'no content type'}". The host is returning a page instead of the service worker, so the browser refuses to register it and the app has no offline copy.`
    }
    return null
  } catch {
    // Offline, slow, or the host is unreachable. None of those is a deployment
    // fault, and the cache is the thing being judged here, so this is not worth
    // reporting as an error.
    return null
  }
}

type WorkerReply = {
  complete: boolean
  bootable: boolean
  missing: string[]
  criticalMissing?: string[]
  servedBy?: string | null
  servedComplete?: boolean
  servingAssets?: number
  servingWanted?: number
  cache?: string
  caches?: string[]
  entryCount?: number
  expected?: number
  shellKeys?: { key: string; status: number }[]
}

function askWorker(timeoutMs: number): Promise<WorkerReply | null> {
  return navigator.serviceWorker.ready
    .then((registration) => {
      const active = registration.active
      if (!active) return null
      return new Promise<WorkerReply | null>((resolve) => {
        const timer = setTimeout(() => {
          navigator.serviceWorker.removeEventListener('message', onMessage)
          resolve(null)
        }, timeoutMs)
        const onMessage = (event: MessageEvent) => {
          const data = event.data
          if (!data || data.type !== 'status') return
          clearTimeout(timer)
          navigator.serviceWorker.removeEventListener('message', onMessage)
          resolve(data as WorkerReply)
        }
        navigator.serviceWorker.addEventListener('message', onMessage)
        active.postMessage({ type: 'status' })
      })
    })
    .catch(() => null)
}

/**
 * Asks the worker to confirm it is in charge and that the precache is whole.
 *
 * This is the only way to tell "offline will work" from "offline will not"
 * while the network is still up. It is what surfaces the warning to a user
 * whose installed app never finished caching, and it is the first thing to
 * check when an install misbehaves on a real device.
 */
export async function workerStatus(timeoutMs = 2500): Promise<WorkerStatus> {
  const status = emptyStatus()
  if (!status.supported) return status
  status.controlling = Boolean(navigator.serviceWorker.controller)

  const [reply, scriptProblem] = await Promise.all([askWorker(timeoutMs), workerScriptProblem()])
  status.scriptProblem = scriptProblem
  status.error = registrationError

  const registration = await navigator.serviceWorker
    .getRegistration()
    .catch(() => undefined)
  if (registration) {
    status.registered = true
    status.active = Boolean(registration.active)
    status.scope = registration.scope
    status.scriptUrl = registration.active?.scriptURL ?? registration.installing?.scriptURL ?? null
  }
  status.caches = (await caches.keys().catch(() => [])).filter((name) => name.startsWith('calisthenics-'))

  if (reply) {
    status.offlineReady = Boolean(reply.complete)
    status.bootable = Boolean(reply.bootable)
    status.missing = reply.missing || []
    status.criticalMissing = reply.criticalMissing || []
    status.servedBy = reply.servedBy ?? null
    status.servedComplete = Boolean(reply.servedComplete)
    status.servingAssets = reply.servingAssets ?? 0
    status.servingWanted = reply.servingWanted ?? 0
    status.cache = reply.cache ?? null
    status.entryCount = reply.entryCount ?? 0
    status.expected = reply.expected ?? 0
    if (reply.caches?.length) status.caches = reply.caches
  }
  return status
}

export type RefreshResult = { ok: boolean; repaired: string[]; failed: string[]; error?: string }

/**
 * Forces a full re-fetch of everything the precache is missing.
 *
 * Backs the "Refresh offline cache" button. Bypasses the rate limit on the
 * automatic repair, so a user who has just been told the app is not ready can
 * fix it without hunting for a reinstall or clearing site data.
 */
export async function refreshOfflineCache(timeoutMs = 40000): Promise<RefreshResult> {
  if (!('serviceWorker' in navigator)) {
    return { ok: false, repaired: [], failed: [], error: 'This browser cannot run a service worker.' }
  }
  try {
    // Ask for a new worker first: if a build has been deployed since the app
    // was installed, the freshly cached copy comes from it rather than from
    // whatever the device happened to have.
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) await registration.update().catch(() => {})
    const active = (await navigator.serviceWorker.ready).active
    if (!active) return { ok: false, repaired: [], failed: [], error: 'No active service worker.' }

    const reply = await new Promise<{ repaired?: string[]; failed?: string[] } | null>((resolve) => {
      const timer = setTimeout(() => {
        navigator.serviceWorker.removeEventListener('message', onMessage)
        resolve(null)
      }, timeoutMs)
      const onMessage = (event: MessageEvent) => {
        const data = event.data
        if (!data || data.type !== 'repaired') return
        clearTimeout(timer)
        navigator.serviceWorker.removeEventListener('message', onMessage)
        resolve(data)
      }
      navigator.serviceWorker.addEventListener('message', onMessage)
      active.postMessage({ type: 'repair' })
    })
    if (!reply) return { ok: false, repaired: [], failed: [], error: 'The service worker did not answer.' }
    return {
      ok: !reply.failed?.length,
      repaired: reply.repaired || [],
      failed: reply.failed || [],
    }
  } catch (error) {
    return {
      ok: false,
      repaired: [],
      failed: [],
      error: error instanceof Error ? error.message : 'Could not reach the service worker.',
    }
  }
}

/** The six tabs the manifest shortcuts can deep-link into. */
const TABS = ['home', 'workout', 'exercises', 'nutrition', 'progress', 'profile'] as const
export type PwaTab = (typeof TABS)[number]

/**
 * Reads the `?tab=` parameter used by the manifest shortcuts, so long-pressing
 * the app icon on Android can jump straight to a screen. Unknown values fall
 * back to Home rather than throwing — the URL is user-reachable.
 */
export function initialTab(): PwaTab {
  const value = new URLSearchParams(window.location.search).get('tab')
  return TABS.includes(value as PwaTab) ? (value as PwaTab) : 'home'
}

/** True when running as an installed app rather than a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari reports standalone through navigator instead.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

const CONTROLLER_RELOAD = 'calisthenics:controller-reload'

/**
 * Reloads once if this page is not actually controlled by a worker.
 *
 * An uncontrolled page has nothing intercepting its requests, so nothing it
 * loads is stored and that entire session cannot work offline. That is a real
 * state on Android: launch the installed app while the worker is still
 * installing, or open it in a second window, and the first load is uncontrolled.
 * `clients.claim()` covers most cases through controllerchange, but if the
 * worker already activated before this document parsed, no event ever fires and
 * the page would stay uncontrolled for the whole session - which looks exactly
 * like "it works in the browser but not from the home screen".
 *
 * One reload fixes it. The sessionStorage flag makes a reload loop impossible.
 */
function ensureControlling() {
  if (!('serviceWorker' in navigator)) return
  if (navigator.serviceWorker.controller) return
  // Wait for a worker to actually become active first. Reloading when there is
  // no registration at all would be pointless - and on a plain-HTTP address,
  // where service workers are never available, it would cost every visitor a
  // wasted reload on their first visit.
  navigator.serviceWorker.ready
    .then(() => {
      if (navigator.serviceWorker.controller) return
      let alreadyReloaded = false
      try {
        alreadyReloaded = sessionStorage.getItem(CONTROLLER_RELOAD) === '1'
      } catch {
        /* storage blocked: the reload is simply not retried */
      }
      if (alreadyReloaded) return
      try {
        sessionStorage.setItem(CONTROLLER_RELOAD, '1')
      } catch {
        /* ignore */
      }
      window.location.reload()
    })
    .catch(() => {
      /* no worker available; the app runs from the network as usual */
    })
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  // Dev builds are served by Vite with its own module graph; caching those
  // responses would only fight the dev server.
  if (!import.meta.env.PROD) return

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    state.canInstall = true
    emit()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    state.canInstall = false
    state.installed = true
    emit()
  })

  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })

  // Registered straight away rather than on `load`.
  //
  // Waiting for `load` is a well-known way for a service worker to end up not
  // registered at all: if anything has already deferred past the load event by
  // the time this runs, the listener never fires and there is no worker for the
  // rest of the session. Nothing is gained by the wait either, since registering
  // does not compete with the page for bandwidth the page is waiting on - and on
  // a phone it costs real time, because the precache then starts a second later
  // than it needs to.
  //
  // Relative to the document, so the app also works when hosted in a
  // subdirectory. `sw.js` is emitted at the root of dist, next to index.html.
  // `updateViaCache: 'none'` keeps a stale intermediary from deciding that an
  // installed app never needs the fix that was just deployed.
  navigator.serviceWorker
    .register('sw.js', { scope: './', updateViaCache: 'none' })
    .then((registration) => {
      // Already waiting from a previous visit.
      if (registration.waiting) {
        state.updateReady = true
        emit()
      }

      // A new build finished downloading while the app was open.
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            state.updateReady = true
            emit()
          }
        })
      })

      // Check for a new build when the app comes back to the foreground.
      // This is expected to fail while offline, so the rejection is swallowed
      // deliberately - otherwise every return to the app logs an unhandled
      // rejection, which reads as a real error rather than "no connection".
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return
        registration.update().catch(() => {
          /* offline — the cached build keeps working */
        })
      })
    })
    .catch((error: unknown) => {
      // Recorded rather than discarded. An app with no worker looks completely
      // healthy right up until someone switches the network off, so the reason
      // has to be readable from inside the app - see the Profile screen's
      // offline readiness section.
      registrationError = error instanceof Error ? error.message : String(error)
    })

  ensureControlling()
}
