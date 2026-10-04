import { useMemo, useState } from 'react'
import { getExercise } from '../data'
import { SKILL_LADDERS } from '../data/skill-ladders'
import { dayNameOf, formatDuration, relativeDay, startOfWeek, todayKey } from '../lib/dates'
import { progressionReport } from '../lib/progression'
import { isTraining, sessionStats, totals, weekSummary, type StreakInfo } from '../lib/stats'
import { autoTargets, goalLabel } from '../lib/nutrition'
import type { Exercise, Profile, RecordEntry, Workout, WorkoutSession } from '../types'
import {
  Card,
  IconFlame,
  IconPlay,
  Pill,
  ProgressBar,
  ProgressRing,
  StatTile,
} from './kit'
import { MusclePill } from './ui'

export interface HomeViewProps {
  profile: Profile
  workouts: Workout[]
  sessions: WorkoutSession[]
  records: RecordEntry[]
  streak: StreakInfo
  activeSessionId: string | null
  onStart: (workout: Workout) => void
  onResume: (session: WorkoutSession) => void
  onGoTo: (target: Tab) => void
  onOpenExercise: (exercise: Exercise) => void
  onOpenSkill: (skillId: string) => void
}

export type Tab = 'home' | 'workout' | 'exercises' | 'nutrition' | 'progress' | 'profile'
export type ProgressTab = 'dashboard' | 'calendar' | 'records' | 'history'

export function HomeView({
  profile,
  workouts,
  sessions,
  records,
  streak,
  activeSessionId,
  onStart,
  onResume,
  onGoTo,
  onOpenExercise,
  onOpenSkill,
}: HomeViewProps) {
  const day = todayKey()
  const weekday = dayNameOf(day)
  const week = useMemo(
    () => weekSummary(sessions, profile, workouts, startOfWeek(day)),
    [sessions, profile, workouts, day],
  )
  const all = useMemo(() => totals(sessions, profile, workouts), [sessions, profile, workouts])
  const targets = useMemo(() => autoTargets(profile), [profile])

  const active = sessions.find((session) => session.id === activeSessionId && session.status === 'in-progress')
  const todaySessions = sessions.filter((session) => session.date === day)

  const plan = workouts.filter((workout) => !workout.day || workout.day === weekday)
  const live = active ?? todaySessions.find((session) => session.status === 'in-progress')

  const recent = useMemo(
    () =>
      [...sessions]
        .filter(isTraining)
        .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt)
        .slice(0, 3),
    [sessions],
  )

  const suggestion = useMemo(() => {
    const trained = [
      ...new Set(sessions.filter(isTraining).flatMap((session) => session.items.map((item) => item.exerciseId))),
    ]
      .map((id) => getExercise(id))
      .filter((exercise): exercise is Exercise => Boolean(exercise))
    return progressionReport(sessions, trained, getExercise).suggestions[0]
  }, [sessions])

  /*
   * Only the records this build can name. RecordsView drops the same ones, so
   * without this filter Home could headline a raw exercise id from a session
   * logged by a build that has since renamed or removed it, and the "Records
   * set" tile would count a best the user cannot open anywhere.
   */
  const visibleRecords = useMemo(
    () => records.filter((record) => Boolean(getExercise(record.exerciseId))),
    [records],
  )

  const latestPR = useMemo(
    () => [...visibleRecords].sort((a, b) => b.achievedAt - a.achievedAt)[0],
    [visibleRecords],
  )

  // Resolved once on mount: the clock should not tick under the user.
  const [greeting] = useState(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  })

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-mist-400">
          {greeting}
          {profile.name ? `, ${profile.name}` : ''} · {relativeDay(day)}
        </p>
        <h1 className="mt-0.5 text-xl font-bold text-white">
          {live ? 'Session in progress' : plan.length ? 'Time to train' : 'No workout scheduled today'}
        </h1>
      </div>

      {live && <ActiveSessionCard session={live} onResume={() => onResume(live)} />}

      {!live && plan.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-mist-100">Today&apos;s plan</h3>
          <ul className="mt-2.5 space-y-2">
            {plan.map((workout) => {
              const exercises = workout.items
                .map((item) => getExercise(item.exerciseId))
                .filter((item): item is Exercise => Boolean(item))
              const sets = workout.items.reduce((sum, item) => sum + item.sets, 0)
              const muscles = [...new Set(exercises.map((item) => item.mainMuscle))]
              return (
                <li
                  key={workout.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-mist-100">{workout.name}</p>
                    <p className="tnum mt-0.5 text-[11px] text-mist-400">
                      {workout.items.length} exercise{workout.items.length === 1 ? '' : 's'} · {sets} sets
                    </p>
                    {muscles.length > 0 && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-1">
                        {muscles.slice(0, 3).map((muscle) => (
                          <MusclePill key={muscle} muscle={muscle} />
                        ))}
                        {muscles.length > 3 && (
                          <span className="text-[10px] text-mist-500">+{muscles.length - 3}</span>
                        )}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onStart(workout)}
                    disabled={!workout.items.length}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-lime-glow px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:brightness-110 disabled:bg-ink-700 disabled:text-ink-500"
                  >
                    <IconPlay className="h-3.5 w-3.5" /> Start
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {!live && plan.length === 0 && (
        <Card className="py-8 text-center">
          <p className="text-sm text-mist-300">Nothing scheduled for {weekday}.</p>
          <p className="mx-auto mt-1.5 max-w-xs text-xs text-mist-400">
            Rest days are part of training — they don&apos;t break your streak. Or start an empty session
            and build as you go.
          </p>
          <button
            type="button"
            onClick={() => onGoTo('workout')}
            className="mt-4 min-h-11 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400"
          >
            Go to workout
          </button>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-4">
          <ProgressRing
            value={week.completion}
            size={84}
            tone={week.completion >= 80 ? 'ok' : week.completion >= 40 ? 'warn' : 'bad'}
          >
            <div>
              <div className="tnum text-base leading-none font-bold text-mist-100">{week.completion}%</div>
              <div className="mt-0.5 text-[9px] text-mist-400">this week</div>
            </div>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-mist-100">
              <IconFlame className="h-4 w-4 text-amber-glow" /> 🔥 {streak.days} day streak
            </p>
            <p className="mt-0.5 text-[11px] text-mist-400">
              {streak.lastTrainedOn
                ? `Last trained ${relativeDay(streak.lastTrainedOn).toLowerCase()}`
                : 'Log your first session to start a streak'}
            </p>
            <ProgressBar className="mt-2.5" value={week.completion} tone="ok" label="Weekly completion" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile value={week.completed} label="Completed" tone="ok" />
          <StatTile value={week.partial} label="Partial" tone={week.partial ? 'warn' : 'default'} />
          <StatTile value={week.sets} label="Sets" />
          <StatTile value={formatDuration(week.seconds)} label="Time" />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile value={all.sessions} label="Sessions all-time" />
        <StatTile value={all.reps} label="Total reps" />
        <StatTile value={all.bestStreak} label="Best streak" tone="brand" />
        <StatTile value={visibleRecords.length} label="Records set" tone="brand" />
      </div>

      {latestPR && (
        <Card className="border-amber-glow/25 bg-amber-glow/5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] tracking-wide text-amber-glow uppercase">Latest record</p>
              <p className="mt-0.5 text-sm font-semibold text-mist-100">
                🎉 {getExercise(latestPR.exerciseId)?.name}
              </p>
            </div>
            <Pill className="bg-amber-glow/15 text-amber-glow ring-amber-glow/30">
              {latestPR.value} {latestPR.metric === 'hold' ? 's' : latestPR.metric === 'weight' ? 'kg' : 'reps'}
            </Pill>
          </div>
          <button
            type="button"
            onClick={() => onGoTo('progress')}
            className="mt-2.5 flex min-h-11 w-full items-center justify-center rounded-lg border border-amber-glow/30 py-1.5 text-[11px] text-amber-glow transition hover:bg-amber-glow/10"
          >
            See all records →
          </button>
        </Card>
      )}

      {suggestion && suggestion.verdict !== 'insufficient-data' && (
        <Card>
          <p className="text-[10px] tracking-wide text-brand-300 uppercase">Next step</p>
          <p className="mt-1 text-sm font-semibold text-mist-100">{suggestion.headline}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-mist-400">{suggestion.detail}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {suggestion.nextExercise && (
              <button
                type="button"
                onClick={() => onOpenExercise(suggestion.nextExercise!)}
                className="min-h-11 rounded-lg border border-lime-glow/30 px-2.5 py-1 text-[11px] text-lime-glow transition hover:bg-lime-glow/10"
              >
                {suggestion.nextExercise.name} →
              </button>
            )}
            <button
              type="button"
              onClick={() => onGoTo('progress')}
              className="min-h-11 rounded-lg border border-ink-600 px-2.5 py-1 text-[11px] text-mist-300 transition hover:border-ink-500"
            >
              All suggestions
            </button>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-mist-100">Recent sessions</h3>
          <button
            type="button"
            onClick={() => onGoTo('progress')}
            className="-my-2 min-h-11 px-1 text-[11px] text-brand-300 hover:text-brand-200"
          >
            History →
          </button>
        </div>

        {recent.length === 0 ? (
          <p className="py-6 text-center text-xs text-mist-400">
            Nothing logged yet. Start a workout and tick off your sets — only real work counts.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((session) => {
              const stats = sessionStats(session)
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => onGoTo('progress')}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-ink-700 bg-ink-900/50 px-3 py-2 text-left transition hover:border-brand-400/35"
                  >
                    <span className="text-sm">{session.status === 'completed' ? '✅' : '🟡'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-mist-100">
                        {session.workoutName}
                      </span>
                      <span className="tnum block text-[10px] text-mist-400">
                        {relativeDay(session.date)} · {stats.setsDone}/{stats.setsTotal} sets ·{' '}
                        {stats.reps} reps · {formatDuration(session.durationSec ?? 0)}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-xs font-bold text-mist-200">{stats.completion}%</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {profile.goals.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-mist-100">Your targets</h3>
            <button
              type="button"
              onClick={() => onGoTo('nutrition')}
              className="-my-2 min-h-11 px-1 text-[11px] text-brand-300 hover:text-brand-200"
            >
              Nutrition →
            </button>
          </div>
          <p className="mt-1 flex flex-wrap gap-1.5">
            {profile.goals.map((goal) => (
              <Pill key={goal} className="bg-ink-800 text-mist-200 ring-ink-600">
                {goalLabel(goal)}
              </Pill>
            ))}
          </p>
          <div className="tnum mt-3 grid grid-cols-4 gap-2 text-center">
            {(
              [
                ['kcal', targets.kcal],
                ['P', `${targets.protein}g`],
                ['C', `${targets.carbs}g`],
                ['F', `${targets.fat}g`],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <div className="tnum text-sm font-bold text-mist-100">{value}</div>
                <div className="text-[9px] text-mist-500">{label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(
          [
            ['exercises', '📚 Exercises'],
            ['nutrition', '🥗 Nutrition'],
            ['progress', '📊 Progress'],
          ] as [Tab, string][]
        ).map(([target, label]) => (
          <button
            key={target}
            type="button"
            onClick={() => onGoTo(target)}
            className="min-h-11 rounded-xl border border-ink-600 py-3 text-xs font-medium text-mist-300 transition hover:border-brand-400/40 hover:text-brand-300"
          >
            {label}
          </button>
        ))}
      </div>

      <SkillShelf onGoTo={onGoTo} onOpenSkill={onOpenSkill} />
    </div>
  )
}

function ActiveSessionCard({
  session,
  onResume,
}: {
  session: WorkoutSession
  onResume: () => void
}) {
  const stats = sessionStats(session)
  return (
    <Card className="border-brand-400/45 bg-brand-500/8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Pill className="bg-brand-400/15 text-brand-300 ring-brand-400/30">🔵 In progress</Pill>
          <h3 className="mt-1.5 truncate text-base font-bold text-white">{session.workoutName}</h3>
          <p className="tnum mt-0.5 text-[11px] text-mist-400">
            {stats.setsDone}/{stats.setsTotal} sets · {stats.reps} reps · {stats.completion}% done
          </p>
        </div>
        <button
          type="button"
          onClick={onResume}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400"
        >
          <IconPlay className="h-3.5 w-3.5" /> Resume
        </button>
      </div>
      <ProgressBar className="mt-3" value={stats.completion} label="Session completion" />
    </Card>
  )
}

/** A quick jump into the Skills tab from Home. */
function SkillShelf({
  onGoTo,
  onOpenSkill,
}: {
  onGoTo: (target: Tab) => void
  onOpenSkill: (skillId: string) => void
}) {
  const featured = SKILL_LADDERS.slice(0, 8)
  return (
    <Card>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-mist-100">Skills</h3>
        <button
          type="button"
          onClick={() => onGoTo('exercises')}
          className="-my-2 min-h-11 px-1 text-[11px] text-brand-300 hover:text-brand-200"
        >
          All skills →
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {featured.map((skill) => (
          <button
            key={skill.id}
            type="button"
            onClick={() => onOpenSkill(skill.id)}
            className="rounded-xl border border-ink-700 bg-ink-900/50 px-3 py-2.5 text-left transition hover:border-brand-400/35"
          >
            <span className="block truncate text-xs font-semibold text-mist-100">{skill.name}</span>
            <span className="tnum mt-0.5 block text-[10px] text-mist-500">
              {skill.stages.length} stages
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-[11px] text-mist-400">
        Mark the rung you can currently hold and the app shows what sits above it.
      </p>
    </Card>
  )
}
