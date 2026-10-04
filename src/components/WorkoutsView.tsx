import { useRef, useState } from 'react'
import { getExercise } from '../data'
import { muscleLabel } from '../lib/labels'
import type { Exercise, Muscle, Workout } from '../types'
import {
  Button,
  EmptyState,
  IconCopy,
  IconDumbbell,
  IconPlus,
  IconTrash,
  MusclePill,
} from './ui'
import { IconPlay } from './kit'
import { WorkoutEditor } from './WorkoutEditor'

export interface WorkoutsViewProps {
  workouts: Workout[]
  savedIds: ReadonlySet<string>
  onSave: (workout: Workout) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onStart: (workout: Workout) => void
  onOpenExercise: (exercise: Exercise) => void
  /** Exercises pre-selected when creating a workout from My Exercises. */
  seedExerciseIds: string[]
  onSeedConsumed: () => void
  /** A workout another screen asked to open, e.g. "Edit" on the Today tab. */
  openWorkoutId: string | null
  onOpenConsumed: () => void
}

/** What the builder is currently open on. `token` re-keys it per open. */
type OpenTarget = { token: string; workoutId: string | null }

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
  savedIds,
  onSave,
  onDelete,
  onDuplicate,
  onStart,
  onOpenExercise,
  seedExerciseIds,
  onSeedConsumed,
  openWorkoutId,
  onOpenConsumed,
}: WorkoutsViewProps) {
  const [nav, setNav] = useState<{ open: OpenTarget | null; seen: string }>({
    open: null,
    seen: '',
  })
  const seq = useRef(0)

  /*
   * Another screen can ask for the builder at any time — My Exercises hands
   * over a set of exercises, and the Today tab's "Edit" hands over a workout id.
   */
  const request: OpenTarget | null = seedExerciseIds.length
    ? { token: 'seeds', workoutId: null }
    : openWorkoutId
      ? { token: openWorkoutId, workoutId: openWorkoutId }
      : null

  /*
   * A request is adopted exactly once, and the open target it produces is
   * sticky state rather than a derived value. It has to be: the props that
   * carried the request are cleared the moment the editor mounts — the seeds
   * it was handed are consumed there, and the parent drops the workout id when
   * the editor closes — so a target recomputed from those props would vanish
   * on the very next render and slam the editor shut again.
   *
   * Adjusted during render rather than in an effect, so the list is never
   * painted for a frame before the editor replaces it. `''` is the "no request"
   * marker: comparing an optional token against `null` would be true forever
   * with no request, and the re-render would never settle.
   */
  const requestToken = request?.token ?? ''
  if (requestToken !== nav.seen) {
    setNav({ seen: requestToken, open: request ? { ...request } : nav.open })
  }

  const open = nav.open
  const editing = open?.workoutId
    ? workouts.find((workout) => workout.id === open.workoutId)
    : undefined

  const close = () => {
    setNav((current) => ({ ...current, open: null }))
    if (openWorkoutId) onOpenConsumed()
  }

  const openTarget = (workoutId: string | null) =>
    setNav((current) => ({
      ...current,
      open: { token: `t${++seq.current}`, workoutId },
    }))

  if (open) {
    return (
      <WorkoutEditor
        // Re-keying is what makes a second "Create Workout" start from a blank
        // draft instead of reusing the previous one's state.
        key={open.token}
        workout={editing ?? null}
        seedExerciseIds={seedExerciseIds}
        savedIds={savedIds}
        onSeedsConsumed={onSeedConsumed}
        onSave={(workout) => {
          onSave(workout)
          close()
        }}
        onDelete={
          editing
            ? () => {
                onDelete(editing.id)
                close()
              }
            : undefined
        }
        onDuplicate={
          editing
            ? () => {
                onDuplicate(editing.id)
                close()
              }
            : undefined
        }
        onCancel={close}
        onOpenExercise={onOpenExercise}
      />
    )
  }

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-ink-700 bg-ink-850/60 p-4">
        <h2 className="text-sm font-semibold text-mist-100">🏗️ Create Workout</h2>
        <p className="mt-1 text-xs text-mist-400">
          Nothing is pre-set for you. You choose the muscle, the exercises, and every set, rep,
          hold, rest and load.
        </p>
        <Button
          variant="primary"
          onClick={() => openTarget(null)}
          className="mt-3 min-h-11 w-full py-2.5"
        >
          <IconPlus /> Create Workout
        </Button>
      </div>

      {workouts.length === 0 ? (
        <EmptyState
          icon={<IconDumbbell className="h-6 w-6" />}
          title="No workouts yet"
          description="Create your first workout above — pick a muscle, choose your exercises, then save it to this device."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {workouts.map((workout) => {
            const muscles = [
              ...new Set(
                workout.items
                  .map((item) => getExercise(item.exerciseId)?.mainMuscle)
                  .filter((muscle): muscle is Muscle => Boolean(muscle)),
              ),
            ]
            return (
              <li
                key={workout.id}
                className="group rounded-2xl border border-ink-700 bg-ink-850/70 p-4 transition hover:border-ink-500"
              >
                <button
                  type="button"
                  onClick={() => openTarget(workout.id)}
                  className="w-full text-left"
                >
                  <span className="text-xs tracking-wide text-mist-400 uppercase">
                    {workout.day || 'Workout'}
                  </span>
                  <h3 className="mt-0.5 text-base font-semibold text-mist-100 group-hover:text-white">
                    {workout.name}
                  </h3>
                  <WorkoutSummary workout={workout} />
                </button>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-ink-700 pt-2.5">
                  <button
                    type="button"
                    onClick={() => onDuplicate(workout.id)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-mist-400 transition hover:bg-ink-800 hover:text-mist-100"
                  >
                    <IconCopy className="h-3.5 w-3.5" /> Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete “${workout.name}”?`)) onDelete(workout.id)
                    }}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-mist-400 transition hover:bg-rose-500/12 hover:text-rose-300"
                  >
                    <IconTrash className="h-3.5 w-3.5" /> Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => onStart(workout)}
                    disabled={!workout.items.length}
                    title={
                      workout.items.length
                        ? undefined
                        : 'Add exercises to this workout before starting it.'
                    }
                    className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-lime-glow/15 px-2.5 py-1 text-xs font-medium text-lime-glow transition hover:bg-lime-glow/25 disabled:bg-ink-800 disabled:text-ink-500"
                  >
                    <IconPlay className="h-3.5 w-3.5" /> Start
                  </button>
                  <button
                    type="button"
                    onClick={() => openTarget(workout.id)}
                    className="min-h-11 min-w-11 rounded-lg bg-brand-500/15 px-2.5 py-1 text-xs font-medium text-brand-300 transition hover:bg-brand-500/25"
                  >
                    Edit
                  </button>
                </div>
                {muscles.length > 0 && (
                  <p className="mt-1.5 text-[10px] text-mist-500">
                    {muscles.map(muscleLabel).join(' · ')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
