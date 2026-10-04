/**
 * Taxonomy lookups, and the guarded form of them.
 *
 * Every one of these tables is indexed by a string that arrives from somewhere
 * other than the code that renders it: the user's stored profile, a session or
 * record saved by an older build, an imported backup, or another tab mid-write.
 * `TABLES[key]` on one of those is `undefined`, and `.label` on that is the
 * throw that takes a whole tab down with it — there is no server copy to fall
 * back to and no account to re-sync from.
 *
 * So nothing renders a taxonomy entry by indexing a table directly any more.
 * The `*Meta` helpers return an entry, falling back to a neutral one that says
 * `Unknown` and carries no colour, so an id this build has no entry for reads
 * as unknown instead of throwing or inventing a muscle it isn't. Inventing data
 * would be worse than admitting the gap: a green "Chest" chip on an unrecognised
 * id would be a confident lie about what the user trained.
 *
 * The fallbacks live here rather than in the tables so the tables stay a plain
 * description of the taxonomy. They deliberately use the neutral ink colours,
 * which exist in both themes.
 *
 * Parameters are `string`, not the `Muscle` / `Equipment` unions, because the
 * values reaching here come from storage where the union is only a hope. Every
 * typed call site still fits, since a `Muscle` is a `string`.
 *
 * It has no imports beyond `../data/taxonomy`, which is a plain table module, so
 * it stays directly exercisable and React Fast Refresh in dev is left alone.
 */
import { DIFFICULTIES, EQUIPMENT, MOVEMENTS, MUSCLES, MUSCLE_ACCENT } from '../data/taxonomy.ts'
import type { DifficultyMeta, TaxonomyEntry } from '../data/taxonomy.ts'

/** What an id this build has no entry for is called on screen. */
export const UNKNOWN_LABEL = 'Unknown'

/** No colour, so an unknown muscle is not painted as one it might not be. */
const NEUTRAL_ACCENT = {
  text: 'text-mist-400',
  chip: 'bg-ink-700/60 text-mist-300 ring-ink-600/70',
  bar: 'bg-ink-500',
}

/**
 * A difficulty badge still has to render, so an unknown one gets a dot rather
 * than an indicator: one to three filled would claim a level that was never set.
 */
const NEUTRAL_DIFFICULTY: DifficultyMeta = {
  label: UNKNOWN_LABEL,
  indicator: '·',
  chip: 'bg-ink-700/60 text-mist-300 ring-ink-600/70',
  dot: 'bg-ink-500',
  text: 'text-mist-400',
}

const UNKNOWN_ENTRY: TaxonomyEntry = { label: UNKNOWN_LABEL }

export interface MuscleAccent {
  text: string
  chip: string
  bar: string
}

/**
 * `Object.hasOwn` rather than `table[key]` truthiness so a value that is
 * present but falsy is not mistaken for a missing one.
 *
 * The `typeof` guard is what a stored value runs into: the key is coerced to a
 * string before it is looked up, and coercing an object calls its `toString`,
 * which throws outright if that property is not callable.
 */
function read<T>(table: Record<string, T>, key: string, fallback: T): T {
  if (typeof key !== 'string') return fallback
  return Object.hasOwn(table, key) ? table[key] : fallback
}

/* ── Muscles ───────────────────────────────────────────────────────────── */

export function muscleMeta(muscle: string): TaxonomyEntry {
  return read(MUSCLES as Record<string, TaxonomyEntry>, muscle, UNKNOWN_ENTRY)
}

export function muscleLabel(muscle: string): string {
  return muscleMeta(muscle).label
}

/** The accent classes for a muscle, neutral ones when the id is unknown. */
export function muscleAccent(muscle: string): MuscleAccent {
  return read(MUSCLE_ACCENT as Record<string, MuscleAccent>, muscle, NEUTRAL_ACCENT)
}

/* ── Equipment ─────────────────────────────────────────────────────────── */

export function equipmentMeta(equipment: string): TaxonomyEntry {
  return read(EQUIPMENT as Record<string, TaxonomyEntry>, equipment, UNKNOWN_ENTRY)
}

export function equipmentLabel(equipment: string): string {
  return equipmentMeta(equipment).label
}

/* ── Movements ─────────────────────────────────────────────────────────── */

export function movementMeta(movement: string): TaxonomyEntry {
  return read(MOVEMENTS as Record<string, TaxonomyEntry>, movement, UNKNOWN_ENTRY)
}

export function movementLabel(movement: string): string {
  return movementMeta(movement).label
}

/* ── Difficulty, which carries presentational classes as well as a label ─── */

export function difficultyMeta(level: string): DifficultyMeta {
  return read(DIFFICULTIES as Record<string, DifficultyMeta>, level, NEUTRAL_DIFFICULTY)
}

export function difficultyLabel(level: string): string {
  return difficultyMeta(level).label
}