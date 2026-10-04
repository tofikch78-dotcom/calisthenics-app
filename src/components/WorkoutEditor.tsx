import { useEffect, useMemo, useState } from 'react'
import { getExercise } from '../data'
import { MUSCLE_ORDER } from '../data/taxonomy'
import { equipmentLabel, muscleLabel, muscleMeta } from '../lib/labels'
import {
  exercisesForMuscles,
  formatDosage,
  formatRest,
  muscleExerciseCount,
  queryLibrary,
  targetsMuscle,
  type SortKey,
} from '../lib/search'
import { makeWorkoutItem, makeItemId, moveItem, newWorkoutDraft } from '../lib/store'
import type { Exercise, Muscle, Workout, WorkoutItem } from '../types'
import { ExerciseAnimation } from './ExerciseAnimation'
import { ExercisePicker } from './ExercisePicker'
import {
  Button,
  DifficultyBadge,
  IconCheck,
  IconClose,
  IconCopy,
  IconDumbbell,
  IconDown,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUp,
  MusclePill,
  PlayPauseGlyph,
  SectionHeading,
  Tag,
} from './ui'

const numberField =
  'min-h-11 w-full rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-1.5 text-sm text-mist-100 focus:border-brand-400/70 focus:outline-none'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium tracking-wider text-mist-400 uppercase">
        {label}
        {hint ? <span className="ml-1 normal-case opacity-70">{hint}</span> : null}
      </span>
      {children}
    </label>
  )
}

/* ── Step 1: which muscle groups is this workout for? ──────────────────── */

/**
 * The 12 muscle groups, in the same order as the library filter.
 *
 * Picking one muscle did not match how people train. "Back + Biceps",
 * "Chest + Shoulders + Triceps" and "Legs + Glutes" are single sessions, so the
 * tiles are a multi-select: tapping adds, tapping again removes, and the tile
 * says which it is so nothing has to be counted by eye. Choosing does not
 * advance on its own — the user has to be able to keep adding.
 */
function MuscleStep({
  selected,
  onToggle,
}: {
  selected: readonly Muscle[]
  onToggle: (muscle: Muscle) => void
}) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {MUSCLE_ORDER.map((muscle) => {
        const counts = muscleExerciseCount(muscle)
        const on = selected.includes(muscle)
        return (
          <li key={muscle}>
            <button
              type="button"
              onClick={() => onToggle(muscle)}
              aria-pressed={on}
              aria-label={`${on ? 'Remove' : 'Choose'} ${muscleLabel(muscle)}, ${counts.all} exercises`}
              className={`flex min-h-16 w-full flex-col items-start justify-center gap-0.5 rounded-xl border p-3 text-left transition ${
                on
                  ? 'border-brand-400 bg-brand-500/12 ring-1 ring-brand-400/40'
                  : 'border-ink-700 bg-ink-850/70 hover:border-brand-400/55 hover:bg-ink-800'
              }`}
            >
              <span className="flex w-full items-center gap-1.5">
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded-full border text-[9px] leading-none ${
                    on
                      ? 'border-brand-400 bg-brand-500 text-white'
                      : 'border-ink-600 text-transparent'
                  }`}
                  aria-hidden="true"
                >
                  <IconCheck className="h-2.5 w-2.5" />
                </span>
                <MusclePill muscle={muscle} />
                <span className="tnum ml-auto text-[11px] text-mist-400">{counts.all}</span>
              </span>
              <span className={`truncate text-[11px] ${on ? 'text-mist-300' : 'text-mist-500'}`}>
                {muscleMeta(muscle).hint}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * What has been chosen so far, in one line, with a way out of each choice and a
 * way forward. On a phone this is the only place the running answer is visible,
 * so it states the count, the names, and how many movements that unlocks.
 */
function MuscleSummary({
  selected,
  total,
  onRemove,
  onContinue,
}: {
  selected: readonly Muscle[]
  total: number
  onRemove: (muscle: Muscle) => void
  onContinue: () => void
}) {
  const empty = selected.length === 0
  return (
    <div
      className={`mt-3 rounded-xl border px-3 py-2.5 ${
        empty ? 'border-dashed border-ink-600 bg-ink-850/40' : 'border-ink-600 bg-ink-850/70'
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((muscle) => (
          <span
            key={muscle}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-500/15 py-1 pr-1 pl-2.5 text-xs font-medium text-brand-300 ring-1 ring-brand-400/30"
          >
            {muscleLabel(muscle)}
            <button
              type="button"
              onClick={() => onRemove(muscle)}
              aria-label={`Remove ${muscleLabel(muscle)} from this workout`}
              className="relative grid size-6 place-items-center rounded text-brand-300/80 transition hover:text-brand-200 before:absolute before:-inset-2.5 before:content-['']"
            >
              <IconClose className="h-3 w-3" />
            </button>
          </span>
        ))}
        {empty && (
          <span className="text-xs text-mist-400">
            Nothing picked yet — tap one or more muscle groups above.
          </span>
        )}
      </div>

      <p className="mt-2 text-[11px] text-mist-400">
        {empty
          ? 'Pick at least one muscle group to continue.'
          : `${selected.length} ${selected.length === 1 ? 'muscle' : 'muscles'} selected · ${total} ${
              total === 1 ? 'movement' : 'movements'
            } to choose from`}
      </p>

      <button
        type="button"
        onClick={onContinue}
        disabled={empty}
        className="mt-2.5 min-h-11 w-full rounded-xl bg-brand-500 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-ink-800 disabled:text-ink-500"
      >
        {empty ? 'Pick a muscle group first' : `Next · choose exercises (${total})`}
      </button>
    </div>
  )
}

/* ── Step 2: the exercises for the chosen muscle ───────────────────────── */

/**
 * One candidate exercise. Every field the builder promises is on the row —
 * name, primary muscle, secondaries, difficulty, equipment, recommended
 * dosage — so nothing has to be opened to decide.
 *
 * `alsoTargets` is the other muscle groups this workout is for that the
 * exercise also trains. With several muscles selected, that line is what tells
 * the user this row serves two of their choices at once, instead of leaving them
 * to compare it against the heading above.
 *
 * The pause control and the "open details" button are siblings of the stretched
 * hit area rather than children of it, so the markup has no nested buttons.
 */
function ExerciseChoice({
  exercise,
  alsoTargets,
  count,
  onToggle,
  onOpen,
}: {
  exercise: Exercise
  alsoTargets: readonly Muscle[]
  count: number
  onToggle: () => void
  onOpen: () => void
}) {
  const [playing, setPlaying] = useState(true)
  const animated = (exercise.animation?.length ?? 0) > 1
  const secondary = exercise.secondaryMuscles.filter((muscle) => muscle !== exercise.mainMuscle)

  return (
    <li
      className={`relative rounded-2xl border bg-ink-850/70 p-3 transition ${
        count > 0 ? 'border-lime-glow/35' : 'border-ink-700 hover:border-ink-500'
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
              className="absolute -right-2.5 -bottom-2.5 z-20 grid size-11 place-items-center rounded-full text-mist-300 transition hover:text-brand-300"
            >
              <span className="grid size-4 place-items-center rounded-full border border-ink-600/80 bg-ink-900/85">
                <PlayPauseGlyph playing={playing} />
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpen}
            className="absolute inset-0 z-10 rounded-xl transition hover:border-brand-400/50"
            aria-label={`Open ${exercise.name} details`}
          />
        </span>

        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-mist-100">{exercise.name}</h4>
          <p className="mt-1 flex items-baseline gap-1.5 text-[11px]">
            <span className="shrink-0 tracking-wide text-mist-400 uppercase">Primary</span>
            <span className="font-semibold text-mist-200">
              {muscleLabel(exercise.mainMuscle)}
            </span>
          </p>
          <p className="mt-0.5 flex items-baseline gap-1.5 text-[11px]">
            <span className="shrink-0 tracking-wide text-mist-400 uppercase">Secondary</span>
            <span className="min-w-0 truncate text-mist-300">
              {secondary.length ? secondary.map(muscleLabel).join(', ') : '—'}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <DifficultyBadge level={exercise.difficulty} />
        <Tag>{exercise.equipment.map(equipmentLabel).join(' · ')}</Tag>
        {alsoTargets.length > 0 && (
          <Tag className="text-brand-300">
            Also trains {alsoTargets.map(muscleLabel).join(' · ')}
          </Tag>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-ink-700/80 pt-2.5">
        <span className="font-mono text-xs text-mist-300">
          {formatDosage(exercise.dosage)}
          {exercise.dosage.restSec ? ` · rest ${formatRest(exercise.dosage.restSec)}` : ''}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={count > 0}
          aria-label={`${count > 0 ? 'Remove' : 'Add'} ${exercise.name} ${
            count > 0 ? 'from' : 'to'
          } the workout`}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
            count > 0
              ? 'bg-lime-glow/15 text-lime-glow ring-1 ring-lime-glow/35 hover:bg-lime-glow/20'
              : 'border border-ink-600 text-mist-300 hover:border-brand-400/50 hover:text-brand-300'
          }`}
        >
          {count > 0 ? <IconCheck className="h-3.5 w-3.5" /> : <IconPlus className="h-3.5 w-3.5" />}
          {count > 0 ? (count > 1 ? `Added ×${count}` : 'Added') : 'Add'}
        </button>
      </div>
    </li>
  )
}

/* ── The per-exercise configuration row ───────────────────────────────── */

function ItemRow({
  item,
  index,
  total,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  onOpen,
}: {
  item: WorkoutItem
  index: number
  total: number
  onChange: (patch: Partial<WorkoutItem>) => void
  onRemove: () => void
  onDuplicate: () => void
  onMove: (direction: -1 | 1) => void
  onOpen: (exercise: Exercise) => void
}) {
  const [playing, setPlaying] = useState(true)
  const exercise = getExercise(item.exerciseId)
  if (!exercise) return null

  const animated = (exercise.animation?.length ?? 0) > 1
  const setNumber = (key: 'sets' | 'reps' | 'holdSec' | 'restSec' | 'weight', raw: string) => {
    const value = raw === '' ? undefined : Number(raw)
    onChange({ [key]: value } as Partial<WorkoutItem>)
  }

  return (
    <li className="rounded-2xl border border-ink-700 bg-ink-850/70 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-ink-800 font-mono text-[11px] text-mist-400">
          {index + 1}
        </span>

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
              className="absolute -right-1 -bottom-1 z-20 grid size-4 place-items-center rounded-full border border-ink-600 bg-ink-900 text-mist-300 before:absolute before:-inset-3.5 before:content-['']"
            >
              <PlayPauseGlyph playing={playing} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpen(exercise)}
            className="absolute inset-0 z-10 rounded-xl transition hover:border-brand-400/50"
            aria-label={`Open ${exercise.name} details`}
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <MusclePill muscle={exercise.mainMuscle} />
            <DifficultyBadge level={exercise.difficulty} />
          </div>
          <h4 className="mt-1 truncate text-sm font-semibold text-mist-100">{exercise.name}</h4>
          <p className="mt-0.5 font-mono text-[11px] text-mist-400">
            {item.sets} × {item.reps ? `${item.reps} reps` : item.holdSec ? `${item.holdSec}s` : '—'}
            {item.weight ? ` @ ${item.weight}kg` : ''} · rest {formatRest(item.restSec)}
            {item.notes ? ' · has notes' : ''}
          </p>
        </div>
      </div>

      {/*
        The actions get their own line rather than sitting beside the name.
        Four 44px targets and a thumbnail do not fit across a phone, and a row
        this dense is exactly where a mis-tap silently reorders or deletes a
        whole exercise, so they are given room to be hit deliberately.
      */}
      <div className="mt-2.5 flex items-center gap-1 border-t border-ink-700/70 pt-2">
        <IconButton label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          <IconUp className="h-4 w-4" />
        </IconButton>
        <IconButton label="Move down" disabled={index === total - 1} onClick={() => onMove(1)}>
          <IconDown className="h-4 w-4" />
        </IconButton>
        <span className="ml-auto flex items-center gap-1">
          <IconButton label="Duplicate exercise" onClick={onDuplicate}>
            <IconCopy className="h-4 w-4" />
          </IconButton>
          <IconButton label="Remove exercise" onClick={onRemove} tone="danger">
            <IconTrash className="h-4 w-4" />
          </IconButton>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Sets">
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={item.sets}
            onChange={(event) => setNumber('sets', event.target.value)}
            className={numberField}
          />
        </Field>
        <Field label="Reps">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={item.reps ?? ''}
            onChange={(event) => setNumber('reps', event.target.value)}
            placeholder="—"
            className={numberField}
          />
        </Field>
        <Field label="Hold" hint="sec">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={item.holdSec ?? ''}
            onChange={(event) => setNumber('holdSec', event.target.value)}
            placeholder="—"
            className={numberField}
          />
        </Field>
        <Field label="Rest" hint="sec">
          <input
            type="number"
            min={0}
            step={15}
            inputMode="numeric"
            value={item.restSec}
            onChange={(event) => setNumber('restSec', event.target.value)}
            className={numberField}
          />
        </Field>
        <Field label="Weight" hint="kg">
          <input
            type="number"
            min={0}
            step={2.5}
            inputMode="decimal"
            value={item.weight ?? ''}
            onChange={(event) => setNumber('weight', event.target.value)}
            placeholder="—"
            className={numberField}
          />
        </Field>
        <Field label="Notes">
          <input
            type="text"
            value={item.notes ?? ''}
            onChange={(event) => onChange({ notes: event.target.value })}
            placeholder="Tempo, cues…"
            className={numberField}
          />
        </Field>
      </div>

      <p className="mt-2 text-[11px] text-mist-400">
        Library default: {formatDosage(exercise.dosage)}
        {exercise.dosage.note ? ` (${exercise.dosage.note})` : ''}
      </p>
    </li>
  )
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  tone = 'default',
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid min-h-11 min-w-11 place-items-center rounded-lg transition disabled:opacity-25 ${
        tone === 'danger'
          ? 'text-mist-400 hover:bg-rose-500/12 hover:text-rose-300'
          : 'text-mist-400 hover:bg-ink-800 hover:text-mist-100'
      }`}
    >
      {children}
    </button>
  )
}

/* ── The builder ──────────────────────────────────────────────────────── */

type Step = 'muscle' | 'exercises'

/** Rows rendered per group before that group's "show more" appears. */
const PAGE = 24

/** One labelled block of the exercise list, so several muscles stay readable. */
interface MuscleGroup {
  key: string
  title: string
  hint: string
  rows: Exercise[]
}

export interface WorkoutEditorProps {
  /** The saved workout being edited, or null while composing a new one. */
  workout: Workout | null
  /** Exercises handed over by another screen, e.g. My Exercises. */
  seedExerciseIds?: string[]
  savedIds: ReadonlySet<string>
  onSave: (workout: Workout) => void
  onDelete?: () => void
  onDuplicate?: () => void
  onCancel: () => void
  onOpenExercise: (exercise: Exercise) => void
  onSeedsConsumed?: () => void
}

/**
 * Composes one workout and saves it once.
 *
 * Nothing reaches storage until "Save workout" is pressed: the builder edits a
 * local draft, so backing out of a half-built workout leaves nothing behind and
 * pressing save twice cannot produce a second copy — the id is minted with the
 * draft and is what decides insert vs. update.
 */
export function WorkoutEditor({
  workout,
  seedExerciseIds,
  savedIds,
  onSave,
  onDelete,
  onDuplicate,
  onCancel,
  onOpenExercise,
  onSeedsConsumed,
}: WorkoutEditorProps) {
  const isNew = workout === null

  /*
   * The draft is built once, here, from either a saved workout or a fresh id —
   * including any exercises handed over by another screen. Doing it in the
   * initialiser rather than an effect means the first paint already shows them,
   * and re-running it is impossible: the caller re-keys this component per open.
   *
   * A saved workout is copied rather than referenced, so nothing reaches storage
   * until the save button, and its id is carried over — that id is what decides
   * whether saving updates the original in place or inserts a new workout.
   */
  const [draft, setDraft] = useState<Workout>(() => {
    const base: Workout = workout ? { ...workout } : newWorkoutDraft()
    if (!seedExerciseIds?.length) return base
    const present = new Set(base.items.map((item) => item.exerciseId))
    const additions = seedExerciseIds
      .filter((id) => !present.has(id))
      .map((id) => getExercise(id))
      .filter((exercise): exercise is Exercise => Boolean(exercise))
      .map((exercise, index) => makeWorkoutItem(exercise, base.items.length + index))
    if (!additions.length) return base
    const items = [...base.items, ...additions]
    return { ...base, items, name: base.name || suggestedName({ ...base, items }) }
  })

  // Handing the seeds back is a side effect on the parent, not a render, so it
  // belongs in an effect — the alternative would re-run the seed work forever.
  useEffect(() => {
    if (seedExerciseIds?.length) onSeedsConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [step, setStep] = useState<Step>('muscle')
  // A new workout opens on the muscle picker, because that is where the user
  // has to start. Opening a saved one lands on its numbers instead, with the
  // chooser a tap away — nobody edits a plan to be asked to re-plan it.
  const [chooserOpen, setChooserOpen] = useState(isNew)
  /*
   * Several muscles, in the order they were tapped, because a session is
   * usually more than one pattern. The list is the selection: it survives going
   * back to step 1, coming forward again, and searching, so nothing the user
   * chose is ever quietly dropped by navigating.
   *
   * A saved workout arrives with its own muscles already on, read off the
   * exercises it holds. Someone opening a plan to add one movement should find
   * the neighbours already listed — an empty muscle step would hide the rest of
   * the session and make the chooser look broken.
   */
  const [selected, setSelected] = useState<Muscle[]>(() => musclesOf(draft.items))
  const [primaryOnly, setPrimaryOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [pickerOpen, setPickerOpen] = useState(false)

  const patch = (next: Partial<Workout>) => setDraft((current) => ({ ...current, ...next }))

  const startChoosing = (from: Step) => {
    setStep(from)
    setQuery('')
    setLimits({})
    setChooserOpen(true)
  }

  /** Any change of list resets how much of it is expanded. */
  const changeList = (change: () => void) => {
    change()
    setLimits({})
  }

  const toggleMuscle = (muscle: Muscle) =>
    setSelected((current) =>
      current.includes(muscle)
        ? current.filter((entry) => entry !== muscle)
        : [...current, muscle],
    )

  const removeMuscle = (muscle: Muscle) =>
    setSelected((current) => current.filter((entry) => entry !== muscle))

  const goToExercises = () => {
    setStep('exercises')
    setQuery('')
    setLimits({})
  }

  /** How many times each exercise is in the draft, for the Added ×n badge. */
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of draft.items) map.set(item.exerciseId, (map.get(item.exerciseId) ?? 0) + 1)
    return map
  }, [draft.items])

  /*
   * With muscles chosen the list is the union of their exercises and nothing
   * else. Typing a search deliberately overrides it, so a user who
   * half-remembers "the ring one" is never trapped behind the filter they
   * already picked.
   */
  const searching = query.trim().length > 0
  const candidates = useMemo(() => {
    if (searching) {
      return queryLibrary(
        {
          query,
          muscles: [],
          movements: [],
          difficulties: [],
          equipment: [],
          onlySaved: false,
          sort: 'name' as SortKey,
        },
        savedIds,
      )
    }
    return exercisesForMuscles(selected, primaryOnly)
  }, [searching, query, selected, primaryOnly, savedIds])

  /*
   * With more than one muscle selected a flat list stops being readable — 94
   * rows under one heading tells you nothing about why each one is there. So the
   * muscle-driven list is grouped: one block per selected muscle holding the
   * movements it is the primary driver of, then a closing block for the
   * movements that merely help one of the picks.
   *
   * An exercise lands in exactly one block. `exercisesForMuscles` already
   * deduplicates by id, and this assigns by primary muscle, so nothing is
   * offered twice and nothing is silently dropped between blocks.
   */
  const groups = useMemo<MuscleGroup[] | null>(() => {
    if (searching || !selected.length) return null
    const blocks: MuscleGroup[] = selected.map((muscle) => ({
      key: muscle,
      title: muscleLabel(muscle),
      hint: `primary mover · ${muscleExerciseCount(muscle).primary} movements`,
      rows: candidates.filter((exercise) => exercise.mainMuscle === muscle),
    }))
    const helpers = candidates.filter((exercise) => !selected.includes(exercise.mainMuscle))
    if (helpers.length) {
      blocks.push({
        key: '__helpers',
        title: 'Also helps',
        hint: `works a chosen muscle as a helper · ${helpers.length} movements`,
        rows: helpers,
      })
    }
    return blocks.filter((block) => block.rows.length)
  }, [searching, selected, candidates])

  /** How many rows of a block are revealed. */
  const limitOf = (key: string) => limits[key] ?? PAGE

  const revealMore = (key: string, total: number) =>
    setLimits((current) => ({ ...current, [key]: Math.min(total, (current[key] ?? PAGE) + PAGE * 2) }))

  /*
   * A broad muscle can match 90-odd exercises, and every row is a card with an
   * animation. Rendering all of them is a thousand extra nodes on a phone for a
   * list the user scrolls past anyway, so the first page shows and the rest is
   * one tap away. Nothing is hidden — the count is always stated.
   */
  const alsoFor = (exercise: Exercise) =>
    selected.filter((muscle) => muscle !== exercise.mainMuscle && targetsMuscle(exercise, muscle))

  const addExercise = (exercise: Exercise) =>
    setDraft((current) => ({
      ...current,
      items: [...current.items, makeWorkoutItem(exercise, current.items.length)],
    }))

  /*
   * One tap adds one copy, one tap removes one copy. Removing every copy at
   * once used to fight the duplicate button: duplicating a movement gave it
   * "Added ×2", and the next tap on that row deleted both.
   */
  const toggleExercise = (exercise: Exercise) =>
    setDraft((current) => {
      const at = current.items.findIndex((item) => item.exerciseId === exercise.id)
      if (at === -1) {
        return { ...current, items: [...current.items, makeWorkoutItem(exercise, current.items.length)] }
      }
      return { ...current, items: current.items.filter((_, index) => index !== at) }
    })

  const updateItem = (id: string, itemPatch: Partial<WorkoutItem>) =>
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...itemPatch } : item)),
    }))

  const duplicateItem = (index: number) =>
    setDraft((current) => {
      const next = [...current.items]
      next.splice(index + 1, 0, { ...next[index], id: makeItemId() })
      return { ...current, items: next }
    })

  const move = (index: number, direction: -1 | 1) =>
    setDraft((current) => ({ ...current, items: moveItem(current.items, index, index + direction) }))

  const totalSets = draft.items.reduce((sum, item) => sum + (item.sets || 0), 0)
  const totalTime = draft.items.reduce(
    (sum, item) => sum + (item.sets || 0) * (item.restSec || 0),
    0,
  )

  return (
    <div>
      <button
        type="button"
        onClick={onCancel}
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-mist-400 transition hover:text-mist-100"
      >
        <IconClose className="h-3.5 w-3.5" />
        {isNew ? 'My Workouts' : 'All workouts'}
      </button>

      <div className="mb-5">
        <h2 className="text-lg font-semibold text-mist-100">
          {isNew ? '🏗️ Create Workout' : '✏️ Edit workout'}
        </h2>
        <p className="mt-1 text-xs text-mist-400">
          {isNew
            ? 'Nothing is pre-set for you. Pick your muscle groups, choose the exercises, set the numbers, then save.'
            : 'Changes are only written when you press Save — nothing is stored until then.'}
        </p>
      </div>

      <div className="mb-5 rounded-2xl border border-ink-700 bg-ink-850/60 p-4">
        <div className="flex flex-wrap gap-2">
          <select
            value={draft.day ?? ''}
            onChange={(event) => patch({ day: event.target.value })}
            aria-label="Workout day"
            className="min-h-11 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100"
          >
            <option value="">No day</option>
            {DAYS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <input
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
            placeholder="Workout name (e.g. Push)"
            aria-label="Workout name"
            className="min-h-11 min-w-48 flex-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100 placeholder:text-ink-500 focus:border-brand-400/70 focus:outline-none"
          />
        </div>
        <p className="mt-2 text-[11px] text-mist-500">
          {draft.items.length} {draft.items.length === 1 ? 'exercise' : 'exercises'} ·{' '}
          {totalSets} working sets · ~{Math.round(totalTime / 60)} min with rest
        </p>
      </div>

      {chooserOpen && step === 'muscle' && (
        <section className="mb-5">
          <SectionHeading hint={isNew ? 'Step 1 of 2' : undefined}>
            {isNew ? '1 · Choose your muscle groups' : 'Add exercises — choose muscle groups'}
          </SectionHeading>
          <MuscleStep selected={selected} onToggle={toggleMuscle} />
          <MuscleSummary
            selected={selected}
            total={selected.length ? exercisesForMuscles(selected, primaryOnly).length : 0}
            onRemove={removeMuscle}
            onContinue={goToExercises}
          />
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={goToExercises}
              className="min-h-11 w-full rounded-xl border border-ink-600 py-2.5 text-xs font-medium text-mist-300 transition hover:border-brand-400/40 hover:text-brand-300"
            >
              Skip — search the whole library instead
            </button>
            {!isNew && (
              <button
                type="button"
                onClick={() => setChooserOpen(false)}
                className="min-h-11 w-full rounded-xl py-2.5 text-xs font-medium text-mist-400 transition hover:text-mist-100"
              >
                Cancel
              </button>
            )}
          </div>
        </section>
      )}

      {chooserOpen && step === 'exercises' && (
        <section className="mb-5">
          <SectionHeading hint={isNew ? 'Step 2 of 2' : undefined}>
            {isNew ? '2 · Choose your exercises' : 'Add exercises — choose which ones'}
          </SectionHeading>

          {/*
            This bar used to sit at `sticky top-1`, a fixed guess that ignored the
            desktop nav entirely — 41 of its 54 pixels ended up underneath it, so
            the "Done choosing" button was half covered and the count was
            unreadable. Offsetting by the measured nav height keeps the two
            sticky bars from fighting over the top of the viewport on any screen.
          */}
          <div
            style={{ top: 'calc(var(--app-nav-top-h, 0px) + 0.25rem)' }}
            className="sticky z-20 mb-3 flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/95 px-2.5 py-1 backdrop-blur"
          >
            <span className="tnum text-[11px] text-mist-300">
              {draft.items.length} selected
            </span>
            <button
              type="button"
              onClick={() => setChooserOpen(false)}
              className="ml-auto min-h-11 rounded-lg bg-ink-800 px-2.5 text-[11px] font-medium text-mist-100 transition hover:bg-ink-700"
            >
              Done choosing
            </button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            {selected.map((muscle) => (
              <span
                key={muscle}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-500/15 py-1 pr-1 pl-2.5 text-xs font-medium text-brand-300 ring-1 ring-brand-400/30"
              >
                {muscleLabel(muscle)}
                <button
                  type="button"
                  onClick={() => changeList(() => removeMuscle(muscle))}
                  aria-label={`Remove ${muscleLabel(muscle)} from this workout`}
                  className="relative grid size-6 place-items-center rounded text-brand-300/80 transition hover:text-brand-200 before:absolute before:-inset-2.5 before:content-['']"
                >
                  <IconClose className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setStep('muscle')}
              className="min-h-11 rounded-lg border border-ink-600 px-2.5 py-1 text-xs text-mist-300 transition hover:border-brand-400/50 hover:text-brand-300"
            >
              {selected.length ? 'Change muscles' : 'Pick muscle groups'}
            </button>
            {selected.length > 0 && (
              <div className="flex overflow-hidden rounded-lg border border-ink-600">
                <button
                  type="button"
                  onClick={() => changeList(() => setPrimaryOnly(false))}
                  aria-pressed={!primaryOnly}
                  className={`min-h-11 px-2.5 text-[11px] font-medium transition ${
                    primaryOnly ? 'text-mist-400' : 'bg-ink-800 text-mist-100'
                  }`}
                >
                  All {candidates.length}
                </button>
                <button
                  type="button"
                  onClick={() => changeList(() => setPrimaryOnly(true))}
                  aria-pressed={primaryOnly}
                  className={`min-h-11 px-2.5 text-[11px] font-medium transition ${
                    primaryOnly ? 'bg-ink-800 text-mist-100' : 'text-mist-400'
                  }`}
                >
                  Primary only{' '}
                  {selected.reduce((sum, muscle) => sum + muscleExerciseCount(muscle).primary, 0)}
                </button>
              </div>
            )}
            {!isNew && (
              <button
                type="button"
                onClick={() => setChooserOpen(false)}
                className="min-h-11 rounded-lg px-2.5 py-1 text-xs text-mist-400 transition hover:text-mist-100"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="relative mb-3">
            <IconSearch className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-mist-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => changeList(() => setQuery(event.target.value))}
              placeholder="Search all 131 exercises…"
              aria-label="Search exercises"
              className="min-h-11 w-full rounded-lg border border-ink-600 bg-ink-850 py-2 pr-3 pl-9 text-sm text-mist-100 placeholder:text-ink-500 focus:border-brand-400/70 focus:outline-none"
            />
          </div>

          {searching && (
            <p className="mb-2 text-[11px] text-mist-400">
              {selected.length
                ? 'Searching all 131 exercises, not just your muscles'
                : 'Searching all 131 exercises'} — {candidates.length} match
              {candidates.length === 1 ? '' : 'es'}.
            </p>
          )}

          {candidates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-850/40 px-6 py-10 text-center">
              <p className="text-sm text-mist-400">
                {searching
                  ? `Nothing matches “${query.trim()}”.`
                  : 'No exercises to show.'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {(groups ?? [
                {
                  key: '__all',
                  title: searching ? 'Search results' : 'Exercises',
                  hint: `${candidates.length} ${candidates.length === 1 ? 'movement' : 'movements'}`,
                  rows: candidates,
                },
              ]).map((group) => {
                const limit = limitOf(group.key)
                const rows = group.rows.slice(0, limit)
                const hidden = group.rows.length - rows.length
                return (
                  <div key={group.key}>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2">
                      <h4 className="text-xs font-semibold tracking-[0.12em] text-mist-200 uppercase">
                        {group.title}
                      </h4>
                      <span className="text-[11px] text-mist-400">{group.hint}</span>
                    </div>
                    <ul className="space-y-2.5">
                      {rows.map((exercise) => (
                        <ExerciseChoice
                          key={exercise.id}
                          exercise={exercise}
                          alsoTargets={alsoFor(exercise)}
                          count={counts.get(exercise.id) ?? 0}
                          onToggle={() => toggleExercise(exercise)}
                          onOpen={() => onOpenExercise(exercise)}
                        />
                      ))}
                    </ul>
                    {hidden > 0 && (
                      <button
                        type="button"
                        onClick={() => revealMore(group.key, group.rows.length)}
                        className="mt-3 min-h-11 w-full rounded-xl border border-ink-600 py-2.5 text-xs font-medium text-mist-300 transition hover:border-brand-400/50 hover:text-brand-300"
                      >
                        Show the other {hidden} in {group.title} ({group.rows.length} total)
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Configure and save ──────────────────────────────────────────── */}

      <section>
        <SectionHeading hint={`${draft.items.length} selected`}>
          {isNew ? '3 · Sets, reps, hold, rest, weight, notes' : 'Sets, reps, hold, rest, weight, notes'}
        </SectionHeading>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => startChoosing('muscle')}
            className="min-h-11 py-2"
          >
            <IconPlus /> Add exercises
          </Button>
          <Button
            variant="outline"
            onClick={() => setPickerOpen(true)}
            className="min-h-11 py-2"
          >
            <IconSearch /> Search all
          </Button>
        </div>

        {!draft.items.length ? (
          <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-850/40 px-6 py-12 text-center">
            <IconDumbbell className="mx-auto h-7 w-7 text-mist-400" />
            <h3 className="mt-3 text-sm font-semibold text-mist-100">No exercises yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-mist-400">
              Pick your muscle groups above and add the exercises you want. You control every set,
              rep, hold,
              rest and weight.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {draft.items.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                index={index}
                total={draft.items.length}
                onChange={(itemPatch) => updateItem(item.id, itemPatch)}
                onRemove={() =>
                  setDraft((current) => ({
                    ...current,
                    items: current.items.filter((entry) => entry.id !== item.id),
                  }))
                }
                onDuplicate={() => duplicateItem(index)}
                onMove={(direction) => move(index, direction)}
                onOpen={onOpenExercise}
              />
            ))}
          </ul>
        )}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[10px] font-medium tracking-wider text-mist-400 uppercase">
            Session notes
          </span>
          <textarea
            value={draft.notes ?? ''}
            onChange={(event) => patch({ notes: event.target.value })}
            rows={2}
            placeholder="Warm-up, intent, progression targets…"
            className="w-full resize-y rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-mist-100 placeholder:text-ink-500 focus:border-brand-400/70 focus:outline-none"
          />
        </label>

        {/*
          `bottom-20` was a guess at the nav's height. It was wrong the moment
          a phone with a home indicator added its inset, and the bar is z-30
          under a z-40 nav, so the Save button slid underneath the navigation
          and stopped being tappable. Offsetting by the measured nav height
          keeps the gap whatever the device.
        */}
        <div
          style={{ bottom: 'calc(var(--app-nav-bottom-h, 0px) + 0.75rem)' }}
          className="sticky z-30 -mx-4 mt-4 border-t border-ink-700 bg-ink-950/92 px-4 py-3 backdrop-blur"
        >
          <div className="flex items-center gap-2">
            {!isNew && onDuplicate && (
              <Button variant="outline" onClick={onDuplicate} className="min-h-11 shrink-0">
                <IconCopy /> Duplicate
              </Button>
            )}
            {!isNew && onDelete && (
              <Button variant="danger" onClick={onDelete} className="min-h-11 shrink-0">
                <IconTrash /> Delete
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => onSave({ ...draft, name: draft.name.trim() || suggestedName(draft) })}
              className="min-h-11 flex-1 py-2.5 text-sm"
            >
              <IconCheck /> {isNew ? 'Save workout' : 'Save changes'}
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-mist-500">
            {isNew
              ? 'Saved to My Workouts on this device.'
              : 'Updates this workout in place — it is never duplicated.'}
          </p>
        </div>
      </section>

      {pickerOpen && (
        <ExercisePicker
          savedIds={savedIds}
          presentIds={draft.items.map((item) => item.exerciseId)}
          onPick={addExercise}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * The distinct muscles a set of items is built around, in the same order the
 * picker lays its tiles out. Used to name a workout and to seed the muscle step
 * of an existing one, so both agree on what the session is.
 */
function musclesOf(items: WorkoutItem[]): Muscle[] {
  const seen = new Set(
    items
      .map((item) => getExercise(item.exerciseId)?.mainMuscle)
      .filter((muscle): muscle is Muscle => Boolean(muscle)),
  )
  return MUSCLE_ORDER.filter((muscle) => seen.has(muscle))
}

/** A name the user did not have to invent, built from what they picked. */
function suggestedName(draft: Workout): string {
  const muscles = musclesOf(draft.items)
  if (muscles.length === 0) return 'New workout'
  const labels = muscles.map(muscleLabel)
  if (labels.length === 1) return `${labels[0]} day`
  // A multi-muscle session is named for its parts, so the plan reads correctly
  // before anyone opens it: "Back + Biceps day".
  if (labels.length <= 3) return `${labels.join(' + ')} day`
  return `${labels.slice(0, 3).join(' + ')} +${labels.length - 3} day`
}
