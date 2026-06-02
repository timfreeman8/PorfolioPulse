/**
 * AnalyticsPage — Portfolio-wide analytics with two tabs:
 *
 *   Charts tab (default) — four recharts charts and a sortable/filterable
 *     project table covering phase, status, team capacity, and initiative
 *     progress. Filters persist across navigation via localStorage.
 *
 *   Financial tab — cost vs. value analysis for the portfolio:
 *     - Summary stat cards (total headcount cost, estimated value, portfolio ROI)
 *     - Cost by Team horizontal bar chart (member annual rates by team)
 *     - Value by Initiative stacked bar chart (Revenue Impact vs Cost Savings)
 *     - Project Financial Table with cost share and ROI columns
 *
 * Dark mode: chart element colors (grid lines, axis ticks, legends, tooltips)
 * are driven by `isDark` from useTheme because recharts doesn't respond to
 * Tailwind classes. Non-slate Tailwind classes (bg-blue-500 progress bar, etc.)
 * get explicit `dark:` variants here.
 *
 * Filter persistence: the full filter state is serialised to localStorage under
 * `sat-analytics-filters` on every change and re-hydrated on mount. This keeps
 * the user's filter selection when navigating away and back.
 */
import { useState, useMemo, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { BarChart3, ChevronUp, ChevronDown, ChevronsUpDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorBadge } from '@/components/ui/color-badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import {
  CHART_COLORS, STATUS_COLORS, PHASE_COLORS, PRIORITY_COLORS,
} from '@/lib/colors'
import { useTheme } from '@/lib/useTheme'
import { cn } from '@/lib/utils'
import type { Project, ProjectPhase, ProjectStatus, Priority } from '@/types'

// ─── Currency helpers ─────────────────────────────────────────────────────────

/**
 * Format a dollar amount in compact notation ("$1.2M", "$120K").
 * Used on chart axis ticks and stat cards where space is limited.
 */
function fmtCompact(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    notation: 'compact', maximumFractionDigits: 1,
  }).format(n)
}

/**
 * Format a dollar amount with full comma grouping ("$1,200,000").
 * Used in table cells and tooltips where precision matters.
 */
function fmtFull(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n)
}

// ─── Constants ────────────────────────────────────────────────────────────────

// localStorage key for persisted filter state.
const FILTER_STORAGE_KEY = 'sat-analytics-filters'

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = keyof Pick<Project, 'name' | 'phase' | 'status' | 'priority' | 'percentComplete' | 'targetEndDate'>
type SortDir = 'asc' | 'desc'

/** Keys for the Financial tab's sortable project table. */
type FinSortKey = 'name' | 'estimatedValue' | 'roi'
type FinSortDir = 'asc' | 'desc'

/** Shape stored in localStorage for filter persistence. */
interface PersistedFilters {
  domain: string
  team: string
  initiative: string
  phase: string
  status: string
  priority: string
  dateFrom: string
  dateTo: string
  search: string
}

// ─── Filter persistence helpers ───────────────────────────────────────────────

/**
 * Read saved filters from localStorage. Returns null if nothing is stored or
 * the value can't be parsed (e.g. corrupted data).
 */
function loadFilters(): PersistedFilters | null {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedFilters) : null
  } catch {
    return null
  }
}

/** Write current filter state to localStorage. */
function saveFilters(filters: PersistedFilters) {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
  } catch {
    // localStorage may be unavailable in some environments — fail silently.
  }
}

// ─── Default filter values ────────────────────────────────────────────────────

const DEFAULT_FILTERS: PersistedFilters = {
  domain:     '__all__',
  team:       '__all__',
  initiative: '__all__',
  phase:      '__all__',
  status:     '__all__',
  priority:   '__all__',
  dateFrom:   '',
  dateTo:     '',
  search:     '',
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={13} className="text-slate-300 ml-1" />
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-blue-500 ml-1" />
    : <ChevronDown size={13} className="text-blue-500 ml-1" />
}

function SortableHead({
  col, label, sortKey, sortDir, onSort,
}: {
  col: SortKey; label: string
  sortKey: SortKey; sortDir: SortDir
  onSort: (c: SortKey) => void
}) {
  return (
    <TableHead
      className="cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center">
        {label}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </TableHead>
  )
}

// ─── Chart helpers ────────────────────────────────────────────────────────────

/**
 * PhaseDonut — pie chart of projects broken down by phase.
 * Receives `isDark` so it can flip the legend text color, since recharts
 * renders legend labels as inline SVG text that ignores Tailwind dark classes.
 */
function PhaseDonut({ data, isDark }: { data: { name: string; value: number }[]; isDark: boolean }) {
  const legendColor = isDark ? '#94a3b8' : '#64748b'
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
          {data.map(e => (
            <Cell key={e.name} fill={CHART_COLORS.phase[e.name as ProjectPhase] ?? '#94a3b8'} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => [`${v} projects`, '']}
          contentStyle={{
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor:     isDark ? '#334155' : '#e2e8f0',
            color:           isDark ? '#f1f5f9' : '#0f172a',
          }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ color: legendColor }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

/**
 * StatusBar — vertical bar chart of projects by status.
 * Grid lines, axis ticks, and tooltip background all adapt to dark mode.
 */
function StatusBar({ data, isDark }: { data: { name: string; value: number }[]; isDark: boolean }) {
  // Colors used for recharts style props — can't use Tailwind classes here.
  const gridStroke = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const tickColor  = isDark ? '#94a3b8' : '#64748b'
  const cursorFill = isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barSize={32}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: cursorFill }}
          formatter={(v) => [`${v} projects`, 'Count']}
          contentStyle={{
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor:     isDark ? '#334155' : '#e2e8f0',
            color:           isDark ? '#f1f5f9' : '#0f172a',
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map(e => (
            <Cell key={e.name} fill={CHART_COLORS.status[e.name as ProjectStatus] ?? '#94a3b8'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * TeamCapacityBar — grouped bar chart showing avg and max capacity per team.
 */
function TeamCapacityBar({ data, isDark }: { data: { name: string; avg: number; max: number }[]; isDark: boolean }) {
  const gridStroke  = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const tickColor   = isDark ? '#94a3b8' : '#64748b'
  const legendColor = isDark ? '#94a3b8' : '#64748b'

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barSize={14} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} unit="%" domain={[0, 120]} />
        <Tooltip
          formatter={(v, name) => [`${v}%`, name === 'avg' ? 'Avg Capacity' : 'Max Capacity']}
          contentStyle={{
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor:     isDark ? '#334155' : '#e2e8f0',
            color:           isDark ? '#f1f5f9' : '#0f172a',
          }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ color: legendColor }} />
        <Bar dataKey="avg" name="Avg" fill="#60a5fa" radius={[3, 3, 0, 0]} />
        <Bar dataKey="max" name="Max" fill="#f87171" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * InitiativeProgressBar — horizontal bar chart showing completion % per initiative.
 */
function InitiativeProgressBar({ data, isDark }: { data: { name: string; pct: number }[]; isDark: boolean }) {
  const gridStroke = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const tickColor  = isDark ? '#94a3b8' : '#64748b'

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" barSize={18} margin={{ left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
        <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} width={140} />
        <Tooltip
          formatter={(v) => [`${v}%`, 'Complete']}
          contentStyle={{
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor:     isDark ? '#334155' : '#e2e8f0',
            color:           isDark ? '#f1f5f9' : '#0f172a',
          }}
        />
        <Bar dataKey="pct" fill="#34d399" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Financial tab chart components ───────────────────────────────────────────

/**
 * CostByTeamBar — horizontal bar chart: team name → sum of member annual rates.
 * Only teams where at least one member has a rate defined are shown.
 */
function CostByTeamBar({
  data,
  isDark,
}: {
  data: { name: string; cost: number }[]
  isDark: boolean
}) {
  const gridStroke = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const tickColor  = isDark ? '#94a3b8' : '#64748b'

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: tickColor }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => fmtCompact(v)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10, fill: tickColor }}
          axisLine={false}
          tickLine={false}
          width={130}
        />
        <Tooltip
          formatter={(v) => [fmtFull(Number(v)), 'Annual Cost']}
          contentStyle={{
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor:     isDark ? '#334155' : '#e2e8f0',
            color:           isDark ? '#f1f5f9' : '#0f172a',
          }}
        />
        <Bar dataKey="cost" fill="#60a5fa" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * ValueByInitiativeBar — stacked horizontal bar chart: initiative → estimated value.
 * Revenue Impact bars are blue; Cost Savings bars are green.
 * When both types appear in an initiative, the bar is stacked.
 */
function ValueByInitiativeBar({
  data,
  isDark,
}: {
  data: { name: string; revenue: number; savings: number }[]
  isDark: boolean
}) {
  const gridStroke  = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const tickColor   = isDark ? '#94a3b8' : '#64748b'
  const legendColor = isDark ? '#94a3b8' : '#64748b'

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: tickColor }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => fmtCompact(v)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 10, fill: tickColor }}
          axisLine={false}
          tickLine={false}
          width={170}
        />
        <Tooltip
          formatter={(v, name) => [
            fmtFull(Number(v)),
            name === 'revenue' ? 'Revenue Impact' : 'Cost Savings',
          ]}
          contentStyle={{
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor:     isDark ? '#334155' : '#e2e8f0',
            color:           isDark ? '#f1f5f9' : '#0f172a',
          }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ color: legendColor }} />
        <Bar dataKey="revenue" name="Revenue Impact" fill="#60a5fa" stackId="a" radius={[0, 0, 0, 0]} />
        <Bar dataKey="savings" name="Cost Savings"   fill="#34d399" stackId="a" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Analytics page ───────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const { domains, teams, members, projects, initiatives, resourceRates } = usePortfolioStore()

  // Track dark mode so we can pass `isDark` into chart sub-components.
  const { isDark } = useTheme()

  // Active tab: 'charts' (existing) or 'financial' (new).
  const [activeTab, setActiveTab] = useState<'charts' | 'financial'>('charts')

  // ── Filters — initialised from localStorage if available ─────────────────
  // We read from localStorage once on mount via lazy initialiser so the UI
  // immediately reflects the user's previous session without a flash of defaults.
  const saved = loadFilters() ?? DEFAULT_FILTERS

  const [filterDomain,     setFilterDomain]    = useState(saved.domain)
  const [filterTeam,       setFilterTeam]      = useState(saved.team)
  const [filterInitiative, setFilterInit]      = useState(saved.initiative)
  const [filterPhase,      setFilterPhase]     = useState(saved.phase)
  const [filterStatus,     setFilterStatus]    = useState(saved.status)
  const [filterPriority,   setFilterPriority]  = useState(saved.priority)
  const [filterDateFrom,   setDateFrom]        = useState(saved.dateFrom)
  const [filterDateTo,     setDateTo]          = useState(saved.dateTo)
  const [search,           setSearch]          = useState(saved.search)

  // ── Persist filters to localStorage on every change ──────────────────────
  // Runs after render whenever any filter value changes. We write the whole
  // filter object at once to avoid partial-state reads on next mount.
  useEffect(() => {
    saveFilters({
      domain:     filterDomain,
      team:       filterTeam,
      initiative: filterInitiative,
      phase:      filterPhase,
      status:     filterStatus,
      priority:   filterPriority,
      dateFrom:   filterDateFrom,
      dateTo:     filterDateTo,
      search,
    })
  }, [filterDomain, filterTeam, filterInitiative, filterPhase, filterStatus, filterPriority, filterDateFrom, filterDateTo, search])

  // ── Sort ─────────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('asc') }
  }

  // ── Derived: member→team→domain lookup ───────────────────────────────────
  // Pre-built Maps avoid O(n²) lookups inside filter loops.
  const memberTeamMap = useMemo(() => new Map(members.map(m => [m.id, m.teamIds])), [members])
  const teamDomainMap = useMemo(() => new Map(teams.map(t => [t.id, t.domainId])), [teams])

  function projectDomainId(p: Project): string {
    const teamId = p.assignments.flatMap(a => memberTeamMap.get(a.memberId) ?? []).find(Boolean)
    return teamId ? (teamDomainMap.get(teamId) ?? '') : ''
  }
  function projectTeamId(p: Project): string {
    return p.assignments.flatMap(a => memberTeamMap.get(a.memberId) ?? []).find(Boolean) ?? ''
  }

  // ── Filtered projects ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (filterDomain     !== '__all__' && projectDomainId(p) !== filterDomain)     return false
      if (filterTeam       !== '__all__' && projectTeamId(p)   !== filterTeam)       return false
      if (filterInitiative !== '__all__' && p.initiativeId     !== filterInitiative) return false
      if (filterPhase      !== '__all__' && p.phase            !== filterPhase)       return false
      if (filterStatus     !== '__all__' && p.status           !== filterStatus)      return false
      if (filterPriority   !== '__all__' && p.priority         !== filterPriority)    return false
      if (filterDateFrom   && p.targetEndDate && p.targetEndDate < filterDateFrom)   return false
      if (filterDateTo     && p.targetEndDate && p.targetEndDate > filterDateTo)     return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()))            return false
      return true
    })
  }, [projects, filterDomain, filterTeam, filterInitiative, filterPhase, filterStatus, filterPriority, filterDateFrom, filterDateTo, search])

  // ── Sorted ────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  // ── Teams available for filter ────────────────────────────────────────────
  // When a domain filter is active, only show teams within that domain so the
  // team dropdown doesn't offer irrelevant options.
  const filteredTeams = filterDomain === '__all__'
    ? teams
    : teams.filter(t => t.domainId === filterDomain)

  // ── Chart data ────────────────────────────────────────────────────────────
  const phases: ProjectPhase[] = ['Research','Discovery','Development','QA','Deployed','On Hold']
  const phaseData = phases
    .map(ph => ({ name: ph, value: filtered.filter(p => p.phase === ph).length }))
    .filter(d => d.value > 0)

  const statuses: ProjectStatus[] = ['Backlog','In Progress','Blocked','Complete']
  const statusData = statuses.map(s => ({
    name: s, value: filtered.filter(p => p.status === s).length,
  }))

  // Team capacity data uses all teams regardless of the active filter —
  // capacity is a property of the team itself, not of filtered projects.
  const teamCapData = teams.map(team => {
    const teamMembers = members.filter(m => team.memberIds.includes(m.id))
    const caps = teamMembers.map(m => m.capacity)
    return {
      name: team.name.replace(/&.*/, '').trim(), // shorten long team names for chart axis
      avg:  caps.length ? Math.round(caps.reduce((a, b) => a + b, 0) / caps.length) : 0,
      max:  caps.length ? Math.max(...caps) : 0,
    }
  })

  // Initiative progress: % of associated projects with status === 'Complete'.
  const initProgressData = initiatives.map(ini => {
    const iniProjs = projects.filter(p => p.initiativeId === ini.id)
    const complete = iniProjs.filter(p => p.status === 'Complete').length
    return {
      name: ini.name.length > 30 ? ini.name.slice(0, 28) + '…' : ini.name,
      pct:  iniProjs.length ? Math.round((complete / iniProjs.length) * 100) : 0,
    }
  })

  // ── Helpers ───────────────────────────────────────────────────────────────

  function memberNames(memberIds: string[]) {
    return memberIds.map(id => members.find(m => m.id === id)?.name ?? '?').join(', ')
  }
  function initiativeName(id: string) {
    return initiatives.find(i => i.id === id)?.name ?? '—'
  }
  function teamName(p: Project) {
    const tid = projectTeamId(p)
    return teams.find(t => t.id === tid)?.name ?? '—'
  }
  function domainName(p: Project) {
    const did = projectDomainId(p)
    return domains.find(d => d.id === did)?.name ?? '—'
  }

  function resetFilters() {
    setFilterDomain('__all__'); setFilterTeam('__all__'); setFilterInit('__all__')
    setFilterPhase('__all__'); setFilterStatus('__all__'); setFilterPriority('__all__')
    setDateFrom(''); setDateTo(''); setSearch('')
  }

  const hasFilters = [filterDomain, filterTeam, filterInitiative, filterPhase, filterStatus, filterPriority]
    .some(f => f !== '__all__') || filterDateFrom || filterDateTo || search

  // ── Financial tab — sort state ────────────────────────────────────────────
  const [finSortKey, setFinSortKey] = useState<FinSortKey>('estimatedValue')
  const [finSortDir, setFinSortDir] = useState<FinSortDir>('desc')

  function handleFinSort(col: FinSortKey) {
    if (col === finSortKey) setFinSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setFinSortKey(col); setFinSortDir('desc') }
  }

  // ── Financial tab — data ─────────────────────────────────────────────────

  /** Fast role → annual rate lookup from the store. */
  const rateByRole = useMemo(
    () => new Map(resourceRates.map(r => [r.role, r.annualRate])),
    [resourceRates],
  )

  /**
   * Total annual headcount cost = sum of (member count per role × role annual rate).
   * Salaried resources: rate is fixed, so we simply sum across all members.
   */
  const totalHeadcountCost = useMemo(() => {
    return members.reduce((sum, m) => {
      const rate = rateByRole.get(m.role) ?? 0
      return sum + rate
    }, 0)
  }, [members, rateByRole])

  /**
   * Total estimated portfolio value — sum of estimatedValue for all non-Backlog projects.
   * Backlog projects are excluded because they represent uncommitted work.
   */
  const totalEstimatedValue = useMemo(() => {
    return projects
      .filter(p => p.status !== 'Backlog' && p.estimatedValue)
      .reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0)
  }, [projects])

  /** Count of projects with an estimatedValue set (across all statuses). */
  const projectsWithValue = useMemo(
    () => projects.filter(p => p.estimatedValue != null).length,
    [projects],
  )

  /**
   * Compute the cost share for a single project in dollars.
   *
   * Cost Share = Σ (member annual rate × allocation% / 100 × project duration in years)
   *
   * Duration is calculated from the assignment's own startDate/endDate if set,
   * otherwise falls back to the project's startDate/targetEndDate. Returns undefined
   * when no assignments have usable rates or dates.
   */
  function projectCostShare(p: Project): number | undefined {
    let total = 0
    let counted = 0

    for (const a of p.assignments) {
      const member = members.find(m => m.id === a.memberId)
      if (!member) continue
      const rate = rateByRole.get(member.role)
      if (rate == null) continue

      // Prefer assignment-level dates; fall back to project-level dates.
      const start = a.startDate || p.startDate
      const end   = a.endDate   || p.targetEndDate
      if (!start || !end) continue

      const durationYears = (new Date(end).getTime() - new Date(start).getTime()) / (365 * 24 * 3600 * 1000)
      if (durationYears <= 0) continue

      total += rate * (a.allocation / 100) * durationYears
      counted++
    }

    return counted > 0 ? Math.round(total) : undefined
  }

  /**
   * Cost by team — for each team where ≥1 member has a rate defined,
   * sum the annual rates of all members in that team.
   */
  const costByTeamData = useMemo(() => {
    return teams
      .map(team => {
        const teamMembers = members.filter(m => team.memberIds.includes(m.id))
        const cost = teamMembers.reduce((sum, m) => sum + (rateByRole.get(m.role) ?? 0), 0)
        return { name: team.name, cost }
      })
      .filter(d => d.cost > 0)
      .sort((a, b) => b.cost - a.cost)
  }, [teams, members, rateByRole])

  /**
   * Value by initiative — for each initiative, sum estimatedValue of linked projects,
   * split into revenue and cost-savings buckets for the stacked bar.
   */
  const valueByInitiativeData = useMemo(() => {
    return initiatives
      .map(ini => {
        const iniProjs = projects.filter(p => p.initiativeId === ini.id && p.estimatedValue)
        const revenue  = iniProjs.filter(p => p.valueType === 'Revenue Impact').reduce((s, p) => s + (p.estimatedValue ?? 0), 0)
        const savings  = iniProjs.filter(p => p.valueType === 'Cost Savings').reduce((s, p) => s + (p.estimatedValue ?? 0), 0)
        return { name: ini.name.length > 30 ? ini.name.slice(0, 28) + '…' : ini.name, revenue, savings }
      })
      .filter(d => d.revenue > 0 || d.savings > 0)
  }, [initiatives, projects])

  /**
   * Project financial table — rows for projects that have either an estimatedValue
   * set OR a calculable cost share. Sorted by the active fin sort key.
   */
  const finTableRows = useMemo(() => {
    const rows = projects
      .filter(p => p.status !== 'Backlog')
      .map(p => {
        const costShare = projectCostShare(p)
        const roi = p.estimatedValue != null && costShare != null && costShare > 0
          ? p.estimatedValue / costShare
          : undefined
        const tid = projectTeamId(p)
        return {
          project:        p,
          teamName:       teams.find(t => t.id === tid)?.name ?? '—',
          costShare,
          roi,
        }
      })
      .filter(r => r.project.estimatedValue != null || r.costShare != null)

    return [...rows].sort((a, b) => {
      let av: number, bv: number
      if (finSortKey === 'estimatedValue') {
        av = a.project.estimatedValue ?? -1
        bv = b.project.estimatedValue ?? -1
      } else if (finSortKey === 'roi') {
        av = a.roi ?? -1
        bv = b.roi ?? -1
      } else {
        return finSortDir === 'asc'
          ? a.project.name.localeCompare(b.project.name)
          : b.project.name.localeCompare(a.project.name)
      }
      return finSortDir === 'asc' ? av - bv : bv - av
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, members, teams, rateByRole, finSortKey, finSortDir])

  return (
    <div className="p-8 space-y-6">
      {/* Header + tab bar */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Portfolio Analytics</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          Showing {filtered.length} of {projects.length} projects
        </p>

        {/* Tab switcher — sits below the subtitle */}
        <div className="flex gap-1 mt-4 border-b border-slate-200 dark:border-slate-700">
          {(['charts', 'financial'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
              )}
            >
              {tab === 'financial' ? 'Financial' : 'Charts'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters — shown on both tabs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700">Filters</CardTitle>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={resetFilters}>Reset all</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {/* Search */}
            <div className="space-y-1 xl:col-span-2">
              <Label className="text-xs">Search projects</Label>
              <Input placeholder="Project name…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Domain */}
            <div className="space-y-1">
              <Label className="text-xs">Domain</Label>
              <Select value={filterDomain} onValueChange={v => { if (v) { setFilterDomain(v); setFilterTeam('__all__') } }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Domains</SelectItem>
                  {domains.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Team */}
            <div className="space-y-1">
              <Label className="text-xs">Team</Label>
              <Select value={filterTeam} onValueChange={v => v && setFilterTeam(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Teams</SelectItem>
                  {filteredTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Initiative */}
            <div className="space-y-1">
              <Label className="text-xs">Initiative</Label>
              <Select value={filterInitiative} onValueChange={v => v && setFilterInit(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Initiatives</SelectItem>
                  {initiatives.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Phase */}
            <div className="space-y-1">
              <Label className="text-xs">Phase</Label>
              <Select value={filterPhase} onValueChange={v => v && setFilterPhase(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Phases</SelectItem>
                  {phases.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={v => v && setFilterStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Statuses</SelectItem>
                  {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <Select value={filterPriority} onValueChange={v => v && setFilterPriority(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Priorities</SelectItem>
                  {(['Low','Medium','High','Critical'] as Priority[]).map(p =>
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="space-y-1">
              <Label className="text-xs">Target Date From</Label>
              <Input type="date" value={filterDateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target Date To</Label>
              <Input type="date" value={filterDateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Charts tab ─────────────────────────────────────────────────── */}
      {activeTab === 'charts' && <>

      {/* Charts 2×2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Projects by Phase</CardTitle></CardHeader>
          <CardContent><PhaseDonut data={phaseData} isDark={isDark} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Projects by Status</CardTitle></CardHeader>
          <CardContent><StatusBar data={statusData} isDark={isDark} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Capacity by Team</CardTitle>
            <p className="text-xs text-slate-400">Avg and max capacity across all team members</p>
          </CardHeader>
          <CardContent><TeamCapacityBar data={teamCapData} isDark={isDark} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Initiative Progress</CardTitle>
            <p className="text-xs text-slate-400">% of linked projects Complete</p>
          </CardHeader>
          <CardContent><InitiativeProgressBar data={initProgressData} isDark={isDark} /></CardContent>
        </Card>
      </div>

      {/* Project table */}
      <Card>
        <CardHeader className="pb-0 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              All Projects
              <span className="ml-2 text-slate-400 font-normal">({filtered.length})</span>
            </CardTitle>
            {filtered.length === 0 && hasFilters && (
              <Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400">
              <BarChart3 size={36} className="mb-3 opacity-30" />
              <p className="font-medium">No projects match these filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead col="name"            label="Project"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <TableHead>Domain</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <SortableHead col="phase"           label="Phase"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortableHead col="status"          label="Status"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortableHead col="priority"        label="Priority"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <TableHead>Initiative</TableHead>
                    <SortableHead col="percentComplete" label="% Done"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortableHead col="targetEndDate"   label="Target Date"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(p => {
                    const endDate = p.targetEndDate
                      ? new Date(p.targetEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                      : '—'
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-slate-800 max-w-[160px]">
                          <span className="truncate block" title={p.name}>{p.name}</span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">{domainName(p)}</TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">{teamName(p)}</TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-[130px]">
                          <span className="truncate block">{memberNames(p.assignments.map(a => a.memberId))}</span>
                        </TableCell>
                        <TableCell><ColorBadge className={PHASE_COLORS[p.phase]}>{p.phase}</ColorBadge></TableCell>
                        <TableCell><ColorBadge className={STATUS_COLORS[p.status]}>{p.status}</ColorBadge></TableCell>
                        <TableCell><ColorBadge className={PRIORITY_COLORS[p.priority]}>{p.priority}</ColorBadge></TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-[140px]">
                          <span className="truncate block">{initiativeName(p.initiativeId)}</span>
                        </TableCell>
                        <TableCell>
                          {/* Progress mini-bar — bg-slate-100 flips via global .dark override;
                              bg-blue-500 is hardcoded so we add an explicit dark: variant. */}
                          <div className="flex items-center gap-1.5 min-w-[60px]">
                            <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                                style={{ width: `${p.percentComplete}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">{p.percentComplete}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">{endDate}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Close the charts conditional fragment */}
      </>}

      {/* ── Financial tab ──────────────────────────────────────────────── */}
      {activeTab === 'financial' && <>

      {/* Summary stat cards — 4 across */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total annual headcount cost */}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Annual Headcount Cost</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {totalHeadcountCost > 0 ? fmtCompact(totalHeadcountCost) : '—'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {members.length} members · {resourceRates.length} roles rated
            </p>
          </CardContent>
        </Card>

        {/* Total estimated portfolio value */}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Estimated Project Value</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {totalEstimatedValue > 0 ? fmtCompact(totalEstimatedValue) : '—'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Non-Backlog projects only
            </p>
          </CardContent>
        </Card>

        {/* Portfolio ROI */}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Portfolio ROI</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {totalHeadcountCost > 0 && totalEstimatedValue > 0
                ? `${(totalEstimatedValue / totalHeadcountCost).toFixed(1)}×`
                : '—'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Est. value / annual headcount
            </p>
          </CardContent>
        </Card>

        {/* Projects with value defined */}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Projects with Value Defined</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{projectsWithValue}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              of {projects.length} total projects
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost by Team chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cost by Team</CardTitle>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Sum of annual rates for members in each team (teams with no rates hidden)
          </p>
        </CardHeader>
        <CardContent>
          {costByTeamData.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
              No rates defined yet — add role rates in Settings → Resource Rates.
            </div>
          ) : (
            <CostByTeamBar data={costByTeamData} isDark={isDark} />
          )}
        </CardContent>
      </Card>

      {/* Value by Initiative chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Value by Initiative</CardTitle>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Sum of estimated value for projects linked to each initiative
          </p>
        </CardHeader>
        <CardContent>
          {valueByInitiativeData.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
              No project values defined yet — add Estimated Value on individual projects.
            </div>
          ) : (
            <ValueByInitiativeBar data={valueByInitiativeData} isDark={isDark} />
          )}
        </CardContent>
      </Card>

      {/* Project Financial Table */}
      <Card>
        <CardHeader className="pb-0 pt-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-slate-400" />
            <CardTitle className="text-sm">
              Project Financial Summary
              <span className="ml-2 text-slate-400 font-normal">({finTableRows.length})</span>
            </CardTitle>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-0">
            Projects with an estimated value or calculable cost share. Backlog excluded.
          </p>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          {finTableRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400">
              <BarChart3 size={36} className="mb-3 opacity-30" />
              <p className="font-medium">No financial data yet</p>
              <p className="text-xs mt-1">Add Estimated Value on projects and rate roles in Settings.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Sortable: name, estimatedValue, roi */}
                    <TableHead
                      className="cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200"
                      onClick={() => handleFinSort('name')}
                    >
                      <span className="inline-flex items-center">
                        Project
                        {finSortKey === 'name'
                          ? (finSortDir === 'asc' ? <ChevronUp size={13} className="text-blue-500 ml-1" /> : <ChevronDown size={13} className="text-blue-500 ml-1" />)
                          : <ChevronsUpDown size={13} className="text-slate-300 ml-1" />}
                      </span>
                    </TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Value Type</TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200"
                      onClick={() => handleFinSort('estimatedValue')}
                    >
                      <span className="inline-flex items-center">
                        Est. Value
                        {finSortKey === 'estimatedValue'
                          ? (finSortDir === 'asc' ? <ChevronUp size={13} className="text-blue-500 ml-1" /> : <ChevronDown size={13} className="text-blue-500 ml-1" />)
                          : <ChevronsUpDown size={13} className="text-slate-300 ml-1" />}
                      </span>
                    </TableHead>
                    <TableHead>Actual Value</TableHead>
                    <TableHead>Cost Share</TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200"
                      onClick={() => handleFinSort('roi')}
                    >
                      <span className="inline-flex items-center">
                        ROI
                        {finSortKey === 'roi'
                          ? (finSortDir === 'asc' ? <ChevronUp size={13} className="text-blue-500 ml-1" /> : <ChevronDown size={13} className="text-blue-500 ml-1" />)
                          : <ChevronsUpDown size={13} className="text-slate-300 ml-1" />}
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finTableRows.map(({ project: p, teamName: tn, costShare, roi }) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-slate-800 dark:text-slate-200 max-w-[180px]">
                        <span className="truncate block" title={p.name}>{p.name}</span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{tn}</TableCell>
                      <TableCell>
                        {p.valueType ? (
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[11px] font-medium',
                            p.valueType === 'Revenue Impact'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                          )}>
                            {p.valueType}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {p.estimatedValue != null ? fmtFull(p.estimatedValue) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {p.actualValue != null ? fmtFull(p.actualValue) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {costShare != null ? fmtFull(costShare) : '—'}
                      </TableCell>
                      <TableCell className="text-sm font-semibold whitespace-nowrap">
                        {roi != null ? (
                          <span className={roi >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                            {roi.toFixed(1)}×
                          </span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Close the financial conditional fragment */}
      </>}

    </div>
  )
}
