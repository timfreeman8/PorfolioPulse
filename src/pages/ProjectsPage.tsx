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
import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Pencil, UserX, Download, ChevronDown, Check, SearchX, Layers } from 'lucide-react'
import { FilterChip } from '@/components/ui/filter-chip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { JiraImportDialog } from '@/components/projects/JiraImportDialog'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useViewStore } from '@/store/useViewStore'
import {
  STATUS_COLORS, PHASE_COLORS, PRIORITY_COLORS,
} from '@/lib/colors'
import { cn } from '@/lib/utils'
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

/** Format an ISO date string as "MMM D, YYYY", or "—" when empty. */
function fmtDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

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

// ─── Projects page ────────────────────────────────────────────────────────

export function ProjectsPage() {
  const { projects, members, initiatives, deleteProject } = usePortfolioStore()
  // User mode: activeMemberId is set → filter to that person's projects only.
  const { activeMemberId } = useViewStore()
  const navigate = useNavigate()
  const isAdmin  = activeMemberId === null

  const [search, setSearch]           = useState('')
  const [sortKey, setSortKey]         = useState<SortKey>('startDate')
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false)
  // [] = no filter; non-empty = show only projects that match any selected group
  const [stakeholderFilter, setStakeholderFilter] = useState<string[]>([])
  const [jiraImportOpen, setJiraImportOpen] = useState(false)

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

  function handleDelete(id: string) {
    if (window.confirm('Delete this project? This cannot be undone.')) deleteProject(id)
  }

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full flex flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Projects</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {projects.length} total
            {unassignedCount > 0 && (
              <> · <span className="text-amber-600 dark:text-amber-400 font-medium">{unassignedCount} unassigned</span></>
            )}
          </p>
        </div>
        {/* Only admins can add or import projects */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setJiraImportOpen(true)}
              className="gap-2"
            >
              <Download size={15} />
              Import from Jira
            </Button>
            <Button
              onClick={() => navigate('/projects/new')}
              className="gap-2"
            >
              <Plus size={15} />
              Add Project
            </Button>
          </div>
        )}
      </div>

      {/* Search + filters — all in one row */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="pl-8 h-9 text-sm"
          />
        </div>

        {/* Sort + Unassigned filter chips — directly beside search */}
        <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">Sort</span>
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
      </div>

      {/* Project list — or an appropriate empty state */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          projects.length === 0 ? (
            /* No projects at all — full empty state with add CTA for admins */
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Layers size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">
                No projects found
              </h3>
              <p className="text-sm text-slate-400 mb-6 max-w-xs">
                Add your first project to start tracking work across the portfolio.
              </p>
              {isAdmin && (
                <Button onClick={() => navigate('/projects/new')} className="gap-2">
                  <Plus size={15} /> Add Project
                </Button>
              )}
            </div>
          ) : (
            /* Projects exist but filters reduced the list to zero */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <SearchX size={40} className="text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">
                No projects found
              </h3>
              <p className="text-sm text-slate-400">
                No projects match your current search or filters.
              </p>
            </div>
          )
        ) : filtered.map(project => {
          const initiative = initiatives.find(i => i.id === project.initiativeId)
          const assignedMembers = project.assignments
            .map(a => members.find(m => m.id === a.memberId)?.name)
            .filter(Boolean)
          const isUnassigned = project.assignments.length === 0

          return (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className={cn(
                'bg-white dark:bg-slate-800/60 border rounded-xl px-5 py-4 flex items-start gap-4 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all cursor-pointer',
                isUnassigned ? 'border-amber-200 dark:border-amber-800/50' : 'border-slate-200 dark:border-slate-700',
              )}
            >
              {/* Main content */}
              <div className="flex-1 min-w-0 space-y-2">
                {/* Name + badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{project.name}</p>
                  {isUnassigned && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                      <UserX size={9} />
                      Unassigned
                    </span>
                  )}
                </div>

                {/* Phase · Status · Priority */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', PHASE_COLORS[project.phase])}>
                    {project.phase}
                  </span>
                  <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[project.status])}>
                    {project.status}
                  </span>
                  <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', PRIORITY_COLORS[project.priority])}>
                    {project.priority}
                  </span>
                  {initiative && (
                    <span className="text-[10px] text-slate-400 font-medium">· {initiative.name}</span>
                  )}
                </div>

                {/* Description */}
                {project.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{project.description}</p>
                )}

                {/* Blocked-by attribution — shown only when the project is Blocked
                    and at least one blocking project has been identified. Renders
                    project names (resolved from store) separated by commas. */}
                {project.status === 'Blocked' && (project.blockedByIds?.length ?? 0) > 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                    Blocked by:{' '}
                    {project.blockedByIds!
                      .map(id => projects.find(p => p.id === id)?.name)
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}

                {/* Stakeholder group tags — highlight the active filter chip */}
                {parseStakeholders(project.stakeholders).length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
                    {parseStakeholders(project.stakeholders).map(group => (
                      <span
                        key={group}
                        className={cn(
                          'text-[10px] font-medium px-2 py-0.5 rounded-full',
                          stakeholderFilter.includes(group)
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
                        )}
                      >
                        {group}
                      </span>
                    ))}
                  </div>
                )}

                {/* Progress + dates + members */}
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="w-32">
                    <ProgressBar value={project.percentComplete} />
                  </div>
                  {(project.startDate || project.targetEndDate) && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {fmtDate(project.startDate)} → {fmtDate(project.targetEndDate)}
                    </span>
                  )}
                  {assignedMembers.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {assignedMembers.slice(0, 5).map((name, i) => (
                        <span key={i} className="pl-2.5 pr-2.5 py-0.5 bg-blue-600 dark:bg-blue-700 text-white rounded-full text-xs font-medium">
                          {name}
                        </span>
                      ))}
                      {assignedMembers.length > 5 && (
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 rounded-full text-xs font-medium">
                          +{assignedMembers.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions — stop propagation so row click doesn't also fire */}
              <div className="flex items-center gap-1 shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
                  title="Edit project"
                >
                  <Pencil size={14} />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/40 transition-colors"
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Jira import dialog */}
      <JiraImportDialog open={jiraImportOpen} onOpenChange={setJiraImportOpen} />

    </div>
  )
}
