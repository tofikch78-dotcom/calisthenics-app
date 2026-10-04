import { STORAGE_KEYS, fitStored } from './store'
import {
  BACKUP_APP_ID,
  BACKUP_VERSION,
  datasetCount,
  inspectBackup,
  planBackupWrites,
} from './backup-file'
import type { BackupFile, BackupInspection } from './backup-file'

/**
 * Backup, restore and reset. Everything the app knows lives in localStorage
 * under `calisthenics:*`, so a JSON file is a complete, portable copy.
 *
 * The file format and the rules a backup has to satisfy live in `./backup-file`,
 * which imports nothing and can therefore be checked by a test. This module is
 * only the part that needs a browser: reading localStorage and writing it back.
 */

export { BACKUP_VERSION }
export type { BackupFile, BackupInspection }

function currentData(): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const key of STORAGE_KEYS) {
    const raw = window.localStorage.getItem(key)
    if (raw == null) continue
    try {
      data[key] = JSON.parse(raw)
    } catch {
      data[key] = raw
    }
  }
  return data
}

export function buildBackup(): BackupFile {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: currentData(),
  }
}

export function downloadBackup(): void {
  const payload = JSON.stringify(buildBackup(), null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().slice(0, 10)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `calisthenics-backup-${stamp}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export interface RestoreResult {
  ok: boolean
  message: string
  keys: string[]
  /** Keys that were present in the file and written from it. */
  restored: string[]
  /** Keys the file did not carry, reset to their empty value. */
  reset: string[]
}

/**
 * Reads a backup file without writing anything, so the Profile screen can show
 * the user what they picked and ask before replacing their data.
 *
 * Rejects anything that is not a usable backup of this app, and always says
 * that nothing was changed when it does.
 */
export function inspectBackupFile(text: string): BackupInspection {
  return inspectBackup(text, STORAGE_KEYS)
}

/**
 * Validates a backup and then writes it. Callers must have confirmed with the
 * user first — see `ProfileView`, which calls `inspectBackupFile` for the prompt
 * and only reaches this on an explicit Import.
 *
 * Two guarantees, in this order:
 *
 *   1. **Nothing is written until the whole file has been read.** Every value is
 *      fitted and serialised up front, so a file that cannot be fully prepared
 *      leaves storage exactly as it was, instead of half-restored.
 *   2. **Every write is a full snapshot.** A key the file does not carry is
 *      written back empty rather than left as whatever this device had, so an
 *      import is never a silent merge. `planBackupWrites` owns that rule.
 *
 * Keys outside the app's namespace are ignored, and each value is put through the
 * same shape fix the store applies on read, so an import lands in storage as the
 * shape the app will actually use rather than as the raw file contents. An
 * unknown exercise id or an unreadable day key is repaired here instead of being
 * written out to be repaired on the next launch.
 */
export function restoreBackup(text: string): RestoreResult {
  const inspection = inspectBackupFile(text)
  if (!inspection.ok || !inspection.data) {
    return {
      ok: false,
      message: inspection.error ?? 'That file could not be read. Nothing has been changed.',
      keys: [],
      restored: [],
      reset: [],
    }
  }

  let writes
  try {
    writes = planBackupWrites(inspection.data, STORAGE_KEYS, (key, raw) => fitStored(key, raw))
  } catch (error) {
    console.warn('[backup] could not prepare the import', error)
    return {
      ok: false,
      message: 'That backup could not be read safely, so nothing has been changed.',
      keys: [],
      restored: [],
      reset: [],
    }
  }

  const carried = new Set(inspection.present)
  const restored: string[] = []
  const reset: string[] = []
  const written: string[] = []

  for (const { key, value } of writes) {
    try {
      window.localStorage.setItem(key, value)
      written.push(key)
      if (carried.has(key)) restored.push(key)
      else reset.push(key)
    } catch (error) {
      console.warn(`[backup] could not write ${key}`, error)
    }
  }

  if (!written.length) {
    return {
      ok: false,
      message: 'Nothing could be written, so nothing has been changed.',
      keys: [],
      restored: [],
      reset: [],
    }
  }

  // Saying what was reset matters: a partial backup quietly emptying a dataset is
  // the one outcome that would otherwise be invisible after the reload.
  const resetNote = reset.length
    ? ` and reset ${datasetCount(reset.length)} the backup did not contain`
    : ''
  return {
    ok: true,
    message: `Restored ${datasetCount(restored.length)}${resetNote}.`,
    keys: written,
    restored,
    reset,
  }
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'))
    reader.readAsText(file)
  })
}

/** How much is currently stored, for the Profile screen. */
export function storageFootprint(): { keys: number; bytes: number } {
  let bytes = 0
  let keys = 0
  for (const key of STORAGE_KEYS) {
    const raw = window.localStorage.getItem(key)
    if (raw == null) continue
    keys += 1
    bytes += raw.length * 2
  }
  return { keys, bytes }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
