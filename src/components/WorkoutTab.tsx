import { getExercise } from '../data'
import { dayNameOf, formatDuration, relativeDay, todayKey } from '../lib/dates'
import { sessionStats, weekSummary, type StreakInfo } from '../lib/stats'
import type { Exercise, Profile, Workout, WorkoutSession } from '../types'
import { Card, IconFlame, IconPlay, Pill, ProgressRing, StatTile } from './kit'
import { MusclePill } from './ui'

export interface WorkoutTabProps {
  workouts: Workout[]
  sessions: WorkoutSession[]
  profile: Profile | null
  streak: StreakInfo
  onStart: (workout: Workout) => void
  onStartFreestyle: () => void
  onResume: (session: WorkoutSession) => void
  onOpenBuilder: (workoutId: string | null) => void
  onGoTo: (target: 'builder' | 'history') => void
}

export function WorkoutTab({
  workouts,
  sessions,
  profile,
  streak,
  onStart,
  onStartFreestyle,
  onResume,
  onOpenBuilder,
  onGoTo,
}: WorkoutTabProps) {
  const today = todayKey()
  const weekday = dayNameOf(today)
  const week = weekSummary(sessions, profile, workouts)

  const todaySessions = sessions.filter((session) => session.date === today)

  /** Workouts scheduled for today's weekday, plus anything unassigned. */
  const todaysPlan = workouts.filter((workout) => !workout.day || workout.day === weekday)
  const other = workouts.filter((workout) => workout.day && workout.day !== weekday)

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <ProgressRing
            value={week.completion}
            size={80}
            tone={week.completion >= 80 ? 'ok' : week.completion >= 40 ? 'warn' : 'bad'}
          >
            <div>
              <div className="tnum text-sm leading-none font-bold text-mist-100">{week.completion}%</div>
              <div className="mt-0.5 text-[9px] text-mist-400">week</div>
            </div>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-mist-100">
              <IconFlame className="h-4 w-4 text-amber-glow" /> 🔥 {streak.days} day streak
            </p>
            <p className="mt-0.5 text-[11px] text-mist-400">
              {week.completed} completed · {week.partial} partial · {week.skipped} skipped this week
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatTile value={week.sets} label="Sets this week" />
          <StatTile value={week.reps} label="Reps this week" />
          <StatTile value={formatDuration(week.seconds)} label="Time" />
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-mist-100">Today</h3>
            <p className="mt-0.5 text-[11px] text-mist-400">
              {relativeDay(today)} · {weekday}
            </p>
          </div>
          <button
            type="button"
            onClick={onStartFreestyle}
            className="rounded-lg border border-ink-600 px-3 py-1.5 text-[11px] font-medium text-mist-300 transition hover:border-brand-400/40 hover:text-brand-300"
          >
            + Empty session
          </button>
        </div>

        {todaySessions.length > 0 && (
          <ul className="mb-3 space-y-1.5">
            {todaySessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => onResume(session)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-ink-700 bg-ink-900/50 px-3 py-2 text-left transition hover:border-brand-400/35"
                >
                  <span className="text-sm">
                    {session.status === 'completed'
                      ? '✅'
                      : session.status === 'partial'
                        ? '🟡'
                        : session.status === 'skipped'
                          ? '🔴'
                          : '🔵'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-mist-100">{session.workoutName}</span>
                    <span className="tnum block text-[10px] text-mist-400">
                      {sessionStats(session).setsDone} sets · {sessionStats(session).reps} reps ·{' '}
                      {sessionStats(session).completion}%
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-brand-300">
                    {session.status === 'in-progress' ? 'Resume →' : 'Open →'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {todaysPlan.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-600 px-3 py-6 text-center">
            <p className="text-xs text-mist-400">
              No workout scheduled for today. Build one, or start an empty session and add exercises as
              you go.
            </p>
            <button
              type="button"
              onClick={() => onOpenBuilder(null)}
              className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-400"
            >
              Create a workout
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {todaysPlan.map((workout) => (
              <PlanRow
                key={workout.id}
                workout={workout}
                alreadyLogged={todaySessions.some((session) => session.workoutId === workout.id)}
                onStart={onStart}
                onEdit={() => onOpenBuilder(workout.id)}
              />
            ))}
          </ul>
        )}
      </Card>

      {other.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-mist-100">Other days</h3>
          <ul className="space-y-2">
            {other.map((workout) => (
              <PlanRow
                key={workout.id}
                workout={workout}
                alreadyLogged={false}
                onStart={onStart}
                onEdit={() => onOpenBuilder(workout.id)}
                showDay
              />
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onGoTo('builder')}
          className="rounded-xl border border-ink-600 py-3 text-xs font-medium text-mist-300 transition hover:border-brand-400/40 hover:text-brand-300"
        >
          ⚙️ Workout builder
        </button>
        <button
          type="button"
          onClick={() => onGoTo('history')}
          className="rounded-xl border border-ink-600 py-3 text-xs font-medium text-mist-300 transition hover:border-brand-400/40 hover:text-brand-300"
        >
        📋 History &amp; summary
        </button>
      </div>
    </div>
  )
}

function PlanRow({
  workout,
  alreadyLogged,
  onStart,
  onEdit,
  showDay = false,
}: {
  workout: Workout
  alreadyLogged: boolean
  onStart: (workout: Workout) => void
  onEdit: () => void
  showDay?: boolean
}) {
  const exercises = workout.items
    .map((item) => getExercise(item.exerciseId))
    .filter((item): item is Exercise => Boolean(item))
  const muscles = [...new Set(exercises.map((item) => item.mainMuscle))]
  const sets = workout.items.reduce((sum, item) => sum + item.sets, 0)

  return (
    <li className="rounded-xl border border-ink-700 bg-ink-900/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-mist-100">{workout.name}</span>
            {showDay && workout.day && (
              <Pill className="bg-ink-800 text-mist-300 ring-ink-600">{workout.day}</Pill>
            )}
            {alreadyLogged && (
              <Pill className="bg-lime-glow/12 text-lime-glow ring-lime-glow/25">Logged today</Pill>
            )}
          </div>
          <p className="tnum mt-0.5 text-[11px] text-mist-400">
            {workout.items.length} exercise{workout.items.length === 1 ? '' : 's'} · {sets} sets
          </p>
          {muscles.length > 0 && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1">
              {muscles.slice(0, 4).map((muscle) => (
                <MusclePill key={muscle} muscle={muscle} />
              ))}
              {muscles.length > 4 && <span className="text-[10px] text-mist-500">+{muscles.length - 4}</span>}
            </p>
          )}
        </button>

        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-ink-600 px-2.5 py-1.5 text-[11px] text-mist-300 transition hover:border-ink-500"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onStart(workout)}
            disabled={!workout.items.length}
            className="inline-flex items-center gap-1 rounded-lg bg-lime-glow px-3 py-1.5 text-[11px] font-semibold text-ink-950 transition hover:brightness-110 disabled:bg-ink-700 disabled:text-ink-500"
          >
            <IconPlay className="h-3 w-3" /> Start
          </button>
        </div>
      </div>
      {workout.items.length === 0 && (
        <p className="mt-1.5 text-[11px] text-mist-500">Empty — add exercises before starting.</p>
      )}
    </li>
  )
}
