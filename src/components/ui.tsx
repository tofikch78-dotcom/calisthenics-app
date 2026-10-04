import type { ReactNode } from 'react'
import { difficultyMeta, muscleAccent, muscleMeta } from '../lib/labels'
import type { Difficulty, Muscle } from '../types'

/* ── Icons ─────────────────────────────────────────────────────────────── */

type IconProps = { className?: string }

const base = 'h-4 w-4 shrink-0'

export function IconSearch({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function IconClose({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function IconPlus({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/**
 * Play/pause mark for the small animation badges. Drawn rather than typed: the
 * characters `❚❚` and `▶` have no glyph in the app's font stack and fall back to
 * a double-width face, so a pair of them measured 28px of advance inside a 14px
 * `size-4` circle and spilled 7px out of each side of the badge.
 */
export function PlayPauseGlyph({ playing, className = 'h-2 w-2' }: { playing: boolean; className?: string }) {
  const stroke = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  return (
    <svg viewBox="0 0 24 24" fill={playing ? 'currentColor' : 'none'} stroke="currentColor" {...stroke} className={className} aria-hidden="true">
      {playing ? <path d="M9 5v14M15 5v14" /> : <path d="M7.5 4.8 19 12 7.5 19.2V4.8Z" />}
    </svg>
  )
}

export function IconCheck({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  )
}

export function IconTrash({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </svg>
  )
}

export function IconCopy({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  )
}

export function IconUp({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m6 14 6-6 6 6" />
    </svg>
  )
}

export function IconDown({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m6 10 6 6 6-6" />
    </svg>
  )
}

export function IconSparkle({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.8L12 18l-1.7-5.5L4.8 10.7 10.3 9 12 3.5Z" />
      <path d="M18.5 3.5v3M20 5h-3" />
    </svg>
  )
}

export function IconSwap({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  )
}

export function IconFilter({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

export function IconDumbbell({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" />
    </svg>
  )
}

export function IconBook({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" />
    </svg>
  )
}

/* ── Primitives ────────────────────────────────────────────────────────── */

export function DifficultyBadge({
  level,
  size = 'sm',
}: {
  level: Difficulty
  size?: 'sm' | 'md'
}) {
  const meta = difficultyMeta(level)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ${meta.chip} ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <span aria-hidden="true">{meta.indicator}</span>
      {meta.label}
    </span>
  )
}

export function Tag({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-ink-600/70 bg-ink-800/60 px-2 py-0.5 text-[11px] text-mist-300 ${className}`}
    >
      {children}
    </span>
  )
}

export function MusclePill({ muscle, className = '' }: { muscle: Muscle; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${muscleAccent(muscle).chip} ${className}`}
    >
      {muscleMeta(muscle).label}
    </span>
  )
}

export function Button({
  children,
  variant = 'ghost',
  className = '',
  ...rest
}: {
  children: ReactNode
  variant?: 'primary' | 'ghost' | 'outline' | 'danger'
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary:
      'bg-brand-500 text-white hover:bg-brand-400 shadow-lg shadow-brand-500/20 disabled:bg-ink-700 disabled:text-ink-500 disabled:shadow-none',
    ghost: 'text-mist-300 hover:bg-ink-800 hover:text-mist-100',
    outline: 'border border-ink-600 text-mist-200 hover:border-brand-400/60 hover:text-white',
    danger: 'text-rose-300 hover:bg-rose-500/12 hover:text-rose-200',
  }[variant]
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-600/80 bg-ink-850/40 px-6 py-16 text-center">
      <div className="mb-4 rounded-2xl border border-ink-600/70 bg-ink-800/70 p-3 text-mist-400">{icon}</div>
      <h3 className="text-base font-semibold text-mist-100">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-mist-400">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function SectionHeading({
  children,
  hint,
}: {
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-xs font-semibold tracking-[0.14em] text-mist-400 uppercase">{children}</h3>
      {hint ? <span className="text-xs text-mist-400">{hint}</span> : null}
    </div>
  )
}
