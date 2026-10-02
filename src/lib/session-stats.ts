import type { SessionStatus, WorkoutSession } from '../types'

/**
 * What a session actually contains.
 *
 * Kept separate from `stats.ts` because everything here is a pure reading of one
 * session — no exercise catalogue, no calendar, no profile. That makes the rules
 * that decide whether work counts real work directly checkable in
 * `verify-session-flow.mjs`, which matters because these numbers are what end up
 * in history, streaks and records.
 */

export interface SessionStats {
  exercisesTotal: number
  exercisesDone: number
  exercisesSkipped: number
  setsTotal: number
  setsDone: number
  reps: number
  holdSec: number
  volume: number
  /** 0–100, rounded. Sets are the unit of credit, not exercises. */
  completion: number
}

export function emptySessionStats(): SessionStats {
  return {
    exercisesTotal: 0,
    exercisesDone: 0,
    exercisesSkipped: 0,
    setsTotal: 0,
    setsDone: 0,
    reps: 0,
    holdSec: 0,
    volume: 0,
    completion: 0,
  }
}

export function sessionStats(session: WorkoutSession): SessionStats {
  const stats = emptySessionStats()
  stats.exercisesTotal = session.items.length

  for (const item of session.items) {
    if (item.status === 'completed') stats.exercisesDone += 1
    if (item.status === 'skipped') stats.exercisesSkipped += 1
    stats.setsTotal += item.targetSets
    for (const set of item.sets) {
      // Only sets actually ticked count. Reps that were typed in advance, or
      // left sitting in a skipped exercise, are not training.
      if (set.status !== 'done') continue
      stats.setsDone += 1
      stats.reps += set.reps ?? 0
      stats.holdSec += set.holdSec ?? 0
      if (set.weight) stats.volume += (set.reps ?? 0) * set.weight
    }
  }

  stats.completion = stats.setsTotal ? Math.round((stats.setsDone / stats.setsTotal) * 100) : 0

  return stats
}

/** Sessions that count as real training. Planned and untouched sessions do not. */
export function isTraining(session: WorkoutSession): boolean {
  return session.status === 'completed' || session.status === 'partial'
}

/** The session status implied by its contents, used when finishing a workout. */
export function deriveSessionStatus(session: WorkoutSession): SessionStatus {
  const stats = sessionStats(session)
  if (!session.items.length) return 'skipped'
  if (stats.setsTotal === 0) return 'skipped'
  if (stats.setsDone === 0) return 'skipped'
  if (stats.setsDone >= stats.setsTotal) return 'completed'
  return 'partial'
}
