import { MOVEMENTS } from '../data'
import type { MealSlot, Profile } from '../types'

/**
 * Meal slots and the profile wording the nutrition screens share.
 *
 * The target maths lives in `nutrition-targets.ts` so it can be exercised on its
 * own; this module re-exports it so every screen has one import site, and keeps
 * the two things that genuinely need the rest of the app: the slot list and the
 * profile summary line.
 */

export {
  DIET_LABEL,
  autoTargets,
  dietLabel,
  goalLabel,
  restingEnergy,
  sumMacros,
  type MacroTotals,
} from './nutrition-targets'

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

export function goalChip(goal: Profile['goals'][number]): string {
  return {
    'gain-muscle': 'bg-acc-core/12 text-acc-core ring-acc-core/25',
    'gain-weight': 'bg-acc-core/12 text-acc-core ring-acc-core/25',
    strength: 'bg-brand-400/12 text-brand-300 ring-brand-400/25',
    skills: 'bg-acc-shoulders/12 text-acc-shoulders ring-acc-shoulders/25',
    maintain: 'bg-ink-800 text-mist-300 ring-ink-600',
    'lose-weight': 'bg-amber-glow/12 text-amber-glow ring-amber-glow/30',
  }[goal]
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

/** Suggested meal slots for the user's stated number of meals per day. */
export function suggestedSlots(mealsPerDay: number): MealSlot[] {
  if (mealsPerDay <= 2) return ['breakfast', 'dinner']
  if (mealsPerDay === 3) return ['breakfast', 'lunch', 'dinner']
  if (mealsPerDay === 4) return ['breakfast', 'snack', 'lunch', 'dinner']
  if (mealsPerDay === 5) return ['breakfast', 'snack', 'lunch', 'pre-workout', 'dinner']
  if (mealsPerDay === 6) return ['breakfast', 'snack', 'lunch', 'pre-workout', 'post-workout', 'dinner']
  return ALL_MEAL_SLOTS.map((slot) => slot.id)
}