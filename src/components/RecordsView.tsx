import { useMemo, useState } from 'react'
import { LIBRARY, getExercise } from '../data'
import { formatDateKey, startOfWeek, toDateKey } from '../lib/dates'
import { useTodayKey } from '../lib/use-today'
import type { Difficulty, Exercise, RecordEntry, RecordMetric } from '../types'
import { Card, Chip, IconTrophy, IconTrash, NumberField, Pill, Segmented, Sheet, StatTile, TextField } from './kit'
import { DifficultyBadge, MusclePill } from './ui'

export interface RecordsViewProps {
  records: RecordEntry[]
  onDelete: (id: string) => void
  onOpenExercise: (exercise: Exercise) => void
  /** Opens the add-record sheet. */
  onRequestAdd: () => void
}

const METRIC_META: Record<RecordMetric, { label: string; short: string; unit: string }> = {
  reps: { label: 'Most reps', short: 'Reps', unit: 'reps' },
  hold: { label: 'Longest hold', short: 'Hold', unit: 's' },
  weight: { label: 'Heaviest load', short: 'Load', unit: 'kg' },
}

const UNKNOWN_METRIC = { label: 'Result', short: 'Result', unit: '' }

/** Rows in the "every best you broke" list before it says how many more there are. */
const RECENT_ROWS = 12

/**
 * Records live in localStorage and can arrive from an older version or a
 * hand-edited backup, so an unrecognised metric must degrade rather than
 * white-screen the whole tab.
 */
function metricMeta(metric: string) {
  return METRIC_META[metric as RecordMetric] ?? UNKNOWN_METRIC
}

type Filter = 'all' | RecordMetric

/**
 * The local day a record was set on.
 *
 * `achievedAt` is an instant, and every other date in the app is a local
 * `yyyy-mm-dd` key. Reading it through `toISOString()` gave the *UTC* day
 * instead, so a record set at 00:30 in any timezone east of Greenwich was filed
 * under the previous day.
 */
function recordDay(entry: RecordEntry): string {
  return formatDateKey(toDateKey(new Date(entry.achievedAt)))
}

/** Most recent first. */
const newestFirst = (records: RecordEntry[]) =>
  [...records].sort((a, b) => b.achievedAt - a.achievedAt)

export function RecordsView({ records, onDelete, onOpenExercise, onRequestAdd }: RecordsViewProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const today = useTodayKey()

  const { current, previous, recent, exercises, setThisWeek } = useMemo(() => {
    const best = new Map<string, RecordEntry>()
    const runnerUp = new Map<string, RecordEntry[]>()

    for (const entry of [...records].sort((a, b) => b.value - a.value)) {
      const key = `${entry.exerciseId}:${entry.metric}`
      if (!best.has(key)) {
        best.set(key, entry)
      } else {
        runnerUp.set(key, [...(runnerUp.get(key) ?? []), entry])
      }
    }

    // "This week" is the same Monday-based week as everywhere else, rather than
    // a rolling 168 hours measured from whenever the tab happened to be opened.
    const from = startOfWeek(today)

    return {
      current: [...best.values()].sort((a, b) => b.achievedAt - a.achievedAt),
      previous: runnerUp,
      recent: newestFirst(records).slice(0, RECENT_ROWS),
      exercises: new Set(records.map((entry) => entry.exerciseId)).size,
      setThisWeek: records.filter((entry) => toDateKey(new Date(entry.achievedAt)) >= from).length,
    }
  }, [records, today])

  const visible = filter === 'all' ? current : current.filter((entry) => entry.metric === filter)
  const olderCount = records.length - recent.length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* `current` is one row per exercise *and* metric, so this is the number
            of live bests rather than the number of exercises — and the tile
            below counts the exercises themselves. */}
        <StatTile value={current.length} label="Live bests" tone="brand" />
        <StatTile value={records.length} label="Records set all-time" />
        <StatTile value={setThisWeek} label="Set this week" tone="ok" />
        <StatTile
          value={exercises}
          label="Exercises with a record"
          hint={exercises ? 'Each has one live best' : undefined}
        />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-mist-100">
              <IconTrophy className="h-4 w-4 text-amber-glow" />
              Personal records
            </h3>
            <p className="mt-0.5 text-xs text-mist-400">
              Written automatically whenever a set beats your best. The previous best is never deleted.
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestAdd}
            className="min-h-11 rounded-lg border border-brand-400/40 px-3 py-1.5 text-xs font-semibold text-brand-300 transition hover:bg-brand-500/10"
          >
            + Log a record
          </button>
        </div>

        <Segmented
          className="mb-3"
          ariaLabel="Filter records by metric"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All' },
            { id: 'reps', label: 'Reps' },
            { id: 'hold', label: 'Holds' },
            { id: 'weight', label: 'Load' },
          ]}
        />

        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-mist-400">
            No records yet. Log a set in a workout and beat your best — or add one by hand.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((entry) => {
              const exercise = getExercise(entry.exerciseId)
              if (!exercise) return null
              const before = previous.get(`${entry.exerciseId}:${entry.metric}`)?.[0]
              const improvement = before ? entry.value - before.value : 0
              return (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/50 p-3"
                >
                  <button
                    type="button"
                    onClick={() => onOpenExercise(exercise)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-mist-100">{exercise.name}</span>
                      <MusclePill muscle={exercise.mainMuscle} />
                      <DifficultyBadge level={exercise.difficulty as Difficulty} />
                    </div>
                    <p className="mt-0.5 text-xs text-mist-400">
                      {metricMeta(entry.metric).label} · {recordDay(entry)}
                      {before ? ` · previous best ${before.value} ${metricMeta(entry.metric).unit}` : ' · first record'}
                    </p>
                  </button>

                  <div className="shrink-0 text-right">
                    <div className="tnum text-lg leading-none font-bold text-amber-glow">
                      {entry.value}
                      <span className="ml-0.5 text-[11px] font-medium text-mist-400">
                        {metricMeta(entry.metric).unit}
                      </span>
                    </div>
                    {improvement > 0 && (
                      <div className="tnum text-[10px] font-semibold text-lime-glow">+{improvement}</div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onDelete(entry.id)}
                    aria-label={`Delete record for ${exercise.name}`}
                    className="grid size-11 shrink-0 place-items-center rounded-md text-mist-500 transition hover:text-rose-glow"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-mist-100">Record history</h3>
        <p className="mt-0.5 text-xs text-mist-400">
          Every time a best was broken, newest first. 🎉 marks the entry that still stands.
        </p>

        {recent.length === 0 ? (
          <p className="py-6 text-center text-xs text-mist-400">Nothing yet.</p>
        ) : (
          <>
            <ul className="mt-3 space-y-1.5">
              {recent.map((entry) => {
                const exercise = getExercise(entry.exerciseId)
                if (!exercise) return null
                const isCurrent = current.some(
                  (best) => best.exerciseId === entry.exerciseId && best.metric === entry.metric && best.id === entry.id,
                )
                return (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2 border-b border-ink-700/50 py-1.5 text-[11px] last:border-0"
                  >
                    <span className="tnum w-16 shrink-0 text-mist-500">{recordDay(entry)}</span>
                    <span className="min-w-0 flex-1 truncate text-mist-300">{exercise.name}</span>
                    <span className="tnum shrink-0 text-mist-400">{metricMeta(entry.metric).short}</span>
                    <span className="tnum w-14 shrink-0 text-right font-semibold text-mist-100">
                      {entry.value} {metricMeta(entry.metric).unit}
                    </span>
                    <span className="w-4 shrink-0 text-center">{isCurrent ? '🎉' : ''}</span>
                  </li>
                )
              })}
            </ul>

            {/* The heading promises *every* best ever broken, so say what is left
                out rather than quietly stopping at the twelfth. */}
            {olderCount > 0 && (
              <p className="mt-2 text-center text-[10px] text-mist-500">
                {olderCount} older record{olderCount === 1 ? '' : 's'} not shown.
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

export interface AddRecordSheetProps {
  /** Current best per `exerciseId:metric`, so the sheet can be honest. */
  best: (exerciseId: string, metric: RecordMetric) => number
  onAdd: (entry: { exerciseId: string; metric: RecordMetric; value: number }) => boolean
  onClose: () => void
}

const SUGGESTED: { exerciseId: string; metric: RecordMetric; label: string }[] = [
  { exerciseId: 'push-ups', metric: 'reps', label: 'Max push-ups' },
  { exerciseId: 'dips', metric: 'reps', label: 'Max dips' },
  { exerciseId: 'bodyweight-squats', metric: 'reps', label: 'Max bodyweight squats' },
  { exerciseId: 'plank', metric: 'hold', label: 'Longest plank' },
  { exerciseId: 'l-sit', metric: 'hold', label: 'Longest L-sit' },
  { exerciseId: 'dips', metric: 'weight', label: 'Best weighted dips' },
]

/** Manual entry for a record achieved outside the app. */
export function AddRecordSheet({ best, onAdd, onClose }: AddRecordSheetProps) {
  const [presetId, setPresetId] = useState(`${SUGGESTED[0].exerciseId}:${SUGGESTED[0].metric}`)
  const [query, setQuery] = useState('')
  const [metric, setMetric] = useState<RecordMetric>('reps')
  const [value, setValue] = useState('')

  /** A preset wins; otherwise we resolve the typed name against the library. */
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    return LIBRARY.filter((exercise) =>
      `${exercise.name} ${exercise.mainMuscle} ${exercise.keywords?.join(' ') ?? ''}`
        .toLowerCase()
        .includes(term),
    ).slice(0, 6)
  }, [query])

  /*
   * Three ways to be chosen, in order of specificity: one of the common
   * records, a result row the user tapped, or — if they have typed something and
   * not tapped a row — the first match.
   *
   * The third case used to win over the second. A result row is stored as a bare
   * exercise id, which is never one of the common-record keys, so tapping the
   * *second* result silently fell back to `matches[0]` and saved the first one
   * instead — while showing that exercise's name and best in the panel above.
   */
  const resolved = useMemo(() => {
    const preset = SUGGESTED.find((option) => `${option.exerciseId}:${option.metric}` === presetId)
    if (preset) return preset

    const picked = matches.find((exercise) => exercise.id === presetId)
    if (picked) return { exerciseId: picked.id, metric, label: picked.name }

    const first = matches[0]
    if (!query.trim() || !first) return null
    return { exerciseId: first.id, metric, label: first.name }
  }, [presetId, query, matches, metric])

  const currentBest = resolved ? best(resolved.exerciseId, resolved.metric) : 0
  const parsed = Number(value)
  const isRecord = Number.isFinite(parsed) && parsed > currentBest

  const submit = () => {
    if (!isRecord || !resolved) return
    onAdd({ exerciseId: resolved.exerciseId, metric: resolved.metric, value: parsed })
    onClose()
  }

  return (
    <Sheet
      title="Log a personal record"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!isRecord || !resolved}
          className="min-h-11 w-full rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:bg-ink-700 disabled:text-ink-500"
        >
          Save record
        </button>
      }
    >
      <p className="text-xs text-mist-400">
        Use this for anything you did away from the app. Records logged during a workout are added
        automatically.
      </p>

      <p className="mt-3 text-[10px] tracking-wide text-mist-400 uppercase">Common records</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {SUGGESTED.map((option) => {
          const key = `${option.exerciseId}:${option.metric}`
          return (
            <Chip
              key={key}
              pressed={presetId === key}
              onClick={() => {
                setPresetId(key)
                setQuery('')
                setValue('')
              }}
            >
              {option.label}
            </Chip>
          )
        })}
      </div>

      <p className="mt-4 text-[10px] tracking-wide text-mist-400 uppercase">Or search the library</p>
      <TextField
        className="mt-1.5"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setPresetId('')
          setValue('')
        }}
        placeholder="e.g. Archer Pull-ups"
      />

      {query.trim() && (
        <>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {matches.length ? (
              matches.map((exercise) => (
                <Chip
                  key={exercise.id}
                  pressed={resolved?.exerciseId === exercise.id}
                  onClick={() => {
                    // A bare id, so switching the metric below keeps the
                    // exercise the user actually picked.
                    setPresetId(exercise.id)
                    setValue('')
                  }}
                >
                  {exercise.name}
                </Chip>
              ))
            ) : (
              <p className="text-[11px] text-mist-500">No library match for “{query.trim()}”.</p>
            )}
          </div>

          <div className="mt-3">
            <Segmented
              ariaLabel="Record metric"
              value={metric}
              onChange={setMetric}
              options={[
                { id: 'reps', label: 'Reps' },
                { id: 'hold', label: 'Hold (s)' },
                { id: 'weight', label: 'Load (kg)' },
              ]}
            />
          </div>
        </>
      )}

      <div className="mt-4">
        <NumberField
          label="Value"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          suffix={resolved ? metricMeta(resolved.metric).unit : ''}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-2">
        <span className="text-xs text-mist-400">Saving as</span>
        <Pill className="bg-ink-800 text-mist-200 ring-ink-600">
          {resolved
            ? `${resolved.label} · ${metricMeta(resolved.metric).unit}`
            : 'Pick an exercise above'}
        </Pill>
      </div>

      {currentBest > 0 && (
        <p
          className={`mt-2 text-[11px] ${
            parsed > 0 && !isRecord ? 'text-rose-glow' : 'text-mist-400'
          }`}
        >
          {parsed > 0 && !isRecord
            ? `That does not beat your current best of ${currentBest} ${metricMeta(resolved?.metric ?? 'reps').unit}, so it would not be saved as a record.`
            : `Your current best is ${currentBest} ${metricMeta(resolved?.metric ?? 'reps').unit}. Anything above that counts.`}
        </p>
      )}
    </Sheet>
  )
}
