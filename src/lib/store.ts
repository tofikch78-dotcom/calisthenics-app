import { useCallback, useEffect, useMemo, useState } from 'react'
import { reconcile } from './reconcile'
import {
  addWaterEntry,
  dropMeal,
  ensureDay,
  insertMeal,
  normaliseDay,
  patchMeal,
  removeWaterEntry,
  updateWaterEntry,
  waterEntries,
  withDay,
} from './nutrition-day'
import type {
  Difficulty,
  Exercise,
  Meal,
  NutritionDay,
  NutritionTargets,
  Profile,
  RecordEntry,
  SkillProgress,
  WaterEntry,
  WeightEntry,
  Workout,
  WorkoutItem,
  WorkoutSession,
} from '../types'

const PREFIX = 'calisthenics:'
const MY_EXERCISES_KEY = `${PREFIX}my-exercises`
const WORKOUTS_KEY = `${PREFIX}workouts`
const SESSIONS_KEY = `${PREFIX}sessions`
const RECORDS_KEY = `${PREFIX}records`
const NUTRITION_KEY = `${PREFIX}nutrition`
const NUTRITION_TARGETS_KEY = `${PREFIX}nutrition-targets`
const WEIGHT_KEY = `${PREFIX}weight-log`
const SKILLS_KEY = `${PREFIX}skills`
const LEVELS_KEY = `${PREFIX}levels`
const DISMISSED_KEY = `${PREFIX}dismissed-suggestions`
const PROFILE_KEY = `${PREFIX}profile`
const THEME_KEY = `${PREFIX}theme`
const ACTIVE_SESSION_KEY = `${PREFIX}active-session`

/** Every key the app owns, used by the export / import / reset flow. */
export const STORAGE_KEYS = [
  MY_EXERCISES_KEY,
  WORKOUTS_KEY,
  SESSIONS_KEY,
  RECORDS_KEY,
  NUTRITION_KEY,
  NUTRITION_TARGETS_KEY,
  WEIGHT_KEY,
  SKILLS_KEY,
  LEVELS_KEY,
  DISMISSED_KEY,
  PROFILE_KEY,
  THEME_KEY,
  ACTIVE_SESSION_KEY,
] as const

export function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn(`[store] could not read ${key}`, error)
    return fallback
  }
}

/* Re-exported so this stays the one import site for everything storage-shaped. */
export { reconcile } from './reconcile'

/**
 * State that mirrors itself into localStorage and stays in sync with other
 * open tabs of the same app.
 */
function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => reconcile(readStored<unknown>(key, initial), initial))

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.warn(`[store] could not persist ${key}`, error)
    }
  }, [key, value])

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== key || event.newValue == null) return
      try {
        setValue(reconcile<T>(JSON.parse(event.newValue), initial))
      } catch {
        /* ignore malformed payloads from other tabs */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // `initial` is a module-level constant for every caller, so it is stable
    // and deliberately not a dependency: re-running on it would fight the
    // user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return [value, setValue] as const
}

export function useMyExercises() {
  const [ids, setIds] = usePersistentState<string[]>(MY_EXERCISES_KEY, [])
  const saved = useCallback((id: string) => ids.includes(id), [ids])
  const savedIds = useMemo(() => new Set(ids), [ids])

  const add = useCallback(
    (id: string) => setIds((current) => (current.includes(id) ? current : [id, ...current])),
    [setIds],
  )

  const remove = useCallback(
    (id: string) => setIds((current) => current.filter((item) => item !== id)),
    [setIds],
  )

  const toggle = useCallback((id: string) => setIds((current) =>
    current.includes(id) ? current.filter((item) => item !== id) : [id, ...current],
  ), [setIds])

  const clear = useCallback(() => setIds([]), [setIds])

  return { ids, savedIds, saved, add, remove, toggle, clear }
}

export function createId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}${random}`
}

/** A fresh id for a single workout line. */
export function makeItemId(): string {
  return createId('item')
}

/**
 * Builds a workout line pre-filled with the exercise's own recommended dosage,
 * so adding "Pull-ups" starts at 4 × 6 rather than a generic 3 × 10.
 */
export function makeWorkoutItem(exercise: Exercise, index: number): WorkoutItem {
  return {
    id: createId('item'),
    exerciseId: exercise.id,
    sets: exercise.dosage.sets,
    reps: exercise.dosage.reps,
    holdSec: exercise.dosage.holdSec,
    restSec: exercise.dosage.restSec,
    notes: index === 0 ? '' : undefined,
  }
}

/**
 * Keeps only the first workout for each id.
 *
 * Every edit, save and delete addresses a workout by its id, so two entries
 * sharing an id is the one state the builder must never produce: React would
 * reuse a DOM node across two different workouts, and "delete this one" would
 * silently remove both. The list only ever grows through the helpers below,
 * which all funnel through here, so a duplicate can only arrive from outside —
 * a hand-edited or merged backup file — and this clears it on the next write.
 */
function dedupeWorkouts(list: Workout[]): Workout[] {
  const seen = new Set<string>()
  return list.filter((workout) => {
    if (seen.has(workout.id)) return false
    seen.add(workout.id)
    return true
  })
}

/**
 * A new, not-yet-saved workout. The id is minted once, here, and then travels
 * with the workout for its whole life: saving it inserts, and saving it again
 * updates the same row. Basing the decision on the id rather than on the name
 * is what stops "Save workout" from ever producing a second copy.
 */
export function newWorkoutDraft(name = '', day?: string): Workout {
  const now = Date.now()
  return {
    id: createId('wk'),
    name: name.trim(),
    day: day?.trim() || undefined,
    items: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function useWorkouts() {
  const [stored, setWorkouts] = usePersistentState<Workout[]>(WORKOUTS_KEY, [])
  // Cleans up a backup that carried duplicates, so every caller — and every
  // `key` in a list — can rely on ids being unique.
  const workouts = useMemo(() => dedupeWorkouts(stored), [stored])

  const createWorkout = useCallback(
    (name: string, day?: string) => {
      const workout = newWorkoutDraft(name || 'New workout', day)
      setWorkouts((current) => dedupeWorkouts([workout, ...current]))
      return workout
    },
    [setWorkouts],
  )

  /**
   * The builder's one save path. A draft whose id is already saved replaces
   * that entry in place, keeping its position and `createdAt`; anything else is
   * inserted. Saving the same draft ten times leaves one workout.
   *
   * Merging from the stored entry rather than replacing it means fields written
   * by an older build, or by an imported file, survive an edit.
   */
  const saveWorkout = useCallback(
    (draft: Workout): Workout => {
      const now = Date.now()
      const saved: Workout = {
        ...draft,
        id: draft.id || createId('wk'),
        name: draft.name.trim() || 'New workout',
        day: draft.day?.trim() || undefined,
        updatedAt: now,
      }
      setWorkouts((current) => {
        const list = dedupeWorkouts(current)
        const index = list.findIndex((workout) => workout.id === saved.id)
        if (index === -1) return [{ ...saved, createdAt: saved.createdAt || now }, ...list]
        const next = [...list]
        next[index] = { ...list[index], ...saved, createdAt: list[index].createdAt, updatedAt: now }
        return next
      })
      return saved
    },
    [setWorkouts],
  )

  const updateWorkout = useCallback(
    (id: string, patch: Partial<Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>>) => {
      setWorkouts((current) => {
        const list = dedupeWorkouts(current)
        // An unknown id is a no-op rather than an insert: silently adding a
        // workout nobody asked for is how duplicates get in.
        if (!list.some((workout) => workout.id === id)) return list
        return list.map((workout) =>
          workout.id === id ? { ...workout, ...patch, updatedAt: Date.now() } : workout,
        )
      })
    },
    [setWorkouts],
  )

  const deleteWorkout = useCallback(
    (id: string) =>
      setWorkouts((current) => dedupeWorkouts(current).filter((workout) => workout.id !== id)),
    [setWorkouts],
  )

  const duplicateWorkout = useCallback(
    (id: string) => {
      let copy: Workout | undefined
      setWorkouts((current) => {
        const list = dedupeWorkouts(current)
        const next: Workout[] = []
        for (const workout of list) {
          if (workout.id === id) {
            const now = Date.now()
            copy = {
              ...workout,
              // A copy is a genuinely new workout, so it gets a new id — but a
              // fresh "n copy" name that the user can rename, not a second row
              // that collides with the original.
              id: createId('wk'),
              name: `${workout.name} (copy)`,
              items: workout.items.map((item) => ({ ...item, id: createId('item') })),
              createdAt: now,
              updatedAt: now,
            }
            next.push(copy)
          }
          next.push(workout)
        }
        return next
      })
      return copy
    },
    [setWorkouts],
  )

  return { workouts, createWorkout, saveWorkout, updateWorkout, deleteWorkout, duplicateWorkout }
}

/* ── Sessions: the only source of "training actually happened" ───────────── */

export function useSessions() {
  const [sessions, setSessions] = usePersistentState<WorkoutSession[]>(SESSIONS_KEY, [])

  const addSession = useCallback(
    (session: WorkoutSession) => {
      setSessions((current) => [session, ...current.filter((s) => s.id !== session.id)])
      return session
    },
    [setSessions],
  )

  const updateSession = useCallback(
    (id: string, patch: Partial<Omit<WorkoutSession, 'id' | 'startedAt'>>) => {
      setSessions((current) =>
        current.map((session) => (session.id === id ? { ...session, ...patch } : session)),
      )
    },
    [setSessions],
  )

  /**
   * Edits one session from a function of its current value.
   *
   * This is the only safe way to change a live session. The screen renders every
   * exercise at once and the updater runs synchronously inside the state
   * setter, so a tap that arrives before React has re-rendered still sees the
   * result of the previous tap. A patch computed from the rendered props is
   * already stale by then, and two quick edits collapse into one — which is how
   * a set silently stopped being recorded.
   */
  const editSession = useCallback(
    (
      id: string,
      change: (session: WorkoutSession) => Partial<Omit<WorkoutSession, 'id' | 'startedAt'>> | null,
    ) => {
      setSessions((current) =>
        current.map((session) => {
          if (session.id !== id) return session
          const patch = change(session)
          return patch ? { ...session, ...patch } : session
        }),
      )
    },
    [setSessions],
  )

  const deleteSession = useCallback(
    (id: string) => setSessions((current) => current.filter((session) => session.id !== id)),
    [setSessions],
  )

  return { sessions, addSession, updateSession, editSession, deleteSession }
}

/* ── Which session is on screen ───────────────────────────────────────────── */

/**
 * The id of the session the user was last working on.
 *
 * The session itself was always in storage, but the *pointer* to it lived only
 * in React state, so a refresh left the work safely written down and the app
 * with no way back to it: no badge, no auto-resume, and — for a session started
 * before midnight — nothing on Home or Today offering it at all. Persisting the
 * pointer is what makes closing and reopening the app resume the workout rather
 * than merely avoid losing it.
 *
 * A stale id is self-healing: the effect below drops it once the session it
 * named is gone or finished, so this can never strand the app on a session that
 * does not exist.
 */
export function useActiveSessionId() {
  const [id, setId] = usePersistentState<string | null>(ACTIVE_SESSION_KEY, null)

  /*
   * A stale id is dropped: if the session it named has been finished, discarded
   * or removed — here, in another tab, or by a restored backup — the pointer is
   * cleared so the app cannot open on a session that does not exist.
   *
   * `setId` is a `useState` setter, so its identity is stable for the lifetime of
   * the component and naming it as a dependency would be noise; the comment keeps
   * the omission deliberate rather than an oversight.
   */
  useEffect(() => {
    if (!id) return
    const raw = readStored<WorkoutSession[]>(SESSIONS_KEY, [])
    const session = Array.isArray(raw) ? raw.find((entry) => entry?.id === id) : undefined
    if (!session || session.status !== 'in-progress') setId(null)
  }, [id, setId])

  return [id, setId] as const
}

/* ── Personal records ───────────────────────────────────────────────────── */

export function useRecords() {
  const [records, setRecords] = usePersistentState<RecordEntry[]>(RECORDS_KEY, [])

  /**
   * Appends a record only when it beats the previous best for that metric.
   * Returns whether it actually counted, so callers can tell the user the
   * truth instead of celebrating a number that was quietly dropped.
   */
  const addRecord = useCallback(
    (entry: Omit<RecordEntry, 'id' | 'achievedAt'> & { achievedAt?: number }): boolean => {
      const best = bestFor(records, entry.exerciseId, entry.metric)
      if (entry.value <= best) return false
      const created: RecordEntry = {
        ...entry,
        id: createId('pr'),
        achievedAt: entry.achievedAt ?? Date.now(),
      }
      // A plain append: the comparison happened above, so the updater stays
      // pure and safe to run more than once.
      setRecords((current) => [created, ...current])
      return true
    },
    [records, setRecords],
  )

  const deleteRecord = useCallback(
    (id: string) => setRecords((current) => current.filter((record) => record.id !== id)),
    [setRecords],
  )

  return { records, addRecord, deleteRecord }
}

/** The best value already recorded for an exercise on one metric. */
export function bestFor(
  records: RecordEntry[],
  exerciseId: string,
  metric: RecordEntry['metric'],
): number {
  return records
    .filter((entry) => entry.exerciseId === exerciseId && entry.metric === metric)
    .reduce((max, entry) => Math.max(max, entry.value), 0)
}

/* ── Skills & levels ────────────────────────────────────────────────────── */

export function useSkillProgress() {
  const [progress, setProgress] = usePersistentState<SkillProgress[]>(SKILLS_KEY, [])

  const setStage = useCallback(
    (skillId: string, stageExerciseId: string) => {
      setProgress((current) => [
        ...current.filter((entry) => entry.skillId !== skillId),
        { skillId, stageExerciseId, updatedAt: Date.now() },
      ])
    },
    [setProgress],
  )

  return { progress, setStage }
}

/** Manual difficulty overrides, layered on top of the automatic assessment. */
export function useLevelOverrides() {
  const [overrides, setOverrides] = usePersistentState<Record<string, Difficulty>>(LEVELS_KEY, {})

  const setOverride = useCallback(
    (exerciseId: string, level: Difficulty | null) => {
      setOverrides((current) => {
        const next = { ...current }
        if (level === null) delete next[exerciseId]
        else next[exerciseId] = level
        return next
      })
    },
    [setOverrides],
  )

  return { overrides, setOverride }
}

/** Suggestions the user has said no to. They stay gone until performance changes. */
export function useDismissedSuggestions() {
  const [dismissed, setDismissed] = usePersistentState<Record<string, number>>(DISMISSED_KEY, {})
  const dismiss = useCallback(
    (key: string) => setDismissed((current) => ({ ...current, [key]: Date.now() })),
    [setDismissed],
  )
  return { dismissed, dismiss }
}

/* ── Nutrition & weight ─────────────────────────────────────────────────── */

export function useNutrition() {
  const [stored, setDays] = usePersistentState<NutritionDay[]>(NUTRITION_KEY, [])

  // Days written before the drink log still carry only `waterMl`. Reconciling
  // them here means every consumer sees the same totals, and the first write
  // settles them into the new shape without a separate migration step.
  const days = useMemo(() => stored.map(normaliseDay), [stored])

  const addMeal = useCallback(
    (date: string, meal: Meal) => setDays((current) => insertMeal(current, date, meal)),
    [setDays],
  )

  const updateMeal = useCallback(
    (date: string, mealId: string, patch: Partial<Meal>) =>
      setDays((current) => patchMeal(current, date, mealId, patch)),
    [setDays],
  )

  const deleteMeal = useCallback(
    (date: string, mealId: string) => setDays((current) => dropMeal(current, date, mealId)),
    [setDays],
  )

  // Water goes through the drink log rather than a bare total, so a drink can be
  // corrected or removed on its own instead of by tapping backwards in steps.
  // Each of these reads the stored day inside the updater: tapping "+250 ml"
  // four times in one burst has to record four drinks, not one.
  //
  // `waterMl` is deliberately not settable from outside. It is derived from the
  // drinks, and a caller writing it directly would be silently overwritten by
  // the next normalisation — which is the whole class of bug the log replaces.
  const addWater = useCallback(
    (date: string, ml: number) =>
      setDays((current) =>
        ensureDay(current, date, (day) => ({
          ...day,
          water: addWaterEntry(waterEntries(day), ml, Date.now()),
        })),
      ),
    [setDays],
  )

  const updateWater = useCallback(
    (date: string, entryId: string, patch: Partial<Omit<WaterEntry, 'id'>>) =>
      setDays((current) =>
        withDay(current, date, (day) => ({
          ...day,
          water: updateWaterEntry(waterEntries(day), entryId, patch),
        })),
      ),
    [setDays],
  )

  const removeWater = useCallback(
    (date: string, entryId: string) =>
      setDays((current) =>
        withDay(current, date, (day) => ({
          ...day,
          water: removeWaterEntry(waterEntries(day), entryId),
        })),
      ),
    [setDays],
  )

  return {
    days,
    addMeal,
    updateMeal,
    deleteMeal,
    addWater,
    updateWater,
    removeWater,
  }
}

export function useNutritionTargets() {
  const [targets, setTargets] = usePersistentState<NutritionTargets>(NUTRITION_TARGETS_KEY, {
    kcal: 2200,
    protein: 140,
    carbs: 220,
    fat: 70,
    waterMl: 2500,
    auto: true,
  })
  return { targets, setTargets }
}

export function useWeightLog() {
  const [entries, setEntries] = usePersistentState<WeightEntry[]>(WEIGHT_KEY, [])

  const logWeight = useCallback(
    (date: string, kg: number) => {
      setEntries((current) => [
        ...current.filter((entry) => entry.date !== date),
        { date, kg },
      ].sort((a, b) => a.date.localeCompare(b.date)))
    },
    [setEntries],
  )

  const deleteWeight = useCallback(
    (date: string) => setEntries((current) => current.filter((entry) => entry.date !== date)),
    [setEntries],
  )

  return { entries, logWeight, deleteWeight }
}

/* ── Profile & theme ────────────────────────────────────────────────────── */

export const DEFAULT_PROFILE: Profile = {
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

export function useProfile() {
  const [profile, setProfile] = usePersistentState<Profile>(PROFILE_KEY, DEFAULT_PROFILE)

  const update = useCallback(
    (patch: Partial<Profile>) => setProfile((current) => ({ ...current, ...patch })),
    [setProfile],
  )

  const completeOnboarding = useCallback(
    (answers: Partial<Profile>) =>
      setProfile((current) => ({
        ...current,
        ...answers,
        onboarded: true,
        onboardedAt: Date.now(),
      })),
    [setProfile],
  )

  return { profile, update, completeOnboarding }
}

/**
 * Applies the stored theme straight to the document, before React mounts, so a
 * light-mode user never sees a dark flash on first paint.
 */
export function preloadTheme(): 'dark' | 'light' {
  // Validated explicitly, because this runs before anything can recover: an
  // unexpected value here would leave the document in a theme that does not
  // exist, and it is set straight onto <html>.
  const theme = readStored<string>(THEME_KEY, 'dark') === 'light' ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme
  return theme
}

/** Theme lives outside the profile so it applies before the app mounts. */
export function useTheme() {
  const [stored, setStored] = usePersistentState<string>(THEME_KEY, 'dark')
  // Narrowed rather than merely type-checked: a theme is one of two exact
  // values, and anything else would be written straight onto <html> where it
  // means no theme at all. Dark is the safe answer, not a crash.
  const theme: 'dark' | 'light' = stored === 'light' ? 'light' : 'dark'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return { theme, setTheme: setStored }
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/** Moves an item inside an array, clamping to the ends. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return items
  const clamped = Math.max(0, Math.min(items.length - 1, to))
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(clamped, 0, moved)
  return next
}

export function resetAllData() {
  for (const key of STORAGE_KEYS) window.localStorage.removeItem(key)
  window.location.reload()
}
