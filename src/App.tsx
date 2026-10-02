import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { CalendarView } from './components/CalendarView'
import { ExerciseDetail } from './components/ExerciseDetail'
import { ExercisePicker } from './components/ExercisePicker'
import { HistoryView } from './components/HistoryView'
import { HomeView, type Tab } from './components/HomeView'
import { InstallBanner } from './components/InstallBanner'
import { LibraryView } from './components/LibraryView'
import { MyExercisesView } from './components/MyExercisesView'
import { NutritionView } from './components/NutritionView'
import { Onboarding } from './components/Onboarding'
import { ProfileView } from './components/ProfileView'
import { ProgressView } from './components/ProgressView'
import { AddRecordSheet, RecordsView } from './components/RecordsView'
import { SessionReview } from './components/SessionReview'
import { SessionView } from './components/SessionView'
import { SkillsView } from './components/SkillsView'
import { WorkoutsView } from './components/WorkoutsView'
import { WorkoutTab } from './components/WorkoutTab'
import { todayKey } from './lib/dates'
import { computeStreak, deriveSessionStatus, recordCandidates } from './lib/stats'
import { addSessionItem, emptySession, startSession } from './lib/session'
import {
  bestFor,
  resetAllData,
  useActiveSessionId,
  useDismissedSuggestions,
  useLevelOverrides,
  useMyExercises,
  useNutrition,
  useNutritionTargets,
  useProfile,
  useRecords,
  useSessions,
  useSkillProgress,
  useTheme,
  useWeightLog,
  useWorkouts,
} from './lib/store'
import { initialTab } from './lib/pwa'
import type { Exercise, Workout, WorkoutSession } from './types'

type ExerciseTab = 'library' | 'mine' | 'skills'
type ProgressTab = 'dashboard' | 'calendar' | 'records' | 'history'
type WorkoutTabId = 'today' | 'builder'

/** Where the exercise picker should put the exercises the user picks. */
type PickerTarget = { kind: 'session'; sessionId: string }

export default function App() {
  const { profile, update: updateProfile, completeOnboarding } = useProfile()
  const { theme, setTheme } = useTheme()

  const { ids, savedIds, toggle, clear } = useMyExercises()
  const { workouts, saveWorkout, deleteWorkout, duplicateWorkout } = useWorkouts()
  const { sessions, addSession, updateSession, editSession, deleteSession } = useSessions()
  const { records, addRecord, deleteRecord } = useRecords()
  const { days, updateDay, addMeal, updateMeal, deleteMeal } = useNutrition()
  const { targets, setTargets } = useNutritionTargets()
  const { entries: weightLog, logWeight, deleteWeight } = useWeightLog()
  const { progress: skillProgress, setStage } = useSkillProgress()
  const { overrides, setOverride } = useLevelOverrides()
  const { dismissed, dismiss } = useDismissedSuggestions()

  // Deep-linked by the manifest shortcuts (`/?tab=nutrition`), home otherwise.
  const [tab, setTab] = useState<Tab>(() => initialTab())
  const [exerciseTab, setExerciseTab] = useState<ExerciseTab>('library')
  const [progressTab, setProgressTab] = useState<ProgressTab>('dashboard')
  const [workoutTab, setWorkoutTab] = useState<WorkoutTabId>('today')

  const [detail, setDetail] = useState<Exercise | null>(null)
  const [picker, setPicker] = useState<PickerTarget | null>(null)
  // A finished session opened from History, read-only.
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null)
  // Persisted, so reopening the app lands back on the workout in progress
  // instead of on Home with the work safely stored but nothing pointing at it.
  const [activeSessionId, setActiveSessionId] = useActiveSessionId()
  const [openSkillId, setOpenSkillId] = useState<string | null>(null)
  const [addRecordOpen, setAddRecordOpen] = useState(false)
  const [seedExerciseIds, setSeedExerciseIds] = useState<string[]>([])
  const [openWorkoutId, setOpenWorkoutId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null
  const liveSession = activeSession?.status === 'in-progress' ? activeSession : null
  const streak = useMemo(() => computeStreak(sessions, profile, workouts), [sessions, profile, workouts])

  /**
   * Keeps the tab on the workout while one is running.
   *
   * Recovery used to mean landing on Home and finding a Resume card, which is
   * easy to miss mid-session and impossible if the session was started before
   * midnight — Home and Today both only look at today's sessions. Reopening the
   * app while a session is in progress now returns to it directly, and the
   * elapsed clock is derived from `startedAt`, so the time worked before the
   * reload is still counted.
   */
  const restoredForSession = useRef(false)
  useEffect(() => {
    if (!liveSession) {
      restoredForSession.current = false
      return
    }
    if (restoredForSession.current) return
    restoredForSession.current = true
    setWorkoutTab('today')
    setTab('workout')
  }, [liveSession])

  /* ── Actions ─────────────────────────────────────────────────────────── */

  const notify = useCallback((text: string) => {
    setToast(text)
    window.setTimeout(() => setToast(null), 3400)
  }, [])

  /**
   * Opens a session.
   *
   * An in-progress one goes back into the runner. A finished one could not: the
   * runner only ever rendered a live session, so tapping a workout in History
   * used to drop the user on the Today tab with no sign of the session they
   * asked for, and the per-set detail was unreachable. Those open as a
   * read-only review sheet instead.
   */
  const openSession = useCallback(
    (session: WorkoutSession) => {
      if (session.status === 'in-progress') {
        setReviewSessionId(null)
        setActiveSessionId(session.id)
        setWorkoutTab('today')
        setTab('workout')
        return
      }
      setReviewSessionId(session.id)
    },
    [setActiveSessionId],
  )

  const reviewSession = sessions.find((session) => session.id === reviewSessionId) ?? null

  const startWorkout = useCallback(
    (workout: Workout) => {
      if (!workout.items.length) {
        notify('Add exercises to that workout before starting it.')
        return
      }
      const session = startSession(workout, todayKey())
      addSession(session)
      setActiveSessionId(session.id)
      setWorkoutTab('today')
      setTab('workout')
    },
    [addSession, notify, setActiveSessionId],
  )

  const startFreestyle = useCallback(() => {
    const session = emptySession()
    addSession(session)
    setActiveSessionId(session.id)
    setWorkoutTab('today')
    setTab('workout')
  }, [addSession, setActiveSessionId])

  const finishSession = useCallback(
    (session: WorkoutSession) => {
      const finished: WorkoutSession = {
        ...session,
        status: deriveSessionStatus(session),
        completedAt: Date.now(),
        durationSec: Math.max(1, Math.round((Date.now() - session.startedAt) / 1000)),
      }
      updateSession(finished.id, {
        status: finished.status,
        completedAt: finished.completedAt,
        durationSec: finished.durationSec,
      })
      setActiveSessionId(null)

      // Records come only from work that was actually logged, so a personal
      // best can never be invented by merely opening the app.
      let beaten = 0
      for (const candidate of recordCandidates(finished)) {
        const counted = addRecord({
          exerciseId: candidate.exerciseId,
          metric: candidate.metric,
          value: candidate.value,
          sessionId: finished.id,
          achievedAt: finished.completedAt,
        })
        if (counted) beaten += 1
      }

      if (finished.status === 'skipped') notify('Filed as a skipped day.')
      else if (beaten)
        notify(`🎉 ${beaten === 1 ? 'New personal record' : `${beaten} new personal records`} — ${finished.workoutName} saved.`)
      else notify(`${finished.workoutName} saved as ${finished.status}.`)
    },
    [addRecord, notify, setActiveSessionId, updateSession],
  )

  const discardSession = useCallback(
    (session: WorkoutSession) => {
      deleteSession(session.id)
      setActiveSessionId(null)
      notify('Session discarded — nothing was saved.')
    },
    [deleteSession, notify, setActiveSessionId],
  )

  const goToProgress = useCallback((target: ProgressTab) => {
    setProgressTab(target)
    setTab('progress')
  }, [])

  const openSkill = useCallback((skillId: string) => {
    setOpenSkillId(skillId)
    setExerciseTab('skills')
    setTab('exercises')
  }, [])

  /**
   * Opens the builder on a new draft, optionally pre-loaded with exercises
   * chosen somewhere else. Nothing is written until the user saves, so being
   * sent here can never leave a half-built workout behind in My Workouts.
   */
  const openBuilderWithSeeds = useCallback((seeds: string[]) => {
    if (seeds.length) setSeedExerciseIds(seeds)
    setOpenWorkoutId(null)
    setWorkoutTab('builder')
    setTab('workout')
  }, [])

  const saveWorkoutFromBuilder = useCallback(
    (workout: Workout) => {
      const existed = workouts.some((entry) => entry.id === workout.id)
      saveWorkout(workout)
      notify(existed ? `Updated “${workout.name}”.` : `Saved “${workout.name}” to My Workouts.`)
    },
    [notify, saveWorkout, workouts],
  )

  const pickerPresentIds = useMemo(() => {
    if (!picker) return []
    return (sessions.find((session) => session.id === picker.sessionId)?.items ?? []).map(
      (item) => item.exerciseId,
    )
  }, [picker, sessions])

  const handlePick = useCallback(
    (exercise: Exercise) => {
      if (!picker) return
      const sessionId = picker.sessionId
      // Applied inside the state updater, off the stored session: picking an
      // exercise must never be computed from a list that a concurrent edit has
      // already replaced, or the new exercise overwrites the edit.
      editSession(sessionId, (current) => ({ items: [...current.items, addSessionItem(exercise)] }))
      notify(`Added ${exercise.name} to the session.`)
    },
    [editSession, notify, picker],
  )

  /* ── Onboarding gate ─────────────────────────────────────────────────── */

  if (!profile.onboarded) {
    return (
      <div className="min-h-dvh px-4 py-8">
        <Onboarding initial={null} onComplete={completeOnboarding} />
      </div>
    )
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-dvh overflow-x-clip pb-24 md:pb-10">
      <BottomNav
        active={tab}
        onChange={setTab}
        badges={{ workout: liveSession ? true : undefined }}
      />

      {/* px-safe keeps content clear of a landscape notch; pt-safe clears the
          status bar, which `viewport-fit=cover` otherwise lets us paint under. */}
      <main className="mx-auto max-w-5xl px-4 pt-safe pb-5 md:py-5">
        {tab === 'home' && (
          <HomeView
            profile={profile}
            workouts={workouts}
            sessions={sessions}
            records={records}
            streak={streak}
            activeSessionId={liveSession?.id ?? null}
            onStart={startWorkout}
            onResume={openSession}
            onGoTo={(target) => {
              if (target === 'exercises') setExerciseTab('library')
              setTab(target)
            }}
            onOpenExercise={setDetail}
            onOpenSkill={openSkill}
          />
        )}

        {tab === 'workout' && (
          <>
            <SubTabs
              value={workoutTab}
              onChange={setWorkoutTab}
              options={[
                { id: 'today', label: 'Today', dot: Boolean(liveSession) },
                { id: 'builder', label: 'My Workouts' },
              ]}
            />

            {workoutTab === 'today' &&
              (liveSession ? (
                <SessionView
                  session={liveSession}
                  onEdit={(change) => editSession(liveSession.id, change)}
                  onFinish={() => finishSession(liveSession)}
                  onDiscard={() => discardSession(liveSession)}
                  onOpenExercise={setDetail}
                  onRequestAddExercise={() =>
                    setPicker({ kind: 'session', sessionId: liveSession.id })
                  }
                />
              ) : (
                <WorkoutTab
                  workouts={workouts}
                  sessions={sessions}
                  profile={profile}
                  streak={streak}
                  onStart={startWorkout}
                  onStartFreestyle={startFreestyle}
                  onResume={openSession}
                  onOpenBuilder={(workoutId) => {
                    setOpenWorkoutId(workoutId)
                    setWorkoutTab('builder')
                    setTab('workout')
                  }}
                  onGoTo={(target) => {
                    if (target === 'builder') setWorkoutTab('builder')
                    else goToProgress('history')
                  }}
                />
              ))}

            {workoutTab === 'today' && !liveSession && (
              <button
                type="button"
                onClick={() => goToProgress('history')}
                className="mt-4 min-h-11 w-full rounded-xl border border-ink-600 py-2.5 text-xs font-medium text-mist-300 transition hover:border-brand-400/40 hover:text-brand-300"
              >
                📋 View full history &amp; weekly summary
              </button>
            )}

            {workoutTab === 'builder' && (
              <WorkoutsView
                workouts={workouts}
                savedIds={savedIds}
                onSave={saveWorkoutFromBuilder}
                onDelete={deleteWorkout}
                onDuplicate={duplicateWorkout}
                onStart={startWorkout}
                onOpenExercise={setDetail}
                seedExerciseIds={seedExerciseIds}
                onSeedConsumed={() => setSeedExerciseIds([])}
                openWorkoutId={openWorkoutId}
                onOpenConsumed={() => setOpenWorkoutId(null)}
              />
            )}
          </>
        )}

        {tab === 'exercises' && (
          <>
            <SubTabs
              value={exerciseTab}
              onChange={setExerciseTab}
              options={[
                { id: 'library', label: 'Library' },
                { id: 'mine', label: `My Exercises${ids.length ? ` (${ids.length})` : ''}` },
                { id: 'skills', label: 'Skills' },
              ]}
            />

            {exerciseTab === 'library' && (
              <LibraryView savedIds={savedIds} onToggleSave={toggle} onOpen={setDetail} />
            )}

            {exerciseTab === 'mine' && (
              <MyExercisesView
                ids={ids}
                onToggleSave={toggle}
                onOpen={setDetail}
                onClear={clear}
                onGoToLibrary={() => setExerciseTab('library')}
                onStartWorkout={openBuilderWithSeeds}
              />
            )}

            {exerciseTab === 'skills' && (
              <SkillsView
                initialSkillId={openSkillId}
                progress={skillProgress}
                onSetStage={setStage}
                onOpenExercise={setDetail}
                onOpenConsumed={() => setOpenSkillId(null)}
              />
            )}
          </>
        )}

        {tab === 'nutrition' && (
          <NutritionView
            profile={profile}
            days={days}
            targets={targets}
            onUpdateTargets={(patch) => setTargets((current) => ({ ...current, ...patch }))}
            onAddMeal={addMeal}
            onUpdateMeal={updateMeal}
            onDeleteMeal={deleteMeal}
            onUpdateDay={updateDay}
          />
        )}

        {tab === 'progress' && (
          <>
            <SubTabs
              value={progressTab}
              onChange={setProgressTab}
              options={[
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'calendar', label: 'Calendar' },
                { id: 'records', label: 'Records' },
                { id: 'history', label: 'History' },
              ]}
            />

            {progressTab === 'dashboard' && (
              <ProgressView
                sessions={sessions}
                workouts={workouts}
                profile={profile}
                records={records}
                weight={weightLog}
                overrides={overrides}
                dismissed={dismissed}
                onDismiss={dismiss}
                onLogWeight={logWeight}
                onDeleteWeight={deleteWeight}
                onOpenExercise={setDetail}
                onSetLevel={setOverride}
                onGoTo={goToProgress}
              />
            )}

            {progressTab === 'calendar' && (
              <CalendarView
                sessions={sessions}
                workouts={workouts}
                profile={profile}
                onOpenSession={openSession}
              />
            )}

            {progressTab === 'records' && (
              <RecordsView
                records={records}
                sessions={sessions}
                onDelete={deleteRecord}
                onOpenExercise={setDetail}
                onRequestAdd={() => setAddRecordOpen(true)}
              />
            )}

            {progressTab === 'history' && (
              <HistoryView
                sessions={sessions}
                workouts={workouts}
                profile={profile}
                streak={streak}
                onOpenSession={openSession}
              />
            )}
          </>
        )}

        {tab === 'profile' && (
          <ProfileView
            profile={profile}
            theme={theme}
            onTheme={setTheme}
            onUpdate={updateProfile}
            onReset={resetAllData}
            datasetSizes={[
              { label: 'Saved exercises', count: ids.length },
              { label: 'Workouts', count: workouts.length },
              { label: 'Sessions', count: sessions.length },
              { label: 'Records', count: records.length },
              { label: 'Nutrition days', count: days.length },
              { label: 'Weight entries', count: weightLog.length },
              { label: 'Skill stages', count: skillProgress.length },
              { label: 'Level overrides', count: Object.keys(overrides).length },
            ]}
          />
        )}
      </main>

      {detail && (
        <ExerciseDetail
          exercise={detail}
          saved={savedIds.has(detail.id)}
          onToggleSave={toggle}
          onClose={() => setDetail(null)}
          onOpen={setDetail}
        />
      )}

      {picker && (
        <ExercisePicker
          savedIds={savedIds}
          presentIds={pickerPresentIds}
          onPick={handlePick}
          onClose={() => setPicker(null)}
        />
      )}

      {reviewSession && (
        <SessionReview
          session={reviewSession}
          onClose={() => setReviewSessionId(null)}
          onOpenExercise={setDetail}
        />
      )}

      {addRecordOpen && (
        <AddRecordSheet
          best={(exerciseId, metric) => bestFor(records, exerciseId, metric)}
          onAdd={(entry) => {
            const counted = addRecord(entry)
            notify(
              counted
                ? '🎉 Personal record saved — the old best is kept in history.'
                : 'That did not beat your best, so nothing was changed.',
            )
            return counted
          }}
          onClose={() => setAddRecordOpen(false)}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="animate-pop fixed inset-x-0 bottom-24 z-50 mx-auto w-fit max-w-[92%] rounded-xl border border-ink-600 bg-ink-900 px-4 py-2.5 text-center text-xs font-medium text-mist-100 shadow-lg md:bottom-6"
        >
          {toast}
        </div>
      )}

      {/* Sits above the bottom nav, below the toast. */}
      <InstallBanner />
    </div>
  )
}

/* ── Shared sub-navigation ──────────────────────────────────────────────── */

function SubTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: { id: T; label: string; dot?: boolean }[]
}) {
  return (
    <div
      role="tablist"
      className="scrollbar-slim mb-4 flex gap-1 overflow-x-auto border-b border-ink-700 pb-3"
    >
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={`shrink-0 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition ${
              // min-h-11 keeps every tab a full thumb-sized target; the row
              // scrolls horizontally on narrow phones instead.
              'min-h-11 py-1.5 '
            }${
              active
                ? 'bg-brand-500/18 text-brand-300 ring-1 ring-brand-400/35'
                : 'bg-ink-850/70 text-mist-400 hover:bg-ink-800 hover:text-mist-100'
            }`}
          >
            {option.label}
            {option.dot ? (
              <span className="ml-1.5 inline-block size-1.5 rounded-full bg-lime-glow align-middle" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}


