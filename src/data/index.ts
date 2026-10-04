import type { Difficulty, Equipment, Exercise, Movement, Muscle } from '../types'
import { CORE_EXERCISES } from './core'
import { LEG_EXERCISES } from './legs'
import { PULL_EXERCISES } from './pull'
import { PUSH_EXERCISES } from './push'
import { SKILL_EXERCISES } from './skills'
import { difficultyLabel, equipmentLabel, movementLabel, muscleLabel } from '../lib/labels'

export * from './taxonomy'

export const EXERCISES: Exercise[] = [
  ...PUSH_EXERCISES,
  ...PULL_EXERCISES,
  ...LEG_EXERCISES,
  ...CORE_EXERCISES,
  ...SKILL_EXERCISES,
].sort((a, b) => a.name.localeCompare(b.name))

export const EXERCISE_BY_ID: ReadonlyMap<string, Exercise> = new Map(
  EXERCISES.map((exercise) => [exercise.id, exercise]),
)

/** Lookup that never returns undefined, so the UI can render safely. */
export function getExercise(id: string): Exercise | undefined {
  return EXERCISE_BY_ID.get(id)
}

/**
 * Development-time integrity check. Broken progression links are stripped
 * rather than thrown, so a typo can never break the running app.
 */
function sanitise(): Exercise[] {
  const known = new Set(EXERCISES.map((exercise) => exercise.id))
  const resolve = (ids: string[]) => ids.filter((id) => known.has(id))

  if (import.meta.env.DEV) {
    const report = (label: string, ids: string[]) => {
      const broken = ids.filter((id) => !known.has(id))
      if (broken.length) console.warn(`[library] ${label} references unknown ids:`, broken)
    }
    for (const exercise of EXERCISES) {
      report(`${exercise.id}.easier`, exercise.easier)
      report(`${exercise.id}.harder`, exercise.harder)
    }
  }

  return EXERCISES.map((exercise) => ({
    ...exercise,
    equipment: exercise.equipment.length ? exercise.equipment : (['none'] as Equipment[]),
    easier: resolve(exercise.easier),
    harder: resolve(exercise.harder),
  }))
}

export const LIBRARY: Exercise[] = sanitise()

/** Every value that actually appears in the library, for dynamic facets. */
export function facetValues<T extends string>(pick: (e: Exercise) => T[]): T[] {
  const set = new Set<T>()
  for (const exercise of LIBRARY) for (const value of pick(exercise)) set.add(value)
  return [...set]
}

export const LIBRARY_FACETS = {
  muscles: facetValues<Muscle>((e) => [e.mainMuscle, ...e.secondaryMuscles]),
  movements: facetValues<Movement>((e) => [e.movement]),
  equipment: facetValues<Equipment>((e) => e.equipment),
  difficulties: facetValues<Difficulty>((e) => [e.difficulty]),
}

export const LIBRARY_STATS = {
  total: LIBRARY.length,
  byDifficulty: LIBRARY_FACETS.difficulties.length,
  byMovement: LIBRARY_FACETS.movements.length,
  byMuscle: LIBRARY_FACETS.muscles.length,
  byEquipment: LIBRARY_FACETS.equipment.length,
}

/**
 * Human-facing wording that should be findable even though it never appears in
 * the raw record — the taxonomy labels ("Core / Abs", "Static holds"), the
 * equipment names ("Pull-up bar") and the difficulty words.
 */
function searchVocabulary(exercise: Exercise): string[] {
  return [
    muscleLabel(exercise.mainMuscle),
    ...exercise.secondaryMuscles.map(muscleLabel),
    movementLabel(exercise.movement),
    ...exercise.equipment.map(equipmentLabel),
    difficultyLabel(exercise.difficulty),
  ]
}

/** Splits on anything that is not a letter or digit, so "pull-up-bar" → 3 words. */
function toWords(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

const EMPTY_TOKENS: ReadonlySet<string> = new Set()

/**
 * Search bag of words per exercise, built once at module load.
 *
 * A bag of words rather than one long string, so matching can respect word
 * boundaries — otherwise "rings" matches "hamstrings" and "chest" matches
 * "chestnut". Callers use `searchTokensFor` plus prefix matching.
 */
const SEARCH_INDEX = new Map<string, ReadonlySet<string>>(
  LIBRARY.map((exercise) => [
    exercise.id,
    new Set([
      ...toWords(exercise.name),
      ...toWords(exercise.description),
      ...exercise.steps.flatMap(toWords),
      ...toWords(exercise.difficulty),
      ...toWords(exercise.movement),
      ...toWords(exercise.mainMuscle),
      ...exercise.secondaryMuscles.flatMap(toWords),
      ...exercise.equipment.flatMap(toWords),
      ...(exercise.keywords ?? []).flatMap(toWords),
      ...searchVocabulary(exercise).flatMap(toWords),
    ]),
  ]),
)

/** The searchable word bag for one exercise. */
export function searchTokensFor(id: string): ReadonlySet<string> {
  return SEARCH_INDEX.get(id) ?? EMPTY_TOKENS
}
