import { LIBRARY } from '../data'
import type { Difficulty, Movement, Profile, TrainingLevel } from '../types'

/**
 * Automatic level assessment.
 *
 * The app never guesses in the dark: every estimate traces back to an answer
 * the user gave in onboarding (their level, plus the push-up / dip / squat /
 * pull-up maximums) or to work they have actually logged. Anything the user
 * overrides by hand wins.
 */

const LEVEL_RANK: Record<Difficulty, number> = { beginner: 1, intermediate: 2, advanced: 3 }
const RANK_LEVEL: Record<number, Difficulty> = { 1: 'beginner', 2: 'intermediate', 3: 'advanced' }

const BASE_CAPACITY: Record<TrainingLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
}

/**
 * 0–1 benchmarks per movement, derived from the user's stated maximums.
 * `null` means "we have no data for this movement", so the declared level
 * carries it instead of a fabricated number.
 */
interface Benchmarks {
  push: number | null
  pull: number | null
  legs: number | null
  core: number | null
  static: number | null
  skills: number | null
}

const PUSH_BANDS: [number, number][] = [
  [0, 0.15],
  [10, 0.45],
  [25, 0.7],
  [40, 0.95],
]

const DIP_BANDS: [number, number][] = [
  [0, 0.1],
  [5, 0.5],
  [12, 0.8],
  [20, 1],
]

const SQUAT_BANDS: [number, number][] = [
  [0, 0.15],
  [30, 0.45],
  [60, 0.75],
  [100, 1],
]

const PULL_BANDS: [number, number][] = [
  [0, 0.05],
  [1, 0.4],
  [5, 0.7],
  [12, 1],
]

function band(value: number | undefined, bands: [number, number][]): number | null {
  if (value === undefined || Number.isNaN(value)) return null
  for (const [threshold, score] of bands) if (value <= threshold) return score
  return 1
}

export function benchmarksFor(profile: Profile | null): Benchmarks {
  if (!profile) {
    return { push: null, pull: null, legs: null, core: null, static: null, skills: null }
  }

  const pull =
    profile.maxPullups !== undefined && profile.maxPullups > 0
      ? band(profile.maxPullups, PULL_BANDS)
      : profile.pullUpAbility === 'multiple'
        ? 0.7
        : profile.pullUpAbility === 'single'
          ? 0.4
          : profile.pullUpAbility === 'assisted'
            ? 0.25
            : 0.05

  return {
    push: band(profile.maxPushups, PUSH_BANDS) ?? band(profile.maxDips, DIP_BANDS),
    pull,
    legs: band(profile.maxSquats, SQUAT_BANDS),
    // No push-up proxy for the trunk: the declared level carries core work.
    core: null,
    static: null,
    skills: null,
  }
}

/** A per-movement capacity score, 1–3, merged from benchmarks and declared level. */
export function movementCapacity(
  movement: Movement,
  profile: Profile | null,
): { capacity: number; source: string } {
  const base = BASE_CAPACITY[profile?.level ?? 'beginner']
  const benchmarks = benchmarksFor(profile)
  const score = benchmarks[movement]

  if (score === null) {
    return { capacity: base, source: `declared as ${profile?.level ?? 'beginner'}` }
  }

  // Benchmark dominates: 40% declared level, 60% measured ability.
  const blended = score * 2.4 + base * 0.6
  const capacity = Math.min(3, Math.max(1, Math.round(blended)))
  return {
    capacity,
    source: describeBenchmark(profile, movement, score),
  }
}

function describeBenchmark(profile: Profile | null, movement: Movement, score: number): string {
  const verb = score < 0.3 ? 'no' : score < 0.6 ? 'some' : score < 0.85 ? 'solid' : 'strong'
  switch (movement) {
    case 'push':
      return profile?.maxDips
        ? `${profile.maxPushups ?? 0} push-ups / ${profile.maxDips} dips — ${verb} base`
        : `${profile?.maxPushups ?? 0} max push-ups`
    case 'pull':
      return profile?.maxPullups
        ? `${profile.maxPullups} max pull-ups`
        : `pull-ups: ${profile?.pullUpAbility ?? 'none'}`
    case 'legs':
      return `${profile?.maxSquats ?? 0} max squats`
    default:
      return `declared as ${profile?.level ?? 'beginner'}`
  }
}

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
  const capacityByMovement = new Map<Movement, { capacity: number; source: string }>()

  for (const exercise of LIBRARY) {
    if (!capacityByMovement.has(exercise.movement)) {
      capacityByMovement.set(exercise.movement, movementCapacity(exercise.movement, profile))
    }
    const { capacity, source } = capacityByMovement.get(exercise.movement)!
    const required = LEVEL_RANK[exercise.difficulty]
    levels[exercise.id] = RANK_LEVEL[Math.min(required, capacity)]
    sources[exercise.id] = source
  }

  return { levels, sources }
}

/** Manual overrides always win over the automatic estimate. */
export function mergeLevels(
  auto: Record<string, Difficulty>,
  overrides: Record<string, Difficulty>,
): Record<string, Difficulty> {
  return { ...auto, ...overrides }
}

export function levelRank(level: Difficulty): number {
  return LEVEL_RANK[level]
}
