import { useEffect, useRef, useState } from 'react'
import { getExercise } from '../data'
import { formatDuration, relativeDay } from '../lib/dates'
import { formatRest } from '../lib/search'
import { REST_ADJUST_SECONDS, prescribedRest, useRestTimer } from '../lib/rest-timer'
import { sessionStats } from '../lib/stats'
import {
  FEELINGS,
  ITEM_STATUS_META,
  appendSet,
  dropLastSet,
  elapsedSeconds,
  patchSessionItem,
  patchSessionSet,
  setItemSkipped,
  toggleSetStatus,
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
  /** Edits the session from a function of its *stored* state. */
  onEdit: (change: (session: WorkoutSession) => Partial<WorkoutSession> | null) => void
  onFinish: () => void
  onDiscard: () => void
  onOpenExercise: (exercise: Exercise) => void
  onRequestAddExercise: () => void
}

export function SessionView({
  session,
  onEdit,
  onFinish,
  onDiscard,
  onOpenExercise,
  onRequestAddExercise,
}: SessionViewProps) {
  const [now, setNow] = useState(() => Date.now())
  const [confirmFinish, setConfirmFinish] = useState(false)
  const rest = useRestTimer(0)

  const running = session.status === 'in-progress'
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running])

  const stats = sessionStats(session)
  const elapsed = elapsedSeconds(session, now)

  /**
   * Every edit is expressed against the stored session rather than against the
   * `session` prop.
   *
   * This screen renders every exercise at once and a tap can easily land before
   * React has re-rendered for the previous one. Reading the rendered props here
   * would hand the updater an out-of-date copy, so two quick taps collapsed into
   * one and a set silently stopped being recorded — the single most important
   * thing this screen does.
   */
  const patchItem = (itemId: string, change: (item: SessionItem) => SessionItem) =>
    onEdit((current) => patchSessionItem(current, itemId, change))

  const patchSet = (itemId: string, setIndex: number, change: (set: LoggedSet) => LoggedSet) =>
    onEdit((current) => patchSessionSet(current, itemId, setIndex, change))

  /**
   * Starts the prescribed rest whenever a working set is newly ticked.
   *
   * This watches the *result* of the edit rather than firing from inside it. A
   * React state updater has to be pure — React may call it more than once, and it
   * runs during the update rather than after it — so kicking the timer off from
   * there made the deadline depend on how many times the updater happened to
   * run. React can also replay updaters when a component is mounted twice in
   * development, which is exactly how a rest timer starts twice. Diffing the
   * done-set pattern after the fact cannot be replayed out of order, so the
   * countdown starts once per newly completed set and not at all otherwise:
   * un-ticking a set, adding a set, skipping one, or reopening the app mid-rest
   * all leave it alone.
   */
  const donePattern = session.items.flatMap((item) => item.sets.map((set) => set.status === 'done'))
  // A string key rather than the array itself: it changes only when a set is
  // actually ticked or un-ticked, so the effect below runs on real changes
  // instead of on every keystroke in any field on the screen.
  const doneKey = donePattern.map((done) => (done ? '1' : '0')).join('')
  const seenKey = useRef<string | null>(null)
  useEffect(() => {
    const previous = seenKey.current
    seenKey.current = doneKey
    // First pass after mount is the baseline, not a newly finished set.
    if (previous === null) return

    let cursor = 0
    for (const item of session.items) {
      for (const set of item.sets) {
        if (set.status === 'done' && previous[cursor] !== '1') {
          const restSec = prescribedRest(item.targetRestSec)
          if (restSec) rest.start(restSec)
          return
        }
        cursor += 1
      }
    }
    // `doneKey` stands in for `session.items`: it changes exactly when a set
    // status does, which is the only thing this reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey])

  const toggleSet = (itemId: string, setIndex: number) =>
    patchSet(itemId, setIndex, toggleSetStatus)

  const removeItem = (itemId: string) =>
    onEdit((current) => ({ items: current.items.filter((item) => item.id !== itemId) }))

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
              onChange={(event) => onEdit(() => ({ workoutName: event.target.value }))}
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

        {/*
          * Rest lives in the pinned header rather than inside each exercise card,
          * so it stays put and stays operable while the user scrolls down the
          * list, adds a set or opens an exercise detail. It is pinned together
          * with the header rather than in a sticky bar of its own because such a
          * bar cannot be offset below a header whose height changes with the
          * progress bar and the workout name — pinning the two together is what
          * actually keeps the countdown on screen halfway down a long workout.
          *
          * It adds no height when there is nothing to count down. It is driven
          * off absolute deadlines and a single interval, so scrolling this list,
          * re-rendering the screen or switching exercises cannot restart it or
          * leave a second timer running.
          */}
        <RestTimerBar rest={rest} />
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
              onClick={() => onEdit(() => ({ feel: session.feel === feeling ? undefined : feeling }))}
            >
              {feeling}
            </Chip>
          ))}
        </div>
        <TextArea
          className="mt-3"
          rows={3}
          value={session.notes ?? ''}
          onChange={(event) => onEdit(() => ({ notes: event.target.value }))}
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

/**
 * The rest countdown.
 *
 * `useRestTimer` owns exactly one interval and only runs it while counting, so
 * this bar can appear and disappear freely without leaking timers. Start, pause,
 * reset and +30s are all plain state transitions over an absolute deadline,
 * which is what keeps the count honest across re-renders.
 */
function RestTimerBar({ rest }: { rest: ReturnType<typeof useRestTimer> }) {
  // Nothing to show until a set has actually started a rest.
  if (!rest.state.totalSec) return null

  const minutes = Math.floor(rest.remaining / 60)
  const seconds = rest.remaining % 60
  const label = `${minutes}:${String(seconds).padStart(2, '0')}`
  const tone = rest.finished ? 'border-lime-glow/45' : 'border-ink-600'

  return (
    <div
      className={`mt-3 flex items-center gap-2.5 rounded-2xl border bg-ink-850/80 px-3 py-2.5 ${tone}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium tracking-wider text-mist-400 uppercase">
          {rest.finished ? 'Rest over' : 'Rest'}
        </p>
        <p
          className={`tnum text-xl leading-none font-bold ${rest.finished ? 'text-lime-glow' : 'text-mist-100'}`}
          // Announced politely: it changes every second, so it must not
          // interrupt whatever the user is doing.
          aria-live="off"
        >
          {label}
        </p>
      </div>

      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={() => rest.adjust(REST_ADJUST_SECONDS)}
          className="min-h-11 rounded-lg border border-ink-600 px-2.5 text-[11px] font-semibold text-mist-200 transition hover:border-brand-400/50"
        >
          +{REST_ADJUST_SECONDS}s
        </button>
        {rest.running ? (
          <button
            type="button"
            onClick={rest.pause}
            aria-label="Pause rest timer"
            className="min-h-11 rounded-lg border border-ink-600 px-2.5 text-[11px] font-semibold text-mist-200 transition hover:border-brand-400/50"
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={rest.resume}
            disabled={rest.finished}
            aria-label="Resume rest timer"
            className="min-h-11 rounded-lg border border-ink-600 px-2.5 text-[11px] font-semibold text-mist-200 transition hover:border-brand-400/50 disabled:opacity-40"
          >
            Resume
          </button>
        )}
        <button
          type="button"
          onClick={() => rest.reset()}
          aria-label="Reset rest timer"
          className="min-h-11 rounded-lg border border-ink-600 px-2.5 text-[11px] font-semibold text-mist-200 transition hover:border-rose-glow/40 hover:text-rose-glow"
        >
          Reset
        </button>
      </div>
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
  onPatchSet: (itemId: string, setIndex: number, change: (set: LoggedSet) => LoggedSet) => void
  onPatch: (itemId: string, change: (item: SessionItem) => SessionItem) => void
  onRemove: (itemId: string) => void
  onOpenExercise: (exercise: Exercise) => void
}) {
  const [playing, setPlaying] = useState(true)
  // The text area is a controlled input, so it needs a local draft while it is
  // being typed into. The value is written through to the session on every
  // keystroke as well, so the draft is only ever a fast path for the caret - if
  // it is lost the field falls back to the stored note and nothing is lost.
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})
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
            {/*
                * The prescribed rest, shown next to the rest of the target. It
                * used to be dropped when the session started, so the timer had
                * nothing to count and the number was invisible even though the
                * builder used it to estimate the session length.
              */}
            {item.targetRestSec ? ` · rest ${formatRest(item.targetRestSec)}` : ''}
          </p>
          {item.note && (
            <p className="mt-1 flex items-start gap-1.5 text-[11px] text-mist-400">
              <IconNote className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="min-w-0">{item.note}</span>
            </p>
          )}
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
              // "Set 1 of 8" rather than a bare "Set 1": a screen reader
              // announcing an unnumbered set tells the user nothing about which
              // exercise or which position they are actually on.
              aria-label={`${exercise.name} set ${index + 1} of ${item.sets.length}, ${
                set.status === 'done' ? 'done' : set.status === 'skipped' ? 'skipped' : 'not done'
              }`}
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
                  onPatchSet(item.id, index, (current) => ({
                    ...current,
                    holdSec: event.target.value === '' ? undefined : Number(event.target.value),
                  }))
                }
                aria-label={`${exercise.name} set ${index + 1} hold seconds`}
                className="tnum min-h-11 w-20 rounded-lg border border-ink-600 bg-ink-850 px-2 py-1.5 text-sm text-mist-100 no-spinner focus:border-brand-400/70 focus:outline-none"
              />
            ) : (
              <input
                type="number"
                inputMode="numeric"
                value={set.reps ?? ''}
                onChange={(event) =>
                  onPatchSet(item.id, index, (current) => ({
                    ...current,
                    reps: event.target.value === '' ? undefined : Number(event.target.value),
                  }))
                }
                aria-label={`${exercise.name} set ${index + 1} reps`}
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
                onPatchSet(item.id, index, (current) => ({
                  ...current,
                  weight: event.target.value === '' ? undefined : Number(event.target.value),
                }))
              }
              aria-label={`${exercise.name} set ${index + 1} weight in kilograms`}
              placeholder="kg"
              className="tnum ml-auto min-h-11 w-20 rounded-lg border border-ink-600 bg-ink-850 px-2 py-1.5 text-sm text-mist-100 no-spinner focus:border-brand-400/70 focus:outline-none"
            />

            <button
              type="button"
              onClick={() =>
                onPatchSet(item.id, index, (current) => ({
                  ...current,
                  status: current.status === 'skipped' ? ('pending' as const) : ('skipped' as const),
                }))
              }
              aria-label={`${set.status === 'skipped' ? 'Unskip' : 'Skip'} ${exercise.name} set ${index + 1}`}
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
          onClick={() => onPatch(item.id, appendSet)}
          className="min-h-11 rounded-lg border border-ink-600 px-2.5 py-1 text-[11px] text-mist-300 transition hover:border-ink-500"
        >
          + Set
        </button>
        {item.sets.length > 1 && (
          <button
            type="button"
            onClick={() => onPatch(item.id, dropLastSet)}
            className="min-h-11 rounded-lg border border-ink-600 px-2.5 py-1 text-[11px] text-mist-300 transition hover:border-ink-500"
          >
            − Set
          </button>
        )}
        {/*
            * Skipping is reversible and never destructive: it only flips set
            * statuses, so every rep, hold and weight already entered survives an
            * accidental skip. Un-skipping puts them back as pending rather than
            * rewriting the numbers.
          */}
        {item.status !== 'skipped' ? (
          <button
            type="button"
            onClick={() => onPatch(item.id, (current) => setItemSkipped(current, true))}
            className="ml-auto min-h-11 rounded-lg px-2.5 py-1 text-[11px] text-mist-400 transition hover:text-rose-glow"
          >
            Skip exercise
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onPatch(item.id, (current) => setItemSkipped(current, false))}
            className="ml-auto min-h-11 rounded-lg px-2.5 py-1 text-[11px] text-mist-400 transition hover:text-brand-300"
          >
            Unskip exercise
          </button>
        )}
      </div>

      {/*
          * A note can be written mid-session, per exercise. The workout's own
          * note is shown above when it exists; this is for the coaching cue that
          * only makes sense mid-set, and it is stored on the item so it survives
          * into history.
        */}
      <TextArea
        rows={2}
        value={noteDraft[item.id] ?? item.note ?? ''}
        onChange={(event) => {
          const value = event.target.value
          setNoteDraft((current) => ({ ...current, [item.id]: value }))
          onPatch(item.id, (current) => ({ ...current, note: value || undefined }))
        }}
        placeholder={`Note for ${exercise.name}…`}
        aria-label={`Note for ${exercise.name}`}
        className="mt-2.5 text-xs"
      />
    </li>
  )
}
