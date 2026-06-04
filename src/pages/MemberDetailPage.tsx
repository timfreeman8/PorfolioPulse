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
 */
import { useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical, FolderOpen } from 'lucide-react'
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
import { ColorBadge } from '@/components/ui/color-badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ProjectFormDialog } from '@/components/projects/ProjectFormDialog'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { STATUS_COLORS, PHASE_COLORS, PRIORITY_COLORS, avatarColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'

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

  const endDate = project.targetEndDate
    ? new Date(project.targetEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
    : '—'

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
    addProject, updateProject, deleteProject, reorderMemberProjects,
  } = usePortfolioStore()

  const [projectModal, setProjectModal] = useState<{ open: boolean; project?: Project }>({ open: false })
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)

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
            <h1 className="text-xl font-bold text-slate-900">{member.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{member.role}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {memberTeams.map(t => t.name).join(' · ') || '—'}
              {member.reportsTo && <span className="ml-2">· Reports to {member.reportsTo}</span>}
            </p>
          </div>
          <div className="flex items-center gap-8 shrink-0 text-center">
            <div>
              <p className="text-3xl font-bold text-slate-900">{memberProjects.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">Projects</p>
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
              Projects <span className="text-slate-400 font-normal">({memberProjects.length})</span>
            </p>
            {memberProjects.length > 1 && (
              <p className="text-xs text-slate-400 mt-0.5">Drag rows to set priority order — top is highest priority</p>
            )}
          </div>
          <Button size="sm" onClick={() => setProjectModal({ open: true, project: undefined })}>
            <Plus size={14} className="mr-1.5" /> Add Project
          </Button>
        </div>

        {/* Table with sortable rows */}
        {memberProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FolderOpen size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No projects yet</p>
            <p className="text-sm mt-1">Click "Add Project" to get started</p>
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
                      <TableHead className="py-3">Project</TableHead>
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingProject} onOpenChange={open => !open && setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-slate-800">"{deletingProject?.name}"</span> will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { deleteProject(deletingProject!.id); setDeletingProject(null) }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
