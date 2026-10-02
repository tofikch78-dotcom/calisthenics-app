import { useEffect, useState } from 'react'
import { isStandalone, promptInstall, subscribeToInstallState, workerStatus } from '../lib/pwa'
import { Card, IconCheck, IconDownload } from './kit'

/**
 * The manual counterpart to the install banner.
 *
 * `beforeinstallprompt` is Chromium-only and is frequently suppressed — in an
 * installed app, in some in-app browsers, and after the user has dismissed the
 * prompt once. On those devices the only route is the browser's own menu, so
 * this card always shows the manual steps and only offers the one-tap button
 * when the browser has actually said it is available.
 */
export function InstallCard() {
  const [canInstall, setCanInstall] = useState(false)
  const [installed, setInstalled] = useState(isStandalone)
  const [busy, setBusy] = useState(false)

  useEffect(
    () =>
      subscribeToInstallState((state) => {
        setCanInstall(state.canInstall)
        setInstalled(state.installed || isStandalone())
      }),
    [],
  )

  if (installed) {
    return (
      <Card className="border-lime-glow/25">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime-glow/12 text-lime-glow"
          >
            <IconCheck className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-mist-100">Installed</h3>
            <p className="mt-0.5 text-xs text-mist-400">
              You are running the installed app. It opens from your home screen and works with no
              connection — your data is stored on this phone only.
            </p>
            <OfflineReady />
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-mist-100">Install on this phone</h3>
      <p className="mt-0.5 text-xs text-mist-400">
        Add it to your home screen so it opens like a normal app — no browser bar, no connection
        needed, and your training data stays on this device.
      </p>

      {canInstall && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const ok = await promptInstall()
            if (ok) setInstalled(true)
            setBusy(false)
          }}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-400 disabled:opacity-60"
        >
          <IconDownload className="h-3.5 w-3.5" />
          {busy ? 'Opening…' : 'Add to home screen'}
        </button>
      )}

      {!canInstall && (
        <ol className="mt-3 space-y-1.5 rounded-xl border border-ink-700 bg-ink-900/40 p-3 text-[11px] leading-relaxed text-mist-400">
          <li>
            <span className="font-semibold text-mist-200">Chrome / Edge:</span> tap{' '}
            <span aria-hidden="true">⋮</span> in the top-right, then{' '}
            <span className="text-mist-200">Add to Home screen</span>.
          </li>
          <li>
            <span className="font-semibold text-mist-200">Safari (iPhone):</span> tap{' '}
            <span aria-hidden="true">⬆︎</span> Share, then{' '}
            <span className="text-mist-200">Add to Home Screen</span>.
          </li>
        </ol>
      )}
    </Card>
  )
}

/**
 * Reports whether the app is genuinely ready to open with no connection.
 *
 * Without this the one failure that matters is completely invisible: an install
 * that never finished caching looks exactly like a working app while the
 * network is up, and then does nothing at all in airplane mode. Checking while
 * the connection is still there is the only chance to catch it.
 *
 * Only ever claims readiness, never the reverse, so a probe that cannot reach
 * the worker (an old browser, a blocked message channel) shows nothing rather
 * than a false alarm.
 */
function OfflineReady() {
  const [ready, setReady] = useState<boolean | null>(null)

  useEffect(() => {
    let live = true
    workerStatus().then((status) => {
      if (!live) return
      if (status.registered && status.controlling && status.bootable) setReady(true)
    })
    return () => {
      live = false
    }
  }, [])

  if (ready !== true) return null

  return (
    <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-lime-glow">
      <IconCheck className="h-3 w-3" />
      Ready to open offline — all files are stored on this phone.
    </p>
  )
}