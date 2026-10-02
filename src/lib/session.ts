import { createId } from './store'
import { todayKey } from './dates'
import type { LoggedSet, SessionItem, Workout, WorkoutSession } from '../types'

/** Turns a workout template into a dated, trackable session. */
export function startSession(
  workout: Workout,
  date = todayKey(),
  overrides: Partial<Pick<WorkoutSession, 'date' | 'workoutName' | 'id' | 'startedAt'>> = {},
): WorkoutSession {
  const items: SessionItem[] = workout.items.map((item) => ({
    id: createId('sitem'),
    exerciseId: item.exerciseId,
    targetSets: item.sets,
    targetReps: item.reps,
    targetHoldSec: item.holdSec,
    targetWeight: item.weight,
    // Carried over so the rest timer knows what the workout prescribed. Without
    // this the value only existed on the template and was gone the moment the
    // session started.
    targetRestSec: item.restSec,
    sets: Array.from({ length: Math.max(1, item.sets) }, (): LoggedSet => ({
      reps: item.reps,
      holdSec: item.holdSec,
      weight: item.weight,
      status: 'pending',
    })),
    status: 'not-started',
    note: item.notes,
  }))

  return {
    id: createId('sess'),
    workoutId: workout.id,
    workoutName: workout.name,
    date,
    startedAt: Date.now(),
    status: 'in-progress',
    items,
    ...overrides,
  }
}

/** An empty session, for training without a template. */
export function emptySession(name = 'Freestyle session', date = todayKey()): WorkoutSession {
  return {
    id: createId('sess'),
    workoutName: name,
    date,
    startedAt: Date.now(),
    status: 'in-progress',
    items: [],
  }
}

/** Adds an exercise to a live session, seeded from the library dosage. */
export function addSessionItem(
  exercise: { id: string; dosage: { sets: number; reps?: number; holdSec?: number; restSec: number } },
): SessionItem {
  return {
    id: createId('sitem'),
    exerciseId: exercise.id,
    targetSets: exercise.dosage.sets,
    targetReps: exercise.dosage.reps,
    targetHoldSec: exercise.dosage.holdSec,
    targetRestSec: exercise.dosage.restSec,
    sets: Array.from({ length: Math.max(1, exercise.dosage.sets) }, (): LoggedSet => ({
      reps: exercise.dosage.reps,
      holdSec: exercise.dosage.holdSec,
      status: 'pending',
    })),
    status: 'not-started',
  }
}

/* ── Session editing ──────────────────────────────────────────────────────── */

/*
 * The editing rules live in `session-edit` so they can be exercised without
 * React or storage. Re-exported here because `session` is where the rest of the
 * session vocabulary already lives, and callers should not have to know which of
 * the two files a given helper came from.
 */
export {
  appendSet,
  dropLastSet,
  mapSession,
  patchSessionItem,
  patchSessionSet,
  recomputeItemStatus,
  setItemSkipped,
  toggleSetStatus,
} from './session-edit'

export const ITEM_STATUS_META: Record<
  SessionItem['status'],
  { label: string; chip: string; indicator: string }
> = {
  'not-started': { label: 'Not started', chip: 'bg-ink-800 text-mist-400 ring-ink-600', indicator: '⚪' },
  'in-progress': { label: 'In progress', chip: 'bg-brand-400/15 text-brand-300 ring-brand-400/30', indicator: '🔵' },
  completed: { label: 'Completed', chip: 'bg-lime-glow/15 text-lime-glow ring-lime-glow/30', indicator: '✅' },
  skipped: { label: 'Skipped', chip: 'bg-rose-glow/15 text-rose-glow ring-rose-glow/30', indicator: '⏭️' },
}

/** Elapsed time, rounded to whole seconds, for a running session. */
export function elapsedSeconds(session: WorkoutSession, now: number): number {
  const end = session.completedAt ?? now
  return Math.max(0, Math.round((end - session.startedAt) / 1000))
}

/** "How did you feel?" presets plus free text. */
export const FEELINGS = ['Strong', 'Good', 'Okay', 'Tired', 'Sore', 'Rough'] as const
export type Feeling = (typeof FEELINGS)[number]
