import { useRef, useState } from 'react'
import { EQUIPMENT, LIBRARY_STATS } from '../data'
import { downloadBackup, formatBytes, readFileAsText, restoreBackup, storageFootprint } from '../lib/backup'
import { DIET_LABEL, autoTargets, goalLabel } from '../lib/nutrition'
import { Onboarding } from './Onboarding'
import { InstallCard } from './InstallCard'
import { OfflineReadinessCard } from './OfflineReadinessCard'
import {
  Card,
  IconDownload,
  IconGear,
  IconMoon,
  IconSun,
  IconUpload,
  Pill,
  ProgressBar,
  StatTile,
  Toggle,
} from './kit'
import type { Profile } from '../types'

export interface ProfileViewProps {
  profile: Profile
  theme: 'dark' | 'light'
  onTheme: (theme: 'dark' | 'light') => void
  onUpdate: (patch: Partial<Profile>) => void
  onReset: () => void
  /** A live count of everything stored, for the backup card. */
  datasetSizes: { label: string; count: number }[]
}

export function ProfileView({
  profile,
  theme,
  onTheme,
  onUpdate,
  onReset,
  datasetSizes,
}: ProfileViewProps) {
  const [editing, setEditing] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetConfirm, setResetConfirm] = useState('')
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const footprint = storageFootprint()
  const targets = autoTargets(profile)

  const importFile = async (file: File) => {
    try {
      const text = await readFileAsText(file)
      const result = restoreBackup(text)
      setMessage({ tone: result.ok ? 'ok' : 'bad', text: result.message })
      if (result.ok) window.setTimeout(() => window.location.reload(), 900)
    } catch (error) {
      console.warn('[backup] import failed', error)
      setMessage({ tone: 'bad', text: 'Could not read that file.' })
    }
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-mist-400 transition hover:text-mist-100"
        >
          ← Back to profile
        </button>
        <Onboarding
          initial={profile}
          onComplete={(next) => {
            onUpdate(next)
            setEditing(false)
            setMessage({ tone: 'ok', text: 'Profile saved. Targets and levels recalculated.' })
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">{profile.name || 'Your profile'}</h2>
            <p className="mt-0.5 text-xs text-mist-400">
              {profile.age ? `${profile.age} yrs` : 'Age not set'}
              {profile.heightCm ? ` · ${profile.heightCm} cm` : ''}
              {profile.weightKg ? ` · ${profile.weightKg} kg` : ''} · {profile.level} ·{' '}
              {DIET_LABEL[profile.diet]}
            </p>
            <p className="mt-1 flex flex-wrap gap-1.5">
              {profile.goals.map((goal) => (
                <Pill key={goal} className="bg-ink-800 text-mist-200 ring-ink-600">
                  {goalLabel(goal)}
                </Pill>
              ))}
              {!profile.goals.length && <span className="text-[11px] text-mist-500">No goals set</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-brand-400/40 px-3 py-1.5 text-xs font-semibold text-brand-300 transition hover:bg-brand-500/10"
          >
            <IconGear className="h-3.5 w-3.5" /> Edit profile
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile value={profile.daysPerWeek} label="Days per week" />
          <StatTile value={`${profile.sessionMinutes}m`} label="Session length" />
          <StatTile value={profile.maxPullups ?? 0} label="Max pull-ups" />
          <StatTile value={profile.maxPushups ?? 0} label="Max push-ups" />
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-[10px] tracking-wide text-mist-400 uppercase">Your equipment</p>
          <p className="flex flex-wrap gap-1.5">
            {profile.equipment.map((item) => (
              <Pill key={item} className="bg-brand-400/12 text-brand-300 ring-brand-400/25">
                {EQUIPMENT[item].label}
              </Pill>
            ))}
          </p>
          <p className="mt-3 text-[10px] tracking-wide text-mist-400 uppercase">Preferred days</p>
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            {profile.preferredDays.length ? (
              profile.preferredDays.map((day) => (
                <Pill key={day} className="bg-ink-800 text-mist-200 ring-ink-600">
                  {day.slice(0, 3)}
                </Pill>
              ))
            ) : (
              <span className="text-[11px] text-mist-500">Not set — any day counts.</span>
            )}
          </p>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-mist-100">Appearance</h3>
        <div className="mt-2.5">
          <Toggle
            checked={theme === 'dark'}
            onChange={(next) => onTheme(next ? 'dark' : 'light')}
            label="Dark mode"
            description={
              theme === 'dark'
                ? 'Currently dark — switch to light for a brighter interface.'
                : 'Currently light — switch back to dark.'
            }
          />
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-mist-400">
          {theme === 'dark' ? <IconMoon className="h-3.5 w-3.5" /> : <IconSun className="h-3.5 w-3.5" />}
          Switch instantly — no reload, no system setting to change.
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-mist-100">Current targets</h3>
        <p className="mt-0.5 text-xs text-mist-400">
          Auto-calculated from your profile. Change them on the Nutrition tab.
        </p>
        <div className="tnum mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            [
              ['Calories', `${targets.kcal} kcal`],
              ['Protein', `${targets.protein} g`],
              ['Carbs', `${targets.carbs} g`],
              ['Fat', `${targets.fat} g`],
              ['Water', `${(targets.waterMl / 1000).toFixed(1)} L`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-ink-700 bg-ink-850/70 p-2.5 text-center">
              <div className="tnum text-sm font-bold text-mist-100">{value}</div>
              <div className="mt-0.5 text-[10px] text-mist-400">{label}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-mist-500">
          These are training estimates, not medical advice. Talk to a professional before making big
          dietary changes.
        </p>
      </Card>

      <InstallCard />

      <OfflineReadinessCard />

      <Card>
        <h3 className="text-sm font-semibold text-mist-100">Backup &amp; restore</h3>
        <p className="mt-0.5 text-xs text-mist-400">
          Everything lives in this browser&apos;s local storage — no account, no server. Export a JSON
          file to move it or keep a safe copy.
        </p>

        <div className="mt-3 space-y-1.5">
          {datasetSizes.map((entry) => (
            <div key={entry.label} className="flex items-center gap-2.5">
              <span className="w-32 shrink-0 text-[11px] text-mist-400">{entry.label}</span>
              <span className="min-w-0 flex-1">
                <ProgressBar
                  value={datasetSizes[0].count ? (entry.count / datasetSizes[0].count) * 100 : 0}
                  tone="muted"
                  label={entry.label}
                />
              </span>
              <span className="tnum w-14 shrink-0 text-right text-[11px] text-mist-200">{entry.count}</span>
            </div>
          ))}
        </div>

        <p className="tnum mt-2 text-[11px] text-mist-500">
          {footprint.keys} datasets · ~{formatBytes(footprint.bytes)} · {LIBRARY_STATS.total} exercises built in
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              downloadBackup()
              setMessage({ tone: 'ok', text: 'Backup file downloaded.' })
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-400"
          >
            <IconDownload className="h-3.5 w-3.5" /> Export JSON
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-ink-600 px-3 py-2.5 text-xs font-semibold text-mist-200 transition hover:border-brand-400/40 hover:text-brand-300"
          >
            <IconUpload className="h-3.5 w-3.5" /> Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importFile(file)
              event.target.value = ''
            }}
          />
        </div>

        {message && (
          <p
            className={`mt-2.5 rounded-lg px-3 py-2 text-[11px] ${
              message.tone === 'ok'
                ? 'bg-lime-glow/10 text-lime-glow'
                : 'bg-rose-glow/10 text-rose-glow'
            }`}
          >
            {message.text}
          </p>
        )}
      </Card>

      <Card className="border-rose-glow/25">
        <h3 className="text-sm font-semibold text-rose-glow">Reset everything</h3>
        <p className="mt-0.5 text-xs text-mist-400">
          Wipes your profile, workouts, sessions, history, records, nutrition and progress from this
          browser. The exercise library itself is part of the app and stays.
        </p>

        {!resetOpen ? (
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="mt-3 min-h-11 rounded-lg border border-rose-glow/35 px-3.5 py-2 text-xs font-semibold text-rose-glow transition hover:bg-rose-glow/10"
          >
            Reset all data
          </button>
        ) : (
          <div className="mt-3 rounded-xl border border-rose-glow/30 bg-rose-glow/5 p-3">
            <p className="text-xs text-mist-300">
              Type <span className="font-bold text-white">RESET</span> to confirm. Export a backup first if
              you want one.
            </p>
            <input
              value={resetConfirm}
              onChange={(event) => setResetConfirm(event.target.value)}
              placeholder="RESET"
              aria-label="Type RESET to confirm"
              className="mt-2 w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm tracking-widest text-mist-100 uppercase focus:border-rose-glow/50 focus:outline-none"
            />
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetOpen(false)
                  setResetConfirm('')
                }}
                className="flex-1 rounded-lg border border-ink-600 py-2 text-xs font-medium text-mist-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onReset}
                disabled={resetConfirm.trim().toUpperCase() !== 'RESET'}
                className="flex-1 rounded-lg bg-rose-glow py-2 text-xs font-semibold text-ink-950 transition hover:brightness-110 disabled:bg-ink-700 disabled:text-ink-500"
              >
                Erase everything
              </button>
            </div>
          </div>
        )}
      </Card>

      <p className="pb-2 text-center text-[10px] text-mist-500">
        Offline-first · No login · No server · Your data never leaves this device
      </p>
    </div>
  )
}
