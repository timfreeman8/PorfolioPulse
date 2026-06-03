/**
 * Portfolio Structure page — tree view of Domains → Teams → Members.
 *
 * CRUD: Add / edit / delete Domains, Teams, and Members via modal dialogs.
 *
 * Drag-and-drop (powered by @dnd-kit) — three interaction modes:
 *   1. Member reorder within a team — drag the left grip handle up/down
 *   2. Member cross-team move       — drag member grip → drop on a different
 *                                     team's highlighted header
 *   3. Team cross-domain move       — drag the team's left grip handle →
 *                                     drop on a different domain's header
 *
 * A single DndContext wraps the entire page so drags can cross container
 * boundaries. `activeDragType` ('member' | 'team' | null) is tracked in
 * PortfolioPage state and threaded down as a prop so drop-target headers
 * can highlight themselves without subscribing to dnd context individually.
 *
 * Collision detection uses a custom strategy: `pointerWithin` is checked
 * first for explicit drop zones (team/domain headers), then `closestCenter`
 * is used as a fallback for within-team member sorting. This prevents the
 * common bug where a sortable member accidentally collides with a drop zone
 * in a nearby team when the user only intended to sort.
 */
import { useState } from 'react'
import {
  ChevronRight, ChevronDown, Plus, Pencil, Trash2,
  Building2, Users, UserCircle, GripVertical,
} from 'lucide-react'
import { memberQuarterAllocation } from '@/lib/fiscal'
import {
  DndContext, DragOverlay, closestCenter, pointerWithin,
  PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ColorBadge } from '@/components/ui/color-badge'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { cn } from '@/lib/utils'
import { avatarColor } from '@/lib/colors'
import type { Domain, Team, Member } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────

type ModalState =
  | { type: 'domain'; mode: 'add' }
  | { type: 'domain'; mode: 'edit'; domain: Domain }
  | { type: 'team';   mode: 'add';  domainId: string }
  | { type: 'team';   mode: 'edit'; team: Team }
  | { type: 'member'; mode: 'add';  teamId: string }
  | { type: 'member'; mode: 'edit'; member: Member }
  | null

type DeleteTarget = { type: 'domain' | 'team' | 'member'; id: string; name: string }

// Which kind of item is actively being dragged — controls what drop zones highlight.
type ActiveDragType = 'member' | 'team' | 'domain' | null

// ─── Custom collision detection ───────────────────────────────────────────
// Three modes depending on what's being dragged:
//   domain — closestCenter against other domain IDs only (ignore drop zones)
//   member/team — pointerWithin for explicit drop zones first, then closestCenter
// This prevents cross-mode false positives (e.g. domain sort accidentally
// hitting a teamdrop zone, or member sort hitting a distant domaindrop).

function collisionDetection(args: Parameters<typeof closestCenter>[0]) {
  const dragType = (args.active.data.current as any)?.type

  if (dragType === 'domain') {
    // Domain reorder: only consider other domain sortable items.
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(c => {
        const id = String(c.id)
        return !id.startsWith('teamdrop:') && !id.startsWith('domaindrop:') && !id.startsWith('teamdrag:')
      }),
    })
  }

  // Member and team drags: explicit drop zones take priority over sortable items.
  const zoneHits = pointerWithin(args).filter(c => {
    const id = String(c.id)
    return id.startsWith('teamdrop:') || id.startsWith('domaindrop:')
  })
  if (zoneHits.length > 0) return zoneHits
  return closestCenter(args)
}

// ─── Capacity bar ─────────────────────────────────────────────────────────
// Shows current-quarter allocation vs the member's capacity, matching the
// same thresholds used on the Roster and Teams pages.

function CapacityBar({ alloc, capacity }: { alloc: number; capacity: number }) {
  const isOver   = alloc > capacity
  const isAtRisk = !isOver && capacity > 0 && alloc / capacity > 0.8
  const barColor  = isOver ? 'bg-red-500'   : isAtRisk ? 'bg-amber-400'   : 'bg-green-500'
  // Dark text variants: red/amber/green don't flip via global CSS, so add explicit dark: classes.
  const textColor = isOver ? 'text-red-600 dark:text-red-400' : isAtRisk ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'
  const fillPct   = capacity > 0 ? Math.min((alloc / capacity) * 100, 100) : Math.min(alloc, 100)
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${fillPct}%` }} />
      </div>
      <span className={cn('text-xs font-medium', textColor)}>{alloc}%</span>
    </div>
  )
}

// ─── Member row ───────────────────────────────────────────────────────────
// Sortable within its team. The `teamId` is baked into useSortable data so
// onDragEnd can determine whether the drop is a same-team sort or a cross-team
// move without an extra lookup.

function MemberRow({
  member,
  teamId,
  activeProjects,
  onEdit,
  onDelete,
}: {
  member: Member
  teamId: string
  activeProjects: number
  onEdit: () => void
  onDelete: () => void
}) {
  // Compute current-quarter allocation so the bar matches Roster / Teams pages.
  const { projects } = usePortfolioStore()
  const alloc = memberQuarterAllocation(member.id, projects)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: member.id,
      // Carry type + source team so onDragEnd can route correctly.
      data: { type: 'member', fromTeamId: teamId },
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-slate-100 group"
      // bg-white and border-slate-100 are handled by global dark overrides in index.css
    >
      <button
        {...attributes}
        {...listeners}
        className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
        tabIndex={-1}
        title="Drag to reorder or move to another team"
      >
        <GripVertical size={14} />
      </button>
      <div className={cn('flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0', avatarColor(member.name).bg, avatarColor(member.name).text)}>
        {member.avatarInitials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{member.name}</p>
        <p className="text-xs text-slate-400">{member.role}{member.reportsTo ? ` · ${member.reportsTo}` : ''}</p>
      </div>
      <CapacityBar alloc={alloc} capacity={member.capacity} />
      <div className="flex items-center gap-1.5 ml-2">
        {/* blue-50/blue-600 is a colored badge — needs explicit dark flip */}
        <ColorBadge className="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
          {activeProjects} project{activeProjects !== 1 ? 's' : ''}
        </ColorBadge>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
        <button onClick={onEdit} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Member drag overlay ───────────────────────────────────────────────────
// Compact preview card rendered by DragOverlay while a member is in flight.

function MemberDragPreview({ member }: { member: Member }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-blue-300 shadow-lg opacity-90 pointer-events-none">
      <GripVertical size={14} className="text-slate-400" />
      <div className={cn('flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0', avatarColor(member.name).bg, avatarColor(member.name).text)}>
        {member.avatarInitials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{member.name}</p>
        <p className="text-xs text-slate-400 truncate">{member.role}</p>
      </div>
    </div>
  )
}

// ─── Team drag overlay ────────────────────────────────────────────────────
// Compact preview badge rendered by DragOverlay while a team is in flight.

function TeamDragPreview({ team }: { team: Team }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-lg border border-violet-300 shadow-lg opacity-90 pointer-events-none">
      <GripVertical size={14} className="text-slate-400" />
      {/* Container matches the team icon style used in TeamSection header */}
      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-100 shrink-0">
        <Users size={13} className="text-blue-600" />
      </div>
      <span className="text-sm font-medium text-slate-800">{team.name}</span>
    </div>
  )
}

// ─── Domain drag overlay ──────────────────────────────────────────────────
// Compact preview card rendered by DragOverlay while a domain is being reordered.

function DomainDragPreview({ domain }: { domain: Domain }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl border border-violet-300 shadow-lg opacity-90 pointer-events-none">
      <GripVertical size={14} className="text-slate-400" />
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 shrink-0">
        <Building2 size={13} className="text-violet-600" />
      </div>
      <span className="text-sm font-semibold text-slate-900">{domain.name}</span>
    </div>
  )
}

// ─── Team section ─────────────────────────────────────────────────────────
// Renders the team header (with a drag handle for cross-domain moves) and an
// expandable member list. The header also acts as a drop zone when a member
// is being dragged cross-team.

function TeamSection({
  team,
  expanded,
  activeDragType,
  onToggle,
  onEdit,
  onDelete,
  onAddMember,
  onEditMember,
  onDeleteMember,
}: {
  team: Team
  expanded: boolean
  activeDragType: ActiveDragType
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onAddMember: () => void
  onEditMember: (member: Member) => void
  onDeleteMember: (member: Member) => void
}) {
  const { members, projects } = usePortfolioStore()
  const teamMembers = team.memberIds
    .map(id => members.find(m => m.id === id))
    .filter(Boolean) as Member[]

  // ── Team drag handle ─────────────────────────────────────────────────
  // Makes the team draggable so it can be dropped on a different domain.
  const {
    attributes: teamDragAttrs,
    listeners: teamDragListeners,
    setNodeRef: setTeamDragRef,
    isDragging: isTeamDragging,
  } = useDraggable({
    id: `teamdrag:${team.id}`,
    data: { type: 'team', teamId: team.id, fromDomainId: team.domainId },
  })

  // ── Member drop zone ─────────────────────────────────────────────────
  // The team header becomes a highlighted drop target when a member is in
  // flight, giving a clear destination for cross-team moves.
  const {
    setNodeRef: setMemberDropRef,
    isOver: memberIsOver,
  } = useDroppable({
    id: `teamdrop:${team.id}`,
    data: { type: 'team-drop', teamId: team.id },
  })

  function activeProjectCount(member: Member) {
    return projects.filter(p => p.assignments.some(a => a.memberId === member.id) && p.status === 'In Progress').length
  }

  // The header div serves dual purpose: ref for the member drop zone AND
  // it contains the team drag grip button (separate refs, same DOM area).
  return (
    <div
      className={cn(
        'border border-slate-200 rounded-xl overflow-hidden transition-opacity',
        isTeamDragging && 'opacity-40',
      )}
    >
      {/* Team header — drop zone for member moves + contains team drag grip */}
      <div
        ref={setMemberDropRef}
        className={cn(
          'flex items-center gap-2 px-4 py-3 bg-slate-50 group transition-colors',
          // Highlight all team headers when a member is being dragged
          activeDragType === 'member' && 'ring-2 ring-inset ring-blue-200 dark:ring-blue-800',
          // Stronger highlight when pointer is over this team; bg-blue-50 needs dark flip
          memberIsOver && 'ring-2 ring-inset ring-blue-400 bg-blue-50 dark:bg-blue-950/30',
        )}
      >
        {/* Team grip — drag to move team to a different domain */}
        <button
          ref={setTeamDragRef}
          {...teamDragAttrs}
          {...teamDragListeners}
          className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          tabIndex={-1}
          title="Drag to move team to a different domain"
        >
          <GripVertical size={14} />
        </button>

        <button onClick={onToggle} className="text-slate-400 hover:text-slate-700">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        {/* bg-blue-100 icon container — needs dark flip; blue doesn't auto-invert */}
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-950/40 shrink-0">
          <Users size={13} className="text-blue-600 dark:text-blue-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800">{team.name}</p>
          {team.description && (
            <p className="text-xs text-slate-400 truncate">{team.description}</p>
          )}
        </div>
        {/* bg-slate-100/text-slate-600 — covered by global dark overrides */}
        <ColorBadge className="bg-slate-100 text-slate-600">
          {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
        </ColorBadge>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
          {/* blue-50/blue-600 badge button needs dark flip; hover:bg-slate-200 not globally overridden */}
          <button
            onClick={onAddMember}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60"
          >
            <Plus size={11} /> Member
          </button>
          <button onClick={onEdit} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Member list — SortableContext enables within-team reordering */}
      {expanded && (
        <div className="p-3 bg-white space-y-2">
          {teamMembers.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">
              No members yet.{' '}
              <button onClick={onAddMember} className="text-blue-500 hover:underline">Add one</button>
            </p>
          ) : (
            <SortableContext items={team.memberIds} strategy={verticalListSortingStrategy}>
              {teamMembers.map(m => (
                <MemberRow
                  key={m.id}
                  member={m}
                  teamId={team.id}
                  activeProjects={activeProjectCount(m)}
                  onEdit={() => onEditMember(m)}
                  onDelete={() => onDeleteMember(m)}
                />
              ))}
            </SortableContext>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Domain card ──────────────────────────────────────────────────────────
// The domain header serves two drag roles:
//   • Sortable item (useSortable) — grip handle lets users reorder domains
//   • Drop zone (useDroppable)    — highlighted when a team is in flight so
//                                   users can move teams between domains
// Both hooks use distinct IDs to avoid collision conflicts.

function DomainCard({
  domain,
  expanded,
  activeDragType,
  onToggle,
  onEdit,
  onDelete,
  onAddTeam,
  setModal,
  setDeleteTarget,
}: {
  domain: Domain
  expanded: boolean
  activeDragType: ActiveDragType
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onAddTeam: () => void
  setModal: (m: ModalState) => void
  setDeleteTarget: (t: DeleteTarget) => void
}) {
  const { teams } = usePortfolioStore()
  const domainTeams = teams.filter(t => t.domainId === domain.id)

  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  function toggleTeam(id: string) {
    setExpandedTeams(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Domain sortable (reorder domains) ────────────────────────────────
  // ID = domain.id so the SortableContext in PortfolioPage can track it.
  const {
    attributes: domainSortAttrs,
    listeners: domainSortListeners,
    setNodeRef: setDomainSortRef,
    transform,
    transition,
    isDragging: isDomainDragging,
  } = useSortable({
    id: domain.id,
    data: { type: 'domain' },
  })

  const sortStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDomainDragging ? 0.4 : 1,
  }

  // ── Team drop zone ───────────────────────────────────────────────────
  // Separate ID (domaindrop:) keeps this droppable out of the domain sort
  // collision pool (the custom collisionDetection filters it out for domain drags).
  const { setNodeRef: setTeamDropRef, isOver: teamIsOver } = useDroppable({
    id: `domaindrop:${domain.id}`,
    data: { type: 'domain-drop', domainId: domain.id },
  })

  return (
    <div ref={setDomainSortRef} style={sortStyle} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Domain header — sortable grip + drop zone for team cross-domain moves */}
      <div
        ref={setTeamDropRef}
        className={cn(
          'flex items-center gap-3 px-5 py-4 bg-white group transition-colors',
          // Highlight all domain headers when a team is being dragged
          activeDragType === 'team' && 'ring-2 ring-inset ring-violet-200 dark:ring-violet-800',
          // Stronger highlight when pointer is over this domain; bg-violet-50 needs dark flip
          teamIsOver && 'ring-2 ring-inset ring-violet-400 bg-violet-50 dark:bg-violet-950/30',
        )}
      >
        {/* Domain reorder grip */}
        <button
          {...domainSortAttrs}
          {...domainSortListeners}
          className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          tabIndex={-1}
          title="Drag to reorder domains"
        >
          <GripVertical size={14} />
        </button>
        <button onClick={onToggle} className="text-slate-400 hover:text-slate-700">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {/* bg-violet-100 icon container — needs dark flip; violet doesn't auto-invert */}
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-950/40 shrink-0">
          <Building2 size={16} className="text-violet-600 dark:text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900">{domain.name}</p>
          <p className="text-xs text-slate-400 truncate">{domain.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400">Owner: <span className="text-slate-600">{domain.owner}</span></span>
          {/* violet-50/violet-700 badge — needs dark flip */}
          <ColorBadge className="bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
            {domainTeams.length} team{domainTeams.length !== 1 ? 's' : ''}
          </ColorBadge>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
          {/* violet-50/violet-600 badge button — needs dark flip */}
          <button
            onClick={onAddTeam}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/60"
          >
            <Plus size={11} /> Team
          </button>
          <button onClick={onEdit} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Team list */}
      {expanded && (
        <div className="px-5 pb-4 pt-1 bg-slate-50 space-y-2">
          {domainTeams.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              No teams yet.{' '}
              <button onClick={onAddTeam} className="text-blue-500 hover:underline">Add one</button>
            </p>
          ) : (
            domainTeams.map(team => (
              <TeamSection
                key={team.id}
                team={team}
                expanded={expandedTeams.has(team.id)}
                activeDragType={activeDragType}
                onToggle={() => toggleTeam(team.id)}
                onEdit={() => setModal({ type: 'team', mode: 'edit', team })}
                onDelete={() => setDeleteTarget({ type: 'team', id: team.id, name: team.name })}
                onAddMember={() => setModal({ type: 'member', mode: 'add', teamId: team.id })}
                onEditMember={member => setModal({ type: 'member', mode: 'edit', member })}
                onDeleteMember={member => setDeleteTarget({ type: 'member', id: member.id, name: member.name })}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Domain form ──────────────────────────────────────────────────────────

function DomainForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Domain>
  onSubmit: (data: Omit<Domain, 'id'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [owner, setOwner] = useState(initial?.owner ?? '')

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit({ name, description, owner }) }}
      className="space-y-4 pt-1"
    >
      <div className="space-y-1.5">
        <Label htmlFor="d-name" className="text-xs font-medium text-slate-600">Domain Name *</Label>
        <Input id="d-name" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Store Experience" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="d-desc" className="text-xs font-medium text-slate-600">Description</Label>
        <Textarea id="d-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Short description of this domain" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="d-owner" className="text-xs font-medium text-slate-600">Owner</Label>
        <Input id="d-owner" value={owner} onChange={e => setOwner(e.target.value)} placeholder="Owner name" />
      </div>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Team form ────────────────────────────────────────────────────────────

function TeamForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Team>
  onSubmit: (data: Omit<Team, 'id' | 'domainId' | 'memberIds'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit({ name, description, techLead: initial?.techLead ?? '' }) }}
      className="space-y-4 pt-1"
    >
      <div className="space-y-1.5">
        <Label htmlFor="t-name" className="text-xs font-medium text-slate-600">Team Name *</Label>
        <Input id="t-name" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. POS & Checkout" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-desc" className="text-xs font-medium text-slate-600">Description</Label>
        <Textarea id="t-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What does this team own?" />
      </div>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Member form ──────────────────────────────────────────────────────────

function MemberForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Member>
  onSubmit: (data: Omit<Member, 'id' | 'projectIds'>) => void
  onCancel: () => void
}) {
  const { teams } = usePortfolioStore()
  const [name, setName]           = useState(initial?.name ?? '')
  const [role, setRole]           = useState(initial?.role ?? '')
  const [reportsTo, setReportsTo] = useState(initial?.reportsTo ?? '')
  const [teamIds, setTeamIds]     = useState<string[]>(initial?.teamIds ?? [])

  function deriveInitials(v: string) {
    const parts = v.trim().split(' ').filter(Boolean)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : v.slice(0, 2).toUpperCase()
  }

  function toggleTeam(id: string) {
    setTeamIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSubmit({ name, role, reportsTo: reportsTo.trim() || undefined, teamIds, capacity: initial?.capacity ?? 100, avatarInitials: deriveInitials(name) })
      }}
      className="space-y-4 pt-1"
    >
      <div className="space-y-1.5">
        <Label htmlFor="m-name" className="text-xs font-medium text-slate-600">Name *</Label>
        <Input id="m-name" value={name} onChange={e => setName(e.target.value)} required placeholder="Full name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="m-role" className="text-xs font-medium text-slate-600">Role / Title *</Label>
        <Input id="m-role" value={role} onChange={e => setRole(e.target.value)} required placeholder="e.g. Senior Engineer" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="m-reports-to" className="text-xs font-medium text-slate-600">Reports To</Label>
        <Input id="m-reports-to" value={reportsTo} onChange={e => setReportsTo(e.target.value)} placeholder="e.g. Jane Smith" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Teams</Label>
        <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-9 bg-white">
          {teams.map(t => {
            const selected = teamIds.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTeam(t.id)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                  selected
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
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={teamIds.length === 0}>Save</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Portfolio page ───────────────────────────────────────────────────────

export function PortfolioPage() {
  const {
    domains, teams, members,
    addDomain, updateDomain, deleteDomain, reorderDomains,
    addTeam, updateTeam, deleteTeam,
    addMember, updateMember, deleteMember,
    reorderTeamMembers,
  } = usePortfolioStore()

  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(
    () => new Set(domains.slice(0, 1).map(d => d.id))
  )
  const [modal, setModal]             = useState<ModalState>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  // Track the active drag so child components can highlight their drop zones.
  const [activeDragType, setActiveDragType] = useState<ActiveDragType>(null)
  const [activeDragId, setActiveDragId]     = useState<string | null>(null)

  // Single sensor shared across all drag interactions on the page.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function toggleDomain(id: string) {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Drag start ────────────────────────────────────────────────────────
  // Capture what kind of item is being dragged so drop zones can highlight.

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as any
    const t = data?.type
    setActiveDragType(t === 'member' ? 'member' : t === 'team' ? 'team' : t === 'domain' ? 'domain' : null)
    setActiveDragId(String(event.active.id))
  }

  // ── Drag end ──────────────────────────────────────────────────────────
  // Routes to the correct store action based on what was dragged and where
  // it was dropped.

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragType(null)
    setActiveDragId(null)

    const { active, over } = event
    if (!over) return

    const activeData = active.data.current as any
    const overId     = String(over.id)

    if (activeData?.type === 'member') {
      // ── Member drop ────────────────────────────────────────────────
      const memberId   = String(active.id)
      const fromTeamId = activeData.fromTeamId as string

      if (overId.startsWith('teamdrop:')) {
        // Dropped on a team header — cross-team move.
        const toTeamId = overId.replace('teamdrop:', '')
        if (toTeamId === fromTeamId) return        // same team, nothing to do

        // Replace fromTeam with toTeam in member's teamIds (remove from source,
        // add to destination). updateMember re-syncs team.memberIds automatically.
        const member = members.find(m => m.id === memberId)
        if (!member) return
        const newTeamIds = [
          ...member.teamIds.filter(tid => tid !== fromTeamId),
          toTeamId,
        ]
        updateMember(memberId, { teamIds: newTeamIds })
      } else {
        // Dropped on another member — within-team sort, or cross-team move if
        // the target member lives in a different team.
        const overMemberId = overId
        const overMemberData = over.data.current as any
        const toTeamId = overMemberData?.fromTeamId as string | undefined

        if (!toTeamId) return

        if (toTeamId === fromTeamId) {
          // Same team — reorder.
          const team = teams.find(t => t.id === fromTeamId)
          if (!team) return
          const oldIndex = team.memberIds.indexOf(memberId)
          const newIndex = team.memberIds.indexOf(overMemberId)
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            reorderTeamMembers(fromTeamId, arrayMove(team.memberIds, oldIndex, newIndex))
          }
        } else {
          // Different team — move member there, appending after the over item's
          // team. (Cross-team positional sort is not supported; member lands at end.)
          const member = members.find(m => m.id === memberId)
          if (!member) return
          const newTeamIds = [
            ...member.teamIds.filter(tid => tid !== fromTeamId),
            toTeamId,
          ]
          updateMember(memberId, { teamIds: newTeamIds })
        }
      }
    } else if (activeData?.type === 'team') {
      // ── Team drop ──────────────────────────────────────────────────
      // Dropped on a domain header — move the team to that domain.
      if (!overId.startsWith('domaindrop:')) return
      const toDomainId   = overId.replace('domaindrop:', '')
      const fromDomainId = activeData.fromDomainId as string
      if (toDomainId === fromDomainId) return
      updateTeam(activeData.teamId as string, { domainId: toDomainId })
    } else if (activeData?.type === 'domain') {
      // ── Domain reorder ─────────────────────────────────────────────
      // Both active.id and over.id are raw domain IDs (no prefix).
      const activeId = String(active.id)
      const overTargetId = overId
      const oldIndex = domains.findIndex(d => d.id === activeId)
      const newIndex = domains.findIndex(d => d.id === overTargetId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        reorderDomains(arrayMove(domains.map(d => d.id), oldIndex, newIndex))
      }
    }
  }

  // ── Modal helpers ─────────────────────────────────────────────────────

  function modalTitle() {
    if (!modal) return ''
    const verb = modal.mode === 'add' ? 'Add' : 'Edit'
    if (modal.type === 'domain') return `${verb} Domain`
    if (modal.type === 'team')   return `${verb} Team`
    return `${verb} Member`
  }

  function handleDomainSubmit(data: Omit<Domain, 'id'>) {
    if (!modal) return
    if (modal.mode === 'add') addDomain(data)
    else updateDomain((modal as { domain: Domain }).domain.id, data)
    setModal(null)
  }

  function handleTeamSubmit(data: Omit<Team, 'id' | 'domainId' | 'memberIds'>) {
    if (!modal) return
    if (modal.mode === 'add') {
      const m = modal as { mode: 'add'; domainId: string }
      addTeam({ ...data, domainId: m.domainId })
    } else {
      updateTeam((modal as { team: Team }).team.id, data)
    }
    setModal(null)
  }

  function handleMemberSubmit(data: Omit<Member, 'id' | 'projectIds'>) {
    if (!modal) return
    if (modal.mode === 'add') addMember(data)
    else updateMember((modal as { member: Member }).member.id, data)
    setModal(null)
  }

  function handleDelete() {
    if (!deleteTarget) return
    if (deleteTarget.type === 'domain') deleteDomain(deleteTarget.id)
    else if (deleteTarget.type === 'team') deleteTeam(deleteTarget.id)
    else deleteMember(deleteTarget.id)
    setDeleteTarget(null)
  }

  const deleteWarning =
    deleteTarget?.type === 'domain'
      ? 'This will also delete all teams, members, and projects within this domain.'
      : deleteTarget?.type === 'team'
      ? 'This will also delete all members and their projects within this team.'
      : 'This will also delete all projects assigned to this member.'

  // Resolve the active drag item for the DragOverlay preview.
  const draggedMember = activeDragType === 'member'
    ? members.find(m => m.id === activeDragId) ?? null
    : null
  const draggedTeam = activeDragType === 'team'
    ? teams.find(t => `teamdrag:${t.id}` === activeDragId) ?? null
    : null
  // Domain sortable uses domain.id directly as the drag ID.
  const draggedDomain = activeDragType === 'domain'
    ? domains.find(d => d.id === activeDragId) ?? null
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-8 space-y-6 overflow-y-auto h-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Portfolio</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {domains.length} domain{domains.length !== 1 ? 's' : ''} · Expand to see teams and members
            </p>
          </div>
          <Button onClick={() => setModal({ type: 'domain', mode: 'add' })}>
            <Plus size={15} /> Add Domain
          </Button>
        </div>

        {/* Domain list — wrapped in SortableContext for drag-to-reorder */}
        <div className="space-y-3">
          {domains.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Building2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No domains yet</p>
              <p className="text-sm mt-1">Add your first domain to get started</p>
            </div>
          ) : (
            <SortableContext items={domains.map(d => d.id)} strategy={verticalListSortingStrategy}>
              {domains.map(domain => (
                <DomainCard
                  key={domain.id}
                  domain={domain}
                  expanded={expandedDomains.has(domain.id)}
                  activeDragType={activeDragType}
                  onToggle={() => toggleDomain(domain.id)}
                  onEdit={() => setModal({ type: 'domain', mode: 'edit', domain })}
                  onDelete={() => setDeleteTarget({ type: 'domain', id: domain.id, name: domain.name })}
                  onAddTeam={() => setModal({ type: 'team', mode: 'add', domainId: domain.id })}
                  setModal={setModal}
                  setDeleteTarget={setDeleteTarget}
                />
              ))}
            </SortableContext>
          )}
        </div>
      </div>

      {/* Drag overlay — floating preview card while dragging */}
      <DragOverlay>
        {draggedMember && <MemberDragPreview member={draggedMember} />}
        {draggedTeam   && <TeamDragPreview   team={draggedTeam}   />}
        {draggedDomain && <DomainDragPreview domain={draggedDomain} />}
      </DragOverlay>

      {/* Add / Edit modal */}
      <Dialog open={modal !== null} onOpenChange={open => !open && setModal(null)}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modal?.type === 'domain' && <Building2 size={16} className="text-violet-500" />}
              {modal?.type === 'team'   && <Users size={16} className="text-blue-500" />}
              {modal?.type === 'member' && <UserCircle size={16} className="text-sky-500" />}
              {modalTitle()}
            </DialogTitle>
          </DialogHeader>

          {modal?.type === 'domain' && (
            <DomainForm
              initial={modal.mode === 'edit' ? modal.domain : undefined}
              onSubmit={handleDomainSubmit}
              onCancel={() => setModal(null)}
            />
          )}
          {modal?.type === 'team' && (
            <TeamForm
              initial={modal.mode === 'edit' ? modal.team : undefined}
              onSubmit={handleTeamSubmit}
              onCancel={() => setModal(null)}
            />
          )}
          {modal?.type === 'member' && (
            <MemberForm
              initial={
                modal.mode === 'edit'
                  ? modal.member
                  : { teamIds: [(modal as { teamId: string }).teamId] }
              }
              onSubmit={handleMemberSubmit}
              onCancel={() => setModal(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-slate-800">"{deleteTarget?.name}"</span> will be permanently deleted.{' '}
              {deleteWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  )
}
