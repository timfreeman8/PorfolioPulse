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
import { memo, useRef, useState, useMemo, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  BarChart3, ChevronUp, ChevronDown, ChevronsUpDown, TrendingUp,
  Search, X, CheckCircle2, Clock, AlertCircle, Layers2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorBadge } from '@/components/ui/color-badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { StatCard } from '@/components/ui/stat-card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useShallow } from 'zustand/react/shallow'
import {
  CHART_COLORS, STATUS_COLORS, PHASE_COLORS, PRIORITY_COLORS,
} from '@/lib/colors'
import { useTheme } from '@/lib/useTheme'
import { cn } from '@/lib/utils'
import { fmtDateShort } from '@/lib/format'
import type { Project, ProjectPhase, ProjectStatus, Priority, Member, Team, Domain, Initiative } from '@/types'

// ─── Analytics project table row ──────────────────────────────────────────────
/**
 * AnalyticsProjectRow — a single row in the project table on the Charts tab.
 *
 * Wrapped with React.memo so that sorting or filtering other projects (which
 * causes the parent to re-render) does not re-render rows whose project data
 * hasn't changed.
 *
 * All Maps are stable `useMemo` references passed from the parent, so prop
 * comparison is O(1) (reference equality). The row only re-renders when its
 * `project` object reference changes (i.e. the project was actually edited).
 */
const AnalyticsProjectRow = memo(function AnalyticsProjectRow({
  project,
  memberMap,
  teamMap,
  domainMap,
  initiativeMap,
  memberTeamMap,
  teamDomainMap,
}: {
  project: Project
  memberMap:      Map<string, Member>
  teamMap:        Map<string, Team>
  domainMap:      Map<string, Domain>
  initiativeMap:  Map<string, Initiative>
  /** memberId → teamIds[] — used to resolve a project's primary team. */
  memberTeamMap:  Map<string, string[]>
  /** teamId → domainId — used to resolve a project's domain. */
  teamDomainMap:  Map<string, string>
}) {
  // Resolve a project's primary team by walking assignments → memberTeamMap.
  const primaryTeamId = project.assignments
    .flatMap(a => memberTeamMap.get(a.memberId) ?? [])
    .find(Boolean) ?? ''
  const primaryDomainId = primaryTeamId ? (teamDomainMap.get(primaryTeamId) ?? '') : ''

  const domain   = primaryDomainId ? (domainMap.get(primaryDomainId)?.name  ?? '—') : '—'
  const team     = primaryTeamId   ? (teamMap.get(primaryTeamId)?.name      ?? '—') : '—'
  const assignees = [...new Set(project.assignments.map(a => a.memberId))]
    .map(id => memberMap.get(id)?.name ?? '?')
    .join(', ')
  const initiative = project.initiativeId ? (initiativeMap.get(project.initiativeId)?.name ?? '—') : '—'
  const endDate    = fmtDateShort(project.targetEndDate)

  return (
    <TableRow key={project.id}>
      <TableCell className="font-medium text-slate-800 max-w-[160px]">
        <span className="truncate block" title={project.name}>{project.name}</span>
      </TableCell>
      <TableCell className="text-xs text-slate-500 whitespace-nowrap">{domain}</TableCell>
      <TableCell className="text-xs text-slate-500 whitespace-nowrap">{team}</TableCell>
      <TableCell className="text-xs text-slate-500 max-w-[130px]">
        <span className="truncate block">{assignees}</span>
      </TableCell>
      <TableCell><ColorBadge className={PHASE_COLORS[project.phase]}>{project.phase}</ColorBadge></TableCell>
      <TableCell><ColorBadge className={STATUS_COLORS[project.status]}>{project.status}</ColorBadge></TableCell>
      <TableCell><ColorBadge className={PRIORITY_COLORS[project.priority]}>{project.priority}</ColorBadge></TableCell>
      <TableCell className="text-xs text-slate-500 max-w-[140px]">
        <span className="truncate block">{initiative}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 min-w-[60px]">
          <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
              style={{ width: `${project.percentComplete}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">{project.percentComplete}%</span>
        </div>
      </TableCell>
      <TableCell className="text-xs text-slate-500 whitespace-nowrap">{endDate}</TableCell>
    </TableRow>
  )
})

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

/** Shape stored in localStorage for filter persistence. Arrays = multi-select. */
interface PersistedFilters {
  domains: string[]
  teams: string[]
  initiatives: string[]
  phases: string[]
  statuses: string[]
  priorities: string[]
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
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    // Migrate: old shape used single strings with '--all--'/'__all__' sentinels.
    // New shape uses string arrays (empty = no filter). If a field is a string,
    // convert to array; if it's '__all__' or '--all--', use empty array.
    const toArr = (v: unknown): string[] => {
      if (Array.isArray(v)) return v as string[]
      if (typeof v === 'string' && v !== '__all__' && v !== '--all--' && v) return [v]
      return []
    }
    return {
      domains:     toArr(parsed.domain    ?? parsed.domains),
      teams:       toArr(parsed.team      ?? parsed.teams),
      initiatives: toArr(parsed.initiative ?? parsed.initiatives),
      phases:      toArr(parsed.phase     ?? parsed.phases),
      statuses:    toArr(parsed.status    ?? parsed.statuses),
      priorities:  toArr(parsed.priority  ?? parsed.priorities),
      dateFrom:    typeof parsed.dateFrom === 'string' ? parsed.dateFrom : '',
      dateTo:      typeof parsed.dateTo   === 'string' ? parsed.dateTo   : '',
      search:      typeof parsed.search   === 'string' ? parsed.search   : '',
    }
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
  domains:     [],
  teams:       [],
  initiatives: [],
  phases:      [],
  statuses:    [],
  priorities:  [],
  dateFrom:    '',
  dateTo:      '',
  search:      '',
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

// Generic sort icon — works for any string-keyed sort column.
function SortIcon<K extends string>({ col, sortKey, sortDir }: { col: K; sortKey: K; sortDir: 'asc' | 'desc' }) {
  if (col !== sortKey) return <ChevronsUpDown size={13} className="text-slate-300 ml-1" />
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-blue-500 ml-1" />
    : <ChevronDown size={13} className="text-blue-500 ml-1" />
}

// Generic sortable table header — reused by both the Charts and Financial tables.
function SortableHead<K extends string>({
  col, label, sortKey, sortDir, onSort,
}: {
  col: K; label: string
  sortKey: K; sortDir: 'asc' | 'desc'
  onSort: (c: K) => void
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
  // useShallow prevents re-renders caused by mutations to unrelated slices of
  // the store (e.g. adding a PTO block shouldn't re-render the analytics page).
  const { domains, teams, members, projects, initiatives, resourceRates } = usePortfolioStore(
    useShallow(s => ({
      domains:       s.domains,
      teams:         s.teams,
      members:       s.members,
      projects:      s.projects,
      initiatives:   s.initiatives,
      resourceRates: s.resourceRates,
    }))
  )

  // Track dark mode so we can pass `isDark` into chart sub-components.
  const { isDark } = useTheme()

  // Active tab: 'charts' (existing) or 'financial' (new).
  const [activeTab, setActiveTab] = useState<'charts' | 'financial'>('charts')

  // ── Filters — initialised from localStorage if available ─────────────────
  // Each useState uses a lazy initialiser (() => ...) so loadFilters() runs
  // exactly once on mount and is skipped on every subsequent render.
  const [filterDomains,    setFilterDomains]   = useState<string[]>(() => (loadFilters() ?? DEFAULT_FILTERS).domains)
  const [filterTeams,      setFilterTeams]     = useState<string[]>(() => (loadFilters() ?? DEFAULT_FILTERS).teams)
  const [filterInits,      setFilterInits]     = useState<string[]>(() => (loadFilters() ?? DEFAULT_FILTERS).initiatives)
  const [filterPhases,     setFilterPhases]    = useState<string[]>(() => (loadFilters() ?? DEFAULT_FILTERS).phases)
  const [filterStatuses,   setFilterStatuses]  = useState<string[]>(() => (loadFilters() ?? DEFAULT_FILTERS).statuses)
  const [filterPriorities, setFilterPriorities]= useState<string[]>(() => (loadFilters() ?? DEFAULT_FILTERS).priorities)
  const [filterDateFrom,   setDateFrom]        = useState(() => (loadFilters() ?? DEFAULT_FILTERS).dateFrom)
  const [filterDateTo,     setDateTo]          = useState(() => (loadFilters() ?? DEFAULT_FILTERS).dateTo)
  const [search,           setSearch]          = useState(() => (loadFilters() ?? DEFAULT_FILTERS).search)

  // ── Persist filters to localStorage on every change ──────────────────────
  useEffect(() => {
    saveFilters({
      domains:     filterDomains,
      teams:       filterTeams,
      initiatives: filterInits,
      phases:      filterPhases,
      statuses:    filterStatuses,
      priorities:  filterPriorities,
      dateFrom:    filterDateFrom,
      dateTo:      filterDateTo,
      search,
    })
  }, [filterDomains, filterTeams, filterInits, filterPhases, filterStatuses, filterPriorities, filterDateFrom, filterDateTo, search])

  // ── Sort ─────────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('asc') }
  }

  // ── Derived: member→team→domain lookup ───────────────────────────────────
  // Pre-built Maps for O(1) entity lookups — avoids O(n²) .find() calls in
  // filter loops and per-row render functions (memberNames, teamName, domainName).
  const memberTeamMap  = useMemo(() => new Map(members.map(m => [m.id, m.teamIds])), [members])
  const memberMap      = useMemo(() => new Map(members.map(m => [m.id, m])), [members])
  const teamDomainMap  = useMemo(() => new Map(teams.map(t => [t.id, t.domainId])), [teams])
  const teamMap        = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams])
  const domainMap      = useMemo(() => new Map(domains.map(d => [d.id, d])), [domains])
  const initiativeMap  = useMemo(() => new Map(initiatives.map(i => [i.id, i])), [initiatives])

  // Resolve domain/team for a project by walking its assignments through the
  // member→team→domain maps. Takes the first team found (projects are typically
  // owned by one team). Stable between renders as long as the maps are stable.
  const projectTeamId = useMemo(() => (p: Project): string =>
    p.assignments.flatMap(a => memberTeamMap.get(a.memberId) ?? []).find(Boolean) ?? '',
  [memberTeamMap])

  const projectDomainId = useMemo(() => (p: Project): string => {
    const teamId = projectTeamId(p)
    return teamId ? (teamDomainMap.get(teamId) ?? '') : ''
  }, [projectTeamId, teamDomainMap])

  // ── Filtered projects ─────────────────────────────────────────────────────
  // Empty array = "no filter" (show all). Non-empty = must include at least one.
  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (filterDomains.length    > 0 && !filterDomains.includes(projectDomainId(p)))    return false
      if (filterTeams.length      > 0 && !filterTeams.includes(projectTeamId(p)))        return false
      if (filterInits.length      > 0 && !filterInits.includes(p.initiativeId ?? ''))   return false
      if (filterPhases.length     > 0 && !filterPhases.includes(p.phase))               return false
      if (filterStatuses.length   > 0 && !filterStatuses.includes(p.status))            return false
      if (filterPriorities.length > 0 && !filterPriorities.includes(p.priority))        return false
      if (filterDateFrom && p.targetEndDate && p.targetEndDate < filterDateFrom)         return false
      if (filterDateTo   && p.targetEndDate && p.targetEndDate > filterDateTo)           return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()))                return false
      return true
    })
  }, [projects, filterDomains, filterTeams, filterInits, filterPhases, filterStatuses, filterPriorities, filterDateFrom, filterDateTo, search, projectDomainId, projectTeamId])

  // ── Sorted ────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  // ── Project table virtualizer ─────────────────────────────────────────────
  // Scroll container ref for the project table — gives the virtualizer a DOM
  // element whose clientHeight/scrollTop it can read.
  const tableScrollRef = useRef<HTMLDivElement>(null)

  // `useVirtualizer` only mounts rows visible within the scroll container.
  // At 30 rows this is invisible; at 5,000+ rows it keeps the DOM small and
  // the browser compositing fast. estimateSize should approximate the real
  // rendered row height — 48px matches the TableRow padding.
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => 48,
    overscan: 5, // render 5 extra rows above/below viewport for smooth scroll
  })

  const virtualRows   = rowVirtualizer.getVirtualItems()
  const totalHeight   = rowVirtualizer.getTotalSize()
  // Spacer heights: amount of space before the first visible row and after
  // the last visible row. The spacer <tr>s below preserve scroll height
  // without rendering off-screen DOM nodes.
  const paddingTop    = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom = virtualRows.length > 0
    ? totalHeight - virtualRows[virtualRows.length - 1].end
    : 0

  // ── Teams available for filter ────────────────────────────────────────────
  // When domain filters are active, only show teams within those domains.
  const filteredTeams = filterDomains.length === 0
    ? teams
    : teams.filter(t => filterDomains.includes(t.domainId))

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

  // Helpers previously computed member/team/domain/initiative names inline —
  // these are now handled inside AnalyticsProjectRow (which receives the Maps
  // directly so it can do the lookups itself without closure captures).

  function resetFilters() {
    setFilterDomains([]); setFilterTeams([]); setFilterInits([])
    setFilterPhases([]); setFilterStatuses([]); setFilterPriorities([])
    setDateFrom(''); setDateTo(''); setSearch('')
  }

  const hasFilters =
    [filterDomains, filterTeams, filterInits, filterPhases, filterStatuses, filterPriorities].some(a => a.length > 0)
    || filterDateFrom || filterDateTo || search

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

  // Stat counts derived from filtered projects for the stats bar.
  const inProgressCount = filtered.filter(p => p.status === 'In Progress').length
  const blockedCount    = filtered.filter(p => p.status === 'Blocked').length
  const completeCount   = filtered.filter(p => p.status === 'Complete').length

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      {/* Header + tab bar */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Portfolio Analytics</h1>

        {/* Tab switcher — same SegmentedControl used on Planning and PTO pages */}
        <div className="mt-3">
          <SegmentedControl
            options={[
              { value: 'charts',    label: 'Charts' },
              { value: 'financial', label: 'Financial' },
            ] as { value: 'charts' | 'financial'; label: string }[]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </div>

      {/* ── Stats bar — mirrors OrgPage's StatCard grid ───────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label={`of ${projects.length} total`}
          value={filtered.length}
          icon={<Layers2 size={18} />}
          iconColor="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        />
        <StatCard
          label="In Progress"
          value={inProgressCount}
          icon={<Clock size={18} />}
          iconColor="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
        />
        <StatCard
          label="Blocked"
          value={blockedCount}
          icon={<AlertCircle size={18} />}
          iconColor="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          cardTint={blockedCount > 0 ? 'bg-red-50/50 dark:bg-red-950/10' : undefined}
        />
        <StatCard
          label="Complete"
          value={completeCount}
          icon={<CheckCircle2 size={18} />}
          iconColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        />
      </div>

      {/* ── Inline filter bar — search + MultiSelectDropdowns matching OrgPage ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search with icon + clear */}
        <div className="relative shrink-0 w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-8 h-9 text-sm dark:bg-slate-800 dark:border-slate-600"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* "Filter" section label — matches Planning page style */}
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 ml-3">Filter</span>

        {/* Domain — clearing domain also clears teams (dependent filter) */}
        <MultiSelectDropdown
          label="Domain"
          options={domains.map(d => ({ id: d.id, label: d.name }))}
          selected={filterDomains}
          onChange={v => { setFilterDomains(v); setFilterTeams([]) }}
        />

        {/* Team — restricted to selected domains when any are active */}
        <MultiSelectDropdown
          label="Team"
          options={filteredTeams.map(t => ({ id: t.id, label: t.name }))}
          selected={filterTeams}
          onChange={setFilterTeams}
        />

        <MultiSelectDropdown
          label="Initiative"
          options={initiatives.map(i => ({ id: i.id, label: i.name }))}
          selected={filterInits}
          onChange={setFilterInits}
        />

        <MultiSelectDropdown
          label="Phase"
          options={phases.map(p => ({ id: p, label: p }))}
          selected={filterPhases}
          onChange={setFilterPhases}
        />

        <MultiSelectDropdown
          label="Status"
          options={statuses.map(s => ({ id: s, label: s }))}
          selected={filterStatuses}
          onChange={setFilterStatuses}
        />

        <MultiSelectDropdown
          label="Priority"
          options={(['Low','Medium','High','Critical'] as Priority[]).map(p => ({ id: p, label: p }))}
          selected={filterPriorities}
          onChange={setFilterPriorities}
        />

        {/* Date range */}
        <Input
          type="date"
          value={filterDateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="h-9 w-36 text-sm dark:bg-slate-800 dark:border-slate-600"
          title="Target date from"
        />
        <Input
          type="date"
          value={filterDateTo}
          onChange={e => setDateTo(e.target.value)}
          className="h-9 w-36 text-sm dark:bg-slate-800 dark:border-slate-600"
          title="Target date to"
        />

        {hasFilters && (
          <button
            onClick={resetFilters}
            className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-1"
          >
            Reset all
          </button>
        )}
      </div>

      {/* ── Charts tab ─────────────────────────────────────────────────── */}
      {activeTab === 'charts' && <>

      {/* Charts 2×2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Epics by Phase</CardTitle></CardHeader>
          <CardContent><PhaseDonut data={phaseData} isDark={isDark} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Epics by Status</CardTitle></CardHeader>
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
              All Epics
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
            /* Fixed-height scroll container — the virtualizer measures scroll position
               here. maxHeight caps the table at 60vh so the rest of the page remains
               accessible without virtualizing the whole page. overflow-x-auto keeps
               the horizontal scrollbar for narrow viewports. */
            <div
              ref={tableScrollRef}
              className="overflow-x-auto overflow-y-auto"
              style={{ maxHeight: '60vh' }}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead col="name"            label="Epic"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
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
                  {/* Spacer row above virtual items — creates scroll space for
                      off-screen rows above the viewport without mounting them. */}
                  {paddingTop > 0 && (
                    <tr><td style={{ height: paddingTop }} /></tr>
                  )}
                  {/* Only the rows visible (+ overscan) in the scroll window are mounted. */}
                  {virtualRows.map(vRow => {
                    const p = sorted[vRow.index]
                    return (
                      <AnalyticsProjectRow
                        key={p.id}
                        project={p}
                        memberMap={memberMap}
                        teamMap={teamMap}
                        domainMap={domainMap}
                        initiativeMap={initiativeMap}
                        memberTeamMap={memberTeamMap}
                        teamDomainMap={teamDomainMap}
                      />
                    )
                  })}
                  {/* Spacer row below virtual items — creates scroll space for
                      off-screen rows below the viewport. */}
                  {paddingBottom > 0 && (
                    <tr><td style={{ height: paddingBottom }} /></tr>
                  )}
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Estimated Epic Value</p>
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Epics with Value Defined</p>
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
                    <SortableHead col="name"           label="Epic"       sortKey={finSortKey} sortDir={finSortDir} onSort={handleFinSort} />
                    <TableHead>Team</TableHead>
                    <TableHead>Value Type</TableHead>
                    <SortableHead col="estimatedValue" label="Est. Value"  sortKey={finSortKey} sortDir={finSortDir} onSort={handleFinSort} />
                    <TableHead>Actual Value</TableHead>
                    <TableHead>Cost Share</TableHead>
                    <SortableHead col="roi"            label="ROI"         sortKey={finSortKey} sortDir={finSortDir} onSort={handleFinSort} />
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
