import { useMemo, useState } from 'react'
import { getExercise } from '../data'
import type { Exercise } from '../types'
import { ExerciseCard } from './ExerciseCard'
import { EmptyState, IconBook } from './ui'

export interface MyExercisesViewProps {
  ids: string[]
  onToggleSave: (id: string) => void
  onOpen: (exercise: Exercise) => void
  onClear: () => void
  onGoToLibrary: () => void
  onStartWorkout: (exerciseIds: string[]) => void
}

type SortChoice = 'recent' | 'name' | 'difficulty'

const SORTS: Record<SortChoice, string> = {
  recent: 'Recently added',
  name: 'Name (A–Z)',
  difficulty: 'Difficulty',
}

const RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const

export function MyExercisesView({
  ids,
  onToggleSave,
  onOpen,
  onClear,
  onGoToLibrary,
  onStartWorkout,
}: MyExercisesViewProps) {
  const [sort, setSort] = useState<SortChoice>('recent')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const exercises = useMemo(() => {
    const items = ids.map(getExercise).filter((item): item is Exercise => Boolean(item))
    if (sort === 'name') return items.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'difficulty')
      return items.sort(
        (a, b) => RANK[a.difficulty] - RANK[b.difficulty] || a.name.localeCompare(b.name),
      )
    return items
  }, [ids, sort])

  const toggleSelected = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (!exercises.length) {
    return (
      <EmptyState
        icon={<IconBook className="h-6 w-6" />}
        title="Your exercise list is empty"
        description="Browse the library and tap “Add to My Exercises” on anything you want to train. Your picks become available when you build a workout."
        action={
          <button
            type="button"
            onClick={onGoToLibrary}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400"
          >
            Browse the library
          </button>
        }
      />
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mist-400">
          <span className="font-semibold text-mist-100">{exercises.length}</span> saved{' '}
          {exercises.length === 1 ? 'exercise' : 'exercises'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortChoice)}
            className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-mist-100"
          >
            {(Object.keys(SORTS) as SortChoice[]).map((key) => (
              <option key={key} value={key}>
                {SORTS[key]}
              </option>
            ))}
          </select>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => {
                onStartWorkout([...selected])
                setSelected(new Set())
              }}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-400"
            >
              Create workout ({selected.size})
            </button>
          )}
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-ink-600 px-3 py-1.5 text-sm text-mist-300 transition hover:border-rose-400/50 hover:text-rose-300"
          >
            Remove all
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-ink-700 bg-ink-850/60 px-3 py-2.5">
        <span className="text-xs text-mist-400">Select to build a workout:</span>
        <button
          type="button"
          onClick={() =>
            setSelected((current) =>
              current.size === exercises.length ? new Set() : new Set(exercises.map((e) => e.id)),
            )
          }
          className="rounded-md border border-ink-600 px-2 py-0.5 text-xs text-mist-300 transition hover:border-brand-400/50 hover:text-brand-300"
        >
          {selected.size === exercises.length ? 'Clear selection' : 'Select all'}
        </button>
        <span className="ml-auto text-xs text-mist-400">{selected.size} selected</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {exercises.map((exercise) => (
          <div key={exercise.id} className="relative">
            <label className="absolute top-3 left-3 z-10 flex size-6 cursor-pointer items-center justify-center rounded-md border border-ink-600 bg-ink-900/80 backdrop-blur transition hover:border-brand-400/60">
              <input
                type="checkbox"
                checked={selected.has(exercise.id)}
                onChange={() => toggleSelected(exercise.id)}
                className="peer sr-only"
                aria-label={`Select ${exercise.name}`}
              />
              <span
                aria-hidden="true"
                className={`grid size-3.5 place-items-center rounded-[3px] text-ink-950 transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-400 ${
                  selected.has(exercise.id) ? 'bg-brand-400' : 'bg-transparent'
                }`}
              >
                {selected.has(exercise.id) && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
                    <path d="m5 12.5 4.5 4.5L19 7" />
                  </svg>
                )}
              </span>
            </label>
            <ExerciseCard
              exercise={exercise}
              saved
              onToggleSave={onToggleSave}
              onOpen={onOpen}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
