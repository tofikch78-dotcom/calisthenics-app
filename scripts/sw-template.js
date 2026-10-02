/*
 * Calisthenics Tracker - service worker.
 *
 * Everything the app needs is same-origin and static, so the whole shell is
 * precached on install and then served from the cache. That is what makes the
 * installed app open instantly and work with no connection at all.
 *
 * This file is a TEMPLATE, not valid JavaScript on its own: the cache name and
 * the precache list are placeholders that the plugin in vite.config.ts
 * substitutes with this build's real hashed asset URLs during `vite build`.
 * Every occurrence is replaced, so there are deliberately no literal token
 * strings anywhere in this file - including in this comment - that a
 * first-match replacement could accidentally clobber.
 *
 * Every path below is resolved against the worker's own URL rather than the
 * origin root, so the app also works when hosted in a subdirectory (GitHub
 * Pages project sites, /apps/calisthenics, and so on) with no extra config.
 *
 * The whole design follows from one rule: a launch must never wait on the
 * network. Everything slow or uncertain happens after the app is already
 * running, or never at all.
 */

const CACHE_PREFIX = 'calisthenics-'
const CACHE = 'calisthenics-__CACHE_VERSION__'
const PRECACHE = __PRECACHE__

/**
 * Only this tag may ever appear in a cached app shell. A captive portal, a
 * hotel or airport login page and a host's catch-all "not found" page are all
 * real HTTP 200 responses of somebody else's HTML; the tag is what tells our
 * shell apart from them. Keep in sync with the meta tag in index.html.
 */
const SHELL_MARKER = 'calisthenics-shell'

/**
 * Chrome gives an install event a limited budget and discards a worker whose
 * install runs past it. That is the failure this app cannot survive, because a
 * discarded worker means no worker at all: everything keeps working while the
 * network is up, and the home-screen icon then opens nothing at all without one.
 * So install only ever spends a bounded slice of time fetching, whatever is
 * still missing afterwards is picked up by the repair in activate and by the
 * repair on later launches.
 */
const INSTALL_BUDGET_MS = 8000
const ACTIVATE_BUDGET_MS = 12000
const REPAIR_BUDGET_MS = 25000
/** A single request never gets to hold a repair pass open indefinitely. */
const FETCH_TIMEOUT_MS = 10000

/** Absolute URL for a path relative to the worker's own location. */
const resolve = (path) => new URL(path, self.location.href).href

/**
 * The URLs the shell can legitimately be stored under. Both are written on
 * install and both are read on every launch, so a lookup never depends on
 * which spelling the browser happened to use: the file itself, and the
 * directory the app is served from.
 *
 * Note the empty string is NOT one of them. Resolving '' against the worker's
 * own URL returns the worker script itself, which would put the HTML shell
 * under the URL of the script that has to replace it.
 */
const SHELL_KEYS = [resolve('index.html'), resolve('./')]
const SHELL = SHELL_KEYS[0]
const isShellPath = (path) => path === 'index.html' || path === './'

/** Same as resolve(), with any query string dropped, for cache key comparison. */
const bareUrl = (href) => {
  const url = new URL(href)
  url.search = ''
  url.hash = ''
  return url.href
}

/**
 * Every precached URL, so a request for one of them can be recognised.
 * A precached asset is content-hashed and therefore immutable: when the app is
 * rebuilt it gets a brand new filename, so there is never a reason to refresh
 * one. Refreshing is not merely pointless, it is the exact opening a hostile
 * or misconfigured network needs to replace a good copy with something else.
 */
const PRECACHED = new Set(PRECACHE.map((path) => bareUrl(resolve(path))))

/**
 * Entries without which the app cannot boot at all. A missing icon is
 * cosmetic; a missing entry script means a blank screen on every launch.
 */
const isCritical = (path) =>
  isShellPath(path) || /(^|\/)assets\/.*\.(js|css)$/.test(path)

/** Where the last repair pass is recorded, so launches do not pile up fetches. */
const META = resolve('./.repair-meta')
const REPAIR_INTERVAL = 10 * 60 * 1000

/** Boot-critical entries first, so a tight budget still yields a usable app. */
const ordered = () => [...PRECACHE].sort((a, b) => Number(isCritical(b)) - Number(isCritical(a)))

/**
 * The build's own cache first, then any earlier build's that has not been
 * pruned yet. A launch may legitimately be answered by an older cache when this
 * build's copy is still incomplete, which is the whole point of keeping it.
 */
async function appCaches() {
  const names = await caches.keys()
  const ours = names.filter((name) => name.startsWith(CACHE_PREFIX))
  return [CACHE, ...ours.filter((name) => name !== CACHE)]
}

/**
 * The headers a stored copy is allowed to keep.
 *
 * Almost everything the origin sends is stripped, for two reasons that both
 * matter in practice.
 *
 * `Vary: Accept-Encoding` is the one that bites hardest. A CDN behind the app
 * sends it, the Cache API honours `Vary` when matching, and `Accept-Encoding`
 * is a forbidden header that page script can neither read nor set - so a stored
 * entry can become impossible to look up again, and the app loses its own
 * assets with no error anywhere. Storing without `Vary` removes the whole class
 * of problem, and costs nothing: the bytes are already decoded.
 *
 * `Content-Encoding` and `Content-Length` describe the response as it went over
 * the wire, not the buffer that `arrayBuffer()` hands back. Keeping them would
 * ask the browser to decompress data that is already plain, and to trust a
 * length that no longer applies.
 */
function normalizedHeaders(response) {
  const kept = new Headers()
  const contentType = response.headers.get('content-type')
  if (contentType) kept.set('content-type', contentType)
  const etag = response.headers.get('etag')
  if (etag) kept.set('etag', etag)
  const modified = response.headers.get('last-modified')
  if (modified) kept.set('last-modified', modified)
  return kept
}

/**
 * Whether a network response is safe to store as the answer to this request.
 *
 * `response.ok` on its own is nowhere near enough, and trusting it is the most
 * destructive mistake available to a service worker. A phone that cannot reach
 * the real origin does not always fail: a captive portal, a hotel or airport
 * Wi-Fi login, a corporate gateway or a misconfigured proxy all answer with a
 * genuine HTTP 200 and a page of somebody else's HTML. Storing that under a
 * script, a stylesheet or the app shell does not just fail to help - it
 * overwrites a good copy, the app keeps working while the network is up, and
 * then the next cold launch is a blank page with no way for the user to get it
 * back.
 *
 * The single rule that catches all of it: an HTML document may only ever be
 * stored where an HTML document was asked for.
 */
function isCacheable(request, response) {
  if (!response || !response.ok) return false
  // Opaque responses have no readable status or headers, so nothing about
  // them can be verified.
  if (response.type !== 'basic' && response.type !== 'default') return false
  // A redirect is followed rather than refused, because a host that folds
  // /index.html into / is doing the right thing. What is refused is a redirect
  // that leaves our origin: that is a different site answering in our name.
  try {
    if (new URL(response.url).origin !== self.location.origin) return false
  } catch {
    return false
  }

  const type = (response.headers.get('content-type') || '').toLowerCase()
  const path = new URL(request.url).pathname
  const wantsDocument =
    request.mode === 'navigate' || request.destination === 'document' || /\.html?$/.test(path)
  if (!wantsDocument && type.includes('text/html')) return false
  return true
}

/**
 * True when a network response is really the app shell.
 *
 * Stricter than isCacheable(): the shell also has to carry the marker tag that
 * only our own index.html has, so an error page or a login form served from our
 * own host is rejected too.
 */
async function isOurShell(request, response) {
  if (!isCacheable(request, response)) return false
  const type = (response.headers.get('content-type') || '').toLowerCase()
  if (!type.includes('text/html')) return false
  try {
    return (await response.clone().text()).includes(SHELL_MARKER)
  } catch {
    return false
  }
}

/**
 * Whether a response is the wrong kind of file for the request that asked it.
 *
 * `isCacheable` already refuses to *store* somebody else's HTML under a script
 * URL, but on a cache miss the response still went straight back to the page.
 * That is how a stale shell asks for an asset the current build renamed away,
 * has the host's catch-all page returned as the body of a <script> request, and
 * the browser refuses it on MIME type with the app left blank.
 *
 * A missing file must be allowed to look like a missing file. Returning 404
 * keeps the failure honest: the page reports one script as unavailable instead
 * of being handed a document it cannot execute, and the reload that follows a
 * new worker takes over then serves the matching shell and assets.
 */
function contradictsRequest(request, response) {
  if (isShellPath(bareUrl(request.url))) return false
  const type = (response.headers.get('content-type') || '').toLowerCase()
  return type.includes('text/html')
}

function notFound() {
  return new Response('Not found.', { status: 404, headers: { 'Content-Type': 'text/plain' } })
}

/** The offline page shown only if the shell somehow is not in the cache. */
function offlinePage() {
  return new Response(
    '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">' +
      '<title>Offline</title>' +
      '<body style="background:#07090f;color:#e8eef8;font:500 15px/1.6 system-ui,-apple-system,sans-serif;padding:2rem">' +
      '<h1 style="font-size:1.1rem">Offline</h1>' +
      '<p>This app has not finished caching yet. Open it once while connected, ' +
      'then it will open without a connection. On Profile &rarr; Offline readiness you can see ' +
      'what is still missing and refresh the cache.</p></body>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

/** Fetches one precache entry into the cache. Returns whether it landed. */
async function put(cache, path, deadline) {
  const url = resolve(path)
  const wantShell = isShellPath(path)

  const budget = Math.min(FETCH_TIMEOUT_MS, deadline ? deadline - Date.now() : FETCH_TIMEOUT_MS)
  if (!(budget > 250)) return false

  // An explicit abort, rather than relying on fetch to fail: a phone with no
  // route can sit in a TCP connect timeout for tens of seconds, and a repair
  // pass that waits that long holds the whole service worker lifecycle open.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), budget)
  let response
  try {
    // `cache: 'reload'` bypasses the HTTP cache so a stale intermediary can
    // never be written into the precache.
    response = await fetch(
      new Request(url, { credentials: 'same-origin', cache: 'reload', signal: controller.signal }),
    )
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }

  // The shell is held to the strictest test, because telling the app apart
  // from something else is the shell's entire job. Everything else only has
  // to be the right kind of file for its own URL.
  const request = new Request(url, { credentials: 'same-origin' })
  if (!wantShell && !isCacheable(request, response)) return false

  let finalUrl
  try {
    finalUrl = new URL(response.url).href
  } catch {
    return false
  }
  if (new URL(finalUrl).origin !== self.location.origin) return false

  const headers = normalizedHeaders(response)
  const type = (headers.get('content-type') || '').toLowerCase()
  let body
  try {
    body = await response.arrayBuffer()
  } catch {
    return false
  }
  if (wantShell) {
    if (!type.includes('text/html')) return false
    if (!new TextDecoder().decode(body).includes(SHELL_MARKER)) return false
  } else if (!type) {
    // No content type at all is not something that can be vouched for, and a
    // guess is exactly how an error page ends up standing in for a script.
    return false
  }

  // Written under every spelling the browser might ask for: the URL that was
  // requested, where a redirect actually landed, and - for the shell - the
  // directory and file forms. A launch must never depend on guessing.
  const targets = new Set([url, bareUrl(finalUrl)])
  if (wantShell) SHELL_KEYS.forEach((key) => targets.add(key))

  try {
    await Promise.all(
      [...targets].map((target) =>
        cache.put(target, new Response(body, { status: 200, statusText: 'OK', headers })),
      ),
    )
    return true
  } catch {
    return false
  }
}

/**
 * Whether a stored entry is still plausibly what its URL claims.
 *
 * Judged entirely from the cached response, with no network access at all, so
 * it is cheap enough to run on every launch. The one realistic corruption is
 * somebody else's HTML sitting under a script, style, image or manifest URL -
 * present, the right number of bytes, and completely useless. It is also the
 * failure least likely ever to be noticed before it costs the user the app,
 * because everything looks fine right up until the network is switched off.
 */
async function isStoredHealthy(path, response) {
  if (!response || !response.ok) return false
  const type = (response.headers.get('content-type') || '').toLowerCase()
  if (isShellPath(path)) {
    if (!type.includes('text/html')) return false
    try {
      return (await response.clone().text()).includes(SHELL_MARKER)
    } catch {
      return false
    }
  }
  return !type.includes('text/html')
}

/** Which precache entries are absent or corrupted, judged locally. */
async function findDamage(cache) {
  const damaged = []
  for (const path of PRECACHE) {
    const stored = await cache.match(resolve(path))
    if (!stored || !(await isStoredHealthy(path, stored))) damaged.push(path)
  }
  return damaged
}

/** The stored shell for this cache, if it has one. */
async function shellIn(cache) {
  for (const key of SHELL_KEYS) {
    const hit = await cache.match(key)
    if (hit) return hit
  }
  return null
}

const isHtml = (response) =>
  Boolean(response) && (response.headers.get('content-type') || '').toLowerCase().includes('text/html')

/** Every .js and .css a document points at, as written in the document. */
function referencedAssets(html) {
  const found = new Set()
  const pattern = /(?:src|href)\s*=\s*["']([^"']+\.(?:js|css))["']/g
  let match = pattern.exec(html)
  while (match) {
    found.add(match[1])
    match = pattern.exec(html)
  }
  return [...found]
}

/**
 * Every shell on offer, each judged against the assets that shell itself asks
 * for, and each scored by how many of them it actually has.
 *
 * The obvious shortcut - check the cache against this build's PRECACHE list -
 * is wrong, and wrong in the one case that matters. A shell is only ever
 * openable together with the filenames *it* names, and those belong to the build
 * that produced it. Testing an older cache against the current list therefore
 * fails on the current build's entry script, which it has never heard of, and
 * the one cache that could still open the app gets written off. What is left is
 * the current shell, which is half-cached, pointing at a script that is nowhere
 * on the device: a blank screen with nothing in the console to explain it.
 *
 * Reading the filenames out of the shell avoids needing to know which build it
 * came from, and is exact rather than approximate - it is the same list the
 * browser is about to ask for.
 */
async function shellCandidates() {
  const found = []
  for (const name of await appCaches()) {
    const cache = await caches.open(name)
    const shell = await shellIn(cache)
    if (!shell || !isHtml(shell)) continue
    let html
    try {
      html = await shell.clone().text()
    } catch {
      continue
    }
    if (!html.includes(SHELL_MARKER)) continue

    const wanted = referencedAssets(html).map((href) => new URL(href, resolve('./')).href)
    let have = 0
    for (const url of wanted) {
      const hit = await cache.match(url)
      if (hit && !isHtml(hit)) have += 1
    }
    found.push({ cache: name, shell, wanted, have })
  }
  return found
}

/**
 * The shell a launch should be answered with: the newest one that can actually
 * boot, and failing that the newest one that can boot the furthest.
 */
async function bestShell() {
  const candidates = await shellCandidates()
  if (!candidates.length) return null
  const openable = candidates.find((entry) => entry.wanted.length > 0 && entry.have === entry.wanted.length)
  if (openable) return { ...openable, bootable: true }
  const nearest = candidates.reduce((best, entry) => (entry.have > best.have ? entry : best))
  return { ...nearest, bootable: false }
}

async function readMeta(cache) {
  const stored = await cache.match(META)
  if (!stored) return 0
  try {
    return JSON.parse(await stored.text()).checkedAt || 0
  } catch {
    return 0
  }
}

async function writeMeta(cache, checkedAt) {
  await cache
    .put(META, new Response(JSON.stringify({ checkedAt })))
    .catch(() => {})
}

/**
 * Puts back anything the precache is missing or has had corrupted.
 *
 * A flaky connection at install time must not leave the user with an app that
 * quietly cannot go offline, and a poisoning incident must not need a reinstall
 * to recover from. Either way the very next successful load fixes it, which is
 * the whole point of checking.
 *
 * Rate limited, so a permanently odd host cannot turn every launch into a burst
 * of requests. The damage scan itself is local and always runs.
 */
async function repair(force = false, deadline = Date.now() + REPAIR_BUDGET_MS) {
  const cache = await caches.open(CACHE)
  const missing = await findDamage(cache)
  if (!missing.length) {
    await writeMeta(cache, Date.now())
    return { complete: true, missing: [], repaired: [], failed: [] }
  }

  if (!force && Date.now() - (await readMeta(cache)) < REPAIR_INTERVAL) {
    return { complete: false, missing, repaired: [], failed: [] }
  }

  const landed = await Promise.all(
    ordered()
      .filter((path) => missing.includes(path))
      .map(async (path) => ((await put(cache, path, deadline)) ? path : null)),
  )
  const repaired = landed.filter(Boolean)
  // The interval is only recorded once a pass has actually landed something.
  // Recording a failed attempt is what turns one flaky moment into ten minutes
  // of the app politely declining to repair itself on every launch after it.
  if (!missing.length || repaired.length === missing.length) await writeMeta(cache, Date.now())

  const failed = missing.filter((path) => !repaired.includes(path))
  return { complete: failed.length === 0, missing: failed, repaired, failed }
}

/**
 * Drops earlier builds' caches, but only once this build is known to boot.
 *
 * The obvious order - delete on activate, then refill - is how an app that
 * worked offline stops working offline. A deploy arrives, the new worker
 * installs, activation throws the previous complete cache away, and then the new
 * precache fails on a flaky connection. The device is left holding nothing, and
 * because the failure only shows up on the next cold launch with no network,
 * there is no way back short of loading the site again.
 *
 * So pruning waits, and bestShell() keeps answering launches from the old
 * cache in the meantime.
 */
async function pruneCaches() {
  const cache = await caches.open(CACHE)
  const damaged = await findDamage(cache)
  if (damaged.some(isCritical)) return { pruned: false, kept: await appCaches() }
  // Only once this build is whole on its own terms. Judged by what the stored
  // shell asks for rather than by the precache list, because those are the two
  // things that have to agree for the app to open.
  const best = await bestShell()
  if (!best || !best.bootable || best.cache !== CACHE) {
    return { pruned: false, kept: await appCaches() }
  }
  const names = await caches.keys()
  const dropped = names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE)
  await Promise.all(dropped.map((name) => caches.delete(name)))
  return { pruned: true, dropped }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // Fetched one at a time rather than with cache.addAll(), which is
      // all-or-nothing: a single bad URL would otherwise leave the user with no
      // offline copy at all. A few passes with a short gap, because the common
      // failure is a flaky mobile connection rather than a bad file.
      //
      // The budget is what keeps this safe on a phone. Three passes of eleven
      // requests plus a second of deliberate sleeping is fine when the server
      // is across the room and fatal when it is three networks away, and the
      // consequence of running long is the one outcome the app cannot survive -
      // Chrome discards the worker outright.
      const deadline = Date.now() + INSTALL_BUDGET_MS
      for (let pass = 0; pass < 2; pass += 1) {
        if (Date.now() >= deadline) break
        const results = await Promise.all(ordered().map((path) => put(cache, path, deadline)))
        if (results.every(Boolean)) break
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.disable().catch(() => {})
      }
      // Claim before anything that touches the network. Claiming is what makes
      // an already-open page controlled, it needs no network at all, and it
      // being last in this chain is how a slow repair pass could leave the very
      // first launch of a freshly installed app uncontrolled.
      await self.clients.claim()
      await repair(true, Date.now() + ACTIVATE_BUDGET_MS)
      await pruneCaches()
    })(),
  )
})

/** Cache-first for same-origin assets, revalidated in the background. */
async function handleAsset(request) {
  // Content-hashed filenames mean a request can only ever match the build that
  // produced it, so falling through to an older cache is safe rather than a
  // risk of mixing two builds together.
  for (const name of await appCaches()) {
    const cache = await caches.open(name)
    const cached = await cache.match(request, { ignoreSearch: true })
    if (cached) {
      // Content-hashed files are immutable and a rebuild renames them all, so a
      // precached entry is never refreshed. Anything else gets an opportunistic
      // background check, which costs nothing offline because the rejection is
      // swallowed. Never writes over a good copy unless the response genuinely
      // belongs in that slot.
      if (!PRECACHED.has(bareUrl(request.url))) {
        fetch(request)
          .then(async (response) => {
            if (response.ok && response.status === 200) {
              await cache.put(request, normalize(response))
            }
          })
          .catch(() => {})
      }
      return cached
    }
  }
  try {
    const response = await fetch(request)
    if (contradictsRequest(request, response)) return notFound()
    if (isCacheable(request, response)) {
      const cache = await caches.open(CACHE)
      cache.put(request, normalize(response)).catch(() => {})
    }
    return response
  } catch {
    return new Response('Offline and not cached yet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

/**
 * App shell for every navigation, including the installed app's launch.
 *
 * The shell is served from the cache FIRST and the network is never awaited.
 * This is the whole fix for "it does not open with Wi-Fi off". A phone with no
 * connection can still resolve the hostname - local DNS, Private DNS, a cached
 * record, a router that answers - and in that case fetch() does not fail, it
 * sits in a TCP connect timeout for tens of seconds. Awaiting it before
 * answering left the launch on a blank screen, because the HTML itself never
 * arrived, and nothing in the app could do anything about it.
 *
 * Freshness is not lost. Every build ships a new worker with a new cache name;
 * it installs, calls skipWaiting, and the page reloads, so a new shell is
 * picked up atomically - and an update whose assets did not all arrive is never
 * picked up at all, which is what bestShell() is for.
 */
async function handleNavigation(request) {
  // Deliberately not awaited. A launch must never wait on the network, not
  // even for a request whose only purpose is tidying the cache up.
  repair().catch(() => {})

  // Always a shell the browser can actually run, never merely a shell that
  // exists. The exact spelling asked for is irrelevant - the shell answers
  // every navigation, and picking the wrong one is what produces a blank screen
  // that looks like a broken app rather than a cache that needs repairing.
  const best = await bestShell()
  if (best) return best.shell

  // Nothing cached yet. This is the very first visit, where the network is the
  // only thing that can possibly work.
  try {
    const response = await fetch(request)
    if (await isOurShell(request, response)) {
      const cache = await caches.open(CACHE)
      const clone = response.clone()
      await cache.put(SHELL, normalize(clone)).catch(() => {})
      return response
    }
  } catch {
    /* fall through to the offline page */
  }
  return offlinePage()
}

/** Rewrites a response into the plain, matchable form that gets stored. */
async function normalize(response) {
  const headers = normalizedHeaders(response)
  return new Response(await response.arrayBuffer(), {
    status: 200,
    statusText: 'OK',
    headers,
  })
}

/** Everything the Profile screen needs to explain the app's offline state. */
async function statusOf() {
  const names = await caches.keys()
  const ours = names.filter((name) => name.startsWith(CACHE_PREFIX))
  const cache = await caches.open(CACHE)
  const missing = await findDamage(cache)
  const best = await bestShell()
  const criticalMissing = missing.filter(isCritical)
  const shellKeys = []
  for (const key of SHELL_KEYS) {
    const hit = await cache.match(key)
    if (hit) shellKeys.push({ key, status: hit.status })
  }
  return {
    type: 'status',
    cache: CACHE,
    caches: ours,
    // A missing icon is cosmetic. A missing entry script means the launch dies
    // on a blank page, and the two must never look alike.
    bootable: Boolean(best && best.bootable),
    servedBy: best ? best.cache : null,
    servedComplete: best ? best.have === best.wanted.length : false,
    servingAssets: best ? best.have : 0,
    servingWanted: best ? best.wanted.length : 0,
    complete: missing.length === 0,
    // Counted against the precache list rather than by totalling the cache's
    // keys. The cache also holds this worker's own bookkeeping entry and both
    // spellings of the shell, so a raw key count reports more files than the
    // build ever asked for, and "12 of 11" reads as a fault rather than as the
    // answer.
    entryCount: PRECACHE.length - missing.length,
    expected: PRECACHE.length,
    missing,
    criticalMissing,
    shellKeys,
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only GETs are cacheable; the app makes no other requests.
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never intercept the worker script, or a navigation could be answered with a
  // stale copy of the very code that is meant to replace it, and the update
  // could never complete.
  if (url.pathname === self.location.pathname) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  event.respondWith(handleAsset(request))
})

self.addEventListener('message', (event) => {
  const data = event.data
  const reply = (payload) => {
    if (event.ports && event.ports[0]) event.ports[0].postMessage(payload)
    else if (event.source) event.source.postMessage(payload)
  }

  // Used by the "Update available" prompt in the app shell.
  if (data === 'skip-waiting') {
    self.skipWaiting()
    return
  }

  // Lets the page confirm the worker really is in charge and really does hold
  // the shell, which is otherwise invisible right up until the network is gone.
  if (data && data.type === 'status') {
    event.waitUntil(statusOf().then(reply))
  }

  // Backs the "Refresh offline cache" button. Forces a full re-fetch of
  // everything that is missing, ignoring the rate limit, so a user who has
  // just been told the app is not ready can fix it without hunting for a
  // reinstall or clearing site data.
  if (data && data.type === 'repair') {
    event.waitUntil(
      repair(true, Date.now() + REPAIR_BUDGET_MS).then((result) =>
        reply({ type: 'repaired', repaired: result.repaired, failed: result.failed }),
      ),
    )
  }
})
