import { useMemo, useState } from 'react'
import { getExercise } from '../data'
import { formatDateKey, startOfWeek, weekDays } from '../lib/dates'
import { progressionReport, type ExerciseEvidence, type ProgressionSuggestion } from '../lib/progression'
import { assessLevels } from '../lib/level'
import { computeStreak, groupSessionsByDate, isTraining, totals, weekSummary } from '../lib/stats'
import { useTodayKey } from '../lib/use-today'
import type {
  Difficulty,
  Exercise,
  Muscle,
  Profile,
  RecordEntry,
  WeightEntry,
  Workout,
  WorkoutSession,
} from '../types'
import {
  Card,
  IconFlame,
  IconPlus,
  IconTrash,
  Pill,
  ProgressBar,
  ProgressRing,
  StatTile,
  LineChart,
} from './kit'
import { DifficultyBadge, MusclePill } from './ui'

export interface ProgressViewProps {
  sessions: WorkoutSession[]
  workouts: Workout[]
  profile: Profile | null
  records: RecordEntry[]
  weight: WeightEntry[]
  overrides: Record<string, Difficulty>
  dismissed: Record<string, number>
  onDismiss: (key: string) => void
  onLogWeight: (date: string, kg: number) => void
  onDeleteWeight: (date: string) => void
  onOpenExercise: (exercise: Exercise) => void
  onSetLevel: (exerciseId: string, level: Difficulty | null) => void
  onGoTo: (target: 'calendar' | 'records' | 'history') => void
}

export function ProgressView({
  sessions,
  workouts,
  profile,
  records,
  weight,
  overrides,
  dismissed,
  onDismiss,
  onLogWeight,
  onDeleteWeight,
  onOpenExercise,
  onSetLevel,
  onGoTo,
}: ProgressViewProps) {
  const [weightInput, setWeightInput] = useState('')

  // Everything below is a function of "today", and the app can stay open across
  // midnight — so it is read live rather than frozen at mount.
  const today = useTodayKey()

  const streak = useMemo(
    () => computeStreak(sessions, profile, workouts, today),
    [sessions, profile, workouts, today],
  )
  const all = useMemo(() => totals(sessions, profile, workouts), [sessions, profile, workouts])
  const week = useMemo(
    () => weekSummary(sessions, profile, workouts, startOfWeek(today)),
    [sessions, profile, workouts, today],
  )

  /**
   * The sessions inside this week, read once.
   *
   * The muscle balance and the weekly volume used to filter `sessions` with
   * `date >= monday` on their own, which also counted a session dated later in
   * the week — and could reach beyond it — so the numbers under "Muscles trained
   * this week" did not have to agree with the week summary above them.
   */
  const weekSessions = useMemo(() => {
    const byDate = groupSessionsByDate(sessions)
    return weekDays(startOfWeek(today)).flatMap((date) => byDate.get(date) ?? [])
  }, [sessions, today])

  /** Exercises finished this week, and how much of the week was training. */
  const weeklyVolume = useMemo(() => {
    const training = weekSessions.filter(isTraining)
    const done = training.reduce(
      (sum, session) => sum + session.items.filter((item) => item.status === 'completed').length,
      0,
    )
    const available = training.reduce((sum, session) => sum + session.items.length, 0)
    return { sessions: training.length, completion: available ? Math.round((done / available) * 100) : 0 }
  }, [weekSessions])

  /** Muscles trained this week, by completed exercise. */
  const weeklyMuscles = useMemo(() => {
    const counts = new Map<Muscle, number>()
    for (const session of weekSessions) {
      if (!isTraining(session)) continue
      for (const item of session.items) {
        if (item.status !== 'completed') continue
        const exercise = getExercise(item.exerciseId)
        if (!exercise) continue
        counts.set(exercise.mainMuscle, (counts.get(exercise.mainMuscle) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [weekSessions])

  /**
   * The exercises actually trained, and one pass over the sessions for all of
   * them. The dashboard needs this twice — for the suggestions and for the
   * progression table — and reading it per exercise re-sorted every session
   * list once per exercise, twice.
   */
  const trainedExercises = useMemo(() => {
    const ids = new Set(
      sessions.filter(isTraining).flatMap((session) => session.items.map((item) => item.exerciseId)),
    )
    return [...ids]
      .map((id) => getExercise(id))
      .filter((exercise): exercise is Exercise => Boolean(exercise))
  }, [sessions])

  const report = useMemo(
    () => progressionReport(sessions, trainedExercises, getExercise),
    [sessions, trainedExercises],
  )

  const suggestions = useMemo(
    () => report.suggestions.filter((s) => !dismissed[`${s.key}:${s.verdict}`]),
    [report, dismissed],
  )

  const latestWeight = weight[weight.length - 1]
  const firstWeight = weight[0]
  const weightDelta = latestWeight && firstWeight ? latestWeight.kg - firstWeight.kg : 0

  const assessment = useMemo(() => assessLevels(profile), [profile])

  return (
    <div className="space-y-4">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          value={streak.days}
          label="Day streak"
          hint={streakHint(streak)}
          tone={streak.days > 0 ? 'ok' : 'default'}
        />
        {/* A share of the sets done, not of the days: labelled bare, beside
            the day counts below, it read as "days finished this week". */}
        <StatTile
          value={week.completion}
          label="This week"
          suffix="%"
          hint="of the sets you planned"
          tone="brand"
        />
        <StatTile value={all.sets} label="All-time sets" />
        <StatTile value={all.reps} label="All-time reps" />
      </div>

      {/* Streak + weekly consistency */}
      <Card>
        <div className="flex items-center gap-4">
          <ProgressRing
            value={week.completion}
            size={92}
            tone={week.completion >= 80 ? 'ok' : week.completion >= 40 ? 'warn' : 'bad'}
          >
            <div>
              <div className="tnum text-lg leading-none font-bold text-mist-100">{week.completion}%</div>
              <div className="mt-0.5 text-[9px] text-mist-400">sets done</div>
            </div>
          </ProgressRing>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-mist-100">
              <IconFlame className="h-4 w-4 text-amber-glow" /> 🔥 {streak.days} day streak
            </p>
            <p className="mt-0.5 text-[11px] text-mist-400">
              {streak.lastTrainedOn
                ? `Last trained ${formatDateKey(streak.lastTrainedOn)}. Rest days do not break it.`
                : 'No sessions logged yet.'}
            </p>
            <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="tnum text-sm font-bold text-lime-glow">{week.completed}</div>
                <div className="text-[9px] text-mist-500">completed</div>
              </div>
              <div>
                <div className="tnum text-sm font-bold text-amber-glow">{week.partial}</div>
                <div className="text-[9px] text-mist-500">partial</div>
              </div>
              <div>
                <div className="tnum text-sm font-bold text-rose-glow">{week.skipped}</div>
                <div className="text-[9px] text-mist-500">skipped</div>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onGoTo('history')}
          className="mt-3 min-h-11 w-full rounded-lg border border-ink-600 py-2 text-[11px] text-mist-300 transition hover:border-brand-400/40 hover:text-brand-300"
        >
          Open weekly summary &amp; history →
        </button>
      </Card>

      {/* Lifetime totals */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile value={all.sessions} label="Sessions completed" />
        <StatTile value={all.exercises} label="Exercises done" />
        <StatTile value={Math.round(all.seconds / 60)} label="Minutes trained" hint={`Best streak ${all.bestStreak}d`} />
        <StatTile value={records.length} label="Records set" tone="brand" />
      </div>

      {/* Body weight */}
      <Card>
        <h3 className="text-sm font-semibold text-mist-100">Body weight</h3>
        <p className="mt-0.5 text-xs text-mist-400">
          Entered by hand. {latestWeight ? `Latest ${latestWeight.kg} kg` : 'Nothing logged yet'}
          {weightDelta !== 0 && ` · ${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)} kg overall`}
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            type="number"
            inputMode="decimal"
            step={0.1}
            value={weightInput}
            onChange={(event) => setWeightInput(event.target.value)}
            placeholder={profile?.weightKg ? String(profile.weightKg) : 'kg'}
            aria-label="Body weight in kilograms"
            className="tnum min-h-11 w-28 rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-mist-100 no-spinner focus:border-brand-400/70 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const value = Number(weightInput)
              if (!Number.isFinite(value) || value <= 0) return
              onLogWeight(today, value)
              setWeightInput('')
            }}
            // Gated on the value itself, not on there being text: "0" used to
            // enable a button that then silently refused to log anything.
            disabled={!(Number(weightInput) > 0)}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-400 disabled:bg-ink-700 disabled:text-ink-500"
          >
            <IconPlus className="h-3.5 w-3.5" /> Log today
          </button>
          {latestWeight && (
            <span className="tnum text-[11px] text-mist-500">
              last: {latestWeight.kg} kg on {formatDateKey(latestWeight.date)}
            </span>
          )}
        </div>

        <div className="mt-3">
          <LineChart
            points={weight.map((entry) => ({ x: formatDateKey(entry.date), y: entry.kg }))}
          />
        </div>

        {weight.length > 0 && (
          <details className="mt-2">
            {/* A disclosure is still a control: it was a single line of 11px text. */}
            <summary className="flex min-h-11 cursor-pointer items-center text-[11px] text-mist-400 hover:text-mist-200">
              All {weight.length} {weight.length === 1 ? 'entry' : 'entries'}
            </summary>
            <ul className="space-y-1">
              {[...weight].reverse().map((entry) => (
                <li key={entry.date} className="flex items-center gap-2 text-[11px]">
                  <span className="tnum flex-1 text-mist-400">{formatDateKey(entry.date)}</span>
                  <span className="tnum font-semibold text-mist-100">{entry.kg} kg</span>
                  <button
                    type="button"
                    onClick={() => onDeleteWeight(entry.date)}
                    aria-label={`Delete entry for ${entry.date}`}
                    className="-my-2 grid size-11 shrink-0 place-items-center rounded-md text-mist-500 transition hover:text-rose-glow"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {/* Weekly muscle balance */}
      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <h3 className="text-sm font-semibold text-mist-100">Muscles trained this week</h3>
          <span className="tnum text-[11px] text-mist-400">
            {weeklyVolume.sessions} session{weeklyVolume.sessions === 1 ? '' : 's'} ·{' '}
            {weeklyVolume.completion}% of exercises done
          </span>
        </div>
        {weeklyMuscles.length === 0 ? (
          <p className="mt-2 text-xs text-mist-400">No completed exercises this week yet.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {weeklyMuscles.map(([muscle, count]) => (
              <li key={muscle} className="flex items-center gap-2">
                <span className="w-24 shrink-0">
                  <MusclePill muscle={muscle} />
                </span>
                <span className="min-w-0 flex-1">
                  <ProgressBar
                    value={(count / weeklyMuscles[0][1]) * 100}
                    tone="brand"
                    label={`${muscle}: ${count}`}
                  />
                </span>
                <span className="tnum w-8 shrink-0 text-right text-[11px] text-mist-400">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Progression suggestions */}
      <Card>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-mist-100">Progression suggestions</h3>
          <p className="mt-0.5 text-xs text-mist-400">
            Based on what you actually logged. You are always in control — nothing changes until you
            say so.
          </p>
        </div>

        {suggestions.length === 0 ? (
          <p className="py-8 text-center text-sm text-mist-400">
            No suggestions yet — train an exercise a couple of times and the app will start reading your
            set-by-set record.
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestions.slice(0, 8).map((suggestion) => (
              <SuggestionRow
                key={`${suggestion.key}:${suggestion.verdict}`}
                suggestion={suggestion}
                onDismiss={() => onDismiss(`${suggestion.key}:${suggestion.verdict}`)}
                onOpenExercise={onOpenExercise}
              />
            ))}
          </ul>
        )}
      </Card>

      {/* Exercise progression */}
      <Card>
        <h3 className="text-sm font-semibold text-mist-100">Exercise progression</h3>
        <p className="mt-0.5 text-xs text-mist-400">
          Your recent record per exercise, and the level the app assessed for you.
        </p>
        <ExerciseProgression
          exercises={trainedExercises}
          evidence={report.evidence}
          overrides={overrides}
          assessment={assessment}
          onSetLevel={onSetLevel}
          onOpenExercise={onOpenExercise}
        />
      </Card>

      <button
        type="button"
        onClick={() => onGoTo('records')}
        className="min-h-11 w-full rounded-xl border border-ink-600 py-2.5 text-xs font-medium text-mist-300 transition hover:border-amber-glow/40 hover:text-amber-glow"
      >
        🏆 View personal records →
      </button>
      <button
        type="button"
        onClick={() => onGoTo('calendar')}
        className="min-h-11 w-full rounded-xl border border-ink-600 py-2.5 text-xs font-medium text-mist-300 transition hover:border-brand-400/40 hover:text-brand-300"
      >
        📅 Open training calendar →
      </button>
    </div>
  )
}

/**
 * Honest wording for a streak that does not exist yet: telling someone to "keep"
 * a streak of zero invites them to look for something they never started.
 */
function streakHint(streak: { days: number; active: boolean }): string {
  if (streak.active) return 'Active today'
  if (streak.days > 0) return 'Train today to keep it'
  return 'Log a session to start one'
}

const VERDICT_TONE: Record<
  ProgressionSuggestion['verdict'],
  { chip: string; label: string }
> = {
  progress: { chip: 'bg-lime-glow/15 text-lime-glow ring-lime-glow/30', label: '🟢 Progress' },
  maintain: { chip: 'bg-brand-400/15 text-brand-300 ring-brand-400/30', label: '🔵 Maintain' },
  regress: { chip: 'bg-amber-glow/15 text-amber-glow ring-amber-glow/30', label: '🟡 Ease off' },
  'insufficient-data': { chip: 'bg-ink-800 text-mist-400 ring-ink-600', label: 'Not enough data' },
}

function SuggestionRow({
  suggestion,
  onDismiss,
  onOpenExercise,
}: {
  suggestion: ProgressionSuggestion
  onDismiss: () => void
  onOpenExercise: (exercise: Exercise) => void
}) {
  const tone = VERDICT_TONE[suggestion.verdict]
  return (
    <li className="rounded-xl border border-ink-700 bg-ink-900/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill className={tone.chip}>{tone.label}</Pill>
        <span className="text-sm font-semibold text-mist-100">{suggestion.headline}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-mist-400">{suggestion.detail}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestion.nextExercise && (
          <button
            type="button"
            onClick={() => suggestion.nextExercise && onOpenExercise(suggestion.nextExercise)}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-lime-glow/30 px-2.5 py-1 text-[11px] text-lime-glow transition hover:bg-lime-glow/10"
          >
            Look at {suggestion.nextExercise.name} →
          </button>
        )}
        {suggestion.fallbackExercise && (
          <button
            type="button"
            onClick={() => onOpenExercise(suggestion.fallbackExercise!)}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-amber-glow/30 px-2.5 py-1 text-[11px] text-amber-glow transition hover:bg-amber-glow/10"
          >
            Drop back to {suggestion.fallbackExercise.name}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto min-h-11 rounded-lg px-2.5 py-1 text-[11px] text-mist-500 transition hover:text-mist-300"
        >
          Not now
        </button>
      </div>
    </li>
  )
}

/** Longest list rendered before the filter takes over. */
const PROGRESSION_ROWS = 25

function ExerciseProgression({
  exercises,
  evidence,
  overrides,
  assessment,
  onSetLevel,
  onOpenExercise,
}: {
  exercises: Exercise[]
  evidence: Map<string, ExerciseEvidence>
  overrides: Record<string, Difficulty>
  assessment: { levels: Record<string, Difficulty>; sources: Record<string, string> }
  onSetLevel: (exerciseId: string, level: Difficulty | null) => void
  onOpenExercise: (exercise: Exercise) => void
}) {
  const [query, setQuery] = useState('')

  // The evidence was already read once on the dashboard, so this table reads it
  // from that rather than re-deriving it per exercise.
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return exercises
      .map((exercise) => {
        const found = evidence.get(exercise.id)
        return {
          id: exercise.id,
          exercise,
          name: exercise.name,
          muscle: exercise.mainMuscle,
          // Both are needed: `level` is what the user sees, and once an override
          // is in place it *is* the override, so the automatic estimate has to be
          // kept separately or the buttons go on announcing the manual value as
          // the automatic one.
          level: overrides[exercise.id] ?? assessment.levels[exercise.id],
          autoLevel: assessment.levels[exercise.id],
          isOverride: Boolean(overrides[exercise.id]),
          source: assessment.sources[exercise.id],
          sessions: found?.sessions.length ?? 0,
          hitRate: found ? Math.round(found.hitRate * 100) : 0,
          cleanStreak: found?.cleanStreak ?? 0,
          best: found?.bestSet,
        }
      })
      .filter((row) => !term || row.name.toLowerCase().includes(term))
      .sort((a, b) => b.sessions - a.sessions)
  }, [exercises, evidence, overrides, assessment, query])

  if (!rows.length) {
    return (
      <p className="mt-3 py-6 text-center text-xs text-mist-400">
        {query.trim()
          ? `Nothing trained matches “${query.trim()}”.`
          : 'Nothing trained yet. Complete a session and each exercise shows up here with its history.'}
      </p>
    )
  }

  // Filtered before the cap, so searching always finds the row it is looking for.
  const shown = rows.slice(0, PROGRESSION_ROWS)
  const hidden = rows.length - shown.length

  return (
    <>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter your trained exercises"
        aria-label="Filter trained exercises"
        className="mt-3 min-h-11 w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-mist-100 placeholder:text-ink-500 focus:border-brand-400/70 focus:outline-none"
      />

      <ul className="mt-3 space-y-1.5">
        {shown.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/50 p-2.5"
          >
            <button
              type="button"
              onClick={() => onOpenExercise(row.exercise)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-xs font-semibold text-mist-100">{row.name}</span>
                <MusclePill muscle={row.muscle} />
                {row.isOverride ? (
                  <Pill className="bg-brand-400/15 text-brand-300 ring-brand-400/30">Manual</Pill>
                ) : (
                  <DifficultyBadge level={row.level} />
                )}
              </div>
              <p className="tnum mt-0.5 text-[10px] text-mist-400">
                {row.sessions} logged session{row.sessions === 1 ? '' : 's'} · {row.hitRate}% of target sets
                {row.cleanStreak > 0 && ` · ${row.cleanStreak} clean in a row`}
                {row.best && row.best.weight > 0 && ` · best ${row.best.weight} kg`}
                {row.best && row.best.holdSec > 0 && ` · best ${row.best.holdSec}s`}
              </p>
            </button>

            <div className="flex shrink-0 gap-1">
              {(['beginner', 'intermediate', 'advanced'] as Difficulty[]).map((level) => {
                const isCurrent = row.level === level
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onSetLevel(row.id, isCurrent && row.isOverride ? null : level)}
                    aria-pressed={row.isOverride ? isCurrent : undefined}
                    aria-label={
                      isCurrent && row.isOverride
                        ? `Reset ${row.name} to its automatic level (${row.autoLevel})`
                        : `Set ${row.name} to ${level} (automatic level is ${row.autoLevel} — ${row.source})`
                    }
                    title={
                      row.isOverride
                        ? 'Set level'
                        : `Set manually (auto: ${row.autoLevel} — ${row.source})`
                    }
                    // 44×32 was not a thumb target; the row wraps if the three
                    // of them no longer leave room for the name.
                    className={`grid size-11 place-items-center rounded-md text-sm font-semibold transition ${
                      isCurrent
                        ? 'bg-brand-500/20 text-brand-300 ring-1 ring-brand-400/40'
                        : 'bg-ink-800 text-mist-500 hover:text-mist-200'
                    }`}
                  >
                    {level === 'beginner' ? '🟢' : level === 'intermediate' ? '🟡' : '🔴'}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <p className="mt-2 text-center text-[10px] text-mist-500">
          {hidden} more trained exercise{hidden === 1 ? '' : 's'} — filter to find {hidden === 1 ? 'it' : 'them'}.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-mist-500">
          Tap an emoji to override that exercise&apos;s assessed level; tap it again to go back to automatic.
        </span>
        {rows.some((row) => row.isOverride) && (
          <button
            type="button"
            onClick={() => rows.filter((row) => row.isOverride).forEach((row) => onSetLevel(row.id, null))}
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-[10px] text-brand-300 underline underline-offset-2"
          >
            Reset all overrides
          </button>
        )}
      </div>
    </>
  )
}
