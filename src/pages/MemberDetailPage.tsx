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
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical, FolderOpen, Link } from 'lucide-react'
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
import { ProjectFormDialog } from '@/components/projects/ProjectFormDialog'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { STATUS_COLORS, PHASE_COLORS, PRIORITY_COLORS, avatarColor } from '@/lib/colors'
import { MEMBER_DISCIPLINES } from '@/lib/roles'
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
          {MEMBER_DISCIPLINES.map(d => {
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
    members, teams, projects, initiatives,
    addProject, updateProject, reorderMemberProjects, updateMember,
  } = usePortfolioStore()

  const [projectModal, setProjectModal] = useState<{ open: boolean; project?: Project }>({ open: false })
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

  function handleSave(draft: Omit<typeof projects[0], 'id' | 'updatedAt'>, pid?: string) {
    if (pid) updateProject(pid, draft)
    else addProject(draft)
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

      {/* Member header */}
      <div className="bg-white border border-slate-200 rounded-xl px-8 py-6">
        <div className="flex items-center gap-5">
          <div className={cn('flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold shrink-0', avatarColor(member.name).bg, avatarColor(member.name).text)}>
            {member.avatarInitials.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            {/* Name + inline Edit button on the same line */}
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{member.name}</h1>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                className="h-6 px-2 text-xs"
              >
                <Pencil size={11} className="mr-1" /> Edit
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-sm text-slate-500">{member.role}</p>
              {/* Discipline badges — one per tag */}
              {member.discipline?.map(d => (
                <span key={d} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                  {d}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {memberTeams.map(t => t.name).join(' · ') || '—'}
              {member.reportsTo && <span className="ml-2">· Reports to {member.reportsTo}</span>}
            </p>
          </div>
          <div className="flex items-center gap-8 shrink-0 text-center">
            <div>
              <p className="text-3xl font-bold text-slate-900">{memberProjects.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">Epics</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-600">{active}</p>
              <p className="text-xs text-slate-400 mt-0.5">Active</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-600">{complete}</p>
              <p className="text-xs text-slate-400 mt-0.5">Complete</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
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
              <Link size={14} className="mr-1.5" /> Assign Existing
            </Button>
            <Button size="sm" onClick={() => setProjectModal({ open: true, project: undefined })}>
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
                        onEdit={() => setProjectModal({ open: true, project: p })}
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

      {/* Project form — single modal, no nesting */}
      <ProjectFormDialog
        key={projectModal.project?.id ?? 'new'}
        open={projectModal.open}
        onOpenChange={open => setProjectModal(s => ({ ...s, open }))}
        initial={projectModal.project}
        defaultMemberId={member.id}
        onSave={handleSave}
      />

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
