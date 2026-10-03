/**
 * Checks the rules behind the nutrition log.
 *
 * `verify-library.mjs` covers the exercise catalogue and
 * `verify-session-flow.mjs` covers the workout flow. This covers the daily food
 * and water record: that edits compose instead of overwriting each other, that a
 * drink can be corrected or removed on its own, that a day written before the
 * drink log existed still reads back with its amount, and that addressing a day
 * with nothing in it creates that day instead of quietly doing nothing.
 *
 * Everything here is a pure function, so the checks are exact rather than
 * approximate — no browser, no clock, no waiting.
 */
import {
  addWaterEntry,
  dayFor,
  dayHasData,
  dropMeal,
  emptyDay,
  ensureDay,
  findDayIndex,
  insertMeal,
  normaliseDay,
  patchMeal,
  removeWaterEntry,
  sortedWater,
  updateWaterEntry,
  waterEntries,
  waterTotal,
  withDay,
} from './src/lib/nutrition-day.ts'
import { autoTargets, restingEnergy, sumMacros } from './src/lib/nutrition-targets.ts'

let failures = 0

/** Key order is not part of a value's identity, so compare sorted. */
function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    )
  }
  return value
}

function check(label, actual, expected) {
  const a = JSON.stringify(stable(actual))
  const b = JSON.stringify(stable(expected))
  if (a !== b) {
    failures += 1
    console.log(`  FAIL  ${label}\n        expected ${b}\n        actual   ${a}`)
  } else {
    console.log(`  ok    ${label}`)
  }
}

function group(name) {
  console.log(`\n${name}`)
}

const DAY = '2026-10-03'

function oats() {
  return {
    id: 'meal_1',
    slot: 'breakfast',
    name: 'Morning oats',
    done: false,
    items: [
      { id: 'f1', name: 'Oats with banana', qty: 250, unit: 'g', kcal: 430, protein: 15, carbs: 68, fat: 10 },
      { id: 'f2', name: 'Whey shake', qty: 300, unit: 'ml', kcal: 320, protein: 32, carbs: 28, fat: 7 },
    ],
  }
}

/* ── Reading a day, whichever shape it was written in ─────────────────────── */

group('A day reads back the same however it was stored')

check('an empty day is empty', emptyDay(DAY), { date: DAY, meals: [], waterMl: 0, water: [] })
check('a missing day reads as empty', waterEntries(dayFor([], DAY)), [])
check('a missing day has no data', dayHasData(dayFor([], DAY)), false)

check(
  'a legacy total-only day keeps its amount as one drink',
  waterEntries({ date: DAY, meals: [], waterMl: 1000 }),
  [{ id: 'w_legacy', ml: 1000, at: 0 }],
)

check(
  'a day with both is read from the drinks',
  waterEntries({ date: DAY, meals: [], waterMl: 999, water: [{ id: 'a', ml: 300, at: 5 }] }),
  [{ id: 'a', ml: 300, at: 5 }],
)

check(
  'normalising a legacy day settles the total without inventing drinks',
  normaliseDay({ date: DAY, meals: [], waterMl: 750 }),
  { date: DAY, meals: [], water: [{ id: 'w_legacy', ml: 750, at: 0 }], waterMl: 750 },
)

check(
  'normalising is stable, so a re-render cannot drift the total',
  normaliseDay(normaliseDay({ date: DAY, meals: [], waterMl: 750 })),
  { date: DAY, meals: [], water: [{ id: 'w_legacy', ml: 750, at: 0 }], waterMl: 750 },
)

check(
  'a malformed drink is dropped rather than summed as NaN',
  waterEntries({ date: DAY, meals: [], waterMl: 0, water: [{ id: 'a', ml: 250, at: 1 }, null, { id: 'b' }] }),
  [{ id: 'a', ml: 250, at: 1 }],
)

check(
  'a drink with no id still gets one, so remove can address it',
  waterEntries({ date: DAY, meals: [], waterMl: 0, water: [{ ml: 100, at: 1 }] }),
  [{ id: 'w_legacy', ml: 100, at: 1 }],
)

/* ── Rapid taps must all count ────────────────────────────────────────────── */

group('Rapid taps all land')

{
  // The bug this guards: the water buttons added to a number the caller had
  // rendered, so four taps in one burst recorded one drink.
  let days = []
  for (let i = 0; i < 4; i += 1) {
    // Mirrors the store's addWater exactly.
    days = ensureDay(days, DAY, (day) => ({
      ...day,
      water: addWaterEntry(waterEntries(day), 250, 1000 + i),
    }))
  }
  check('four taps of +250 record four drinks', waterEntries(days[0]).length, 4)
  check('and total 1000 ml', waterTotal(waterEntries(days[0])), 1000)
  check('the stored total agrees', days[0].waterMl, 1000)
}

check('a drink of nothing is not recorded', addWaterEntry([], 0, 1), [])
check('a negative drink is not recorded', addWaterEntry([], -250, 1), [])
check('an exact bottle is allowed, below the quick step', addWaterEntry([], 330, 1, 'w_a'), [
  { id: 'w_a', ml: 330, at: 1 },
])

/* ── Correcting and removing one drink ────────────────────────────────────── */

group('One drink can be corrected or removed on its own')

{
  let entries = []
  entries = addWaterEntry(entries, 250, 10)
  entries = addWaterEntry(entries, 500, 20)
  entries = addWaterEntry(entries, 750, 30)

  check('correcting the middle one', updateWaterEntry(entries, entries[1].id, { ml: 1000 })[1].ml, 1000)
  check('leaves the others alone', updateWaterEntry(entries, entries[1].id, { ml: 1000 }).map((e) => e.ml), [
    250, 1000, 750,
  ])
  check('a correction of zero is refused, not stored', updateWaterEntry(entries, entries[0].id, { ml: 0 })[0].ml, 250)
  check('removing the middle one', removeWaterEntry(entries, entries[1].id).map((e) => e.ml), [250, 750])
  check('removing an unknown id changes nothing', removeWaterEntry(entries, 'nope').length, 3)
  check('removing every drink empties the day', removeWaterEntry(entries, entries[0].id).length, 2)
  check('newest first', sortedWater(entries).map((e) => e.at), [30, 20, 10])
}

/* ── Addressing a day that has no entry yet ───────────────────────────────── */

group('Addressing a day that has nothing in it')

check('findDayIndex reports a miss', findDayIndex([], DAY), -1)

check('adding to a day that does not exist creates it', ensureDay([], DAY, (d) => ({
  ...d,
  water: addWaterEntry(waterEntries(d), 500, 1, 'w_a'),
})), [{ date: DAY, meals: [], water: [{ id: 'w_a', ml: 500, at: 1 }], waterMl: 500 }])

check('editing a day that does not exist is a no-op', withDay([], DAY, (d) => ({ ...d, waterMl: 500 })), [])
check(
  'deleting on a day that does not exist adds nothing to the history',
  dropMeal([], '2026-10-02', 'no-such-meal'),
  [],
)
check(
  'adding to one day does not disturb another',
  ensureDay([{ date: '2026-10-02', meals: [oats()], waterMl: 0 }], DAY, (d) => ({
    ...d,
    water: addWaterEntry(waterEntries(d), 500, 1, 'w_a'),
  })).map((d) => d.date),
  [DAY, '2026-10-02'],
)

{
  // The other silent failure: update and delete walked the array with .map(),
  // so a meal edited on a day that had no entry yet was simply lost.
  const days = insertMeal([], DAY, { ...oats(), id: '' })
  check('a meal is given a real id when the editor did not supply one', /^meal_/.test(days[0].meals[0].id), true)

  const patched = patchMeal(days, DAY, days[0].meals[0].id, { done: true })
  check('patching a meal marks it eaten', patched[0].meals[0].done, true)
  check('and keeps its foods', patched[0].meals[0].items.length, 2)

  const kept = patchMeal(patched, DAY, 'no-such-meal', { done: true })
  check('patching an unknown meal leaves the day alone', kept[0].meals.length, 1)

  check('deleting a meal', dropMeal(patched, DAY, days[0].meals[0].id)[0].meals.length, 0)
  check(
    'deleting on another day leaves this one intact',
    dropMeal(patched, '2026-10-02', days[0].meals[0].id),
    patched,
  )
}

check('a day with a meal has data', dayHasData({ date: DAY, meals: [oats()], waterMl: 0 }), true)
check('a day with only a drink has data', dayHasData({ date: DAY, meals: [], waterMl: 100 }), true)
check('an empty day does not', dayHasData({ date: DAY, meals: [], waterMl: 0 }), false)

/* ── Totals ───────────────────────────────────────────────────────────────── */

group('Macro totals')

check(
  'two foods add up',
  sumMacros(oats().items),
  { kcal: 750, protein: 47, carbs: 96, fat: 17 },
)
check('a day with no foods totals zero', sumMacros([]), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
check('missing fields read as zero, not NaN', sumMacros([{ kcal: 100 }]), {
  kcal: 100,
  protein: 0,
  carbs: 0,
  fat: 0,
})

/* ── Targets are derived from the profile, not invented ────────────────────── */

group('Targets come from the profile')

{
  const profile = {
    onboarded: true,
    onboardedAt: 0,
    sex: 'male',
    heightCm: 178,
    weightKg: 74,
    age: 32,
    goals: ['strength'],
    level: 'intermediate',
    pullUpAbility: 'multiple',
    equipment: [],
    daysPerWeek: 4,
    preferredDays: [],
    sessionMinutes: 45,
    mealsPerDay: 4,
    likedFoods: '',
    dislikedFoods: '',
    allergies: '',
    diet: 'omnivore',
    unit: 'kg',
    theme: 'dark',
  }

  // Mifflin-St Jeor: 10*74 + 6.25*178 - 5*32 + 5 = 1697.5
  check('resting energy matches Mifflin-St Jeor', restingEnergy(profile), 1697.5)
  // 1697.5 * 1.55 (four days a week) + 100 (strength) = 2731.1 -> 2730
  const targets = autoTargets(profile)
  check('calories = maintenance + the goal adjustment', targets.kcal, 2730)
  check('protein = 1.8 g/kg of the user\'s own weight', targets.protein, 133)
  check('fat is 28% of calories', targets.fat, Math.round((2730 * 0.28) / 9))
  check('carbs fill the remainder', targets.carbs, Math.round((2730 - 133 * 4 - 85 * 9) / 4))
  check('water scales with weight and training', targets.waterMl, Math.round(74 * 33 + 4 * 150))
  check('auto is on, so the profile keeps driving the numbers', targets.auto, true)

  check(
    'a cutting goal lowers calories',
    autoTargets({ ...profile, goals: ['lose-weight'] }).kcal,
    Math.round((1697.5 * 1.55 - 400) / 10) * 10,
  )
  check(
    'a heavier user gets more protein',
    autoTargets({ ...profile, weightKg: 90 }).protein,
    162,
  )
  check(
    'training more often raises calories',
    autoTargets({ ...profile, daysPerWeek: 6 }).kcal > autoTargets({ ...profile, daysPerWeek: 2 }).kcal,
    true,
  )
  check('a missing profile still produces usable targets', autoTargets(null).kcal > 0, true)
  check('and a floor under calories', autoTargets({ ...profile, age: 90, weightKg: 40 }).kcal >= 1400, true)
}

console.log(
  failures === 0
    ? '\nAll nutrition flow checks passed.'
    : `\n${failures} nutrition check(s) FAILED.`,
)
process.exit(failures === 0 ? 0 : 1)