import { useEffect, useState } from 'react'
import { getExercise } from '../data'
import { formatDuration, relativeDay } from '../lib/dates'
import { sessionStats } from '../lib/stats'
import {
  FEELINGS,
  ITEM_STATUS_META,
  appendSet,
  elapsedSeconds,
  recomputeItemStatus,
} from '../lib/session'
import type { Exercise, LoggedSet, SessionItem, WorkoutSession } from '../types'
import { ExerciseAnimation } from './ExerciseAnimation'
import {
  Card,
  Chip,
  IconCheck,
  IconNote,
  IconPlus,
  IconSkip,
  IconTrash,
  Pill,
  ProgressBar,
  ProgressRing,
  TextArea,
} from './kit'
import { DifficultyBadge, MusclePill } from './ui'

export interface SessionViewProps {
  session: WorkoutSession
  onChange: (patch: Partial<WorkoutSession>) => void
  onFinish: () => void
  onDiscard: () => void
  onOpenExercise: (exercise: Exercise) => void
  onRequestAddExercise: () => void
}

export function SessionView({
  session,
  onChange,
  onFinish,
  onDiscard,
  onOpenExercise,
  onRequestAddExercise,
}: SessionViewProps) {
  const [now, setNow] = useState(() => Date.now())
  const [confirmFinish, setConfirmFinish] = useState(false)

  const running = session.status === 'in-progress'
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running])

  const stats = sessionStats(session)
  const elapsed = elapsedSeconds(session, now)

  const patchItem = (itemId: string, patch: Partial<SessionItem>) =>
    onChange({
      items: session.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    })

  const patchSet = (itemId: string, setIndex: number, patch: Partial<LoggedSet>) =>
    onChange({
      items: session.items.map((item) =>
        item.id === itemId
          ? recomputeItemStatus({
              ...item,
              sets: item.sets.map((set, index) => (index === setIndex ? { ...set, ...patch } : set)),
            })
          : item,
      ),
    })

  const toggleSet = (itemId: string, setIndex: number) =>
    patchSet(itemId, setIndex, { status: session.items.find((i) => i.id === itemId)?.sets[setIndex].status === 'done' ? 'pending' : 'done' })

  const removeItem = (itemId: string) =>
    onChange({ items: session.items.filter((item) => item.id !== itemId) })

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-14 z-20 -mx-4 mb-4 border-b border-ink-700 bg-ink-950/90 px-4 py-3 backdrop-blur-xl sm:top-16 sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="flex items-center gap-4">
          <ProgressRing value={stats.completion} size={68} stroke={7} tone={stats.completion === 100 ? 'ok' : 'brand'}>
            <div>
              <div className="tnum text-sm leading-none font-bold text-mist-100">{stats.completion}%</div>
              <div className="mt-0.5 text-[9px] text-mist-400">done</div>
            </div>
          </ProgressRing>

          <div className="min-w-0 flex-1">
            <input
              value={session.workoutName}
              onChange={(event) => onChange({ workoutName: event.target.value })}
              aria-label="Workout name"
              className="min-h-11 w-full truncate bg-transparent text-base font-bold text-white focus:outline-none"
            />
            <p className="tnum mt-0.5 text-[11px] text-mist-400">
              {relativeDay(session.date)} · {formatDuration(elapsed)} · {stats.setsDone}/{stats.setsTotal} sets ·{' '}
              {stats.reps} reps
            </p>
          </div>

          {/*
           * Both finish buttons go through the confirmation. The sticky one is
           * the easiest to hit by accident on a phone, and filing a session is
           * not undoable, so it cannot be a shortcut around the dialog.
           */}
          <button
            type="button"
            onClick={() => setConfirmFinish(true)}
            className="shrink-0 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400"
          >
            Finish
          </button>
        </div>
        <ProgressBar value={stats.completion} className="mt-3" tone={stats.completion === 100 ? 'ok' : 'brand'} label="Session completion" />
      </div>

      {session.items.length === 0 ? (
        <Card className="py-14 text-center">
          <p className="text-sm text-mist-400">
            No exercises yet. Add the first one to start logging sets.
          </p>
          <button
            type="button"
            onClick={onRequestAddExercise}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <IconPlus /> Add exercise
          </button>
        </Card>
      ) : (
        <ul className="space-y-3">
          {session.items.map((item) => (
            <SessionItemCard
              key={item.id}
              item={item}
              onToggleSet={toggleSet}
              onPatchSet={patchSet}
              onPatch={patchItem}
              onRemove={removeItem}
              onOpenExercise={onOpenExercise}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onRequestAddExercise}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-600 py-3 text-sm font-medium text-mist-300 transition hover:border-brand-400/50 hover:text-brand-300"
      >
        <IconPlus /> Add exercise to session
      </button>

      <Card className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <IconNote className="h-4 w-4 text-brand-300" />
          <h3 className="text-sm font-semibold text-mist-100">How did you feel?</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FEELINGS.map((feeling) => (
            <Chip
              key={feeling}
              pressed={session.feel === feeling}
              onClick={() => onChange({ feel: session.feel === feeling ? undefined : feeling })}
            >
              {feeling}
            </Chip>
          ))}
        </div>
        <TextArea
          className="mt-3"
          rows={3}
          value={session.notes ?? ''}
          onChange={(event) => onChange({ notes: event.target.value })}
          placeholder="Dips felt easy today. Legs were tired…"
        />
      </Card>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setConfirmFinish(true)}
          className="flex-1 rounded-xl bg-lime-glow py-3 text-sm font-semibold text-ink-950 transition hover:brightness-110"
        >
          Finish workout
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-xl border border-ink-600 px-4 py-3 text-sm text-mist-300 transition hover:border-rose-glow/40 hover:text-rose-glow"
        >
          Discard
        </button>
      </div>

      {confirmFinish && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Finish workout"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
        >
          <div className="animate-rise w-full rounded-t-3xl border border-ink-600 bg-ink-900 p-5 sm:max-w-md sm:rounded-3xl">
            <h2 className="text-base font-bold text-white">Finish this workout?</h2>
            <p className="mt-2 text-sm text-mist-300">
              {stats.setsDone} of {stats.setsTotal} sets completed across {session.items.length}{' '}
              {session.items.length === 1 ? 'exercise' : 'exercises'}. It will be filed under{' '}
              {relativeDay(session.date).toLowerCase()} and counted as{' '}
              {stats.completion === 100 ? 'completed' : stats.setsDone ? 'partially completed' : 'skipped'}.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmFinish(false)}
                className="flex-1 rounded-lg border border-ink-600 py-2.5 text-sm font-medium text-mist-200"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={onFinish}
                className="flex-1 rounded-lg bg-lime-glow py-2.5 text-sm font-semibold text-ink-950"
              >
                Finish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SessionItemCard({
  item,
  onToggleSet,
  onPatchSet,
  onPatch,
  onRemove,
  onOpenExercise,
}: {
  item: SessionItem
  onToggleSet: (itemId: string, setIndex: number) => void
  onPatchSet: (itemId: string, setIndex: number, patch: Partial<LoggedSet>) => void
  onPatch: (itemId: string, patch: Partial<SessionItem>) => void
  onRemove: (itemId: string) => void
  onOpenExercise: (exercise: Exercise) => void
}) {
  const [playing, setPlaying] = useState(true)
  const exercise = getExercise(item.exerciseId)
  if (!exercise) return null

  const animated = (exercise.animation?.length ?? 0) > 1
  const meta = ITEM_STATUS_META[item.status]
  const done = item.sets.filter((set) => set.status === 'done').length
  const isHold = Boolean(item.targetHoldSec)
  const isWeighted = item.sets.some((set) => set.weight) || Boolean(item.targetWeight)

  return (
    <li
      className={`rounded-2xl border bg-ink-850/70 p-3.5 transition ${
        item.status === 'completed'
          ? 'border-lime-glow/30'
          : item.status === 'skipped'
            ? 'border-rose-glow/25 opacity-70'
            : 'border-ink-700'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="relative shrink-0">
          <span className="block size-14 rounded-xl border border-ink-700 bg-ink-900/70 p-0.5">
            <ExerciseAnimation
              poses={exercise.animation}
              label={`${exercise.name} animation`}
              duration={1400}
              playing={playing}
            />
          </span>
          {animated && (
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              aria-label={
                playing ? `Pause the ${exercise.name} animation` : `Play the ${exercise.name} animation`
              }
              aria-pressed={playing}
              /*
               * The visible dot stays small, but the tap target is grown to a
               * full 44px - a 16px dot cannot be hit reliably mid-set, and this
               * sits directly on top of the "open exercise" hit area.
               */
              className="absolute -right-2 -bottom-2 z-20 grid size-11 place-items-center rounded-full text-mist-300 transition hover:text-brand-300"
            >
              <span className="grid size-4 place-items-center rounded-full border border-ink-600 bg-ink-900 text-[7px] leading-none">
                {playing ? '❚❚' : '▶'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenExercise(exercise)}
            className="absolute inset-0 z-10 rounded-xl"
            aria-label={`Open ${exercise.name} details`}
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <MusclePill muscle={exercise.mainMuscle} />
            <DifficultyBadge level={exercise.difficulty} />
            <Pill className={meta.chip}>{meta.indicator} {meta.label}</Pill>
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-mist-100">{exercise.name}</h3>
          <p className="tnum mt-0.5 text-[11px] text-mist-400">
            Target {item.targetSets} ×{' '}
            {isHold ? `${item.targetHoldSec ?? 0}s` : `${item.targetReps ?? 0} reps`}
            {isWeighted ? ` @ ${item.targetWeight ?? 0}kg` : ''} · {done}/{item.sets.length} sets
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${exercise.name} from session`}
          className="grid size-11 shrink-0 place-items-center rounded-md text-mist-400 transition hover:bg-rose-glow/10 hover:text-rose-glow"
        >
          <IconTrash className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="mt-3 space-y-1.5">
        {item.sets.map((set, index) => (
          <li key={index} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleSet(item.id, index)}
              aria-pressed={set.status === 'done'}
              aria-label={`Set ${index + 1} ${set.status === 'done' ? 'done' : 'not done'}`}
              className={`grid size-11 shrink-0 place-items-center rounded-lg border text-xs font-semibold transition ${
                set.status === 'done'
                  ? 'border-lime-glow/40 bg-lime-glow/20 text-lime-glow'
                  : set.status === 'skipped'
                    ? 'border-rose-glow/30 bg-rose-glow/10 text-rose-glow'
                    : 'border-ink-600 bg-ink-800 text-mist-400 hover:border-brand-400/50'
              }`}
            >
              {set.status === 'done' ? <IconCheck className="h-3.5 w-3.5" /> : index + 1}
            </button>

            {isHold ? (
              <input
                type="number"
                inputMode="numeric"
                value={set.holdSec ?? ''}
                onChange={(event) =>
                  onPatchSet(item.id, index, { holdSec: event.target.value === '' ? undefined : Number(event.target.value) })
                }
                aria-label={`Set ${index + 1} hold seconds`}
                className="tnum min-h-11 w-20 rounded-lg border border-ink-600 bg-ink-850 px-2 py-1.5 text-sm text-mist-100 no-spinner focus:border-brand-400/70 focus:outline-none"
              />
            ) : (
              <input
                type="number"
                inputMode="numeric"
                value={set.reps ?? ''}
                onChange={(event) =>
                  onPatchSet(item.id, index, { reps: event.target.value === '' ? undefined : Number(event.target.value) })
                }
                aria-label={`Set ${index + 1} reps`}
                className="tnum min-h-11 w-20 rounded-lg border border-ink-600 bg-ink-850 px-2 py-1.5 text-sm text-mist-100 no-spinner focus:border-brand-400/70 focus:outline-none"
              />
            )}

            <span className="text-[11px] text-mist-500">{isHold ? 'sec' : 'reps'}</span>

            <input
              type="number"
              inputMode="decimal"
              step={0.5}
              min={0}
              value={set.weight ?? ''}
              onChange={(event) =>
                onPatchSet(item.id, index, { weight: event.target.value === '' ? undefined : Number(event.target.value) })
              }
              aria-label={`Set ${index + 1} weight in kilograms`}
              placeholder="kg"
              className="tnum ml-auto min-h-11 w-20 rounded-lg border border-ink-600 bg-ink-850 px-2 py-1.5 text-sm text-mist-100 no-spinner focus:border-brand-400/70 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => onPatchSet(item.id, index, { status: set.status === 'skipped' ? 'pending' : 'skipped' })}
              aria-label={`${set.status === 'skipped' ? 'Unskip' : 'Skip'} set ${index + 1}`}
              title={set.status === 'skipped' ? 'Unskip set' : 'Skip set'}
              className={`grid size-11 shrink-0 place-items-center rounded-md transition ${
                set.status === 'skipped' ? 'text-rose-glow' : 'text-mist-500 hover:text-mist-300'
              }`}
            >
              <IconSkip className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-700 pt-2.5">
        <button
          type="button"
          onClick={() => onPatch(item.id, appendSet(item))}
          className="min-h-11 rounded-lg border border-ink-600 px-2.5 py-1 text-[11px] text-mist-300 transition hover:border-ink-500"
        >
          + Set
        </button>
        {item.sets.length > 1 && (
          <button
            type="button"
            onClick={() =>
              onPatch(
                item.id,
                recomputeItemStatus({ ...item, sets: item.sets.slice(0, -1), targetSets: Math.max(1, item.sets.length - 1) }),
              )
            }
            className="min-h-11 rounded-lg border border-ink-600 px-2.5 py-1 text-[11px] text-mist-300 transition hover:border-ink-500"
          >
            − Set
          </button>
        )}
        {item.status !== 'skipped' ? (
          <button
            type="button"
            onClick={() => onPatch(item.id, { status: 'skipped', sets: item.sets.map((set) => ({ ...set, status: 'skipped' as const })) })}
            className="ml-auto min-h-11 rounded-lg px-2.5 py-1 text-[11px] text-mist-400 transition hover:text-rose-glow"
          >
            Skip exercise
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onPatch(item.id, { status: 'not-started', sets: item.sets.map((set) => ({ ...set, status: 'pending' as const })) })}
            className="ml-auto min-h-11 rounded-lg px-2.5 py-1 text-[11px] text-mist-400 transition hover:text-brand-300"
          >
            Unskip exercise
          </button>
        )}
      </div>
    </li>
  )
}
