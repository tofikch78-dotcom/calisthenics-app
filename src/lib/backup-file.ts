/**
 * Reading and validating a backup file, with nothing written and nothing
 * imported.
 *
 * Split out from `backup.ts` for two reasons that both matter:
 *
 *   1. **Confirm before destroying.** A restore replaces everything, so the file
 *      has to be understood *before* anything is written — the user needs to be
 *      shown what they picked and asked to agree to it. Validation and writing
 *      cannot be one function any more.
 *   2. **Testability.** `backup.ts` reaches `store.ts`, which imports the
 *      exercise catalogue, which is a directory import Node cannot resolve. This
 *      module takes the key list as an argument and imports nothing, so the
 *      rules a backup has to satisfy can be checked directly by
 *      `verify-backup.mjs` instead of only in a browser.
 *
 * The format itself is unchanged: `{ app, version, exportedAt, data }`.
 */

/** The marker that says "this JSON is one of ours" rather than any other JSON. */
export const BACKUP_APP_ID = 'calisthenics-exercise-library'

/** Bumped only if the shape of `data` changes meaning. */
export const BACKUP_VERSION = 1

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  version: number
  exportedAt: string
  data: Record<string, unknown>
}

/** One serialised value, ready to hand to `localStorage.setItem`. */
export interface BackupWrite {
  key: string
  value: string
}

export interface BackupInspection {
  ok: boolean
  /** Present only when `ok` is false. Safe to show to the user as-is. */
  error?: string
  /** What the file claims about itself, for the confirmation prompt. */
  file?: {
    version: number
    /** `null` when the field is missing or is not an ISO timestamp. */
    exportedAt: string | null
    /** How many keys the file carries, recognised or not. */
    keyCount: number
  }
  /** Keys this app owns that the file carries. */
  present: string[]
  /** Keys this app owns that the file does not carry. */
  missing: string[]
  /** Keys in the file that this build does not own. Ignored on restore. */
  unknown: string[]
  /** The file's `data`, only populated when `ok`. */
  data: Record<string, unknown> | null
}

/** Every way a file can fail to be a usable backup, named so tests can assert on it. */
export type BackupProblem =
  | 'not-json'
  | 'not-an-object'
  | 'wrong-app'
  | 'no-data'
  | 'no-known-keys'

const REJECTED: Record<BackupProblem, string> = {
  'not-json': 'That file is not valid JSON. Nothing has been changed.',
  'not-an-object': 'That file does not contain a backup object. Nothing has been changed.',
  'wrong-app': 'That is not a Calisthenics backup file. Nothing has been changed.',
  'no-data': 'That backup file has no data section. Nothing has been changed.',
  'no-known-keys': 'That backup contained no data this app recognises. Nothing has been changed.',
}

function reject(problem: BackupProblem): BackupInspection {
  return {
    ok: false,
    error: REJECTED[problem],
    present: [],
    missing: [],
    unknown: [],
    data: null,
  }
}

/**
 * Reads the `exportedAt` stamp for display only.
 *
 * A hand-edited file can put anything here, so it is shown when it parses as an
 * ISO timestamp and reported as absent otherwise — never rendered raw, because
 * this string ends up in the DOM.
 */
function readExportedAt(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  const parsed = new Date(time)
  // `Date.parse` accepts a lot of shapes; only keep back a genuine ISO stamp.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null
  return parsed.toISOString().slice(0, 16).replace('T', ' ')
}

/**
 * Parses and checks a backup file. Writes nothing, so it is safe to call on
 * anything, any number of times, before the user has agreed to anything.
 *
 * A file only passes if it is JSON, is an object, carries this app's marker, has
 * an object `data` section, and that section holds at least one key this build
 * owns. Anything else is rejected with a message rather than partially applied.
 */
export function inspectBackup(text: string, knownKeys: readonly string[]): BackupInspection {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return reject('not-json')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return reject('not-an-object')
  }

  const file = parsed as Partial<BackupFile>
  if (file.app !== BACKUP_APP_ID) return reject('wrong-app')
  if (typeof file.data !== 'object' || file.data === null || Array.isArray(file.data)) {
    return reject('no-data')
  }

  const known = new Set(knownKeys)
  const entries = Object.entries(file.data)
  const present: string[] = []
  const unknown: string[] = []
  for (const [key] of entries) {
    if (known.has(key)) present.push(key)
    else unknown.push(key)
  }

  // A file whose every key is unrecognised is not a backup this build can use.
  // Importing it would reset all thirteen datasets to empty, which is the one
  // outcome that must never happen by accident.
  if (!present.length) return reject('no-known-keys')

  const missing = knownKeys.filter((key) => !Object.prototype.hasOwnProperty.call(file.data, key))

  return {
    ok: true,
    file: {
      version: typeof file.version === 'number' ? file.version : 0,
      exportedAt: readExportedAt(file.exportedAt),
      keyCount: entries.length,
    },
    present,
    missing,
    unknown,
    data: file.data,
  }
}

/**
 * Works out every key that will be written, and what it will be written as.
 *
 * A backup is treated as a **full snapshot**, not a patch. Every key the app
 * owns gets a write: the ones the file carries are fitted from it, and the ones
 * it does not are written back as their empty value. The alternative — writing
 * only what the file happens to hold — silently merges the backup with whatever
 * this device already had, leaving a state that matches neither the backup nor
 * the device and that the user cannot reason about or undo. With a snapshot the
 * result is always exactly "the app as it was when the backup was taken".
 *
 * The fitting function is injected rather than imported so that the "absent key
 * becomes the default" rule is provably the same code path as reading a key that
 * was never written: passing `undefined` for an absent key is what the store
 * itself does on a fresh install.
 *
 * Returns the complete list before anything is written, so a value that cannot
 * be serialised fails here, with storage untouched, rather than halfway through.
 */
export function planBackupWrites(
  data: Record<string, unknown>,
  knownKeys: readonly string[],
  fit: (key: string, raw: unknown) => unknown,
): BackupWrite[] {
  const writes: BackupWrite[] = []
  for (const key of knownKeys) {
    const carried = Object.prototype.hasOwnProperty.call(data, key)
    const fitted = fit(key, carried ? data[key] : undefined)
    // `JSON.stringify(undefined)` is `undefined`, not a string, and
    // `setItem` would store the literal text "undefined".
    const serialised = JSON.stringify(fitted)
    writes.push({ key, value: serialised === undefined ? JSON.stringify(null) : serialised })
  }
  return writes
}

/** "13 datasets" / "1 dataset", used by the restore result and the prompt. */
export function datasetCount(n: number): string {
  return `${n} ${n === 1 ? 'dataset' : 'datasets'}`
}
