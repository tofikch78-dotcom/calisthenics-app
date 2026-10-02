import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Rest timer.
 *
 * The state is an absolute deadline (`endsAt`) rather than a counter that gets
 * decremented on every tick. That one decision is what makes the timer survive
 * everything the session screen throws at it:
 *
 *   - a re-render cannot restart it, because the displayed value is derived
 *     from the clock instead of from a stored number
 *   - remounting the screen mid-rest (switching tabs, opening an exercise)
 *     resumes the same countdown instead of starting a second one
 *   - a backgrounded tab that skips ticks catches up correctly on return,
 *     which a decrementing counter silently gets wrong
 *
 * There is only ever one interval, owned by the hook, and it only runs while the
 * timer is actually counting.
 */
export interface RestTimer {
  /** Full duration of the current rest, in seconds. */
  totalSec: number
  /** Absolute deadline in ms, or null while paused / idle. */
  endsAt: number | null
  /** What is left on the clock while paused. */
  pausedSec: number
}

export const IDLE_REST: RestTimer = { totalSec: 0, endsAt: null, pausedSec: 0 }

/** Whole seconds left, floored at zero. Pure: same inputs, same answer. */
export function restRemaining(state: RestTimer, now: number): number {
  if (state.endsAt === null) return Math.max(0, Math.ceil(state.pausedSec))
  return Math.max(0, Math.ceil((state.endsAt - now) / 1000))
}

export function isRestRunning(state: RestTimer): boolean {
  return state.endsAt !== null
}

/** Starts a fresh rest of `totalSec` seconds, discarding any previous one. */
export function restStart(totalSec: number, now: number): RestTimer {
  const total = Math.max(0, Math.round(totalSec))
  if (!total) return IDLE_REST
  return { totalSec: total, endsAt: now + total * 1000, pausedSec: total }
}

/** Holds the remaining time. Restarting from an already-idle timer is a no-op. */
export function restPause(state: RestTimer, now: number): RestTimer {
  if (state.endsAt === null) return state
  return { ...state, endsAt: null, pausedSec: restRemaining(state, now) }
}

/** Picks the held countdown back up. */
export function restResume(state: RestTimer, now: number): RestTimer {
  if (state.endsAt !== null || state.pausedSec <= 0) return state
  return { ...state, endsAt: now + state.pausedSec * 1000 }
}

/** Back to the full prescribed rest, stopped. */
export function restReset(totalSec: number): RestTimer {
  const total = Math.max(0, Math.round(totalSec))
  return { totalSec: total, endsAt: null, pausedSec: total }
}

/** The prescribed rest for the next set, or 0 when the exercise has none. */
export function prescribedRest(targetRestSec?: number): number {
  const value = Math.round(targetRestSec ?? 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** Nudges a running or paused timer, and tops it up if it had already run out. */
export function restAdjust(state: RestTimer, seconds: number): RestTimer {
  if (state.endsAt === null) {
    // Paused (or run out): adding time topps the held remainder back up, and
    // extending `totalSec` keeps Reset returning to the longest rest asked for.
    const paused = Math.max(0, Math.ceil(state.pausedSec) + seconds)
    if (!paused) return IDLE_REST
    return { ...state, totalSec: Math.max(state.totalSec, paused), pausedSec: paused }
  }
  return { ...state, endsAt: state.endsAt + seconds * 1000 }
}

export const REST_ADJUST_SECONDS = 30

/**
 * Owns exactly one interval for the lifetime of the mounted screen.
 *
 * The timer is derived from `Date.now()` rather than from a tick counter, and
 * the interval is torn down whenever nothing is counting, so navigating between
 * exercises, opening a detail sheet or re-rendering the session cannot leave a
 * stray interval behind or spawn a second one.
 */
export function useRestTimer(defaultSec: number) {
  const [state, setState] = useState<RestTimer>(() => restReset(defaultSec))
  const [now, setNow] = useState(() => Date.now())
  const interval = useRef<number | null>(null)

  const running = state.endsAt !== null
  const remaining = restRemaining(state, now)

  useEffect(() => {
    if (!running) {
      if (interval.current !== null) {
        window.clearInterval(interval.current)
        interval.current = null
      }
      return
    }
    // Only ever one interval: the effect clears any previous handle before it
    // creates another, and `running` is the single dependency that can start it.
    if (interval.current !== null) window.clearInterval(interval.current)
    interval.current = window.setInterval(() => setNow(Date.now()), 250)
    return () => {
      if (interval.current !== null) {
        window.clearInterval(interval.current)
        interval.current = null
      }
    }
  }, [running])

  const start = useCallback((seconds?: number) => {
    const total = seconds ?? state.totalSec
    setNow(Date.now())
    setState(restStart(total, Date.now()))
  }, [state.totalSec])

  // Each of these moves the clock and the deadline in the same tick. Without
  // that, pausing or resuming would leave the display on the previous
  // `now` until the next interval tick, showing a second of time that is not
  // really on the clock.
  const pause = useCallback(() => {
    const at = Date.now()
    setNow(at)
    setState((current) => restPause(current, at))
  }, [])

  const resume = useCallback(() => {
    const at = Date.now()
    setNow(at)
    setState((current) => restResume(current, at))
  }, [])

  const reset = useCallback((seconds?: number) => {
    const total = seconds ?? state.totalSec
    setNow(Date.now())
    setState(restReset(total))
  }, [state.totalSec])

  const adjust = useCallback((seconds: number) => {
    setNow(Date.now())
    setState((current) => restAdjust(current, seconds))
  }, [])

  const stop = useCallback(() => setState(IDLE_REST), [])

  return {
    state,
    remaining,
    running,
    /** True once the countdown has reached zero. */
    finished: remaining <= 0,
    start,
    pause,
    resume,
    reset,
    adjust,
    stop,
  }
}