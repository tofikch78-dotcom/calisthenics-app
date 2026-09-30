import { MOVEMENTS } from '../data'
import type { Goal, MealSlot, NutritionTargets, Profile } from '../types'

/**
 * Nutrition guidance from the user's own onboarding answers.
 *
 * These are general training heuristics, not medical advice. Every number is
 * an estimate that the user can override, and the UI says so plainly.
 */

const MEAL_SLOTS: { id: MealSlot; label: string; hint: string }[] = [
  { id: 'breakfast', label: 'Breakfast', hint: 'First meal of the day' },
  { id: 'snack', label: 'Snack', hint: 'Between meals' },
  { id: 'lunch', label: 'Lunch', hint: 'Midday meal' },
  { id: 'pre-workout', label: 'Pre-workout', hint: '1–2 h before training' },
  { id: 'post-workout', label: 'Post-workout', hint: 'Within a few hours after' },
  { id: 'dinner', label: 'Dinner', hint: 'Evening meal' },
  { id: 'other', label: 'Other', hint: 'Anything else' },
]

export const MEAL_SLOT_META = new Map(MEAL_SLOTS.map((slot) => [slot.id, slot]))
export const ALL_MEAL_SLOTS = MEAL_SLOTS

/** Mifflin–St Jeor resting energy expenditure, kcal/day. */
export function restingEnergy(profile: Profile | null): number {
  if (!profile?.weightKg || !profile.heightCm || !profile.age) return 1650
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

export function autoTargets(profile: Profile | null): NutritionTargets {
  const tdee = restingEnergy(profile) * ACTIVITY_BY_DAYS[profile?.daysPerWeek ?? 3]
  const goals = profile?.goals?.length ? profile.goals : ['maintain']
  // Lifting goals win over cutting goals when both are ticked.
  const ordered: Goal[] = [
    'gain-muscle',
    'gain-weight',
    'strength',
    'skills',
    'maintain',
    'lose-weight',
  ]
  const primary = ordered.find((goal) => goals.includes(goal)) ?? 'maintain'

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
    waterMl: Math.round(weightKg * 33 + (profile?.daysPerWeek ?? 3) * 150),
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

export function goalChip(goal: Goal): string {
  return {
    'gain-muscle': 'bg-acc-core/12 text-acc-core ring-acc-core/25',
    'gain-weight': 'bg-acc-core/12 text-acc-core ring-acc-core/25',
    strength: 'bg-brand-400/12 text-brand-300 ring-brand-400/25',
    skills: 'bg-acc-shoulders/12 text-acc-shoulders ring-acc-shoulders/25',
    maintain: 'bg-ink-800 text-mist-300 ring-ink-600',
    'lose-weight': 'bg-amber-glow/12 text-amber-glow ring-amber-glow/30',
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

/** Which training pattern the plan leans on, for a friendly one-liner. */
export function trainingBias(profile: Profile | null): string {
  const days = profile?.daysPerWeek ?? 0
  const pattern = Object.values(MOVEMENTS)
    .map((movement) => movement.label)
    .slice(0, 0)
  return `${days} training ${days === 1 ? 'day' : 'days'} a week${
    profile?.sessionMinutes ? ` · ~${profile.sessionMinutes} min per session` : ''
  }${pattern.length ? ` · ${pattern.join(', ')}` : ''}`
}

/* ── Meal maths ─────────────────────────────────────────────────────────── */

export interface MacroTotals {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/**
 * Adds up a set of macro rows. Rows are read defensively because nutrition
 * days live in localStorage and can come from an older version or a
 * hand-edited backup where a field is simply absent.
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

/** Suggested meal slots for the user's stated number of meals per day. */
export function suggestedSlots(mealsPerDay: number): MealSlot[] {
  if (mealsPerDay <= 2) return ['breakfast', 'dinner']
  if (mealsPerDay === 3) return ['breakfast', 'lunch', 'dinner']
  if (mealsPerDay === 4) return ['breakfast', 'snack', 'lunch', 'dinner']
  if (mealsPerDay === 5) return ['breakfast', 'snack', 'lunch', 'pre-workout', 'dinner']
  if (mealsPerDay === 6) return ['breakfast', 'snack', 'lunch', 'pre-workout', 'post-workout', 'dinner']
  return ALL_MEAL_SLOTS.map((slot) => slot.id)
}
