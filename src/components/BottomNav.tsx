import type { ComponentType } from 'react'
import { IconChart, IconGear, IconHome, IconLeaf } from './kit'
import { IconBook, IconDumbbell } from './ui'
import type { Tab } from './HomeView'

interface NavItem {
  id: Tab
  label: string
  emoji: string
  icon: ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', emoji: '🏠', icon: IconHome },
  { id: 'workout', label: 'Workout', emoji: '🏋️', icon: IconDumbbell },
  { id: 'exercises', label: 'Exercises', emoji: '📚', icon: IconBook },
  { id: 'nutrition', label: 'Nutrition', emoji: '🥗', icon: IconLeaf },
  { id: 'progress', label: 'Progress', emoji: '📊', icon: IconChart },
  { id: 'profile', label: 'Profile', emoji: '⚙️', icon: IconGear },
]

/**
 * Mobile-first bottom navigation: a fixed bar with six targets, plus safe-area
 * padding for phones with a home indicator. On desktop the same items become a
 * sticky top bar so nothing sits under a mouse cursor.
 */
export function BottomNav({
  active,
  onChange,
  badges = {},
}: {
  active: Tab
  onChange: (tab: Tab) => void
  /** Small dots on a tab, e.g. an un-finished session. */
  badges?: Partial<Record<Tab, boolean>>
}) {
  return (
    <>
      {/* Mobile: fixed to the bottom */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700 bg-ink-900/95 backdrop-blur-xl md:hidden"
      >
        <ul className="bottom-nav-safe mx-auto grid max-w-lg grid-cols-6 px-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === active
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onChange(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex w-full flex-col items-center gap-0.5 rounded-xl px-0.5 py-2 transition ${
                    isActive ? 'text-brand-300' : 'text-mist-400 hover:text-mist-200'
                  }`}
                >
                  {badges[item.id] && (
                    <span className="absolute top-1.5 right-1/2 size-2 translate-x-3 rounded-full bg-lime-glow" />
                  )}
                  <span aria-hidden="true" className="text-base leading-none">
                    {item.emoji}
                  </span>
                  <span className="text-[10px] leading-tight font-medium">{item.label}</span>
                  <span
                    className={`absolute -top-px h-0.5 w-8 rounded-full transition ${
                      isActive ? 'bg-brand-400' : 'bg-transparent'
                    }`}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Desktop: sticky top bar */}
      <nav
        aria-label="Main"
        className="sticky top-0 z-40 hidden border-b border-ink-700 bg-ink-950/85 backdrop-blur-xl md:block"
      >
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2">
          <span className="mr-3 text-sm font-bold tracking-tight text-white">
            Calisthenics<span className="text-brand-300">.</span>
          </span>
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === active
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isActive ? 'bg-brand-500/15 text-brand-300' : 'text-mist-400 hover:bg-ink-800 hover:text-mist-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
                {badges[item.id] && (
                  <span className="ml-0.5 size-1.5 rounded-full bg-lime-glow" aria-label="has activity" />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}


