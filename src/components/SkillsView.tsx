import { useState } from 'react'
import { getExercise } from '../data'
import { SKILL_LADDERS, type SkillLadder } from '../data/skill-ladders'
import { Chip, Card, Pill, ProgressBar, Sheet } from './kit'
import type { Difficulty, Exercise, SkillProgress } from '../types'
import { DifficultyBadge, MusclePill } from './ui'

export interface SkillsViewProps {
  progress: SkillProgress[]
  onSetStage: (skillId: string, stageExerciseId: string) => void
  onOpenExercise: (exercise: Exercise) => void
  /** Opens one ladder straight away, e.g. when arriving from Home. */
  initialSkillId?: string | null
  /** Fired once the deep link has been honoured, so it only opens once. */
  onOpenConsumed?: () => void
}

const STAGE_HINT: Record<string, string> = {
  beginner: 'Entry point — build the shape and hold it for 20–30 seconds.',
  intermediate: 'Where most people plateau. Add reps or seconds before adding load.',
  advanced: 'The skill itself. Quality beats duration here.',
}

export function SkillsView({
  progress,
  onSetStage,
  onOpenExercise,
  initialSkillId,
  onOpenConsumed,
}: SkillsViewProps) {
  // A deep link is a one-shot request, so it is consumed on the way in rather
  // than re-applied on every render.
  const [deepLink, setDeepLink] = useState<string | null>(initialSkillId ?? null)
  const [manuallyOpened, setManuallyOpened] = useState<string | null>(null)

  const openId = manuallyOpened ?? deepLink
  const setOpenId = (next: string | null) => {
    setManuallyOpened(next)
    if (next) setDeepLink(null)
    onOpenConsumed?.()
  }

  /*
   * Only the entries a card can actually place. `SkillCard` finds the rung with
   * `ladder.stages.indexOf(currentStage)`, so a stage id this build's ladder no
   * longer lists renders as "Not started" — but counting it anyway made the
   * summary above read "1 of 8 skills started" over eight cards that all said
   * the same thing. Matching the count to what the cards show fixes the
   * contradiction and leaves the entry in storage for the user to re-mark.
   */
  const stageBySkill = new Map(
    progress
      .filter((entry) => {
        const ladder = SKILL_LADDERS.find((item) => item.id === entry.skillId)
        return Boolean(ladder && ladder.stages.includes(entry.stageExerciseId))
      })
      .map((entry) => [entry.skillId, entry.stageExerciseId]),
  )
  const active = SKILL_LADDERS.filter((ladder) => stageBySkill.has(ladder.id)).length
  const openLadder = openId ? SKILL_LADDERS.find((item) => item.id === openId) : undefined

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-semibold text-mist-100">Skills</h3>
        <p className="mt-1 text-xs text-mist-400">
          Eight calisthenics skills, each as an ordered ladder. Mark the rung you can currently hold and
          the app shows you what sits above it.
        </p>
        <div className="mt-3">
          <ProgressBar value={(active / SKILL_LADDERS.length) * 100} tone="ok" label="Skills in progress" />
          <p className="tnum mt-1.5 text-[11px] text-mist-400">
            {active} of {SKILL_LADDERS.length} skills started
          </p>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {SKILL_LADDERS.map((ladder) => (
          <SkillCard
            key={ladder.id}
            ladder={ladder}
            currentStage={stageBySkill.get(ladder.id)}
            onOpen={() => setOpenId(ladder.id)}
          />
        ))}
      </div>

      {/*
        Resolved from the id rather than asserted non-null: `openId` can arrive
        as a deep link from a suggestion, and a ladder that has been renamed or
        retired since then has no entry to find. Nothing renders rather than
        the whole tab going down over it.
      */}
      {openLadder && (
        <SkillSheet
          ladder={openLadder}
          currentStage={stageBySkill.get(openId!)}
          onSetStage={(stage) => onSetStage(openId!, stage)}
          onOpenExercise={onOpenExercise}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

function SkillCard({
  ladder,
  currentStage,
  onOpen,
}: {
  ladder: SkillLadder
  currentStage?: string
  onOpen: () => void
}) {
  const index = currentStage ? ladder.stages.indexOf(currentStage) : -1
  const stage = currentStage ? getExercise(currentStage) : undefined
  const next = index >= 0 && index < ladder.stages.length - 1 ? getExercise(ladder.stages[index + 1]) : undefined

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col rounded-2xl border border-ink-700 bg-ink-850/60 p-4 text-left transition hover:border-brand-400/35"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-mist-100">{ladder.name}</h4>
        {index >= 0 ? (
          <Pill className="bg-brand-400/15 text-brand-300 ring-brand-400/30">
            Stage {index + 1}/{ladder.stages.length}
          </Pill>
        ) : (
          <Pill className="bg-ink-800 text-mist-400 ring-ink-600">Not started</Pill>
        )}
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-mist-400">{ladder.goal}</p>

      <div className="mt-3 flex items-center gap-1 overflow-hidden">
        {ladder.stages.map((stageId, position) => (
          <div key={stageId} className="flex min-w-0 flex-1 items-center gap-1">
            <span
              className={`h-1.5 flex-1 rounded-full ${
                position <= index ? 'bg-lime-glow' : 'bg-ink-600'
              }`}
            />
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-[11px] text-mist-400">
        {stage ? (
          <>
            Current: <span className="text-mist-200">{stage.name}</span>
            {next ? (
              <>
                {' '}→ next <span className="text-mist-200">{next.name}</span>
              </>
            ) : (
              <> — top of the ladder</>
            )}
          </>
        ) : (
          `Start at ${getExercise(ladder.stages[0])?.name ?? ladder.stages[0]}`
        )}
      </p>
    </button>
  )
}

function SkillSheet({
  ladder,
  currentStage,
  onSetStage,
  onOpenExercise,
  onClose,
}: {
  ladder: SkillLadder
  currentStage?: string
  onSetStage: (stageExerciseId: string) => void
  onOpenExercise: (exercise: Exercise) => void
  onClose: () => void
}) {
  const index = currentStage ? ladder.stages.indexOf(currentStage) : -1

  return (
    <Sheet title={`${ladder.name} progression`} onClose={onClose} wide>
      <p className="text-sm text-mist-300">{ladder.goal}</p>

      <div className="mt-3 rounded-xl border border-brand-400/25 bg-brand-500/8 p-3">
        <p className="text-[10px] tracking-wide text-brand-300 uppercase">Key cue</p>
        <p className="mt-1 text-xs leading-relaxed text-mist-200">{ladder.cue}</p>
      </div>

      <ol className="mt-4 space-y-2">
        {ladder.stages.map((stageId, position) => {
          const exercise = getExercise(stageId)
          if (!exercise) return null
          const isCurrent = stageId === currentStage
          const reached = index >= 0 && position < index
          return (
            <li key={stageId}>
              <div
                className={`rounded-xl border p-3 transition ${
                  isCurrent
                    ? 'border-lime-glow/35 bg-lime-glow/8'
                    : reached
                      ? 'border-ink-700 bg-ink-900/60'
                      : 'border-ink-700/70 bg-ink-900/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${
                      isCurrent
                        ? 'bg-lime-glow/20 text-lime-glow'
                        : reached
                          ? 'bg-ink-700 text-mist-400'
                          : 'bg-ink-800 text-mist-500'
                    }`}
                  >
                    {reached ? '✓' : position + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-mist-100">{exercise.name}</span>
                      <MusclePill muscle={exercise.mainMuscle} />
                      <DifficultyBadge level={exercise.difficulty as Difficulty} />
                      {isCurrent && (
                        <Pill className="bg-lime-glow/15 text-lime-glow ring-lime-glow/30">Current stage</Pill>
                      )}
                    </div>
                    <p className="tnum mt-1 text-[11px] text-mist-400">
                      {exercise.dosage.sets} ×{' '}
                      {exercise.dosage.holdSec ? `${exercise.dosage.holdSec}s` : `${exercise.dosage.reps} reps`} ·{' '}
                      {exercise.equipment.map((item) => item).join(', ')}
                    </p>
                    <p className="mt-1 text-[11px] text-mist-500">{STAGE_HINT[exercise.difficulty]}</p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1">
                    <Chip pressed={isCurrent} onClick={() => onSetStage(stageId)}>
                      {isCurrent ? 'Current' : 'Set'}
                    </Chip>
                    <button
                      type="button"
                      onClick={() => onOpenExercise(exercise)}
                      className="rounded-lg px-2 py-1 text-[11px] text-mist-400 transition hover:text-brand-300"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </Sheet>
  )
}
