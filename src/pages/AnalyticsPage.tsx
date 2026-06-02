/**
 * AnalyticsPage — Portfolio-wide analytics with charts and a sortable/filterable
 * project table.
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
import { BarChart3, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
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
import type { Project, ProjectPhase, ProjectStatus, Priority } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

// localStorage key for persisted filter state.
const FILTER_STORAGE_KEY = 'sat-analytics-filters'

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = keyof Pick<Project, 'name' | 'phase' | 'status' | 'priority' | 'percentComplete' | 'targetEndDate'>
type SortDir = 'asc' | 'desc'

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

// ─── Analytics page ───────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const { domains, teams, members, projects, initiatives } = usePortfolioStore()

  // Track dark mode so we can pass `isDark` into chart sub-components.
  const { isDark } = useTheme()

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

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Portfolio Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Showing {filtered.length} of {projects.length} projects
        </p>
      </div>

      {/* Filters */}
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
    </div>
  )
}
