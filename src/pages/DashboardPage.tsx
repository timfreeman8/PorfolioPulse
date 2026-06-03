/**
 * Dashboard page — the home screen of the SAT tool.
 *
 * Acts as a "mission control" view: every major section of the app is
 * represented here with a high-level visual and a direct link to dive deeper.
 * The goal is that a manager can open the app and immediately know:
 *   - How many projects are in each phase/status
 *   - Which initiatives are on track
 *   - Who is over capacity
 *   - What's waiting in the intake pipeline
 *   - What escalations are open
 *   - What's been recently updated
 *
 * Layout (top to bottom):
 *   1. Header with portfolio summary text
 *   2. Clickable nav cards — one per major page (jump anywhere in one click)
 *   3. Two-panel row — Projects overview + Initiative progress
 *   4. Three-panel row — Capacity | Pipeline | Escalations
 *   5. Recent Activity feed (full width)
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  FolderKanban, ClipboardList,
  ArrowRight, Target, Calendar, ShieldAlert,
  AlertTriangle, CheckCircle2, FolderTree,
  BookUser, Layers,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import {
  CHART_COLORS, STATUS_COLORS, PHASE_COLORS,
  INITIATIVE_STATUS_COLORS,
} from '@/lib/colors'
import type { ProjectPhase, ProjectStatus } from '@/types'
import { cn } from '@/lib/utils'
import { getCurrentQBounds } from '@/lib/fiscal'

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Human-readable relative time ("Today", "3d ago", etc.) */
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)   return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 8)  return `${weeks}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

// ─── NavCard ──────────────────────────────────────────────────────────────
// Clickable summary card that represents an entire section of the app.
// Acts as both a stat display and a navigation shortcut.

function NavCard({
  label,
  value,
  sublabel,
  to,
  icon: Icon,
  accent,
}: {
  label: string
  value: number | string
  sublabel?: string
  to: string
  icon: React.ElementType
  accent: string
}) {
  return (
    <Link to={to} className="block group">
      <Card className="h-full hover:shadow-md hover:border-blue-200 transition-all cursor-pointer py-0 gap-0">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg', accent)}>
              <Icon size={17} className="text-white" />
            </div>
            <ArrowRight
              size={14}
              className="text-slate-200 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all mt-1"
            />
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
          <p className="text-sm text-slate-500 mt-0.5">{label}</p>
          {sublabel && <p className="text-xs text-slate-400 mt-1">{sublabel}</p>}
        </CardContent>
      </Card>
    </Link>
  )
}

// ─── SectionHeader ────────────────────────────────────────────────────────
// Reusable header pattern used inside section cards: title + icon on the left,
// "View all →" navigation link on the right.

function SectionHeader({
  title,
  to,
  icon: Icon,
  subtitle,
}: {
  title: string
  to: string
  icon: React.ElementType
  subtitle?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-slate-400" />
          <CardTitle className="text-sm font-semibold text-slate-800">{title}</CardTitle>
        </div>
        <Link
          to={to}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          View all
          <ArrowRight size={11} />
        </Link>
      </div>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  )
}

// ─── Phase donut ──────────────────────────────────────────────────────────
// Compact donut chart showing projects split by SDLC phase.

function PhaseDonut({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={48}
          outerRadius={76}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={CHART_COLORS.phase[entry.name as ProjectPhase] ?? '#94a3b8'}
            />
          ))}
        </Pie>
        <Tooltip formatter={(v) => [`${v} projects`, '']} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ─── Status pills ─────────────────────────────────────────────────────────
// Compact pill row summarizing project counts by status.
// More space-efficient than a bar chart for this context.

function StatusPills() {
  const { projects } = usePortfolioStore()
  const statuses: ProjectStatus[] = ['Backlog', 'In Progress', 'Blocked', 'Complete']
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map(st => {
        const count = projects.filter(p => p.status === st).length
        return (
          <div
            key={st}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
              STATUS_COLORS[st],
            )}
          >
            <span>{st}</span>
            <span className="font-bold">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Projects overview card ────────────────────────────────────────────────
// Combines phase donut + status pills + blocked warning into one card.

function ProjectsOverview() {
  const { projects } = usePortfolioStore()

  const phases: ProjectPhase[] = ['Research','Discovery','Development','QA','Deployed','On Hold']
  const phaseData = phases
    .map(ph => ({ name: ph, value: projects.filter(p => p.phase === ph).length }))
    .filter(d => d.value > 0)

  const blockedCount  = projects.filter(p => p.status === 'Blocked').length
  const completeCount = projects.filter(p => p.status === 'Complete').length

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <SectionHeader title="Projects" to="/projects" icon={FolderKanban} subtitle={`${projects.length} total across all teams`} />
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {/* Blocked alert — prominent if any projects are blocked */}
        {blockedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/25 border border-red-100 dark:border-red-800 rounded-lg">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              {blockedCount} project{blockedCount > 1 ? 's' : ''} blocked
            </span>
          </div>
        )}
        {completeCount > 0 && blockedCount === 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/25 border border-green-100 dark:border-green-800 rounded-lg">
            <CheckCircle2 size={14} className="text-green-500 shrink-0" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {completeCount} project{completeCount > 1 ? 's' : ''} complete
            </span>
          </div>
        )}
        {/* Phase donut chart */}
        <PhaseDonut data={phaseData} />
        {/* Status breakdown */}
        <div>
          <p className="text-xs text-slate-400 mb-2">By status</p>
          <StatusPills />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Initiatives section card ──────────────────────────────────────────────
// One row per initiative: name + status badge + progress bar + project count.

function InitiativesCard() {
  const { initiatives, projects } = usePortfolioStore()

  const rows = useMemo(() => {
    return initiatives.map(ini => {
      const iniProjects = projects.filter(p => p.initiativeId === ini.id)
      const complete = iniProjects.filter(p => p.status === 'Complete').length
      const pct = iniProjects.length
        ? Math.round((complete / iniProjects.length) * 100)
        : 0
      return { ini, iniProjects, complete, pct }
    })
  }, [initiatives, projects])

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <SectionHeader title="Initiatives" to="/initiatives" icon={Target} subtitle="Strategic themes driving project work" />
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No initiatives yet.</p>
        ) : rows.map(({ ini, iniProjects, complete, pct }) => (
          <div key={ini.id}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-slate-800 truncate">{ini.name}</span>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0', INITIATIVE_STATUS_COLORS[ini.status])}>
                  {ini.status}
                </span>
              </div>
              <span className="text-xs text-slate-400 ml-2 shrink-0">
                {complete}/{iniProjects.length}
              </span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Capacity card ────────────────────────────────────────────────────────
// Top members sorted by how loaded they are this quarter.
// Red = over capacity, Amber = over 80%, Green = healthy.

function CapacityCard() {
  const { members, projects } = usePortfolioStore()
  const { qStart, qEnd } = useMemo(() => getCurrentQBounds(), [])

  const rows = useMemo(() => {
    return [...members]
      .map(m => {
        // Sum allocation for all projects that overlap the current quarter.
        const committed = projects
          .filter(p => {
            if (!p.assignments.some(a => a.memberId === m.id) || !p.startDate || !p.targetEndDate) return false
            const pStart = new Date(p.startDate + 'T00:00:00')
            const pEnd   = new Date(p.targetEndDate + 'T00:00:00')
            return pStart < qEnd && pEnd > qStart
          })
          .reduce((sum, p) => sum + (p.assignments.find(a => a.memberId === m.id)?.allocation ?? 0), 0)
        return { member: m, committed }
      })
      .sort((a, b) => b.committed - a.committed)
      .slice(0, 8)
  }, [members, projects, qStart, qEnd])

  const overCount  = rows.filter(r => r.committed > r.member.capacity).length
  const amberCount = rows.filter(r => {
    const a = r.member.capacity
    return r.committed <= a && a > 0 && r.committed / a > 0.8
  }).length

  function barColor(committed: number, cap: number) {
    if (committed > cap)                            return 'bg-red-500'
    if (cap > 0 && committed / cap > 0.8)           return 'bg-amber-400'
    return 'bg-emerald-500'
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <SectionHeader title="Capacity" to="/planning" icon={Calendar} subtitle="Current quarter allocation" />
      </CardHeader>
      <CardContent className="flex-1 space-y-1">
        {/* Summary alert */}
        {overCount > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/25 border border-red-100 dark:border-red-800 rounded-lg mb-2">
            <AlertTriangle size={13} className="text-red-500 shrink-0" />
            <span className="text-xs font-medium text-red-700 dark:text-red-300">
              {overCount} member{overCount > 1 ? 's' : ''} over capacity
              {amberCount > 0 && `, ${amberCount} near limit`}
            </span>
          </div>
        ) : amberCount > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/25 border border-amber-100 dark:border-amber-800 rounded-lg mb-2">
            <AlertTriangle size={13} className="text-amber-500 shrink-0" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
              {amberCount} member{amberCount > 1 ? 's' : ''} near capacity
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/25 border border-green-100 dark:border-green-800 rounded-lg mb-2">
            <CheckCircle2 size={13} className="text-green-500 shrink-0" />
            <span className="text-xs font-medium text-green-700 dark:text-green-300">All members within capacity</span>
          </div>
        )}

        {/* Member rows — name is a link to the member detail page */}
        {rows.map(({ member: m, committed }) => {
          const cap = m.capacity
          const barW = cap > 0 ? Math.min((committed / cap) * 100, 100) : Math.min(committed, 100)
          return (
            <div key={m.id}>
              <div className="flex items-center justify-between mb-0.5">
                <Link
                  to={`/members/${m.id}`}
                  className="text-xs font-medium text-slate-700 truncate hover:text-blue-600 hover:underline transition-colors"
                >
                  {m.name}
                </Link>
                <span className={cn(
                  'text-xs tabular-nums',
                  committed > cap ? 'text-red-600 font-semibold' :
                  cap > 0 && committed / cap > 0.8 ? 'text-amber-600 font-semibold' :
                  'text-slate-500',
                )}>
                  {committed}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', barColor(committed, cap))}
                  style={{ width: `${barW}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ─── Pipeline card ────────────────────────────────────────────────────────
// Pending intake request count + last few submissions.

function PipelineCard() {
  const { intakeRequests } = usePortfolioStore()

  const pending = intakeRequests.filter(r => r.status === 'Pending Review')
  const recent  = [...intakeRequests]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 4)

  const INTAKE_STATUS_COLORS: Record<string, string> = {
    'Pending Review': 'bg-amber-100 text-amber-700',
    'Approved':       'bg-green-100 text-green-700',
    'Rejected':       'bg-red-100 text-red-700',
    'Deferred':       'bg-slate-100 text-slate-600',
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <SectionHeader title="Pipeline" to="/pipeline" icon={ClipboardList} subtitle="Incoming work requests" />
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {/* Pending count — big number as primary signal */}
        <div className="flex items-baseline gap-2">
          <span className={cn(
            'text-3xl font-bold tabular-nums',
            pending.length > 0 ? 'text-amber-600' : 'text-slate-300',
          )}>
            {pending.length}
          </span>
          <span className="text-sm text-slate-500">pending review</span>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Recent requests — each links to the pipeline page and auto-opens that submission */}
        <div className="space-y-2">
          {recent.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">No requests yet.</p>
          ) : recent.map(r => (
            <Link
              key={r.id}
              to={`/pipeline?view=${r.id}`}
              className="flex items-start gap-2 group/req rounded-md hover:bg-slate-50 -mx-1 px-1 py-0.5 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate group-hover/req:text-blue-600 transition-colors">{r.requesterName}</p>
                <p className="text-[11px] text-slate-400 truncate">{r.description}</p>
              </div>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0', INTAKE_STATUS_COLORS[r.status])}>
                {r.status === 'Pending Review' ? 'Pending' : r.status}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Escalations card ─────────────────────────────────────────────────────
// Open escalation count + list of what's currently blocked.

function EscalationsCard() {
  const { escalations } = usePortfolioStore()
  const open = escalations.filter(e => e.status === 'Open')

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <SectionHeader title="Escalations" to="/escalations" icon={ShieldAlert} subtitle="Active blockers needing attention" />
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {/* Open count */}
        <div className="flex items-baseline gap-2">
          <span className={cn(
            'text-3xl font-bold tabular-nums',
            open.length > 0 ? 'text-red-600' : 'text-slate-300',
          )}>
            {open.length}
          </span>
          <span className="text-sm text-slate-500">open</span>
        </div>

        <div className="border-t border-slate-100" />

        {open.length === 0 ? (
          <div className="flex items-center gap-2 py-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <span className="text-sm text-slate-500">No open escalations</span>
          </div>
        ) : (
          <div className="space-y-2">
            {open.slice(0, 4).map(e => (
              <div key={e.id} className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <p className="text-xs font-medium text-slate-800 truncate">{e.memberName}</p>
                </div>
                <p className="text-[11px] text-slate-400 pl-3 truncate">{e.blockedOn}</p>
              </div>
            ))}
            {open.length > 4 && (
              <p className="text-xs text-slate-400 pl-3">+{open.length - 4} more</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Recent Activity card ─────────────────────────────────────────────────
// Full-width feed of the most recently updated projects across the portfolio.

function RecentActivity() {
  const { projects, members } = usePortfolioStore()

  const recent = [...projects]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6)

  function memberNames(memberIds: string[]) {
    return memberIds
      .map(id => members.find(m => m.id === id)?.name ?? '?')
      .join(', ')
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <SectionHeader title="Recent Activity" to="/projects" icon={FolderKanban} subtitle="Last updated projects across the portfolio" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {recent.map(p => {
            const names = memberNames(p.assignments.map(a => a.memberId))
            return (
              <div
                key={p.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
              >
                {/* Avatar/icon */}
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 shrink-0 mt-0.5">
                  <FolderKanban size={13} className="text-blue-400" />
                </div>
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                  {names && <p className="text-xs text-slate-400 truncate">{names}</p>}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', STATUS_COLORS[p.status])}>
                      {p.status}
                    </span>
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', PHASE_COLORS[p.phase])}>
                      {p.phase}
                    </span>
                  </div>
                </div>
                {/* Time */}
                <span className="text-[11px] text-slate-400 shrink-0 pt-0.5">{relTime(p.updatedAt)}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Dashboard page ───────────────────────────────────────────────────────

export function DashboardPage() {
  const { domains, teams, members, projects, initiatives, intakeRequests } =
    usePortfolioStore()

  const { qLabel } = useMemo(() => getCurrentQBounds(), [])

  // Summary numbers for nav cards
  const activeProjects  = projects.filter(p => p.status === 'In Progress').length
  const pendingRequests = intakeRequests.filter(r => r.status === 'Pending Review').length

  return (
    <div className="px-4 pt-6 pb-8 md:px-8 md:pt-8 space-y-6 overflow-y-auto h-full">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {qLabel} · {projects.length} projects · {members.length} members
        </p>
      </div>

      {/* ── Nav cards — one per major page section ─────────────────────
          Each card is a Link — clicking takes you directly to that page.
          Numbers give the key signal at a glance.                       */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <NavCard
          label="Portfolio"
          value={domains.length}
          sublabel={`${teams.length} teams`}
          to="/portfolio"
          icon={FolderTree}
          accent="bg-violet-500"
        />
        <NavCard
          label="Initiatives"
          value={initiatives.length}
          sublabel="strategic themes"
          to="/initiatives"
          icon={Target}
          accent="bg-indigo-500"
        />
        <NavCard
          label="Projects"
          value={projects.length}
          sublabel={`${activeProjects} in progress`}
          to="/projects"
          icon={Layers}
          accent="bg-blue-500"
        />
        <NavCard
          label="Roster"
          value={members.length}
          sublabel={`${teams.length} teams`}
          to="/roster"
          icon={BookUser}
          accent="bg-sky-500"
        />
        <NavCard
          label="Planning"
          value="→"
          sublabel="capacity Gantt"
          to="/planning"
          icon={Calendar}
          accent="bg-emerald-500"
        />
        <NavCard
          label="Pipeline"
          value={pendingRequests}
          sublabel="pending review"
          to="/pipeline"
          icon={ClipboardList}
          accent={pendingRequests > 0 ? 'bg-amber-500' : 'bg-slate-400'}
        />
      </div>

      {/* ── Row 2: Projects overview + Initiatives ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <ProjectsOverview />
        </div>
        <div className="lg:col-span-2">
          <InitiativesCard />
        </div>
      </div>

      {/* ── Row 3: Capacity | Pipeline | Escalations ───────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <CapacityCard />
        <PipelineCard />
        <EscalationsCard />
      </div>

      {/* ── Row 4: Recent Activity ─────────────────────────────────────── */}
      <RecentActivity />
    </div>
  )
}
