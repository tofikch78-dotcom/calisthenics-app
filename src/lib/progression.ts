import { getExercise } from '../data'
import { levelRank } from './level'
import type { Exercise, WorkoutSession } from '../types'

/**
 * Progression engine.
 *
 * Reads the set-by-set record of an exercise and answers one question: should
 * the user go harder, stay where they are, or back off? Suggestions are never
 * applied automatically — the user always decides.
 */

export type ProgressionVerdict = 'progress' | 'maintain' | 'regress' | 'insufficient-data'

export interface ExerciseEvidence {
  exerciseId: string
  name: string
  /** Sessions in which the exercise was actually trained, newest first. */
  sessions: WorkoutSession[]
  /** Mean share of target sets hit, 0–1, over the sampled sessions. */
  hitRate: number
  /** Consecutive sessions at 100% from the most recent one backwards. */
  cleanStreak: number
  bestSet: { reps: number; holdSec: number; weight: number }
  target: { sets: number; reps?: number; holdSec?: number; weight?: number }
}

export interface ProgressionSuggestion {
  key: string
  verdict: ProgressionVerdict
  headline: string
  detail: string
  /** The exercise to move to, when the verdict is "progress". */
  nextExercise?: Exercise
  /** The easier fallback, when the verdict is "regress". */
  fallbackExercise?: Exercise
}

/** The most recent sessions that contain real logged work for an exercise. */
export function evidenceFor(
  exerciseId: string,
  sessions: WorkoutSession[],
  limit = 4,
): ExerciseEvidence | undefined {
  const hits = sessions
    .filter((session) => session.items.some((item) => item.exerciseId === exerciseId))
    .filter((session) => session.items.some((item) => item.sets.some((set) => set.status === 'done')))
    .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt)
    .slice(0, limit)

  if (!hits.length) return undefined

  const exercise = getExercise(exerciseId)
  const hitRates: number[] = []
  let cleanStreak = 0
  let streakBroken = false
  const bestSet = { reps: 0, holdSec: 0, weight: 0 }
  let target = { sets: 0, reps: undefined as number | undefined, holdSec: undefined as number | undefined, weight: undefined as number | undefined }

  for (const session of hits) {
    const item = session.items.find((entry) => entry.exerciseId === exerciseId)!
    target = { sets: item.targetSets, reps: item.targetReps, holdSec: item.targetHoldSec, weight: item.targetWeight }

    const done = item.sets.filter((set) => set.status === 'done')
    const total = Math.max(1, item.sets.length)
    hitRates.push(done.length / total)
    for (const set of done) {
      bestSet.reps = Math.max(bestSet.reps, set.reps ?? 0)
      bestSet.holdSec = Math.max(bestSet.holdSec, set.holdSec ?? 0)
      bestSet.weight = Math.max(bestSet.weight, set.weight ?? 0)
    }

    const clean = done.length === item.sets.length && item.sets.length > 0
    if (clean && !streakBroken) cleanStreak += 1
    else if (!clean) streakBroken = true
  }

  return {
    exerciseId,
    name: exercise?.name ?? exerciseId,
    sessions: hits,
    hitRate: hitRates.reduce((sum, value) => sum + value, 0) / hitRates.length,
    cleanStreak,
    bestSet,
    target,
  }
}

const CLEAN_TO_ADVANCE = 2

/**
 * The suggestion for one exercise. Returns `insufficient-data` until the user
 * has actually trained it, so the app never nags about work that has not
 * happened.
 */
export function suggestFor(
  exerciseId: string,
  sessions: WorkoutSession[],
): ProgressionSuggestion {
  const exercise = getExercise(exerciseId)
  const evidence = evidenceFor(exerciseId, sessions)

  if (!exercise) {
    return {
      key: exerciseId,
      verdict: 'insufficient-data',
      headline: 'Unknown exercise',
      detail: 'This exercise is no longer in the library.',
    }
  }

  if (!evidence) {
    return {
      key: exerciseId,
      verdict: 'insufficient-data',
      headline: 'Not enough data yet',
      detail: `${exercise.name} has no logged sets. Train it once or twice and the app will start suggesting a next step.`,
    }
  }

  // The natural next rung: a harder progression the library actually links to.
  const current = levelRank(exercise.difficulty)
  const next = exercise.harder
    .map(getExercise)
    .filter((candidate): candidate is Exercise => Boolean(candidate))
    .sort((a, b) => levelRank(a.difficulty) - levelRank(b.difficulty))
    .find((candidate) => levelRank(candidate.difficulty) > current)
  const easier = exercise.easier
    .map(getExercise)
    .filter((candidate): candidate is Exercise => Boolean(candidate))
    .sort((a, b) => levelRank(b.difficulty) - levelRank(a.difficulty))[0]

  // Backed off: hit rate under half, or a clean streak that has collapsed.
  if (evidence.hitRate < 0.5) {
    return {
      key: exerciseId,
      verdict: 'regress',
      headline: 'Ease off before adding load',
      detail: `You completed ${Math.round(evidence.hitRate * 100)}% of your target sets over the last ${evidence.sessions.length} sessions. Hold the current weight or step back rather than forcing a harder variation.`,
      fallbackExercise: easier,
    }
  }

  // Clean twice in a row: time to progress.
  if (evidence.cleanStreak >= CLEAN_TO_ADVANCE) {
    const load = evidence.bestSet.weight
    const repRoom =
      evidence.target.reps !== undefined &&
      evidence.bestSet.reps > 0 &&
      evidence.bestSet.reps < evidence.target.reps

    if (repRoom) {
      return {
        key: exerciseId,
        verdict: 'progress',
        headline: 'Add reps before adding difficulty',
        detail: `You hit ${evidence.cleanStreak} clean sessions and your best set was ${evidence.bestSet.reps} reps against a target of ${evidence.target.reps}. Push the target up first.`,
      }
    }

    if (load > 0) {
      return {
        key: exerciseId,
        verdict: 'progress',
        headline: 'Add load',
        detail: `${evidence.cleanStreak} clean sessions at ${load} kg. Add weight to ${exercise.name} and keep the reps.`,
      }
    }

    if (next) {
      return {
        key: exerciseId,
        verdict: 'progress',
        headline: `Move up to ${next.name}`,
        detail: `You hit every set for ${evidence.cleanStreak} sessions running. ${exercise.name} → ${next.name} is the next rung.`,
        nextExercise: next,
      }
    }
  }

  return {
    key: exerciseId,
    verdict: 'maintain',
    headline: 'Stay at this level for now',
    detail: `You completed ${Math.round(evidence.hitRate * 100)}% of your target sets. Hold this variation until the hit rate is consistently high.`,
  }
}

/** Every exercise worth commenting on, newest evidence first. */
export function allSuggestions(
  sessions: WorkoutSession[],
  exerciseIds: string[],
): ProgressionSuggestion[] {
  return exerciseIds
    .map((id) => suggestFor(id, sessions))
    .filter((suggestion) => suggestion.verdict !== 'insufficient-data')
    .sort((a, b) => {
      const order = { progress: 0, regress: 1, maintain: 2, 'insufficient-data': 3 }
      return order[a.verdict] - order[b.verdict]
    })
}
