import { useCallback, useEffect, useState } from 'react'
import {
  isStandalone,
  refreshOfflineCache,
  workerStatus,
  type WorkerStatus,
} from '../lib/pwa'
import { Card, IconCheck, IconClose, Pill } from './kit'
import { Button } from './ui'

/**
 * The honest answer to "will this open with the network off?".
 *
 * Everything else in the app is optimistic: it works, so it must be fine. It is
 * not. A service worker can fail to register, can register but never control the
 * page, can control it and hold a cache missing its own entry script, and in
 * every one of those cases the app behaves perfectly while there is a connection
 * and does nothing at all the moment there is not. Nothing about that is visible
 * from the outside, which is why an installed app that cannot open offline is
 * usually diagnosed by guessing.
 *
 * This card is the diagnosis: the same checks, in plain language, with the one
 * action that can actually fix a bad cache.
 */
export function OfflineReadinessCard() {
  const [status, setStatus] = useState<WorkerStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const check = useCallback(() => {
    workerStatus().then(setStatus)
  }, [])

  useEffect(() => {
    let cancelled = false
    // Kept in a promise callback rather than set synchronously in the effect
    // body: the worker answers over a message channel, so there is always at
    // least one turn of the event loop before there is anything to show.
    const run = () => {
      workerStatus().then((next) => {
        if (!cancelled) setStatus(next)
      })
    }
    run()
    // Coming back to the app is exactly when the answer may have changed - a
    // visit in between is what repairs a cache.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', run)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', run)
    }
  }, [])

  const refresh = async () => {
    setBusy(true)
    setNote(null)
    const result = await refreshOfflineCache()
    setBusy(false)
    if (result.ok) {
      setNote({
        tone: 'ok',
        text: result.repaired.length
          ? `Cached ${result.repaired.length} missing file${result.repaired.length === 1 ? '' : 's'}.`
          : 'Offline cache was already complete.',
      })
    } else {
      setNote({
        tone: 'bad',
        text:
          result.error ||
          (result.failed.length
            ? `Still missing: ${result.failed.join(', ')}`
            : 'Could not refresh the cache.'),
      })
    }
    check()
  }

  if (!status) {
    return (
      <Card>
        <h3 className="text-sm font-semibold text-mist-100">Offline readiness</h3>
        <p className="mt-1 text-xs text-mist-400">Checking…</p>
      </Card>
    )
  }

  const ready =
    status.supported &&
    status.secureContext &&
    status.registered &&
    status.active &&
    status.controlling &&
    !status.scriptProblem &&
    !status.error &&
    status.bootable &&
    status.missing.length === 0

  const rows: { ok: boolean; label: string; detail?: string }[] = [
    {
      ok: status.supported && status.secureContext,
      label: status.secureContext ? 'Secure origin (https or localhost)' : 'Secure origin',
      detail: status.secureContext
        ? undefined
        : 'A service worker cannot run on a plain http:// address on a phone.',
    },
    {
      ok: status.registered,
      label: 'Service worker registered',
      detail: status.scope ? `Scope ${status.scope}` : 'sw.js has not been registered yet.',
    },
    { ok: status.active, label: 'Worker active', detail: status.scriptUrl ?? undefined },
    {
      ok: status.controlling,
      label: 'App controlled by the worker',
      detail: status.controlling
        ? 'This session is served from the offline cache.'
        : 'Nothing is intercepting this session, so nothing it loads is being saved.',
    },
    {
      ok: status.bootable && status.missing.length === 0,
      label: 'Required files cached',
      detail: status.expected
        ? `${status.entryCount} of ${status.expected} precached`
        : 'No precache reported yet.',
    },
  ]

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-mist-100">Offline readiness</h3>
          <p className="mt-0.5 text-xs text-mist-400">
            Whether this app opens from the home screen with Wi-Fi and mobile data both off.
          </p>
        </div>
        <Pill
          className={
            ready
              ? 'bg-lime-glow/12 text-lime-glow ring-lime-glow/30'
              : 'bg-rose-glow/12 text-rose-glow ring-rose-glow/30'
          }
        >
          {ready ? 'READY' : 'NOT READY'}
        </Pill>
      </div>

      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                row.ok ? 'bg-lime-glow/15 text-lime-glow' : 'bg-rose-glow/15 text-rose-glow'
              }`}
            >
              {row.ok ? <IconCheck className="h-3 w-3" /> : <IconClose className="h-3 w-3" />}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-mist-100">{row.label}</span>
              {row.detail ? (
                <span className="block text-[11px] break-words text-mist-400">{row.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {status.scriptProblem ? (
        <p className="mt-3 rounded-xl border border-rose-glow/30 bg-rose-glow/8 p-2.5 text-[11px] text-rose-200">
          {status.scriptProblem}
        </p>
      ) : null}
      {status.error && !status.scriptProblem ? (
        <p className="mt-3 rounded-xl border border-rose-glow/30 bg-rose-glow/8 p-2.5 text-[11px] text-rose-200">
          Registration failed: {status.error}
        </p>
      ) : null}

      {status.missing.length ? (
        <div className="mt-3">
          <p className="text-[10px] tracking-wide text-mist-400 uppercase">
            Missing from the cache ({status.missing.length})
          </p>
          <ul className="mt-1.5 space-y-1">
            {status.missing.map((path) => (
              <li key={path} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-mist-300">{path}</span>
                {status.criticalMissing.includes(path) ? (
                  <Pill className="bg-rose-glow/12 text-rose-glow ring-rose-glow/25">
                    would block launch
                  </Pill>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] text-mist-500">
            A missing icon or manifest entry is cosmetic; one marked &ldquo;would block
            launch&rdquo; means the app would open to a blank screen.
          </p>
        </div>
      ) : null}

      {status.caches.length > 1 || (status.servedBy && status.servedBy !== status.cache) ? (
        <p className="mt-3 text-[10px] break-words text-mist-500">
          {status.caches.length} cache generation{status.caches.length === 1 ? '' : 's'} present
          {status.servedBy && status.servedBy !== status.cache
            ? ` · launches are being answered by ${status.servedBy}, an earlier build, because the current one is not complete yet`
            : ''}
          . Older caches are removed once the current build is whole.
        </p>
      ) : null}

      {status.servedBy && status.servingWanted > 0 && !status.servedComplete ? (
        <p className="mt-1.5 text-[10px] text-amber-glow">
          The cached app shell needs {status.servingWanted} file
          {status.servingWanted === 1 ? '' : 's'} and only {status.servingAssets} of them are
          cached. The app may open to a blank screen until the cache is refreshed.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={refresh} disabled={busy} className="min-h-11">
          {busy ? 'Refreshing…' : 'Refresh offline cache'}
        </Button>
        <Button variant="ghost" onClick={check} disabled={busy} className="min-h-11">
          Check again
        </Button>
        {isStandalone() ? (
          <span className="text-[10px] text-mist-500">Running as an installed app.</span>
        ) : null}
      </div>

      {note ? (
        <p
          className={`mt-2 text-[11px] ${note.tone === 'ok' ? 'text-lime-glow' : 'text-rose-glow'}`}
        >
          {note.text}
        </p>
      ) : null}

      {ready ? (
        <p className="mt-2 text-[11px] text-mist-400">
          Turn the network off and open the app from your home screen — it will come straight
          back up. Nothing here touches your data; workouts, history and settings stay exactly
          where they are.
        </p>
      ) : null}
    </Card>
  )
}
