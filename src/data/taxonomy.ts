import type { Difficulty, Equipment, Movement, Muscle } from '../types'

export interface TaxonomyEntry {
  label: string
  /** Short hint shown on filter chips. */
  hint?: string
}

export const MUSCLE_ORDER: Muscle[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
  'full-body',
]

export const MUSCLES: Record<Muscle, TaxonomyEntry> = {
  chest: { label: 'Chest', hint: 'Pectoralis major & minor' },
  back: { label: 'Back', hint: 'Lats, rhomboids, traps' },
  shoulders: { label: 'Shoulders', hint: 'Deltoids' },
  biceps: { label: 'Biceps', hint: 'Elbow flexors' },
  triceps: { label: 'Triceps', hint: 'Elbow extensors' },
  forearms: { label: 'Forearms', hint: 'Grip & wrist' },
  core: { label: 'Abs / Core', hint: 'Trunk stability' },
  glutes: { label: 'Glutes', hint: 'Gluteus maximus' },
  quads: { label: 'Quadriceps', hint: 'Knee extensors' },
  hamstrings: { label: 'Hamstrings', hint: 'Knee flexors' },
  calves: { label: 'Calves', hint: 'Calf raise complex' },
  'full-body': { label: 'Full Body', hint: 'Multiple muscles' },
}

export const MOVEMENT_ORDER: Movement[] = ['push', 'pull', 'legs', 'core', 'static', 'skills']

export const MOVEMENTS: Record<Movement, TaxonomyEntry> = {
  push: { label: 'Push', hint: 'Pressing bodyweight away' },
  pull: { label: 'Pull', hint: 'Pulling bodyweight towards you' },
  legs: { label: 'Legs', hint: 'Squat, hinge, lunge, calf' },
  core: { label: 'Core', hint: 'Trunk flexion & anti-rotation' },
  static: { label: 'Static holds', hint: 'Isometric strength' },
  skills: { label: 'Skills', hint: 'Balance & control' },
}

export const EQUIPMENT_ORDER: Equipment[] = [
  'none',
  'floor',
  'dip-bars',
  'pull-up-bar',
  'bands',
  'dumbbells',
  'backpack',
  'rings',
  'parallettes',
  'other',
]

export const EQUIPMENT: Record<Equipment, TaxonomyEntry> = {
  none: { label: 'No equipment', hint: 'Nothing at all' },
  floor: { label: 'Floor', hint: 'A patch of floor' },
  'dip-bars': { label: 'Dip bars', hint: 'Parallel bars' },
  'pull-up-bar': { label: 'Pull-up bar', hint: 'Doorway or gym rig' },
  bands: { label: 'Resistance bands', hint: 'Loop or anchored band' },
  dumbbells: { label: 'Dumbbells', hint: 'Free weights' },
  backpack: { label: 'Backpack', hint: 'Fill it with books' },
  rings: { label: 'Rings', hint: 'Gymnastic rings' },
  parallettes: { label: 'Parallettes', hint: 'Low parallel bars' },
  other: { label: 'Other', hint: 'Bench, wall, chair, box…' },
}

export const DIFFICULTY_ORDER: Difficulty[] = ['beginner', 'intermediate', 'advanced']

export interface DifficultyMeta extends TaxonomyEntry {
  /** The 🟢 / 🟡 / 🔴 indicator. */
  indicator: string
  chip: string
  dot: string
  text: string
}

export const DIFFICULTIES: Record<Difficulty, DifficultyMeta> = {
  beginner: {
    label: 'Beginner',
    indicator: '🟢',
    chip: 'bg-lime-glow/12 text-lime-glow ring-lime-glow/30',
    dot: 'bg-lime-glow',
    text: 'text-lime-glow',
  },
  intermediate: {
    label: 'Intermediate',
    indicator: '🟡',
    chip: 'bg-amber-glow/12 text-amber-glow ring-amber-glow/30',
    dot: 'bg-amber-glow',
    text: 'text-amber-glow',
  },
  advanced: {
    label: 'Advanced',
    indicator: '🔴',
    chip: 'bg-rose-glow/12 text-rose-glow ring-rose-glow/30',
    dot: 'bg-rose-glow',
    text: 'text-rose-glow',
  },
}

/**
 * Per-muscle colours. Exercise cards are keyed off the primary muscle rather
 * than the movement pattern, so this is what drives the card accents. The
 * `acc-*` colours are theme variables, so they stay legible in light mode.
 */
export const MUSCLE_ACCENT: Record<Muscle, { text: string; chip: string; bar: string }> = {
  chest: { text: 'text-acc-chest', chip: 'bg-acc-chest/12 text-acc-chest ring-acc-chest/25', bar: 'bg-acc-chest' },
  back: { text: 'text-acc-back', chip: 'bg-acc-back/12 text-acc-back ring-acc-back/25', bar: 'bg-acc-back' },
  shoulders: { text: 'text-acc-shoulders', chip: 'bg-acc-shoulders/12 text-acc-shoulders ring-acc-shoulders/25', bar: 'bg-acc-shoulders' },
  biceps: { text: 'text-acc-biceps', chip: 'bg-acc-biceps/12 text-acc-biceps ring-acc-biceps/25', bar: 'bg-acc-biceps' },
  triceps: { text: 'text-acc-triceps', chip: 'bg-acc-triceps/12 text-acc-triceps ring-acc-triceps/25', bar: 'bg-acc-triceps' },
  forearms: { text: 'text-acc-forearms', chip: 'bg-acc-forearms/12 text-acc-forearms ring-acc-forearms/25', bar: 'bg-acc-forearms' },
  core: { text: 'text-acc-core', chip: 'bg-acc-core/12 text-acc-core ring-acc-core/25', bar: 'bg-acc-core' },
  glutes: { text: 'text-acc-glutes', chip: 'bg-acc-glutes/12 text-acc-glutes ring-acc-glutes/25', bar: 'bg-acc-glutes' },
  quads: { text: 'text-acc-quads', chip: 'bg-acc-quads/12 text-acc-quads ring-acc-quads/25', bar: 'bg-acc-quads' },
  hamstrings: { text: 'text-acc-hamstrings', chip: 'bg-acc-hamstrings/12 text-acc-hamstrings ring-acc-hamstrings/25', bar: 'bg-acc-hamstrings' },
  calves: { text: 'text-acc-calves', chip: 'bg-acc-calves/12 text-acc-calves ring-acc-calves/25', bar: 'bg-acc-calves' },
  'full-body': { text: 'text-acc-full-body', chip: 'bg-acc-full-body/12 text-acc-full-body ring-acc-full-body/25', bar: 'bg-acc-full-body' },
}

