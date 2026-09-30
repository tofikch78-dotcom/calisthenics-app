import { useState } from 'react'
import { MUSCLE_ACCENT, MUSCLES } from '../data'
import { formatDosage } from '../lib/search'
import type { Exercise } from '../types'
import { ExerciseAnimation } from './ExerciseAnimation'
import { equipmentLabel } from '../lib/labels'
import { DifficultyBadge, IconCheck, IconPlus } from './ui'

/** "Quadriceps, Glutes" — the secondary muscles, comma separated. */
function joinMuscles(muscles: Exercise['secondaryMuscles']): string {
  return muscles.map((muscle) => MUSCLES[muscle].label).join(', ')
}

export interface ExerciseCardProps {
  exercise: Exercise
  saved: boolean
  onToggleSave: (id: string) => void
  onOpen: (exercise: Exercise) => void
}

export function ExerciseCard({ exercise, saved, onToggleSave, onOpen }: ExerciseCardProps) {
  const primary = MUSCLES[exercise.mainMuscle]
  const accent = MUSCLE_ACCENT[exercise.mainMuscle]
  const secondary = exercise.secondaryMuscles.filter((muscle) => muscle !== exercise.mainMuscle)
  // Playback lives here so the pause control can be a sibling of the "open
  // details" button instead of a button nested inside a button.
  const [playing, setPlaying] = useState(true)
  const animated = (exercise.animation?.length ?? 0) > 1

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-850/80 card-sheen transition duration-200 hover:-translate-y-0.5 hover:border-ink-500 hover:shadow-xl hover:shadow-black/40 focus-within:border-brand-400/60">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${accent.bar}`} aria-hidden="true" />

      <div className="relative flex items-start gap-3 px-4 pt-4 text-left">
        <div className="relative size-[76px] shrink-0 rounded-xl border border-ink-700 bg-ink-900/70 p-1">
          <ExerciseAnimation
            poses={exercise.animation}
            label={`${exercise.name} animation`}
            duration={1200}
            playing={playing}
          />
          {animated && (
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              aria-label={
                playing ? `Pause the ${exercise.name} animation` : `Play the ${exercise.name} animation`
              }
              aria-pressed={playing}
              className="absolute right-0.5 bottom-0.5 z-10 grid size-4 place-items-center rounded-full border border-ink-600/80 bg-ink-900/85 text-[7px] leading-none text-mist-300 backdrop-blur transition hover:border-brand-400/60 hover:text-brand-300"
            >
              {playing ? '❚❚' : '▶'}
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] leading-tight font-semibold text-mist-100 group-hover:text-white">
            {exercise.name}
          </h3>

          {/* Primary muscle leads the card — this is what the exercise trains. */}
          <p className="mt-2 flex items-baseline gap-1.5 text-xs">
            <span className="shrink-0 text-[10px] tracking-wide text-mist-400 uppercase">Primary</span>
            <span className={`font-semibold ${accent.text}`}>{primary.label}</span>
          </p>

          {secondary.length > 0 && (
            <p className="mt-1 flex items-baseline gap-1.5 text-xs">
              <span className="shrink-0 text-[10px] tracking-wide text-mist-400 uppercase">
                Secondary
              </span>
              <span className="min-w-0 truncate text-mist-300">{joinMuscles(secondary)}</span>
            </p>
          )}
        </div>

        {/* Stretched hit area: opens the detail sheet from anywhere on the row. */}
        <button
          type="button"
          onClick={() => onOpen(exercise)}
          aria-label={`Open details for ${exercise.name}`}
          className="absolute inset-0 z-0 rounded-t-2xl"
        />
      </div>

      <div className="mt-3 flex flex-1 flex-col justify-end gap-2.5 px-4 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <DifficultyBadge level={exercise.difficulty} />
          <span className="inline-flex items-center gap-1 rounded-md border border-ink-600/70 bg-ink-800/60 px-2 py-0.5 text-[11px] text-mist-300">
            {exercise.equipment.map(equipmentLabel).join(' · ')}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-ink-700/80 pt-2.5">
          <span className="font-mono text-xs text-mist-300">{formatDosage(exercise.dosage)}</span>
          <button
            type="button"
            onClick={() => onToggleSave(exercise.id)}
            aria-pressed={saved}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              saved
                ? 'bg-lime-glow/15 text-lime-glow ring-1 ring-lime-glow/35 hover:bg-lime-glow/20'
                : 'border border-ink-600 text-mist-300 hover:border-brand-400/50 hover:text-brand-300'
            }`}
          >
            {saved ? <IconCheck className="h-3.5 w-3.5" /> : <IconPlus className="h-3.5 w-3.5" />}
            {saved ? 'In My Exercises' : 'Add to My Exercises'}
          </button>
        </div>
      </div>
    </article>
  )
}
