/**
 * Checks that stored data cannot break the app.
 *
 * Everything in this app lives in localStorage and nowhere else: there is no
 * server copy to fall back to and no account to re-sync from. So a value that
 * does not fit the shape the screen renders is not a cosmetic problem — it is an
 * unhandled render error and a blank window the user cannot get out of.
 *
 * Real ways that happens, all of which are exercised below:
 *
 *   - a build that renames or adds a field, and data written by the build before
 *   - an exercise removed or renamed in a later build, leaving a stored id that
 *     this build's catalogue has no entry for
 *   - an imported or hand-edited backup
 *   - a half-written value from another tab
 *
 * Two halves are checked, matching the two halves of the fix:
 *
 *   1. **Guarded lookups** — `labels.ts`. A taxonomy id this build has no entry
 *      for must render as "Unknown" with no colour, and must never be `undefined`
 *      where the caller reaches for `.label`.
 *   2. **Repair** — `repair.ts`. Every stored key gets fitted back into its
 *      shape: unrecognised *settings* fall back to a real value, and the user's
 *      own *records* keep their unrecognised ids, because a session or a PR that
 *      was honestly logged is not something to throw away.
 *
 * The section at the end throws every hostile shape at every reviver at once,
 * which is the test that actually matters: getting this wrong is silent, because
 * a key that reads back empty looks exactly like a key that was never written.
 *
 * No browser, no timers, no clock dependence. Dates are given as literals.
 */
import { CORE_EXERCISES } from './src/data/core.ts'
import { LEG_EXERCISES } from './src/data/legs.ts'
import { PULL_EXERCISES } from './src/data/pull.ts'
import { PUSH_EXERCISES } from './src/data/push.ts'
import { SKILL_EXERCISES } from './src/data/skills.ts'
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  EQUIPMENT,
  EQUIPMENT_ORDER,
  MOVEMENTS,
  MOVEMENT_ORDER,
  MUSCLES,
  MUSCLE_ACCENT,
  MUSCLE_ORDER,
} from './src/data/taxonomy.ts'
import { toDateKey } from './src/lib/dates.ts'
import {
  UNKNOWN_LABEL,
  difficultyLabel,
  difficultyMeta,
  equipmentLabel,
  equipmentMeta,
  movementLabel,
  movementMeta,
  muscleAccent,
  muscleLabel,
  muscleMeta,
} from './src/lib/labels.ts'
import {
  DAY_NAME_LIST,
  DIETS,
  EQUIPMENT_IDS,
  RECORD_METRICS,
  SESSION_STATUSES,
  SET_STATUSES,
  reviveActiveSessionId,
  reviveDismissed,
  reviveIds,
  reviveLevels,
  reviveNutritionDays,
  reviveNutritionTargets,
  reviveProfile,
  reviveRecords,
  reviveSessions,
  reviveSkillProgress,
  reviveTheme,
  reviveWeightEntries,
  reviveWorkouts,
  isDateKey,
  isDifficulty,
} from './src/lib/repair.ts'
import { autoTargets, restingEnergy, sumMacros } from './src/lib/nutrition-targets.ts'
import { reconcile } from './src/lib/reconcile.ts'

const EXERCISES = [
  ...PUSH_EXERCISES,
  ...PULL_EXERCISES,
  ...LEG_EXERCISES,
  ...CORE_EXERCISES,
  ...SKILL_EXERCISES,
]

/* ── Harness ───────────────────────────────────────────────────────────── */

let failures = 0
let passes = 0

function group(name) {
  console.log(`\n${name}`)
}

function ok(label) {
  passes += 1
  console.log(`  ok    ${label}`)
}

function fail(label, detail) {
  failures += 1
  console.log(`  FAIL  ${label}`)
  console.log(`          ${detail}`)
}

function check(label, condition, detail = '') {
  if (condition) ok(label)
  else fail(label, detail || 'expected true')
}

function eq(label, actual, expected) {
  const same = JSON.stringify(actual) === JSON.stringify(expected)
  if (same) ok(label)
  else fail(label, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

/** Runs `fn` and reports the throw as a failure rather than ending the run. */
function survives(label, fn) {
  try {
    const value = fn()
    ok(label)
    return value
  } catch (error) {
    fail(label, `threw ${error && error.message ? error.message : error}`)
    return undefined
  }
}

const PROFILE_DEFAULT = {
  onboarded: false,
  onboardedAt: 0,
  sex: 'undisclosed',
  goals: [],
  level: 'beginner',
  pullUpAbility: 'none',
  equipment: ['none'],
  daysPerWeek: 3,
  preferredDays: [],
  sessionMinutes: 45,
  mealsPerDay: 3,
  likedFoods: '',
  dislikedFoods: '',
  allergies: '',
  diet: 'omnivore',
  unit: 'kg',
  theme: 'dark',
}

const TARGETS_DEFAULT = {
  kcal: 2200,
  protein: 140,
  carbs: 220,
  fat: 70,
  waterMl: 2500,
  auto: true,
}

/* ── 1. Guarded lookups ────────────────────────────────────────────────── */

group('Taxonomy lookups never return nothing')

for (const muscle of MUSCLE_ORDER) {
  const meta = muscleMeta(muscle)
  const okAll = typeof meta?.label === 'string' && meta.label.length > 0
  if (!okAll) fail(`${muscle} has a label`, JSON.stringify(meta))
}
ok(`all ${MUSCLE_ORDER.length} muscles resolve`)

for (const item of EQUIPMENT_ORDER) {
  if (typeof equipmentMeta(item)?.label !== 'string') fail(`${item} has a label`)
}
ok(`all ${EQUIPMENT_ORDER.length} equipment entries resolve`)

for (const movement of MOVEMENT_ORDER) {
  if (typeof movementMeta(movement)?.label !== 'string') fail(`${movement} has a label`)
}
ok(`all ${MOVEMENT_ORDER.length} movements resolve`)

for (const level of DIFFICULTY_ORDER) {
  const meta = difficultyMeta(level)
  if (!meta || !meta.chip || !meta.dot || !meta.text || !meta.indicator) {
    fail(`${level} has its presentational classes`, JSON.stringify(meta))
  }
}
ok(`all ${DIFFICULTY_ORDER.length} difficulties render`)

group('An unknown id reads as unknown rather than throwing')

const UNKNOWN_IDS = [
  'sauna',
  'Triceps',
  '',
  'chest ',
  '__proto__',
  'constructor',
  'toString',
  'hasOwnProperty',
  '../../etc/passwd',
  '💪',
]

for (const id of UNKNOWN_IDS) {
  const meta = muscleMeta(id)
  const label = muscleLabel(id)
  const accent = muscleAccent(id)
  const good =
    label === UNKNOWN_LABEL &&
    typeof meta?.label === 'string' &&
    typeof accent?.chip === 'string' &&
    accent.chip.length > 0 &&
    typeof accent.bar === 'string' &&
    !accent.chip.includes('acc-')
  if (!good) fail(`muscle ${JSON.stringify(id)}`, JSON.stringify({ label, accent }))
}
ok(`all ${UNKNOWN_IDS.length} unknown muscle ids fall back to a neutral label`)

eq('an unknown equipment id is Unknown', equipmentLabel('sauna'), UNKNOWN_LABEL)
eq('an unknown movement id is Unknown', movementLabel('telekinesis'), UNKNOWN_LABEL)
eq('an unknown difficulty id is Unknown', difficultyLabel('expert'), UNKNOWN_LABEL)

const unknownDifficulty = difficultyMeta('expert')
check(
  'an unknown difficulty still carries the classes a badge renders',
  typeof unknownDifficulty.chip === 'string' &&
    unknownDifficulty.chip.length > 0 &&
    typeof unknownDifficulty.dot === 'string' &&
    unknownDifficulty.dot.length > 0 &&
    typeof unknownDifficulty.indicator === 'string' &&
    unknownDifficulty.indicator.length > 0,
  JSON.stringify(unknownDifficulty),
)

check(
  "an inherited Object key is not read out of the table",
  muscleLabel('toString') === UNKNOWN_LABEL && equipmentLabel('constructor') === UNKNOWN_LABEL,
)

survives('a non-string muscle id does not throw', () => muscleLabel(undefined))
survives('a null equipment id does not throw', () => equipmentLabel(null))
survives('an object difficulty id does not throw', () => difficultyLabel({ level: 'advanced' }))
survives('an array muscle id does not throw', () => muscleLabel(['chest']))
survives('a number muscle id does not throw', () => muscleLabel(7))

group('The fallbacks invent nothing')

check(
  'no fallback carries a muscle colour',
  !muscleAccent('sauna').chip.includes('acc-') &&
    !muscleAccent('sauna').bar.includes('acc-') &&
    !muscleAccent('sauna').text.includes('acc-'),
  JSON.stringify(muscleAccent('sauna')),
)

check(
  'an unknown difficulty has no progress dots claiming a level',
  difficultyMeta('expert').indicator === '·',
  JSON.stringify(difficultyMeta('expert').indicator),
)

eq('the fallback label is the same word everywhere', UNKNOWN_LABEL, 'Unknown')

/* ── 2. The catalogue agrees with its own taxonomy ─────────────────────── */

group('Every catalogue entry resolves through the guarded lookups')

let muscleProblems = 0
let equipmentProblems = 0
let movementProblems = 0
let difficultyProblems = 0

for (const exercise of EXERCISES) {
  if (muscleMeta(exercise.mainMuscle).label === UNKNOWN_LABEL) muscleProblems += 1
  for (const muscle of exercise.secondaryMuscles ?? []) {
    if (muscleMeta(muscle).label === UNKNOWN_LABEL) muscleProblems += 1
  }
  for (const item of exercise.equipment ?? []) {
    if (equipmentMeta(item).label === UNKNOWN_LABEL) equipmentProblems += 1
  }
  if (movementMeta(exercise.movement).label === UNKNOWN_LABEL) movementProblems += 1
  if (difficultyMeta(exercise.difficulty).label === UNKNOWN_LABEL) difficultyProblems += 1
}

check('every main and secondary muscle is in the taxonomy', muscleProblems === 0, `${muscleProblems} unknown`)
check('every equipment entry is in the taxonomy', equipmentProblems === 0, `${equipmentProblems} unknown`)
check('every movement is in the taxonomy', movementProblems === 0, `${movementProblems} unknown`)
check('every difficulty is in the taxonomy', difficultyProblems === 0, `${difficultyProblems} unknown`)

const taxonomyProblems = []
for (const muscle of MUSCLE_ORDER) {
  if (!MUSCLES[muscle]) taxonomyProblems.push(`muscles.${muscle}`)
  if (!MUSCLE_ACCENT[muscle]) taxonomyProblems.push(`accent.${muscle}`)
}
for (const item of EQUIPMENT_ORDER) if (!EQUIPMENT[item]) taxonomyProblems.push(`equipment.${item}`)
for (const movement of MOVEMENT_ORDER) if (!MOVEMENTS[movement]) taxonomyProblems.push(`movement.${movement}`)
for (const level of DIFFICULTY_ORDER) if (!DIFFICULTIES[level]) taxonomyProblems.push(`difficulty.${level}`)
eq('every order entry has its table entry', taxonomyProblems, [])

const dupes = EXERCISES.map((e) => e.id).filter((id, i, all) => all.indexOf(id) !== i)
eq('exercise ids are unique', dupes, [])

/* ── 3. Profile ────────────────────────────────────────────────────────── */

group('A profile survives anything')

for (const junk of [null, undefined, 42, 'nope', [], true, () => {}]) {
  survives(`a profile stored as ${describe(junk)} still reads`, () =>
    reviveProfile(junk, PROFILE_DEFAULT),
  )
}

eq('nothing stored gives the defaults', reviveProfile(undefined, PROFILE_DEFAULT), PROFILE_DEFAULT)

const partial = reviveProfile({ name: 'Sam', onboarded: true }, PROFILE_DEFAULT)
eq('a profile missing every field keeps the defaults', {
  name: partial.name,
  sex: partial.sex,
  level: partial.level,
  equipment: partial.equipment,
  daysPerWeek: partial.daysPerWeek,
  sessionMinutes: partial.sessionMinutes,
  mealsPerDay: partial.mealsPerDay,
  diet: partial.diet,
  unit: partial.unit,
  theme: partial.theme,
}, {
  name: 'Sam',
  sex: 'undisclosed',
  level: 'beginner',
  equipment: ['none'],
  daysPerWeek: 3,
  sessionMinutes: 45,
  mealsPerDay: 3,
  diet: 'omnivore',
  unit: 'kg',
  theme: 'dark',
})

eq(
  'an unknown equipment id is dropped from the kit',
  reviveProfile({ equipment: ['floor', 'sauna', 'rings'] }, PROFILE_DEFAULT).equipment,
  ['floor', 'rings'],
)
eq(
  'a kit written as a bare string is read as one item',
  reviveProfile({ equipment: 'pull-up-bar' }, PROFILE_DEFAULT).equipment,
  ['pull-up-bar'],
)
eq(
  'a kit written as an object is not an array',
  reviveProfile({ equipment: { 0: 'floor' } }, PROFILE_DEFAULT).equipment,
  [],
)
eq(
  'non-string kit entries are dropped',
  reviveProfile({ equipment: ['floor', 3, null, { a: 1 }, ['bars']] }, PROFILE_DEFAULT).equipment,
  ['floor'],
)
eq(
  'a repeated kit entry is stored once',
  reviveProfile({ equipment: ['floor', 'floor', 'rings'] }, PROFILE_DEFAULT).equipment,
  ['floor', 'rings'],
)

eq(
  'an unknown preferred day is dropped and the rest kept',
  reviveProfile({ preferredDays: ['Monday', 'Someday', 3, 'Friday'] }, PROFILE_DEFAULT).preferredDays,
  ['Monday', 'Friday'],
)
eq(
  'preferred days written as a bare string are read as one day',
  reviveProfile({ preferredDays: 'Wednesday' }, PROFILE_DEFAULT).preferredDays,
  ['Wednesday'],
)
eq(
  'an unknown goal is dropped',
  reviveProfile({ goals: ['strength', 'get-buff', 'skills'] }, PROFILE_DEFAULT).goals,
  ['strength', 'skills'],
)

const junkEnums = reviveProfile(
  {
    sex: 'robot',
    level: 'expert',
    pullUpAbility: 'inverted',
    diet: 'keto',
    unit: 'stone',
    theme: 'neon',
  },
  PROFILE_DEFAULT,
)
eq('an unknown sex falls back', junkEnums.sex, 'undisclosed')
eq('an unknown declared level falls back', junkEnums.level, 'beginner')
eq('an unknown pull-up ability falls back', junkEnums.pullUpAbility, 'none')
eq('an unknown diet falls back', junkEnums.diet, 'omnivore')
eq('an unknown unit falls back', junkEnums.unit, 'kg')
eq('an unknown theme falls back', junkEnums.theme, 'dark')

eq(
  'a missing optional number is absent, not NaN',
  reviveProfile({}, PROFILE_DEFAULT).age,
  undefined,
)
eq(
  'a string where a number belongs does not become NaN',
  reviveProfile({ age: 'thirty', maxPullups: 'lots' }, PROFILE_DEFAULT).maxPullups,
  undefined,
)
eq(
  'a quoted number is read as the number it quotes',
  reviveProfile({ age: '30' }, PROFILE_DEFAULT).age,
  30,
)
check(
  'every numeric profile field is finite',
  [
    'onboardedAt', 'age', 'heightCm', 'weightKg', 'maxPushups', 'maxDips', 'maxSquats',
    'maxPullups', 'daysPerWeek', 'sessionMinutes', 'mealsPerDay', 'foodBudget',
  ].every((field) => {
    const value = reviveProfile({ [field]: 'x' }, PROFILE_DEFAULT)[field]
    return typeof value !== 'number' || Number.isFinite(value)
  }),
)

eq(
  'free-text fields keep their string',
  reviveProfile({ likedFoods: 'olives', allergies: 7 }, PROFILE_DEFAULT).likedFoods,
  'olives',
)
eq('a non-string note is not a note', reviveProfile({ allergies: 7 }, PROFILE_DEFAULT).allergies, '')

group('A repaired profile still drives the nutrition maths')

const repaired = reviveProfile(
  { sex: 'robot', diet: 'keto', weightKg: 'nonsense', goals: 'strength', age: 200 },
  PROFILE_DEFAULT,
)
const targets = survives('targets come out of a repaired profile', () => autoTargets(repaired))
if (targets) {
  check(
    'every target is a finite positive number',
    [targets.kcal, targets.protein, targets.carbs, targets.fat, targets.waterMl].every(
      (value) => Number.isFinite(value) && value > 0,
    ),
    JSON.stringify(targets),
  )
}
check('resting energy is finite on a repaired profile', Number.isFinite(restingEnergy(repaired)))
check('resting energy is finite on no profile at all', Number.isFinite(restingEnergy(null)))

/* ── 4. Workouts ───────────────────────────────────────────────────────── */

group('A workout survives anything')

survives('a workouts key stored as an object', () => reviveWorkouts({ a: 1 }))
survives('a workouts key stored as a string', () => reviveWorkouts('[]'))
eq('a non-array gives no workouts', reviveWorkouts(null), [])
eq('entries that are not objects are dropped', reviveWorkouts([null, 42, 'x', undefined]), [])

const workout = reviveWorkouts([
  {
    id: 'w1',
    name: 'Push A',
    items: [
      { id: 'i1', exerciseId: 'push-ups', sets: 3, restSec: 90 },
      { id: 'i2', exerciseId: 'deleted-exercise', sets: '4', restSec: 60 },
      { id: 'i3', exerciseId: 'also-gone', sets: 2 },
      { id: 'i4', sets: 5 },
    ],
  },
])[0]

eq('the workout itself is kept', workout.name, 'Push A')
eq('an unknown exercise id is kept, not dropped', workout.items.length, 3)
eq(
  'every kept item still names its exercise',
  workout.items.map((item) => item.exerciseId),
  ['push-ups', 'deleted-exercise', 'also-gone'],
)
eq('an item with no exercise id is dropped', workout.items.filter((i) => !i.exerciseId).length, 0)
eq('a quoted set count is read as a number', workout.items[1].sets, 4)
eq('missing fields fall back', workout.items[2].restSec, 0)
eq('a missing name gets one', reviveWorkouts([{}])[0].name, 'Workout')
eq('a missing item list is an empty list', reviveWorkouts([{}])[0].items, [])
eq('missing timestamps are zero, not NaN', reviveWorkouts([{}])[0].updatedAt, 0)

const negative = reviveWorkouts([{ items: [{ exerciseId: 'a', sets: -5, restSec: -90 }] }])[0]
eq('a negative set count is floored at zero', negative.items[0].sets, 0)
eq('a negative rest is floored at zero', negative.items[0].restSec, 0)

/* ── 5. Sessions ───────────────────────────────────────────────────────── */

group('A session survives anything')

survives('a sessions key stored as a number', () => reviveSessions(7))
eq('a non-array gives no sessions', reviveSessions('nope'), [])
eq('entries that are not objects are dropped', reviveSessions([null, 0, '']), [])

const EPOCH = Date.UTC(2026, 2, 12, 23, 30)
const session = reviveSessions([
  { id: 's1', workoutName: 'Pull', date: '2026-03-12', startedAt: EPOCH, status: 'completed' },
])[0]
eq('a good session is untouched', session.date, '2026-03-12')
eq('its status is untouched', session.status, 'completed')

/*
 * An exercise id this build does not have is a line nothing can render: no
 * name, no prescription, no way to tick it off. Left in, it still counted
 * towards `targetSets`, so a workout or session carried over from a build that
 * renamed an exercise advertised more sets than it could ever deliver — and the
 * session could never be completed, only ever "partial". `store.ts` hands over
 * the real catalogue; on its own a reviver has none, so it keeps everything.
 */
const KNOWN = new Set(['push-ups', 'dips'])
const GHOST_ITEM = {
  id: 'a',
  exerciseId: 'renamed-away',
  targetSets: 3,
  sets: [{ status: 'done' }, { status: 'done' }, { status: 'done' }],
  status: 'completed',
}

eq(
  'with no catalogue to check against, an unknown exercise id is kept',
  reviveSessions([
    { id: 's2', date: '2026-03-12', startedAt: EPOCH, items: [GHOST_ITEM] },
  ])[0].items.length,
  1,
)

const knownSession = reviveSessions(
  [{ id: 's2', date: '2026-03-12', startedAt: EPOCH, items: [{ ...GHOST_ITEM, exerciseId: 'push-ups' }, GHOST_ITEM] }],
  KNOWN,
)
eq('a session line this build cannot render is dropped', knownSession[0].items.length, 1)
eq('and the line it can render stays', knownSession[0].items[0].exerciseId, 'push-ups')
eq(
  'so the sets it counts are only the ones the user can tick',
  knownSession[0].items.reduce((sum, item) => sum + item.targetSets, 0),
  3,
)

const knownWorkout = reviveWorkouts(
  [{ id: 'w1', name: 'A', items: [{ exerciseId: 'dips', sets: 3, restSec: 90 }, { exerciseId: 'renamed-away', sets: 4 }] }],
  KNOWN,
)
eq('a workout line this build cannot render is dropped', knownWorkout[0].items.length, 1)
eq(
  'so the set count on the card matches the lines shown',
  knownWorkout[0].items.reduce((sum, item) => sum + item.sets, 0),
  3,
)
eq(
  'and a real catalogue changes nothing else about the workout',
  reviveWorkouts([{ id: 'w1', name: 'A', items: [{ exerciseId: 'dips', sets: 3, restSec: 90 }] }], KNOWN)[0].items[0]
    .restSec,
  90,
)
eq(
  'a workout whose every line is unknown survives as an empty workout, not a lost one',
  reviveWorkouts([{ id: 'w2', name: 'Old', items: [{ exerciseId: 'gone', sets: 4 }] }], KNOWN).map((w) => w.name),
  ['Old'],
)

eq(
  'an unreadable date is taken from the instant it was started',
  reviveSessions([{ id: 's3', startedAt: EPOCH, status: 'completed' }])[0].date,
  toDateKey(new Date(EPOCH)),
)
eq(
  'a day that does not exist is not a date',
  reviveSessions([{ id: 's4', date: '2026-02-31', startedAt: EPOCH }])[0].date,
  toDateKey(new Date(EPOCH)),
)
eq(
  'a session with neither a date nor an instant is dropped',
  reviveSessions([{ id: 's5', date: 'yesterday' }]).length,
  0,
)
eq(
  'a session with an impossible instant is dropped',
  reviveSessions([{ id: 's6', date: 'soon', startedAt: 'later' }]).length,
  0,
)

const oddSession = reviveSessions([
  {
    id: 's7',
    date: '2026-03-12',
    startedAt: EPOCH,
    status: 'teleported',
    workoutName: null,
    items: [
      { id: 'i1', exerciseId: 'pull-ups', targetSets: '3', status: 'vibing', sets: 'nope' },
      { id: 'i2', exerciseId: 'pull-ups', targetSets: 2, status: 'completed', sets: [null, 'x', { reps: 10 }] },
      null,
    ],
  },
])[0]

eq('an unknown session status is treated as planned', oddSession.status, 'planned')
eq('a missing workout name gets one', oddSession.workoutName, 'Session')
eq('a quoted target is a number', oddSession.items[0].targetSets, 3)
eq('an unknown item status is not started', oddSession.items[0].status, 'not-started')
eq('sets that are not objects are dropped, real ones kept', oddSession.items[1].sets.length, 1)
eq('a kept set still has a status', oddSession.items[1].sets[0].status, 'pending')
eq('an item that is not an object is dropped', oddSession.items.length, 2)

for (const status of SESSION_STATUSES) {
  if (reviveSessions([{ id: 'x', date: '2026-03-12', status }])[0].status !== status) {
    fail(`session status ${status} survives`)
  }
}
ok('every real session status survives')

eq(
  'every logged set has a status that a day can be judged on',
  reviveSessions([
    {
      id: 's8',
      date: '2026-03-12',
      items: [{ id: 'i', exerciseId: 'a', sets: [{ status: 'invented' }] }],
    },
  ])[0].items[0].sets[0].status,
  SET_STATUSES[0],
)

/* ── 6. Records ────────────────────────────────────────────────────────── */

group('A record survives anything')

survives('a records key stored as a string', () => reviveRecords('{}'))
eq('a non-array gives no records', reviveRecords(null), [])
eq('entries that are not objects are dropped', reviveRecords([null, 1, 'x']), [])

const records = reviveRecords([
  { id: 'r1', exerciseId: 'pull-ups', metric: 'reps', value: 12, achievedAt: EPOCH },
  { id: 'r2', exerciseId: 'gone-away', metric: 'wingspan', value: 5, achievedAt: EPOCH },
  { id: 'r3', exerciseId: 'pull-ups', metric: null, value: null, achievedAt: 'soon' },
  { id: 'r4', metric: 'hold', value: 30, achievedAt: EPOCH },
])
eq('every record naming an exercise is kept', records.length, 3)
eq('an unknown exercise id is kept', records[1].exerciseId, 'gone-away')
eq('an unknown metric is kept, so the PR is not thrown away', records[1].metric, 'wingspan')
check(
  'a kept unknown metric is one the records screen can label or degrade',
  !RECORD_METRICS.includes(records[1].metric),
)
eq('a missing metric becomes a real one', records[2].metric, 'reps')
eq('a missing value reads as zero, not NaN', records[2].value, 0)
eq('an unreadable timestamp reads as zero, not NaN', records[2].achievedAt, 0)
eq('a record with no exercise id is dropped', records.filter((r) => !r.exerciseId).length, 0)

check(
  'every record value is a finite number',
  reviveRecords([
    { exerciseId: 'a', value: 'lots' },
    { exerciseId: 'b', value: Infinity },
    { exerciseId: 'c', value: -Infinity },
    { exerciseId: 'd', value: NaN },
  ]).every((entry) => Number.isFinite(entry.value)),
)

/* ── 7. Skills, levels, dismissals, saved ids, small keys ──────────────── */

group('Small keys survive anything')

eq('an unknown level override is dropped, not defaulted', reviveLevels({ 'push-ups': 'expert' }), {})
eq('a real level override is kept', reviveLevels({ 'push-ups': 'advanced' }), {
  'push-ups': 'advanced',
})
eq('the good overrides survive alongside a bad one', reviveLevels({ a: 'beginner', b: 5, c: 'zzz' }), {
  a: 'beginner',
})
survives('levels stored as an array', () => reviveLevels([1, 2, 3]))
eq('levels stored as an array give nothing', reviveLevels([1, 2, 3]), {})
survives('levels stored as a string', () => reviveLevels('nope'))
eq('levels stored as a string give nothing', reviveLevels('nope'), {})

eq('a dismissal without a timestamp is dropped', reviveDismissed({ 'a:b': 'yesterday' }), {})
eq('a real dismissal is kept', reviveDismissed({ 'a:b': 1772000000000 }), { 'a:b': 1772000000000 })

const skills = reviveSkillProgress([
  { skillId: 'muscle-up', stageExerciseId: 'chest-to-bar', updatedAt: 1 },
  { skillId: 'muscle-up', stageExerciseId: 'removed-rung', updatedAt: 2 },
  { skillId: 'muscle-up', updatedAt: 3 },
  { stageExerciseId: 'chest-to-bar' },
])
eq('a rung this build does not know is kept', skills[1].stageExerciseId, 'removed-rung')
eq('a skill with no stage is dropped, because there is nothing to show', skills.length, 2)

eq('saved ids drop what is not an id', reviveIds(['push-ups', 3, null, { a: 1 }, 'pull-ups']), [
  'push-ups',
  'pull-ups',
])
eq('saved ids are stored once', reviveIds(['a', 'a', 'b']), ['a', 'b'])
survives('saved ids stored as an object', () => reviveIds({ a: 1 }))
eq('saved ids stored as a lone string are that one id', reviveIds('pull-ups'), ['pull-ups'])
eq('saved ids stored as an empty string are no ids', reviveIds(''), [])

/*
 * The reviver has to run *ahead* of `reconcile` for that to reach the user's
 * saved list. `reconcile` holds a stored value to the container it expects, so a
 * lone string against an array fallback is replaced by an empty array before a
 * reviver behind it could ever look. `store.ts` is not importable here — it
 * needs `window` — so the composition is asserted directly against the two
 * halves, which is the part that can silently regress.
 */
function fitLikeStore(key, raw, fallback, fit) {
  return fit ? fit(raw) : reconcile(raw, fallback)
}

eq(
  'a lone string survives the real storage boundary, not just the reviver',
  fitLikeStore('my-exercises', 'pull-ups', [], reviveIds),
  ['pull-ups'],
)
eq(
  'and a whole array does too',
  fitLikeStore('workouts', [{ name: 'A', items: [] }], [], reviveWorkouts),
  [{ id: 'w_0', name: 'A', items: [], createdAt: 0, updatedAt: 0 }],
)
eq(
  'a lone string for a key of records is still not a workout',
  fitLikeStore('workouts', 'Push A', [], reviveWorkouts),
  [],
)
eq(
  'a key with no reviver still gets the generic container check',
  fitLikeStore('some-other-key', 'nope', [], null),
  [],
)

eq('an unknown theme falls back', reviveTheme('neon', 'dark'), 'dark')
eq('a real theme is kept', reviveTheme('light', 'dark'), 'light')
survives('theme stored as an object', () => reviveTheme({}, 'dark'))
eq('theme stored as an object falls back', reviveTheme({}, 'dark'), 'dark')

eq('a session id that is not a string is no pointer', reviveActiveSessionId(42), null)
eq('an empty session id is no pointer', reviveActiveSessionId(''), null)
eq('a real session id is kept', reviveActiveSessionId('s_abc'), 's_abc')

/* ── 8. Nutrition and weight ───────────────────────────────────────────── */

group('A nutrition day survives anything')

survives('a nutrition key stored as a number', () => reviveNutritionDays(3))
eq('a non-array gives no days', reviveNutritionDays(null), [])
eq('a day with no usable date is dropped', reviveNutritionDays([{ waterMl: 500 }]), [])
eq('a day that does not exist is dropped', reviveNutritionDays([{ date: '2026-02-31' }]), [])

const legacy = reviveNutritionDays([{ date: '2026-03-10', waterMl: 1000 }])[0]
eq('a day written before drinks were logged keeps its total', legacy.waterMl, 1000)
check('and does not invent drinks it never had', legacy.water === undefined)

const logged = reviveNutritionDays([
  {
    date: '2026-03-11',
    waterMl: 9999,
    water: [
      { id: 'w1', ml: 250, at: 1 },
      { id: 'w2', ml: 500, at: 2 },
    ],
    meals: [
      { id: 'm1', slot: 'brunch', name: 'Anything', done: 'yes', items: [{ id: 'f1', name: 'Eggs' }] },
      null,
    ],
  },
])[0]
eq('the total is settled from the drinks, not the stale total', logged.waterMl, 750)
eq('an unknown meal slot becomes "other"', logged.meals[0].slot, 'other')
eq('a meal that is not an object is dropped', logged.meals.length, 1)
eq('a food with no macros totals zero rather than NaN', sumMacros(logged.meals[0].items).kcal, 0)
eq('a day with no note has none', logged.note, undefined)

const negativeWater = reviveNutritionDays([
  { date: '2026-03-11', water: [{ id: 'w', ml: -500, at: 1 }] },
])[0]
eq('a negative total is floored at zero', negativeWater.waterMl, 0)
eq(
  'a drink with no amount is not counted',
  reviveNutritionDays([
    { date: '2026-03-11', waterMl: 600, water: [{ id: 'w', at: 1 }] },
  ])[0].waterMl,
  600,
)

group('Nutrition targets survive anything')

survives('targets stored as an array', () => reviveNutritionTargets([1, 2], TARGETS_DEFAULT))
eq('targets stored as an array give the defaults', reviveNutritionTargets([1, 2], TARGETS_DEFAULT), {
  ...TARGETS_DEFAULT,
})
const messyTargets = reviveNutritionTargets(
  { kcal: 'lots', protein: null, carbs: Infinity, fat: 'many', waterMl: -1, auto: 'yes' },
  TARGETS_DEFAULT,
)
check(
  'every target is finite, whatever nonsense it was stored with',
  [messyTargets.kcal, messyTargets.protein, messyTargets.carbs, messyTargets.fat, messyTargets.waterMl].every(
    Number.isFinite,
  ),
  JSON.stringify(messyTargets),
)
eq('a quoted target is a number', reviveNutritionTargets({ kcal: '1800' }, TARGETS_DEFAULT).kcal, 1800)
eq('a non-boolean auto keeps the default', reviveNutritionTargets({ auto: 'yes' }, TARGETS_DEFAULT).auto, true)

group('A weight entry survives anything')

eq('a non-array gives no entries', reviveWeightEntries(null), [])
eq('an entry with no usable date is dropped', reviveWeightEntries([{ kg: 80 }]), [])
eq('a day that does not exist is dropped', reviveWeightEntries([{ date: '2026-02-31', kg: 80 }]), [])
eq('an entry with no weight is dropped', reviveWeightEntries([{ date: '2026-03-01' }]), [])
eq('an unweighable entry is dropped', reviveWeightEntries([{ date: '2026-03-01', kg: 'heavy' }]), [])

eq(
  'a real log is sorted oldest first, however it was stored',
  reviveWeightEntries([
    { date: '2026-03-03', kg: 79 },
    { date: '2026-03-01', kg: 81 },
    { date: '2026-03-02', kg: 80 },
  ]).map((entry) => entry.date),
  ['2026-03-01', '2026-03-02', '2026-03-03'],
)
eq(
  'two entries on one day do not double-count, and the later one wins as it would on a write',
  reviveWeightEntries([
    { date: '2026-03-01', kg: 81 },
    { date: '2026-03-01', kg: 70 },
  ]),
  [{ date: '2026-03-01', kg: 70 }],
)
eq(
  'a quoted weight is a number',
  reviveWeightEntries([{ date: '2026-03-01', kg: '81.5' }]),
  [{ date: '2026-03-01', kg: 81.5 }],
)

/* ── 9. Day keys ───────────────────────────────────────────────────────── */

group('Day keys are the one date shape the app agrees on')

for (const good of ['2026-03-12', '2024-02-29', '2000-01-01']) {
  check(`${good} is a day key`, isDateKey(good))
}
for (const bad of ['2026-13-01', '2026-00-10', '2026-02-31', '2026-2-1', '12-03-2026', '', 'today', null, 20260312, {}]) {
  check(`${JSON.stringify(bad)} is not a day key`, !isDateKey(bad))
}

check('every day name the profile can store is one the calendar knows', DAY_NAME_LIST.length === 7)
check(
  'the day names are unique',
  new Set(DAY_NAME_LIST).size === DAY_NAME_LIST.length,
)
check(
  'every equipment id in the vocabulary is one the guarded lookup knows',
  EQUIPMENT_IDS.every((item) => equipmentMeta(item).label !== UNKNOWN_LABEL),
)
check(
  'every difficulty in the vocabulary is one the guarded lookup knows',
  DIFFICULTY_ORDER.every((level) => isDifficulty(level) && difficultyLabel(level) !== UNKNOWN_LABEL),
)
check(
  'every diet has a label',
  DIETS.every((diet) => typeof diet === 'string' && diet.length > 0),
)

/* ── 9b. Instants written as ISO strings ───────────────────────────────── */

group('A date that only an instant can explain is recovered, not dropped')

// An import assembled by hand, or by anything that stringifies a Date on the way
// out, carries ISO instants where the app writes day keys and epoch numbers. The
// whole entry rides on those: a session with no readable date has nowhere to go.
const isoSessions = reviveSessions([
  {
    id: 'iso-1',
    workoutName: 'Imported',
    date: '2026-03-10T18:45:00.000Z',
    startedAt: '2026-03-10T18:45:00.000Z',
    completedAt: '2026-03-10T19:30:00.000Z',
    status: 'completed',
    items: [],
  },
])
check('a session dated by an ISO string is kept, not dropped', isoSessions.length === 1)
check(
  'and is filed under the local day the instant falls on',
  isoSessions[0]?.date === toDateKey(new Date('2026-03-10T18:45:00.000Z')),
  isoSessions[0]?.date,
)
check(
  'its instants are numbers again',
  typeof isoSessions[0]?.startedAt === 'number' &&
    isoSessions[0].startedAt === Date.parse('2026-03-10T18:45:00.000Z'),
)
check(
  'an ISO start is a usable fallback for a missing day key',
  reviveSessions([{ startedAt: '2026-03-11T07:00:00.000Z' }])[0]?.date ===
    toDateKey(new Date('2026-03-11T07:00:00.000Z')),
)

const isoRecords = reviveRecords([
  { exerciseId: 'push-ups', metric: 'reps', value: 21, achievedAt: '2026-03-10T18:45:00.000Z' },
])
check(
  'a record dated by an ISO string keeps its date',
  isoRecords[0]?.achievedAt === Date.parse('2026-03-10T18:45:00.000Z'),
  isoRecords[0]?.achievedAt,
)
check(
  'a nutrition day dated by an ISO string keeps its day',
  reviveNutritionDays([{ date: '2026-03-10T23:30:00.000Z', waterMl: 1500 }])[0]?.date ===
    toDateKey(new Date('2026-03-10T23:30:00.000Z')),
)
check(
  'a weight entry dated by an ISO string keeps its day',
  reviveWeightEntries([{ date: '2026-03-10T06:15:00.000Z', kg: 78 }])[0]?.date ===
    toDateKey(new Date('2026-03-10T06:15:00.000Z')),
)
check(
  'a drink stamped with an ISO string keeps its instant',
  reviveNutritionDays([{ date: '2026-03-10', water: [{ id: 'w', ml: 500, at: '2026-03-10T09:00:00.000Z' }] }])[0]
    ?.water?.[0]?.at === Date.parse('2026-03-10T09:00:00.000Z'),
)

// `Date.parse` rolls a day that does not exist into the next month, so an instant
// whose date part is impossible has to be refused rather than believed.
for (const rolled of ['2026-02-31T12:00:00.000Z', '2026-13-01T12:00:00.000Z', '2026-02-31']) {
  check(`${rolled} is not believed as a date`, !isDateKey(rolled))
}
check(
  'a session dated by an impossible ISO day is still dropped',
  reviveSessions([{ date: '2026-02-31T12:00:00.000Z', items: [] }]).length === 0,
)
check(
  'a nutrition day dated by an impossible ISO day is still dropped',
  reviveNutritionDays([{ date: '2026-02-31T12:00:00.000Z', waterMl: 1 }]).length === 0,
)
check(
  'an instant-shaped string with no parsable time is refused',
  reviveRecords([{ exerciseId: 'a', metric: 'reps', value: 1, achievedAt: '2026-03-10T' }])[0].achievedAt === 0,
)

/* ── 10. Every reviver, every hostile shape ────────────────────────────── */

group('No reviver throws, whatever it is handed')

/** A label for a hostile value that is safe even for the hostile ones. */
function describe(value) {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

const REPAIRED_PROFILE = PROFILE_DEFAULT
const REPAIRED_TARGETS = TARGETS_DEFAULT

const HOSTILE = [
  null,
  undefined,
  0,
  42,
  -1,
  NaN,
  Infinity,
  '',
  'garbage',
  '{"broken":',
  true,
  false,
  [],
  [null],
  [undefined],
  [{}],
  [[]],
  [{ id: {} }],
  [{ id: 'a', items: null }],
  [{ id: 'a', items: [null, 1, 'x'] }],
  [{ id: 'a', date: null, startedAt: null }],
  [{ id: 'a', sets: [{}] }],
  [{ exercises: {} }],
  { length: 3 },
  { map: 'not a function' },
  new Date(0),
  { toString: 'nope' },
  { then: 'looks like a promise' },
  Symbol.iterator ? Object.assign([], { evil: true }) : {},
  JSON.parse('{"__proto__":{"polluted":true}}'),
  ' �',
]

const REVIVERS = [
  ['reviveIds', (value) => reviveIds(value)],
  ['reviveWorkouts', (value) => reviveWorkouts(value)],
  ['reviveSessions', (value) => reviveSessions(value)],
  ['reviveRecords', (value) => reviveRecords(value)],
  ['reviveSkillProgress', (value) => reviveSkillProgress(value)],
  ['reviveLevels', (value) => reviveLevels(value)],
  ['reviveDismissed', (value) => reviveDismissed(value)],
  ['reviveNutritionDays', (value) => reviveNutritionDays(value)],
  ['reviveWeightEntries', (value) => reviveWeightEntries(value)],
  ['reviveActiveSessionId', (value) => reviveActiveSessionId(value)],
  ['reviveProfile', (value) => reviveProfile(value, REPAIRED_PROFILE)],
  ['reviveNutritionTargets', (value) => reviveNutritionTargets(value, REPAIRED_TARGETS)],
  ['reviveTheme', (value) => reviveTheme(value, 'dark')],
  ['isDateKey', (value) => isDateKey(value)],
  ['muscleLabel', (value) => muscleLabel(value)],
  ['equipmentLabel', (value) => equipmentLabel(value)],
  ['movementLabel', (value) => movementLabel(value)],
  ['difficultyLabel', (value) => difficultyLabel(value)],
  ['muscleAccent', (value) => muscleAccent(value)],
  ['difficultyMeta', (value) => difficultyMeta(value)],
  ['autoTargets', (value) => autoTargets(reviveProfile(value, REPAIRED_PROFILE))],
  ['reconcile', (value) => reconcile(value, REPAIRED_PROFILE)],
]

let hostileRuns = 0
for (const [name, fn] of REVIVERS) {
  const problems = []
  for (const hostile of HOSTILE) {
    hostileRuns += 1
    try {
      const result = fn(hostile)
      if (typeof result === 'number' && !Number.isFinite(result)) {
        problems.push(`non-finite number from ${describe(hostile)}`)
      }
    } catch (error) {
      problems.push(`${error && error.message ? error.message : error} <- ${describe(hostile)}`)
    }
  }
  if (problems.length === 0) ok(`${name} survives all ${HOSTILE.length}`)
  else fail(`${name} survives all ${HOSTILE.length}`, problems.slice(0, 3).join(' | '))
}
ok(`${hostileRuns} hostile shapes were thrown at ${REVIVERS.length} revivers`)

group('The generic safety net still holds underneath')

eq('a stored object is merged over the defaults', reconcile({ name: 'Sam' }, PROFILE_DEFAULT).name, 'Sam')
eq('a stored array is kept', reconcile([1, 2], []), [1, 2])
eq('a non-array is not mistaken for one', reconcile({ nope: 1 }, []), [])
eq('a scalar does not overwrite an object', reconcile('scalar', PROFILE_DEFAULT).diet, 'omnivore')
eq('a null pointer stays a pointer', reconcile('s_1', null), 's_1')
check('prototype pollution through a stored object is inert', ({}).polluted === undefined)

/* ── Result ────────────────────────────────────────────────────────────── */

console.log(`\n${failures === 0 ? 'All robustness checks passed.' : `${failures} robustness check(s) failed.`} (${passes} checks)`)
process.exit(failures === 0 ? 0 : 1)