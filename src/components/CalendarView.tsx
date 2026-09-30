import { useState } from 'react'
import { getExercise } from '../data'
import {
  DAY_STATUS_META,
  dayStatus,
  groupSessionsByDate,
  plannedWeekdays,
  sessionStats,
  type DayStatus,
} from '../lib/stats'
import {
  DAY_SHORT,
  formatDuration,
  monthGrid,
  monthTitle,
  relativeDay,
  todayKey,
} from '../lib/dates'
import type { Profile, Workout, WorkoutSession } from '../types'
import { Card, IconChevron, Pill, ProgressBar, StatTile } from './kit'

export interface CalendarViewProps {
  sessions: WorkoutSession[]
  workouts: Workout[]
  profile: Profile | null
  onOpenSession: (session: WorkoutSession) => void
}

export function CalendarView({ sessions, workouts, profile, onOpenSession }: CalendarViewProps) {
  const today = todayKey()
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selected, setSelected] = useState<string | null>(null)

  const byDate = groupSessionsByDate(sessions)
  const plannedDays = plannedWeekdays(profile, workouts)
  const grid = monthGrid(cursor.year, cursor.month)

  const shift = (delta: number) => {
    const date = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: date.getFullYear(), month: date.getMonth() })
  }

  const monthCount = grid.filter(
    (key) => key.startsWith(`${cursor.year}-${`${cursor.month + 1}`.padStart(2, '0')}`),
  ).length
  const monthSessions = grid
    .filter((key) => key.startsWith(`${cursor.year}-${`${cursor.month + 1}`.padStart(2, '0')}`))
    .flatMap((key) => byDate.get(key) ?? [])

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="rotate-180 rounded-lg border border-ink-600 p-2 text-mist-300 transition hover:border-ink-500 hover:text-white"
          >
            <IconChevron className="h-3.5 w-3.5" />
          </button>
          <h3 className="text-sm font-semibold text-mist-100">{monthTitle(cursor.year, cursor.month)}</h3>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next month"
            className="rounded-lg border border-ink-600 p-2 text-mist-300 transition hover:border-ink-500 hover:text-white"
          >
            <IconChevron className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
            <div key={day} className="pb-1 text-center text-[10px] font-medium text-mist-500">
              {DAY_SHORT[day]}
            </div>
          ))}

          {grid.map((key) => {
            const status = dayStatus(key, byDate, plannedDays)
            const inMonth = new Date(`${key}T00:00:00`).getMonth() === cursor.month
            const isToday = key === today
            const isSelected = key === selected
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(isSelected ? null : key)}
                aria-label={`${key} — ${DAY_STATUS_META[status].label}`}
                aria-pressed={isSelected}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-xs transition ${
                  isSelected
                    ? 'border-brand-400/60 bg-brand-500/15'
                    : isToday
                      ? 'border-brand-400/40 bg-ink-800'
                      : 'border-transparent hover:border-ink-600 hover:bg-ink-800/60'
                } ${inMonth ? 'text-mist-100' : 'text-ink-500'}`}
              >
                <span className="tnum leading-none font-medium">{Number(key.slice(-2))}</span>
                <span
                  className={`mt-1 size-1.5 rounded-full ${DAY_STATUS_META[status].dot} ${
                    status === 'rest' || status === 'empty' ? 'opacity-40' : ''
                  }`}
                />
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2.5 border-t border-ink-700 pt-3">
          {(Object.keys(DAY_STATUS_META) as DayStatus[]).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5 text-[10px] text-mist-400">
              <span className={`size-2 rounded-full ${DAY_STATUS_META[status].dot}`} />
              {status === 'empty' ? 'Nothing logged' : DAY_STATUS_META[status].label}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile value={monthCount} label="Days in month" />
        <StatTile
          value={monthSessions.filter((s) => s.status === 'completed').length}
          label="Workouts completed"
          tone="ok"
        />
        <StatTile
          value={monthSessions.filter((s) => s.status === 'partial').length}
          label="Partially completed"
          tone="warn"
        />
        <StatTile
          value={monthSessions.reduce((sum, s) => sum + (s.durationSec ?? 0), 0) > 0
            ? formatDuration(monthSessions.reduce((sum, s) => sum + (s.durationSec ?? 0), 0))
            : '0m'}
          label="Time trained"
        />
      </div>

      {selected && <DayDetail date={selected} sessions={byDate.get(selected) ?? []} onOpenSession={onOpenSession} />}
    </div>
  )
}

function DayDetail({
  date,
  sessions,
  onOpenSession,
}: {
  date: string
  sessions: WorkoutSession[]
  onOpenSession: (session: WorkoutSession) => void
}) {
  if (!sessions.length) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-mist-100">{relativeDay(date)}</h3>
          <Pill className="bg-ink-800 text-mist-400 ring-ink-600">⚪ Rest or unplanned</Pill>
        </div>
        <p className="mt-2 text-xs text-mist-400">
          Nothing was logged on this day. Rest days are part of training — they just don&apos;t count
          towards the streak.
        </p>
      </Card>
    )
  }

  return (
    <Card className="animate-rise">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-mist-100">{relativeDay(date)}</h3>
        <Pill className="bg-ink-800 text-mist-300 ring-ink-600">{sessions.length} session(s)</Pill>
      </div>

      <ul className="space-y-3">
        {sessions.map((session) => {
          const stats = sessionStats(session)
          return (
            <li key={session.id} className="rounded-xl border border-ink-700 bg-ink-900/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-mist-100">{session.workoutName}</h4>
                <Pill
                  className={
                    session.status === 'completed'
                      ? DAY_STATUS_META.completed.chip
                      : session.status === 'partial'
                        ? DAY_STATUS_META.partial.chip
                        : DAY_STATUS_META.skipped.chip
                  }
                >
                  {session.status === 'completed' ? '🟢 Completed' : session.status === 'partial' ? '🟡 Partial' : '🔴 Skipped'}
                </Pill>
              </div>

              <ProgressBar
                value={stats.completion}
                className="mt-2.5"
                tone={stats.completion === 100 ? 'ok' : stats.completion > 0 ? 'warn' : 'bad'}
                label={`${session.workoutName} completion`}
              />

              <div className="tnum mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-mist-400 sm:grid-cols-3">
                <span>Exercises done: {stats.exercisesDone}/{stats.exercisesTotal}</span>
                <span>Exercises skipped: {stats.exercisesSkipped}</span>
                <span>Sets: {stats.setsDone}/{stats.setsTotal}</span>
                <span>Total reps: {stats.reps}</span>
                <span>Hold time: {stats.holdSec}s</span>
                <span>Duration: {formatDuration(session.durationSec ?? 0)}</span>
              </div>
              <p className="tnum mt-2 text-xs font-semibold text-mist-100">Completion: {stats.completion}%</p>

              <ul className="mt-2 space-y-1">
                {session.items.map((item) => {
                  const exercise = getExercise(item.exerciseId)
                  const setsDone = item.sets.filter((set) => set.status === 'done').length
                  return (
                    <li key={item.id} className="flex items-center gap-2 text-[11px]">
                      <span aria-hidden="true">
                        {item.status === 'completed'
                          ? '✅'
                          : item.status === 'skipped'
                            ? '⭕'
                            : setsDone > 0
                              ? '🟡'
                              : '⚪'}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate ${
                          item.status === 'skipped' ? 'text-mist-500 line-through' : 'text-mist-200'
                        }`}
                      >
                        {exercise?.name ?? item.exerciseId}
                      </span>
                      <span className="tnum shrink-0 text-mist-400">
                        {item.status === 'skipped' ? 'skipped' : `${setsDone}/${item.sets.length}`}
                      </span>
                    </li>
                  )
                })}
              </ul>

              {session.feel && (
                <p className="mt-2 text-[11px] text-mist-400">
                  Felt: <span className="text-mist-200">{session.feel}</span>
                </p>
              )}
              {session.notes && (
                <p className="mt-1 rounded-lg bg-ink-850 px-2.5 py-1.5 text-[11px] text-mist-300 italic">
                  “{session.notes}”
                </p>
              )}

              <button
                type="button"
                onClick={() => onOpenSession(session)}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-brand-300 transition hover:text-brand-200"
              >
                Open on the Workout tab →
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
