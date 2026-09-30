import { useState } from 'react'
import { getExercise } from '../data'
import type { Exercise, Workout } from '../types'
import { Button, EmptyState, IconCopy, IconDumbbell, IconPlus, IconTrash, MusclePill } from './ui'
import { WorkoutEditor } from './WorkoutEditor'

export interface WorkoutsViewProps {
  workouts: Workout[]
  onCreate: (name: string, day: string, seedExerciseIds: string[]) => Workout
  onUpdate: (id: string, patch: Partial<Workout>) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onRequestAddExercise: (workoutId: string) => void
  onOpenExercise: (exercise: Exercise) => void
  /** Exercises pre-selected when creating a workout from My Exercises. */
  seedExerciseIds: string[]
  onSeedConsumed: () => void
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function WorkoutSummary({ workout }: { workout: Workout }) {
  const items = workout.items
    .map((item) => getExercise(item.exerciseId))
    .filter((item): item is Exercise => Boolean(item))
  const muscles = [...new Set(items.map((item) => item.mainMuscle))]
  const sets = workout.items.reduce((sum, item) => sum + (item.sets || 0), 0)

  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5">
      {muscles.slice(0, 3).map((muscle) => (
        <MusclePill key={muscle} muscle={muscle} />
      ))}
      {muscles.length > 3 && <span className="text-[11px] text-mist-400">+{muscles.length - 3}</span>}
      <span className="text-xs text-mist-400">
        {workout.items.length} {workout.items.length === 1 ? 'exercise' : 'exercises'} · {sets} sets
      </span>
    </p>
  )
}

export function WorkoutsView({
  workouts,
  onCreate,
  onUpdate,
  onDelete,
  onDuplicate,
  onRequestAddExercise,
  onOpenExercise,
  seedExerciseIds,
  onSeedConsumed,
}: WorkoutsViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [day, setDay] = useState('')

  const active = workouts.find((workout) => workout.id === activeId)

  const create = () => {
    const workout = onCreate(
      name.trim() || (seedExerciseIds.length ? 'My workout' : 'New workout'),
      day,
      seedExerciseIds,
    )
    if (seedExerciseIds.length) onSeedConsumed()
    setName('')
    setDay('')
    setActiveId(workout.id)
  }

  if (active) {
    return (
      <WorkoutEditor
        workout={active}
        onChange={(patch) => onUpdate(active.id, patch)}
        onDelete={() => {
          onDelete(active.id)
          setActiveId(null)
        }}
        onDuplicate={() => {
          onDuplicate(active.id)
          setActiveId(null)
        }}
        onBack={() => setActiveId(null)}
        onAddExercise={() => onRequestAddExercise(active.id)}
        onOpenExercise={onOpenExercise}
      />
    )
  }

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-ink-700 bg-ink-850/60 p-4">
        <h2 className="text-sm font-semibold text-mist-100">🏗️ Create Workout</h2>
        <p className="mt-1 text-xs text-mist-400">
          Nothing is pre-set for you. Add whichever exercises you want and define the sets, reps,
          holds, rest and load yourself.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={day}
            onChange={(event) => setDay(event.target.value)}
            className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100"
          >
            <option value="">No day</option>
            {DAYS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') create()
            }}
            placeholder="Workout name (e.g. Push)"
            className="min-w-48 flex-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100 placeholder:text-ink-500 focus:border-brand-400/70 focus:outline-none"
          />
          <Button variant="primary" onClick={create} className="py-2">
            <IconPlus /> Create
          </Button>
        </div>
        {seedExerciseIds.length > 0 && (
          <p className="mt-2 text-xs text-brand-300">
            {seedExerciseIds.length} selected {seedExerciseIds.length === 1 ? 'exercise' : 'exercises'}{' '}
            will be added to the new workout.
          </p>
        )}
      </div>

      {workouts.length === 0 ? (
        <EmptyState
          icon={<IconDumbbell className="h-6 w-6" />}
          title="No workouts yet"
          description="Create your first workout above, then add exercises from My Exercises or search the full library."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {workouts.map((workout) => (
            <li
              key={workout.id}
              className="group rounded-2xl border border-ink-700 bg-ink-850/70 p-4 transition hover:border-ink-500"
            >
              <button type="button" onClick={() => setActiveId(workout.id)} className="w-full text-left">
                <span className="text-xs tracking-wide text-mist-400 uppercase">
                  {workout.day || 'Workout'}
                </span>
                <h3 className="mt-0.5 text-base font-semibold text-mist-100 group-hover:text-white">
                  {workout.name}
                </h3>
                <WorkoutSummary workout={workout} />
              </button>
              <div className="mt-3 flex items-center gap-1.5 border-t border-ink-700 pt-2.5">
                <button
                  type="button"
                  onClick={() => onDuplicate(workout.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-mist-400 transition hover:bg-ink-800 hover:text-mist-100"
                >
                  <IconCopy className="h-3.5 w-3.5" /> Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete “${workout.name}”?`)) onDelete(workout.id)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-mist-400 transition hover:bg-rose-500/12 hover:text-rose-300"
                >
                  <IconTrash className="h-3.5 w-3.5" /> Delete
                </button>
                <button
                  type="button"
                  onClick={() => setActiveId(workout.id)}
                  className="ml-auto rounded-lg bg-brand-500/15 px-2.5 py-1 text-xs font-medium text-brand-300 transition hover:bg-brand-500/25"
                >
                  Open
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
