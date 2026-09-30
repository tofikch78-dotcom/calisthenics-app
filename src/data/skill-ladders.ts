/**
 * The eight headline calisthenics skills, each as an ordered ladder from the
 * entry rung to the full skill. `stages` holds exercise ids that all exist in
 * the exercise library, so the Skills tab, the progression engine and the
 * "next step" hints all read from one source of truth.
 */

export interface SkillLadder {
  id: string
  name: string
  /** Exercise ids, easiest first. */
  stages: string[]
  /** What the top of the ladder actually is. */
  goal: string
  cue: string
}

export const SKILL_LADDERS: SkillLadder[] = [
  {
    id: 'handstand',
    name: 'Handstand',
    stages: ['wall-handstand', 'frog-stand', 'handstand', 'one-arm-handstand'],
    goal: 'A freestanding handstand you can hold with no wall contact.',
    cue: 'Push tall through the shoulders, grip the floor like you are trying to prise the fingers off, and look forwards — not at your hands.',
  },
  {
    id: 'l-sit',
    name: 'L-sit',
    stages: ['tuck-l-sit', 'l-sit-progression', 'l-sit', 'v-sit', 'manna'],
    goal: 'Legs parallel to the floor with the heels lifted and locked knees.',
    cue: 'Press the floor away, lock the elbows completely straight and lift the heels before you worry about height.',
  },
  {
    id: 'planche',
    name: 'Planche',
    stages: ['planche-lean', 'pseudo-planche-push-ups', 'tuck-planche', 'planche'],
    goal: 'A full horizontal body line held on the hands alone.',
    cue: 'Protract hard — push the shoulder blades forward and down so the upper back rounds toward the ceiling.',
  },
  {
    id: 'front-lever',
    name: 'Front Lever',
    stages: ['active-hang', 'tuck-front-lever', 'front-lever'],
    goal: 'A straight horizontal body hanging under the bar, face up.',
    cue: 'Depress the scapulae hard before the knees leave the chest; the back does the work, not the arms.',
  },
  {
    id: 'back-lever',
    name: 'Back Lever',
    stages: ['active-hang', 'tuck-front-lever', 'back-lever'],
    goal: 'A straight horizontal body hanging under the bar, face down.',
    cue: 'Same mechanics as the front lever with the palm rotation reversed — hollow the hips and turn the chest toward the floor.',
  },
  {
    id: 'muscle-up',
    name: 'Muscle-up',
    stages: ['pull-ups', 'explosive-pull-ups', 'archer-pull-ups', 'muscle-up'],
    goal: 'Bar to chest to bar to overhead, without feet touching.',
    cue: 'Keep the bar close, pull the elbows to the ribs, then flick the wrists down as the chest reaches the bar.',
  },
  {
    id: 'human-flag',
    name: 'Human Flag',
    stages: ['tuck-front-lever', 'planche-lean', 'human-flag', 'one-arm-human-flag'],
    goal: 'A horizontal body held sideways on one vertical push and one vertical pull.',
    cue: 'Push and pull against each other at exactly the same time — a flag is a plank, rotated.',
  },
  {
    id: 'pistol-squat',
    name: 'Pistol Squat',
    stages: ['bodyweight-squats', 'bench-pistol-squat', 'pistol-squat-progression', 'pistol-squat'],
    goal: 'A full single-leg squat, heel down, all the way to the glutes.',
    cue: 'Free leg stays out front as a counterweight, and the working heel never leaves the floor.',
  },
]

export const SKILL_LADDER_BY_ID = new Map(SKILL_LADDERS.map((ladder) => [ladder.id, ladder]))

/** Every exercise that sits on any ladder, mapped to the skills it serves. */
export const SKILL_MEMBERSHIP = new Map<string, string[]>()
for (const ladder of SKILL_LADDERS) {
  for (const stage of ladder.stages) {
    SKILL_MEMBERSHIP.set(stage, [...(SKILL_MEMBERSHIP.get(stage) ?? []), ladder.id])
  }
}
