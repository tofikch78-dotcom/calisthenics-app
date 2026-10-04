import type { Difficulty, Movement, Profile, TrainingLevel } from '../types'

/**
 * How hard each difficulty is, and how much capacity each movement has.
 *
 * This is the level arithmetic with no dependency on the exercise catalogue, so
 * `assessLevels` can walk the library while the arithmetic itself stays directly
 * checkable in `verify-progress.mjs`. Ranking lives here rather than inside
 * `level.ts` because the progression engine needs it too, and one table has to
 * be the only answer to "is this harder than that".
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
export interface Benchmarks {
  push: number | null
  pull: number | null
  legs: number | null
  core: number | null
  static: number | null
  skills: number | null
}

export const PUSH_BANDS: [number, number][] = [
  [0, 0.15],
  [10, 0.45],
  [25, 0.7],
  [40, 0.95],
]

export const DIP_BANDS: [number, number][] = [
  [0, 0.1],
  [5, 0.5],
  [12, 0.8],
  [20, 1],
]

export const SQUAT_BANDS: [number, number][] = [
  [0, 0.15],
  [30, 0.45],
  [60, 0.75],
  [100, 1],
]

export const PULL_BANDS: [number, number][] = [
  [0, 0.05],
  [1, 0.4],
  [5, 0.7],
  [12, 1],
]

export function band(value: number | undefined, bands: [number, number][]): number | null {
  if (value === undefined || Number.isNaN(value)) return null
  for (const [threshold, score] of bands) if (value <= threshold) return score
  return 1
}

/**
 * A maximum the user actually gave us.
 *
 * A zero counts as "not measured" rather than as a score. A cleared field and
 * "I cannot do a single one" both arrive as 0, and pull-ups were already read
 * that way — so benchmarking 0 pinned the movement to the bottom band while the
 * pull-up path did not. Worse, because `band` only returns null for a number
 * that is absent, a benchmarked 0 shadowed the dips result and the fallback
 * between the two could never fire: a user who reported "0 push-ups, 15 dips"
 * was assessed as if they could barely push.
 */
function measured(value: number | undefined, bands: [number, number][]): number | null {
  if (value === undefined || Number.isNaN(value) || value <= 0) return null
  return band(value, bands)
}

/** The strongest signal among several ways of measuring the same thing. */
function strongest(...scores: (number | null)[]): number | null {
  const known = scores.filter((score): score is number => score !== null)
  return known.length ? Math.max(...known) : null
}

export function benchmarksFor(profile: Profile | null): Benchmarks {
  if (!profile) {
    return { push: null, pull: null, legs: null, core: null, static: null, skills: null }
  }

  const pull =
    measured(profile.maxPullups, PULL_BANDS) ??
    (profile.pullUpAbility === 'multiple'
      ? 0.7
      : profile.pullUpAbility === 'single'
        ? 0.4
        : profile.pullUpAbility === 'assisted'
          ? 0.25
          : 0.05)

  return {
    // Dips and push-ups measure the same movement from two ends; either one can
    // be the better of the two, so neither shadows the other.
    push: strongest(measured(profile.maxPushups, PUSH_BANDS), measured(profile.maxDips, DIP_BANDS)),
    pull,
    legs: measured(profile.maxSquats, SQUAT_BANDS),
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

/** The difficulty at a capacity score, clamped into the three real levels. */
export function levelForCapacity(capacity: number): Difficulty {
  return RANK_LEVEL[Math.min(3, Math.max(1, Math.round(capacity)))]
}