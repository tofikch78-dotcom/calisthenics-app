import { useState } from 'react'
import { getExercise } from '../data'
import { formatDosage, formatRest } from '../lib/search'
import { makeItemId, moveItem } from '../lib/store'
import type { Exercise, Workout, WorkoutItem } from '../types'
import { ExerciseAnimation } from './ExerciseAnimation'
import {
  Button,
  DifficultyBadge,
  IconClose,
  IconCopy,
  IconDumbbell,
  IconDown,
  IconPlus,
  IconTrash,
  IconUp,
  MusclePill,
} from './ui'

const numberField =
  'w-full rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-1.5 text-sm text-mist-100 focus:border-brand-400/70 focus:outline-none'

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
              className="absolute -right-1 -bottom-1 z-20 grid size-4 place-items-center rounded-full border border-ink-600 bg-ink-900 text-[7px] leading-none text-mist-300"
            >
              {playing ? '❚❚' : '▶'}
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

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
            <IconUp className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Move down" disabled={index === total - 1} onClick={() => onMove(1)}>
            <IconDown className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Duplicate exercise" onClick={onDuplicate}>
            <IconCopy className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Remove exercise" onClick={onRemove} tone="danger">
            <IconTrash className="h-3.5 w-3.5" />
          </IconButton>
        </div>
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
      className={`rounded-md p-1.5 transition disabled:opacity-25 ${
        tone === 'danger'
          ? 'text-mist-400 hover:bg-rose-500/12 hover:text-rose-300'
          : 'text-mist-400 hover:bg-ink-800 hover:text-mist-100'
      }`}
    >
      {children}
    </button>
  )
}

export interface WorkoutEditorProps {
  workout: Workout
  onChange: (patch: Partial<Workout>) => void
  onDelete: () => void
  onDuplicate: () => void
  onBack: () => void
  onAddExercise: () => void
  onOpenExercise: (exercise: Exercise) => void
}

export function WorkoutEditor({
  workout,
  onChange,
  onDelete,
  onDuplicate,
  onBack,
  onAddExercise,
  onOpenExercise,
}: WorkoutEditorProps) {
  const totalSets = workout.items.reduce((sum, item) => sum + (item.sets || 0), 0)
  const totalTime = workout.items.reduce(
    (sum, item) => sum + (item.sets || 0) * (item.restSec || 0),
    0,
  )

  const updateItem = (id: string, patch: Partial<WorkoutItem>) =>
    onChange({
      items: workout.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })

  const removeItem = (id: string) =>
    onChange({ items: workout.items.filter((item) => item.id !== id) })

  const duplicateItem = (index: number) => {
    const source = workout.items[index]
    const next = [...workout.items]
    next.splice(index + 1, 0, { ...source, id: makeItemId() })
    onChange({ items: next })
  }

  const move = (index: number, direction: -1 | 1) =>
    onChange({ items: moveItem(workout.items, index, index + direction) })

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-mist-400 transition hover:text-mist-100"
      >
        <IconClose className="h-3.5 w-3.5" />
        All workouts
      </button>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={workout.day ?? ''}
              onChange={(event) => onChange({ day: event.target.value })}
              placeholder="Day (e.g. Monday)"
              className="w-40 rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-1.5 text-sm text-mist-200 placeholder:text-ink-500 focus:border-brand-400/70 focus:outline-none"
            />
            <span className="text-mist-500">—</span>
            <input
              value={workout.name}
              onChange={(event) => onChange({ name: event.target.value })}
              placeholder="Workout name (e.g. Push)"
              className="min-w-48 flex-1 rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-1.5 text-sm font-semibold text-mist-100 placeholder:font-normal placeholder:text-ink-500 focus:border-brand-400/70 focus:outline-none"
            />
          </div>
          <p className="mt-2 text-xs text-mist-400">
            {workout.items.length} {workout.items.length === 1 ? 'exercise' : 'exercises'} ·{' '}
            {totalSets} working sets · ~{Math.round(totalTime / 60)} min with rest
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onDuplicate}>
            <IconCopy /> Duplicate
          </Button>
          <Button variant="danger" onClick={onDelete}>
            <IconTrash /> Delete
          </Button>
        </div>
      </div>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-[10px] font-medium tracking-wider text-mist-400 uppercase">
          Session notes
        </span>
        <textarea
          value={workout.notes ?? ''}
          onChange={(event) => onChange({ notes: event.target.value })}
          rows={2}
          placeholder="Warm-up, intent, progression targets…"
          className="w-full resize-y rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-mist-100 placeholder:text-ink-500 focus:border-brand-400/70 focus:outline-none"
        />
      </label>

      <ul className="space-y-3">
        {workout.items.map((item, index) => (
          <ItemRow
            key={item.id}
            item={item}
            index={index}
            total={workout.items.length}
            onChange={(patch) => updateItem(item.id, patch)}
            onRemove={() => removeItem(item.id)}
            onDuplicate={() => duplicateItem(index)}
            onMove={(direction) => move(index, direction)}
            onOpen={onOpenExercise}
          />
        ))}
      </ul>

      {!workout.items.length && (
        <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-850/40 px-6 py-12 text-center">
          <IconDumbbell className="mx-auto h-7 w-7 text-mist-400" />
          <h3 className="mt-3 text-sm font-semibold text-mist-100">This workout is empty</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-mist-400">
            Add exercises from My Exercises or search the full library. You control every set, rep,
            hold, rest and weight.
          </p>
        </div>
      )}

      <Button variant="primary" onClick={onAddExercise} className="mt-4 w-full py-2.5">
        <IconPlus /> Add exercise
      </Button>
    </div>
  )
}
