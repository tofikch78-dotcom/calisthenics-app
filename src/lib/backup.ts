import { STORAGE_KEYS } from './store'

/**
 * Backup, restore and reset. Everything the app knows lives in localStorage
 * under `calisthenics:*`, so a JSON file is a complete, portable copy.
 */

export const BACKUP_VERSION = 1

export interface BackupFile {
  app: 'calisthenics-exercise-library'
  version: number
  exportedAt: string
  data: Record<string, unknown>
}

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
    app: 'calisthenics-exercise-library',
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
}

/** Validates and writes a backup. Keys outside the app's namespace are ignored. */
export function restoreBackup(text: string): RestoreResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, message: 'That file is not valid JSON.', keys: [] }
  }

  const file = parsed as Partial<BackupFile>
  if (file.app !== 'calisthenics-exercise-library' || typeof file.data !== 'object' || !file.data) {
    return { ok: false, message: 'That is not a Calisthenics backup file.', keys: [] }
  }

  const allowed = new Set<string>(STORAGE_KEYS)
  const written: string[] = []

  for (const [key, value] of Object.entries(file.data)) {
    if (!allowed.has(key)) continue
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
      written.push(key)
    } catch (error) {
      console.warn(`[backup] could not write ${key}`, error)
    }
  }

  if (!written.length) {
    return { ok: false, message: 'The backup contained nothing this app recognises.', keys: [] }
  }

  return {
    ok: true,
    message: `Restored ${written.length} ${written.length === 1 ? 'dataset' : 'datasets'}.`,
    keys: written,
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
