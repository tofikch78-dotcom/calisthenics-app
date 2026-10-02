import { getExercise } from '../data'
import { formatDateKey, formatDuration, relativeDay } from '../lib/dates'
import { DAY_STATUS_META, sessionStats } from '../lib/stats'
import type { Exercise, WorkoutSession } from '../types'
import { IconNote, Pill, ProgressBar, Sheet } from './kit'

/**
 * A finished workout, read-only.
 *
 * The runner only ever showed a live session, so opening a completed or partial
 * one from History used to be a dead end — the user was dropped on the Today tab
 * with no view of the session they had just tapped. This shows the whole thing:
 * every set, what was actually done, what was skipped, and the notes, which is
 * what "the completed workout shows up in History" has to mean if the entry is
 * worth tapping at all.
 */
export function SessionReview({
  session,
  onClose,
  onOpenExercise,
}: {
  session: WorkoutSession
  onClose: () => void
  /** Opens the exercise detail, for looking a movement up mid-review. */
  onOpenExercise?: (exercise: Exercise) => void
}) {
  const stats = sessionStats(session)
  const status = DAY_STATUS_META[
    session.status === 'completed' ? 'completed' : session.status === 'partial' ? 'partial' : 'skipped'
  ]

  return (
    <Sheet title={session.workoutName} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill className={status.chip}>
            {status.indicator} {session.status}
          </Pill>
          <span className="text-[11px] text-mist-400">
            {relativeDay(session.date)} · {formatDateKey(session.date)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-ink-700 bg-ink-850/70 px-3 py-2.5">
            <div className="tnum text-lg leading-none font-bold text-mist-100">
              {formatDuration(session.durationSec ?? 0)}
            </div>
            <div className="mt-1 text-[10px] text-mist-400">Duration</div>
          </div>
          <div className="rounded-xl border border-ink-700 bg-ink-850/70 px-3 py-2.5">
            <div className="tnum text-lg leading-none font-bold text-mist-100">{stats.setsDone}</div>
            <div className="mt-1 text-[10px] text-mist-400">Sets done</div>
          </div>
          <div className="rounded-xl border border-ink-700 bg-ink-850/70 px-3 py-2.5">
            <div className="tnum text-lg leading-none font-bold text-mist-100">{stats.reps}</div>
            <div className="mt-1 text-[10px] text-mist-400">Reps</div>
          </div>
          <div className="rounded-xl border border-ink-700 bg-ink-850/70 px-3 py-2.5">
            <div className="tnum text-lg leading-none font-bold text-mist-100">
              {stats.holdSec}s
            </div>
            <div className="mt-1 text-[10px] text-mist-400">Hold time</div>
          </div>
        </div>

        <ProgressBar
          value={stats.completion}
          tone={stats.completion === 100 ? 'ok' : stats.setsDone ? 'warn' : 'bad'}
          label="Session completion"
        />

        {session.feel && (
          <p className="text-xs text-mist-300">
            Felt <span className="font-semibold text-mist-100">{session.feel}</span>
          </p>
        )}

        <ul className="space-y-3">
          {session.items.map((item) => {
            const exercise = getExercise(item.exerciseId)
            if (!exercise) return null
            const done = item.sets.filter((set) => set.status === 'done').length
            return (
              <li
                key={item.id}
                className={`rounded-2xl border p-3.5 ${
                  item.status === 'skipped'
                    ? 'border-rose-glow/25 opacity-80'
                    : item.status === 'completed'
                      ? 'border-lime-glow/30'
                      : 'border-ink-700'
                }`}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  {onOpenExercise ? (
                  <button
                    type="button"
                    onClick={() => onOpenExercise(exercise)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-mist-100 transition hover:text-brand-300"
                  >
                    {exercise.name}
                  </button>
                ) : (
                  <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-mist-100">
                    {exercise.name}
                  </h3>
                )}
                  <Pill className={item.status === 'skipped' ? DAY_STATUS_META.skipped.chip : DAY_STATUS_META[dayStatusFor(item.status)].chip}>
                    {item.status}
                  </Pill>
                </div>
                <p className="tnum mt-0.5 text-[11px] text-mist-400">
                  {done}/{item.sets.length} sets
                  {item.targetRestSec ? ` · rest ${item.targetRestSec}s` : ''}
                </p>

                {/*
                    * The sets exactly as filed, in order, including skipped ones.
                    * Editing is deliberately not offered here: this is a record of
                    * what happened, and a past session that can be rewritten is a
                    * past session that can be quietly changed.
                  */}
                <ul className="tnum mt-2 space-y-1">
                  {item.sets.map((set, index) => (
                    <li
                      key={index}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] ${
                        set.status === 'done'
                          ? 'bg-ink-800/70 text-mist-200'
                          : set.status === 'skipped'
                            ? 'bg-rose-glow/5 text-mist-500 line-through'
                            : 'bg-ink-850/60 text-mist-500'
                      }`}
                    >
                      <span>Set {index + 1}</span>
                      <span>
                        {set.reps ? `${set.reps} reps` : ''}
                        {set.holdSec ? `${set.holdSec}s hold` : ''}
                        {set.weight ? ` · ${set.weight}kg` : ''}
                        {set.status !== 'done' ? ` · ${set.status}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>

                {item.note && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-mist-400">
                    <IconNote className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="min-w-0">{item.note}</span>
                  </p>
                )}
              </li>
            )
          })}
        </ul>

        {session.notes && (
          <p className="flex items-start gap-1.5 rounded-xl border border-ink-700 bg-ink-850/60 p-3 text-xs text-mist-300">
            <IconNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" />
            <span className="min-w-0 italic">“{session.notes}”</span>
          </p>
        )}
      </div>
    </Sheet>
  )
}

/** Session item statuses reuse the day-status chip vocabulary. */
function dayStatusFor(status: string): 'completed' | 'partial' | 'skipped' {
  if (status === 'completed') return 'completed'
  if (status === 'skipped') return 'skipped'
  return 'partial'
}