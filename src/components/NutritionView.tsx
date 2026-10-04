import { useMemo, useState } from 'react'
import { addDays, relativeDay, todayKey, DAY_SHORT, fromDateKey, formatDateKey } from '../lib/dates'
import {
  ALL_MEAL_SLOTS,
  autoTargets,
  dietLabel,
  goalLabel,
  sumMacros,
  type MacroTotals,
} from '../lib/nutrition'
import { dayHasData, sortedWater, waterEntries, waterTotal } from '../lib/nutrition-day'
import type {
  FoodItem,
  Meal,
  MealSlot,
  NutritionDay,
  NutritionTargets,
  Profile,
  WaterEntry,
} from '../types'
import {
  Card,
  Chip,
  IconPlus,
  IconTrash,
  IconWater,
  NumberField,
  Pill,
  ProgressBar,
  Segmented,
  Sheet,
  TextField,
} from './kit'

export interface NutritionViewProps {
  profile: Profile | null
  days: NutritionDay[]
  targets: NutritionTargets
  onUpdateTargets: (patch: Partial<NutritionTargets>) => void
  onAddMeal: (date: string, meal: Meal) => void
  onUpdateMeal: (date: string, mealId: string, patch: Partial<Meal>) => void
  onDeleteMeal: (date: string, mealId: string) => void
  onAddWater: (date: string, ml: number) => void
  onUpdateWater: (date: string, entryId: string, patch: Partial<Omit<WaterEntry, 'id'>>) => void
  onRemoveWater: (date: string, entryId: string) => void
}

/**
 * A ready-made food row. Values are typical per serving, so tapping a
 * suggestion adds something real to the day's totals instead of a name with
 * zero macros. Everything stays editable once added.
 */
interface FoodSuggestion {
  name: string
  qty: number
  unit: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/** Per-meal suggestions, filtered by what the user said they like and avoid. */
function suggestionsFor(profile: Profile | null, slot: MealSlot): FoodSuggestion[] {
  const diet = profile?.diet ?? 'omnivore'
  const protein: FoodSuggestion[] =
    diet === 'vegan'
      ? [
          { name: 'Lentil tofu bowl', qty: 400, unit: 'g', kcal: 520, protein: 32, carbs: 62, fat: 16 },
          { name: 'Tempeh & rice', qty: 350, unit: 'g', kcal: 560, protein: 34, carbs: 68, fat: 14 },
        ]
      : diet === 'vegetarian'
        ? [
            { name: 'Paneer & rice', qty: 380, unit: 'g', kcal: 610, protein: 30, carbs: 70, fat: 20 },
            { name: 'Halloumi wrap', qty: 280, unit: 'g', kcal: 545, protein: 26, carbs: 58, fat: 19 },
          ]
        : diet === 'pescatarian'
          ? [
              { name: 'Salmon & rice', qty: 350, unit: 'g', kcal: 600, protein: 38, carbs: 62, fat: 18 },
              { name: 'Tuna salad wrap', qty: 280, unit: 'g', kcal: 480, protein: 34, carbs: 44, fat: 12 },
            ]
          : [
            { name: 'Chicken & rice', qty: 380, unit: 'g', kcal: 620, protein: 48, carbs: 66, fat: 12 },
            { name: 'Egg on toast', qty: 220, unit: 'g', kcal: 390, protein: 22, carbs: 34, fat: 16 },
          ]

  const base: Record<MealSlot, FoodSuggestion[]> = {
    breakfast: [
      { name: 'Oats with banana', qty: 250, unit: 'g', kcal: 430, protein: 15, carbs: 68, fat: 10 },
      { name: 'Eggs on toast', qty: 220, unit: 'g', kcal: 390, protein: 22, carbs: 34, fat: 16 },
      { name: 'Greek yoghurt + berries', qty: 250, unit: 'g', kcal: 280, protein: 24, carbs: 30, fat: 6 },
      { name: 'Porridge with peanut butter', qty: 300, unit: 'g', kcal: 520, protein: 19, carbs: 68, fat: 18 },
    ],
    snack: [
      { name: 'Apple + almonds', qty: 150, unit: 'g', kcal: 245, protein: 6, carbs: 32, fat: 12 },
      { name: 'Protein bar', qty: 60, unit: 'g', kcal: 235, protein: 21, carbs: 22, fat: 8 },
      { name: 'Cottage cheese', qty: 150, unit: 'g', kcal: 130, protein: 17, carbs: 5, fat: 4 },
      { name: 'Rice cakes + honey', qty: 60, unit: 'g', kcal: 215, protein: 3, carbs: 44, fat: 1 },
    ],
    lunch: [
      { name: 'Chicken & rice bowl', qty: 400, unit: 'g', kcal: 640, protein: 48, carbs: 74, fat: 12 },
      { name: 'Tuna salad wrap', qty: 280, unit: 'g', kcal: 480, protein: 34, carbs: 44, fat: 12 },
      { name: 'Lentil soup + bread', qty: 400, unit: 'g', kcal: 460, protein: 22, carbs: 68, fat: 9 },
      { name: 'Pasta with tomato sauce', qty: 400, unit: 'g', kcal: 590, protein: 22, carbs: 92, fat: 13 },
    ],
    'pre-workout': [
      { name: 'Banana', qty: 120, unit: 'g', kcal: 105, protein: 1, carbs: 27, fat: 0 },
      { name: 'Toast + honey', qty: 100, unit: 'g', kcal: 235, protein: 5, carbs: 42, fat: 4 },
      { name: 'Rice cakes', qty: 30, unit: 'g', kcal: 110, protein: 2, carbs: 23, fat: 1 },
      { name: 'Dates and a sports drink', qty: 250, unit: 'g', kcal: 265, protein: 2, carbs: 62, fat: 0 },
    ],
    'post-workout': [
      { name: 'Whey shake', qty: 300, unit: 'ml', kcal: 320, protein: 32, carbs: 28, fat: 7 },
      { name: 'Chocolate milk', qty: 400, unit: 'ml', kcal: 330, protein: 16, carbs: 44, fat: 10 },
      { name: 'Rice + chicken', qty: 350, unit: 'g', kcal: 560, protein: 42, carbs: 66, fat: 8 },
      { name: 'Yoghurt + granola', qty: 250, unit: 'g', kcal: 410, protein: 20, carbs: 50, fat: 13 },
    ],
    dinner: [
      { name: 'Grilled salmon, potatoes', qty: 400, unit: 'g', kcal: 680, protein: 42, carbs: 66, fat: 24 },
      { name: 'Stir-fried tofu', qty: 350, unit: 'g', kcal: 480, protein: 30, carbs: 34, fat: 22 },
      { name: 'Beef and rice', qty: 350, unit: 'g', kcal: 650, protein: 46, carbs: 62, fat: 18 },
      { name: 'Veggie chilli', qty: 450, unit: 'g', kcal: 480, protein: 20, carbs: 70, fat: 12 },
    ],
    other: [
      { name: 'Homemade snack', qty: 100, unit: 'g', kcal: 200, protein: 8, carbs: 22, fat: 8 },
      { name: 'Leftovers', qty: 350, unit: 'g', kcal: 560, protein: 36, carbs: 58, fat: 18 },
    ],
  }

  if (diet === 'vegan')
    base.dinner = [
      { name: 'Tofu stir-fry', qty: 380, unit: 'g', kcal: 510, protein: 30, carbs: 38, fat: 24 },
      { name: 'Lentil curry + rice', qty: 420, unit: 'g', kcal: 560, protein: 26, carbs: 78, fat: 12 },
      { name: 'Bean stew', qty: 450, unit: 'g', kcal: 490, protein: 24, carbs: 70, fat: 10 },
    ]
  if (diet === 'vegetarian')
    base.dinner = [
      { name: 'Paneer tikka + rice', qty: 400, unit: 'g', kcal: 660, protein: 32, carbs: 72, fat: 24 },
      { name: 'Mushroom pasta', qty: 400, unit: 'g', kcal: 580, protein: 22, carbs: 82, fat: 18 },
      { name: 'Lentil shepherd’s pie', qty: 450, unit: 'g', kcal: 545, protein: 24, carbs: 76, fat: 14 },
    ]

  const options = [...base[slot], ...(slot === 'breakfast' ? protein.slice(0, 1) : [])]

  const avoid = `${profile?.dislikedFoods ?? ''} ${profile?.allergies ?? ''}`
    .toLowerCase()
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)

  return avoid.length
    ? options.filter((option) => !avoid.some((term) => option.name.toLowerCase().includes(term)))
    : options
}

export function NutritionView({
  profile,
  days,
  targets,
  onUpdateTargets,
  onAddMeal,
  onUpdateMeal,
  onDeleteMeal,
  onAddWater,
  onUpdateWater,
  onRemoveWater,
}: NutritionViewProps) {
  const [date, setDate] = useState(todayKey())
  const [editing, setEditing] = useState<{ date: string; meal: Meal } | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customMl, setCustomMl] = useState(0)

  const auto = useMemo(() => autoTargets(profile), [profile])
  // In auto mode the numbers come from the profile; the stored values are only
  // the manual overrides. Spreading them the other way round would let a stale
  // 2200 kcal default win over a freshly computed 2990.
  const effective: NutritionTargets = targets.auto ? { ...auto, auto: true } : targets

  const day = useMemo(() => days.find((entry) => entry.date === date), [days, date])
  const totals = useMemo<MacroTotals>(
    () => sumMacros(day?.meals.flatMap((meal) => meal.items) ?? []),
    [day],
  )

  // The strip always ends on the selected day, so walking back with ← keeps
  // following the view instead of snapping back to today.
  const stripDays = useMemo(() => {
    const end = date > todayKey() ? date : todayKey()
    return Array.from({ length: 7 }, (_, index) => addDays(end, index - 6))
  }, [date])

  const loggedDates = useMemo(
    () => new Set(days.filter((entry) => dayHasData(entry)).map((entry) => entry.date)),
    [days],
  )

  // Every slot is always offered; ones the user has used are simply non-empty.
  // Building all seven lists once per render beats recomputing a slot's list
  // twice inside the row that needs it.
  const slots = ALL_MEAL_SLOTS
  const slotsFor = useMemo(() => {
    const map: Partial<Record<MealSlot, FoodSuggestion[]>> = {}
    for (const slot of ALL_MEAL_SLOTS) map[slot.id] = suggestionsFor(profile, slot.id)
    return map
  }, [profile])

  const macroRows: { label: string; current: number; target: number; unit: string; tone: 'ok' | 'warn' | 'brand' }[] = [
    { label: 'Calories', current: totals.kcal, target: effective.kcal, unit: 'kcal', tone: 'brand' },
    { label: 'Protein', current: totals.protein, target: effective.protein, unit: 'g', tone: 'ok' },
    { label: 'Carbs', current: totals.carbs, target: effective.carbs, unit: 'g', tone: 'warn' },
    { label: 'Fat', current: totals.fat, target: effective.fat, unit: 'g', tone: 'brand' },
  ]

  const drinks = useMemo(() => sortedWater(waterEntries(day)), [day])
  const waterDone = waterTotal(drinks)
  const waterTarget = effective.waterMl
  const eatenMeals = day?.meals.filter((meal) => meal.done).length ?? 0

  return (
    <div className="space-y-4">
      {/*
        A week at a glance. The arrows alone meant reaching last month took
        thirty taps with no way to tell which days held anything, so each cell
        shows a dot for a day that has been logged and the row acts as a direct
        jump. It sits outside the card because seven comfortable cells need the
        full width of the screen, not a card's padding.
      */}
      <div className="-mx-4 flex gap-1 pb-1" role="group" aria-label="Jump to a day">
        {stripDays.map((key) => {
          const selected = key === date
          const parsed = fromDateKey(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => setDate(key)}
              aria-pressed={selected}
              aria-label={`${formatDateKey(key)}${loggedDates.has(key) ? ', has entries' : ''}`}
              title={formatDateKey(key)}
              className={`flex min-h-11 flex-1 flex-col items-center justify-center rounded-lg border text-[10px] transition ${
                selected
                  ? 'border-brand-400/50 bg-brand-500/12 text-brand-200'
                  : 'border-ink-700 bg-ink-900/40 text-mist-400 hover:border-ink-500'
              }`}
            >
              <span className="font-medium">{DAY_SHORT[parsed.getDay()]}</span>
              <span className="tnum text-[13px] font-semibold">{parsed.getDate()}</span>
              <span
                className={`mt-0.5 h-1 w-1 rounded-full ${loggedDates.has(key) ? 'bg-brand-300' : 'bg-transparent'}`}
              />
            </button>
          )
        })}
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            {/*
              The day is navigable, so the heading has to follow it: the pill on
              the right says "Yesterday" and this used to still say "Today".
              `relativeDay` reads as a label on its own for today, and as a
              date for anything else, which is what both want here.
            */}
            <h3 className="text-sm font-semibold text-mist-100">
              {date === todayKey() ? 'Today’s nutrition' : `${relativeDay(date)}’s nutrition`}
            </h3>
            <p className="mt-0.5 text-[11px] text-mist-400">
              Targets are an estimate from your profile
              {profile?.goals.length ? ` (${profile.goals.map(goalLabel).join(', ')})` : ''} — not medical
              advice, and always editable.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDate(addDays(date, -1))}
              aria-label="Previous day"
              className="grid h-11 w-11 place-items-center rounded-lg border border-ink-600 text-[11px] text-mist-300 hover:border-ink-500"
            >
              ←
            </button>
            <span className="tnum min-w-[5.5rem] text-center text-[11px] text-mist-200">
              {relativeDay(date)}
            </span>
            <button
              type="button"
              onClick={() => setDate(addDays(date, 1))}
              disabled={date >= todayKey()}
              aria-label="Next day"
              className="grid h-11 w-11 place-items-center rounded-lg border border-ink-600 text-[11px] text-mist-300 hover:border-ink-500 disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>

        <label className="mb-3 flex min-h-11 items-center justify-between gap-2 rounded-xl border border-ink-700 bg-ink-900/40 px-3">
          <span className="text-[11px] text-mist-400">
            {loggedDates.size} {loggedDates.size === 1 ? 'day' : 'days'} logged so far
          </span>
          <input
            type="date"
            value={date}
            max={todayKey()}
            onChange={(event) => {
              if (event.target.value) setDate(event.target.value)
            }}
            aria-label="Pick a day"
            className="tnum min-h-11 rounded-lg border border-ink-600 bg-ink-850 px-2 text-[11px] text-mist-200"
          />
        </label>

        {targets.auto ? (
          <p className="mb-3 rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-2 text-[11px] text-mist-400">
            Auto-calculated: {auto.kcal} kcal · {auto.protein} g protein · {auto.carbs} g carbs ·{' '}
            {auto.fat} g fat · {(auto.waterMl / 1000).toFixed(1)} L water. Based on{' '}
            {profile?.diet ? dietLabel(profile.diet).toLowerCase() : 'your'} preferences.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => onUpdateTargets({ auto: true })}
            className="mb-3 w-full rounded-xl border border-brand-400/30 bg-brand-500/8 px-3 py-2 text-[11px] text-brand-300 transition hover:bg-brand-500/15"
          >
            You&apos;re using custom targets. Tap to recalculate from your profile.
          </button>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {macroRows.map((row) => {
            const pct = row.target ? Math.round((row.current / row.target) * 100) : 0
            return (
              <div key={row.label} className="rounded-xl border border-ink-700 bg-ink-850/70 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-mist-400">{row.label}</span>
                  <span className="tnum text-[10px] text-mist-500">{pct}%</span>
                </div>
                <div className="tnum mt-1 text-base leading-none font-bold text-mist-100">
                  {Math.round(row.current)}
                  <span className="ml-1 text-[11px] font-medium text-mist-400">
                    / {row.target} {row.unit}
                  </span>
                </div>
                <ProgressBar
                  className="mt-2"
                  value={pct}
                  tone={row.tone}
                  label={`${row.label}: ${Math.round(row.current)} of ${row.target} ${row.unit}`}
                />
              </div>
            )
          })}
        </div>

        <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850/70 p-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-mist-200">
              <IconWater className="h-4 w-4 text-brand-300" />
              Water
            </span>
            <span className="tnum text-[11px] text-mist-400">
              {(waterDone / 1000).toFixed(2)} L / {(waterTarget / 1000).toFixed(1)} L
            </span>
          </div>
          <ProgressBar
            className="mt-2"
            value={(waterDone / waterTarget) * 100}
            tone="brand"
            label={`Water: ${waterDone} of ${waterTarget} ml`}
          />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[250, 500, 750].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => onAddWater(date, amount)}
                aria-label={`Log ${amount} millilitres of water`}
                className="min-h-11 rounded-lg border border-brand-400/30 bg-brand-500/8 px-3 py-1.5 text-[11px] font-medium text-brand-300 transition hover:bg-brand-500/15"
              >
                +{amount} ml
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomOpen((open) => !open)}
              aria-expanded={customOpen}
              aria-label="Log a custom amount of water"
              className="min-h-11 rounded-lg border border-ink-600 px-3 py-1.5 text-[11px] text-mist-300 transition hover:border-ink-500"
            >
              Custom…
            </button>
          </div>

          {customOpen && (
            <div className="mt-2 flex items-end gap-2">
              <NumberField
                label="Custom amount"
                suffix="ml"
                className="min-h-11"
                value={customMl}
                onChange={(event) => setCustomMl(Math.max(0, Number(event.target.value) || 0))}
              />
              <button
                type="button"
                onClick={() => {
                  onAddWater(date, customMl)
                  setCustomMl(0)
                  setCustomOpen(false)
                }}
                disabled={customMl <= 0}
                className="min-h-11 rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white transition hover:bg-brand-400 disabled:opacity-40"
              >
                Log it
              </button>
            </div>
          )}

          {/*
            One row per drink. A single running total could only be changed by
            tapping backwards in 250 ml steps, so a mis-tap had to be undone as
            many times as it was made, and an exact bottle could not be recorded
            at all. Tapping a row corrects that one drink.
          */}
          {drinks.length > 0 && (
            <div className="mt-3 border-t border-ink-700 pt-2">
              <p className="mb-1 text-[10px] tracking-wider text-mist-500 uppercase">
                Drinks · tap one to correct it
              </p>
              <ul className="space-y-1">
                {drinks.map((entry) => (
                  <WaterRow
                    key={entry.id}
                    entry={entry}
                    onUpdate={(patch) => onUpdateWater(date, entry.id, patch)}
                    onRemove={() => onRemoveWater(date, entry.id)}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="tnum mt-2 text-[11px] text-mist-500">
          {eatenMeals} {eatenMeals === 1 ? 'meal' : 'meals'} marked eaten · {day?.meals.length ?? 0} logged
        </p>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-mist-100">Meals</h3>
          <button
            type="button"
            onClick={() =>
              setEditing({
                date,
                meal: { id: '', slot: 'breakfast', name: '', items: [], done: false },
              })
            }
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-brand-400/40 px-3 py-1.5 text-xs font-semibold text-brand-300 transition hover:bg-brand-500/10"
          >
            <IconPlus className="h-3.5 w-3.5" /> Add meal
          </button>
        </div>

        <ul className="space-y-2">
          {slots.map((slot) => {
            const meals = day?.meals.filter((meal) => meal.slot === slot.id) ?? []
            return (
              <li key={slot.id} className="rounded-xl border border-ink-700/70 bg-ink-900/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-mist-200">{slot.label}</h4>
                    <p className="text-[10px] text-mist-500">{slot.hint}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        date,
                        meal: { id: '', slot: slot.id, name: '', items: [], done: false },
                      })
                    }
                    aria-label={`Add a meal to ${slot.label}`}
                    className="grid size-11 shrink-0 place-items-center rounded-lg border border-ink-600 text-mist-400 transition hover:border-brand-400/40 hover:text-brand-300"
                  >
                    <IconPlus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {meals.length === 0 ? (
                  <p className="mt-2 text-[11px] text-mist-500">
                    {slotsFor[slot.id]?.[0]
                      ? `Nothing logged. Try “${slotsFor[slot.id]![0].name}”.`
                      : 'Nothing logged.'}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {meals.map((meal) => {
                      const items = meal.items ?? []
                      const macros = sumMacros(items)
                      return (
                        <li
                          key={meal.id}
                          className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 ${
                            meal.done ? 'bg-lime-glow/8' : 'bg-ink-850/60'
                          }`}
                        >
                          {/*
                            The tick was a 20 px box — the smallest hit area in
                            the app, on the control most likely to be hit by
                            accident or missed entirely. The button now carries
                            the 44 px target and the box sits inside it.
                          */}
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={meal.done}
                            aria-label={`${meal.done ? 'Unmark' : 'Mark'} ${meal.name || 'meal'} as eaten`}
                            onClick={() => onUpdateMeal(date, meal.id, { done: !meal.done })}
                            className="-my-2.5 grid size-11 shrink-0 place-items-center rounded-lg transition"
                          >
                            <span
                              className={`grid size-5 place-items-center rounded-md border text-[10px] font-bold transition ${
                                meal.done
                                  ? 'border-lime-glow/40 bg-lime-glow/20 text-lime-glow'
                                  : 'border-ink-600 bg-ink-800 text-mist-500'
                              }`}
                            >
                              {meal.done ? '✓' : ''}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditing({ date, meal })}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span
                              className={`block truncate text-xs font-medium ${
                                meal.done ? 'text-mist-400 line-through' : 'text-mist-100'
                              }`}
                            >
                              {meal.name || 'Untitled meal'}
                            </span>
                            <span className="tnum block text-[10px] text-mist-400">
                              {items.length
                                ? items.map((item) => `${item.name} ${item.qty}${item.unit}`).join(' · ')
                                : 'No foods'}
                            </span>
                            {items.length > 0 && (
                              <span className="tnum mt-0.5 flex flex-wrap gap-1.5 text-[10px]">
                                <span className="text-brand-300">{macros.kcal} kcal</span>
                                <span className="text-lime-glow">P {Math.round(macros.protein)}g</span>
                                <span className="text-amber-glow">C {Math.round(macros.carbs)}g</span>
                                <span className="text-mist-400">F {Math.round(macros.fat)}g</span>
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteMeal(date, meal.id)}
                            aria-label={`Delete ${meal.name || 'meal'}`}
                            className="-my-2.5 grid size-11 shrink-0 place-items-center rounded-lg text-mist-500 transition hover:text-rose-glow"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-mist-100">Targets</h3>
        <p className="mt-0.5 text-xs text-mist-400">
          Auto or manual. Change any number and it sticks.
        </p>
        <div className="mt-3">
          <Segmented
            ariaLabel="Target mode"
            value={targets.auto ? 'auto' : 'manual'}
            onChange={(mode) =>
              // Switching to manual starts from the auto numbers, so the user
              // edits a real figure instead of an arbitrary default.
              onUpdateTargets(mode === 'auto' ? { auto: true } : { ...auto, auto: false })
            }
            options={[
              { id: 'auto', label: 'Auto from profile' },
              { id: 'manual', label: 'Manual' },
            ]}
          />
        </div>
        {!targets.auto && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                ['kcal', 'Calories', ''],
                ['protein', 'Protein', 'g'],
                ['carbs', 'Carbs', 'g'],
                ['fat', 'Fat', 'g'],
                ['waterMl', 'Water', 'ml'],
              ] as const
            ).map(([key, label, unit]) => (
              <NumberField
                key={key}
                label={label}
                suffix={unit || undefined}
                className="min-h-11"
                value={effective[key]}
                onChange={(event) => onUpdateTargets({ [key]: Number(event.target.value) || 0 })}
              />
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <MealSheet
          key={`${editing.date}-${editing.meal.id || 'new'}`}
          profile={profile}
          initial={editing.meal}
          onClose={() => setEditing(null)}
          onSave={(meal) => {
            if (editing.meal.id) onUpdateMeal(editing.date, editing.meal.id, meal)
            else onAddMeal(editing.date, meal)
            setEditing(null)
          }}
          onDelete={
            editing.meal.id
              ? () => {
                  onDeleteMeal(editing.date, editing.meal.id)
                  setEditing(null)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

/**
 * One drink. Collapsed it shows the amount and time; tapping opens an exact
 * amount field so a mis-logged drink is corrected rather than re-tapped in
 * reverse.
 */
function WaterRow({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: WaterEntry
  onUpdate: (patch: Partial<Omit<WaterEntry, 'id'>>) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)

  const time = entry.at
    ? new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <li className="flex items-center gap-1">
      {open ? (
        <>
          <span className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-ink-850/70 px-2">
            <IconWater className="h-3.5 w-3.5 shrink-0 text-brand-300" />
            <input
              type="number"
              value={entry.ml}
              min={1}
              aria-label="Corrected amount in millilitres"
              onChange={(event) => onUpdate({ ml: Math.max(0, Number(event.target.value) || 0) })}
              className="tnum h-11 min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-850 px-2 text-[11px] text-mist-100"
            />
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-11 shrink-0 rounded-lg bg-brand-500 px-3 text-[11px] font-semibold text-white"
          >
            Done
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Correct this drink of ${entry.ml} millilitres`}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left transition hover:bg-ink-850/70"
        >
          <IconWater className="h-3.5 w-3.5 shrink-0 text-brand-300" />
          <span className="tnum text-[11px] text-mist-200">{entry.ml} ml</span>
          <span className="tnum text-[10px] text-mist-500">{time ?? 'earlier'}</span>
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove this drink of ${entry.ml} millilitres`}
        className="grid size-11 shrink-0 place-items-center rounded-lg text-mist-500 transition hover:text-rose-glow"
      >
        <IconTrash className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

function MealSheet({
  profile,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  profile: Profile | null
  initial: Meal
  onClose: () => void
  onSave: (meal: Meal) => void
  onDelete?: () => void
}) {
  const blank: FoodItem = { id: '', name: '', qty: 100, unit: 'g', kcal: 0, protein: 0, carbs: 0, fat: 0 }

  const [name, setName] = useState(initial.name)
  const [slot, setSlot] = useState<MealSlot>(initial.slot)
  const [done, setDone] = useState(initial.done)
  const [items, setItems] = useState<FoodItem[]>(initial.items)
  const [draft, setDraft] = useState<FoodItem>(blank)
  // Which saved row the draft is currently standing in for, if any.
  const [editingId, setEditingId] = useState<string | null>(null)

  const macros = useMemo(() => sumMacros(items), [items])
  const suggestions = useMemo(() => suggestionsFor(profile, slot), [profile, slot])

  const addItem = () => {
    if (!draft.name.trim()) return
    if (editingId) {
      // Correcting a food in place. Deleting and re-adding it also worked, but
      // it threw away a row the user had deliberately placed in the meal.
      setItems((current) =>
        current.map((item) =>
          item.id === editingId ? { ...draft, id: item.id, name: draft.name.trim() } : item,
        ),
      )
    } else {
      setItems((current) => [...current, { ...draft, id: `f_${Date.now().toString(36)}` }])
    }
    setDraft(blank)
    setEditingId(null)
  }

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
    if (editingId === id) {
      setDraft(blank)
      setEditingId(null)
    }
  }

  return (
    <Sheet
      title={initial.id ? 'Edit meal' : 'Add meal'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="min-h-11 rounded-lg border border-rose-glow/30 px-4 text-sm text-rose-glow"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave({ ...initial, name: name.trim() || 'Meal', slot, done, items })}
            className="min-h-11 flex-1 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-400"
          >
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <TextField
          label="Meal name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={suggestions[0]?.name}
        />

        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-mist-400 uppercase">Slot</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_MEAL_SLOTS.map((option) => (
              <Chip key={option.id} pressed={slot === option.id} onClick={() => setSlot(option.id)}>
                {option.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-mist-400 uppercase">Suggestions</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((option) => (
              <Chip
                key={option.name}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    name: option.name,
                    qty: option.qty,
                    unit: option.unit,
                    kcal: option.kcal,
                    protein: option.protein,
                    carbs: option.carbs,
                    fat: option.fat,
                  }))
                }
              >
                {option.name}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-medium tracking-wider text-mist-400 uppercase">Foods</p>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <TextField
                className="col-span-2 sm:col-span-2"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Food name"
              />
              <TextField
                type="number"
                value={draft.qty}
                aria-label="Quantity"
                onChange={(event) => setDraft({ ...draft, qty: Number(event.target.value) || 0 })}
              />
              <TextField
                value={draft.unit}
                aria-label="Unit"
                onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
                placeholder="g / ml / serving"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ['kcal', 'kcal'],
                  ['protein', 'P g'],
                  ['carbs', 'C g'],
                  ['fat', 'F g'],
                ] as const
              ).map(([key, label]) => (
                <TextField
                  key={key}
                  type="number"
                  aria-label={label}
                  value={draft[key] || ''}
                  onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) || 0 })}
                  placeholder={label}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addItem}
                disabled={!draft.name.trim()}
                className="min-h-11 flex-1 rounded-lg border border-ink-600 px-3 text-xs font-medium text-mist-200 transition hover:border-brand-400/40 hover:text-brand-300 disabled:opacity-40"
              >
                {editingId ? 'Update food' : 'Add food'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(blank)
                    setEditingId(null)
                  }}
                  className="min-h-11 rounded-lg border border-ink-600 px-3 text-xs text-mist-300"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {items.length > 0 && (
          <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-3">
            <div className="tnum flex flex-wrap justify-between gap-2 text-[11px] text-mist-300">
              <span className="text-brand-300">{Math.round(macros.kcal)} kcal</span>
              <span className="text-lime-glow">P {Math.round(macros.protein)}g</span>
              <span className="text-amber-glow">C {Math.round(macros.carbs)}g</span>
              <span>F {Math.round(macros.fat)}g</span>
            </div>
            <ul className="mt-2 space-y-1">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-1 text-[11px]">
                  {/*
                    Tapping a saved food loads it back into the form above so a
                    wrong quantity or macro can be corrected in place. Without
                    this the only way to fix one was to delete it and type it
                    out again.
                  */}
                  <button
                    type="button"
                    onClick={() => {
                      setDraft({ ...item })
                      setEditingId(item.id)
                    }}
                    aria-pressed={editingId === item.id}
                    aria-label={`Edit ${item.name}`}
                    className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left transition ${
                      editingId === item.id ? 'bg-brand-500/12' : 'hover:bg-ink-850/70'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-mist-300">{item.name}</span>
                    <span className="tnum shrink-0 text-mist-500">
                      {item.qty}
                      {item.unit}
                    </span>
                    <span className="tnum w-16 shrink-0 text-right text-mist-200">
                      {Math.round(item.kcal)} kcal
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remove ${item.name}`}
                    className="grid size-11 shrink-0 place-items-center rounded-lg text-mist-500 hover:text-rose-glow"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          onClick={() => setDone(!done)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-850/60 px-3.5 py-3 text-left"
        >
          <span className="text-sm text-mist-100">Mark as eaten</span>
          <Pill
            className={
              done ? 'bg-lime-glow/15 text-lime-glow ring-lime-glow/30' : 'bg-ink-800 text-mist-400 ring-ink-600'
            }
          >
            {done ? '✅ Done' : '⚪ Not yet'}
          </Pill>
        </button>
      </div>
    </Sheet>
  )
}
