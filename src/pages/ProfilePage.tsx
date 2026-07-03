/**
 * ProfilePage — personal dashboard for the currently logged-in user.
 *
 * Resolved from useAuthStore().userId → the matching Member in the store.
 * Redirects to "/" if the userId doesn't match any member (shouldn't happen
 * under normal auth, but guards against stale sessions).
 *
 * Sections (top to bottom):
 *   1. Identity card — avatar, name, role, teams, capacity, discipline editor
 *   2. Stats row     — total/active/complete epics + capacity %
 *   3. Pulse widget  — current week's pulse + 6-week sentiment sparkline
 *   4. My Epics      — compact list of the user's projects, active-first
 *
 * IMPORTANT: All hooks are called before the early return so we never
 * violate React's Rules of Hooks.  useMemo callbacks guard against
 * `member` being undefined on the first render pass.
 */

import { useState, useMemo } from 'react'
import { Navigate, Link } from 'react-router-dom'
import {
  Briefcase, Users, CheckCircle, Activity,
  Plus, X, ChevronDown, ExternalLink,
} from 'lucide-react'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useAuthStore } from '@/store/useAuthStore'
import { avatarColor, STATUS_COLORS, PHASE_COLORS } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { StatCard } from '@/components/ui/stat-card'
import {
  PulseEditDialog,
  formatWeekOf,
  SENTIMENT_COLORS,
  SENTIMENT_LABELS,
  MOOD_COLORS,
  MOOD_EMOJI,
} from '@/components/pulse/PulseEditDialog'
import type { WeeklyPulse } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the ISO date string for the Monday of the "relevant" week.
 * Mon–Thu → this week's Monday (currently in the week).
 * Fri–Sun → next week's Monday (Friday is prep time for the coming week).
 * Matches the same logic as PulsePage's getDefaultWeekOf.
 */
function getCurrentWeekOf(): string {
  const today = new Date()
  const day = today.getDay() // 0=Sun, 1=Mon, …, 6=Sat
  const daysToMonday = day === 0 ? 1 : day <= 4 ? 1 - day : 8 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysToMonday)
  return monday.toISOString().slice(0, 10)
}

/** Short date label for sparkline axis: "Jun 2", "Jun 9", etc. */
function shortWeekLabel(weekOf: string): string {
  const d = new Date(weekOf + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Page component ───────────────────────────────────────────────────────────

export function ProfilePage() {
  // ── All hooks must come before any conditional return (Rules of Hooks) ───
  const { userId } = useAuthStore()
  const members       = usePortfolioStore(s => s.members)
  const teams         = usePortfolioStore(s => s.teams)
  const projects      = usePortfolioStore(s => s.projects)
  const weeklyPulses  = usePortfolioStore(s => s.weeklyPulses)
  const updateMember  = usePortfolioStore(s => s.updateMember)
  const addPulse      = usePortfolioStore(s => s.addPulse)
  const updatePulse   = usePortfolioStore(s => s.updatePulse)
  // User-configurable discipline list (managed in Settings → Disciplines).
  const allDisciplines = usePortfolioStore(s => s.disciplines)

  // UI state — must be before any early return.
  const [disciplineOpen, setDisciplineOpen] = useState(false)
  const [pulseDialogOpen, setPulseDialogOpen] = useState(false)

  // Resolve the logged-in member from the store.  May be undefined if the
  // userId doesn't match (e.g. stale session).  The guard is applied after
  // all hooks so no Rules of Hooks violation occurs.
  const member = members.find(m => m.id === userId)

  const weekOf = getCurrentWeekOf()

  // Projects for this member, sorted "In Progress" first then by target date.
  // Guard inside the callback: member may be undefined before the early return.
  const myProjects = useMemo(() => {
    if (!member) return []
    const projectSet = new Set(member.projectIds)
    return projects
      .filter(p => projectSet.has(p.id))
      .sort((a, b) => {
        const aRank = a.status === 'In Progress' ? 0 : 1
        const bRank = b.status === 'In Progress' ? 0 : 1
        if (aRank !== bRank) return aRank - bRank
        return (a.targetEndDate ?? '').localeCompare(b.targetEndDate ?? '')
      })
  }, [projects, member])

  // Most recent previous pulse — used by PulseEditDialog for "Copy from last week".
  const previousPulse = useMemo(() =>
    weeklyPulses
      .filter(p => p.memberId === userId && p.weekOf < weekOf)
      .sort((a, b) => b.weekOf.localeCompare(a.weekOf))[0],
    [weeklyPulses, userId, weekOf],
  )

  // Last 6 weeks in chronological order for the sentiment sparkline.
  const recentPulses = useMemo(() =>
    weeklyPulses
      .filter(p => p.memberId === userId)
      .sort((a, b) => b.weekOf.localeCompare(a.weekOf))
      .slice(0, 6)
      .reverse(),
    [weeklyPulses, userId],
  )

  // ── Guard — redirect if member not found ─────────────────────────────────
  // Must be after all hook calls above.
  if (!member) return <Navigate to="/" replace />

  // ── Derived values — member is guaranteed non-null from this point ────────

  // Avatar color consistent with the rest of the app.
  const { bg: avBg, text: avText } = avatarColor(member.name)

  // Teams this member belongs to (may span multiple).
  const memberTeams = teams.filter(t => member.teamIds.includes(t.id))

  // Capacity bar color — mirrors the thresholds used on RosterPage/OrgPage.
  const capacityBarColor =
    member.capacity > 100 ? 'bg-red-500' :
    member.capacity > 80  ? 'bg-amber-400' :
    'bg-emerald-500'

  const activeCount   = myProjects.filter(p => p.status === 'In Progress').length
  const completeCount = myProjects.filter(p => p.status === 'Complete').length
  const EPICS_LIMIT   = 10

  // Current week's pulse for this user (undefined if not yet submitted).
  const thisWeekPulse = weeklyPulses.find(
    p => p.memberId === userId && p.weekOf === weekOf,
  )

  // Discipline helpers — safe because member is narrowed above.
  const currentDisciplines   = member.discipline ?? []
  // Show only disciplines from the store list that aren't already assigned.
  const availableDisciplines = allDisciplines.filter(
    d => !currentDisciplines.includes(d),
  )

  // Arrow functions (not function declarations) so TypeScript's control-flow
  // narrowing from the `if (!member) return` guard above is preserved inside
  // the closures.  Function declarations are hoisted and lose the narrowing.

  /** Remove a discipline chip and persist immediately. */
  const removeDiscipline = (d: string) => {
    updateMember(member.id, { discipline: currentDisciplines.filter(x => x !== d) })
  }

  /** Add a discipline from the dropdown and close it. */
  const addDiscipline = (d: string) => {
    updateMember(member.id, { discipline: [...currentDisciplines, d] })
    setDisciplineOpen(false)
  }

  /** Save a pulse (add or update depending on whether this week has an entry). */
  const handlePulseSave = (data: Omit<WeeklyPulse, 'id' | 'updatedAt'>) => {
    if (thisWeekPulse) {
      updatePulse(thisWeekPulse.id, data)
    } else {
      addPulse(data)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Profile</h1>

      {/* ── 1. Identity card ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row gap-5">

          {/* Avatar */}
          <div className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 self-start',
            avBg, avText,
          )}>
            {member.avatarInitials}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Name + role */}
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{member.name}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{member.role}</p>
            </div>

            {/* Meta row: teams · reports to · employment type */}
            <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
              {memberTeams.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users size={13} className="shrink-0" />
                  {memberTeams.map(t => t.name).join(', ')}
                </span>
              )}
              {member.reportsTo && (
                <span className="flex items-center gap-1">
                  <Briefcase size={13} className="shrink-0" />
                  Reports to {member.reportsTo}
                </span>
              )}
              {member.employmentType && (
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium border',
                  member.employmentType === 'Contractor'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200',
                )}>
                  {member.employmentType}
                </span>
              )}
            </div>

            {/* Capacity bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Capacity</span>
                <span className={cn(
                  'font-semibold',
                  member.capacity > 100 ? 'text-red-600' :
                  member.capacity > 80  ? 'text-amber-600' : 'text-slate-700',
                )}>
                  {member.capacity}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', capacityBarColor)}
                  style={{ width: `${Math.min(member.capacity, 100)}%` }}
                />
              </div>
            </div>

            {/* Discipline editor — inline chip add/remove, saves immediately */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Disciplines</p>
              <div className="flex flex-wrap items-center gap-2">
                {/* Current discipline chips with remove (×) button */}
                {currentDisciplines.map(d => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                  >
                    {d}
                    <button
                      onClick={() => removeDiscipline(d)}
                      className="text-indigo-400 hover:text-indigo-700 transition-colors ml-0.5"
                      aria-label={`Remove ${d}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}

                {/* Add discipline dropdown — only shown when disciplines remain to pick */}
                {availableDisciplines.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setDisciplineOpen(o => !o)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                    >
                      <Plus size={11} />
                      Add
                      <ChevronDown size={11} />
                    </button>
                    {disciplineOpen && (
                      <>
                        {/* Full-screen invisible backdrop — clicking outside closes the dropdown */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setDisciplineOpen(false)}
                        />
                        <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[180px]">
                          {availableDisciplines.map(d => (
                            <button
                              key={d}
                              onClick={() => addDiscipline(d)}
                              className="block w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {currentDisciplines.length === 0 && availableDisciplines.length === 0 && (
                  <span className="text-xs text-slate-400 italic">No disciplines defined</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Stats row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Epics"
          value={myProjects.length}
          icon={<Briefcase size={18} />}
          iconColor="bg-slate-100 text-slate-600"
        />
        <StatCard
          label="Active"
          value={activeCount}
          icon={<Activity size={18} />}
          iconColor="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Complete"
          value={completeCount}
          icon={<CheckCircle size={18} />}
          iconColor="bg-green-50 text-green-600"
        />
        <StatCard
          label="Capacity"
          value={`${member.capacity}%`}
          icon={<Users size={18} />}
          iconColor={
            member.capacity > 100 ? 'bg-red-50 text-red-600' :
            member.capacity > 80  ? 'bg-amber-50 text-amber-600' :
            'bg-emerald-50 text-emerald-600'
          }
          cardTint={
            member.capacity > 100 ? 'border-red-200 bg-red-50/30' :
            member.capacity > 80  ? 'border-amber-200 bg-amber-50/30' :
            undefined
          }
        />
      </div>

      {/* ── 3. Weekly Pulse widget ───────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Weekly Pulse
          </h2>
          {/* Link to the full pulse page for history / team view */}
          <Link
            to="/pulse"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
          >
            View all <ExternalLink size={11} />
          </Link>
        </div>

        {/* Current week card */}
        {thisWeekPulse ? (
          // Pulse exists — show compact summary with an Edit button
          <div className={cn(
            'rounded-lg border px-4 py-3 space-y-2',
            SENTIMENT_COLORS[thisWeekPulse.workloadSentiment].bg,
          )}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className={cn('text-sm font-semibold', SENTIMENT_COLORS[thisWeekPulse.workloadSentiment].text)}>
                  {thisWeekPulse.workloadSentiment} — {SENTIMENT_LABELS[thisWeekPulse.workloadSentiment]}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{formatWeekOf(weekOf)}</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Mood badge — only rendered when a mood level was submitted */}
                {thisWeekPulse.moodSentiment && (
                  <div
                    title={thisWeekPulse.moodNote ? `Mood: ${thisWeekPulse.moodNote}` : undefined}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border',
                      MOOD_COLORS[thisWeekPulse.moodSentiment].bg,
                      MOOD_COLORS[thisWeekPulse.moodSentiment].text,
                    )}
                  >
                    <span>{MOOD_EMOJI[thisWeekPulse.moodSentiment]}</span>
                    {thisWeekPulse.moodNote && (
                      <span className="max-w-[120px] truncate">{thisWeekPulse.moodNote}</span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setPulseDialogOpen(true)}
                  className="text-xs px-3 py-1.5 rounded-md border border-current text-slate-600 hover:bg-white/60 transition-colors font-medium"
                >
                  Edit
                </button>
              </div>
            </div>
            {/* Top priorities preview — up to 3 */}
            {thisWeekPulse.currentPriorities.filter(p => p.text).slice(0, 3).length > 0 && (
              <ul className="space-y-0.5">
                {thisWeekPulse.currentPriorities
                  .filter(p => p.text)
                  .slice(0, 3)
                  .map((p, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="text-slate-400">{i + 1}.</span>
                      <span className="truncate">{p.text}</span>
                      {p.size && (
                        <span className="shrink-0 px-1 rounded bg-white/60 text-slate-500 font-medium text-[10px]">
                          {p.size}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        ) : (
          // No pulse yet this week — show add prompt
          <button
            onClick={() => setPulseDialogOpen(true)}
            className="w-full rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors py-6 flex flex-col items-center gap-2 text-slate-400 hover:text-blue-600"
          >
            <Plus size={20} />
            <span className="text-sm font-medium">Add this week's pulse</span>
            <span className="text-xs">{formatWeekOf(weekOf)}</span>
          </button>
        )}

        {/* History sparkline — last 6 weeks, oldest left to newest right.
            Two rows: mood emoji above, workload dot below, date label at bottom. */}
        {recentPulses.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-2">Last {recentPulses.length} weeks</p>
            <div className="flex items-end gap-3">
              {recentPulses.map(p => {
                const col = SENTIMENT_COLORS[p.workloadSentiment]
                const moodLevel = p.moodSentiment
                return (
                  <div key={p.id} className="flex flex-col items-center gap-1">
                    {/* Mood emoji — transparent placeholder keeps alignment when absent */}
                    {moodLevel ? (
                      <span
                        title={`Mood: ${MOOD_EMOJI[moodLevel]}${p.moodNote ? ' — ' + p.moodNote : ''}`}
                        className="text-base leading-none"
                      >
                        {MOOD_EMOJI[moodLevel]}
                      </span>
                    ) : (
                      <span className="text-base leading-none opacity-0">–</span>
                    )}
                    {/* Workload dot — colored circle, diameter 16px */}
                    <div
                      title={`Workload: ${p.workloadSentiment} — ${SENTIMENT_LABELS[p.workloadSentiment]}`}
                      className={cn('w-4 h-4 rounded-full', col.bar)}
                    />
                    {/* Week date label */}
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {shortWeekLabel(p.weekOf)}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-[10px] text-slate-400 flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300" /> Workload</span>
              <span className="text-[10px] text-slate-400">😊 Mood</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. My Epics ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">My Epics</h2>
          <Link
            to="/people"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
          >
            People page <ExternalLink size={11} />
          </Link>
        </div>

        {myProjects.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No epics assigned yet.</p>
        ) : (
          <>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {myProjects.slice(0, EPICS_LIMIT).map(project => {
                // Prefer the first phase's phase label; fall back to root-level phase.
                const phase = project.phases?.[0]?.phase ?? project.phase
                const percentComplete = project.percentComplete ?? 0
                const targetDate = project.targetEndDate
                  ? new Date(project.targetEndDate + 'T12:00:00')
                      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                  : '—'

                return (
                  <Link
                    key={project.id}
                    to={`/epics/${project.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                  >
                    {/* Epic name */}
                    <span className="flex-1 min-w-0 text-sm text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-700">
                      {project.name}
                    </span>

                    {/* Phase badge — hidden on very small screens */}
                    {phase && (
                      <span className={cn(
                        'hidden sm:inline-flex shrink-0 text-xs px-2 py-0.5 rounded-full font-medium',
                        PHASE_COLORS[phase] ?? 'bg-slate-100 text-slate-600',
                      )}>
                        {phase}
                      </span>
                    )}

                    {/* Status badge */}
                    <span className={cn(
                      'shrink-0 text-xs px-2 py-0.5 rounded-full font-medium',
                      STATUS_COLORS[project.status] ?? 'bg-slate-100 text-slate-600',
                    )}>
                      {project.status}
                    </span>

                    {/* % complete mini-bar — hidden on very small screens */}
                    <div className="hidden sm:flex items-center gap-1.5 w-20 shrink-0">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${percentComplete}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 w-7 text-right">
                        {percentComplete}%
                      </span>
                    </div>

                    {/* Target date — only on wider screens */}
                    <span className="hidden md:block shrink-0 text-xs text-slate-400 w-20 text-right">
                      {targetDate}
                    </span>
                  </Link>
                )
              })}
            </div>

            {/* "See all" link when the list exceeds the cap */}
            {myProjects.length > EPICS_LIMIT && (
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700">
                <Link
                  to="/people"
                  className="text-xs text-blue-600 hover:underline"
                >
                  + {myProjects.length - EPICS_LIMIT} more — see all on the People page
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Pulse edit dialog ─────────────────────────────────────────────── */}
      {pulseDialogOpen && (
        <PulseEditDialog
          open
          member={member}
          pulse={thisWeekPulse}
          previousPulse={previousPulse}
          weekOf={weekOf}
          onSave={handlePulseSave}
          onClose={() => setPulseDialogOpen(false)}
        />
      )}
    </div>
  )
}
