/**
 * Projects page — flat list of every project in the portfolio.
 *
 * Unlike the member-centric views (Teams, Capacity), this page focuses on
 * the work itself. Projects with no members assigned yet are shown here so
 * they can be tracked, refined, and eventually staffed.
 *
 * Features:
 *   - Search by name
 *   - Filter by Phase, Status, Priority
 *   - Sort by name, start date, or % complete
 *   - Add / edit projects via the full-page ProjectDetailPage builder
 *   - Delete with confirmation
 *   - Unassigned projects are flagged so they stand out
 */
import { memo, useState, useMemo, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Plus, Search, Trash2, Pencil, UserX, Download, ChevronDown, Check, SearchX, Layers, List, LayoutGrid } from 'lucide-react'
import { FilterChip } from '@/components/ui/filter-chip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { JiraImportDialog } from '@/components/projects/JiraImportDialog'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useViewStore } from '@/store/useViewStore'
import { exportProjectsCsv, downloadCsv } from '@/lib/csv'
import {
  STATUS_COLORS, PHASE_COLORS, PRIORITY_COLORS,
} from '@/lib/colors'
import { cn } from '@/lib/utils'
import { fmtDate } from '@/lib/format'
import type { Project } from '@/types'

type SortKey = 'name' | 'startDate' | 'percentComplete'

// ─── Stakeholder helpers ───────────────────────────────────────────────────

/**
 * Parse a project's stakeholders string (comma-separated) into a trimmed
 * array of group names. Returns [] when the field is empty.
 */
function parseStakeholders(raw: string): string[] {
  if (!raw?.trim()) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

/**
 * Collect every unique stakeholder group name across all projects,
 * sorted alphabetically. Used to build the filter chip list.
 */
function allStakeholderGroups(projects: Project[]): string[] {
  const set = new Set<string>()
  for (const p of projects) parseStakeholders(p.stakeholders).forEach(s => set.add(s))
  return [...set].sort()
}

// ─── Helpers ──────────────────────────────────────────────────────────────

// ─── Progress bar ─────────────────────────────────────────────────────────
// Visual fill bar showing % complete for a project.

function ProgressBar({ value }: { value: number }) {
  const color =
    value >= 100 ? 'bg-green-500' :
    value >= 60  ? 'bg-blue-500'  :
    value > 0    ? 'bg-slate-400' : 'bg-slate-200'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden" style={{ minWidth: 48 }}>
        <div className={cn('h-full rounded-full', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">{value}%</span>
    </div>
  )
}

// ─── Stakeholder multiselect dropdown ─────────────────────────────────────
// Renders a trigger button (styled like FilterChip) that opens a checklist
// panel. Click outside or press Escape to close. Shows selected count when
// one or more groups are chosen.

function StakeholderDropdown({
  groups, selected, onChange,
}: {
  groups: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const ref                   = useRef<HTMLDivElement>(null)
  const searchRef             = useRef<HTMLInputElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Focus search when opened
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0)
  }, [open])

  function toggle(group: string) {
    onChange(selected.includes(group) ? selected.filter(g => g !== group) : [...selected, group])
  }

  const filtered    = query ? groups.filter(g => g.toLowerCase().includes(query.toLowerCase())) : groups
  const hasSelection = selected.length > 0
  const label        = hasSelection ? `Stakeholder (${selected.length})` : 'Stakeholder'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'h-9 flex items-center gap-1 px-3 rounded-md text-xs font-medium transition-all border',
          hasSelection
            ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500',
        )}
      >
        {label}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden w-52">
          {/* Search input */}
          <div className="px-2 pt-2 pb-1 border-b border-slate-100 dark:border-slate-700">
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full pl-6 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 outline-none focus:border-primary placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Clear all */}
          {hasSelection && (
            <button
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 border-b border-slate-100 dark:border-slate-700"
            >
              Clear all ({selected.length})
            </button>
          )}

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400 italic">No matches</p>
            ) : filtered.map(group => {
              const checked = selected.includes(group)
              return (
                <button
                  key={group}
                  onClick={() => toggle(group)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors whitespace-nowrap"
                >
                  <span className={cn(
                    'w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border',
                    checked ? 'bg-slate-900 border-slate-900 dark:bg-slate-200 dark:border-slate-200' : 'bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-500',
                  )}>
                    {checked && <Check size={9} className="text-white dark:text-slate-900" strokeWidth={3} />}
                  </span>
                  {group}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Project card (grid view) ─────────────────────────────────────────────
/**
 * ProjectCard — single card in the grid view of ProjectsPage.
 *
 * Extracted as a named component so React.memo can skip re-rendering cards
 * whose project data hasn't changed when an unrelated project in the list
 * is updated (e.g. user opens a different card and saves).
 *
 * Reads `deleteProject` directly from the store (single-key selector) to avoid
 * passing an unstable callback prop that would defeat the memo.
 *
 * Props `memberMap` and `initiativeMap` come from `useMemo` in the parent —
 * they hold the same reference between renders unless the underlying data
 * changes, so passing them here is memo-safe.
 */
const ProjectCard = memo(function ProjectCard({
  project,
  memberMap,
  initiativeMap,
  isAdmin,
}: {
  project: Project
  memberMap: Map<string, { id: string; name: string }>
  initiativeMap: Map<string, { id: string; name: string }>
  isAdmin: boolean
}) {
  const navigate = useNavigate()
  // Single-key selector so ProjectCard never re-renders from unrelated store slices.
  const deleteProject = usePortfolioStore(s => s.deleteProject)

  const initiative = initiativeMap.get(project.initiativeId ?? '')
  const assignedMemberObjs = [...new Set(project.assignments.map(a => a.memberId))]
    .map(id => memberMap.get(id))
    .filter(Boolean) as Array<{ id: string; name: string }>
  const isUnassigned = project.assignments.length === 0

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm('Delete this project? This cannot be undone.')) deleteProject(project.id)
  }

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className={cn(
        'group relative flex flex-col gap-3 bg-white dark:bg-slate-800/60 border rounded-xl p-4',
        'hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all cursor-pointer',
        isUnassigned ? 'border-amber-200 dark:border-amber-800/50' : 'border-slate-200 dark:border-slate-700',
      )}
    >
      {/* Action buttons — top-right corner, shown on hover */}
      <div
        className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => navigate(`/projects/${project.id}`)}
          className="p-1 rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
          title="Edit"
        >
          <Pencil size={12} />
        </button>
        {isAdmin && (
          <button
            onClick={handleDelete}
            className="p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/40 transition-colors"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Row 1: Epic name */}
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight pr-12 line-clamp-2">
        {project.name}
        {isUnassigned && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 align-middle">
            <UserX size={8} /> Unassigned
          </span>
        )}
      </p>

      {/* Row 2: Description */}
      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-snug line-clamp-2">
        {project.description || (initiative ? initiative.name : '—')}
      </p>

      {/* Row 3: Status + Priority chips */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none', STATUS_COLORS[project.status])}>
          {project.status}
        </span>
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none', PRIORITY_COLORS[project.priority])}>
          {project.priority}
        </span>
      </div>

      {/* Row 4: Phase chip + % label, then a thin progress bar below */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-1">
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none', PHASE_COLORS[project.phase])}>
            {project.phase}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {project.percentComplete}%
          </span>
        </div>
        <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${project.percentComplete}%` }}
          />
        </div>
      </div>

      {/* Row 5: People — comma-separated names */}
      {assignedMemberObjs.length > 0 && (
        <div className="flex items-center gap-x-1.5 gap-y-0.5 flex-wrap">
          {assignedMemberObjs.slice(0, 4).map((m, i) => (
            <span key={m.id} className="text-[10px] text-slate-500 dark:text-slate-400 leading-none">
              {m.name}{i < Math.min(assignedMemberObjs.length, 4) - 1 ? ',' : ''}
            </span>
          ))}
          {assignedMemberObjs.length > 4 && (
            <span className="text-[10px] text-slate-400">+{assignedMemberObjs.length - 4} more</span>
          )}
        </div>
      )}
    </div>
  )
})

// ─── Projects page ────────────────────────────────────────────────────────

export function ProjectsPage() {
  // useShallow prevents re-renders when unrelated slices change (e.g. teams, domains).
  const { projects, members, initiatives, deleteProject } = usePortfolioStore(
    useShallow(s => ({
      projects: s.projects,
      members: s.members,
      initiatives: s.initiatives,
      deleteProject: s.deleteProject,
    }))
  )
  // User mode: activeMemberId is set → filter to that person's projects only.
  const { activeMemberId } = useViewStore()
  const navigate = useNavigate()
  const isAdmin  = activeMemberId === null

  // O(1) lookup Maps — replace O(n) .find() calls in the render loops below.
  const memberMap     = useMemo(() => new Map(members.map(m => [m.id, m])), [members])
  const initiativeMap = useMemo(() => new Map(initiatives.map(i => [i.id, i])), [initiatives])

  const [search, setSearch]           = useState('')
  const [sortKey, setSortKey]         = useState<SortKey>('startDate')
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false)
  // [] = no filter; non-empty = show only projects that match any selected group
  const [stakeholderFilter, setStakeholderFilter] = useState<string[]>([])
  const [jiraImportOpen, setJiraImportOpen] = useState(false)
  const [viewMode, setViewMode]             = useState<'grid' | 'list'>('grid')

  const filtered = useMemo(() => {
    let list = [...projects]

    // In User mode, only show projects the active member is assigned to.
    if (!isAdmin) {
      list = list.filter(p => p.assignments.some(a => a.memberId === activeMemberId))
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    }
    // Unassigned filter only makes sense in Admin mode (user always has assignments).
    if (isAdmin && showUnassignedOnly) list = list.filter(p => p.assignments.length === 0)

    // Stakeholder filter: keep projects that match any of the selected groups
    if (stakeholderFilter.length > 0) {
      list = list.filter(p => parseStakeholders(p.stakeholders).some(g => stakeholderFilter.includes(g)))
    }

    list.sort((a, b) => {
      if (sortKey === 'name')            return a.name.localeCompare(b.name)
      if (sortKey === 'startDate')       return (a.startDate ?? '').localeCompare(b.startDate ?? '')
      if (sortKey === 'percentComplete') return b.percentComplete - a.percentComplete
      return 0
    })

    return list
  }, [projects, search, showUnassignedOnly, stakeholderFilter, sortKey, activeMemberId, isAdmin])

  // All unique stakeholder groups derived from the full (unfiltered) project list.
  // Computed outside the filtered memo so chips always show all options.
  const stakeholderGroups = useMemo(() => allStakeholderGroups(projects), [projects])

  const unassignedCount = projects.filter(p => p.assignments.length === 0).length

  // ── Grid view virtualizer ─────────────────────────────────────────────────
  // Chunk filtered projects into rows of GRID_COLS so the virtualizer operates
  // on rows (each containing N cards) rather than individual items.
  // GRID_COLS matches the xl:grid-cols-3 CSS breakpoint on wide screens.
  // On narrower viewports (1–2 col breakpoints) cards just fill fewer slots per
  // row — the grid CSS handles the actual layout; GRID_COLS only affects how
  // many projects we put in each virtual chunk.
  const GRID_COLS = 3
  const gridRows = useMemo(() => {
    const rows: Project[][] = []
    for (let i = 0; i < filtered.length; i += GRID_COLS) {
      rows.push(filtered.slice(i, i + GRID_COLS))
    }
    return rows
  }, [filtered])

  const gridScrollRef = useRef<HTMLDivElement>(null)
  const gridVirtualizer = useVirtualizer({
    count: gridRows.length,
    getScrollElement: () => gridScrollRef.current,
    estimateSize: () => 190, // approximate card height including gap
    overscan: 2,
  })
  const virtualGridRows    = gridVirtualizer.getVirtualItems()
  const gridTotalSize      = gridVirtualizer.getTotalSize()
  const gridPaddingTop     = virtualGridRows.length > 0 ? virtualGridRows[0].start : 0
  const gridPaddingBottom  = virtualGridRows.length > 0
    ? gridTotalSize - virtualGridRows[virtualGridRows.length - 1].end
    : 0

  // ── List view virtualizer ──────────────────────────────────────────────────
  // Scroll container for the list-view table. The grid view virtualizer uses
  // a separate ref (gridScrollRef) since the two views can't share a scroll
  // container — they are in separate branches of the conditional render.
  const listScrollRef = useRef<HTMLDivElement>(null)
  const listVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 44, // approximate height of one TableRow
    overscan: 5,
  })
  const listVirtualRows   = listVirtualizer.getVirtualItems()
  const listTotalHeight   = listVirtualizer.getTotalSize()
  const listPaddingTop    = listVirtualRows.length > 0 ? listVirtualRows[0].start : 0
  const listPaddingBottom = listVirtualRows.length > 0
    ? listTotalHeight - listVirtualRows[listVirtualRows.length - 1].end
    : 0

  function handleDelete(id: string) {
    if (window.confirm('Delete this project? This cannot be undone.')) deleteProject(id)
  }

  /** Export the currently visible (filtered) project list as a CSV download. */
  function handleExportCsv() {
    const ts = new Date().toISOString().slice(0, 10)
    downloadCsv(`projects-${ts}.csv`, exportProjectsCsv(filtered, initiatives))
  }

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full flex flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Epics</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {projects.length} total
            {unassignedCount > 0 && (
              <> · <span className="text-amber-600 dark:text-amber-400 font-medium">{unassignedCount} unassigned</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Primary action first */}
          {isAdmin && (
            <Button
              onClick={() => navigate('/epics/new')}
              className="gap-2"
            >
              <Plus size={15} />
              Add Epic
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setJiraImportOpen(true)}
              className="gap-2"
            >
              <Download size={15} />
              Import from Jira
            </Button>
          )}
          {/* Export respects current filters — exports only what the user sees */}
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="gap-2"
          >
            <Download size={15} />
            Export CSV
            {filtered.length !== projects.length && (
              <span className="text-xs text-slate-400">({filtered.length})</span>
            )}
          </Button>
        </div>
      </div>

      {/* Search + filters — all in one row */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search epics…"
            className="pl-8 h-9 text-sm"
          />
        </div>

        {/* Sort label — matches Planning page "Filter" label style */}
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 ml-1">Sort</span>
        <FilterChip label="Date"   active={sortKey === 'startDate'}       onClick={() => setSortKey('startDate')} />
        <FilterChip label="Name"   active={sortKey === 'name'}            onClick={() => setSortKey('name')} />
        {isAdmin && (
          <FilterChip
            label="Unassigned"
            active={showUnassignedOnly}
            onClick={() => setShowUnassignedOnly(v => !v)}
          />
        )}
        <FilterChip label="% Done" active={sortKey === 'percentComplete'} onClick={() => setSortKey('percentComplete')} />

        {/* Stakeholder multiselect dropdown — immediately after % Done */}
        {stakeholderGroups.length > 0 && (
          <StakeholderDropdown
            groups={stakeholderGroups}
            selected={stakeholderFilter}
            onChange={setStakeholderFilter}
          />
        )}

        {/* Clear all — only shown when a multiselect filter is active */}
        {stakeholderFilter.length > 0 && (
          <button
            onClick={() => setStakeholderFilter([])}
            className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            Clear all
          </button>
        )}

        {/* View mode toggle */}
        <div className="ml-auto flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-0.5 shrink-0">
          {([
            { mode: 'grid', icon: LayoutGrid, label: 'Grid' },
            { mode: 'list', icon: List,        label: 'List' },
          ] as { mode: 'grid' | 'list'; icon: React.ElementType; label: string }[]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors',
                viewMode === mode
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-700 dark:text-slate-200'
                  : 'text-slate-400 hover:text-slate-600')}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty states */}
      {filtered.length === 0 && (
        projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Layers size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">No epics found</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-xs">Add your first epic to start tracking work across the portfolio.</p>
            {isAdmin && (
              <Button onClick={() => navigate('/epics/new')} className="gap-2">
                <Plus size={15} /> Add Epic
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <SearchX size={40} className="text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">No epics found</h3>
            <p className="text-sm text-slate-400">No epics match your current search or filters.</p>
          </div>
        )
      )}

      {filtered.length > 0 && viewMode === 'grid' && (
        /* ── Grid view — row-chunked virtualizer ──
           The scroll container has a fixed maxHeight so the virtualizer can
           compute which rows are in view. Each virtual row is a CSS grid that
           holds up to GRID_COLS memoized ProjectCards. Spacer divs above and
           below the virtual rows maintain the correct scrollable height without
           mounting off-screen cards. */
        <div
          ref={gridScrollRef}
          className="overflow-y-auto flex-1"
          style={{ maxHeight: '70vh' }}
        >
          {/* Top spacer — scroll space for rows above the viewport. */}
          {gridPaddingTop > 0 && <div style={{ height: gridPaddingTop }} />}
          {virtualGridRows.map(vRow => (
            <div
              key={vRow.index}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-3"
            >
              {gridRows[vRow.index].map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  memberMap={memberMap}
                  initiativeMap={initiativeMap}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          ))}
          {/* Bottom spacer — scroll space for rows below the viewport. */}
          {gridPaddingBottom > 0 && <div style={{ height: gridPaddingBottom }} />}
        </div>
      )}

      {filtered.length > 0 && viewMode === 'list' && (
        /* ── List view — virtualized table ──
           The outer div is the scroll container read by listVirtualizer.
           maxHeight is large enough that the table fills the remaining
           viewport, but fixed so the virtualizer can measure it. */
        <div
          ref={listScrollRef}
          className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto overflow-y-auto flex-1"
          style={{ maxHeight: '70vh' }}
        >
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Epic</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-28">Phase</TableHead>
                <TableHead className="w-24">Priority</TableHead>
                <TableHead className="w-32">Progress</TableHead>
                <TableHead className="w-32">Start</TableHead>
                <TableHead className="w-32">Target</TableHead>
                <TableHead>Members</TableHead>
                {isAdmin && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Top spacer — represents off-screen rows above the viewport. */}
              {listPaddingTop > 0 && (
                <tr><td style={{ height: listPaddingTop }} /></tr>
              )}
              {listVirtualRows.map(vRow => {
                const project = filtered[vRow.index]
                // Map lookups instead of O(n) .find() per row.
                const assignedMemberObjs = [...new Set(project.assignments.map(a => a.memberId))]
                  .map(id => memberMap.get(id))
                  .filter(Boolean) as typeof members
                const isUnassigned = project.assignments.length === 0

                return (
                  <TableRow
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <TableCell className="overflow-hidden">
                      <p className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate" title={project.name}>
                        {project.name}
                      </p>
                      {isUnassigned && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                          <UserX size={8} /> Unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap', STATUS_COLORS[project.status])}>
                        {project.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap', PHASE_COLORS[project.phase])}>
                        {project.phase}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap', PRIORITY_COLORS[project.priority])}>
                        {project.priority}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ProgressBar value={project.percentComplete} />
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(project.startDate)}</TableCell>
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(project.targetEndDate)}</TableCell>
                    <TableCell className="overflow-hidden text-xs text-slate-500 dark:text-slate-400 truncate">
                      {assignedMemberObjs.length === 0
                        ? <span className="text-slate-300">—</span>
                        : assignedMemberObjs.slice(0, 3).map(m => m.name).join(', ') + (assignedMemberObjs.length > 3 ? ` +${assignedMemberObjs.length - 3}` : '')
                      }
                    </TableCell>
                    {isAdmin && (
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/projects/${project.id}`)}
                            className="p-1 rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(project.id)}
                            className="p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/40 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
              {/* Bottom spacer — represents off-screen rows below the viewport. */}
              {listPaddingBottom > 0 && (
                <tr><td style={{ height: listPaddingBottom }} /></tr>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Jira import dialog */}
      <JiraImportDialog open={jiraImportOpen} onOpenChange={setJiraImportOpen} />

    </div>
  )
}
