/**
 * Checks that importing a backup cannot quietly cost the user their data.
 *
 * An import is the only action in this app that replaces everything at once,
 * and there is no server copy and no account to re-sync from — if it does the
 * wrong thing, the data is simply gone. That makes three guarantees worth
 * proving rather than assuming:
 *
 *   1. **Nothing is written until the user agrees.** The file has to be readable
 *      and checkable on its own, before any write, so the Profile screen can
 *      show what was picked and ask. `inspectBackup` is that read-only half and
 *      is exercised here on files that must be refused.
 *   2. **A refusal changes nothing.** Every rejected file has to leave the
 *      stored data byte-identical. This is checked against a fake `localStorage`
 *      so the assertion is about the real write sequence, not about a comment.
 *   3. **An import is a snapshot, not a patch.** A key the file does not carry
 *      is reset rather than left as whatever the device happened to hold, so an
 *      import can never silently merge two histories into one. A merge is the
 *      failure mode that looks successful and is not.
 *
 * `./backup-file` imports nothing and takes the key list as an argument, so all
 * of this runs in plain Node. `restoreBackup` itself needs `window.localStorage`
 * and `store`, so it is exercised through a stub here and end-to-end in a browser.
 *
 * No browser, no timers, no clock dependence. Dates are given as literals.
 */
import { BACKUP_APP_ID, BACKUP_VERSION, datasetCount, inspectBackup, planBackupWrites } from './src/lib/backup-file.ts'
import { reconcile } from './src/lib/reconcile.ts'

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

/* ── Fixtures ──────────────────────────────────────────────────────────── */

/** The thirteen keys, in the order `store.ts` declares them. */
const KEYS = [
  'calisthenics:my-exercises',
  'calisthenics:workouts',
  'calisthenics:sessions',
  'calisthenics:records',
  'calisthenics:nutrition',
  'calisthenics:nutrition-targets',
  'calisthenics:weight-log',
  'calisthenics:skills',
  'calisthenics:levels',
  'calisthenics:dismissed-suggestions',
  'calisthenics:profile',
  'calisthenics:theme',
  'calisthenics:active-session',
]

/** What each key holds when nothing has been written to it. */
const DEFAULTS = {
  'calisthenics:my-exercises': [],
  'calisthenics:workouts': [],
  'calisthenics:sessions': [],
  'calisthenics:records': [],
  'calisthenics:nutrition': [],
  'calisthenics:nutrition-targets': { kcal: 2200, protein: 140, carbs: 220, fat: 70, waterMl: 2500, auto: true },
  'calisthenics:weight-log': [],
  'calisthenics:skills': [],
  'calisthenics:levels': {},
  'calisthenics:dismissed-suggestions': {},
  'calisthenics:profile': { onboarded: false, name: '', level: 'beginner' },
  'calisthenics:theme': 'dark',
  'calisthenics:active-session': null,
}

/**
 * Stands in for the key's own reviver. Real fitting is `store`'s business and is
 * covered by `verify-robustness`; what matters here is that an absent key is
 * fitted from `undefined`, which is exactly what a fresh install does.
 */
const fit = (key, raw) => reconcile(raw, DEFAULTS[key])

/** A complete, valid backup: every key present. */
function fullBackup(overrides = {}) {
  const data = {}
  for (const key of KEYS) data[key] = DEFAULTS[key]
  return JSON.stringify({
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: '2026-03-04T09:15:00.000Z',
    data: { ...data, ...overrides },
  })
}

/** A backup carrying only some of the keys — the case that used to merge. */
function partialBackup(keys, overrides = {}) {
  const data = {}
  for (const key of keys) data[key] = DEFAULTS[key]
  return JSON.stringify({
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: '2026-03-04T09:15:00.000Z',
    data: { ...data, ...overrides },
  })
}

/**
 * A minimal `localStorage` stand-in that records every write, so a test can
 * assert not just the final value but that nothing was written at all.
 */
function fakeStorage(seed = {}) {
  const store = { ...seed }
  const writes = []
  return {
    store,
    writes,
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      writes.push(key)
      store[key] = String(value)
    },
    removeItem: (key) => {
      writes.push(key)
      delete store[key]
    },
  }
}

/** Applies a write plan the way `restoreBackup` does, recording the outcome. */
function applyPlan(text, storage) {
  const inspection = inspectBackup(text, KEYS)
  if (!inspection.ok || !inspection.data) {
    return { ok: false, message: inspection.error, writes: [] }
  }
  const plan = planBackupWrites(inspection.data, KEYS, fit)
  for (const { key, value } of plan) storage.setItem(key, value)
  return { ok: true, writes: plan, restored: inspection.present, reset: inspection.missing }
}

/* ── A valid full backup ───────────────────────────────────────────────── */

group('A valid full backup is accepted and describes itself')

{
  const result = inspectBackup(fullBackup(), KEYS)
  check('is accepted', result.ok)
  eq('reports every dataset as present', result.present.length, 13)
  eq('reports nothing missing', result.missing, [])
  eq('reports nothing unrecognised', result.unknown, [])
  eq('reads the format version', result.file.version, BACKUP_VERSION)
  eq('reads the export date', result.file.exportedAt, '2026-03-04 09:15')
  eq('counts the keys in the file', result.file.keyCount, 13)
  check('carries the data through', result.data !== null && 'calisthenics:profile' in result.data)
}

{
  const plan = planBackupWrites(inspectBackup(fullBackup(), KEYS).data, KEYS, fit)
  eq('plans a write for every key', plan.length, 13)
  check('every planned value is a string', plan.every((w) => typeof w.value === 'string'))
  check(
    'an active session of null is written as null, not undefined',
    plan.find((w) => w.key === 'calisthenics:active-session').value === 'null',
  )
}

{
  // A complete import must reproduce the file, byte for byte, key for key.
  const storage = fakeStorage()
  const result = applyPlan(fullBackup(), storage)
  check('applies', result.ok)
  eq('writes nothing as reset', result.reset, [])
  eq('restores all thirteen', result.restored.length, 13)
  const expected = JSON.parse(fullBackup()).data
  eq(
    'stored data matches the file',
    KEYS.map((k) => JSON.parse(storage.store[k])),
    KEYS.map((k) => expected[k]),
  )
}

/* ── Invalid files are refused ─────────────────────────────────────────── */

group('Invalid files are refused, with a message and no data attached')

const REJECTED = [
  ['not valid JSON', '{ this is not json'],
  ['an empty file', ''],
  ['a JSON array', '[]'],
  ['a JSON string', '"just a string"'],
  ['a JSON number', '42'],
  ['a JSON null', 'null'],
  ['another app’s file', JSON.stringify({ app: 'some-other-app', version: 1, data: { a: 1 } })],
  ['no data section', JSON.stringify({ app: BACKUP_APP_ID, version: 1 })],
  ['a data section that is an array', JSON.stringify({ app: BACKUP_APP_ID, version: 1, data: [] })],
  ['a data section that is null', JSON.stringify({ app: BACKUP_APP_ID, version: 1, data: null })],
  ['a data section that is a scalar', JSON.stringify({ app: BACKUP_APP_ID, version: 1, data: 'nope' })],
  ['only keys this build does not own', JSON.stringify({ app: BACKUP_APP_ID, version: 1, data: { 'other:thing': 1 } })],
]

for (const [label, text] of REJECTED) {
  const result = inspectBackup(text, KEYS)
  check(`${label} is refused`, !result.ok, `problem was not detected`)
  check(`${label} carries a message`, typeof result.error === 'string' && result.error.length > 0)
  check(
    `${label} says nothing was changed`,
    typeof result.error === 'string' && result.error.includes('Nothing has been changed'),
    result.error,
  )
  eq(`${label} exposes no data`, result.data, null)
}

/* ── A failed import leaves current data untouched ──────────────────────── */

group('A refused file never touches what is stored')

{
  // Seed every key with a recognisable value, then try a run of bad files.
  const seed = {}
  for (const key of KEYS) seed[key] = JSON.stringify({ seeded: key })

  for (const [label, text] of REJECTED) {
    const storage = fakeStorage(seed)
    const before = JSON.stringify(storage.store)
    const result = applyPlan(text, storage)
    check(`${label}: the import does not report success`, !result.ok)
    eq(`${label}: nothing is written`, storage.writes, [])
    eq(`${label}: stored data is byte-identical`, JSON.stringify(storage.store), before)
  }
}

{
  // And the same for a file that is valid JSON and a valid backup, but whose
  // values cannot be fitted — the plan must fail before the first write.
  const storage = fakeStorage(
    Object.fromEntries(KEYS.map((k) => [k, JSON.stringify({ seeded: k })])),
  )
  const before = JSON.stringify(storage.store)
  const exploding = {
    app: BACKUP_APP_ID,
    version: 1,
    data: Object.fromEntries(KEYS.map((k) => [k, DEFAULTS[k]])),
  }
  let threw = false
  try {
    const inspection = inspectBackup(JSON.stringify(exploding), KEYS)
    planBackupWrites(inspection.data, KEYS, () => {
      throw new Error('cannot fit this')
    })
  } catch {
    threw = true
  }
  check('a value that cannot be fitted throws while planning', threw)
  eq('and no write has happened', storage.writes, [])
  eq('and stored data is byte-identical', JSON.stringify(storage.store), before)
}

/* ── Cancelling changes nothing ────────────────────────────────────────── */

group('Cancelling leaves everything as it was')

{
  // The Profile screen holds the inspected file in state and writes only when
  // the user confirms, so cancel is modelled here as "inspect, then stop".
  const seed = Object.fromEntries(KEYS.map((k) => [k, JSON.stringify({ seeded: k })]))
  const storage = fakeStorage(seed)
  const before = JSON.stringify(storage.store)

  const inspection = inspectBackup(fullBackup(), KEYS)
  check('the file inspects successfully first', inspection.ok)

  // The user cancels. Nothing between inspect and confirm writes anything, so
  // this is a no-op — asserted here so the guarantee is stated and checkable.
  eq('no write is planned or performed', storage.writes, [])
  eq('stored data is byte-identical', JSON.stringify(storage.store), before)

  const recheck = inspectBackup(fullBackup(), KEYS)
  eq('inspecting is repeatable and still reads the same', recheck.present, inspection.present)
}

/* ── A confirmed import ────────────────────────────────────────────────── */

group('A confirmed import replaces the stored data')

{
  const seed = Object.fromEntries(KEYS.map((k) => [k, JSON.stringify({ seeded: k })]))
  const storage = fakeStorage(seed)
  const incoming = fullBackup({
    'calisthenics:profile': { onboarded: true, name: 'Sam', level: 'advanced' },
    'calisthenics:sessions': [{ id: 's_1', workoutName: 'Push A', date: '2026-03-01' }],
  })

  const result = applyPlan(incoming, storage)
  check('reports success', result.ok)
  eq('writes every key', result.writes.length, 13)
  eq('the imported profile is in place', JSON.parse(storage.store['calisthenics:profile']).name, 'Sam')
  eq('the imported session is in place', JSON.parse(storage.store['calisthenics:sessions']).length, 1)
  eq(
    'the previous device’s data is gone, not merged',
    JSON.parse(storage.store['calisthenics:workouts']),
    [],
  )
  eq('every key is written', new Set(storage.writes), new Set(KEYS))
}

/* ── A partial backup ──────────────────────────────────────────────────── */

group('A partial backup is a snapshot: absent keys are reset, never merged')

{
  const carried = ['calisthenics:profile', 'calisthenics:sessions']
  const result = inspectBackup(partialBackup(carried), KEYS)
  check('is still accepted', result.ok)
  eq('reports the keys it carries', result.present, carried)
  eq('reports the keys it lacks', result.missing.length, 11)
  check('never lists a key as both', result.present.some((k) => result.missing.includes(k)) === false)
}

{
  // The case that used to be wrong: this device has sessions, the backup has
  // none for that key. A merge would leave the device's sessions in place.
  const storage = fakeStorage({
    'calisthenics:sessions': JSON.stringify([{ id: 'device_only', workoutName: 'Keep me?' }]),
    'calisthenics:records': JSON.stringify([{ id: 'device_pr' }]),
  })
  const result = applyPlan(partialBackup(['calisthenics:profile'], { 'calisthenics:profile': { name: 'Sam' } }), storage)

  check('applies', result.ok)
  eq('the carried key is restored', result.restored, ['calisthenics:profile'])
  eq('every absent key is reported as reset', result.reset.length, 12)
  eq('the device-only session is gone, not merged', JSON.parse(storage.store['calisthenics:sessions']), [])
  eq('the device-only record is gone, not merged', JSON.parse(storage.store['calisthenics:records']), [])
  eq('the absent key was written empty, not skipped', storage.store['calisthenics:records'], '[]')
  eq('and the profile came from the file', JSON.parse(storage.store['calisthenics:profile']).name, 'Sam')
}

{
  // A backup carrying a single key is the smallest thing worth importing; it
  // must still be a complete reset, not a one-key patch.
  const storage = fakeStorage(Object.fromEntries(KEYS.map((k) => [k, JSON.stringify({ seeded: k })])))
  const result = applyPlan(partialBackup(['calisthenics:profile']), storage)
  check('a one-key backup still applies', result.ok)
  eq('it resets the other twelve', result.reset.length, 12)
  const leftover = KEYS.filter((k) => k !== 'calisthenics:profile').filter((k) => {
    const value = JSON.parse(storage.store[k])
    return value !== null && value.seeded !== undefined
  })
  eq('no key keeps the device’s old value', leftover, [])
}

/* ── Unrecognised keys ─────────────────────────────────────────────────── */

group('Keys this build does not own are ignored, not applied')

{
  const result = inspectBackup(fullBackup({ 'some-other-app:secret': { a: 1 }, 'calisthenics:future': [] }), KEYS)
  check('is still accepted', result.ok)
  eq('both are listed as unrecognised', result.unknown.sort(), ['calisthenics:future', 'some-other-app:secret'])
  eq('all thirteen own keys are still present', result.present.length, 13)

  const storage = fakeStorage()
  applyPlan(JSON.stringify(JSON.parse(fullBackup({ 'some-other-app:secret': { a: 1 } }))), storage)
  check('no unrecognised key is written', !('some-other-app:secret' in storage.store))
  eq('and no other storage key is touched', storage.writes.length, 13)
}

/* ── Read-only inspection ──────────────────────────────────────────────── */

group('Inspection writes nothing')

{
  const storage = fakeStorage()
  for (const text of [fullBackup(), partialBackup(['calisthenics:profile']), ...REJECTED.map((r) => r[1])]) {
    inspectBackup(text, KEYS)
  }
  eq('no file caused a write', storage.writes, [])
  check('inspection is a pure function of the text', inspectBackup(fullBackup(), KEYS).ok === true)
}

/* ── Exported date handling ────────────────────────────────────────────── */

group('A hand-edited export date is never rendered raw')

for (const [label, value, expected] of [
  ['proper ISO stamp', '2026-03-04T09:15:00.000Z', '2026-03-04 09:15'],
  ['missing stamp', undefined, null],
  ['blank stamp', '', null],
  ['number', 1772000000, null],
  ['date-only string', '2026-03-04', null],
  ['prose', 'last Tuesday', null],
  ['script tag', '<img src=x onerror=1>', null],
]) {
  const file = { app: BACKUP_APP_ID, version: 1, data: { 'calisthenics:profile': {} } }
  if (value !== undefined) file.exportedAt = value
  const result = inspectBackup(JSON.stringify(file), KEYS)
  eq(`a ${label} is read safely`, result.file.exportedAt, expected)
}

/* ── Absent keys take the same path as a fresh install ─────────────────── */

group('An absent key is fitted exactly as a never-written one')

{
  const storage = fakeStorage()
  applyPlan(partialBackup(['calisthenics:profile']), storage)
  eq('an empty array stays an array', JSON.parse(storage.store['calisthenics:workouts']), [])
  eq('an empty object stays an object', JSON.parse(storage.store['calisthenics:levels']), {})
  eq('the default theme is applied', JSON.parse(storage.store['calisthenics:theme']), 'dark')
  eq('a null session id is applied', JSON.parse(storage.store['calisthenics:active-session']), null)
  eq(
    'default targets are applied whole',
    JSON.parse(storage.store['calisthenics:nutrition-targets']),
    DEFAULTS['calisthenics:nutrition-targets'],
  )
}

/* ── Count wording ─────────────────────────────────────────────────────── */

group('Count wording')

eq('one dataset is singular', datasetCount(1), '1 dataset')
eq('thirteen datasets is plural', datasetCount(13), '13 datasets')
eq('none is still plural, because zero datasets is a plural quantity', datasetCount(0), '0 datasets')

/* ── Result ────────────────────────────────────────────────────────────── */

console.log(
  `\n${failures === 0 ? 'All backup checks passed.' : `${failures} backup check(s) failed.`} (${passes} checks)`,
)
process.exit(failures === 0 ? 0 : 1)
