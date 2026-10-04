import { getExercise } from '../data'
import type { WorkoutSession } from '../types'

/**
 * Personal-record candidates inside a finished session.
 *
 * Separate from `stats.ts` because resolving the exercise's display name needs
 * the catalogue, and everything else in `stats.ts` is pure arithmetic over the
 * sessions themselves. Callers decide whether each value actually beats a
 * record.
 */

export interface RecordCandidate {
  exerciseId: string
  name: string
  metric: 'reps' | 'hold' | 'weight'
  value: number
  unit: string
}

export function recordCandidates(session: WorkoutSession): RecordCandidate[] {
  const out: RecordCandidate[] = []
  for (const item of session.items) {
    const exercise = getExercise(item.exerciseId)
    // An exercise that is no longer in the library cannot be shown on the
    // Records tab, so a record for it would be invisible rather than useful.
    if (!exercise) continue
    const done = item.sets.filter((set) => set.status === 'done')

    const bestReps = done.reduce((max, set) => Math.max(max, set.reps ?? 0), 0)
    if (bestReps > 0) {
      out.push({ exerciseId: item.exerciseId, name: exercise.name, metric: 'reps', value: bestReps, unit: 'reps' })
    }

    const bestHold = done.reduce((max, set) => Math.max(max, set.holdSec ?? 0), 0)
    if (bestHold > 0) {
      out.push({ exerciseId: item.exerciseId, name: exercise.name, metric: 'hold', value: bestHold, unit: 's' })
    }

    const bestWeight = done.reduce((max, set) => Math.max(max, set.weight ?? 0), 0)
    if (bestWeight > 0) {
      out.push({ exerciseId: item.exerciseId, name: exercise.name, metric: 'weight', value: bestWeight, unit: 'kg' })
    }
  }
  return out
}