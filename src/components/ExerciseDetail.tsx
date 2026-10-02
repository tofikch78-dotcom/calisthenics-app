import { useEffect, useRef } from 'react'
import { DIFFICULTIES, MOVEMENTS, MUSCLES, getExercise } from '../data'
import { equipmentLabel } from '../lib/labels'
import { findAlternatives, formatDosage, formatRest } from '../lib/search'
import type { Exercise } from '../types'
import { ExerciseAnimation } from './ExerciseAnimation'
import {
  Button,
  DifficultyBadge,
  IconCheck,
  IconClose,
  IconDumbbell,
  IconPlus,
  IconSwap,
  MusclePill,
} from './ui'

/** Resolves a progression id to a clickable name, falling back to the raw id. */
function ProgressionList({
  ids,
  empty,
  onOpen,
}: {
  ids: string[]
  empty: string
  onOpen: (next: Exercise) => void
}) {
  if (!ids.length) return <p className="text-sm text-mist-400">{empty}</p>
  return (
    <ul className="space-y-1.5">
      {ids.map((id) => {
        const target = getExercise(id)
        return (
          <li key={id}>
            <button
              type="button"
              disabled={!target}
              onClick={() => target && onOpen(target)}
              className="-my-1 min-h-11 py-1 text-left text-sm text-mist-200 transition hover:text-white disabled:cursor-default disabled:hover:text-mist-200"
            >
              • {target?.name ?? id.replace(/-/g, ' ')}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-700/70 py-2 last:border-0">
      <dt className="shrink-0 text-xs tracking-wide text-mist-400 uppercase">{label}</dt>
      <dd className="text-right text-sm text-mist-100">{value}</dd>
    </div>
  )
}

function ListBlock({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'do' | 'dont'
}) {
  if (!items.length) return null
  return (
    <div>
      <h4
        className={`mb-2 text-xs font-semibold tracking-[0.14em] uppercase ${
          tone === 'do' ? 'text-lime-glow' : 'text-rose-glow'
        }`}
      >
        {title}
      </h4>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-mist-200">
            <span
              aria-hidden="true"
              className={`mt-[7px] size-1.5 shrink-0 rounded-full ${
                tone === 'do' ? 'bg-lime-glow' : 'bg-rose-glow'
              }`}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Alternatives({
  exercise,
  onOpen,
}: {
  exercise: Exercise
  onOpen: (next: Exercise) => void
}) {
  const { ladder, equipmentSwaps, similar } = findAlternatives(exercise)

  return (
    <div className="space-y-4">
      {ladder.length > 1 && (
        <div>
          <h4 className="mb-2.5 text-xs font-semibold tracking-[0.14em] text-mist-400 uppercase">
            Progression ladder
          </h4>
          <ol className="flex flex-wrap items-center gap-1.5">
            {ladder.map((item, index) => {
              const isCurrent = item.id === exercise.id
              return (
                <li key={item.id} className="flex items-center gap-1.5">
                  {index > 0 && (
                    <span aria-hidden="true" className="text-ink-500">
                      →
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={`min-h-11 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      isCurrent
                        ? 'bg-brand-500 text-white'
                        : 'border border-ink-600 text-mist-300 hover:border-brand-400/60 hover:text-white'
                    }`}
                  >
                    {item.name}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {equipmentSwaps.length > 0 && (
        <div>
          <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-mist-400 uppercase">
            <IconSwap className="h-3.5 w-3.5" />
            Swap for different equipment
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {equipmentSwaps.slice(0, 6).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(item)}
                className="group/sw flex items-center justify-between gap-2 rounded-xl border border-ink-700 bg-ink-850/60 px-3 py-2 text-left transition hover:border-brand-400/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-mist-100 group-hover/sw:text-white">
                    {item.name}
                  </span>
                  <span className="block truncate text-[11px] text-mist-400">
                    {item.equipment.map(equipmentLabel).join(' · ')}
                  </span>
                </span>
                <DifficultyBadge level={item.difficulty} />
              </button>
            ))}
          </div>
        </div>
      )}

      {similar.length > 0 && (
        <div>
          <h4 className="mb-2.5 text-xs font-semibold tracking-[0.14em] text-mist-400 uppercase">
            Similar {MOVEMENTS[exercise.movement].label.toLowerCase()} exercises
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {similar.slice(0, 10).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(item)}
                className="min-h-11 rounded-lg border border-ink-700 px-2.5 py-1 text-xs text-mist-300 transition hover:border-brand-400/50 hover:text-white"
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {ladder.length <= 1 && !equipmentSwaps.length && !similar.length && (
        <p className="text-sm text-mist-400">No alternatives recorded for this movement yet.</p>
      )}
    </div>
  )
}

export interface ExerciseDetailProps {
  exercise: Exercise
  saved: boolean
  onToggleSave: (id: string) => void
  onClose: () => void
  /** Jumps straight into the workout builder with this exercise. */
  onQuickAdd?: (exercise: Exercise) => void
  /** Navigates to another exercise, e.g. from the alternatives ladder. */
  onOpen: (exercise: Exercise) => void
}

export function ExerciseDetail({
  exercise,
  saved,
  onToggleSave,
  onClose,
  onQuickAdd,
  onOpen,
}: ExerciseDetailProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const secondary = exercise.secondaryMuscles.filter((muscle) => muscle !== exercise.mainMuscle)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={exercise.name}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="animate-rise flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-ink-600 bg-ink-900 shadow-2xl sm:rounded-3xl">
        <header className="flex items-start gap-3 border-b border-ink-700 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <MusclePill muscle={exercise.mainMuscle} />
              <DifficultyBadge level={exercise.difficulty} size="md" />
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">{exercise.name}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-11 shrink-0 place-items-center rounded-lg text-mist-400 transition hover:bg-ink-800 hover:text-white"
          >
            <IconClose />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto scrollbar-slim lg:grid-cols-[300px_1fr]">
          {/* Left: illustration + facts */}
          <div className="border-b border-ink-700 p-5 lg:border-r lg:border-b-0">
            <div className="relative aspect-square rounded-2xl border border-ink-700 bg-ink-950/60 p-2">
              <ExerciseAnimation
                poses={exercise.animation}
                duration={1300}
                label={`${exercise.name} movement animation`}
              />
            </div>
            <p className="mt-2 text-center text-[11px] text-mist-400">
              Simple illustration — not a substitute for a coach.
            </p>

            <dl className="mt-5">
              <Row label="Primary muscle" value={MUSCLES[exercise.mainMuscle].label} />
              {secondary.length > 0 && (
                <Row label="Secondary muscles" value={secondary.map((m) => MUSCLES[m].label).join(', ')} />
              )}
              <Row label="Difficulty" value={DIFFICULTIES[exercise.difficulty].label} />
              <Row label="Equipment" value={exercise.equipment.map(equipmentLabel).join(', ')} />
              <Row label="Recommended" value={`${formatDosage(exercise.dosage)} · rest ${formatRest(exercise.dosage.restSec)}`} />
            </dl>

            {exercise.dosage.note && (
              <p className="mt-2 rounded-lg border border-brand-400/20 bg-brand-500/8 px-3 py-2 text-xs text-brand-300">
                {exercise.dosage.note}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant={saved ? 'outline' : 'primary'}
                onClick={() => onToggleSave(exercise.id)}
                className={saved ? 'min-h-11 border-lime-glow/40 text-lime-glow' : 'min-h-11'}
              >
                {saved ? <IconCheck /> : <IconPlus />}
                {saved ? 'Remove from My Exercises' : 'Add to My Exercises'}
              </Button>
              {onQuickAdd && (
                <Button variant="outline" onClick={() => onQuickAdd(exercise)} className="min-h-11">
                  <IconDumbbell />
                  Add to a workout
                </Button>
              )}
            </div>
          </div>

          {/* Right: the coaching content */}
          <div className="space-y-6 p-5">
            <p className="text-sm leading-relaxed text-mist-200">{exercise.description}</p>

            <div>
              <h4 className="mb-3 text-xs font-semibold tracking-[0.14em] text-mist-400 uppercase">
                How to perform it
              </h4>
              <ol className="space-y-3">
                {exercise.steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-500/15 text-[11px] font-semibold text-brand-300">
                      {index + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-mist-200">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <ListBlock title="Common mistakes" items={exercise.mistakes} tone="dont" />

            <div className="grid gap-5 border-t border-ink-700 pt-5 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold tracking-[0.14em] text-lime-glow uppercase">
                  Easier progressions
                </h4>
                <ProgressionList
                  ids={exercise.easier}
                  empty="This is the easiest starting point."
                  onOpen={onOpen}
                />
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold tracking-[0.14em] text-rose-glow uppercase">
                  Harder progressions
                </h4>
                <ProgressionList
                  ids={exercise.harder}
                  empty="This is as hard as it gets."
                  onOpen={onOpen}
                />
              </div>
            </div>

            <div className="border-t border-ink-700 pt-5">
              <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-mist-400 uppercase">
                <IconSwap className="h-3.5 w-3.5" />
                Find alternatives
              </h4>
              <Alternatives exercise={exercise} onOpen={onOpen} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
