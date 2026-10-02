import type { LoggedSet, SessionItem, WorkoutSession } from '../types'

/**
 * The rules for editing a session, kept free of React, storage and id
 * generation.
 *
 * Every one of these is a pure function of the session it is handed, and that is
 * the whole point. The session screen renders every exercise at once and a tap
 * can arrive before React has re-rendered for the previous one, so a patch built
 * from the rendered props is already stale by the time it is applied. Two quick
 * taps used to collapse into one and a set silently stopped being recorded.
 *
 * Deriving the new value from the session passed in — rather than from anything
 * captured outside — means each edit sees the result of the edit before it, in
 * whatever order they arrive, so the order taps land in stops mattering.
 *
 * Nothing here imports anything at runtime, so the rules can be exercised
 * directly by `verify-session-flow.mjs`.
 */

/**
 * Keeps an exercise's status honest as its sets are ticked.
 *
 * A skipped exercise can be un-skipped by doing real work on it: ticking a set
 * used to leave the item reading "Skipped" while the set itself showed as done,
 * which filed the exercise as both skipped and logged.
 */
export function recomputeItemStatus(item: SessionItem): SessionItem {
  const done = item.sets.filter((set) => set.status === 'done').length
  const skipped = item.sets.filter((set) => set.status === 'skipped').length
  if (item.status === 'skipped' && done === 0) return item
  if (item.sets.length && done + skipped >= item.sets.length) {
    return { ...item, status: done ? 'completed' : 'skipped' }
  }
  if (done > 0 || skipped > 0) return { ...item, status: 'in-progress' }
  return { ...item, status: 'not-started' }
}

/** Applies one edit to a session, or returns it untouched if the edit declined. */
export function mapSession(
  session: WorkoutSession,
  change: (session: WorkoutSession) => Partial<WorkoutSession> | null,
): WorkoutSession {
  const patch = change(session)
  return patch ? { ...session, ...patch } : session
}

/** Rewrites one exercise inside a session, leaving the others untouched. */
export function patchSessionItem(
  session: WorkoutSession,
  itemId: string,
  change: (item: SessionItem) => SessionItem,
): Partial<WorkoutSession> | null {
  let touched = false
  const items = session.items.map((item) => {
    if (item.id !== itemId) return item
    const next = change(item)
    touched ||= next !== item
    return next
  })
  return touched ? { items } : null
}

/** Rewrites one set of one exercise, then re-derives that exercise's status. */
export function patchSessionSet(
  session: WorkoutSession,
  itemId: string,
  setIndex: number,
  change: (set: LoggedSet) => LoggedSet,
): Partial<WorkoutSession> | null {
  return patchSessionItem(session, itemId, (item) => {
    const original = item.sets[setIndex]
    if (!original) return item
    const edited = change(original)
    if (edited === original) return item

    /*
     * Doing real work on a skipped exercise takes it out of "skipped"
     * altogether.
     *
     * Skipping marks every set skipped at once, so ticking one of them would
     * otherwise leave the exercise reading "completed" — one set done, the rest
     * never attempted but counted as settled. The sets that were skipped along
     * with it were not done, so they go back to pending and show up as
     * outstanding again.
     */
    const startedWorking = item.status === 'skipped' && edited.status === 'done'
    const base = startedWorking
      ? { ...item, status: 'not-started' as const, sets: item.sets.map((set) => ({ ...set, status: 'pending' as const })) }
      : item

    const sets = base.sets.map((set, index) => (index === setIndex ? edited : set))
    if (sets.every((set, index) => set === item.sets[index])) return item
    return recomputeItemStatus({ ...base, sets })
  })
}

/**
 * Flips one set between done and pending.
 *
 * The direction is decided from the set that is actually there, not from a value
 * captured in a render, which is what makes two taps in quick succession toggle
 * twice instead of both asking for the same end state.
 */
export function toggleSetStatus(set: LoggedSet): LoggedSet {
  return { ...set, status: set.status === 'done' ? 'pending' : 'done' }
}

/** Adds another working set to an exercise, pre-filled from the last one. */
export function appendSet(item: SessionItem): SessionItem {
  const previous = item.sets[item.sets.length - 1]
  return {
    ...item,
    targetSets: item.sets.length + 1,
    sets: [
      ...item.sets,
      {
        reps: item.targetReps,
        holdSec: item.targetHoldSec,
        weight: item.targetWeight ?? previous?.weight,
        status: 'pending',
      },
    ],
  }
}

/** Drops the last working set, keeping the exercise's bookkeeping in step. */
export function dropLastSet(item: SessionItem): SessionItem {
  if (item.sets.length <= 1) return item
  return recomputeItemStatus({
    ...item,
    sets: item.sets.slice(0, -1),
    targetSets: Math.max(1, item.sets.length - 1),
  })
}

/** Marks every set of an exercise skipped, or puts them all back to pending. */
export function setItemSkipped(item: SessionItem, skipped: boolean): SessionItem {
  const status = skipped ? ('skipped' as const) : ('pending' as const)
  return {
    ...item,
    status: skipped ? 'skipped' : 'not-started',
    sets: item.sets.map((set) => ({ ...set, status })),
  }
}
