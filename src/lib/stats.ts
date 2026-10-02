import { getExercise } from '../data'
import { addDays, dayNameOf, startOfWeek, todayKey, weekDays } from './dates'
import {
  deriveSessionStatus,
  emptySessionStats,
  isTraining,
  sessionStats,
  type SessionStats,
} from './session-stats'
import type { Profile, Workout, WorkoutSession } from '../types'

/* ── Per-session maths ───────────────────────────────────────────────────── */

/*
 * Reading what a session contains lives in `session-stats`, where it has no
 * dependency on the exercise catalogue or the calendar. Re-exported here because
 * this is where the rest of the derived numbers live and callers already import
 * them from here.
 */
export { deriveSessionStatus, emptySessionStats, isTraining, sessionStats, type SessionStats }

/* ── Calendar status ────────────────────────────────────────────────────── */

export type DayStatus = 'completed' | 'partial' | 'skipped' | 'rest' | 'planned' | 'empty'

export const DAY_STATUS_META: Record<
  DayStatus,
  { label: string; indicator: string; chip: string; dot: string }
> = {
  completed: {
    label: 'Completed',
    indicator: '🟢',
    chip: 'bg-lime-glow/15 text-lime-glow ring-lime-glow/30',
    dot: 'bg-lime-glow',
  },
  partial: {
    label: 'Partially completed',
    indicator: '🟡',
    chip: 'bg-amber-glow/15 text-amber-glow ring-amber-glow/30',
    dot: 'bg-amber-glow',
  },
  skipped: {
    label: 'Skipped',
    indicator: '🔴',
    chip: 'bg-rose-glow/15 text-rose-glow ring-rose-glow/30',
    dot: 'bg-rose-glow',
  },
  rest: {
    label: 'Rest',
    indicator: '⚪',
    chip: 'bg-ink-800 text-mist-400 ring-ink-600',
    dot: 'bg-ink-500',
  },
  planned: {
    label: 'Planned',
    indicator: '🔵',
    chip: 'bg-brand-400/15 text-brand-300 ring-brand-400/30',
    dot: 'bg-brand-400',
  },
  empty: {
    label: 'Nothing logged',
    indicator: '',
    chip: 'bg-ink-850 text-mist-500 ring-ink-700',
    dot: 'bg-ink-700',
  },
}

/**
 * The status of a calendar day.
 *
 * A day is only ever `completed` or `partial` because a session recorded real
 * sets. Opening the app or having a workout scheduled never marks a day done.
 */
export function dayStatus(
  dateKey: string,
  sessionsByDate: Map<string, WorkoutSession[]>,
  plannedDays: ReadonlySet<string>,
): DayStatus {
  const sessions = sessionsByDate.get(dateKey) ?? []
  if (sessions.length) {
    const statuses = sessions.map((session) => session.status)
    if (statuses.every((status) => status === 'skipped')) return 'skipped'
    if (statuses.every((status) => status === 'completed')) return 'completed'
    if (statuses.some((status) => status === 'completed' || status === 'partial')) return 'partial'
    return 'skipped'
  }
  if (plannedDays.has(dayNameOf(dateKey))) return 'planned'
  return 'rest'
}

export function groupSessionsByDate(sessions: WorkoutSession[]): Map<string, WorkoutSession[]> {
  const map = new Map<string, WorkoutSession[]>()
  for (const session of sessions) {
    map.set(session.date, [...(map.get(session.date) ?? []), session])
  }
  return map
}

/** The weekdays the user said they train, from onboarding. */
export function plannedWeekdays(profile: Profile | null, workouts: Workout[]): Set<string> {
  const days = new Set<string>()
  for (const day of profile?.preferredDays ?? []) days.add(day)
  for (const workout of workouts) if (workout.day) days.add(workout.day)
  return days
}

/* ── Streak ─────────────────────────────────────────────────────────────── */

export interface StreakInfo {
  /** Consecutive training days. Rest days are skipped, not counted against. */
  days: number
  /** The most recent training day, or null if there is none. */
  lastTrainedOn: string | null
  /** True when the streak ends today (or has not been extended yet today). */
  active: boolean
}

/**
 * Counts consecutive training days walking backwards from today.
 *
 * A day with no session is a rest day and does **not** break the streak — but a
 * day the user planned to train and then missed does. Today gets a pass until
 * it is over.
 */
export function computeStreak(
  sessions: WorkoutSession[],
  profile: Profile | null,
  workouts: Workout[],
  today = todayKey(),
): StreakInfo {
  const byDate = groupSessionsByDate(sessions)
  const plannedDays = plannedWeekdays(profile, workouts)

  const trainedOn = (key: string) => (byDate.get(key) ?? []).some(isTraining)

  let cursor = trainedOn(today) ? today : addDays(today, -1)
  let days = 0
  let lastTrainedOn: string | null = trainedOn(today) ? today : null
  let active = trainedOn(today)

  // Bounded so a corrupted date can never spin here.
  for (let step = 0; step < 3650; step += 1) {
    if (trainedOn(cursor)) {
      days += 1
      lastTrainedOn = lastTrainedOn ?? cursor
      cursor = addDays(cursor, -1)
      continue
    }
    if (plannedDays.has(dayNameOf(cursor))) {
      // A missed planned day ends the streak. Today is not over yet.
      if (cursor === today) {
        cursor = addDays(cursor, -1)
        continue
      }
      break
    }
    cursor = addDays(cursor, -1)
  }

  return { days, lastTrainedOn, active }
}

/* ── Weekly summary ─────────────────────────────────────────────────────── */

export interface WeekSummary {
  start: string
  end: string
  days: string[]
  planned: number
  /** Sessions actually logged inside the week, whatever their outcome. */
  sessions: number
  completed: number
  partial: number
  skipped: number
  /** completed + partial, as a share of everything that was planned or attempted. */
  completion: number
  exercises: number
  sets: number
  reps: number
  seconds: number
  /** Per-day status, ready for a week strip. */
  byDay: { date: string; status: DayStatus }[]
}

export function weekSummary(
  sessions: WorkoutSession[],
  profile: Profile | null,
  workouts: Workout[],
  weekStart = startOfWeek(todayKey()),
): WeekSummary {
  const days = weekDays(weekStart)
  const byDate = groupSessionsByDate(sessions)
  const plannedDays = plannedWeekdays(profile, workouts)

  const summary: WeekSummary = {
    start: days[0],
    end: days[6],
    days,
    planned: 0,
    sessions: 0,
    completed: 0,
    partial: 0,
    skipped: 0,
    completion: 0,
    exercises: 0,
    sets: 0,
    reps: 0,
    seconds: 0,
    byDay: [],
  }

  let attended = 0
  let credited = 0

  for (const date of days) {
    const daySessions = byDate.get(date) ?? []
    if (daySessions.length) summary.planned += daySessions.length
    else if (plannedDays.has(dayNameOf(date))) summary.planned += 1

    const status = dayStatus(date, byDate, plannedDays)
    summary.byDay.push({ date, status })
    if (status === 'completed') summary.completed += 1
    if (status === 'partial') summary.partial += 1
    if (status === 'skipped') summary.skipped += 1

    for (const session of daySessions) {
      const stats = sessionStats(session)
      attended += 1
      summary.sessions += 1
      if (isTraining(session)) {
        credited += stats.completion / 100
        summary.exercises += stats.exercisesDone
        summary.sets += stats.setsDone
        summary.reps += stats.reps
        summary.seconds += session.durationSec ?? 0
      }
    }
  }

  summary.completion = attended
    ? Math.round((credited / attended) * 100)
    : summary.planned
      ? 0
      : 0

  return summary
}

/* ── All-time totals ────────────────────────────────────────────────────── */

export interface Totals {
  sessions: number
  exercises: number
  sets: number
  reps: number
  seconds: number
  bestStreak: number
}

export function totals(sessions: WorkoutSession[], profile: Profile | null, workouts: Workout[]): Totals {
  const result: Totals = {
    sessions: 0,
    exercises: 0,
    sets: 0,
    reps: 0,
    seconds: 0,
    bestStreak: 0,
  }

  const byDate = groupSessionsByDate(sessions)
  const trainingDates = [...byDate.keys()].filter((date) => (byDate.get(date) ?? []).some(isTraining)).sort()

  for (const session of sessions) {
    if (!isTraining(session)) continue
    const stats = sessionStats(session)
    result.sessions += 1
    result.exercises += stats.exercisesDone
    result.sets += stats.setsDone
    result.reps += stats.reps
    result.seconds += session.durationSec ?? 0
  }

  // Longest run of consecutive training dates, rest days ignored.
  let run = 0
  let previous: string | null = null
  for (const date of trainingDates) {
    if (previous && date !== addDays(previous, 1) && (byDate.get(date) ?? []).length) {
      // A day that was logged but skipped still counts as a break only if it
      // was planned; otherwise it is simply a rest day.
      const planned = plannedWeekdays(profile, workouts).has(dayNameOf(date))
      if (planned) run = 0
    }
    run += 1
    result.bestStreak = Math.max(result.bestStreak, run)
    previous = date
  }

  return result
}

/* ── History ────────────────────────────────────────────────────────────── */

export interface HistoryEntry {
  session: WorkoutSession
  stats: SessionStats
}

export function history(sessions: WorkoutSession[]): HistoryEntry[] {
  return [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt)
    .map((session) => ({ session, stats: sessionStats(session) }))
}

/* ── Records derived from a finished session ─────────────────────────────── */

export interface RecordCandidate {
  exerciseId: string
  name: string
  metric: 'reps' | 'hold' | 'weight'
  value: number
  unit: string
}

/**
 * Personal-record candidates inside a session: the best single set, and the
 * best added load. Callers decide whether each value actually beats a record.
 */
export function recordCandidates(session: WorkoutSession): RecordCandidate[] {
  const out: RecordCandidate[] = []
  for (const item of session.items) {
    const exercise = getExercise(item.exerciseId)
    if (!exercise) continue
    const done = item.sets.filter((set) => set.status === 'done')

    const bestReps = done.reduce((max, set) => Math.max(max, set.reps ?? 0), 0)
    if (bestReps > 0) {
      out.push({ exerciseId: item.exerciseId, name: exercise.name, metric: 'reps', value: bestReps, unit: 'reps' })
    }

    const bestHold = done.reduce((max, set) => Math.max(max, set.holdSec ?? 0), 0)
    if (bestHold > 0) {
      out.push({ exerciseId: item.exerciseId, name: exercise.name, metric: 'hold', value: bestHold, unit: 's' })
    }

    const bestWeight = done.reduce((max, set) => Math.max(max, set.weight ?? 0), 0)
    if (bestWeight > 0) {
      out.push({ exerciseId: item.exerciseId, name: exercise.name, metric: 'weight', value: bestWeight, unit: 'kg' })
    }
  }
  return out
}

