import { useEffect, useState } from 'react'
import { todayKey } from './dates'

/**
 * Today's date key, refreshed when the app crosses midnight.
 *
 * Every derived number on the Progress screens is a function of "today": the
 * week summary, the streak, the "this week" tiles. Reading `todayKey()` inside a
 * `useMemo` whose dependencies do not include it left the app showing the
 * previous day's week for as long as the tab stayed open, and a `useState`
 * snapshot taken at mount never recovered at all — an app opened before
 * midnight still said "Today" about yesterday a week later.
 *
 * The timer targets the next local midnight and re-arms after every tick, and
 * returning to the tab re-checks immediately, because a backgrounded tab has its
 * timers throttled and the device may have been asleep across the boundary.
 */
export function useTodayKey(): string {
  const [today, setToday] = useState(todayKey)

  useEffect(() => {
    let timer = 0

    const msUntilMidnight = () => {
      const now = new Date()
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
      // A floor, so a clock change or a wake from sleep lands on the next check
      // soon instead of never.
      return Math.max(1_000, midnight - now.getTime())
    }

    const arm = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        setToday(todayKey())
        arm()
      }, msUntilMidnight())
    }

    const refresh = () => {
      setToday(todayKey())
      arm()
    }

    arm()
    const onWake = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [])

  return today
}