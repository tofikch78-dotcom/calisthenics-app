import { useMemo, useState } from 'react'
import { LIBRARY } from '../data'
import { queryLibrary, type SortKey } from '../lib/search'
import type { Exercise } from '../types'
import { useEscape } from '../lib/use-escape'
import { ExerciseAnimation } from './ExerciseAnimation'
import { DifficultyBadge, IconClose, IconSearch, MusclePill, PlayPauseGlyph } from './ui'

export interface ExercisePickerProps {
  savedIds: ReadonlySet<string>
  /** Exercise ids already in the workout, shown as "added". */
  presentIds: string[]
  onPick: (exercise: Exercise) => void
  onClose: () => void
}

type Scope = 'mine' | 'all'

/**
 * One search result. The pause control is a sibling of the row's stretched
 * hit area rather than a child of it, so the markup has no nested buttons.
 */
function PickerRow({
  exercise,
  already,
  onPick,
}: {
  exercise: Exercise
  already: boolean
  onPick: () => void
}) {
  const [playing, setPlaying] = useState(true)
  const animated = (exercise.animation?.length ?? 0) > 1

  return (
    <li className="relative flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-ink-800">
      <span className="relative size-11 shrink-0 rounded-lg border border-ink-700 bg-ink-900/70 p-0.5">
        <ExerciseAnimation
          poses={exercise.animation}
          duration={1400}
          label={`${exercise.name} animation`}
          playing={playing}
        />
        {animated && (
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            aria-label={
              playing ? `Pause the ${exercise.name} animation` : `Play the ${exercise.name} animation`
            }
            aria-pressed={playing}
            className="absolute right-0 bottom-0 z-10 grid size-3.5 place-items-center rounded-full border border-ink-600/80 bg-ink-900/85 text-mist-300"
          >
            <PlayPauseGlyph playing={playing} className="h-1.5 w-1.5" />
          </button>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-mist-100">{exercise.name}</span>
        <span className="mt-1 flex items-center gap-1.5">
          <MusclePill muscle={exercise.mainMuscle} />
          <DifficultyBadge level={exercise.difficulty} />
        </span>
      </span>

      <span
        className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium ${
          already ? 'bg-ink-800 text-mist-400' : 'bg-brand-500 text-white'
        }`}
      >
        {already ? 'Add again' : 'Add'}
      </span>

      <button
        type="button"
        onClick={onPick}
        aria-label={`Add ${exercise.name} to the workout`}
        className="absolute inset-0 z-0 rounded-xl"
      />
    </li>
  )
}

export function ExercisePicker({ savedIds, presentIds, onPick, onClose }: ExercisePickerProps) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<Scope>(savedIds.size ? 'mine' : 'all')
  useEscape(onClose)

  const results = useMemo(() => {
    const base = queryLibrary(
      {
        query,
        muscles: [],
        movements: [],
        difficulties: [],
        equipment: [],
        onlySaved: scope === 'mine',
        sort: 'name' as SortKey,
      },
      savedIds,
    )
    return base
  }, [query, scope, savedIds])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 pb-[calc(var(--app-nav-bottom-h,0px)+0.5rem)] backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Add an exercise"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {/*
        The sheet is anchored to the bottom of the screen on a phone, and the
        nav is fixed to the bottom of the screen too. Without clearing it here,
        the bottom 52 pixels of the sheet — the last result and its Add button —
        sat permanently under the nav, which is z-40 over this z-50 backdrop's
        z-30 siblings, so those taps went to the nav instead. The bottom padding
        on the wrapper above lifts the whole sheet clear of it.
      */}
      <div className="animate-rise flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-ink-600 bg-ink-900 shadow-2xl sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-ink-700 px-4 py-3">
          <h2 className="flex-1 text-sm font-semibold text-mist-100">Add an exercise</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-mist-400 transition hover:bg-ink-800 hover:text-white"
          >
            <IconClose />
          </button>
        </header>

        <div className="border-b border-ink-700 p-3">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-mist-400" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the library…"
              className="w-full rounded-lg border border-ink-600 bg-ink-850 py-2 pr-3 pl-9 text-sm text-mist-100 placeholder:text-ink-500 focus:border-brand-400/70 focus:outline-none"
            />
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            {(['mine', 'all'] as Scope[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  scope === value
                    ? 'bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/30'
                    : 'text-mist-400 hover:text-mist-100'
                }`}
              >
                {value === 'mine' ? `My Exercises (${savedIds.size})` : `All (${LIBRARY.length})`}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-mist-400">
              {results.length === LIBRARY.length
                ? `All ${LIBRARY.length}`
                : `${results.length} of ${LIBRARY.length}`}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-slim p-2">
          {results.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-mist-400">
              {scope === 'mine'
                ? 'Nothing saved matches. Switch to “All” to search the whole library.'
                : 'No exercises match that search.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {results.map((exercise) => (
                <PickerRow
                  key={exercise.id}
                  exercise={exercise}
                  already={presentIds.includes(exercise.id)}
                  onPick={() => onPick(exercise)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
