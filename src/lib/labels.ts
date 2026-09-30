import { EQUIPMENT, MUSCLES } from '../data'
import type { Equipment, Muscle } from '../types'

/**
 * Plain label lookups. They live outside `ui.tsx` so that file only exports
 * components, which keeps React Fast Refresh working in dev.
 */
export function muscleLabel(muscle: Muscle): string {
  return MUSCLES[muscle].label
}

export function equipmentLabel(equipment: Equipment): string {
  return EQUIPMENT[equipment].label
}
