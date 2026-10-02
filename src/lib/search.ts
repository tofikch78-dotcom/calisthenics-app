import { LIBRARY, getExercise, searchTokensFor } from '../data'
import {
  EQUIPMENT_ORDER as TAXONOMY_EQUIPMENT_ORDER,
  MUSCLE_ORDER as TAXONOMY_MUSCLE_ORDER,
} from '../data/taxonomy'
import type { Difficulty, Equipment, Exercise, Movement, Muscle } from '../types'

export interface LibraryFilters {
  query: string
  muscles: Muscle[]
  movements: Movement[]
  difficulties: Difficulty[]
  equipment: Equipment[]
  onlySaved: boolean
}

export const EMPTY_FILTERS: LibraryFilters = {
  query: '',
  muscles: [],
  movements: [],
  difficulties: [],
  equipment: [],
  onlySaved: false,
}

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
}

function intersects<T>(haystack: T[], needles: T[]): boolean {
  if (!needles.length) return true
  return needles.some((needle) => haystack.includes(needle))
}

/**
 * A query token matches when it is a whole word in the exercise's search bag,
 * or the prefix of one — so "push" finds "Push-ups" and "pushups", but
 * "rings" no longer matches "hamstrings".
 */
function tokenMatches(bag: ReadonlySet<string>, token: string): boolean {
  if (bag.has(token)) return true
  for (const word of bag) {
    if (word.startsWith(token)) return true
  }
  return false
}

/** AND across token groups, OR inside a group. */
function bagMatches(bag: ReadonlySet<string>, groups: string[][]): boolean {
  return groups.every((group) => group.some((token) => tokenMatches(bag, token)))
}

function matchesTokens(exerciseId: string, groups: string[][]): boolean {
  if (!groups.length) return true
  return bagMatches(searchTokensFor(exerciseId), groups)
}

/**
 * Colloquial phrasings mapped onto the words the library actually uses. Each
 * phrase expands to alternatives, and the phrase itself is consumed so its
 * words ("no", "equipment") do not become separate required tokens.
 */
const PHRASE_ALIASES: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [/\bno (?:equipment|gear|kit|weights?|machines?)\b/g, ['none', 'floor']],
  [/\bbody ?weight\b/g, ['none', 'floor']],
  [/\bbodyweight\b/g, ['none', 'floor']],
  [/\bupper body\b/g, ['push', 'pull']],
  [/\blower body\b/g, ['legs']],
  [/\bcardio\b/g, ['jump-rope', 'broad-jumps', 'endurance']],
  [/\bwarm ?up\b/g, ['mobility']],
]

/** Single words people type that differ from the library's own vocabulary. */
const WORD_ALIASES: Readonly<Record<string, readonly string[]>> = {
  abs: ['core'],
  ab: ['core'],
  lats: ['back'],
  lat: ['back'],
  grip: ['forearms'],
  delts: ['shoulders'],
  shoulder: ['shoulders'],
  hamstring: ['hamstrings'],
  glute: ['glutes'],
  quad: ['quads'],
  calf: ['calves'],
  bicep: ['biceps'],
  tricep: ['triceps'],
}

/**
 * Splits a query into token groups, expanding any recognised phrase or synonym
 * into the alternatives it stands for. Every group must match, so "chest
 * beginner" narrows rather than widens.
 */
export function tokenize(query: string): string[][] {
  let rest = query.toLowerCase()
  const groups: string[][] = []

  for (const [pattern, alternatives] of PHRASE_ALIASES) {
    pattern.lastIndex = 0
    if (!pattern.test(rest)) continue
    groups.push([...alternatives])
    rest = rest.replace(pattern, ' ')
  }

  for (const word of rest.split(/[^a-z0-9]+/).filter(Boolean)) {
    groups.push([...(WORD_ALIASES[word] ?? []), word])
  }

  return groups
}

export function matchesFilters(
  exercise: Exercise,
  filters: LibraryFilters,
  savedIds: ReadonlySet<string>,
): boolean {
  const groups = tokenize(filters.query)

  if (!matchesTokens(exercise.id, groups)) return false
  if (filters.onlySaved && !savedIds.has(exercise.id)) return false
  if (!intersects([exercise.mainMuscle, ...exercise.secondaryMuscles], filters.muscles)) {
    return false
  }
  if (!intersects([exercise.movement], filters.movements)) return false
  if (!intersects([exercise.difficulty], filters.difficulties)) return false
  if (!intersects(exercise.equipment, filters.equipment)) return false

  return true
}

export type SortKey = 'name' | 'difficulty' | 'muscle' | 'equipment'

export interface LibraryQuery extends LibraryFilters {
  sort: SortKey
}

const MUSCLE_ORDER = TAXONOMY_MUSCLE_ORDER
const EQUIPMENT_ORDER = TAXONOMY_EQUIPMENT_ORDER

const collator = new Intl.Collator('en', { sensitivity: 'base' })

function sortExercises(exercises: Exercise[], sort: SortKey): Exercise[] {
  const sorted = [...exercises]
  switch (sort) {
    case 'difficulty':
      sorted.sort(
        (a, b) =>
          DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
          a.mainMuscle.localeCompare(b.mainMuscle) ||
          collator.compare(a.name, b.name),
      )
      break
    case 'muscle':
      sorted.sort(
        (a, b) =>
          MUSCLE_ORDER.indexOf(a.mainMuscle) - MUSCLE_ORDER.indexOf(b.mainMuscle) ||
          collator.compare(a.name, b.name),
      )
      break
    case 'equipment':
      sorted.sort(
        (a, b) =>
          EQUIPMENT_ORDER.indexOf(a.equipment[0] ?? 'none') -
            EQUIPMENT_ORDER.indexOf(b.equipment[0] ?? 'none') ||
          collator.compare(a.name, b.name),
      )
      break
    case 'name':
    default:
      sorted.sort((a, b) => collator.compare(a.name, b.name))
  }
  return sorted
}

export function queryLibrary(
  query: LibraryQuery,
  savedIds: ReadonlySet<string>,
): Exercise[] {
  const matches = LIBRARY.filter((exercise) => matchesFilters(exercise, query, savedIds))
  return sortExercises(matches, query.sort)
}

/** True when the exercise trains this muscle, whether as the mover or a helper. */
export function targetsMuscle(exercise: Exercise, muscle: Muscle): boolean {
  return exercise.mainMuscle === muscle || exercise.secondaryMuscles.includes(muscle)
}

/**
 * Every exercise that trains a muscle, primary movers first.
 *
 * "Trains" covers both the primary muscle and the secondaries, because picking
 * Biceps should surface Pull-ups and not just Curl-ups — a workout is built
 * around a pattern, and secondaries are where compound movements land. Sorting
 * primaries to the top keeps the most direct answers for the muscle one tap
 * above the fold, and `primaryOnly` narrows to just those when a user wants
 * them and nothing else.
 */
export function exercisesForMuscle(muscle: Muscle, primaryOnly = false): Exercise[] {
  return LIBRARY.filter((exercise) =>
    primaryOnly ? exercise.mainMuscle === muscle : targetsMuscle(exercise, muscle),
  ).sort(
    (a, b) =>
      Number(b.mainMuscle === muscle) - Number(a.mainMuscle === muscle) ||
      collator.compare(a.name, b.name),
  )
}

/** How many exercises each muscle chip should advertise, built once. */
export const MUSCLE_EXERCISE_COUNTS: Record<Muscle, { all: number; primary: number }> =
  Object.fromEntries(
    TAXONOMY_MUSCLE_ORDER.map((muscle) => [
      muscle,
      {
        all: LIBRARY.filter((exercise) => targetsMuscle(exercise, muscle)).length,
        primary: LIBRARY.filter((exercise) => exercise.mainMuscle === muscle).length,
      },
    ]),
  ) as Record<Muscle, { all: number; primary: number }>

export function countActiveFilters(filters: LibraryFilters): number {
  return (
    (filters.query.trim() ? 1 : 0) +
    filters.muscles.length +
    filters.movements.length +
    filters.difficulties.length +
    filters.equipment.length +
    (filters.onlySaved ? 1 : 0)
  )
}

export interface Alternatives {
  /** Easiest → the exercise itself → hardest. The progression ladder. */
  ladder: Exercise[]
  /** Same difficulty and movement, but doable with different equipment. */
  equipmentSwaps: Exercise[]
  /** Same movement, any difficulty, excluding things already in the ladder. */
  similar: Exercise[]
}

function sharesEquipment(a: Exercise, b: Exercise): boolean {
  return a.equipment.some((item) => b.equipment.includes(item))
}

/**
 * Builds the "Find Alternatives" ladder.
 *
 * e.g. Pull-ups → Chin-ups → Australian Rows → Backpack Rows
 */
export function findAlternatives(exercise: Exercise): Alternatives {
  const easier = exercise.easier
    .map(getExercise)
    .filter((item): item is Exercise => Boolean(item))
    .sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty])

  const harder = exercise.harder
    .map(getExercise)
    .filter((item): item is Exercise => Boolean(item))
    .sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty])

  const ladder = [...easier, exercise, ...harder]
  const ladderIds = new Set(ladder.map((item) => item.id))

  const related = LIBRARY.filter(
    (item) => item.id !== exercise.id && !ladderIds.has(item.id) && item.movement === exercise.movement,
  )

  const byDifficulty = (a: Exercise, b: Exercise) =>
    DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] || collator.compare(a.name, b.name)

  // Movement alone is far too loose — "weighted dips" is a pressing pattern, not
  // a shoulder raise. An alternative has to train the same primary muscle first;
  // the looser movement-only list is kept as a fallback so the panel is never
  // empty for a movement that only has a handful of exercises.
  const sameTarget = related.filter((item) => item.mainMuscle === exercise.mainMuscle)

  const equipmentSwaps = (sameTarget.length ? sameTarget : related)
    .filter((item) => !sharesEquipment(item, exercise))
    .sort(byDifficulty)

  const similar = (sameTarget.length ? sameTarget : related)
    .filter((item) => sharesEquipment(item, exercise))
    .sort(byDifficulty)

  return { ladder, equipmentSwaps, similar }
}

/** Human-readable dosage string, e.g. "4 × 8" or "3 × 30s". */
export function formatDosage(dosage: Exercise['dosage']): string {
  if (dosage.reps && dosage.holdSec) {
    return `${dosage.sets} × ${dosage.reps} reps / ${dosage.holdSec}s hold`
  }
  if (dosage.holdSec) return `${dosage.sets} × ${dosage.holdSec}s hold`
  if (dosage.reps) return `${dosage.sets} × ${dosage.reps}`
  return `${dosage.sets} sets`
}

export function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`
}
