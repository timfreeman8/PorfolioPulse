/**
 * OrgPage — Combined Organization View.
 *
 * Merges Portfolio Structure (Domain→Team→Member tree, full CRUD, drag-and-drop,
 * CSV import/export) with Roster (stats bar, search/filter, capacity-bar member
 * cards) into a single page.
 *
 * Key design decisions:
 * - Members display as Roster-style cards (capacity bar + project count) that
 *   navigate to the member profile on click, with Portfolio-style hover edit/delete
 *   overlays and a drag handle for DnD reorder/cross-team move.
 * - Team sub-headers show name + member count + description inline (no expandable panel).
 * - "Building mode" toggle switches the member layout from full cards to compact chips,
 *   making it easier to see the whole org and drag-and-drop members between teams.
 * - Domain sections use Roster's horizontal-divider style with DnD grip + actions.
 * - Stats bar is computed over all members regardless of filter state.
 * - SortableContext for domains and teams always includes ALL IDs (not just filtered)
 *   so DnD sort positions stay stable when filters hide some items.
 * - SortableContext for members uses only filtered IDs (cross-team moves use drop
 *   zones, so hidden members don't need to be in the sort context).
 *
 * Route: /org
 */

import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Users, UserCircle, GripVertical,
  Plus, Pencil, Trash2, ChevronRight,
  Download, Upload, Search, SearchX,
  TrendingUp, AlertTriangle, Zap, UserCheck, X, Layers,
} from 'lucide-react'
import { memberQuarterAllocation, getCurrentQBounds } from '@/lib/fiscal'
import {
  DndContext, DragOverlay, closestCenter, pointerWithin,
  PointerSensor, useSensor, useSensors,
  useDroppable,
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
import { FilterChip } from '@/components/ui/filter-chip'
import { StatCard } from '@/components/ui/stat-card'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { cn } from '@/lib/utils'
import { avatarColor } from '@/lib/colors'
import { roleCategoryOf, ALL_ROLE_CATEGORIES } from '@/lib/roles'
import type { Domain, Team, Member, Project } from '@/types'

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

/** Which kind of item is actively being dragged — controls drop-zone highlighting. */
type ActiveDragType = 'member' | 'team' | 'domain' | null

type AllocFilter = 'all' | 'at-risk' | 'over'

/**
 * Pre-computed team entry passed from OrgPage down to OrgTeamSection.
 * Separating allMembers (for TeamPanel) from members (visible after filtering)
 * ensures the panel always shows the full roster regardless of active filters.
 */
type FilteredTeamEntry = {
  team: Team
  allMembers: Member[]
  members: Member[]
}

// ─── Custom collision detection ───────────────────────────────────────────
// Three drag modes, each using a different collision strategy:
//   domain — closestCenter restricted to other domain sortables only
//   team   — explicit domaindrop: zones first, then closestCenter on teams
//   member — explicit teamdrop:/domaindrop: zones first, then closestCenter

function collisionDetection(args: Parameters<typeof closestCenter>[0]) {
  const dragType = (args.active.data.current as any)?.type

  if (dragType === 'domain') {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(c =>
        (c.data.current as any)?.type === 'domain'
      ),
    })
  }

  if (dragType === 'team') {
    const zoneHits = pointerWithin(args).filter(c => String(c.id).startsWith('domaindrop:'))
    if (zoneHits.length > 0) return zoneHits
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(c =>
        (c.data.current as any)?.type === 'team'
      ),
    })
  }

  // Member: check explicit drop zones first, fall back to closestCenter
  const zoneHits = pointerWithin(args).filter(c => {
    const id = String(c.id)
    return id.startsWith('teamdrop:') || id.startsWith('domaindrop:')
  })
  if (zoneHits.length > 0) return zoneHits
  return closestCenter(args)
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Count projects overlapping the current fiscal quarter for a given member.
 * Mirrors the version in RosterPage (not exported from there).
 */
function memberQuarterProjectCount(memberId: string, projects: Project[]): number {
  const { qStart, qEnd } = getCurrentQBounds()
  return projects.filter(p => {
    if (!p.startDate || !p.targetEndDate) return false
    if (!p.assignments.some(a => a.memberId === memberId)) return false
    const pStart = new Date(p.startDate + 'T00:00:00')
    const pEnd   = new Date(p.targetEndDate + 'T00:00:00')
    return pStart < qEnd && pEnd > qStart
  }).length
}

// ─── Drag overlay previews ────────────────────────────────────────────────
// Floating cards rendered by DragOverlay while an item is in flight.

function MemberDragPreview({ member }: { member: Member }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-blue-300 shadow-lg opacity-90 pointer-events-none">
      <GripVertical size={14} className="text-slate-400" />
      <div className={cn(
        'flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0',
        avatarColor(member.name).bg, avatarColor(member.name).text,
      )}>
        {member.avatarInitials.slice(0, 2)}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{member.name}</p>
        <p className="text-xs text-slate-400 truncate">{member.role}</p>
      </div>
    </div>
  )
}

function TeamDragPreview({ team }: { team: Team }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-lg border border-violet-300 shadow-lg opacity-90 pointer-events-none">
      <GripVertical size={14} className="text-slate-400" />
      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-100 shrink-0">
        <Users size={13} className="text-blue-600" />
      </div>
      <span className="text-sm font-medium text-slate-800">{team.name}</span>
    </div>
  )
}

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

// ─── Combined member card ─────────────────────────────────────────────────
/**
 * OrgMemberCard — Roster-style capacity card with Portfolio DnD + CRUD overlays.
 *
 * Clicking the card body navigates to the member profile (Roster behavior).
 * A drag handle appears on hover in the top-right for DnD reorder/move (Portfolio).
 * Edit/delete buttons appear on hover in the bottom-right (Portfolio).
 * Left-border accent and card tint signal over-capacity or at-risk state (Roster).
 */
function OrgMemberCard({
  member,
  teamId,
  onEdit,
  onDelete,
}: {
  member: Member
  teamId: string
  onEdit: () => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const { projects } = usePortfolioStore()

  const alloc    = memberQuarterAllocation(member.id, projects)
  const cap      = member.capacity
  const isOver   = alloc > cap
  const isAtRisk = !isOver && cap > 0 && alloc / cap > 0.8

  const qProjectCount = memberQuarterProjectCount(member.id, projects)

  const barPct   = cap > 0 ? Math.min((alloc / cap) * 100, 100) : Math.min(alloc, 100)
  const barColor = isOver ? 'bg-red-500' : isAtRisk ? 'bg-amber-400' : 'bg-green-500'
  const allocTextColor = isOver
    ? 'text-red-600 dark:text-red-400'
    : isAtRisk
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-green-600 dark:text-green-400'

  // Left-border accent — always visible; red/amber for capacity warnings,
  // slate for normal members so every card has a consistent left stroke.
  const borderAccent = isOver
    ? 'border-l-red-400'
    : isAtRisk
    ? 'border-l-amber-400'
    : 'border-l-slate-300 dark:border-l-slate-600'
  const cardTint = isOver
    ? 'bg-red-50 dark:bg-red-950/20'
    : isAtRisk
    ? 'bg-amber-50 dark:bg-amber-950/20'
    : 'bg-white dark:bg-slate-800'

  const { bg: avatarBg, text: avatarText } = avatarColor(member.name)

  // DnD sortable — 5px activation distance prevents accidental drags on click.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: member.id,
      data: { type: 'member', fromTeamId: teamId },
    })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={cn(
        'relative rounded-lg border border-slate-200 dark:border-slate-700',
        'border-l-4 px-3 py-2.5 group transition-shadow hover:shadow-sm',
        borderAccent,
        cardTint,
      )}
    >
      {/* Drag handle — top-right, hover-visible. stopPropagation prevents
          the underlying card-body click from also firing when dropping. */}
      <button
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        className="absolute top-2 right-2 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
        tabIndex={-1}
        title="Drag to reorder or move to another team"
      >
        <GripVertical size={13} />
      </button>

      {/* Clickable body — navigates to member profile */}
      {/* Pass from: '/org' so MemberDetailPage can render a contextual Back button */}
      <div onClick={() => navigate(`/members/${member.id}`, { state: { from: '/org' } })} className="cursor-pointer">

        {/* Row 1: Avatar + name + role. Right-padding reserves space for the grip handle. */}
        <div className="flex items-center gap-2.5 pr-5">
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0',
            avatarBg, avatarText,
          )}>
            {member.avatarInitials.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight truncate">
              {member.name}
              {/* Multi-team indicator pill — shown when a member belongs to more than one team */}
              {member.teamIds.length > 1 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300 text-[10px] font-bold leading-none align-top relative -top-0.5">
                  {member.teamIds.length}
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1.5 leading-tight">
              {member.employmentType === 'Contractor' && (
                <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Contractor
                </span>
              )}
              {member.role}
              {/* Arrow pointing to manager name instead of a dot separator */}
              {member.reportsTo && (
                <><span className="text-slate-300 dark:text-slate-600">→</span>{member.reportsTo}</>
              )}
            </p>
          </div>
        </div>

        {/* Row 2: Q allocation bar + percentage vs capacity ceiling */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Q Allocation</span>
            <span className={cn('text-[11px] font-bold tabular-nums', allocTextColor)}>
              {alloc}%
              <span className="font-normal text-slate-400 dark:text-slate-500"> / {cap}%</span>
            </span>
          </div>
          <div className="w-full h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: `${barPct}%` }}
            />
          </div>
        </div>

        {/* Row 3: Project count + capacity status label */}
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {qProjectCount === 0
              ? 'No epics this quarter'
              : `${qProjectCount} epic${qProjectCount !== 1 ? 's' : ''} this quarter`}
          </span>
          {isOver   && <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Over</span>}
          {isAtRisk && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">At Risk</span>}
        </div>
      </div>

      {/* Edit / Delete overlay — bottom-right, hover-visible.
          stopPropagation prevents the card-body navigate from also firing. */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shadow-sm"
          title="Edit member"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="p-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-red-500 shadow-sm"
          title="Delete member"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}


// ─── Compact member chip (building mode) ─────────────────────────────────
/**
 * OrgMemberChip — compact draggable pill shown in building mode.
 * Shows just the avatar initials + name so many members fit in a row.
 * Drag handle is always visible (not hover-only) to make DnD obvious.
 * Amber tint distinguishes contractors from Kroger FTEs at a glance.
 */
function OrgMemberChip({
  member,
  teamId,
  onEdit,
  onDelete,
}: {
  member: Member
  teamId: string
  onEdit: () => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const { bg: avatarBg, text: avatarText } = avatarColor(member.name)
  const { projects } = usePortfolioStore()
  const alloc  = memberQuarterAllocation(member.id, projects)
  const cap    = member.capacity
  const isOver = alloc > cap

  // Same useSortable setup as OrgMemberCard — keeps cross-team DnD working in both modes.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: member.id, data: { type: 'member', fromTeamId: teamId } })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={cn(
        'group flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg border',
        'transition-shadow hover:shadow-sm cursor-default',
        // Contractor gets an amber tint to distinguish from FTE
        member.employmentType === 'Contractor'
          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
        isOver && 'border-red-300 dark:border-red-700',
      )}
    >
      {/* Always-visible drag handle — makes DnD affordance obvious in building mode */}
      <button
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none shrink-0"
        tabIndex={-1}
      >
        <GripVertical size={11} />
      </button>

      {/* Avatar — click navigates to member profile */}
      <div
        className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0',
          avatarBg, avatarText,
        )}
        onClick={() => navigate(`/members/${member.id}`, { state: { from: '/org' } })}
        style={{ cursor: 'pointer' }}
      >
        {member.avatarInitials.slice(0, 2)}
      </div>

      {/* Name — click navigates to member profile */}
      <span
        className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        onClick={() => navigate(`/members/${member.id}`, { state: { from: '/org' } })}
      >
        {member.name}
      </span>

      {/* Contractor badge — small "C" pill, visible without taking much space */}
      {member.employmentType === 'Contractor' && (
        <span className="text-[9px] font-semibold px-1 py-0 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 shrink-0">
          C
        </span>
      )}

      {/* Over-capacity dot — red signal without needing a full bar */}
      {isOver && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title={`Over capacity: ${alloc}%`} />
      )}

      {/* Edit/delete — hover-only to keep chips compact by default */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0">
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          className="p-0.5 rounded text-slate-300 hover:text-slate-600"
          title="Edit"
        >
          <Pencil size={10} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="p-0.5 rounded text-slate-300 hover:text-red-500"
          title="Delete"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

// ─── Combined team section ────────────────────────────────────────────────
/**
 * OrgTeamSection — team within a domain, combining Portfolio DnD + Roster UX.
 *
 * Header: DnD grip (reorder/cross-domain move) + team name/description inline +
 *   Portfolio-style hover action buttons. The header div is also the member-drop
 *   zone for cross-team member moves.
 *
 * Body: member card grid (normal mode) or compact chip row (building mode),
 *   both inside a SortableContext for within-team DnD reorder.
 */
function OrgTeamSection({
  team,
  filteredMembers,
  activeDragType,
  buildingMode,
  setModal,
  setDeleteTarget,
}: {
  team: Team
  filteredMembers: Member[]
  activeDragType: ActiveDragType
  /** When true, renders compact chips instead of full capacity cards for easier DnD. */
  buildingMode: boolean
  setModal: (m: ModalState) => void
  setDeleteTarget: (t: DeleteTarget) => void
}) {
  // Whether the member grid is visible. Starts expanded.
  const [isCollapsed, setIsCollapsed] = useState(false)

  // ── Team sortable (reorder within domain or move to another domain) ───
  const {
    attributes: teamDragAttrs,
    listeners: teamDragListeners,
    setNodeRef: setTeamSortRef,
    transform,
    transition,
    isDragging: isTeamDragging,
  } = useSortable({
    id: team.id,
    data: { type: 'team', teamId: team.id, fromDomainId: team.domainId },
  })

  // ── Member drop zone (cross-team member moves) ────────────────────────
  const {
    setNodeRef: setMemberDropRef,
    isOver: memberIsOver,
  } = useDroppable({
    id: `teamdrop:${team.id}`,
    data: { type: 'team-drop', teamId: team.id },
  })

  return (
    <div
      ref={setTeamSortRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isTeamDragging ? 0.4 : 1 }}
      className="mb-5"
    >
      {/* Team header: serves as the member droppable zone + has DnD grip + clickable toggle + action buttons */}
      <div
        ref={setMemberDropRef}
        className={cn(
          'flex items-center gap-2 mb-3 group rounded-lg px-2 py-1.5 transition-colors',
          // Highlight all team headers when any member is being dragged
          activeDragType === 'member' && 'ring-2 ring-inset ring-blue-200 dark:ring-blue-800',
          // Stronger highlight when pointer is over this specific team
          memberIsOver && 'ring-2 ring-inset ring-blue-400 bg-blue-50 dark:bg-blue-950/30',
        )}
      >
        {/* Team grip — drag to reorder or move to another domain */}
        <button
          {...teamDragAttrs}
          {...teamDragListeners}
          className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          tabIndex={-1}
          title="Drag to reorder or move to another domain"
        >
          <GripVertical size={13} />
        </button>

        {/* Collapse/expand chevron — toggles the member grid (and TeamPanel) */}
        <button
          onClick={() => setIsCollapsed(v => !v)}
          className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 shrink-0"
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'Expand team' : 'Collapse team'}
        >
          <ChevronRight
            size={13}
            className={cn('transition-transform duration-150', !isCollapsed && 'rotate-90')}
          />
        </button>

        {/* Team name + description — inline, no expandable panel */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Users size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0">
            {team.name}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
            · {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
          </span>
          {team.description && (
            <span className="text-xs text-slate-400 dark:text-slate-500 truncate hidden sm:block">
              · {team.description}
            </span>
          )}
        </div>

        {/* Portfolio-style action buttons — appear on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setModal({ type: 'member', mode: 'add', teamId: team.id })}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60"
          >
            <Plus size={11} /> Member
          </button>
          <button
            onClick={() => setModal({ type: 'team', mode: 'edit', team })}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={() => setDeleteTarget({ type: 'team', id: team.id, name: team.name })}
            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Team body — hidden when collapsed. Renders either compact chips (building
          mode) or full capacity cards (normal mode), both in a SortableContext for
          within-team DnD reorder. Cross-team moves go through teamdrop zones. */}
      {!isCollapsed && (
        <>
          {buildingMode ? (
            /* Building mode: compact chips laid out in a wrapping row for easy DnD */
            <div className="flex flex-wrap gap-1.5">
              <SortableContext items={filteredMembers.map(m => m.id)} strategy={verticalListSortingStrategy}>
                {filteredMembers.map(m => (
                  <OrgMemberChip
                    key={m.id}
                    member={m}
                    teamId={team.id}
                    onEdit={() => setModal({ type: 'member', mode: 'edit', member: m })}
                    onDelete={() => setDeleteTarget({ type: 'member', id: m.id, name: m.name })}
                  />
                ))}
              </SortableContext>
            </div>
          ) : (
            /* Normal mode: full capacity cards in a responsive grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <SortableContext items={filteredMembers.map(m => m.id)} strategy={verticalListSortingStrategy}>
                {filteredMembers.map(m => (
                  <OrgMemberCard
                    key={m.id}
                    member={m}
                    teamId={team.id}
                    onEdit={() => setModal({ type: 'member', mode: 'edit', member: m })}
                    onDelete={() => setDeleteTarget({ type: 'member', id: m.id, name: m.name })}
                  />
                ))}
              </SortableContext>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Combined domain section ──────────────────────────────────────────────
/**
 * OrgDomainSection — a domain in the org tree, combining Portfolio DnD + Roster UX.
 *
 * Uses Roster's horizontal-divider header style instead of Portfolio's collapsible
 * accordion card, making the page feel more like a roster than an admin tree.
 * The header div also serves as the team-drop zone for cross-domain team moves.
 *
 * SortableContext uses ALL teams in the domain (not just filtered) so DnD sort
 * positions remain stable when some teams are hidden by active filters.
 */
function OrgDomainSection({
  domain,
  filteredTeams,
  activeDragType,
  buildingMode,
  setModal,
  setDeleteTarget,
}: {
  domain: Domain
  filteredTeams: FilteredTeamEntry[]
  activeDragType: ActiveDragType
  /** Passed down to OrgTeamSection — switches member layout to compact chips. */
  buildingMode: boolean
  setModal: (m: ModalState) => void
  setDeleteTarget: (t: DeleteTarget) => void
}) {
  // Whether the team list is visible. Starts expanded.
  const [isCollapsed, setIsCollapsed] = useState(false)

  // All teams in this domain — needed for SortableContext even when some are filtered.
  const { teams } = usePortfolioStore()
  const allDomainTeams = teams.filter(t => t.domainId === domain.id)

  const filteredMemberCount = filteredTeams.reduce((s, t) => s + t.members.length, 0)

  // ── Domain sortable (reorder domains) ────────────────────────────────
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

  // ── Team drop zone (cross-domain team moves) ──────────────────────────
  // Separate domaindrop: prefix keeps this out of the domain sort collision pool.
  const { setNodeRef: setTeamDropRef, isOver: teamIsOver } = useDroppable({
    id: `domaindrop:${domain.id}`,
    data: { type: 'domain-drop', domainId: domain.id },
  })

  return (
    <div
      ref={setDomainSortRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDomainDragging ? 0.4 : 1 }}
      className="mb-8"
    >
      {/* Domain header — Roster horizontal-divider style with DnD grip and action buttons.
          The inner div gets the team-drop zone ref so dropping a team triggers a
          cross-domain move rather than a domain sort. */}
      <div
        ref={setTeamDropRef}
        className={cn(
          'flex items-center gap-3 mb-4 group',
          'px-1 py-1.5 rounded-lg transition-colors',
          // Highlight when a team is being dragged (drop target hint)
          activeDragType === 'team' && 'ring-2 ring-inset ring-violet-200 dark:ring-violet-800',
          // Stronger highlight when pointer is directly over this domain
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
          <GripVertical size={13} />
        </button>

        {/* Collapse/expand chevron for the domain's team list */}
        <button
          onClick={() => setIsCollapsed(v => !v)}
          className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 shrink-0"
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'Expand domain' : 'Collapse domain'}
        >
          <ChevronRight
            size={13}
            className={cn('transition-transform duration-150', !isCollapsed && 'rotate-90')}
          />
        </button>

        {/* Domain name + owner + member count — left-aligned (no left rule) */}
        <div className="flex items-center gap-2 shrink-0">
          <Building2 size={13} className="text-violet-500 dark:text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            {domain.name}
          </h2>
          {domain.owner && (
            <span className="text-xs text-slate-400 dark:text-slate-500">· {domain.owner}</span>
          )}
          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
            {filteredMemberCount} member{filteredMemberCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Rule extends right from the domain name to fill remaining space */}
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />

        {/* Action buttons — hover to reveal */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setModal({ type: 'team', mode: 'add', domainId: domain.id })}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300"
          >
            <Plus size={11} /> Team
          </button>
          <button
            onClick={() => setModal({ type: 'domain', mode: 'edit', domain })}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={() => setDeleteTarget({ type: 'domain', id: domain.id, name: domain.name })}
            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Team list — only shown when domain is expanded.
          Wrapped in an indented container with a left border to create a clear visual
          grouping: teams are children of the domain, not peers.
          SortableContext always includes ALL team IDs for stable DnD sort. */}
      {!isCollapsed && (
        <div className="ml-7 pl-5 border-l-2 border-slate-200 dark:border-slate-700">
          <SortableContext items={allDomainTeams.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {filteredTeams.map(({ team, members: fm }) => (
              <OrgTeamSection
                key={team.id}
                team={team}
                filteredMembers={fm}
                activeDragType={activeDragType}
                buildingMode={buildingMode}
                setModal={setModal}
                setDeleteTarget={setDeleteTarget}
              />
            ))}
          </SortableContext>
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
  const [name, setName]               = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [owner, setOwner]             = useState(initial?.owner ?? '')

  // Build owner dropdown from SAT Leadership domain members — always reflects
  // the live roster rather than a hardcoded list.
  const domains = usePortfolioStore(s => s.domains)
  const teams   = usePortfolioStore(s => s.teams)
  const members = usePortfolioStore(s => s.members)
  const leadershipDomain  = domains.find(d => d.name === 'SAT Leadership')
  const leadershipTeamIds = new Set(
    leadershipDomain ? teams.filter(t => t.domainId === leadershipDomain.id).map(t => t.id) : []
  )
  const ownerCandidates = members
    .filter(m => m.teamIds.some(tid => leadershipTeamIds.has(tid)))
    .map(m => m.name)
    .sort()

  // If stored owner isn't in the live roster, include it to avoid silent data loss.
  const selectItems = ownerCandidates.includes(owner) || !owner
    ? ownerCandidates
    : [...ownerCandidates, owner]

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
        <Label className="text-xs font-medium text-slate-600">Owner</Label>
        {selectItems.length > 0 ? (
          <Select value={owner || undefined} onValueChange={v => setOwner(v ?? '')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an owner" />
            </SelectTrigger>
            <SelectContent>
              {selectItems.map(n => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Owner name" />
        )}
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
  const [name, setName]               = useState(initial?.name ?? '')
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
  const [name, setName]                 = useState(initial?.name ?? '')
  const [role, setRole]                 = useState(initial?.role ?? '')
  const [reportsTo, setReportsTo]       = useState(initial?.reportsTo ?? '')
  const [teamIds, setTeamIds]           = useState<string[]>(initial?.teamIds ?? [])
  // Default to FTE — absence of employmentType on existing members is treated as FTE.
  const [employmentType, setEmploymentType] = useState<'FTE' | 'Contractor'>(
    initial?.employmentType ?? 'FTE'
  )

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
        onSubmit({ name, role, reportsTo: reportsTo.trim() || undefined, teamIds, capacity: initial?.capacity ?? 100, avatarInitials: deriveInitials(name), employmentType })
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
        <Label htmlFor="m-reports" className="text-xs font-medium text-slate-600">Reports To</Label>
        <Input id="m-reports" value={reportsTo} onChange={e => setReportsTo(e.target.value)} placeholder="e.g. Jane Smith" />
      </div>
      {/* Employment type — distinguishes Kroger FTEs from external contractors */}
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

// ─── CSV helpers ──────────────────────────────────────────────────────────
// Same format as PortfolioPage: Domain, Team, Name, Role, Reports To, Capacity.
// Multi-team members produce one row per team for a flat, round-trippable file.

const CSV_HEADERS = ['Domain', 'Team', 'Name', 'Role', 'Reports To', 'Capacity']

function escapeCell(v: string | number): string {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function buildCSV(
  domains: Domain[],
  teams: Team[],
  members: Member[],
): string {
  const rows: string[] = [CSV_HEADERS.join(',')]
  for (const domain of domains) {
    const domainTeams = teams.filter(t => t.domainId === domain.id)
    for (const team of domainTeams) {
      const teamMembers = members.filter(m => m.teamIds.includes(team.id))
      for (const member of teamMembers) {
        rows.push([
          escapeCell(domain.name),
          escapeCell(team.name),
          escapeCell(member.name),
          escapeCell(member.role),
          escapeCell(member.reportsTo ?? ''),
          escapeCell(member.capacity),
        ].join(','))
      }
    }
  }
  return rows.join('\n')
}

/** Parse a single CSV line, handling quoted cells with embedded commas or quotes. */
function parseCSVLine(line: string): string[] {
  const cells: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      let cell = ''
      i++
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { cell += '"'; i += 2 }
        else if (line[i] === '"') { i++; break }
        else { cell += line[i++] }
      }
      cells.push(cell)
      if (line[i] === ',') i++
    } else {
      const end = line.indexOf(',', i)
      if (end === -1) { cells.push(line.slice(i)); break }
      cells.push(line.slice(i, end))
      i = end + 1
    }
  }
  return cells
}

// ─── Org page ─────────────────────────────────────────────────────────────

export function OrgPage() {
  const {
    domains, teams, members, projects,
    addDomain, updateDomain, deleteDomain, reorderDomains,
    addTeam, updateTeam, deleteTeam, reorderDomainTeams,
    addMember, updateMember, deleteMember,
    reorderTeamMembers,
  } = usePortfolioStore()

  const [modal, setModal]              = useState<ModalState>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [importError, setImportError]  = useState<string | null>(null)
  const fileInputRef                   = useRef<HTMLInputElement>(null)

  // Roster filter state
  const [search, setSearch]                       = useState('')
  const [selectedDomains, setSelectedDomains]     = useState<string[]>([])
  const [allocFilter, setAllocFilter]             = useState<AllocFilter>('all')
  // Role discipline filter — matches the same category buckets as the Planning page
  const [selectedRoleCategories, setSelectedRoleCategories] = useState<string[]>([])

  // Building mode shows compact member chips instead of full cards — easier to
  // see the whole org at once and drag-and-drop people between teams.
  const [buildingMode, setBuildingMode] = useState(false)

  // Active drag tracking — used to highlight drop zones in child components.
  const [activeDragType, setActiveDragType] = useState<ActiveDragType>(null)
  const [activeDragId, setActiveDragId]     = useState<string | null>(null)

  // Single PointerSensor with a 5px activation constraint to distinguish clicks
  // from intentional drags (prevents accidental drag on card click-to-navigate).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // ── Stats — computed over all members, unaffected by filter state ─────
  const stats = useMemo(() => {
    let overCount  = 0
    let riskCount  = 0
    let totalAlloc = 0
    for (const m of members) {
      const alloc = memberQuarterAllocation(m.id, projects)
      const cap   = m.capacity
      totalAlloc += alloc
      if (alloc > cap) overCount++
      else if (cap > 0 && alloc / cap > 0.8) riskCount++
    }
    return {
      total: members.length,
      overCount,
      riskCount,
      avgAlloc: members.length > 0 ? Math.round(totalAlloc / members.length) : 0,
    }
  }, [members, projects])

  // ── Filtered data — drives which domains/teams/members render ─────────
  // Each domain entry has a list of team entries; each team entry has:
  //   allMembers — all team members (for TeamPanel, unaffected by filter)
  //   members    — members passing the active search + allocation filter
  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase()

    const matchesMember = (m: Member): boolean => {
      if (q) {
        const memberTeams = m.teamIds
          .map(tid => teams.find(t => t.id === tid)?.name ?? '')
          .join(' ')
        const haystack = `${m.name} ${m.role} ${memberTeams}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (allocFilter !== 'all') {
        const alloc = memberQuarterAllocation(m.id, projects)
        const cap   = m.capacity
        if (allocFilter === 'over'    && alloc <= cap) return false
        if (allocFilter === 'at-risk' && !(alloc <= cap && cap > 0 && alloc / cap > 0.8)) return false
      }
      // Role discipline filter — bucket the raw title and compare to selected categories
      if (selectedRoleCategories.length > 0 && !selectedRoleCategories.includes(roleCategoryOf(m.role))) return false
      return true
    }

    return domains
      .filter(d => selectedDomains.length === 0 || selectedDomains.includes(d.id))
      .map(d => ({
        domain: d,
        teams: teams
          .filter(t => t.domainId === d.id)
          .map(t => ({
            team: t,
            allMembers: members.filter(m => t.memberIds.includes(m.id)),
            members:    members.filter(m => t.memberIds.includes(m.id) && matchesMember(m)),
          }))
          .filter(t => t.members.length > 0),
      }))
      .filter(d => d.teams.length > 0)
  }, [domains, teams, members, projects, search, selectedDomains, allocFilter, selectedRoleCategories])

  // Deduplicate by member id — members in multiple teams would otherwise be
  // counted once per team, producing a totalShowing that exceeds stats.total.
  const totalShowing = useMemo(() => {
    const seen = new Set<string>()
    for (const d of filteredData)
      for (const t of d.teams)
        for (const m of t.members)
          seen.add(m.id)
    return seen.size
  }, [filteredData])
  const hasActiveFilters = search.trim() !== '' || selectedDomains.length > 0 || allocFilter !== 'all' || selectedRoleCategories.length > 0

  function clearFilters() {
    setSearch('')
    setSelectedDomains([])
    setAllocFilter('all')
    setSelectedRoleCategories([])
  }

  // ── Drag start ────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const t = (event.active.data.current as any)?.type
    setActiveDragType(t === 'member' ? 'member' : t === 'team' ? 'team' : t === 'domain' ? 'domain' : null)
    setActiveDragId(String(event.active.id))
  }

  // ── Drag end ──────────────────────────────────────────────────────────
  // Routes to the correct store action based on what was dragged and where.

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragType(null)
    setActiveDragId(null)

    const { active, over } = event
    if (!over) return

    const activeData = active.data.current as any
    const overId     = String(over.id)

    if (activeData?.type === 'member') {
      const memberId   = String(active.id)
      const fromTeamId = activeData.fromTeamId as string

      if (overId.startsWith('teamdrop:')) {
        // Dropped on a team header → cross-team move
        const toTeamId = overId.replace('teamdrop:', '')
        if (toTeamId === fromTeamId) return
        const member = members.find(m => m.id === memberId)
        if (!member) return
        updateMember(memberId, {
          teamIds: [...member.teamIds.filter(tid => tid !== fromTeamId), toTeamId],
        })
      } else {
        // Dropped on another member → same-team reorder or cross-team move
        const toTeamId = (over.data.current as any)?.fromTeamId as string | undefined
        if (!toTeamId) return

        if (toTeamId === fromTeamId) {
          // Within-team reorder
          const team = teams.find(t => t.id === fromTeamId)
          if (!team) return
          const oldIndex = team.memberIds.indexOf(memberId)
          const newIndex = team.memberIds.indexOf(overId)
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            reorderTeamMembers(fromTeamId, arrayMove(team.memberIds, oldIndex, newIndex))
          }
        } else {
          // Cross-team move via member collision
          const member = members.find(m => m.id === memberId)
          if (!member) return
          updateMember(memberId, {
            teamIds: [...member.teamIds.filter(tid => tid !== fromTeamId), toTeamId],
          })
        }
      }
    } else if (activeData?.type === 'team') {
      const teamId       = activeData.teamId as string
      const fromDomainId = activeData.fromDomainId as string

      if (overId.startsWith('domaindrop:')) {
        // Cross-domain move
        const toDomainId = overId.replace('domaindrop:', '')
        if (toDomainId === fromDomainId) return
        updateTeam(teamId, { domainId: toDomainId })
      } else {
        // Within-domain reorder
        const overTeam = teams.find(t => t.id === overId)
        if (!overTeam || overTeam.domainId !== fromDomainId) return
        const domainTeams = teams.filter(t => t.domainId === fromDomainId)
        const oldIndex = domainTeams.findIndex(t => t.id === teamId)
        const newIndex = domainTeams.findIndex(t => t.id === overId)
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          reorderDomainTeams(fromDomainId, arrayMove(domainTeams.map(t => t.id), oldIndex, newIndex))
        }
      }
    } else if (activeData?.type === 'domain') {
      const oldIndex = domains.findIndex(d => d.id === String(active.id))
      const newIndex = domains.findIndex(d => d.id === overId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        reorderDomains(arrayMove(domains.map(d => d.id), oldIndex, newIndex))
      }
    }
  }

  // ── Modal handlers ────────────────────────────────────────────────────

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
      addTeam({ ...data, domainId: (modal as { domainId: string }).domainId })
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
      ? 'This will also delete all teams and members within this domain.'
      : deleteTarget?.type === 'team'
      ? 'This will also delete all members within this team.'
      : 'This will also remove this member from all projects.'

  // Resolve the active drag item for the DragOverlay floating preview.
  const draggedMember = activeDragType === 'member' ? members.find(m => m.id === activeDragId) ?? null : null
  const draggedTeam   = activeDragType === 'team'   ? teams.find(t => t.id === activeDragId)   ?? null : null
  const draggedDomain = activeDragType === 'domain' ? domains.find(d => d.id === activeDragId) ?? null : null

  // ── CSV export ────────────────────────────────────────────────────────

  function handleDownloadCSV() {
    const csv = buildCSV(domains, teams, members)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `org-roster-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── CSV import ────────────────────────────────────────────────────────
  // Finds or creates domains and teams by name, then adds or merges members.

  function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null)
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so the same file can be re-imported after fixes.
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text  = (ev.target?.result as string) ?? ''
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
        if (lines.length < 2) { setImportError('CSV has no data rows.'); return }

        for (const line of lines.slice(1)) {
          const cols = parseCSVLine(line)
          const [domainName, teamName, memberName, role, reportsTo, capacityRaw] = cols.map(c => c.trim())
          if (!domainName || !teamName || !memberName) continue

          // Find or create domain by name
          let domain = domains.find(d => d.name.toLowerCase() === domainName.toLowerCase())
          if (!domain) {
            addDomain({ name: domainName, description: '', owner: '' })
            domain = usePortfolioStore.getState().domains.find(d => d.name.toLowerCase() === domainName.toLowerCase())!
          }

          // Find or create team within domain
          let team = teams.find(t => t.domainId === domain!.id && t.name.toLowerCase() === teamName.toLowerCase())
            ?? usePortfolioStore.getState().teams.find(t => t.domainId === domain!.id && t.name.toLowerCase() === teamName.toLowerCase())
          if (!team) {
            addTeam({ domainId: domain.id, name: teamName, description: '', techLead: '' })
            team = usePortfolioStore.getState().teams.find(t => t.domainId === domain!.id && t.name.toLowerCase() === teamName.toLowerCase())!
          }

          const existing = members.find(m => m.name.toLowerCase() === memberName.toLowerCase())
            ?? usePortfolioStore.getState().members.find(m => m.name.toLowerCase() === memberName.toLowerCase())

          const capacity = Math.min(100, Math.max(0, Number(capacityRaw) || 100))
          const initials = memberName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

          if (existing) {
            // Merge the new team into the existing member's teamIds if not already there.
            if (!existing.teamIds.includes(team.id)) {
              updateMember(existing.id, { teamIds: [...existing.teamIds, team.id] })
            }
          } else {
            addMember({ teamIds: [team.id], name: memberName, role: role ?? '', reportsTo: reportsTo || undefined, capacity, avatarInitials: initials })
          }
        }
      } catch {
        setImportError('Failed to parse CSV. Check the file format and try again.')
      }
    }
    reader.readAsText(file)
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-4 md:p-8 space-y-6 overflow-y-auto h-full">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">People</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              {totalShowing === stats.total
                ? `${stats.total} member${stats.total !== 1 ? 's' : ''} across ${domains.length} domain${domains.length !== 1 ? 's' : ''}`
                : `${totalShowing} of ${stats.total} members shown`
              }
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Hidden file input for CSV upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCSV}
            />
            <Button onClick={() => setModal({ type: 'domain', mode: 'add' })}>
              <Plus size={15} /> Add Domain
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> Import CSV
            </Button>
            <Button variant="outline" onClick={handleDownloadCSV}>
              <Download size={14} /> Export CSV
            </Button>
          </div>
        </div>

        {/* Import error banner */}
        {importError && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <span>{importError}</span>
            <button type="button" onClick={() => setImportError(null)} className="shrink-0 text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Stats bar ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Members"
            value={stats.total}
            icon={<UserCheck size={18} />}
            iconColor="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          />
          <StatCard
            label="Over Capacity"
            value={stats.overCount}
            icon={<Zap size={18} />}
            iconColor="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            cardTint={stats.overCount > 0 ? 'bg-red-50/50 dark:bg-red-950/10' : undefined}
          />
          <StatCard
            label="At Risk (>80%)"
            value={stats.riskCount}
            icon={<AlertTriangle size={18} />}
            iconColor="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            cardTint={stats.riskCount > 0 ? 'bg-amber-50/50 dark:bg-amber-950/10' : undefined}
          />
          <StatCard
            label="Avg Allocation"
            value={`${stats.avgAlloc}%`}
            icon={<TrendingUp size={18} />}
            iconColor="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
          />
        </div>

        {/* ── Filter bar ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, role, or team…"
              className="pl-8 pr-8 h-9 text-sm dark:bg-slate-800 dark:border-slate-600"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 ml-1">Filter</span>
          {([
            { key: 'all',     label: 'All' },
            { key: 'at-risk', label: '>80% allocated' },
            { key: 'over',    label: 'Over capacity' },
          ] as { key: AllocFilter; label: string }[]).map(({ key, label }) => (
            <FilterChip
              key={key}
              label={label}
              active={allocFilter === key}
              onClick={() => setAllocFilter(key)}
            />
          ))}
          <MultiSelectDropdown
            label="Domain"
            options={domains.map(d => ({ id: d.id, label: d.name }))}
            selected={selectedDomains}
            onChange={setSelectedDomains}
          />
          {/* Role discipline filter — same buckets as the Planning page */}
          <MultiSelectDropdown
            label="Role"
            options={ALL_ROLE_CATEGORIES.map(cat => ({ id: cat, label: cat }))}
            selected={selectedRoleCategories}
            onChange={setSelectedRoleCategories}
          />
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              Clear all
            </button>
          )}
          {/* Building mode toggle — switches to compact chip view for drag-and-drop org building */}
          <button
            onClick={() => setBuildingMode(v => !v)}
            className={cn(
              'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              buildingMode
                ? 'bg-violet-600 text-white border-violet-600 hover:bg-violet-700'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-violet-400 hover:text-violet-600',
            )}
            title={buildingMode ? 'Exit building mode' : 'Enter building mode — compact view for drag-and-drop'}
          >
            <Layers size={12} />
            {buildingMode ? 'Exit Building Mode' : 'Building Mode'}
          </button>
        </div>

        {/* ── Domain tree ──────────────────────────────────────────────── */}
        {filteredData.length === 0 ? (
          domains.length === 0 ? (
            /* Empty state — no domains exist yet */
            <div className="text-center py-16 text-slate-400">
              <Building2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No domains yet</p>
              <p className="text-sm mt-1">Add your first domain to get started</p>
            </div>
          ) : (
            /* No results from active filters */
            <div className="text-center py-20">
              <SearchX size={44} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-500 dark:text-slate-400">No members match your filters</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Try adjusting your search or clearing the active filters.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 text-sm text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )
        ) : (
          /* SortableContext includes ALL domain IDs so DnD sort positions remain
             stable even when the domain filter hides some domains. */
          <SortableContext items={domains.map(d => d.id)} strategy={verticalListSortingStrategy}>
            {filteredData.map(({ domain, teams: filteredTeams }) => (
              <OrgDomainSection
                key={domain.id}
                domain={domain}
                filteredTeams={filteredTeams}
                activeDragType={activeDragType}
                buildingMode={buildingMode}
                setModal={setModal}
                setDeleteTarget={setDeleteTarget}
              />
            ))}
          </SortableContext>
        )}
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
              {modal?.type === 'domain' && <Building2  size={16} className="text-violet-500" />}
              {modal?.type === 'team'   && <Users      size={16} className="text-blue-500"   />}
              {modal?.type === 'member' && <UserCircle size={16} className="text-sky-500"    />}
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-slate-800 dark:text-slate-200">"{deleteTarget?.name}"</span>{' '}
              will be permanently deleted. {deleteWarning}
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
