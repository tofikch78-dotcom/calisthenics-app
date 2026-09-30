import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Difficulty,
  Exercise,
  Meal,
  NutritionDay,
  NutritionTargets,
  Profile,
  RecordEntry,
  SkillProgress,
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

/**
 * State that mirrors itself into localStorage and stays in sync with other
 * open tabs of the same app.
 */
function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStored(key, initial))

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
        setValue(JSON.parse(event.newValue) as T)
      } catch {
        /* ignore malformed payloads from other tabs */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
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

export function useWorkouts() {
  const [workouts, setWorkouts] = usePersistentState<Workout[]>(WORKOUTS_KEY, [])

  const createWorkout = useCallback(
    (name: string, day?: string) => {
      const now = Date.now()
      const workout: Workout = {
        id: createId('wk'),
        name: name.trim() || 'New workout',
        day: day?.trim() || undefined,
        items: [],
        createdAt: now,
        updatedAt: now,
      }
      setWorkouts((current) => [workout, ...current])
      return workout
    },
    [setWorkouts],
  )

  const updateWorkout = useCallback(
    (id: string, patch: Partial<Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>>) => {
      setWorkouts((current) =>
        current.map((workout) =>
          workout.id === id ? { ...workout, ...patch, updatedAt: Date.now() } : workout,
        ),
      )
    },
    [setWorkouts],
  )

  const deleteWorkout = useCallback(
    (id: string) => setWorkouts((current) => current.filter((workout) => workout.id !== id)),
    [setWorkouts],
  )

  const duplicateWorkout = useCallback(
    (id: string) => {
      let copy: Workout | undefined
      setWorkouts((current) =>
        current.flatMap((workout) => {
          if (workout.id !== id) return [workout]
          const now = Date.now()
          copy = {
            ...workout,
            id: createId('wk'),
            name: `${workout.name} (copy)`,
            items: workout.items.map((item) => ({ ...item, id: createId('item') })),
            createdAt: now,
            updatedAt: now,
          }
          return [copy, workout]
        }),
      )
      return copy
    },
    [setWorkouts],
  )

  return { workouts, createWorkout, updateWorkout, deleteWorkout, duplicateWorkout }
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

  const deleteSession = useCallback(
    (id: string) => setSessions((current) => current.filter((session) => session.id !== id)),
    [setSessions],
  )

  return { sessions, addSession, updateSession, deleteSession }
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
  const [days, setDays] = usePersistentState<NutritionDay[]>(NUTRITION_KEY, [])

  const updateDay = useCallback(
    (date: string, patch: Partial<Omit<NutritionDay, 'date'>>) => {
      setDays((current) => {
        const index = current.findIndex((day) => day.date === date)
        if (index === -1) {
          return [{ date, meals: [], waterMl: 0, ...patch }, ...current]
        }
        const next = [...current]
        next[index] = { ...next[index], ...patch }
        return next
      })
    },
    [setDays],
  )

  const addMeal = useCallback(
    (date: string, meal: Meal) => {
      // The editor seeds a blank meal with an empty id; give it a real one here
      // so later edits and deletes address exactly one meal. An id supplied by
      // an imported backup is kept as-is.
      const stored: Meal = meal.id ? meal : { ...meal, id: createId('meal') }
      setDays((current) => {
        const index = current.findIndex((day) => day.date === date)
        if (index === -1) return [{ date, meals: [stored], waterMl: 0 }, ...current]
        const next = [...current]
        next[index] = { ...next[index], meals: [...next[index].meals, stored] }
        return next
      })
    },
    [setDays],
  )

  const updateMeal = useCallback(
    (date: string, mealId: string, patch: Partial<Meal>) => {
      setDays((current) =>
        current.map((day) =>
          day.date === date
            ? { ...day, meals: day.meals.map((meal) => (meal.id === mealId ? { ...meal, ...patch } : meal)) }
            : day,
        ),
      )
    },
    [setDays],
  )

  const deleteMeal = useCallback(
    (date: string, mealId: string) => {
      setDays((current) =>
        current.map((day) =>
          day.date === date
            ? { ...day, meals: day.meals.filter((meal) => meal.id !== mealId) }
            : day,
        ),
      )
    },
    [setDays],
  )

  return { days, updateDay, addMeal, updateMeal, deleteMeal }
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
  const theme = readStored<'dark' | 'light'>(THEME_KEY, 'dark')
  document.documentElement.dataset.theme = theme
  return theme
}

/** Theme lives outside the profile so it applies before the app mounts. */
export function useTheme() {
  const [theme, setTheme] = usePersistentState<'dark' | 'light'>(THEME_KEY, 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return { theme, setTheme }
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
