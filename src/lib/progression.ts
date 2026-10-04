import { levelRank } from './level-math.ts'
import type { Exercise, SessionItem, WorkoutSession } from '../types'

/**
 * Progression engine.
 *
 * Reads the set-by-set record of an exercise and answers one question: should
 * the user go harder, stay where they are, or back off? Suggestions are never
 * applied automatically — the user always decides.
 *
 * The exercises and the catalogue lookup are passed in rather than imported, so
 * this module needs nothing but the sessions it reads. That keeps the rules
 * checkable directly in `verify-progress.mjs`, and it lets the Progress
 * dashboard take the evidence and the suggestions out of one pass instead of
 * re-sorting the whole session list once per exercise.
 */

export type ProgressionVerdict = 'progress' | 'maintain' | 'regress' | 'insufficient-data'

/** Resolves an exercise id to its library entry, or undefined when it is gone. */
export type ExerciseLookup = (id: string) => Exercise | undefined

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

/** Sessions sampled per exercise. Enough to see a trend, few enough to stay recent. */
export const EVIDENCE_SESSIONS = 4

/** Clean sessions in a row before the app suggests going harder. */
export const CLEAN_TO_ADVANCE = 2

/**
 * The sets an exercise was meant to complete.
 *
 * `targetSets` is the honest denominator — the same one `sessionStats` credits
 * against — floored so a half-written line from an imported backup can never
 * divide by zero, and lifted to whatever the session actually holds so adding a
 * set beyond the prescription never reads as beating the target.
 */
function expectedSets(item: SessionItem): number {
  return Math.max(1, item.targetSets, item.sets.length)
}

/**
 * Evidence for every exercise worth reading, in one pass over the sessions.
 *
 * Only sessions where *this* exercise got at least one set ticked count. A
 * session that carried the exercise but never touched a set — left planned, or
 * dropped in favour of something else — says nothing about how the exercise is
 * going, and counting it as a zero used to pull a perfectly consistent exercise
 * towards "ease off".
 */
export function evidenceForMany(
  sessions: WorkoutSession[],
  exercises: readonly Exercise[],
  limit = EVIDENCE_SESSIONS,
): Map<string, ExerciseEvidence> {
  const wanted = new Set(exercises.map((exercise) => exercise.id))
  /** exerciseId → that exercise's item in each sampled session, newest first. */
  const items = new Map<string, SessionItem[]>()
  /** exerciseId → the session each sampled item came from, same order. */
  const owners = new Map<string, WorkoutSession[]>()

  // Sorted once here rather than once per exercise.
  const ordered = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt)

  for (const session of ordered) {
    for (const item of session.items) {
      if (!wanted.has(item.exerciseId)) continue
      if (!item.sets.some((set) => set.status === 'done')) continue
      const seen = items.get(item.exerciseId)
      if (!seen) {
        items.set(item.exerciseId, [item])
        owners.set(item.exerciseId, [session])
      } else if (seen.length < limit) {
        seen.push(item)
        owners.get(item.exerciseId)!.push(session)
      }
    }
  }

  const evidence = new Map<string, ExerciseEvidence>()
  for (const exercise of exercises) {
    const sampled = items.get(exercise.id)
    if (!sampled?.length) continue

    const hitRates: number[] = []
    let cleanStreak = 0
    let streakBroken = false
    const bestSet = { reps: 0, holdSec: 0, weight: 0 }
    let target = {
      sets: 0,
      reps: undefined as number | undefined,
      holdSec: undefined as number | undefined,
      weight: undefined as number | undefined,
    }

    for (const [index, item] of sampled.entries()) {
      // The newest session's prescription is the one being held to now. Taking
      // it from the oldest instead made "add reps before adding difficulty"
      // compare a current best against a target the user has long since passed.
      if (index === 0) {
        target = {
          sets: item.targetSets,
          reps: item.targetReps,
          holdSec: item.targetHoldSec,
          weight: item.targetWeight,
        }
      }

      const done = item.sets.filter((set) => set.status === 'done')
      const expected = expectedSets(item)
      hitRates.push(Math.min(1, done.length / expected))
      for (const set of done) {
        bestSet.reps = Math.max(bestSet.reps, set.reps ?? 0)
        bestSet.holdSec = Math.max(bestSet.holdSec, set.holdSec ?? 0)
        bestSet.weight = Math.max(bestSet.weight, set.weight ?? 0)
      }

      const clean = item.sets.length > 0 && done.length >= expected
      if (clean && !streakBroken) cleanStreak += 1
      else if (!clean) streakBroken = true
    }

    evidence.set(exercise.id, {
      exerciseId: exercise.id,
      name: exercise.name,
      sessions: owners.get(exercise.id) ?? [],
      hitRate: hitRates.reduce((sum, value) => sum + value, 0) / hitRates.length,
      cleanStreak,
      bestSet,
      target,
    })
  }

  return evidence
}

/**
 * The suggestion for one exercise, from evidence already read. Returns
 * `insufficient-data` until it has actually been trained, so the app never nags
 * about work that has not happened.
 */
export function suggestFor(
  exercise: Exercise,
  evidence: ExerciseEvidence | undefined,
  lookup: ExerciseLookup,
): ProgressionSuggestion {
  if (!evidence) {
    return {
      key: exercise.id,
      verdict: 'insufficient-data',
      headline: 'Not enough data yet',
      detail: `${exercise.name} has no logged sets. Train it once or twice and the app will start suggesting a next step.`,
    }
  }

  // The natural next rung: the lowest-ranked harder progression the library
  // actually links to. Stepping back goes to the closest rung below, which is
  // the last one that still worked.
  const current = levelRank(exercise.difficulty)
  const rungs = (ids: string[]) =>
    ids
      .map((id) => lookup(id))
      .filter((rung): rung is Exercise => Boolean(rung))
      .map((rung) => ({ rung, level: levelRank(rung.difficulty) }))
      .sort((a, b) => a.level - b.level)
  const next = rungs(exercise.harder).find((candidate) => candidate.level > current)
  const stepBack = rungs(exercise.easier).at(-1)

  // Backed off: hit rate under half.
  if (evidence.hitRate < 0.5) {
    return {
      key: exercise.id,
      verdict: 'regress',
      headline: 'Ease off before adding load',
      detail: `You completed ${Math.round(evidence.hitRate * 100)}% of your target sets over the last ${evidence.sessions.length} sessions. Hold the current weight or step back rather than forcing a harder variation.`,
      fallbackExercise: stepBack?.rung,
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
        key: exercise.id,
        verdict: 'progress',
        headline: 'Add reps before adding difficulty',
        detail: `You hit ${evidence.cleanStreak} clean sessions and your best set was ${evidence.bestSet.reps} reps against a target of ${evidence.target.reps}. Push the target up first.`,
      }
    }

    if (load > 0) {
      return {
        key: exercise.id,
        verdict: 'progress',
        headline: 'Add load',
        detail: `${evidence.cleanStreak} clean sessions at ${load} kg. Add weight to ${exercise.name} and keep the reps.`,
      }
    }

    if (next) {
      return {
        key: exercise.id,
        verdict: 'progress',
        headline: `Move up to ${next.rung.name}`,
        detail: `You hit every set for ${evidence.cleanStreak} sessions running. ${exercise.name} → ${next.rung.name} is the next rung.`,
        nextExercise: next.rung,
      }
    }
  }

  return {
    key: exercise.id,
    verdict: 'maintain',
    headline: 'Stay at this level for now',
    detail: `You completed ${Math.round(evidence.hitRate * 100)}% of your target sets. Hold this variation until the hit rate is consistently high.`,
  }
}

export interface ProgressionReport {
  evidence: Map<string, ExerciseEvidence>
  suggestions: ProgressionSuggestion[]
}

/**
 * Everything the Progress screens read about progression, from one pass over
 * the sessions. Suggestions come back most urgent first, and an exercise with
 * no logged work is left out rather than nagged about.
 */
export function progressionReport(
  sessions: WorkoutSession[],
  exercises: readonly Exercise[],
  lookup: ExerciseLookup,
  limit = EVIDENCE_SESSIONS,
): ProgressionReport {
  const evidence = evidenceForMany(sessions, exercises, limit)
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const suggestions = [...evidence.keys()]
    .map((id) => suggestFor(byId.get(id)!, evidence.get(id), lookup))
    .sort((a, b) => {
      const order = { progress: 0, regress: 1, maintain: 2, 'insufficient-data': 3 }
      return order[a.verdict] - order[b.verdict]
    })
  return { evidence, suggestions }
}