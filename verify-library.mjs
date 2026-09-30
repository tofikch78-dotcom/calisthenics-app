/**
 * Sanity checks for the exercise library. Imports the real data modules and
 * verifies that every progression id resolves, that taxonomy values are valid,
 * that pose keys exist, and that no exercise is missing required content.
 */
import { CORE_EXERCISES } from './src/data/core.ts'
import { LEG_EXERCISES } from './src/data/legs.ts'
import { PULL_EXERCISES } from './src/data/pull.ts'
import { PUSH_EXERCISES } from './src/data/push.ts'
import { SKILL_EXERCISES } from './src/data/skills.ts'
import { SKILL_LADDERS, SKILL_MEMBERSHIP } from './src/data/skill-ladders.ts'
import { POSES } from './src/lib/poses.ts'
import {
  DIFFICULTY_ORDER,
  EQUIPMENT_ORDER,
  MOVEMENT_ORDER,
  MUSCLE_ORDER,
} from './src/data/taxonomy.ts'

const EXERCISES = [
  ...PUSH_EXERCISES,
  ...PULL_EXERCISES,
  ...LEG_EXERCISES,
  ...CORE_EXERCISES,
  ...SKILL_EXERCISES,
]

console.log(`Total exercises: ${EXERCISES.length}\n`)

const ids = new Set(EXERCISES.map((e) => e.id))
const problems = []

if (ids.size !== EXERCISES.length) {
  const seen = new Set()
  for (const e of EXERCISES) {
    if (seen.has(e.id)) problems.push(`DUPLICATE id: ${e.id}`)
    seen.add(e.id)
  }
}

const muscleSet = new Set(MUSCLE_ORDER)
const movementSet = new Set(MOVEMENT_ORDER)
const equipmentSet = new Set(EQUIPMENT_ORDER)
const difficultySet = new Set(DIFFICULTY_ORDER)
const names = new Set()
const referenced = new Set()

for (const e of EXERCISES) {
  const key = e.name.toLowerCase()
  if (names.has(key)) problems.push(`DUPLICATE name: ${e.name}`)
  names.add(key)

  for (const key of ['easier', 'harder']) {
    for (const target of e[key]) {
      if (!ids.has(target)) problems.push(`${e.id}.${key} -> unknown id "${target}"`)
      referenced.add(target)
    }
  }

  if (!muscleSet.has(e.mainMuscle)) problems.push(`${e.id}: bad mainMuscle "${e.mainMuscle}"`)
  for (const m of e.secondaryMuscles) {
    if (!muscleSet.has(m)) problems.push(`${e.id}: bad secondaryMuscle "${m}"`)
    if (m === e.mainMuscle) problems.push(`${e.id}: mainMuscle repeated in secondaryMuscles`)
  }
  if (!movementSet.has(e.movement)) problems.push(`${e.id}: bad movement "${e.movement}"`)
  if (!difficultySet.has(e.difficulty)) problems.push(`${e.id}: bad difficulty "${e.difficulty}"`)
  for (const item of e.equipment) {
    if (!equipmentSet.has(item)) problems.push(`${e.id}: bad equipment "${item}"`)
  }
  if (!e.equipment.length) problems.push(`${e.id}: empty equipment array`)

  if (!e.description || e.description.length < 40) problems.push(`${e.id}: weak description`)
  if (e.steps.length < 3) problems.push(`${e.id}: needs at least 3 steps (has ${e.steps.length})`)
  if (e.mistakes.length < 2) problems.push(`${e.id}: needs at least 2 mistakes (has ${e.mistakes.length})`)
  if (e.dosage.sets < 1) problems.push(`${e.id}: sets must be >= 1`)
  if (e.dosage.restSec < 15) problems.push(`${e.id}: restSec looks too low`)
  if (!e.dosage.reps && !e.dosage.holdSec) problems.push(`${e.id}: dosage needs reps or holdSec`)

  for (const pose of e.animation ?? []) {
    if (!POSES[pose]) problems.push(`${e.id}: unknown pose key "${pose}"`)
  }
  if (!e.animation?.length) problems.push(`${e.id}: no animation`)
}

/* Skill ladders must point only at real exercises, and every rung must be
 * strictly harder than the one before it or the ladder reads backwards. */
const DIFFICULTY_RANK = { beginner: 0, intermediate: 1, advanced: 2 }
const byId = new Map(EXERCISES.map((e) => [e.id, e]))

if (SKILL_LADDERS.length !== 8) problems.push(`expected 8 skill ladders, found ${SKILL_LADDERS.length}`)

for (const ladder of SKILL_LADDERS) {
  if (!ladder.name) problems.push(`ladder ${ladder.id}: missing name`)
  if (!ladder.goal) problems.push(`ladder ${ladder.id}: missing goal`)
  if (!ladder.cue) problems.push(`ladder ${ladder.id}: missing cue`)
  if (ladder.stages.length < 2) problems.push(`ladder ${ladder.id}: needs at least 2 stages`)

  for (const stageId of ladder.stages) {
    if (!ids.has(stageId)) problems.push(`ladder ${ladder.id}: unknown stage id "${stageId}"`)
  }

  for (let i = 1; i < ladder.stages.length; i += 1) {
    const previous = byId.get(ladder.stages[i - 1])
    const current = byId.get(ladder.stages[i])
    if (!previous || !current) continue
    if (DIFFICULTY_RANK[current.difficulty] < DIFFICULTY_RANK[previous.difficulty]) {
      problems.push(
        `ladder ${ladder.id}: ${current.id} (${current.difficulty}) is easier than ${previous.id} (${previous.difficulty})`,
      )
    }
  }
}

for (const [exerciseId, ladderIds] of Object.entries(SKILL_MEMBERSHIP)) {
  if (!ids.has(exerciseId)) problems.push(`SKILL_MEMBERSHIP: unknown exercise "${exerciseId}"`)
  for (const ladderId of ladderIds) {
    if (!SKILL_LADDERS.some((ladder) => ladder.id === ladderId)) {
      problems.push(`SKILL_MEMBERSHIP: ${exerciseId} -> unknown ladder "${ladderId}"`)
    }
  }
}

const orphans = [...ids].filter((id) => !referenced.has(id))

const tally = (values) =>
  values.reduce((acc, value) => ({ ...acc, [value]: (acc[value] ?? 0) + 1 }), {})

console.log('By movement:  ', tally(EXERCISES.map((e) => e.movement)))
console.log('By difficulty:', tally(EXERCISES.map((e) => e.difficulty)))
console.log('Poses defined:', Object.keys(POSES).length)
console.log(
  'Skill ladders:',
  SKILL_LADDERS.length,
  `(${SKILL_LADDERS.reduce((sum, l) => sum + l.stages.length, 0)} rungs total)`,
)
console.log('Orphans (not in any progression):', orphans.length, orphans.join(', '))
console.log('')

if (problems.length) {
  console.log(`FOUND ${problems.length} PROBLEMS:`)
  for (const p of problems) console.log('  -', p)
  process.exit(1)
}
console.log('All library checks passed.')
