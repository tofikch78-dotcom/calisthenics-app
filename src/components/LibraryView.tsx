import { useCallback, useMemo, useState } from 'react'
import { LIBRARY } from '../data'
import {
  EMPTY_FILTERS,
  countActiveFilters,
  queryLibrary,
  type LibraryFilters,
  type SortKey,
} from '../lib/search'
import type { Exercise } from '../types'
import { useEscape } from '../lib/use-escape'
import { ExerciseCard } from './ExerciseCard'
import { FilterPanel, MobileFilterButton } from './FilterPanel'
import { EmptyState, IconClose, IconSearch } from './ui'

/** Pre-computes how many exercises match each individual facet value. */
function buildFacetCounts(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const exercise of LIBRARY) {
    counts[`difficulty:${exercise.difficulty}`] = (counts[`difficulty:${exercise.difficulty}`] ?? 0) + 1
    counts[`movement:${exercise.movement}`] = (counts[`movement:${exercise.movement}`] ?? 0) + 1
    const muscles = new Set([exercise.mainMuscle, ...exercise.secondaryMuscles])
    for (const muscle of muscles) {
      counts[`muscle:${muscle}`] = (counts[`muscle:${muscle}`] ?? 0) + 1
    }
    for (const item of new Set(exercise.equipment)) {
      counts[`equipment:${item}`] = (counts[`equipment:${item}`] ?? 0) + 1
    }
  }
  return counts
}

const SEARCH_SUGGESTIONS = ['chest', 'back', 'shoulders', 'beginner', 'no equipment', 'planche']

export interface LibraryViewProps {
  savedIds: ReadonlySet<string>
  onToggleSave: (id: string) => void
  onOpen: (exercise: Exercise) => void
}

export function LibraryView({ savedIds, onToggleSave, onOpen }: LibraryViewProps) {
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>('name')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const counts = useMemo(() => buildFacetCounts(), [])
  const closeMobileFilters = useCallback(() => setMobileFiltersOpen(false), [])
  useEscape(closeMobileFilters)
  const results = useMemo(
    () => queryLibrary({ ...filters, sort }, savedIds),
    [filters, sort, savedIds],
  )
  const activeCount = countActiveFilters(filters)

  const patch = (next: Partial<LibraryFilters>) => setFilters((current) => ({ ...current, ...next }))
  const reset = () => setFilters(EMPTY_FILTERS)

  const filterPanel = (
    <FilterPanel
      filters={filters}
      sort={sort}
      counts={counts}
      onFiltersChange={patch}
      onSortChange={setSort}
      onReset={reset}
    />
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[248px_1fr]">
      {/* Desktop filter rail */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 scrollbar-slim">
          {filterPanel}
        </div>
      </aside>

      <div>
        <div className="mb-4">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3.5 h-4.5 w-4.5 -translate-y-1/2 text-mist-400" />
            <input
              type="search"
              value={filters.query}
              onChange={(event) => patch({ query: event.target.value })}
              placeholder="Search exercises — try “push”, “chest” or “beginner”…"
              className="w-full rounded-xl border border-ink-600 bg-ink-850/80 py-3 pr-10 pl-11 text-sm text-mist-100 placeholder:text-ink-500 focus:border-brand-400/70 focus:bg-ink-850 focus:outline-none"
            />
            {filters.query && (
              <button
                type="button"
                onClick={() => patch({ query: '' })}
                aria-label="Clear search"
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-mist-400 transition hover:bg-ink-800 hover:text-white"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {!filters.query && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-mist-400">Try:</span>
              {SEARCH_SUGGESTIONS.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => patch({ query: term })}
                  className="min-h-11 rounded-md border border-ink-600/80 px-2 py-0.5 text-[11px] text-mist-300 transition hover:border-brand-400/50 hover:text-brand-300"
                >
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-mist-400">
            <span className="font-semibold text-mist-100">{results.length}</span>{' '}
            {results.length === 1 ? 'exercise' : 'exercises'}
            {activeCount > 0 && ' match your filters'}
          </p>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={reset}
                className="text-xs text-brand-300 transition hover:text-brand-200"
              >
                Clear all filters
              </button>
            )}
            <MobileFilterButton active={activeCount} onClick={() => setMobileFiltersOpen(true)} />
          </div>
        </div>

        {results.length === 0 ? (
          <EmptyState
            icon={<IconSearch className="h-6 w-6" />}
            title="No exercises match those filters"
            description="Try removing a filter, or search for a muscle like “chest”, “back”, “shoulders” or a skill like “planche”."
            action={
              <button
                type="button"
                onClick={reset}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400"
              >
                Reset filters
              </button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                saved={savedIds.has(exercise.id)}
                onToggleSave={onToggleSave}
                onOpen={onOpen}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile filter sheet */}
      {mobileFiltersOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          className="fixed inset-0 z-40 flex items-end bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) setMobileFiltersOpen(false)
          }}
        >
          <div className="animate-rise max-h-[86vh] w-full overflow-y-auto rounded-t-3xl border border-ink-600 bg-ink-900 p-5 scrollbar-slim">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-mist-100">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                className="rounded-lg p-2 text-mist-400 transition hover:bg-ink-800 hover:text-white"
              >
                <IconClose />
              </button>
            </div>
            {filterPanel}
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="mt-5 w-full rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white transition hover:bg-brand-400"
            >
              Show {results.length} {results.length === 1 ? 'exercise' : 'exercises'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
