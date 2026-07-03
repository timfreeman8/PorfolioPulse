/**
 * Member Detail page — full profile for a single team member.
 *
 * Shows the member's name, role, team(s), and a drag-reorderable project table.
 * Dragging projects up/down sets their priority ranking, which is persisted via
 * `member.projectIds` order in the store. This lets team leads communicate work
 * priority without changing the underlying project metadata.
 *
 * The display order is: member.projectIds order first, then any newly-assigned
 * projects that haven't been ranked yet appended at the bottom.
 *
 * The "Assign Existing" dialog lets you pick any project not already assigned to
 * this member and add them with a default 100% allocation. Useful for projects
 * created elsewhere that need to appear on this member's profile.
 */
import { useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical, FolderOpen, Link as LinkIcon, Users, Briefcase, CheckCircle, Activity, ExternalLink } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ColorBadge } from '@/components/ui/color-badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { StatCard } from '@/components/ui/stat-card'
import {
  formatWeekOf,
  SENTIMENT_COLORS,
  SENTIMENT_LABELS,
  MOOD_COLORS,
  MOOD_EMOJI,
} from '@/components/pulse/PulseEditDialog'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useAuthStore } from '@/store/useAuthStore'
import { STATUS_COLORS, PHASE_COLORS, PRIORITY_COLORS, avatarColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { fmtDateShort } from '@/lib/format'
import type { Member, Project } from '@/types'

// ─── Member edit form ─────────────────────────────────────────────────────
// Mirrors the MemberForm in OrgPage — same fields, same chip-select patterns.
// Rendered inside a Dialog triggered by the pencil button in the profile header.

function MemberEditForm({
  member,
  onSave,
  onCancel: _onCancel,
}: {
  member: Member
  onSave: (data: Omit<Member, 'id' | 'projectIds'>) => void
  onCancel: () => void
}) {
  const { teams } = usePortfolioStore()
  // Read the configurable discipline list from the store (managed in Settings → Disciplines).
  const allDisciplines = usePortfolioStore(s => s.disciplines)
  const [name, setName]           = useState(member.name)
  const [role, setRole]           = useState(member.role)
  const [disciplines, setDisciplines] = useState<string[]>(member.discipline ?? [])
  const [reportsTo, setReportsTo] = useState(member.reportsTo ?? '')
  const [teamIds, setTeamIds]     = useState<string[]>(member.teamIds ?? [])
  const [employmentType, setEmploymentType] = useState<'FTE' | 'Contractor'>(
    member.employmentType ?? 'FTE'
  )

  function deriveInitials(v: string) {
    const parts = v.trim().split(' ').filter(Boolean)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : v.slice(0, 2).toUpperCase()
  }

  function toggleDiscipline(d: string) {
    setDisciplines(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function toggleTeam(id: string) {
    setTeamIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  return (
    // id="edit-member-form" lets the sticky footer buttons reference this form
    // without needing to be inside it (via the HTML `form` attribute on the button).
    <form
      id="edit-member-form"
      onSubmit={e => {
        e.preventDefault()
        onSave({
          name, role,
          discipline: disciplines.length > 0 ? disciplines : undefined,
          reportsTo: reportsTo.trim() || undefined,
          teamIds,
          capacity: member.capacity,
          avatarInitials: deriveInitials(name),
          employmentType,
        })
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="me-name" className="text-xs font-medium text-slate-600">Name *</Label>
        <Input id="me-name" value={name} onChange={e => setName(e.target.value)} required placeholder="Full name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="me-role" className="text-xs font-medium text-slate-600">Role / Title *</Label>
        <Input id="me-role" value={role} onChange={e => setRole(e.target.value)} required placeholder="e.g. Senior Engineer" />
      </div>
      {/* Discipline chips — multi-select */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Discipline</Label>
        <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-9 bg-white">
          {allDisciplines.map(d => {
            const sel = disciplines.includes(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDiscipline(d)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                  sel
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600',
                )}
              >
                {d}
              </button>
            )
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="me-reports" className="text-xs font-medium text-slate-600">Reports To</Label>
        <Input id="me-reports" value={reportsTo} onChange={e => setReportsTo(e.target.value)} placeholder="e.g. Jane Smith" />
      </div>
      {/* Employment type toggle */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Employment Type</Label>
        <div className="flex items-center gap-2">
          {(['FTE', 'Contractor'] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setEmploymentType(type)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                employmentType === type
                  ? type === 'Contractor'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
              )}
            >
              {type === 'FTE' ? 'Kroger FTE' : 'Contractor'}
            </button>
          ))}
        </div>
      </div>
      {/* Team membership chips */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Teams</Label>
        <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-9 bg-white">
          {teams.map(t => {
            const sel = teamIds.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTeam(t.id)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                  sel
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400',
                )}
              >
                {t.name}
              </button>
            )
          })}
        </div>
      </div>
    </form>
  )
}

// ─── Sortable project row ─────────────────────────────────────────────────
// Each row is a draggable sortable item. The left grip handle initiates the drag.
// Row order reflects priority — #1 at top is highest priority.

function ProjectRow({ project, rank, initiativeName, onEdit, onDelete }: {
  project: Project
  rank: number
  initiativeName: string
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const endDate = fmtDateShort(project.targetEndDate)

  return (
    <TableRow ref={setNodeRef} style={style} className="group cursor-pointer hover:bg-slate-50" onClick={onEdit}>
      {/* Drag grip + rank number */}
      <TableCell className="py-3 w-10">
        <div className="flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            onClick={e => e.stopPropagation()}
            className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
            tabIndex={-1}
            title="Drag to set priority order"
          >
            <GripVertical size={13} />
          </button>
          <span className="text-[10px] text-slate-300 font-mono tabular-nums w-4">{rank}</span>
        </div>
      </TableCell>
      <TableCell className="py-4 font-medium text-slate-800">
        <span className="block max-w-[240px] truncate" title={project.name}>{project.name}</span>
      </TableCell>
      <TableCell className="py-4">
        <ColorBadge className={PHASE_COLORS[project.phase]}>{project.phase}</ColorBadge>
      </TableCell>
      <TableCell className="py-4">
        <ColorBadge className={STATUS_COLORS[project.status]}>{project.status}</ColorBadge>
      </TableCell>
      <TableCell className="py-4">
        <ColorBadge className={PRIORITY_COLORS[project.priority]}>{project.priority}</ColorBadge>
      </TableCell>
      <TableCell className="py-4 text-sm text-slate-500">
        <span className="block max-w-[180px] truncate" title={initiativeName}>{initiativeName || '—'}</span>
      </TableCell>
      <TableCell className="py-4">
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${project.percentComplete}%` }} />
          </div>
          <span className="text-sm text-slate-500 w-8">{project.percentComplete}%</span>
        </div>
      </TableCell>
      <TableCell className="py-4 text-sm text-slate-500">{endDate}</TableCell>
      <TableCell className="py-4">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ─── Week helpers (mirrors ProfilePage logic) ─────────────────────────────
// Returns the ISO date string for the Monday of the current relevant week.

function getCurrentWeekOf(): string {
  const today = new Date()
  const day = today.getDay()
  const daysToMonday = day === 0 ? 1 : day <= 4 ? 1 - day : 8 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysToMonday)
  return monday.toISOString().slice(0, 10)
}

/** Short axis label for the pulse sparkline: "Jun 2", "Jun 9", etc. */
function shortWeekLabel(weekOf: string): string {
  const d = new Date(weekOf + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Page ──────────────────────────────────────────────────────────────────

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  // `from` is set by the navigation call that brought us here (e.g. '/org').
  // Falling back to '/org' since Roster is archived and People is now the primary source.
  const location = useLocation()
  const backTo: string = (location.state as { from?: string } | null)?.from ?? '/org'
  const backLabel = backTo === '/org' ? 'Back to People' : 'Back'
  const {
    members, teams, projects, initiatives, weeklyPulses,
    updateProject, reorderMemberProjects, updateMember,
  } = usePortfolioStore()
  // Only admins can edit another person's details.
  const { role } = useAuthStore()
  const isAdmin = role === 'admin'

  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  // Controls the "Edit Person" dialog in the profile header.
  const [editOpen, setEditOpen] = useState(false)

  // State for the "Assign Existing Epic" dialog — search query and open flag.
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const member = members.find(m => m.id === id)

  // Build project list in stored priority order (member.projectIds).
  // Must be called before the early return so hooks run unconditionally.
  const memberProjects = useMemo(() => {
    if (!member) return []
    const assigned = projects.filter(p => p.assignments.some(a => a.memberId === member.id))
    const byId = new Map(assigned.map(p => [p.id, p]))
    // Projects in stored priority order
    const ordered = (member.projectIds ?? [])
      .map(pid => byId.get(pid))
      .filter(Boolean) as Project[]
    // Any assigned projects not yet in the ranking list
    const ranked = new Set(member.projectIds ?? [])
    const extras = assigned.filter(p => !ranked.has(p.id))
    return [...ordered, ...extras]
  }, [member, projects])

  // Projects that exist but are NOT yet assigned to this member — candidates for "Assign Existing".
  // Recomputed whenever memberProjects or the full project list changes.
  const assignableProjects = useMemo(() => {
    if (!member) return []
    const assignedIds = new Set(memberProjects.map(p => p.id))
    return projects.filter(p => !assignedIds.has(p.id))
  }, [member, memberProjects, projects])

  if (!member) {
    return (
      <div className="p-8">
        <button onClick={() => navigate(backTo)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6">
          <ArrowLeft size={15} /> {backLabel}
        </button>
        <p className="text-slate-500">Member not found.</p>
      </div>
    )
  }

  const memberTeams = teams.filter(t => member.teamIds?.includes(t.id) ?? false)

  const active   = memberProjects.filter(p => p.status === 'In Progress').length
  const complete = memberProjects.filter(p => p.status === 'Complete').length

  function initiativeName(iid: string) {
    return initiatives.find(i => i.id === iid)?.name ?? ''
  }

  /**
   * Assign an existing project to this member with a default 100% allocation.
   * Adds a new ProjectMemberAssignment entry to the project's assignments array,
   * then closes the dialog. The member will appear in the project's team roster
   * immediately since assignments drive membership throughout the app.
   */
  function handleAssign(project: Project) {
    if (!member) return
    updateProject(project.id, {
      assignments: [
        ...project.assignments,
        { memberId: member.id, allocation: 100 },
      ],
    })
    setAssignOpen(false)
    setAssignSearch('')
  }

  // Persist the new project order when the user finishes dragging.
  function handleDragEnd(event: DragEndEvent) {
    if (!member) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = memberProjects.map(p => p.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderMemberProjects(member.id, arrayMove(ids, oldIndex, newIndex))
    }
  }

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      {/* Back nav */}
      <button
        onClick={() => navigate(backTo)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={15} /> {backLabel}
      </button>

      {/* ── Identity card — matches ProfilePage layout ─────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row gap-5">

          {/* Avatar */}
          <div className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 self-start',
            avatarColor(member.name).bg, avatarColor(member.name).text,
          )}>
            {member.avatarInitials.slice(0, 2)}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Name + role. Edit button only visible to admins — viewers are read-only. */}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{member.name}</h2>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                    className="h-6 px-2 text-xs"
                  >
                    <Pencil size={11} className="mr-1" /> Edit
                  </Button>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{member.role}</p>
            </div>

            {/* Meta row: teams · reports to · employment type — mirrors ProfilePage */}
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

            {/* Capacity bar — same thresholds as ProfilePage */}
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
                  className={cn('h-full rounded-full transition-all',
                    member.capacity > 100 ? 'bg-red-500' :
                    member.capacity > 80  ? 'bg-amber-400' :
                    'bg-emerald-500',
                  )}
                  style={{ width: `${Math.min(member.capacity, 100)}%` }}
                />
              </div>
            </div>

            {/* Disciplines — read-only chips (no add/remove since this isn't the user's own profile) */}
            {member.discipline && member.discipline.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Disciplines</p>
                <div className="flex flex-wrap gap-2">
                  {member.discipline.map(d => (
                    <span
                      key={d}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats row — matches ProfilePage StatCard grid ─────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Epics"
          value={memberProjects.length}
          icon={<Briefcase size={18} />}
          iconColor="bg-slate-100 text-slate-600"
        />
        <StatCard
          label="Active"
          value={active}
          icon={<Activity size={18} />}
          iconColor="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Complete"
          value={complete}
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

      {/* ── Weekly Pulse widget (read-only) ─────────────────────────────── */}
      {(() => {
        // Derive current week and the member's pulses at render time.
        // Wrapped in an IIFE so we can use consts without adding state.
        const weekOf = getCurrentWeekOf()
        const thisWeekPulse = weeklyPulses.find(
          p => p.memberId === member.id && p.weekOf === weekOf,
        )
        // Last 6 weeks in chronological order for the sentiment sparkline.
        const recentPulses = weeklyPulses
          .filter(p => p.memberId === member.id)
          .sort((a, b) => b.weekOf.localeCompare(a.weekOf))
          .slice(0, 6)
          .reverse()

        if (!thisWeekPulse && recentPulses.length === 0) return null

        return (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Weekly Pulse
              </h2>
              <Link
                to="/pulse"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
              >
                View all <ExternalLink size={11} />
              </Link>
            </div>

            {/* Current week card — read-only summary */}
            {thisWeekPulse ? (
              <div className={cn(
                'rounded-lg border px-4 py-3 space-y-2',
                SENTIMENT_COLORS[thisWeekPulse.workloadSentiment].bg,
              )}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={cn('text-sm font-semibold', SENTIMENT_COLORS[thisWeekPulse.workloadSentiment].text)}>
                      {thisWeekPulse.workloadSentiment} — {SENTIMENT_LABELS[thisWeekPulse.workloadSentiment]}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatWeekOf(weekOf)}</p>
                  </div>
                  {/* Mood badge — shown when moodSentiment is set */}
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
                </div>
                {/* Top 3 priorities */}
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
              // No pulse this week — show a neutral placeholder (viewer can't submit for others)
              <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 py-4 flex items-center justify-center">
                <p className="text-xs text-slate-400">No pulse submitted for {formatWeekOf(weekOf)}</p>
              </div>
            )}

            {/* History sparkline — last 6 weeks, oldest left.
                Two rows: workload (colored dot) and mood (emoji). */}
            {recentPulses.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Last {recentPulses.length} weeks</p>
                <div className="flex items-end gap-3">
                  {recentPulses.map(p => {
                    const wCol = SENTIMENT_COLORS[p.workloadSentiment]
                    const moodLevel = p.moodSentiment
                    return (
                      <div key={p.id} className="flex flex-col items-center gap-1">
                        {/* Mood emoji */}
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
                        {/* Workload dot */}
                        <div
                          title={`Workload: ${p.workloadSentiment} — ${SENTIMENT_LABELS[p.workloadSentiment]}`}
                          className={cn('w-4 h-4 rounded-full', wCol.bar)}
                        />
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
        )
      })()}

      {/* Projects section */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div>
            <p className="text-sm font-semibold text-slate-700">
              Epics <span className="text-slate-400 font-normal">({memberProjects.length})</span>
            </p>
            {memberProjects.length > 1 && (
              <p className="text-xs text-slate-400 mt-0.5">Drag rows to set priority order — top is highest priority</p>
            )}
          </div>
          {/* Two actions: create a brand-new epic or link an existing one */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setAssignSearch(''); setAssignOpen(true) }}
              disabled={assignableProjects.length === 0}
              title={assignableProjects.length === 0 ? 'All existing epics are already assigned to this member' : undefined}
            >
              <LinkIcon size={14} className="mr-1.5" /> Assign Existing
            </Button>
            <Button size="sm" onClick={() => navigate('/epics/new')}>
              <Plus size={14} className="mr-1.5" /> Add Epic
            </Button>
          </div>
        </div>

        {/* Table with sortable rows */}
        {memberProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FolderOpen size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No epics yet</p>
            <p className="text-sm mt-1">Click "Add Epic" to get started</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-420px)]">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={memberProjects.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {/* Grip + rank column */}
                      <TableHead className="py-3 w-10" />
                      <TableHead className="py-3">Epic</TableHead>
                      <TableHead className="py-3">Phase</TableHead>
                      <TableHead className="py-3">Status</TableHead>
                      <TableHead className="py-3">Priority</TableHead>
                      <TableHead className="py-3">Initiative</TableHead>
                      <TableHead className="py-3">Progress</TableHead>
                      <TableHead className="py-3">Target Date</TableHead>
                      <TableHead className="py-3 w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberProjects.map((p, idx) => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        rank={idx + 1}
                        initiativeName={initiativeName(p.initiativeId)}
                        onEdit={() => navigate(`/epics/${p.id}`)}
                        onDelete={() => setDeletingProject(p)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </SortableContext>
            </DndContext>
          </ScrollArea>
        )}
      </div>

      {/* Remove confirmation — removes this member from the epic's assignments, does NOT delete the project */}
      <AlertDialog open={!!deletingProject} onOpenChange={open => !open && setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove epic from your list?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-slate-800">"{deletingProject?.name}"</span> will be removed from your profile.
              The epic itself will not be deleted and can be re-assigned later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Remove only this member's assignment entry — leave the project intact.
                updateProject(deletingProject!.id, {
                  assignments: deletingProject!.assignments.filter(a => a.memberId !== member.id),
                })
                setDeletingProject(null)
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Edit Person dialog ──────────────────────────────────────────────
          Uses MemberEditForm (defined above) — same fields as the OrgPage form.
          p-0 gap-0 overflow-hidden on DialogContent lets us manage layout manually:
          sticky header → flex-1 scrollable body → sticky footer.
          The footer's Submit button targets the form by id so it can live outside it.
      */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
          {/* Sticky header */}
          <DialogHeader className="sticky top-0 z-10 bg-popover border-b px-6 pt-5 pb-4">
            <DialogTitle>Edit Person</DialogTitle>
          </DialogHeader>

          {/* Scrollable form body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            <MemberEditForm
              key={member.id}
              member={member}
              onSave={data => { updateMember(member.id, data); setEditOpen(false) }}
              onCancel={() => setEditOpen(false)}
            />
          </div>

          {/* Sticky footer — buttons reference the form by id */}
          <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 px-4 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" form="edit-member-form">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Assign Existing Epic dialog ─────────────────────────────────────
          Shows all projects not yet assigned to this member. Typing in the
          search box filters by name in real time. Clicking a row immediately
          adds this member to the project's assignments array (100% allocation)
          and closes the dialog. No confirmation needed — the change is visible
          instantly and the member can always be removed from the project later.
      */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Existing Epic</DialogTitle>
          </DialogHeader>

          {/* Search box */}
          <div className="relative">
            <Input
              autoFocus
              placeholder="Search epics…"
              value={assignSearch}
              onChange={e => setAssignSearch(e.target.value)}
              className="pr-8"
            />
          </div>

          {/* Scrollable list of assignable projects filtered by search */}
          <div className="mt-1 border rounded-lg overflow-hidden">
            <ScrollArea className="max-h-80">
              {(() => {
                const q = assignSearch.toLowerCase()
                const filtered = assignableProjects.filter(p =>
                  p.name.toLowerCase().includes(q)
                )
                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-sm">
                      <FolderOpen size={28} className="mb-2 opacity-30" />
                      {assignSearch ? 'No matching epics' : 'No unassigned epics'}
                    </div>
                  )
                }
                return filtered.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAssign(p)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b last:border-b-0 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <ColorBadge className={PHASE_COLORS[p.phase]}>{p.phase}</ColorBadge>
                        <ColorBadge className={STATUS_COLORS[p.status]}>{p.status}</ColorBadge>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{p.percentComplete}%</span>
                  </button>
                ))
              })()}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
