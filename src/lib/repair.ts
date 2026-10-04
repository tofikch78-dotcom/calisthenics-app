/**
 * Fitting each stored key into the shape its renderer assumes.
 *
 * `reconcile` in `./reconcile` is the generic safety net: it holds an array to
 * being an array, an object to being an object, and a scalar to its own type.
 * That is enough to stop `null` from blanking the app, but it stops at the
 * *container*. Everything inside is taken on trust, so a value read back from
 * storage can still be a number where an id belongs, a string where an array
 * belongs, or a valid-looking object missing the field the next line reads.
 * Those are not theoretical here — they are what an imported backup, a
 * half-written value from another tab, or a build that renamed a field actually
 * produce — and each one throws somewhere a `.map` or a `.slice` is called on
 * it, which is a blank window the user cannot get out of.
 *
 * So every key gets a reviver here, and `usePersistentState` runs it on both
 * the first read and the cross-tab update, because a bad value can arrive from
 * either direction.
 *
 * ## What is kept and what is dropped
 *
 * Two rules, and the split between them is the whole design:
 *
 *   - **Settings** — the enumerated choices in `Profile`, the level overrides,
 *     a theme. An unrecognised value cannot be honoured and has no honest
 *     fallback other than the default, so it is normalised to that. Nothing is
 *     lost that the user cannot re-pick, and `daysPerWeek` survives a
 *     `preferredDays` scrub so the shape of their schedule is still there.
 *
 *   - **The user's own records** — workouts, sessions, records, weight, meals,
 *     skills. Entries are never dropped for having an id this build does not
 *     recognise. That id is normally an exercise that was renamed or removed in
 *     a later build, and the record is real work the user did; the UI already
 *     falls back to showing the raw id. Dropping it would quietly delete a PR
 *     or a training session. Only entries that carry no data at all — a `null`
 *     where an object belongs — are removed, because there is nothing in them
 *     to keep.
 *
 * The one judgement call is an unknown *record metric*, which is kept rather
 * than dropped for the same reason: `RecordsView` already renders an
 * unrecognised metric as a plain "Result" row instead of white-screening, so
 * the honest reading is that it was logged and this build cannot label it.
 *
 * Dates are the one place where an unreadable value is a whole entry rather than
 * a field, so both readings are taken: a `yyyy-mm-dd` day key as written, and an
 * ISO instant resolved through the local zone. `Date.parse` rolls a day that
 * does not exist forward into the next month, so an instant is only believed
 * once its date part has been checked. That is a recovery, not a leniency — an
 * unrecognised date string still drops the entry it dates, as it must.
 *
 * Imports are limited to `./dates` and `../data/taxonomy`, both plain modules
 * with no value imports of their own, so this stays directly exercisable from a
 * Node test.
 */
import { DIFFICULTY_ORDER, EQUIPMENT_ORDER, MOVEMENT_ORDER, MUSCLE_ORDER } from '../data/taxonomy.ts'
import { DAY_NAMES, toDateKey } from './dates.ts'
import type {
  Difficulty,
  Diet,
  Equipment,
  FoodItem,
  Goal,
  ItemStatus,
  LoggedSet,
  Meal,
  MealSlot,
  NutritionDay,
  NutritionTargets,
  Profile,
  PullUpAbility,
  RecordEntry,
  RecordMetric,
  SessionItem,
  SessionStatus,
  SetStatus,
  Sex,
  SkillProgress,
  TrainingLevel,
  WaterEntry,
  WeightEntry,
  WeightUnit,
  Workout,
  WorkoutItem,
  WorkoutSession,
} from '../types'

/* ── Reading primitives ─────────────────────────────────────────────────── */

type Rec = Record<string, unknown>

/** `true` only for a plain object, which is what every stored record must be. */
function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rec(value: unknown): Rec {
  return isRecord(value) ? value : {}
}

/** An array, or an empty one. Callers get `[]` rather than a throw. */
function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Objects only: the entries worth keeping are the ones that are objects. */
function recs(value: unknown): Rec[] {
  return arr(value).filter(isRecord)
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function nonEmptyStr(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * A number, or the fallback.
 *
 * A quoted number is accepted. A backup that came out of a spreadsheet, or a
 * hand-edited file, quotes its numbers, and reading `"3"` as `0` would silently
 * change a plan from three sets to none rather than merely looking odd. The
 * string has to be non-empty and numeric, so `""` and `"three"` are not
 * mistaken for numbers.
 */
function num(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

/** Optional numbers stay absent rather than becoming `NaN` in a chart. */
function optionalNum(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function optionalStr(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * A list of ids or labels.
 *
 * A lone string is read as a one-item list. `"none"` in place of `["none"]` is
 * what a hand-edited profile looks like, and reading it as an empty kit would
 * quietly drop what the user actually said they train with.
 */
function strArray(value: unknown): string[] {
  if (typeof value === 'string') return value.length > 0 ? [value] : []
  return arr(value).filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
}

/**
 * An enumerated value from storage, falling back to `fallback` when this build
 * has no entry for it. This is what turns an unknown `Equipment` or `Diet`
 * into a real one instead of a `.label` lookup on `undefined`.
 */
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

/** Stored ids, de-duplicated, order kept, narrowed to a known vocabulary. */
function idList<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  const seen = new Set<T>()
  for (const entry of strArray(value)) {
    if (!(allowed as readonly string[]).includes(entry)) continue
    seen.add(entry as T)
  }
  return [...seen]
}

/* ── Known vocabularies, shared with the tests ──────────────────────────── */

export const RECORD_METRICS: RecordMetric[] = ['reps', 'hold', 'weight']
export const SESSION_STATUSES: SessionStatus[] = ['planned', 'in-progress', 'completed', 'partial', 'skipped']
export const ITEM_STATUSES: ItemStatus[] = ['not-started', 'in-progress', 'completed', 'skipped']
export const SET_STATUSES: SetStatus[] = ['pending', 'done', 'skipped']
export const GOALS: Goal[] = ['gain-muscle', 'gain-weight', 'maintain', 'lose-weight', 'strength', 'skills']
export const DIETS: Diet[] = ['omnivore', 'flexitarian', 'pescatarian', 'vegetarian', 'vegan', 'other']
export const SEXES: Sex[] = ['female', 'male', 'other', 'undisclosed']
export const PULL_UP_ABILITIES: PullUpAbility[] = ['none', 'assisted', 'single', 'multiple']
export const TRAINING_LEVELS: TrainingLevel[] = ['beginner', 'intermediate', 'advanced']
export const WEIGHT_UNITS: WeightUnit[] = ['kg', 'lb']
export const THEMES: Profile['theme'][] = ['dark', 'light']
export const MEAL_SLOTS: MealSlot[] = [
  'breakfast',
  'snack',
  'lunch',
  'pre-workout',
  'post-workout',
  'dinner',
  'other',
]
export const EQUIPMENT_IDS: Equipment[] = EQUIPMENT_ORDER
export const DIFFICULTY_IDS: Difficulty[] = DIFFICULTY_ORDER
export const MUSCLE_IDS = MUSCLE_ORDER
export const MOVEMENT_IDS = MOVEMENT_ORDER
export const DAY_NAME_LIST = DAY_NAMES

/** Days in a month, leap years included. */
function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one, which gets February
  // right in a leap year without a special case.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * A day key is the one date shape the whole app agrees on.
 *
 * The parts are checked rather than trusting `Date.parse`, because the built-in
 * parser is lenient about a day that does not exist: `2026-02-31` and
 * `2026-13-01` both come back as a real `Date`, rolled forward into March and
 * into January. Accepting those would file a day under a different day and
 * render a date the user never logged, with nothing to show that it happened.
 */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return false
  return day >= 1 && day <= daysInMonth(year, month)
}

/**
 * A moment in time, or nothing.
 *
 * `Date.parse` is lenient about a day that does not exist, exactly as it is for
 * a bare date — `2026-02-31T00:00:00Z` comes back as a real instant in March —
 * so a string is only believed once its date part has been through `isDateKey`
 * and the whole thing parses. The app writes an epoch millisecond number, but a
 * backup assembled by hand or carried over from a build that kept ISO strings
 * lands here, and refusing it would drop the record it belongs to.
 */
function instant(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return undefined
  const cut = value.indexOf('T')
  if (cut < 0) return undefined
  if (!isDateKey(value.slice(0, cut))) return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * The local calendar day a stored record belongs to.
 *
 * A day key is taken as written. An ISO instant is resolved through the local
 * zone, because the instant is what the user meant: a session logged at 23:30
 * belongs to that evening's day, wherever the clock says that evening is.
 */
function storedDay(value: unknown): string | null {
  if (isDateKey(value)) return value
  const at = instant(value)
  return at === undefined ? null : toDateKey(new Date(at))
}

export function isEquipment(value: unknown): value is Equipment {
  return typeof value === 'string' && EQUIPMENT_ORDER.includes(value as Equipment)
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && DIFFICULTY_ORDER.includes(value as Difficulty)
}

/* ── Profile ───────────────────────────────────────────────────────────── */

/**
 * Everything the profile renders or the nutrition math reads, normalised.
 *
 * The arrays are the reason this is not just `reconcile`: a shallow merge
 * happily replaces `equipment` with the string `"none"` or `preferredDays`
 * with `null`, and the next thing that happens is a `.map` on it.
 */
export function reviveProfile(raw: unknown, fallback: Profile): Profile {
  const value = rec(raw)
  return {
    onboarded: bool(value.onboarded, fallback.onboarded),
    onboardedAt: instant(value.onboardedAt) ?? fallback.onboardedAt,
    name: optionalStr(value.name),
    age: optionalNum(value.age),
    sex: oneOf(value.sex, SEXES, fallback.sex),
    heightCm: optionalNum(value.heightCm),
    weightKg: optionalNum(value.weightKg),
    goals: idList(value.goals ?? fallback.goals, GOALS),
    level: oneOf(value.level, TRAINING_LEVELS, fallback.level),
    maxPushups: optionalNum(value.maxPushups),
    maxDips: optionalNum(value.maxDips),
    maxSquats: optionalNum(value.maxSquats),
    pullUpAbility: oneOf(value.pullUpAbility, PULL_UP_ABILITIES, fallback.pullUpAbility),
    maxPullups: optionalNum(value.maxPullups),
    equipment: idList(value.equipment ?? fallback.equipment, EQUIPMENT_ORDER),
    daysPerWeek: num(value.daysPerWeek, fallback.daysPerWeek),
    preferredDays: idList(value.preferredDays ?? fallback.preferredDays, DAY_NAMES),
    sessionMinutes: num(value.sessionMinutes, fallback.sessionMinutes),
    mealsPerDay: num(value.mealsPerDay, fallback.mealsPerDay),
    likedFoods: str(value.likedFoods, fallback.likedFoods),
    dislikedFoods: str(value.dislikedFoods, fallback.dislikedFoods),
    allergies: str(value.allergies, fallback.allergies),
    diet: oneOf(value.diet, DIETS, fallback.diet),
    foodBudget: optionalNum(value.foodBudget),
    unit: oneOf(value.unit, WEIGHT_UNITS, fallback.unit),
    theme: oneOf(value.theme, THEMES, fallback.theme),
  }
}

/* ── Workouts ──────────────────────────────────────────────────────────── */

function reviveWorkoutItems(raw: unknown): WorkoutItem[] {
  return recs(raw)
    .map((item, index) => ({
      id: str(item.id, `wi_${index}`),
      // Kept even when this build has no exercise with that id: see the header.
      exerciseId: str(item.exerciseId),
      sets: Math.max(0, Math.round(num(item.sets, 0))),
      reps: optionalNum(item.reps),
      holdSec: optionalNum(item.holdSec),
      restSec: Math.max(0, Math.round(num(item.restSec, 0))),
      weight: optionalNum(item.weight),
      notes: optionalStr(item.notes),
    }))
    // An item with no exercise id has nothing to render or track, so there is
    // nothing to keep.
    .filter((item) => item.exerciseId.length > 0)
}

/**
 * A workout whose line names an exercise this build does not have.
 *
 * Every surface that shows a workout resolves its lines through the catalogue
 * and drops the ones that do not come back, so the line was already invisible:
 * no name, no prescription, no way to start it, and nothing to tick off. It was
 * still counted though — `WorkoutSummary` and the session runner add up
 * `targetSets` across every line — so a workout carried over from a build that
 * renamed or removed an exercise advertised more sets than it could ever
 * deliver. `known` is how the line and the count are made to agree; passing
 * nothing keeps every line, which is what a caller with no catalogue can do.
 */
export type KnownExercises = ReadonlySet<string>

export function reviveWorkouts(raw: unknown, known?: KnownExercises): Workout[] {
  return recs(raw).map((value, index) => ({
    id: str(value.id, `w_${index}`),
    name: str(value.name, 'Workout'),
    day: optionalStr(value.day),
    notes: optionalStr(value.notes),
    items: reviveWorkoutItems(value.items).filter((item) => known?.has(item.exerciseId) !== false),
    createdAt: num(value.createdAt, 0),
    updatedAt: num(value.updatedAt, num(value.createdAt, 0)),
  }))
}

/* ── Sessions ──────────────────────────────────────────────────────────── */

/**
 * A set that is not an object is not a set. Counting one as a pending set would
 * invent a rep target the user never set and drag their completion percentage
 * down for a write that never happened.
 */
function reviveLoggedSet(raw: unknown): LoggedSet | null {
  if (!isRecord(raw)) return null
  return {
    reps: optionalNum(raw.reps),
    holdSec: optionalNum(raw.holdSec),
    weight: optionalNum(raw.weight),
    status: oneOf(raw.status, SET_STATUSES, 'pending'),
  }
}

function reviveSessionItems(raw: unknown): SessionItem[] {
  return recs(raw).map((value, index) => ({
    id: str(value.id, `si_${index}`),
    exerciseId: str(value.exerciseId),
    targetSets: Math.max(0, Math.round(num(value.targetSets, 0))),
    targetReps: optionalNum(value.targetReps),
    targetHoldSec: optionalNum(value.targetHoldSec),
    targetWeight: optionalNum(value.targetWeight),
    targetRestSec: optionalNum(value.targetRestSec),
    sets: arr(value.sets)
      .map(reviveLoggedSet)
      .filter((set): set is LoggedSet => set !== null),
    status: oneOf(value.status, ITEM_STATUSES, 'not-started'),
    note: optionalStr(value.note),
  }))
}

/**
 * A session is filed under a local `yyyy-mm-dd` key, and every date view
 * groups on it, so a session whose date cannot be read has nowhere to go. The
 * instant it was started is the honest second reading, and it is used when it
 * is there; only a session with neither is dropped.
 */
function sessionDateKey(value: Rec): string | null {
  const fromDate = storedDay(value.date)
  if (fromDate !== null) return fromDate
  const startedAt = instant(value.startedAt)
  if (startedAt !== undefined && startedAt > 0) return toDateKey(new Date(startedAt))
  return null
}

export function reviveSessions(raw: unknown, known?: KnownExercises): WorkoutSession[] {
  return recs(raw)
    .map((value, index): WorkoutSession | null => {
      const date = sessionDateKey(value)
      if (date === null) return null
      return {
        id: str(value.id, `s_${index}`),
        workoutId: optionalStr(value.workoutId),
        workoutName: str(value.workoutName, 'Session'),
        date,
        startedAt: instant(value.startedAt) ?? 0,
        completedAt: instant(value.completedAt),
        durationSec: optionalNum(value.durationSec),
        // A session written before it was started, or with a status this build
        // has no entry for, reads as planned rather than as anything completed.
        status: oneOf(value.status, SESSION_STATUSES, 'planned'),
        items: reviveSessionItems(value.items).filter(
          (item) => known?.has(item.exerciseId) !== false,
        ),
        feel: optionalStr(value.feel),
        notes: optionalStr(value.notes),
      }
    })
    .filter((session): session is WorkoutSession => session !== null)
}

/* ── Records ───────────────────────────────────────────────────────────── */

export function reviveRecords(raw: unknown): RecordEntry[] {
  return recs(raw)
    .map((value, index) => ({
      id: str(value.id, `r_${index}`),
      // An exercise id this build does not know stays, and reads as its raw id.
      exerciseId: str(value.exerciseId),
      // A metric this build does not know stays too: `RecordsView` renders one
      // as a plain "Result" row, and dropping the row would lose a real best.
      metric: (nonEmptyStr(value.metric) ?? 'reps') as RecordMetric,
      value: num(value.value, 0),
      achievedAt: instant(value.achievedAt) ?? 0,
      sessionId: optionalStr(value.sessionId),
    }))
    .filter((entry) => entry.exerciseId.length > 0)
}

/* ── Skills ────────────────────────────────────────────────────────────── */

/**
 * A stage id this build does not know is kept: the entry is still the user's
 * own record, and a cleared skill would otherwise have no `stageExerciseId` at
 * all. `SkillsView` only counts the entries it can place on a ladder, so an
 * unplaceable one neither inflates the "skills started" tally nor shows a rung
 * it cannot name — the card offers the entry rung instead.
 */
export function reviveSkillProgress(raw: unknown): SkillProgress[] {
  return recs(raw)
    .map((value) => ({
      skillId: str(value.skillId),
      stageExerciseId: str(value.stageExerciseId),
      updatedAt: instant(value.updatedAt) ?? 0,
    }))
    .filter((entry) => entry.skillId.length > 0 && entry.stageExerciseId.length > 0)
}

/* ── Level overrides ───────────────────────────────────────────────────── */

/**
 * A level override is a `Difficulty` written by an earlier build, so an
 * unrecognised value is dropped rather than defaulted: the automatic level is
 * the honest answer, and defaulting would show a level the user never chose.
 */
export function reviveLevels(raw: unknown): Record<string, Difficulty> {
  const out: Record<string, Difficulty> = {}
  for (const [exerciseId, level] of Object.entries(rec(raw))) {
    if (isDifficulty(level)) out[exerciseId] = level
  }
  return out
}

/** Suggestion ids the user dismissed, and when. */
export function reviveDismissed(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, at] of Object.entries(rec(raw))) {
    const when = instant(at)
    if (when !== undefined) out[id] = when
  }
  return out
}

/* ── Nutrition ─────────────────────────────────────────────────────────── */

function reviveFoodItems(raw: unknown): FoodItem[] {
  return recs(raw).map((value, index) => ({
    id: str(value.id, `f_${index}`),
    name: str(value.name, 'Food'),
    qty: num(value.qty, 0),
    unit: str(value.unit, 'serving'),
    kcal: num(value.kcal, 0),
    protein: num(value.protein, 0),
    carbs: num(value.carbs, 0),
    fat: num(value.fat, 0),
  }))
}

function reviveMeals(raw: unknown): Meal[] {
  return recs(raw).map((value, index) => ({
    id: str(value.id, `m_${index}`),
    slot: oneOf(value.slot, MEAL_SLOTS, 'other'),
    name: str(value.name, 'Meal'),
    items: reviveFoodItems(value.items),
    done: bool(value.done, false),
  }))
}

/**
 * A drink with no usable amount is not a drink, and `addWaterEntry` refuses one
 * of those anyway. Dropping it here matters: an entry of nothing must not count
 * as "this day has a log", because that would make the day fall back to the
 * entry log instead of its stored total and quietly lose what the user drank.
 */
function reviveWaterEntries(raw: unknown): WaterEntry[] {
  return recs(raw)
    .map((value, index) => ({
      id: str(value.id, `w_${index}`),
      ml: num(value.ml, 0),
      at: instant(value.at) ?? 0,
    }))
    .filter((entry) => entry.ml > 0)
}

/**
 * `waterMl` is authoritative for anything that reads the total without the log,
 * so it is recomputed from the entries rather than trusted: a stored total that
 * disagrees with its own drinks would make the progress ring show a number the
 * user never logged. Days written before drinks were logged individually have
 * only `waterMl`, and `waterEntries()` gives them one implied entry.
 */
export function reviveNutritionDays(raw: unknown): NutritionDay[] {
  return recs(raw)
    .map((value) => {
      const date = storedDay(value.date)
      if (date === null) return null
      const water = reviveWaterEntries(value.water)
      const storedTotal = num(value.waterMl, 0)
      const waterMl = water.length > 0 ? water.reduce((total, entry) => total + entry.ml, 0) : storedTotal
      const day: NutritionDay = {
        date,
        meals: reviveMeals(value.meals),
        waterMl: Math.max(0, Math.round(waterMl)),
      }
      if (water.length > 0) day.water = water
      const note = optionalStr(value.note)
      if (note !== undefined) day.note = note
      return day
    })
    .filter((day): day is NutritionDay => day !== null)
}

export function reviveNutritionTargets(raw: unknown, fallback: NutritionTargets): NutritionTargets {
  const value = rec(raw)
  return {
    kcal: num(value.kcal, fallback.kcal),
    protein: num(value.protein, fallback.protein),
    carbs: num(value.carbs, fallback.carbs),
    fat: num(value.fat, fallback.fat),
    waterMl: num(value.waterMl, fallback.waterMl),
    auto: bool(value.auto, fallback.auto),
  }
}

/* ── Weight log ────────────────────────────────────────────────────────── */

/**
 * A day is the key here, so two entries for one day would double-count in the
 * trend. The later one wins, which is exactly what `logWeight` does when the
 * same day is weighed in twice, so a repaired log and a written one agree.
 */
export function reviveWeightEntries(raw: unknown): WeightEntry[] {
  const byDate = new Map<string, WeightEntry>()
  recs(raw).forEach((value) => {
    const date = storedDay(value.date)
    const kg = optionalNum(value.kg)
    if (date === null || kg === undefined) return
    byDate.set(date, { date, kg })
  })
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/* ── Small keys ────────────────────────────────────────────────────────── */

/**
 * Saved-exercise ids. Unknown ones are kept; the library filters them out.
 *
 * A lone string reads as a one-item list, which is the point of this reviver
 * running ahead of `reconcile` at the storage boundary rather than behind it:
 * `"pull-ups"` in place of `["pull-ups"]` survives to here instead of being
 * replaced by an empty list, and the user's saved exercise comes back.
 */
export function reviveIds(raw: unknown): string[] {
  return [...new Set(strArray(raw))]
}

export function reviveTheme(raw: unknown, fallback: Profile['theme']): Profile['theme'] {
  return oneOf(raw, THEMES, fallback)
}

/**
 * A session id, or nothing. The hook that reads this key already drops an id
 * that no longer names an in-progress session, so all this has to do is refuse
 * the values that are not ids at all — a number, an object, an empty string.
 */
export function reviveActiveSessionId(raw: unknown): string | null {
  return nonEmptyStr(raw) ?? null
}