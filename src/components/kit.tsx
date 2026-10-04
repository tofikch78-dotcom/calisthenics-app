import type { ReactNode } from 'react'
import { useEscape } from '../lib/use-escape'

/**
 * Shared UI kit for the newer screens (dashboard, session runner, nutrition,
 * calendar, profile). The original library components keep their own `ui.tsx`
 * primitives; anything both halves need lives in one of these two files.
 */

const base = 'h-4 w-4 shrink-0'
type IconProps = { className?: string }

/* ── Navigation & status icons ──────────────────────────────────────────── */

export function IconHome({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.75 20v-5.5h4.5V20" />
    </svg>
  )
}

export function IconTrophy({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4.5v1.5A3 3 0 0 0 7 10.4M17 6h2.5v1.5a3 3 0 0 1-2.5 2.9" />
      <path d="M12 14v3.5M8.5 20h7l-.7-2.5H9.2L8.5 20Z" />
    </svg>
  )
}

export function IconLeaf({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 19c0-8 5-13 14-13 0 9-5 13-11 13H5Z" />
      <path d="M5.5 18.5C8 15.5 11 13 15 11.5" />
    </svg>
  )
}

export function IconChart({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 19.5V4.5M4 19.5h16" />
      <path d="M8 16V11M12.5 16V7M17 16v-3" />
    </svg>
  )
}

export function IconGear({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.5 12H2.1M21.9 12h-2.4M6.4 6.4 4.6 4.6M19.4 19.4l-1.8-1.8M17.6 6.4l1.8-1.8M4.6 19.4l1.8-1.8" />
    </svg>
  )
}

export function IconCalendar({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5V6.5M16 3.5V6.5" />
    </svg>
  )
}

export function IconFlame({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3s4.5 4 4.5 8a4.5 4.5 0 0 1-9 0c0-1.6.7-2.9 1.5-3.8C9.6 9 11 10 11 10s-1-3.5 1-7Z" />
      <path d="M12 21a6 6 0 0 0 6-6" />
    </svg>
  )
}

export function IconPlay({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7.5 4.8 19 12 7.5 19.2V4.8Z" />
    </svg>
  )
}

export function IconSkip({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 6l7 6-7 6V6Z" />
      <path d="M17 5.5v13" />
    </svg>
  )
}

export function IconDownload({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 4v11" />
      <path d="M8 11.5 12 15.5l4-4" />
      <path d="M4.5 19.5h15" />
    </svg>
  )
}

export function IconUpload({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 16V5" />
      <path d="M8 8.5 12 4.5l4 4" />
      <path d="M4.5 19.5h15" />
    </svg>
  )
}

export function IconChevron({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

export function IconSun({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </svg>
  )
}

export function IconMoon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  )
}

export function IconNote({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 4.5h9l5 5V19.5H5V4.5Z" />
      <path d="M14 4.5v5h5M8 13h8M8 16.5h5" />
    </svg>
  )
}

export function IconWater({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3.5s5.5 5.6 5.5 9.4a5.5 5.5 0 1 1-11 0C6.5 9.1 12 3.5 12 3.5Z" />
    </svg>
  )
}

export function IconClock({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

/* ── Shared with the original ui.tsx, re-exported so both halves agree ───── */

export { IconCheck, IconClose, IconPlus, IconTrash } from './ui'

/* ── Form primitives ────────────────────────────────────────────────────── */

/*
 * `py-2` around a 14px line box came to 38px, which is under the 44px a thumb
 * needs. `min-h-11` raises the field without changing the type size or the gap
 * around it, so forms keep their rhythm and only the target grows.
 */
const fieldBase =
  'w-full min-h-11 rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-mist-100 placeholder:text-ink-500 focus:border-brand-400/70 focus:outline-none'

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="mb-1 block text-[10px] font-medium tracking-wider text-mist-400 uppercase">
      {children}
      {hint ? <span className="ml-1 normal-case opacity-70">{hint}</span> : null}
    </span>
  )
}

export function TextField({
  label,
  hint,
  className = '',
  ...rest
}: { label?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const input = <input className={`${fieldBase} ${className}`} {...rest} />
  if (!label) return input
  return (
    <label className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      {input}
    </label>
  )
}

export function TextArea({
  label,
  hint,
  className = '',
  ...rest
}: { label?: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const field = <textarea className={`${fieldBase} resize-y ${className}`} {...rest} />
  if (!label) return field
  return (
    <label className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      {field}
    </label>
  )
}

export function NumberField({
  label,
  hint,
  suffix,
  className = '',
  ...rest
}: {
  label?: string
  hint?: string
  suffix?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const input = (
    <div className="relative">
      <input type="number" inputMode="decimal" className={`${fieldBase} no-spinner pr-9 ${className}`} {...rest} />
      {suffix ? (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-mist-400">
          {suffix}
        </span>
      ) : null}
    </div>
  )
  if (!label) return input
  return (
    <label className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      {input}
    </label>
  )
}

export function SelectField({
  label,
  hint,
  children,
  className = '',
  ...rest
}: {
  label?: string
  hint?: string
  children: ReactNode
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const field = (
    <select className={`${fieldBase} ${className}`} {...rest}>
      {children}
    </select>
  )
  if (!label) return field
  return (
    <label className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      {field}
    </label>
  )
}

/** Multi-select chip; `pressed` drives both aria and the visual state. */
export function Chip({
  pressed,
  onClick,
  children,
  className = '',
  title,
}: {
  pressed?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      title={title}
      className={`min-h-11 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
        pressed
          ? 'bg-brand-500/18 text-brand-300 ring-1 ring-brand-400/40'
          : 'bg-ink-800/70 text-mist-300 ring-1 ring-ink-600/70 hover:ring-ink-500 hover:text-mist-100'
      } ${className}`}
    >
      {children}
    </button>
  )
}

/* ── Data display ───────────────────────────────────────────────────────── */

export function ProgressBar({
  value,
  tone = 'brand',
  className = '',
  label,
}: {
  value: number
  tone?: 'brand' | 'ok' | 'warn' | 'bad' | 'muted'
  className?: string
  label?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  const fill = {
    brand: 'bg-brand-500',
    ok: 'bg-lime-glow',
    warn: 'bg-amber-glow',
    bad: 'bg-rose-glow',
    muted: 'bg-ink-500',
  }[tone]
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-ink-700 ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${fill}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export function ProgressRing({
  value,
  size = 96,
  stroke = 8,
  tone = 'brand',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: 'brand' | 'ok' | 'warn' | 'bad'
  children?: ReactNode
}) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const strokeColor = {
    brand: 'var(--color-brand-400)',
    ok: 'var(--color-lime-glow)',
    warn: 'var(--color-amber-glow)',
    bad: 'var(--color-rose-glow)',
  }[tone]
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--c-line-strong)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (clamped / 100) * circumference}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-tight">{children}</div>
    </div>
  )
}

export function StatTile({
  value,
  label,
  hint,
  suffix,
  tone = 'default',
  className = '',
}: {
  value: ReactNode
  label: string
  hint?: string
  suffix?: string
  tone?: 'default' | 'ok' | 'warn' | 'bad' | 'brand'
  className?: string
}) {
  const valueTone = {
    default: 'text-mist-100',
    ok: 'text-lime-glow',
    warn: 'text-amber-glow',
    bad: 'text-rose-glow',
    brand: 'text-brand-300',
  }[tone]
  return (
    <div className={`rounded-2xl border border-ink-700 bg-ink-850/70 p-3.5 ${className}`}>
      <div className={`tnum text-xl leading-none font-bold ${valueTone}`}>
        {value}
        {suffix ? <span className="ml-0.5 text-xs font-semibold opacity-70">{suffix}</span> : null}
      </div>
      <div className="mt-1.5 text-[11px] leading-tight text-mist-400">{label}</div>
      {hint ? <div className="mt-0.5 text-[10px] text-mist-500">{hint}</div> : null}
    </div>
  )
}

export function Card({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
}) {
  return <Tag className={`rounded-2xl border border-ink-700 bg-ink-850/60 p-4 ${className}`}>{children}</Tag>
}

export function Pill({
  children,
  className = '',
  title,
}: {
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${className}`}
    >
      {children}
    </span>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
  ariaLabel,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (next: T) => void
  className?: string
  ariaLabel?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex flex-wrap gap-1 rounded-xl border border-ink-700 bg-ink-900/60 p-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            // `min-h-11` alone left a short label like "All" at 38px wide, so the
            // shortest option in a filter row was the hardest to tap.
            className={`min-h-11 min-w-11 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              active ? 'bg-brand-500/18 text-brand-300' : 'text-mist-400 hover:text-mist-100'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-ink-700 bg-ink-850/60 px-3.5 py-3 text-left transition hover:border-ink-600"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-mist-100">{label}</span>
        {description ? <span className="mt-0.5 block text-[11px] text-mist-400">{description}</span> : null}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand-500' : 'bg-ink-600'}`}>
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white transition-[left] ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}

/** Bottom sheet on mobile, centred dialog on desktop. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEscape(onClose)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {/*
        `dvh` tracks the real viewport as the mobile URL bar collapses, so the
        sheet never hangs below the fold. The plain `vh` is the fallback for
        browsers without dynamic viewport units. On phones it is a bottom
        sheet (`items-end`), which is the one-handed-reachable presentation.
      */}
      <div
        className={`animate-rise flex max-h-[88vh] max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-ink-600 bg-ink-900 sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-mist-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            // `p-2` around a 24px glyph came to 32x32, which is not a thumb
            // target. `size-11` on the button keeps the icon the same size and
            // only widens the thing you actually have to hit.
            className="-mr-1.5 grid size-11 shrink-0 place-items-center rounded-lg text-mist-400 transition hover:bg-ink-800 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={base} aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 scrollbar-slim">{children}</div>
        {/*
          The footer's bottom padding keeps the primary action clear of the
          Android gesture bar and the iPhone home indicator, while preserving
          the same 0.75rem breathing room when there is no inset. Done inline
          because Tailwind cannot add a calc() on top of an arbitrary value
          here without generating a one-off class.
        */}
        {footer ? (
          <div
            className="border-t border-ink-700 px-4 pt-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Body-weight trend. Deliberately hand-rolled: one SVG path, no chart library,
 * so the app stays dependency-free and the whole build stays small.
 */
export function LineChart({
  points,
  height = 170,
  unit = 'kg',
}: {
  points: { x: string; y: number }[]
  height?: number
  unit?: string
}) {
  if (points.length < 2) {
    return (
      <p className="py-10 text-center text-xs text-mist-400">
        Log your weight at least twice to see a trend.
      </p>
    )
  }

  const width = 340
  const padding = { top: 14, right: 10, bottom: 22, left: 36 }
  const values = points.map((point) => point.y)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const xAt = (index: number) =>
    padding.left + (index / (points.length - 1)) * (width - padding.left - padding.right)
  const yAt = (value: number) =>
    padding.top + (1 - (value - min) / span) * (height - padding.top - padding.bottom)

  const path = points
    .map((point, index) => `${index ? 'L' : 'M'}${xAt(index).toFixed(1)},${yAt(point.y).toFixed(1)}`)
    .join(' ')
  const area = `${path} L${xAt(points.length - 1).toFixed(1)},${height - padding.bottom} L${xAt(0).toFixed(1)},${height - padding.bottom} Z`
  const first = points[0]
  const last = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={`Body weight from ${first.y} ${unit} to ${last.y} ${unit}`}
    >
      <defs>
        <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <text x={2} y={yAt(max) + 4} fontSize="9" fill="var(--c-text-muted)">
        {max.toFixed(1)}
      </text>
      <text x={2} y={yAt(min) + 4} fontSize="9" fill="var(--c-text-muted)">
        {min.toFixed(1)}
      </text>
      <line
        x1={padding.left}
        y1={height - padding.bottom}
        x2={width - padding.right}
        y2={height - padding.bottom}
        stroke="var(--c-line)"
        strokeWidth="1"
      />

      <path d={area} fill="url(#weight-fill)" />
      <path
        d={path}
        fill="none"
        stroke="var(--color-brand-400)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => (
        <circle
          key={point.x}
          cx={xAt(index)}
          cy={yAt(point.y)}
          r={index === points.length - 1 ? 3.5 : 2}
          fill="var(--color-brand-400)"
        />
      ))}

      <text x={padding.left} y={height - 6} fontSize="9" fill="var(--c-text-muted)">
        {first.x}
      </text>
      <text x={width - padding.right} y={height - 6} fontSize="9" textAnchor="end" fill="var(--c-text-muted)">
        {last.x}
      </text>
    </svg>
  )
}
