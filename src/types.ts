export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export type Movement =
  | 'push'
  | 'pull'
  | 'legs'
  | 'core'
  | 'static'
  | 'skills'

export type Equipment =
  | 'none'
  | 'floor'
  | 'dip-bars'
  | 'pull-up-bar'
  | 'bands'
  | 'dumbbells'
  | 'backpack'
  | 'rings'
  | 'parallettes'
  | 'other'

export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'full-body'

/** How an exercise is dosed. Rep-based, hold-based, or both. */
export interface Dosage {
  sets: number
  /** Only for rep-based movements. */
  reps?: number
  /** Only for isometrics / static holds. */
  holdSec?: number
  restSec: number
  /** Optional coaching note, e.g. "per side" or "count a 2-second lowering". */
  note?: string
}

export interface Exercise {
  id: string
  name: string
  difficulty: Difficulty
  movement: Movement
  /** Equipment required. Empty array is treated as `['none']`. */
  equipment: Equipment[]
  mainMuscle: Muscle
  secondaryMuscles: Muscle[]
  description: string
  steps: string[]
  mistakes: string[]
  /** Exercise ids that are easier progressions. */
  easier: string[]
  /** Exercise ids that are harder progressions. */
  harder: string[]
  dosage: Dosage
  /** Keys into the pose library, played as a looping animation. */
  animation?: string[]
  /** Extra search terms that don't appear in the name. */
  keywords?: string[]
}

export interface WorkoutItem {
  id: string
  exerciseId: string
  sets: number
  reps?: number
  holdSec?: number
  restSec: number
  /** kg or lb depending on the user's unit preference. */
  weight?: number
  notes?: string
}

export interface Workout {
  id: string
  name: string
  /** Optional day label, e.g. "Monday". */
  day?: string
  notes?: string
  items: WorkoutItem[]
  createdAt: number
  updatedAt: number
}

/* ── Onboarding & profile ───────────────────────────────────────────────── */

export type Sex = 'female' | 'male' | 'other' | 'undisclosed'

export type Goal =
  | 'gain-muscle'
  | 'gain-weight'
  | 'maintain'
  | 'lose-weight'
  | 'strength'
  | 'skills'

export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced'

export type PullUpAbility = 'none' | 'assisted' | 'single' | 'multiple'

export type Diet = 'omnivore' | 'flexitarian' | 'pescatarian' | 'vegetarian' | 'vegan' | 'other'

export type WeightUnit = 'kg' | 'lb'

/** Everything the onboarding wizard collects. Never hard-coded — always the user's own answers. */
export interface Profile {
  onboarded: boolean
  onboardedAt: number
  name?: string
  age?: number
  sex: Sex
  heightCm?: number
  weightKg?: number
  goals: Goal[]
  level: TrainingLevel
  maxPushups?: number
  maxDips?: number
  maxSquats?: number
  pullUpAbility: PullUpAbility
  maxPullups?: number
  equipment: Equipment[]
  daysPerWeek: number
  preferredDays: string[]
  sessionMinutes: number
  mealsPerDay: number
  likedFoods: string
  dislikedFoods: string
  allergies: string
  diet: Diet
  foodBudget?: number
  unit: WeightUnit
  theme: 'dark' | 'light'
}

/* ── Workout sessions (actual performed training) ───────────────────────── */

export type SetStatus = 'pending' | 'done' | 'skipped'

/** Per-exercise tracking inside a session. */
export type ItemStatus = 'not-started' | 'in-progress' | 'completed' | 'skipped'

/** Per-workout tracking. Never derived from opening the app — only from real work. */
export type SessionStatus = 'planned' | 'in-progress' | 'completed' | 'partial' | 'skipped'

export interface LoggedSet {
  reps?: number
  holdSec?: number
  weight?: number
  status: SetStatus
}

export interface SessionItem {
  id: string
  exerciseId: string
  /** Target, copied from the workout line when the session starts. */
  targetSets: number
  targetReps?: number
  targetHoldSec?: number
  targetWeight?: number
  /** Prescribed rest between working sets, in seconds. Drives the rest timer. */
  targetRestSec?: number
  sets: LoggedSet[]
  status: ItemStatus
  note?: string
}

export interface WorkoutSession {
  id: string
  /** The workout template this came from, when it came from one. */
  workoutId?: string
  workoutName: string
  /** Local calendar day, `yyyy-mm-dd`. The date the session is filed under. */
  date: string
  startedAt: number
  completedAt?: number
  durationSec?: number
  status: SessionStatus
  items: SessionItem[]
  /** "How did you feel?" */
  feel?: string
  notes?: string
}

/* ── Records, skills, nutrition, weight ─────────────────────────────────── */

export type RecordMetric = 'reps' | 'hold' | 'weight'

/** Every new best is appended, so the previous record is always in the history. */
export interface RecordEntry {
  id: string
  exerciseId: string
  metric: RecordMetric
  value: number
  achievedAt: number
  sessionId?: string
}

export interface SkillProgress {
  skillId: string
  /** Which rung of the ladder the user is currently on. */
  stageExerciseId: string
  updatedAt: number
}

export type MealSlot =
  | 'breakfast'
  | 'snack'
  | 'lunch'
  | 'pre-workout'
  | 'post-workout'
  | 'dinner'
  | 'other'

export interface FoodItem {
  id: string
  name: string
  qty: number
  /** g / ml / serving / piece … */
  unit: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface Meal {
  id: string
  slot: MealSlot
  name: string
  items: FoodItem[]
  done: boolean
}

export interface NutritionDay {
  date: string
  meals: Meal[]
  waterMl: number
  note?: string
}

export interface NutritionTargets {
  kcal: number
  protein: number
  carbs: number
  fat: number
  waterMl: number
  /** When true the targets are recalculated from the profile on every render. */
  auto: boolean
}

export interface WeightEntry {
  date: string
  kg: number
}
