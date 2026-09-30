import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  EQUIPMENT,
  EQUIPMENT_ORDER,
  MOVEMENTS,
  MOVEMENT_ORDER,
  MUSCLES,
  MUSCLE_ACCENT,
  MUSCLE_ORDER,
} from '../data'
import { countActiveFilters, type LibraryFilters, type SortKey } from '../lib/search'
import type { Difficulty, Equipment, Movement, Muscle } from '../types'
import { Button, IconFilter, SectionHeading } from './ui'

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name (A–Z)',
  difficulty: 'Difficulty',
  muscle: 'Primary muscle',
  equipment: 'Equipment',
}

function Checkbox({
  checked,
  onChange,
  label,
  hint,
  count,
  accent,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  hint?: string
  count?: number
  accent?: string
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition ${
        checked ? 'bg-ink-800 text-mist-100' : 'text-mist-300 hover:bg-ink-800/60'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`grid size-4 shrink-0 place-items-center rounded border transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-400 ${
          checked
            ? accent ?? 'border-brand-400 bg-brand-500 text-white'
            : 'border-ink-500 bg-ink-800'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint ? <span className="block truncate text-[11px] text-mist-400">{hint}</span> : null}
      </span>
      {count != null && (
        <span className="shrink-0 rounded-md bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-mist-400 group-hover:bg-ink-700">
          {count}
        </span>
      )}
    </label>
  )
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export interface FilterPanelProps {
  filters: LibraryFilters
  sort: SortKey
  counts: Record<string, number>
  onFiltersChange: (patch: Partial<LibraryFilters>) => void
  onSortChange: (sort: SortKey) => void
  onReset: () => void
}

export function FilterPanel({
  filters,
  sort,
  counts,
  onFiltersChange,
  onSortChange,
  onReset,
}: FilterPanelProps) {
  const active = countActiveFilters(filters)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <SectionHeading
          hint={
            active ? (
              <button type="button" onClick={onReset} className="text-brand-300 hover:text-brand-200">
                Clear ({active})
              </button>
            ) : undefined
          }
        >
          Filters
        </SectionHeading>
        <div className="rounded-xl border border-ink-700 bg-ink-850/60 p-2">
          <Checkbox
            checked={filters.onlySaved}
            onChange={(next) => onFiltersChange({ onlySaved: next })}
            label="Only my exercises"
          />
        </div>
      </div>

      <div>
        <SectionHeading>Muscle</SectionHeading>
        <div className="space-y-0.5">
          {MUSCLE_ORDER.map((muscle: Muscle) => (
            <Checkbox
              key={muscle}
              checked={filters.muscles.includes(muscle)}
              onChange={() => onFiltersChange({ muscles: toggle(filters.muscles, muscle) })}
              label={MUSCLES[muscle].label}
              count={counts[`muscle:${muscle}`] ?? 0}
              accent={`border-transparent ${MUSCLE_ACCENT[muscle].bar.replace('bg-', 'text-')}`}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionHeading>Difficulty</SectionHeading>
        <div className="space-y-0.5">
          {DIFFICULTY_ORDER.map((level: Difficulty) => (
            <Checkbox
              key={level}
              checked={filters.difficulties.includes(level)}
              onChange={() => onFiltersChange({ difficulties: toggle(filters.difficulties, level) })}
              label={`${DIFFICULTIES[level].indicator} ${DIFFICULTIES[level].label}`}
              count={counts[`difficulty:${level}`] ?? 0}
              accent={`border-transparent ${DIFFICULTIES[level].dot} text-ink-950`}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionHeading>Movement</SectionHeading>
        <div className="space-y-0.5">
          {MOVEMENT_ORDER.map((movement: Movement) => (
            <Checkbox
              key={movement}
              checked={filters.movements.includes(movement)}
              onChange={() => onFiltersChange({ movements: toggle(filters.movements, movement) })}
              label={MOVEMENTS[movement].label}
              hint={MOVEMENTS[movement].hint}
              count={counts[`movement:${movement}`] ?? 0}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionHeading>Equipment</SectionHeading>
        <div className="space-y-0.5">
          {EQUIPMENT_ORDER.map((item: Equipment) => (
            <Checkbox
              key={item}
              checked={filters.equipment.includes(item)}
              onChange={() => onFiltersChange({ equipment: toggle(filters.equipment, item) })}
              label={EQUIPMENT[item].label}
              count={counts[`equipment:${item}`] ?? 0}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionHeading>Sort by</SectionHeading>
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as SortKey)}
          className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {SORT_LABELS[key]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function MobileFilterButton({ active, onClick }: { active: number; onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="lg:hidden">
      <IconFilter />
      Filters
      {active > 0 && (
        <span className="ml-0.5 rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-white">{active}</span>
      )}
    </Button>
  )
}
