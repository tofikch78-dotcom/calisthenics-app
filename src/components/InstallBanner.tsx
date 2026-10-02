import { useEffect, useState } from 'react'
import { applyUpdate, promptInstall, subscribeToInstallState } from '../lib/pwa'
import { IconClose, IconDownload } from './kit'

/**
 * A single, quiet bar for the two PWA moments that matter: an install prompt
 * is available, or a fresh build is ready. It never blocks the app and it
 * disappears for good once dismissed.
 */
export function InstallBanner() {
  const [canInstall, setCanInstall] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(
    () =>
      subscribeToInstallState((state) => {
        setCanInstall(state.canInstall)
        setUpdateReady(state.updateReady)
      }),
    [],
  )

  // An update is worth surfacing even after the install banner was dismissed,
  // because applying it is the only way to get the new build.
  if (updateReady) {
    return (
      <div className="fixed inset-x-0 bottom-[4.75rem] z-50 px-3 md:bottom-4 md:left-auto md:right-4 md:w-96">
        <div className="animate-rise flex items-center gap-3 rounded-2xl border border-brand-400/35 bg-ink-900/95 p-3 shadow-xl shadow-black/50 backdrop-blur-xl">
          <p className="min-w-0 flex-1 text-xs text-mist-200">
            <span className="font-semibold text-mist-100">Update ready.</span> Reload to get the
            latest version.
          </p>
          <button
            type="button"
            onClick={applyUpdate}
            className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-400"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss update"
            className="shrink-0 rounded-lg p-1 text-mist-400 transition hover:text-mist-200"
          >
            <IconClose className="size-4" />
          </button>
        </div>
      </div>
    )
  }

  if (!canInstall || dismissed) return null

  return (
    <div className="fixed inset-x-0 bottom-[4.75rem] z-50 px-3 md:bottom-4 md:left-auto md:right-4 md:w-96">
      <div className="animate-rise flex items-center gap-3 rounded-2xl border border-ink-600 bg-ink-900/95 p-3 shadow-xl shadow-black/50 backdrop-blur-xl">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
          <IconDownload className="size-4" />
        </span>
        <p className="min-w-0 flex-1 text-xs text-mist-300">
          <span className="font-semibold text-mist-100">Install the app</span> — works offline and
          keeps your data on this phone.
        </p>
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-400"
        >
          Install
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss install prompt"
          className="shrink-0 rounded-lg p-1 text-mist-400 transition hover:text-mist-200"
        >
          <IconClose className="size-4" />
        </button>
      </div>
    </div>
  )
}
