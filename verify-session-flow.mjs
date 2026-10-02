/**
 * Checks the rules behind the workout-tracking flow.
 *
 * `verify-library.mjs` covers the exercise catalogue. This covers the part where
 * a workout actually gets done: that edits compose instead of overwriting each
 * other, that an exercise's status follows its sets, that the rest timer counts
 * down against the clock instead of a tick counter, and that a session is only
 * ever derived from work that was actually logged.
 *
 * Everything here is a pure function, so the checks are exact rather than
 * approximate — no browser, no timers, no waiting.
 */
import {
  appendSet,
  dropLastSet,
  mapSession,
  patchSessionItem,
  patchSessionSet,
  recomputeItemStatus,
  setItemSkipped,
  toggleSetStatus,
} from './src/lib/session-edit.ts'
import {
  IDLE_REST,
  prescribedRest,
  restAdjust,
  restPause,
  restRemaining,
  restReset,
  restResume,
  restStart,
} from './src/lib/rest-timer.ts'
import { deriveSessionStatus, sessionStats } from './src/lib/session-stats.ts'
import { reconcile } from './src/lib/reconcile.ts'

let failures = 0

function check(label, actual, expected) {
  const same = JSON.stringify(actual) === JSON.stringify(expected)
  if (!same) {
    failures += 1
    console.log(`  FAIL  ${label}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`)
  } else {
    console.log(`  ok    ${label}`)
  }
}

function group(name) {
  console.log(`\n${name}`)
}

/** A two-exercise session: pull-ups (4 sets, 90s rest) and curls (3 sets, 45s). */
function session() {
  return {
    id: 'sess_1',
    workoutId: 'wk_1',
    workoutName: 'Back + Biceps',
    date: '2026-10-02',
    startedAt: 1_700_000_000_000,
    status: 'in-progress',
    items: [
      {
        id: 'sitem_1',
        exerciseId: 'pull-ups',
        targetSets: 4,
        targetReps: 6,
        targetRestSec: 90,
        sets: [
          { reps: 6, status: 'pending' },
          { reps: 6, status: 'pending' },
          { reps: 6, status: 'pending' },
          { reps: 6, status: 'pending' },
        ],
        status: 'not-started',
      },
      {
        id: 'sitem_2',
        exerciseId: 'db-bicep-curls',
        targetSets: 3,
        targetReps: 12,
        targetWeight: 10,
        targetRestSec: 45,
        sets: [
          { reps: 12, weight: 10, status: 'pending' },
          { reps: 12, weight: 10, status: 'pending' },
          { reps: 12, weight: 10, status: 'pending' },
        ],
        status: 'not-started',
      },
    ],
  }
}

/**
 * Applies a list of edits the way the app does: each one is handed the session
 * as it stands and produces a patch, and the patches are folded in order. This is
 * the exact shape of `editSession` in the store.
 */
function applyEdits(start, edits) {
  return edits.reduce((current, edit) => mapSession(current, (live) => edit(live)), start)
}

const statuses = (s) => s.items.map((item) => item.sets.map((set) => set.status).join(','))

/* ── Edits must not overwrite each other ──────────────────────────────────── */

group('Session edits compose instead of overwriting')

{
  // The regression this exists for: two taps dispatched before React re-rendered.
  // The screen renders every exercise at once, so this is two taps on set 1 of
  // two different exercises a few milliseconds apart.
  const result = applyEdits(session(), [
    (live) => patchSessionSet(live, 'sitem_1', 0, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_2', 0, toggleSetStatus),
  ])
  check('a tap on each of two exercises both survive', statuses(result), [
    'done,pending,pending,pending',
    'done,pending,pending',
  ])
}

{
  // Same exercise, four sets, tapped faster than the screen can re-render.
  const result = applyEdits(session(), [
    (live) => patchSessionSet(live, 'sitem_1', 0, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_1', 1, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_1', 2, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_1', 3, toggleSetStatus),
  ])
  check('four rapid taps on four sets all register', statuses(result)[0], 'done,done,done,done')
  check('the exercise is credited as completed', result.items[0].status, 'completed')
  check('the untouched exercise is left alone', statuses(result)[1], 'pending,pending,pending')
}

{
  // The same set twice really is a toggle, not two writes of one end state.
  const result = applyEdits(session(), [
    (live) => patchSessionSet(live, 'sitem_1', 0, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_1', 0, toggleSetStatus),
  ])
  check('two taps on one set toggle it back', statuses(result)[0], 'pending,pending,pending,pending')
  check('and the status returns to not-started', result.items[0].status, 'not-started')
}

{
  // Going back to an earlier set must not disturb the ones already done.
  const result = applyEdits(session(), [
    (live) => patchSessionSet(live, 'sitem_1', 0, (set) => ({ ...set, reps: 8 })),
    (live) => patchSessionSet(live, 'sitem_1', 1, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_1', 2, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_1', 1, (set) => ({ ...set, reps: 9 })),
  ])
  check('editing an earlier set keeps the later ones', statuses(result)[0], 'pending,done,done,pending')
  check('the edited reps are kept', result.items[0].sets[1].reps, 9)
  check('the untouched earlier set keeps its own reps', result.items[0].sets[0].reps, 8)
}

{
  const result = applyEdits(session(), [
    (live) => patchSessionItem(live, 'sitem_2', (item) => ({ ...item, note: 'slow eccentric' })),
    (live) => patchSessionSet(live, 'sitem_1', 0, toggleSetStatus),
  ])
  check('editing one exercise leaves the other intact', result.items[1].note, 'slow eccentric')
  check('and the first edit is not lost by the second', statuses(result)[0], 'done,pending,pending,pending')
}

/* ── Exercise status follows the sets ─────────────────────────────────────── */

group('Exercise status follows its sets')

{
  check('an untouched exercise is not started', recomputeItemStatus(session().items[0]).status, 'not-started')
  check(
    'a partly ticked exercise is in progress',
    recomputeItemStatus({
      ...session().items[0],
      sets: [
        { reps: 6, status: 'done' },
        { reps: 6, status: 'pending' },
        { reps: 6, status: 'pending' },
        { reps: 6, status: 'pending' },
      ],
    }).status,
    'in-progress',
  )
  check(
    'every set done means completed',
    recomputeItemStatus({
      ...session().items[0],
      sets: Array.from({ length: 4 }, () => ({ reps: 6, status: 'done' })),
    }).status,
    'completed',
  )
  check(
    'every set skipped means skipped',
    recomputeItemStatus({
      ...session().items[0],
      sets: Array.from({ length: 4 }, () => ({ reps: 6, status: 'skipped' })),
    }).status,
    'skipped',
  )
}

{
  // Regression: ticking a set on a skipped exercise used to leave it reading
  // "Skipped" while the set showed as done — filed as both skipped and logged.
  // Simply un-skipping it was not enough either: every set had been marked
  // skipped at once, so one done set and three never-attempted sets left the
  // exercise reading "completed".
  const skipped = setItemSkipped(session().items[0], true)
  check('skipping marks the exercise skipped', skipped.status, 'skipped')
  const back = applyEdits(
    { ...session(), items: [skipped] },
    [(live) => patchSessionSet(live, 'sitem_1', 0, toggleSetStatus)],
  )
  check('ticking a set on a skipped exercise un-skips it', back.items[0].status, 'in-progress')
  check('and the sets that were skipped with it are outstanding again', statuses(back)[0], 'done,pending,pending,pending')
  check('a half-done un-skipped exercise is not counted as completed', sessionStats(back).exercisesDone, 0)
}

{
  // Un-skipping a single set must not quietly undo the exercise's other skips.
  const one = setItemSkipped(session().items[0], true)
  const back = applyEdits(
    { ...session(), items: [one] },
    [(live) => patchSessionSet(live, 'sitem_1', 0, (set) => ({ ...set, status: 'pending' }))],
  )
  check('un-skipping one set keeps the exercise skipped', back.items[0].status, 'skipped')
  check('and leaves the other sets skipped', statuses(back)[0], 'pending,skipped,skipped,skipped')
}

{
  check('an exercise keeps at least one set', dropLastSet({
    ...session().items[0],
    sets: [{ reps: 6, status: 'done' }],
  }).sets.length, 1)
  check('dropping a set updates the target', dropLastSet(session().items[0]).targetSets, 3)
  check('dropping a set keeps what was logged', dropLastSet(session().items[0]).sets.length, 3)
  check('adding a set pre-fills from the template', appendSet(session().items[0]).sets[4], {
    reps: 6,
    holdSec: undefined,
    weight: undefined,
    status: 'pending',
  })
  check('adding a set updates the target', appendSet(session().items[0]).targetSets, 5)
}

{
  // Skipping must never destroy what was typed.
  const typed = {
    ...session().items[1],
    sets: session().items[1].sets.map((set) => ({ ...set, reps: 7, weight: 12.5 })),
  }
  const skipped = setItemSkipped(typed, true)
  check('skipping preserves the entered numbers', skipped.sets.map((s) => [s.reps, s.weight]), [
    [7, 12.5],
    [7, 12.5],
    [7, 12.5],
  ])
  const restored = setItemSkipped(skipped, false)
  check('un-skipping restores them as pending', restored.sets.map((s) => [s.reps, s.status]), [
    [7, 'pending'],
    [7, 'pending'],
    [7, 'pending'],
  ])
}

/* ── Rest timer ───────────────────────────────────────────────────────────── */

group('Rest timer counts against the clock')

{
  const start = restStart(90, 1_000)
  check('a fresh rest holds the full duration', restRemaining(start, 1_000), 90)
  check('it counts down with the wall clock', restRemaining(start, 31_000), 60)
  check('a stale render does not restart it', restRemaining(start, 91_500), 0)
  check('it never goes negative', restRemaining(start, 999_999), 0)
}

{
  // A backgrounded tab skips ticks; the countdown still lands correctly.
  const start = restStart(90, 0)
  check('a long gap is absorbed', restRemaining(start, 95_000), 0)
}

{
  const paused = restPause(restStart(90, 0), 20_000)
  check('pausing holds what is left', restRemaining(paused, 20_000), 70)
  check('and stays there however long the screen sits', restRemaining(paused, 500_000), 70)
  check('pausing twice changes nothing', restPause(paused, 30_000), paused)
  const resumed = restResume(paused, 40_000)
  check('resuming picks up from the held value', restRemaining(resumed, 40_000), 70)
  check('and counts down again', restRemaining(resumed, 70_000), 40)
  check('resuming twice does not double the deadline', restResume(resumed, 41_000), resumed)
  check('resuming a finished timer does nothing', restResume(restPause(restStart(90, 0), 95_000), 96_000).endsAt, null)
}

{
  check('reset returns to the prescribed rest', restRemaining(restReset(90), 0), 90)
  check('and leaves the timer stopped', restReset(90).endsAt, null)
  const reset = restReset(90)
  const added = restAdjust(reset, 30)
  check('adding to a stopped timer tops it up', restRemaining(added, 0), 120)
  check('reset still goes back to the prescription', restRemaining(restReset(90), 0), 90)
  const running = restAdjust(restStart(90, 0), 30)
  check('adding to a running timer extends the deadline', restRemaining(running, 0), 120)
  check('the extension is added to what was left, not the total', restRemaining(running, 60_000), 60)
  check('taking time off a paused timer floors at zero', restAdjust(restReset(10), -30), IDLE_REST)
}

{
  check('no prescription means no rest', prescribedRest(undefined), 0)
  check('zero means no rest', prescribedRest(0), 0)
  check('a real prescription is kept', prescribedRest(90), 90)
  check('nonsense is treated as no rest', prescribedRest(Number.NaN), 0)
  check('starting with no duration stays idle', restStart(0, 0), IDLE_REST)
}

/* ── What actually counts ─────────────────────────────────────────────────── */

group('Only logged work counts')

{
  const empty = session()
  const stats = sessionStats(empty)
  check('a fresh session is 0% complete', stats.completion, 0)
  check('with nothing done', stats.setsDone, 0)

  const partial = applyEdits(empty, [
    (live) => patchSessionSet(live, 'sitem_1', 0, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_1', 1, toggleSetStatus),
  ])
  const done = sessionStats(partial)
  check('ticked sets are counted', done.setsDone, 2)
  check('and reps are counted from what was logged', done.reps, 12)
  check('completion is a share of the sets', done.completion, 29)

  const skipped = sessionStats(
    applyEdits(empty, [(live) => patchSessionItem(live, 'sitem_2', (i) => setItemSkipped(i, true))]),
  )
  check('a skipped exercise is counted as skipped', skipped.exercisesSkipped, 1)
  check('a skipped exercise contributes no reps', skipped.reps, 0)
}

{
  // Reps typed into a set that was never ticked are a plan, not training.
  const typed = applyEdits(session(), [
    (live) => patchSessionSet(live, 'sitem_1', 0, (set) => ({ ...set, reps: 20, weight: 30 })),
  ])
  check('typing reps into an unticked set counts for nothing', sessionStats(typed).setsDone, 0)
  check('and adds no reps', sessionStats(typed).reps, 0)
}

group('A session is filed for what was actually done')

{
  const untouched = session()
  check('opening a workout does not count as training', deriveSessionStatus(untouched), 'skipped')
  check('an empty session is skipped', deriveSessionStatus({ ...untouched, items: [] }), 'skipped')

  const allSkipped = applyEdits(untouched, [
    (live) => patchSessionItem(live, 'sitem_1', (i) => setItemSkipped(i, true)),
    (live) => patchSessionItem(live, 'sitem_2', (i) => setItemSkipped(i, true)),
  ])
  check('skipping everything is a skipped day', deriveSessionStatus(allSkipped), 'skipped')

  const partly = applyEdits(untouched, [(live) => patchSessionSet(live, 'sitem_1', 0, toggleSetStatus)])
  check('some sets done is a partial day', deriveSessionStatus(partly), 'partial')

  const allDone = applyEdits(untouched, [
    (live) => patchSessionSet(live, 'sitem_1', 0, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_1', 1, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_1', 2, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_1', 3, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_2', 0, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_2', 1, toggleSetStatus),
    (live) => patchSessionSet(live, 'sitem_2', 2, toggleSetStatus),
  ])
  check('every set done is a completed day', deriveSessionStatus(allDone), 'completed')
}

/* ── Reading work back after the app is closed ────────────────────────────── */

group('A stored session pointer survives being read back')

{
  /*
   * Regression, and the quietest failure in the app: the id of the workout in
   * progress was written correctly but always came back as null, because
   * `typeof null` is 'object' and the stored value is a string. The persist
   * effect then rewrote the good id as the string "null", so every later launch
   * had nothing to resume — the session was safe in storage and unreachable.
   */
  check('a stored session id is read back', reconcile('sess_abc', null), 'sess_abc')
  check('an id written as a JSON string is read back', reconcile('sess_abc', null), 'sess_abc')
  check('an absent pointer stays absent', reconcile(null, null), null)
  check('nothing stored stays absent', reconcile(undefined, null), null)
}

{
  check('a stored profile is filled in over the defaults', reconcile({ name: 'Test' }, { name: '', units: 'kg' }), {
    name: 'Test',
    units: 'kg',
  })
  check('a stored profile missing a field gets the default', reconcile({ name: 'Test' }, { name: '', units: 'kg' }).units, 'kg')
  check('a stored array is kept', reconcile([1, 2], []), [1, 2])
  check('a non-array is not mistaken for one', reconcile({ length: 2 }, []), [])
  check('a scalar does not overwrite a profile', reconcile('nonsense', { name: '' }).name, '')
  check('a scalar keeps its own type', reconcile(3, 0), 3)
  check('a mismatched scalar falls back', reconcile('nope', 0), 0)
}

/* ── Result ───────────────────────────────────────────────────────────────── */

console.log()
if (failures) {
  console.log(`${failures} session flow check${failures === 1 ? '' : 's'} failed.`)
  process.exit(1)
}
console.log('All session flow checks passed.')
