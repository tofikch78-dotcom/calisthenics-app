import { LIBRARY } from '../data'
import type { Difficulty, Movement, Profile } from '../types'
import { levelForCapacity, levelRank, movementCapacity } from './level-math'

/**
 * Automatic level assessment.
 *
 * The app never guesses in the dark: every estimate traces back to an answer
 * the user gave in onboarding (their level, plus the push-up / dip / squat /
 * pull-up maximums) or to work they have actually logged. Anything the user
 * overrides by hand wins.
 *
 * The arithmetic lives in `level-math`, which knows nothing about the catalogue.
 * Only this step needs the library, because it has to walk every exercise to
 * give each one a level.
 */

export {
  band,
  benchmarksFor,
  levelForCapacity,
  levelRank,
  mergeLevels,
  movementCapacity,
  type Benchmarks,
} from './level-math'

export interface LevelAssessment {
  levels: Record<string, Difficulty>
  sources: Record<string, string>
}

/**
 * Every exercise gets a suggested level. The exercise's own difficulty is
 * lowered by one rung when it sits above the user's measured capacity, and
 * kept when it does not.
 */
export function assessLevels(profile: Profile | null): LevelAssessment {
  const levels: Record<string, Difficulty> = {}
  const sources: Record<string, string> = {}
  // One capacity per movement rather than per exercise: every push exercise is
  // measured against the same push-up maximum.
  const capacityByMovement = new Map<Movement, { capacity: number; source: string }>()

  for (const exercise of LIBRARY) {
    if (!capacityByMovement.has(exercise.movement)) {
      capacityByMovement.set(exercise.movement, movementCapacity(exercise.movement, profile))
    }
    const { capacity, source } = capacityByMovement.get(exercise.movement)!
    const required = levelRank(exercise.difficulty)
    levels[exercise.id] = levelForCapacity(Math.min(required, capacity))
    sources[exercise.id] = source
  }

  return { levels, sources }
}