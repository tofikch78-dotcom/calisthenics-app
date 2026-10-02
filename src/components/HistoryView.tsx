import { useMemo, useState } from 'react'
import { getExercise } from '../data'
import {
  DAY_SHORT,
  formatDateKey,
  formatDuration,
  relativeDay,
  startOfWeek,
  todayKey,
  addDays,
} from '../lib/dates'
import {
  DAY_STATUS_META,
  history,
  weekSummary,
  type StreakInfo,
  type WeekSummary,
} from '../lib/stats'
import type { Profile, Workout, WorkoutSession } from '../types'
import { Card, IconFlame, IconNote, Pill, ProgressBar, ProgressRing, StatTile } from './kit'

export interface HistoryViewProps {
  sessions: WorkoutSession[]
  workouts: Workout[]
  profile: Profile | null
  streak: StreakInfo
  onOpenSession: (session: WorkoutSession) => void
}

type Range = 'week' | 'month' | 'all'

export function HistoryView({ sessions, workouts, profile, streak, onOpenSession }: HistoryViewProps) {
  const [range, setRange] = useState<Range>('week')
  const [today] = useState(todayKey)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayKey()))

  const week = useMemo(
    () => weekSummary(sessions, profile, workouts, weekStart),
    [sessions, profile, workouts, weekStart],
  )

  const entries = useMemo(() => history(sessions), [sessions])
  const filtered = useMemo(() => {
    if (range === 'all') return entries
    return entries.filter((entry) => entry.session.date >= weekStart && entry.session.date <= today)
  }, [entries, range, weekStart, today])

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <ProgressRing
            value={week.completion}
            size={84}
            tone={week.completion >= 80 ? 'ok' : week.completion >= 40 ? 'warn' : 'bad'}
          >
            <div>
              <div className="tnum text-base leading-none font-bold text-mist-100">{week.completion}%</div>
              <div className="mt-0.5 text-[9px] text-mist-400">week done</div>
            </div>
          </ProgressRing>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-mist-100">This week</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-glow/15 px-2 py-0.5 text-[11px] font-bold text-amber-glow ring-1 ring-amber-glow/30">
                <IconFlame className="h-3 w-3" />
                {streak.days}
              </span>
            </div>
            <p className="tnum mt-0.5 text-[11px] text-mist-400">
              {formatDateKey(week.start)} – {formatDateKey(week.end)}
            </p>
            <div className="mt-2 flex gap-1">
              {week.byDay.map((day) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] text-mist-500">{DAY_SHORT[new Date(`${day.date}T00:00:00`).getDay()]}</span>
                  <span
                    title={DAY_STATUS_META[day.status].label}
                    className={`h-6 w-full rounded-md ${day.status === 'completed' ? 'bg-lime-glow/70' : day.status === 'partial' ? 'bg-amber-glow/70' : day.status === 'skipped' ? 'bg-rose-glow/60' : day.status === 'planned' ? 'bg-brand-400/40' : 'bg-ink-700'}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile value={`${week.completed}/${week.planned || 0}`} label="Completed / planned" tone="ok" />
          <StatTile value={week.skipped} label="Skipped" tone={week.skipped ? 'bad' : 'default'} />
          <StatTile value={week.sets} label="Sets completed" />
          <StatTile value={week.reps} label="Total reps" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatTile value={week.exercises} label="Exercises done" />
          <StatTile value={formatDuration(week.seconds)} label="Training time" />
          <StatTile
            value={`${week.partial}`}
            label="Partial days"
            tone={week.partial ? 'warn' : 'default'}
          />
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-mist-100">Workout history</h3>
            <p className="mt-0.5 text-xs text-mist-400">
              Only sessions you actually logged appear here. Opening the app never marks anything done.
            </p>
          </div>
          <div className="flex gap-1">
            {(
              [
                ['week', 'Week'],
                ['month', 'Month'],
                ['all', 'All'],
              ] as [Range, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRange(id)}
                className={`min-h-11 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                  range === id ? 'bg-brand-500/18 text-brand-300' : 'bg-ink-800/70 text-mist-400 hover:text-mist-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {range === 'week' && (
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="min-h-11 rounded-lg border border-ink-600 px-2.5 py-1 text-[11px] text-mist-300 hover:border-ink-500"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(startOfWeek(todayKey()))}
              className="min-h-11 rounded-lg border border-ink-600 px-2.5 py-1 text-[11px] text-mist-300 hover:border-ink-500"
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              disabled={weekStart >= startOfWeek(todayKey())}
              className="min-h-11 rounded-lg border border-ink-600 px-2.5 py-1 text-[11px] text-mist-300 hover:border-ink-500 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-mist-400">
            No sessions logged in this range yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map(({ session, stats }) => (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => onOpenSession(session)}
                  className="w-full rounded-xl border border-ink-700 bg-ink-900/50 p-3 text-left transition hover:border-brand-400/35"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="truncate text-sm font-semibold text-mist-100">{session.workoutName}</h4>
                        <Pill
                          className={
                            session.status === 'completed'
                              ? DAY_STATUS_META.completed.chip
                              : session.status === 'partial'
                                ? DAY_STATUS_META.partial.chip
                                : DAY_STATUS_META.skipped.chip
                          }
                        >
                          {session.status === 'completed'
                            ? '✅'
                            : session.status === 'partial'
                              ? '🟡'
                              : '🔴'}{' '}
                          {session.status}
                        </Pill>
                      </div>
                      <p className="tnum mt-0.5 text-[11px] text-mist-400">
                        {relativeDay(session.date)} · {stats.exercisesDone}/{stats.exercisesTotal} exercises ·{' '}
                        {stats.setsDone}/{stats.setsTotal} sets · {stats.reps} reps ·{' '}
                        {formatDuration(session.durationSec ?? 0)}
                      </p>
                    </div>
                    <div className="tnum shrink-0 text-right">
                      <div className="text-lg leading-none font-bold text-mist-100">{stats.completion}%</div>
                      <div className="text-[9px] text-mist-500">complete</div>
                    </div>
                  </div>

                  <ProgressBar
                    className="mt-2"
                    value={stats.completion}
                    tone={stats.completion === 100 ? 'ok' : stats.completion > 0 ? 'warn' : 'bad'}
                    label={`${session.workoutName} completion`}
                  />

                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {session.items
                      .filter((item) => item.status === 'completed' || item.status === 'skipped')
                      .slice(0, 6)
                      .map((item) => {
                        const exercise = getExercise(item.exerciseId)
                        if (!exercise) return null
                        return (
                          <span
                            key={item.id}
                            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] ${
                              item.status === 'skipped'
                                ? 'bg-rose-glow/10 text-rose-glow line-through'
                                : 'bg-ink-800 text-mist-300'
                            }`}
                          >
                            {item.status === 'skipped' ? '⏭️' : '✓'} {exercise.name}
                          </span>
                        )
                      })}
                    {session.items.length > 6 && (
                      <span className="text-[10px] text-mist-500">+{session.items.length - 6}</span>
                    )}
                  </div>

                  {(session.feel || session.notes) && (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] text-mist-400">
                      <IconNote className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="min-w-0">
                        {session.feel && <span className="text-mist-200">{session.feel}. </span>}
                        {session.notes && <em>“{session.notes}”</em>}
                      </span>
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-mist-100">Consistency</h3>
        <p className="mt-0.5 text-xs text-mist-400">
          Rest days never break a streak. Missing a day you planned to train does.
        </p>
        <ConsistencyGrid sessions={sessions} profile={profile} />
      </Card>
    </div>
  )
}

/** Twelve trailing weeks of completion, oldest on the left. */
function ConsistencyGrid({ sessions, profile }: { sessions: WorkoutSession[]; profile: Profile | null }) {
  const weeks = useMemo(() => {
    const thisWeek = startOfWeek(todayKey())
    return Array.from({ length: 12 }, (_, index) =>
      weekSummary(sessions, profile, [], addDays(thisWeek, (index - 11) * 7)),
    )
  }, [sessions, profile])

  return (
    <div className="mt-3 flex gap-1 overflow-x-auto pb-1 scrollbar-slim">
      {weeks.map((week: WeekSummary) => (
        <div key={week.start} className="flex min-w-[34px] flex-1 flex-col items-center gap-1">
          <div
            title={`${formatDateKey(week.start)} — ${week.completion}%`}
            className={`h-9 w-full rounded-md ${
              week.sessions === 0 && week.completion === 0 && week.planned === 0
                ? 'bg-ink-800'
                : week.completion >= 80
                  ? 'bg-lime-glow/70'
                  : week.completion >= 40
                    ? 'bg-amber-glow/65'
                    : week.sets > 0
                      ? 'bg-rose-glow/50'
                      : 'bg-ink-700'
            }`}
          />
          <span className="text-[8px] text-mist-500">{formatDateKey(week.start).slice(0, 6)}</span>
        </div>
      ))}
    </div>
  )
}
