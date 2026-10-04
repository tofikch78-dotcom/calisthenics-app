/*
 * The `.ts` extensions on the two runtime imports below are load-bearing, not
 * decoration: Node's ESM resolver does not guess an extension for a bare
 * specifier, and type-only imports are erased before it ever looks. They are
 * what lets `verify-progress.mjs` import this file directly and check the streak,
 * the week summary and the totals as pure functions.
 */
import { addDays, dayNameOf, startOfWeek, todayKey, weekDays } from './dates.ts'
import {
  deriveSessionStatus,
  emptySessionStats,
  isTraining,
  sessionStats,
  type SessionStats,
} from './session-stats.ts'
import type { Profile, Workout, WorkoutSession } from '../types'

/* ── Per-session maths ───────────────────────────────────────────────────── */

/*
 * Reading what a session contains lives in `session-stats`, where it has no
 * dependency on the exercise catalogue or the calendar. Re-exported here because
 * this is where the rest of the derived numbers live and callers already import
 * them from here.
 */
export { deriveSessionStatus, emptySessionStats, isTraining, sessionStats, type SessionStats }

/*
 * Everything in this file is pure arithmetic over stored sessions, the profile's
 * planned days and the calendar — no exercise catalogue. That is what lets
 * `verify-progress.mjs` check the streak, the week summary and the all-time
 * totals directly instead of through the screen. The one Progress-side reading
 * that does need the library, the record candidates a finished session
 * produces, lives in `record-candidates.ts`.
 */

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
  /**
   * The day the streak ended on — today when it is live, otherwise the last day
   * the run reached before a missed planned day stopped it. Null when nothing
   * was trained inside the run, which is not the same as "never trained": a
   * streak that died yesterday names yesterday's predecessor, or nothing if the
   * missed planned day came first.
   */
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
  /**
   * Days in the week the user was expected to train: a day with any session
   * logged, or a planned weekday they left empty. Counted in days so it lines
   * up with `completed` / `partial` / `skipped`, which are day statuses — two
   * sessions on one planned day used to read as "1/2 completed".
   */
  planned: number
  /** Sessions actually logged inside the week, whatever their outcome. */
  sessions: number
  completed: number
  partial: number
  skipped: number
  /**
   * How much of the prescribed work was actually done, as a percentage.
   *
   * The mean of each attended session's set completion — **not** a share of
   * days. A week of four days where one day was half-finished scores 88, not
   * 75, and reading it as "days finished" (next to `completed` / `planned`)
   * overstates it. `completed + partial` in days is the attendance figure; this
   * is the effort figure.
   */
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
    if (daySessions.length || plannedDays.has(dayNameOf(date))) summary.planned += 1

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

  // A week nothing was attempted in is 0%, not an average of nothing.
  summary.completion = attended ? Math.round((credited / attended) * 100) : 0

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

  /*
   * Longest run of consecutive training dates, using the same rule as
   * `computeStreak`: a plain rest day is skipped, but a planned day the user
   * missed ends the run.
   *
   * The gap between two training days is walked day by day. Checking only the
   * day the gap *ends* on let a streak survive a missed Wednesday when the user
   * trained Monday and then Thursday, so "best streak" could disagree with the
   * streak being shown right next to it.
   */
  const plannedDays = plannedWeekdays(profile, workouts)
  const missedPlannedDay = (from: string, to: string) => {
    for (let cursor = addDays(from, 1); cursor < to; cursor = addDays(cursor, 1)) {
      if (plannedDays.has(dayNameOf(cursor)) && !(byDate.get(cursor) ?? []).some(isTraining)) {
        return true
      }
    }
    return false
  }

  let run = 0
  let previous: string | null = null
  for (const date of trainingDates) {
    if (previous && date !== addDays(previous, 1) && missedPlannedDay(previous, date)) run = 0
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

/*
 * The records a finished session produces are derived in
 * `record-candidates.ts`, which is the one Progress-side reading that has to
 * resolve an exercise in the library.
 */

