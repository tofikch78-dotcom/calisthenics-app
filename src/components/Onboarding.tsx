import { useMemo, useState } from 'react'
import { EQUIPMENT, EQUIPMENT_ORDER, getExercise } from '../data'
import { DAY_NAMES, DAY_SHORT } from '../lib/dates'
import { DIET_LABEL, autoTargets, goalLabel } from '../lib/nutrition'
import { assessLevels, mergeLevels } from '../lib/level'
import { DEFAULT_PROFILE } from '../lib/store'
import type { Difficulty, Equipment, Goal, Profile, PullUpAbility, Sex, TrainingLevel } from '../types'
import { Card, Chip, NumberField, ProgressBar, Segmented, SelectField, TextField, TextArea } from './kit'
import { DifficultyBadge, MusclePill } from './ui'

const GOALS: Goal[] = ['gain-muscle', 'gain-weight', 'maintain', 'lose-weight', 'strength', 'skills']
const SEXES: { id: Sex; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'other', label: 'Other' },
  { id: 'undisclosed', label: 'Prefer not to say' },
]
const LEVELS: { id: TrainingLevel; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
]
const PULLUP_ABILITIES: { id: PullUpAbility; label: string }[] = [
  { id: 'none', label: 'None yet' },
  { id: 'assisted', label: 'Band / assisted' },
  { id: 'single', label: 'One clean rep' },
  { id: 'multiple', label: 'Several in a row' },
]

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'personal', title: 'You' },
  { id: 'goals', title: 'Goals' },
  { id: 'training', title: 'Training' },
  { id: 'equipment', title: 'Equipment' },
  { id: 'schedule', title: 'Schedule' },
  { id: 'nutrition', title: 'Nutrition' },
  { id: 'review', title: 'Review' },
] as const

type StepId = (typeof STEPS)[number]['id']

export interface OnboardingProps {
  /** Null on first run, the saved profile when the user edits it later. */
  initial: Profile | null
  onComplete: (profile: Profile) => void
  onCancel?: () => void
  title?: string
  subtitle?: string
}

export function Onboarding({ initial, onComplete, onCancel, title, subtitle }: OnboardingProps) {
  const [step, setStep] = useState<StepId>('welcome')
  const [draft, setDraft] = useState<Profile>(initial ?? DEFAULT_PROFILE)

  const patch = (next: Partial<Profile>) => setDraft((current) => ({ ...current, ...next }))

  const index = STEPS.findIndex((entry) => entry.id === step)
  const isEditing = Boolean(initial)
  const stepTitle = title ?? (isEditing ? 'Edit your profile' : 'Set up your profile')
  const stepSubtitle =
    subtitle ??
    (isEditing
      ? 'Change anything you like — the app recalculates from these answers.'
      : 'A few questions so the app can size exercises, food and training to you. Nothing is hard-coded.')

  const targets = useMemo(() => autoTargets(draft), [draft])

  // Every toggle derives from the *previous* state rather than the render
  // snapshot, so rapid clicks cannot clobber one another.
  const toggleGoal = (goal: Goal) =>
    setDraft((current) => ({
      ...current,
      goals: current.goals.includes(goal)
        ? current.goals.filter((g) => g !== goal)
        : [...current.goals, goal],
    }))

  const toggleEquipment = (item: Equipment) =>
    setDraft((current) => {
      const has = current.equipment.includes(item)
      // "No equipment" is mutually exclusive with owning kit.
      if (item === 'none') return { ...current, equipment: has ? [] : ['none'] }
      const owned = has
        ? current.equipment.filter((e) => e !== item)
        : [...current.equipment.filter((e) => e !== 'none'), item]
      return { ...current, equipment: owned.length ? owned : ['none'] }
    })

  const toggleDay = (day: string) =>
    setDraft((current) => {
      const next = current.preferredDays.includes(day)
        ? current.preferredDays.filter((d) => d !== day)
        : [...current.preferredDays, day]
      return { ...current, preferredDays: next, daysPerWeek: Math.max(1, next.length) }
    })

  const canContinue = () => {
    if (step === 'personal') return Boolean(draft.age && draft.heightCm && draft.weightKg)
    return true
  }

  const next = () => {
    const following = STEPS[index + 1]
    if (following) setStep(following.id)
    else onComplete({ ...draft, onboarded: true, onboardedAt: initial?.onboardedAt ?? Date.now() })
  }

  const back = () => {
    const previous = STEPS[index - 1]
    if (previous) setStep(previous.id)
  }

  const assessment = useMemo(() => mergeLevels(assessLevels(draft).levels, {}), [draft])

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">{stepTitle}</h2>
            <p className="mt-1 text-xs text-mist-400">{stepSubtitle}</p>
          </div>
          {onCancel && (
            <button type="button" onClick={onCancel} className="shrink-0 text-xs text-mist-400 hover:text-mist-100">
              Cancel
            </button>
          )}
        </div>
        <div className="mt-4">
          <ProgressBar
            value={((index + 1) / STEPS.length) * 100}
            label={`Step ${index + 1} of ${STEPS.length}`}
          />
          <ol className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-mist-500">
            {STEPS.map((entry, position) => (
              <li key={entry.id} className={position <= index ? 'text-brand-300' : undefined}>
                {entry.title}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <Card className="animate-rise min-h-[19rem]" key={step}>
        {step === 'welcome' && (
          <div>
            <h3 className="text-base font-semibold text-mist-100">Let&apos;s get to know you</h3>
            <p className="mt-2 text-sm leading-relaxed text-mist-300">
              You&apos;ll answer three kinds of question: who you are, what you&apos;re training for, and what
              equipment you actually have. That is enough for the app to estimate a level for every exercise
              in the library, size a weekly plan, and set nutrition targets you can edit.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-mist-300">
              {[
                'Everything is stored on this device only — no account, no server.',
                'Every estimate is shown with its reasoning, and you can override it.',
                'You can edit all of this later from Profile.',
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-lime-glow" aria-hidden="true">
                    ✓
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 'personal' && (
          <div className="space-y-4">
            <TextField
              label="Name"
              hint="optional"
              value={draft.name ?? ''}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="What should the app call you?"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Age"
                suffix="yrs"
                min={12}
                max={100}
                value={draft.age ?? ''}
                onChange={(event) => patch({ age: event.target.value === '' ? undefined : Number(event.target.value) })}
              />
              <SelectField label="Sex" value={draft.sex} onChange={(event) => patch({ sex: event.target.value as Sex })}>
                {SEXES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <NumberField
                label="Height"
                suffix="cm"
                min={120}
                max={230}
                value={draft.heightCm ?? ''}
                onChange={(event) =>
                  patch({ heightCm: event.target.value === '' ? undefined : Number(event.target.value) })
                }
              />
              <NumberField
                label="Weight"
                suffix="kg"
                min={25}
                max={250}
                step={0.1}
                value={draft.weightKg ?? ''}
                onChange={(event) =>
                  patch({ weightKg: event.target.value === '' ? undefined : Number(event.target.value) })
                }
              />
            </div>
            <p className="text-[11px] text-mist-500">
              These numbers only feed the calorie estimate and the progress chart. You can leave them blank
              and fill them in later.
            </p>
          </div>
        )}

        {step === 'goals' && (
          <div>
            <h3 className="text-sm font-semibold text-mist-100">What are you training for?</h3>
            <p className="mt-1 text-xs text-mist-400">Pick everything that applies — it changes your food targets.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {GOALS.map((goal) => (
                <Chip key={goal} pressed={draft.goals.includes(goal)} onClick={() => toggleGoal(goal)}>
                  {goalLabel(goal)}
                </Chip>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-ink-700 bg-ink-900/60 p-3">
              <p className="text-[10px] tracking-wide text-mist-400 uppercase">Dietary preference</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(DIET_LABEL) as Profile['diet'][]).map((diet) => (
                  <Chip key={diet} pressed={draft.diet === diet} onClick={() => patch({ diet })}>
                    {DIET_LABEL[diet]}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'training' && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[10px] tracking-wide text-mist-400 uppercase">Training level</p>
              <Segmented options={LEVELS} value={draft.level} onChange={(level) => patch({ level })} ariaLabel="Training level" />
            </div>

            <p className="text-[10px] tracking-wide text-mist-400 uppercase">Your current maximums</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Max push-ups"
                suffix="reps"
                min={0}
                value={draft.maxPushups ?? ''}
                onChange={(event) =>
                  patch({ maxPushups: event.target.value === '' ? undefined : Number(event.target.value) })
                }
                placeholder="0"
              />
              <NumberField
                label="Max dips"
                suffix="reps"
                min={0}
                value={draft.maxDips ?? ''}
                onChange={(event) =>
                  patch({ maxDips: event.target.value === '' ? undefined : Number(event.target.value) })
                }
                placeholder="0"
              />
              <NumberField
                label="Max bodyweight squats"
                suffix="reps"
                min={0}
                value={draft.maxSquats ?? ''}
                onChange={(event) =>
                  patch({ maxSquats: event.target.value === '' ? undefined : Number(event.target.value) })
                }
                placeholder="0"
              />
              <NumberField
                label="Max pull-ups"
                suffix="reps"
                min={0}
                value={draft.maxPullups ?? ''}
                onChange={(event) =>
                  patch({ maxPullups: event.target.value === '' ? undefined : Number(event.target.value) })
                }
                placeholder="0"
              />
            </div>

            <div>
              <p className="mb-2 text-[10px] tracking-wide text-mist-400 uppercase">Pull-up ability</p>
              <div className="flex flex-wrap gap-2">
                {PULLUP_ABILITIES.map((option) => (
                  <Chip
                    key={option.id}
                    pressed={draft.pullUpAbility === option.id}
                    onClick={() => patch({ pullUpAbility: option.id })}
                  >
                    {option.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'equipment' && (
          <div>
            <h3 className="text-sm font-semibold text-mist-100">What do you train with?</h3>
            <p className="mt-1 text-xs text-mist-400">
              Selected kit becomes a suggested filter in the exercise library.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {EQUIPMENT_ORDER.map((item) => (
                <Chip
                  key={item}
                  pressed={draft.equipment.includes(item)}
                  onClick={() => toggleEquipment(item)}
                  title={EQUIPMENT[item].hint}
                >
                  {EQUIPMENT[item].label}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {step === 'schedule' && (
          <div className="space-y-4">
            <NumberField
              label="Training days per week"
              suffix="days"
              min={1}
              max={7}
              value={draft.daysPerWeek}
              onChange={(event) => patch({ daysPerWeek: Math.max(1, Math.min(7, Number(event.target.value) || 1)) })}
            />
            <div>
              <p className="mb-2 text-[10px] tracking-wide text-mist-400 uppercase">Preferred days</p>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_NAMES.map((day, dayIndex) => (
                  <Chip
                    key={day}
                    pressed={draft.preferredDays.includes(day)}
                    onClick={() => toggleDay(day)}
                    className="px-1 text-center"
                  >
                    {DAY_SHORT[dayIndex]}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-mist-500">
                Rest days never break your streak — they just do not count towards it.
              </p>
            </div>
            <NumberField
              label="Workout duration"
              suffix="min"
              min={10}
              max={180}
              step={5}
              value={draft.sessionMinutes}
              onChange={(event) => patch({ sessionMinutes: Number(event.target.value) || 45 })}
            />
          </div>
        )}

        {step === 'nutrition' && (
          <div className="space-y-4">
            <NumberField
              label="Meals per day"
              suffix="meals"
              min={1}
              max={7}
              value={draft.mealsPerDay}
              onChange={(event) => patch({ mealsPerDay: Math.max(1, Math.min(7, Number(event.target.value) || 3)) })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextArea
                label="Foods you like"
                hint="optional"
                rows={2}
                value={draft.likedFoods}
                onChange={(event) => patch({ likedFoods: event.target.value })}
                placeholder="Chicken, rice, oats…"
              />
              <TextArea
                label="Foods you avoid"
                hint="optional"
                rows={2}
                value={draft.dislikedFoods}
                onChange={(event) => patch({ dislikedFoods: event.target.value })}
                placeholder="Mushrooms, olives…"
              />
            </div>
            <TextField
              label="Allergies or intolerances"
              hint="optional"
              value={draft.allergies}
              onChange={(event) => patch({ allergies: event.target.value })}
              placeholder="Gluten, lactose, nuts…"
            />
            <NumberField
              label="Weekly food budget"
              hint="optional"
              min={0}
              step={5}
              value={draft.foodBudget ?? ''}
              onChange={(event) =>
                patch({ foodBudget: event.target.value === '' ? undefined : Number(event.target.value) })
              }
              placeholder="—"
            />

            <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-3">
              <p className="text-[10px] tracking-wide text-mist-400 uppercase">Starting targets</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Calories', `${targets.kcal} kcal`],
                  ['Protein', `${targets.protein} g`],
                  ['Carbs', `${targets.carbs} g`],
                  ['Fat', `${targets.fat} g`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="tnum text-sm font-semibold text-mist-100">{value}</div>
                    <div className="text-[10px] text-mist-400">{label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-mist-500">
                A rough estimate from your height, weight and goal — not medical advice. You can change every
                number on the Nutrition tab.
              </p>
            </div>
          </div>
        )}

        {step === 'review' && <ReviewStep draft={draft} targets={targets} assessment={assessment} />}
      </Card>

      <div className="mt-5 flex items-center gap-2">
        {index > 0 && (
          <button
            type="button"
            onClick={back}
            className="rounded-lg border border-ink-600 px-4 py-2.5 text-sm font-medium text-mist-200 transition hover:border-ink-500"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={!canContinue()}
          className="flex-1 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-ink-500"
        >
          {index === STEPS.length - 1 ? 'Save profile' : 'Continue'}
        </button>
      </div>
      {!canContinue() && (
        <p className="mt-2 text-center text-[11px] text-amber-glow">
          Age, height and weight are needed to continue. Everything else is optional.
        </p>
      )}
    </div>
  )
}

/** A read-back of the answers plus the level the app derived from them. */
function ReviewStep({
  draft,
  targets,
  assessment,
}: {
  draft: Profile
  targets: { kcal: number; protein: number; carbs: number; fat: number; waterMl: number }
  assessment: Record<string, Difficulty>
}) {
  const samples = ['push-ups', 'dips', 'pull-ups', 'bodyweight-squats', 'plank', 'l-sit']
  const total = Object.keys(assessment).length
  const beginner = Object.values(assessment).filter((level) => level === 'beginner').length
  const intermediate = Object.values(assessment).filter((level) => level === 'intermediate').length
  const advanced = Object.values(assessment).filter((level) => level === 'advanced').length

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-mist-100">Here&apos;s what you told us</h3>
        <dl className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {[
            ['Name', draft.name || '—'],
            ['Age', draft.age ? `${draft.age}` : '—'],
            ['Sex', SEXES.find((s) => s.id === draft.sex)?.label ?? '—'],
            ['Height', draft.heightCm ? `${draft.heightCm} cm` : '—'],
            ['Weight', draft.weightKg ? `${draft.weightKg} kg` : '—'],
            ['Level', LEVELS.find((l) => l.id === draft.level)?.label ?? draft.level],
            ['Max push-ups', draft.maxPushups ?? '—'],
            ['Max dips', draft.maxDips ?? '—'],
            ['Max squats', draft.maxSquats ?? '—'],
            ['Max pull-ups', draft.maxPullups ?? '—'],
            ['Equipment', draft.equipment.map((e) => EQUIPMENT[e].label).join(', ') || '—'],
            ['Days per week', `${draft.daysPerWeek}`],
            ['Preferred days', draft.preferredDays.join(', ') || '—'],
            ['Session length', `${draft.sessionMinutes} min`],
            ['Meals per day', `${draft.mealsPerDay}`],
            ['Diet', DIET_LABEL[draft.diet]],
            [
              'Goals',
              draft.goals.length ? draft.goals.map(goalLabel).join(', ') : '—',
            ],
            [
              'Avoids',
              [draft.allergies, draft.dislikedFoods].filter(Boolean).join(' · ') || '—',
            ],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 border-b border-ink-700/60 py-1">
              <dt className="text-[11px] text-mist-400">{label}</dt>
              <dd className="text-right text-xs text-mist-100">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-xl border border-brand-400/25 bg-brand-500/8 p-3">
        <p className="text-[10px] tracking-wide text-brand-300 uppercase">Automatic level assessment</p>
        <p className="tnum mt-1 text-xs text-mist-200">
          {total} exercises · 🟢 {beginner} · 🟡 {intermediate} · 🔴 {advanced}
        </p>
        <div className="mt-2 space-y-1.5">
          {samples.map((id) => {
            const exercise = getExercise(id)
            const level = assessment[id]
            if (!exercise || !level) return null
            return (
              <div key={id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <MusclePill muscle={exercise.mainMuscle} />
                  <span className="truncate text-[11px] text-mist-200">{exercise.name}</span>
                </span>
                <DifficultyBadge level={level} />
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[10px] text-mist-500">
          Start point estimated from your answers. Any exercise can be re-levelled by hand later.
        </p>
      </div>

      <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-3">
        <p className="text-[10px] tracking-wide text-mist-400 uppercase">Nutrition starting point</p>
        <p className="tnum mt-1 text-xs text-mist-200">
          {targets.kcal} kcal · {targets.protein} g protein · {targets.carbs} g carbs · {targets.fat} g fat ·{' '}
          {(targets.waterMl / 1000).toFixed(1)} L water
        </p>
      </div>
    </div>
  )
}
