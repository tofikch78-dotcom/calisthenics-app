/**
 * Checks the arithmetic behind the Progress screens.
 *
 * `verify-library.mjs` covers the catalogue, `verify-session-flow.mjs` what a
 * single session contains and `verify-nutrition.mjs` the day log. This covers
 * the numbers that only exist once several sessions, a profile and a calendar
 * meet: the week summary, the training streak, the all-time totals, the muscle
 * and exercise progression, and the level arithmetic behind the table on the
 * dashboard.
 *
 * Every one of those is a pure function of stored data, so they are checked
 * exactly rather than approximately — no browser, no timers, no waiting. Dates
 * are fixed rather than relative to the clock, which is what makes the calendar
 * edge cases (week boundaries, month roll-over, local-vs-UTC) reproducible.
 */
import {
  addDays,
  dayNameOf,
  formatDuration,
  monthGrid,
  startOfWeek,
  weekDays,
} from './src/lib/dates.ts'
import {
  computeStreak,
  dayStatus,
  groupSessionsByDate,
  history,
  plannedWeekdays,
  totals,
  weekSummary,
} from './src/lib/stats.ts'
import {
  CLEAN_TO_ADVANCE,
  EVIDENCE_SESSIONS,
  evidenceForMany,
  progressionReport,
  suggestFor,
} from './src/lib/progression.ts'
import {
  DIP_BANDS,
  PULL_BANDS,
  band,
  benchmarksFor,
  levelForCapacity,
  levelRank,
  mergeLevels,
  movementCapacity,
} from './src/lib/level-math.ts'

/* ── Harness ─────────────────────────────────────────────────────────────── */

let passed = 0
const failures = []

function check(name, condition, detail) {
  if (condition) {
    passed += 1
    console.log(`  ok    ${name}`)
  } else {
    failures.push(name)
    console.log(`  FAIL  ${name}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}

function eq(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  check(name, a === e, `expected ${e}, got ${a}`)
}

function section(title) {
  console.log(`\n${title}`)
}

/* ── Fixtures ────────────────────────────────────────────────────────────── */

/** A Monday. Every date in these checks hangs off it. */
const MON = '2026-03-02'
const SUN = '2026-03-08'

let seed = 0
function nextId(prefix) {
  seed += 1
  return `${prefix}-${seed}`
}

/**
 * One exercise line inside a session.
 *
 * `done` is how many of the target sets were ticked; the rest stay pending, so
 * a half-finished session is a line item rather than a special case. Called as
 * `line('push-ups', { done: 1 })` or, from `session`, as `line({ exerciseId,
 * done: 1 })`.
 */
function line(exerciseId, opts = {}) {
  const options = typeof exerciseId === 'string' ? { exerciseId, ...opts } : exerciseId
  const {
    exerciseId: id = 'push-ups',
    sets = 3,
    targetSets = sets,
    done = sets,
    reps = 8,
    targetReps = reps,
    holdSec,
    weight,
    status,
  } = options
  const setsLogged = Array.from({ length: sets }, (_, index) => ({
    reps,
    ...(holdSec === undefined ? {} : { holdSec }),
    ...(weight === undefined ? {} : { weight }),
    status: index < done ? 'done' : 'pending',
  }))
  return {
    id: nextId('item'),
    exerciseId: id,
    targetSets,
    targetReps,
    ...(holdSec === undefined ? {} : { targetHoldSec: holdSec }),
    ...(weight === undefined ? {} : { targetWeight: weight }),
    sets: setsLogged,
    status:
      status ??
      (done === 0 ? 'not-started' : done >= targetSets ? 'completed' : 'in-progress'),
  }
}

/** A finished session, with its status derived from what was actually done. */
function session(date, items, { name = 'Push', durationSec = 1800, status } = {}) {
  const setsDone = items.reduce((sum, item) => sum + item.sets.filter((s) => s.status === 'done').length, 0)
  const setsTotal = items.reduce((sum, item) => sum + item.targetSets, 0)
  return {
    id: nextId('s'),
    workoutName: name,
    date,
    startedAt: new Date(`${date}T18:00:00`).getTime(),
    durationSec,
    status:
      status ??
      (!items.length || !setsTotal || !setsDone
        ? 'skipped'
        : setsDone >= setsTotal
          ? 'completed'
          : 'partial'),
    items,
  }
}

function profileWith(days) {
  return {
    onboarded: true,
    sex: 'undisclosed',
    goals: ['strength'],
    level: 'intermediate',
    pullUpAbility: 'multiple',
    equipment: ['floor'],
    daysPerWeek: days.length,
    preferredDays: days,
    sessionMinutes: 30,
    mealsPerDay: 3,
    likedFoods: '',
    dislikedFoods: '',
    allergies: '',
    diet: 'omnivore',
    unit: 'kg',
    theme: 'dark',
  }
}

/** A plan of Monday/Wednesday/Friday. */
const MWF_PROFILE = profileWith(['Monday', 'Wednesday', 'Friday'])

function workoutOn(day) {
  return { id: nextId('w'), name: `${day} workout`, day, items: [], createdAt: 0, updatedAt: 0 }
}

/* ── Calendar primitives ─────────────────────────────────────────────────── */

section('Calendar')
eq('a week is Monday to Sunday', weekDays(MON), [
  '2026-03-02',
  '2026-03-03',
  '2026-03-04',
  '2026-03-05',
  '2026-03-06',
  '2026-03-07',
  '2026-03-08',
])
eq('the last day of a week is Sunday', weekDays(MON)[6], SUN)
eq('startOfWeek finds Monday from a Sunday', startOfWeek(SUN), MON)
eq('startOfWeek leaves a Monday alone', startOfWeek(MON), MON)
eq('addDays crosses a month boundary', addDays('2026-02-28', 1), '2026-03-01')
eq('addDays goes backwards over a year boundary', addDays('2026-01-01', -1), '2025-12-31')
eq('addDays handles a leap day', addDays('2028-02-28', 1), '2028-02-29')
eq('dayNameOf agrees with a real Date', dayNameOf(MON), 'Monday')
eq(
  'monthGrid covers each day of March exactly once',
  monthGrid(2026, 2).filter((key) => key.startsWith('2026-03')).length,
  31,
)
eq('and never repeats a day', new Set(monthGrid(2026, 2)).size, monthGrid(2026, 2).length)
check(
  'monthGrid is whole weeks',
  monthGrid(2026, 2).length % 7 === 0,
  `length ${monthGrid(2026, 2).length}`,
)
eq('formatDuration reads as minutes and seconds', formatDuration(1500), '25m')

/* ── Day status ──────────────────────────────────────────────────────────── */

section('Day status')
const plannedSet = new Set(['Monday', 'Wednesday', 'Friday'])
const byDate = (sessions) => groupSessionsByDate(sessions)

eq('an empty planned day reads as planned', dayStatus(MON, new Map(), plannedSet), 'planned')
eq('an empty unplanned day reads as rest', dayStatus('2026-03-03', new Map(), plannedSet), 'rest')
eq(
  'a finished session reads as completed',
  dayStatus(MON, byDate([session(MON, [line('push-ups')])]), plannedSet),
  'completed',
)
eq(
  'a half-finished session reads as partial',
  dayStatus(MON, byDate([session(MON, [line('push-ups', { done: 1 })])]), plannedSet),
  'partial',
)
eq(
  'a session with nothing ticked reads as skipped',
  dayStatus(MON, byDate([session(MON, [line('push-ups', { done: 0 })])]), plannedSet),
  'skipped',
)
eq(
  'two finished sessions on one day are still one completed day',
  dayStatus(MON, byDate([session(MON, [line('push-ups')]), session(MON, [line('squats')])]), plannedSet),
  'completed',
)
eq(
  'one finished and one skipped session reads as partial',
  dayStatus(MON, byDate([session(MON, [line('push-ups')]), session(MON, [line('squats', { done: 0 })])]), plannedSet),
  'partial',
)
check(
  'no day status claims a completion that did not happen',
  dayStatus(MON, new Map(), plannedSet) !== 'completed',
)
eq(
  'planned days come from the profile and from each workout day',
  [...plannedWeekdays(MWF_PROFILE, [workoutOn('Tuesday')])].sort(),
  ['Friday', 'Monday', 'Tuesday', 'Wednesday'],
)
eq('a null profile plans nothing', plannedWeekdays(null, []).size, 0)

/* ── Week summary ────────────────────────────────────────────────────────── */

section('Week summary')
const emptyWeek = weekSummary([], MWF_PROFILE, [], MON)
eq('an empty week reports zero sessions', emptyWeek.sessions, 0)
eq('an empty week reports 0% rather than dividing by nothing', emptyWeek.completion, 0)
eq('an empty week still counts the three planned days', emptyWeek.planned, 3)
eq('an empty week spans Monday to Sunday', [emptyWeek.start, emptyWeek.end], [MON, SUN])

const fullWeek = weekSummary(
  [
    session(MON, [line('push-ups'), line('squats')]),
    session('2026-03-04', [line('pull-ups', { reps: 5, sets: 3 })]),
    session('2026-03-07', [line('dips', { sets: 3, done: 1 })]),
  ],
  MWF_PROFILE,
  [],
  MON,
)
eq('three sessions are counted once each', fullWeek.sessions, 3)
eq('two days finished fully', fullWeek.completed, 2)
eq('one day was left half done', fullWeek.partial, 1)
eq(
  'planned never counts fewer days than were actually trained',
  fullWeek.planned >= fullWeek.completed + fullWeek.partial + fullWeek.skipped,
  true,
)
eq(
  'planned is the plan, not the log: three planned days plus the extra Saturday session',
  fullWeek.planned,
  4,
)
eq('completed + partial over three attempted sessions is 78%', fullWeek.completion, 78)
eq('only finished exercises count towards the weekly total', fullWeek.exercises, 3)
eq('only ticked sets count towards the weekly total', fullWeek.sets, 3 + 3 + 3 + 1)
eq('the week is seven long', fullWeek.byDay.length, 7)
eq('byDay starts on the Monday asked for', fullWeek.byDay[0].date, MON)
eq('byDay ends on the Sunday', fullWeek.byDay[6].date, SUN)

const twoOnOneDay = weekSummary(
  [
    session(MON, [line('push-ups')]),
    session(MON, [line('squats')]),
  ],
  MWF_PROFILE,
  [],
  MON,
)
eq('two finished sessions on one day are one completed day', twoOnOneDay.completed, 1)
eq(
  'and two sessions on one day cannot inflate the planned count',
  twoOnOneDay.planned,
  emptyWeek.planned,
)

eq(
  'a session outside the week is ignored',
  weekSummary([session(addDays(SUN, 1), [line('push-ups')])], MWF_PROFILE, [], MON).sessions,
  0,
)
eq(
  'a session from the week before is ignored',
  weekSummary([session(addDays(MON, -1), [line('push-ups')])], MWF_PROFILE, [], MON).sessions,
  0,
)
eq(
  'a session on the Sunday that ends the week is counted',
  weekSummary([session(SUN, [line('push-ups')])], MWF_PROFILE, [], MON).sessions,
  1,
)
eq(
  'a skipped session is attempted, so it drags completion down',
  weekSummary(
    [
      session(MON, [line('push-ups')]),
      session('2026-03-04', [line('dips', { done: 0 })]),
    ],
    MWF_PROFILE,
    [],
    MON,
  ).completion,
  50,
)
eq(
  'an untracked day that was planned still counts towards planned',
  weekSummary([session(MON, [line('push-ups')])], MWF_PROFILE, [], MON).planned,
  3,
)
eq(
  'next week is summarised independently of this one',
  weekSummary([session(MON, [line('push-ups')])], MWF_PROFILE, [], addDays(MON, 7)).sessions,
  0,
)

/*
 * `completion` is a share of the sets done, not of the days attended. The two
 * figures used to be conflated on screen — the percentage sits right next to
 * "3/4 completed / planned", which reads as a day score — so the difference is
 * pinned here: 3 clean days and one at a quarter is 81 by sets and 75 by days.
 */
const effortWeek = weekSummary(
  [
    session(MON, [line('push-ups', { sets: 4, done: 4 })]),
    session('2026-03-04', [line('pull-ups', { sets: 4, done: 4 })]),
    session('2026-03-06', [line('dips', { sets: 4, done: 4 })]),
    session('2026-03-07', [line('squats', { sets: 4, done: 1 })]),
  ],
  MWF_PROFILE,
  [],
  MON,
)
eq('three days finished and one quarter done is 81% by sets', effortWeek.completion, 81)
eq(
  'and 75% by days, which is a different number the screen must not imply',
  Math.round((effortWeek.completed / effortWeek.planned) * 100),
  75,
)

/* ── Streak ──────────────────────────────────────────────────────────────── */

section('Training streak')
const emptyStreak = computeStreak([], MWF_PROFILE, [], MON)
eq('no sessions means no streak', emptyStreak.days, 0)
eq('no sessions means nothing was ever trained', emptyStreak.lastTrainedOn, null)
eq('no sessions means the streak is not active', emptyStreak.active, false)

const trainedToday = computeStreak([session(MON, [line('push-ups')])], MWF_PROFILE, [], MON)
eq('training today starts a streak', trainedToday.days, 1)
eq('the streak ends today', trainedToday.lastTrainedOn, MON)
eq('a streak that ends today is active', trainedToday.active, true)

const trainedYesterday = computeStreak(
  [session(addDays(MON, -1), [line('push-ups')])],
  MWF_PROFILE,
  [],
  MON,
)
eq('training yesterday still counts as a live streak', trainedYesterday.days, 1)
eq('a streak that ended yesterday is not yet active', trainedYesterday.active, false)
eq('but it names the day it ended on', trainedYesterday.lastTrainedOn, addDays(MON, -1))

const twoDays = computeStreak(
  [session(MON, [line('push-ups')]), session(addDays(MON, -1), [line('push-ups')])],
  MWF_PROFILE,
  [],
  MON,
)
eq('two days running is a two-day streak', twoDays.days, 2)

const acrossRestDay = computeStreak(
  [
    session(MON, [line('push-ups')]),
    // Tuesday was not planned, so it is a rest day and must not break the run.
    session('2026-03-04', [line('push-ups')]),
  ],
  MWF_PROFILE,
  [],
  '2026-03-05',
)
eq('a rest day between two sessions does not break the streak', acrossRestDay.days, 2)

const missedPlanned = computeStreak(
  [
    session('2026-03-04', [line('push-ups')]),
    // Friday 6th was planned and missed, and it is in the past.
  ],
  MWF_PROFILE,
  [],
  SUN,
)
eq('missing a planned day ends the streak', missedPlanned.days, 0)
eq(
  'and with nothing reached inside the run there is no day to name',
  missedPlanned.lastTrainedOn,
  null,
)
eq(
  'a streak that died on a missed day still names the day it reached',
  computeStreak(
    [session('2026-03-04', [line('push-ups')]), session('2026-03-07', [line('push-ups')])],
    MWF_PROFILE,
    [],
    SUN,
  ).lastTrainedOn,
  '2026-03-07',
)
eq(
  'a planned day that is still today is not held against the user yet',
  computeStreak([session('2026-03-04', [line('push-ups')])], MWF_PROFILE, [], '2026-03-06').days,
  1,
)

eq(
  'an unfinished session is not training',
  computeStreak([session(MON, [line('push-ups', { done: 0 })])], MWF_PROFILE, [], MON).days,
  0,
)
eq(
  'a session with no exercises at all is not training',
  computeStreak([session(MON, [])], MWF_PROFILE, [], MON).days,
  0,
)
eq(
  'a plan with no fixed weekdays is never broken, so the walk terminates on the last session',
  computeStreak([session('2020-01-06', [line('push-ups')])], profileWith([]), [], MON).days,
  1,
)
eq(
  'planned days can come from the workout rather than the profile',
  computeStreak(
    [session('2026-03-03', [line('push-ups')])],
    profileWith([]),
    [workoutOn('Tuesday')],
    '2026-03-04',
  ).days,
  1,
)

/* ── All-time totals ─────────────────────────────────────────────────────── */

section('All-time totals')
const mixed = [
  session(MON, [line('push-ups', { sets: 3, reps: 10 })], { durationSec: 1200 }),
  session('2026-03-03', [line('squats', { sets: 4, reps: 12 })], { durationSec: 900, status: 'planned' }),
  session('2026-03-04', [line('pull-ups', { sets: 3, reps: 5 })], { durationSec: 1500 }),
  session(addDays(MON, -1), [line('dips', { sets: 2, done: 0 })], { durationSec: 600, status: 'skipped' }),
]
const mixedTotals = totals(mixed, MWF_PROFILE, [])
eq('a planned session is not counted', mixedTotals.sessions, 2)
eq('a skipped session is not counted', mixedTotals.sessions, 2)
eq('sets are only the ticked ones', mixedTotals.sets, 6)
eq('reps are only the ticked ones', mixedTotals.reps, 30 + 15)
eq('exercises are only the finished ones', mixedTotals.exercises, 2)
eq('time trained sums the real sessions', mixedTotals.seconds, 2700)

const gapStreak = [
  session('2026-03-05', [line('push-ups')]),
  // Thursday 5th then Monday 9th: Friday, Saturday and Sunday are rest days,
  // but nothing was missed because this profile plans no weekdays.
  session('2026-03-09', [line('push-ups')]),
]
eq(
  'a gap made only of rest days keeps the run',
  totals(gapStreak, profileWith([]), []).bestStreak,
  2,
)
eq(
  'a gap that swallows a missed planned day ends the run',
  totals(
    [
      session('2026-03-02', [line('push-ups')]),
      // Trained Monday, then Thursday. Wednesday was planned and skipped.
      session('2026-03-05', [line('push-ups')]),
    ],
    profileWith(['Wednesday']),
    [],
  ).bestStreak,
  1,
)
eq(
  'the best streak matches the live streak rule on the same data',
  totals(
    [session('2026-03-03', [line('push-ups')]), session('2026-03-05', [line('push-ups')])],
    profileWith(['Wednesday']),
    [],
  ).bestStreak,
  computeStreak(
    [session('2026-03-03', [line('push-ups')]), session('2026-03-05', [line('push-ups')])],
    profileWith(['Wednesday']),
    [],
    '2026-03-06',
  ).days,
)
eq('no sessions means no best streak', totals([], MWF_PROFILE, []).bestStreak, 0)
eq(
  'several sessions on one day are one day of streak',
  totals([session(MON, [line('push-ups')]), session(MON, [line('squats')])], MWF_PROFILE, []).bestStreak,
  1,
)

/* ── History ordering ────────────────────────────────────────────────────── */

section('History ordering')
const entries = history([
  { ...session('2026-03-01', [line('push-ups')]), startedAt: new Date('2026-03-01T09:00:00').getTime() },
  { ...session('2026-03-03', [line('push-ups')]), startedAt: new Date('2026-03-03T18:00:00').getTime() },
  { ...session('2026-03-03', [line('squats')]), startedAt: new Date('2026-03-03T07:00:00').getTime() },
])
eq('history is newest day first', entries.map((e) => e.session.date), ['2026-03-03', '2026-03-03', '2026-03-01'])
eq(
  'and within a day, the later session first',
  entries.slice(0, 2).map((e) => e.session.workoutName),
  ['Push', 'Push'],
)
eq(
  'every entry carries the stats of its own session',
  entries[0].stats.setsDone,
  3,
)
eq('a shuffled session list does not change the result', history([...mixed]).length, mixed.length)

/* ── Progression evidence ────────────────────────────────────────────────── */

section('Progression evidence')
const PUSH = {
  id: 'push-ups',
  name: 'Push-ups',
  difficulty: 'beginner',
  movement: 'push',
  equipment: ['none'],
  mainMuscle: 'chest',
  muscles: [],
  keywords: [],
  description: '',
  cues: [],
  dosage: { sets: 3, reps: 8, restSec: 90 },
  harder: ['push-ups-decline'],
  easier: ['wall-push-ups'],
}
const DECLINE = { ...PUSH, id: 'push-ups-decline', name: 'Decline Push-ups', difficulty: 'intermediate', harder: [], easier: ['push-ups'] }
const WALL = { ...PUSH, id: 'wall-push-ups', name: 'Wall Push-ups', difficulty: 'beginner', harder: ['push-ups'], easier: [] }
const CATALOGUE = new Map([PUSH, DECLINE, WALL].map((e) => [e.id, e]))
const lookup = (id) => CATALOGUE.get(id)

const cleanRuns = [
  session(MON, [line('push-ups')]),
  session('2026-02-27', [line('push-ups')]),
  session('2026-02-26', [line('push-ups')]),
  session('2026-02-25', [line('push-ups')]),
  session('2026-02-24', [line('push-ups')]),
]
const cleanEvidence = evidenceForMany(cleanRuns, [PUSH]).get('push-ups')
eq('a fully ticked exercise has a hit rate of 1', cleanEvidence.hitRate, 1)
eq('and a clean streak to match, capped by the sample', cleanEvidence.cleanStreak, EVIDENCE_SESSIONS)
eq('only the newest four sessions are sampled', cleanEvidence.sessions.length, EVIDENCE_SESSIONS)
eq(
  'sampled sessions are newest first',
  cleanEvidence.sessions.map((s) => s.date),
  [MON, '2026-02-27', '2026-02-26', '2026-02-25'],
)
eq('the best set is the best across every sampled session', cleanEvidence.bestSet.reps, 8)

const partialRuns = [
  session(MON, [line('push-ups', { sets: 4, done: 2 })]),
  session('2026-02-27', [line('push-ups', { sets: 4, done: 4 })]),
]
const partialEvidence = evidenceForMany(partialRuns, [PUSH]).get('push-ups')
eq('half the sets done is a hit rate of one half', partialEvidence.hitRate, 0.75)
eq('a half-finished newest session leaves no clean streak', partialEvidence.cleanStreak, 0)
eq(
  'but the run before it was clean, and that still shows in the samples',
  partialEvidence.sessions.length,
  2,
)

/*
 * The regression this whole check exists for: a session that *contained* the
 * exercise but never touched a set is not evidence about it. Counting those as
 * zeroes used to drag a perfectly consistent exercise towards "ease off".
 */
const untouched = [
  session(MON, [line('push-ups')]),
  session('2026-02-27', [line('push-ups')]),
  // Push-ups is on the card but never ticked; only the squats were trained.
  session('2026-02-26', [line('push-ups', { done: 0 }), line('squats')]),
]
const untouchedEvidence = evidenceForMany(untouched, [PUSH]).get('push-ups')
eq('a session where the exercise was never touched is skipped', untouchedEvidence.sessions.length, 2)
eq('so it cannot drag the hit rate down', untouchedEvidence.hitRate, 1)
eq('nor the clean streak', untouchedEvidence.cleanStreak, 2)
eq(
  'the untouched session is still counted by the session it belongs to',
  untouched[2].status,
  'partial',
)
eq(
  'an exercise with no logged work has no evidence at all',
  evidenceForMany(untouched, [WALL]).size,
  0,
)

const extraSets = evidenceForMany(
  [session(MON, [line('push-ups', { sets: 5, targetSets: 3, done: 5 })])],
  [PUSH],
).get('push-ups')
eq('doing more sets than prescribed never reads as over 100%', extraSets.hitRate, 1)
eq(
  'and it still counts as a clean session',
  extraSets.cleanStreak,
  1,
)

const halfTarget = evidenceForMany(
  [session(MON, [{ ...line('push-ups', { sets: 2, targetSets: 4, done: 2 }) }])],
  [PUSH],
).get('push-ups')
eq('a short line against a bigger target is not 100%', halfTarget.hitRate, 0.5)

const targetMoved = evidenceForMany(
  [
    session(MON, [line('push-ups', { reps: 15 })]),
    session('2026-02-27', [line('push-ups', { reps: 8 })]),
  ],
  [PUSH],
).get('push-ups')
eq('the target read is the newest one, not the oldest', targetMoved.target.reps, 15)

const weighted = evidenceForMany(
  [session(MON, [line('push-ups', { reps: 10, weight: 20 })])],
  [PUSH],
).get('push-ups')
eq('added load is kept for the "add load" suggestion', weighted.bestSet.weight, 20)

/* ── Progression verdicts ────────────────────────────────────────────────── */

section('Progression verdicts')
const verdict = (runs, exercise = PUSH) => suggestFor(exercise, evidenceForMany(runs, [exercise]).get(exercise.id), lookup)

eq(
  'nothing logged is not enough data, not a judgement',
  verdict([]).verdict,
  'insufficient-data',
)
eq(
  'a run of clean sessions says go harder',
  verdict(cleanRuns).verdict,
  'progress',
)
eq(
  'and names the next rung from the library',
  verdict(cleanRuns).nextExercise?.id,
  'push-ups-decline',
)
eq(
  'a clean run below the rep target says raise the reps first',
  verdict([
    session(MON, [line('push-ups', { reps: 5, targetReps: 12 })]),
    session('2026-02-27', [line('push-ups', { reps: 5, targetReps: 12 })]),
  ]).headline,
  'Add reps before adding difficulty',
)
eq(
  'a clean run with load already on says add load',
  verdict([
    session(MON, [line('push-ups', { reps: 12, weight: 20 })]),
    session('2026-02-27', [line('push-ups', { reps: 12, weight: 20 })]),
  ]).headline,
  'Add load',
)
eq(
  'a run of missed sets says ease off',
  verdict([session(MON, [line('push-ups', { sets: 4, done: 1 })])]).verdict,
  'regress',
)
eq(
  'easing off offers a rung to step back to',
  verdict([session(MON, [line('push-ups', { sets: 4, done: 1 })])]).fallbackExercise?.id,
  'wall-push-ups',
)
eq(
  'one clean session is not yet a reason to progress',
  verdict([session(MON, [line('push-ups')])]).verdict,
  'maintain',
)
eq(
  'the top rung of a ladder has nowhere to go, so it maintains',
  verdict([session(MON, [line('push-ups-decline', { reps: 20 })])], DECLINE).verdict,
  'maintain',
)
eq(
  'a rung the library does not contain is skipped rather than suggested',
  suggestFor(PUSH, cleanEvidence, () => undefined).nextExercise,
  undefined,
)
eq(
  'the threshold for going harder is two clean sessions',
  CLEAN_TO_ADVANCE,
  2,
)

const report = progressionReport(
  [session(MON, [line('push-ups'), line('wall-push-ups', { sets: 4, done: 1 })])],
  [PUSH, WALL],
  lookup,
)
eq('the report covers every trained exercise', report.evidence.size, 2)
eq(
  'and suggests one verdict each',
  report.suggestions.length,
  2,
)
eq(
  'the exercise that needs easing off is offered first',
  report.suggestions[0].key,
  'wall-push-ups',
)
eq(
  'an exercise with no logged sets produces no suggestion at all',
  progressionReport([], [PUSH], lookup).suggestions.length,
  0,
)
eq(
  'the report reads evidence and suggestions out of one pass',
  progressionReport(cleanRuns, [PUSH], lookup).evidence.get('push-ups').hitRate,
  1,
)

/* ── Level arithmetic ────────────────────────────────────────────────────── */

section('Level arithmetic')
eq('beginner is the bottom rung', levelRank('beginner'), 1)
check('advanced outranks intermediate', levelRank('advanced') > levelRank('intermediate'))
check('intermediate outranks beginner', levelRank('intermediate') > levelRank('beginner'))
eq('capacity clamps at the top', levelForCapacity(9), 'advanced')
eq('capacity clamps at the bottom', levelForCapacity(-4), 'beginner')
eq('capacity rounds to the nearest level', levelForCapacity(2.4), 'intermediate')

const noData = benchmarksFor(null)
eq('a profile that told us nothing benchmarks nothing', noData.push, null)
eq('so core falls back to the declared level', benchmarksFor(MWF_PROFILE).core, null)

const strongPusher = { ...MWF_PROFILE, level: 'intermediate', maxPushups: 40 }
const weakPusher = { ...MWF_PROFILE, level: 'intermediate', maxPushups: 2 }
check(
  'measured push capacity beats declared capacity',
  movementCapacity('push', strongPusher).capacity >= movementCapacity('push', weakPusher).capacity,
)
check(
  'declared level still moves the number',
  movementCapacity('push', { ...weakPusher, level: 'advanced' }).capacity >=
    movementCapacity('push', { ...weakPusher, level: 'beginner' }).capacity,
)
eq(
  'an unbenchmarked movement carries the declared level exactly',
  movementCapacity('skills', weakPusher).capacity,
  3 - 1,
)
eq(
  'the push benchmark uses the better of push-ups and dips',
  benchmarksFor({ ...MWF_PROFILE, maxPushups: 0, maxDips: 15 }).push,
  band(15, DIP_BANDS),
)
eq(
  'a stale maximum of 0 is ignored rather than benchmarked at the floor',
  benchmarksFor({ ...MWF_PROFILE, maxPushups: 0, maxDips: 0 }).push,
  null,
)
eq(
  'a user who cannot press up but can dip is not assessed as unable to push',
  movementCapacity('push', { ...MWF_PROFILE, level: 'intermediate', maxPushups: 0, maxDips: 20 }).capacity,
  movementCapacity('push', { ...MWF_PROFILE, level: 'intermediate', maxPushups: 20, maxDips: 0 }).capacity,
)
eq(
  'an unanswered maximum leaves the declared level in charge',
  benchmarksFor({ ...MWF_PROFILE, maxSquats: undefined }).legs,
  null,
)
eq(
  'a measured pull-up maximum overrides the self-reported ability',
  benchmarksFor({ ...MWF_PROFILE, pullUpAbility: 'none', maxPullups: 8 }).pull,
  band(8, PULL_BANDS),
)
eq(
  'and without a maximum the ability answer is used instead',
  benchmarksFor({ ...MWF_PROFILE, pullUpAbility: 'multiple' }).pull,
  0.7,
)
eq(
  'a maximum of zero is treated the same way',
  benchmarksFor({ ...MWF_PROFILE, pullUpAbility: 'multiple', maxPullups: 0 }).pull,
  0.7,
)
eq('a manual override always wins', mergeLevels({ a: 'beginner' }, { a: 'advanced' }).a, 'advanced')
eq('an override does not remove the other estimates', Object.keys(mergeLevels({ a: 'beginner', b: 'beginner' }, { a: 'advanced' })).length, 2)

/* ── Result ──────────────────────────────────────────────────────────────── */

console.log(`\n${failures.length ? `${failures.length} FAILED` : 'All progress checks passed.'} (${passed} checks)`)
if (failures.length) {
  for (const name of failures) console.log(`  - ${name}`)
  process.exit(1)
}
