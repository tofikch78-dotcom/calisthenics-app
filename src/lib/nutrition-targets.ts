/**
 * Nutrition target maths.
 *
 * Split out of `nutrition.ts` because it is the part with a rule worth testing:
 * every number here has to trace back to something the user actually said in
 * onboarding — their weight, height, age, sex, training frequency and goal — and
 * not to a figure invented for them. It is kept free of the exercise catalogue
 * so it can be exercised directly, with nothing else in the way.
 *
 * These are general training heuristics, not medical advice, and the UI says so
 * plainly. Every number is an estimate the user can override.
 */
import type { Goal, NutritionTargets, Profile } from '../types'

/** Mifflin–St Jeor resting energy expenditure, kcal/day. */
export function restingEnergy(profile: Profile | null): number {
  if (!profile?.weightKg || !profile?.heightCm || !profile?.age) return 1650
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age
  const sexAdjustment = profile.sex === 'male' ? 5 : profile.sex === 'female' ? -161 : -78
  return Math.max(1200, base + sexAdjustment)
}

const ACTIVITY_BY_DAYS: Record<number, number> = {
  1: 1.25,
  2: 1.35,
  3: 1.45,
  4: 1.55,
  5: 1.65,
  6: 1.75,
  7: 1.8,
}

/** Daily energy adjustment per stated goal. */
const GOAL_ADJUSTMENT: Record<Goal, number> = {
  'gain-muscle': 300,
  'gain-weight': 350,
  strength: 100,
  skills: 0,
  maintain: 0,
  'lose-weight': -400,
}

const PROTEIN_PER_KG: Record<Goal, number> = {
  'gain-muscle': 2.0,
  'gain-weight': 1.8,
  strength: 1.8,
  skills: 1.7,
  maintain: 1.6,
  'lose-weight': 2.2,
}

/** Lifting goals win over cutting goals when both are ticked. */
const GOAL_PRIORITY: Goal[] = [
  'gain-muscle',
  'gain-weight',
  'strength',
  'skills',
  'maintain',
  'lose-weight',
]

export function autoTargets(profile: Profile | null): NutritionTargets {
  const days = profile?.daysPerWeek ?? 3
  const tdee = restingEnergy(profile) * (ACTIVITY_BY_DAYS[days] ?? 1.45)
  const goals = profile?.goals?.length ? profile.goals : ['maintain']
  const primary = GOAL_PRIORITY.find((goal) => goals.includes(goal)) ?? 'maintain'

  const kcal = Math.round((tdee + GOAL_ADJUSTMENT[primary]) / 10) * 10
  const weightKg = profile?.weightKg ?? 75
  const protein = Math.round(weightKg * PROTEIN_PER_KG[primary])
  const fat = Math.round((kcal * 0.28) / 9)
  const carbs = Math.max(80, Math.round((kcal - protein * 4 - fat * 9) / 4))

  return {
    kcal: Math.max(1400, kcal),
    protein,
    carbs,
    fat,
    waterMl: Math.round(weightKg * 33 + days * 150),
    auto: true,
  }
}

export function goalLabel(goal: Goal): string {
  return {
    'gain-muscle': 'Gain muscle',
    'gain-weight': 'Gain weight',
    maintain: 'Maintain',
    'lose-weight': 'Lose weight',
    strength: 'Increase strength',
    skills: 'Improve calisthenics skills',
  }[goal]
}

export const DIET_LABEL: Record<Profile['diet'], string> = {
  omnivore: 'Omnivore',
  flexitarian: 'Flexitarian',
  pescatarian: 'Pescatarian',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  other: 'Other',
}

/* ── Meal maths ───────────────────────────────────────────────────────────── */

export interface MacroTotals {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/**
 * Adds up a set of macro rows. Rows are read defensively because nutrition days
 * live in localStorage and can come from an older version or a hand-edited
 * backup where a field is simply absent.
 */
export function sumMacros(items: Partial<MacroTotals>[] | undefined | null): MacroTotals {
  return (items ?? []).reduce<MacroTotals>(
    (total, item) => ({
      kcal: total.kcal + (item?.kcal ?? 0),
      protein: total.protein + (item?.protein ?? 0),
      carbs: total.carbs + (item?.carbs ?? 0),
      fat: total.fat + (item?.fat ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}