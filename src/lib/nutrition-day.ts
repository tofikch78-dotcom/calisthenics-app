/**
 * Everything the nutrition log does to a day's record.
 *
 * Two shapes of day are in localStorage at once. Days written before drinks
 * were logged individually have only `waterMl`; days written since also carry a
 * `water` array. `waterEntries()` reads either, so an upgrade never loses an
 * amount and never invents one that was not there.
 *
 * Every mutation here takes the *stored* days and returns new ones. Nothing
 * reads a value the caller happened to have rendered, which is what made rapid
 * taps on the water buttons drop all but one increment.
 *
 * It has no imports beyond the app's types, so it can be exercised directly.
 */
import type { Meal, NutritionDay, WaterEntry } from '../types'

/** The oldest plausible day key, used to place a legacy drink in the log. */
const LEGACY_AT = 0

export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}${random}`
}

export function emptyDay(date: string): NutritionDay {
  return { date, meals: [], waterMl: 0, water: [] }
}

export function findDayIndex(days: NutritionDay[], date: string): number {
  return days.findIndex((day) => day.date === date)
}

export function dayFor(days: NutritionDay[], date: string): NutritionDay {
  const index = findDayIndex(days, date)
  return index === -1 ? emptyDay(date) : days[index]
}

/**
 * Applies `change` to a day that already exists, and does nothing if it does
 * not. Used by edits and deletes: correcting or removing something the user
 * never logged should be a no-op, not the reason a blank day appears in their
 * history.
 */
export function withDay(
  days: NutritionDay[],
  date: string,
  change: (day: NutritionDay) => NutritionDay,
): NutritionDay[] {
  const index = findDayIndex(days, date)
  if (index === -1) return days
  const copy = [...days]
  copy[index] = normaliseDay(change(days[index]))
  return copy
}

/**
 * Applies `change` to a day, creating it first if it is not there yet. Used by
 * additions: logging the first drink or meal of a day has to make that day.
 */
export function ensureDay(
  days: NutritionDay[],
  date: string,
  change: (day: NutritionDay) => NutritionDay,
): NutritionDay[] {
  const index = findDayIndex(days, date)
  if (index === -1) return [normaliseDay(change(emptyDay(date))), ...days]
  const copy = [...days]
  copy[index] = normaliseDay(change(days[index]))
  return copy
}

/**
 * The drinks behind a day, whichever way that day was written.
 *
 * A day with no array but a non-zero total predates the drink log, so it is
 * shown as a single entry. That keeps "remove it" honest — it removes the whole
 * legacy total rather than leaving a phantom amount behind.
 */
export function waterEntries(day: NutritionDay | undefined | null): WaterEntry[] {
  if (!day) return []
  if (Array.isArray(day.water)) {
    return day.water
      .filter((entry): entry is WaterEntry => !!entry && typeof entry.ml === 'number')
      .map((entry) => ({
        id: entry.id || 'w_legacy',
        ml: entry.ml,
        at: typeof entry.at === 'number' ? entry.at : LEGACY_AT,
      }))
  }
  const total = typeof day.waterMl === 'number' ? day.waterMl : 0
  return total > 0 ? [{ id: 'w_legacy', ml: total, at: LEGACY_AT }] : []
}

export function waterTotal(entries: WaterEntry[]): number {
  return entries.reduce((total, entry) => total + Math.max(0, entry.ml), 0)
}

/** Keeps `waterMl` equal to the sum of the drinks, whoever wrote the day. */
export function normaliseDay(day: NutritionDay): NutritionDay {
  const entries = waterEntries(day)
  return { ...day, meals: day.meals ?? [], water: entries, waterMl: waterTotal(entries) }
}

/** Drinks newest first, so the list matches how they were actually taken. */
export function sortedWater(entries: WaterEntry[]): WaterEntry[] {
  return [...entries].sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1))
}

export function addWaterEntry(
  entries: WaterEntry[],
  ml: number,
  at: number,
  id: string = newId('w'),
): WaterEntry[] {
  const amount = Math.round(ml)
  // An exact drink is the whole point of logging entries rather than a running
  // total, so a custom amount below the quick-step size has to be allowed.
  if (!Number.isFinite(amount) || amount <= 0) return entries
  return [...entries, { id, ml: amount, at }]
}

export function updateWaterEntry(
  entries: WaterEntry[],
  entryId: string,
  patch: Partial<Omit<WaterEntry, 'id'>>,
): WaterEntry[] {
  return entries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          ml: typeof patch.ml === 'number' && patch.ml > 0 ? Math.round(patch.ml) : entry.ml,
          at: typeof patch.at === 'number' ? patch.at : entry.at,
        }
      : entry,
  )
}

export function removeWaterEntry(entries: WaterEntry[], entryId: string): WaterEntry[] {
  return entries.filter((entry) => entry.id !== entryId)
}

/** A day worth returning to: it has a meal or a drink in it. */
export function dayHasData(day: NutritionDay | undefined | null): boolean {
  if (!day) return false
  return (day.meals?.length ?? 0) > 0 || waterTotal(waterEntries(day)) > 0
}

export function insertMeal(days: NutritionDay[], date: string, meal: Meal): NutritionDay[] {
  // The editor seeds a blank meal with an empty id; give it a real one so later
  // edits and deletes address exactly one meal. An id from an imported backup is
  // kept as-is.
  const stored: Meal = meal.id ? meal : { ...meal, id: newId('meal') }
  return ensureDay(days, date, (day) => ({ ...day, meals: [...day.meals, stored] }))
}

export function patchMeal(
  days: NutritionDay[],
  date: string,
  mealId: string,
  patch: Partial<Meal>,
): NutritionDay[] {
  return withDay(days, date, (day) => ({
    ...day,
    meals: day.meals.map((meal) => (meal.id === mealId ? { ...meal, ...patch } : meal)),
  }))
}

export function dropMeal(days: NutritionDay[], date: string, mealId: string): NutritionDay[] {
  return withDay(days, date, (day) => ({
    ...day,
    meals: day.meals.filter((meal) => meal.id !== mealId),
  }))
}