/**
 * Reusable project add/edit dialog.
 * Used across MemberDetailPage, TeamsPage, CapacityPlannerPage, and anywhere
 * else a project needs to be created or edited.
 *
 * Key pattern: callers must pass `key={project?.id ?? 'new'}` so React fully
 * unmounts and remounts this component when switching between "add" and "edit"
 * modes. Without that, useState keeps stale values from the previous open.
 *
 * The three sub-components below (MemberMultiSelect, StakeholderTagInput,
 * InitiativeCombobox) are built from scratch because shadcn/ui doesn't ship
 * multi-select or tag-input primitives. They're defined in this file to keep
 * them co-located with the form that uses them.
 */
import { useState, useRef, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { X, Check } from 'lucide-react'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { STATUS_COLORS, PHASE_COLORS, PRIORITY_COLORS } from '@/lib/colors'
import { SDLC_ROLES, ROLE_COLORS } from '@/lib/roles'
import { cn } from '@/lib/utils'
import type { Project, ProjectStatus, ProjectPhase, Priority, ProjectMemberAssignment, Member, Initiative } from '@/types'

type ProjectDraft = Omit<Project, 'id' | 'updatedAt'>

const STATUSES: ProjectStatus[] = ['Backlog', 'In Progress', 'Blocked', 'Complete']
const PHASES: ProjectPhase[] = ['Research', 'Discovery', 'Development', 'QA', 'Deployed', 'On Hold']
const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical']

// Chip colors for the Part/Responsibility picker — active state uses the same
// color as the Gantt bar for that role (sourced from shared ROLE_COLORS).
const INACTIVE_CHIP = 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
// Build active chip classes from the shared bg-* color, adding text-white and a matching border.
function roleChipClass(role: string, active: boolean): string {
  if (!active) return INACTIVE_CHIP
  const bg = ROLE_COLORS[role] ?? 'bg-slate-400'
  // Convert "bg-X-500" → "border-X-500" for a matching border
  const border = bg.replace('bg-', 'border-')
  return cn(bg, 'text-white', border)
}

// ─── Member multi-select ───────────────────────────────────────────────────
// Renders selected members as blue pill tags inside a text input box.
// Clicking anywhere in the box opens a searchable dropdown. Clicking outside
// closes it — detected via a mousedown listener on the document (not a blur
// event, because blur fires before the dropdown button's click).

function MemberMultiSelect({ members, assignments, onToggle }: {
  members: Member[]
  assignments: ProjectMemberAssignment[]
  onToggle: (memberId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const selectedIds = assignments.map(a => a.memberId)
  const selectedMembers = members.filter(m => selectedIds.includes(m.id))
  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div ref={ref} className="relative">
      <div
        className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-10 bg-white cursor-text"
        onClick={() => setOpen(true)}
      >
        {selectedMembers.map(m => (
          <span key={m.id} className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 bg-blue-600 text-white rounded-full text-xs font-medium shrink-0">
            {m.name}
            <button
              type="button"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onToggle(m.id) }}
              className="hover:bg-blue-700 rounded-full p-0.5 transition-colors"
            >
              <X size={9} />
            </button>
          </span>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={selectedMembers.length === 0 ? 'Search members…' : ''}
          className="flex-1 min-w-[100px] text-sm outline-none bg-transparent placeholder:text-slate-400"
        />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">No members found</p>
          ) : filtered.map(m => {
            const selected = selectedIds.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onToggle(m.id); setSearch('') }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors',
                  selected && 'text-blue-700 bg-blue-50 hover:bg-blue-50',
                )}
              >
                {m.name}
                {selected && <Check size={13} className="text-blue-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Stakeholder tag input ─────────────────────────────────────────────────
// Stores stakeholders as a comma-separated string (matching the Project type).
// Press Enter or comma to add a tag; Backspace removes the last tag when the
// text input is empty. Tags are deduplicated on entry.

function StakeholderTagInput({ value, onChange }: {
  value: string
  onChange: (v: string) => void
}) {
  const [input, setInput] = useState('')
  const tags = value ? value.split(',').map(s => s.trim()).filter(Boolean) : []

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag || tags.includes(tag)) { setInput(''); return }
    onChange([...tags, tag].join(', '))
    setInput('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag).join(', '))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-10 bg-white cursor-text">
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium shrink-0">
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
          >
            <X size={9} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={tags.length === 0 ? 'Type and press Enter or comma…' : ''}
        className="flex-1 min-w-[140px] text-sm outline-none bg-transparent placeholder:text-slate-400"
      />
    </div>
  )
}

// ─── Initiative searchable combobox ────────────────────────────────────────
// Single-select dropdown with a search input. Stores the initiative's id as
// the value (empty string = "None"). Uses the same mousedown click-outside
// pattern as MemberMultiSelect.

function InitiativeCombobox({ initiatives, value, onChange }: {
  initiatives: Initiative[]
  value: string
  onChange: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const selected = initiatives.find(i => i.id === value)
  const filtered = initiatives.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch('') }}
        className="w-full flex items-center justify-between px-3 h-10 border rounded-md bg-white text-sm text-left hover:border-slate-300 transition-colors"
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected ? selected.name : '— None —'}
        </span>
        <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg">
          <div className="p-2 border-b">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search initiatives…"
              className="w-full text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(''); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 text-slate-400 italic',
                !value && 'bg-blue-50 text-blue-700 not-italic font-medium'
              )}
            >
              — None —
              {!value && <Check size={13} className="text-blue-600" />}
            </button>
            {filtered.map(i => (
              <button
                key={i.id}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(i.id); setOpen(false) }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors',
                  value === i.id && 'text-blue-700 bg-blue-50 hover:bg-blue-50',
                )}
              >
                {i.name}
                {value === i.id && <Check size={13} className="text-blue-600" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-400">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Blocked-by multi-select ───────────────────────────────────────────────
// Lists all projects except the one currently being edited. Selected projects
// are shown as removable red pills to visually reinforce the blocking
// relationship. Uses the same click-outside pattern as MemberMultiSelect.

function BlockedByMultiSelect({ allProjects, selectedIds, onToggle }: {
  allProjects: Project[]
  selectedIds: string[]
  onToggle: (projectId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)
  const ref                 = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const selectedProjects = allProjects.filter(p => selectedIds.includes(p.id))
  const filtered = allProjects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div ref={ref} className="relative">
      <div
        className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-10 bg-white cursor-text"
        onClick={() => setOpen(true)}
      >
        {/* Selected blocking projects rendered as red removable chips */}
        {selectedProjects.map(p => (
          <span key={p.id} className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 bg-red-600 text-white rounded-full text-xs font-medium shrink-0">
            {p.name}
            <button
              type="button"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onToggle(p.id) }}
              className="hover:bg-red-700 rounded-full p-0.5 transition-colors"
            >
              <X size={9} />
            </button>
          </span>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={selectedProjects.length === 0 ? 'Search projects…' : ''}
          className="flex-1 min-w-[100px] text-sm outline-none bg-transparent placeholder:text-slate-400"
        />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">No projects found</p>
          ) : filtered.map(p => {
            const selected = selectedIds.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onToggle(p.id); setSearch('') }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors',
                  selected && 'text-red-700 bg-red-50 hover:bg-red-50',
                )}
              >
                {p.name}
                {selected && <Check size={13} className="text-red-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Field wrapper ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  )
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-populate with an existing project for editing */
  initial?: Project
  /** The member this project belongs to; used when creating */
  defaultMemberId?: string
  onSave: (draft: ProjectDraft, id?: string) => void
}

export function ProjectFormDialog({ open, onOpenChange, initial, defaultMemberId, onSave }: Props) {
  const { initiatives, members, projects } = usePortfolioStore()
  const isEdit = !!initial

  const [name, setName]                 = useState(initial?.name ?? '')
  const [description, setDescription]  = useState(initial?.description ?? '')
  const [status, setStatus]             = useState<ProjectStatus>(initial?.status ?? 'Backlog')
  const [phase, setPhase]               = useState<ProjectPhase>(initial?.phase ?? 'Discovery')
  const [priority, setPriority]         = useState<Priority>(initial?.priority ?? 'Medium')
  const [initiativeId, setInitiativeId] = useState(initial?.initiativeId ?? '')
  const [startDate, setStartDate]       = useState(initial?.startDate ?? '')
  const [targetEndDate, setTargetEnd]   = useState(initial?.targetEndDate ?? '')
  const [percentComplete, setPercent]   = useState(initial?.percentComplete ?? 0)
  const [stakeholders, setStakeholders] = useState(initial?.stakeholders ?? '')
  const [notes, setNotes]               = useState(initial?.notes ?? '')
  /** IDs of projects that block this one. Only available in edit mode. */
  const [blockedByIds, setBlockedByIds] = useState<string[]>(initial?.blockedByIds ?? [])

  const [assignments, setAssignments] = useState<ProjectMemberAssignment[]>(
    initial?.assignments ?? (defaultMemberId ? [{ memberId: defaultMemberId, allocation: 50 }] : [])
  )

  // Reset all fields from the latest `initial` prop each time the dialog opens.
  // Without this, reopening the same project after canceling retains edits because
  // React reuses the component instance (same key = same project ID), so the
  // useState initializers above only run on the very first mount.
  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setDescription(initial?.description ?? '')
    setStatus(initial?.status ?? 'Backlog')
    setPhase(initial?.phase ?? 'Discovery')
    setPriority(initial?.priority ?? 'Medium')
    setInitiativeId(initial?.initiativeId ?? '')
    setStartDate(initial?.startDate ?? '')
    setTargetEnd(initial?.targetEndDate ?? '')
    setPercent(initial?.percentComplete ?? 0)
    setStakeholders(initial?.stakeholders ?? '')
    setNotes(initial?.notes ?? '')
    setBlockedByIds(initial?.blockedByIds ?? [])
    setAssignments(initial?.assignments ?? (defaultMemberId ? [{ memberId: defaultMemberId, allocation: 50 }] : []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]) // intentionally omit `initial` — we only want to reset on open, not on every render

  function isAssigned(memberId: string) {
    return assignments.some(a => a.memberId === memberId)
  }

  function toggleMember(memberId: string) {
    setAssignments(prev =>
      isAssigned(memberId)
        ? prev.filter(a => a.memberId !== memberId)
        : [...prev, { memberId, allocation: 50 }]
    )
  }

  function updateAssignment(memberId: string, patch: Partial<Omit<ProjectMemberAssignment, 'memberId'>>) {
    setAssignments(prev =>
      prev.map(a => a.memberId === memberId ? { ...a, ...patch } : a)
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const draft: ProjectDraft = {
      assignments, name, description, status, phase, priority,
      initiativeId, startDate, targetEndDate,
      percentComplete, stakeholders, notes,
      // Only persist blockedByIds in edit mode; new projects start with none.
      blockedByIds: isEdit ? blockedByIds : [],
    }
    onSave(draft, initial?.id)
    onOpenChange(false)
  }

  const pctColor =
    percentComplete >= 100 ? 'text-green-600' :
    percentComplete >= 60  ? 'text-blue-600'  :
    'text-slate-600'

  const assignedMembers = assignments
    .map(a => ({ assignment: a, member: members.find(m => m.id === a.memberId) }))
    .filter(x => x.member)

  // All projects except the current one — used to populate the Blocked By picker.
  // Excludes self so a project cannot be listed as blocking itself.
  const otherProjects = projects.filter(p => p.id !== initial?.id)

  function toggleBlockedBy(projectId: string) {
    setBlockedByIds(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
        {/* Sticky header */}
        <DialogHeader className="px-6 py-3 border-b border-slate-200 shrink-0">
          <DialogTitle>{isEdit ? 'Edit Project' : 'Add Project'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Name */}
          <Field label="Project Name *">
            <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. POS Terminal Refresh" />
          </Field>

          {/* Description */}
          <Field label="Description">
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What is this project trying to achieve?" />
          </Field>

          {/* Row: Status · Phase · Priority — chip pickers */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Status</Label>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                      status === s
                        ? cn(STATUS_COLORS[s], 'border-current')
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Phase</Label>
              <div className="flex flex-wrap gap-1.5">
                {PHASES.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPhase(p)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                      phase === p
                        ? cn(PHASE_COLORS[p], 'border-current')
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Priority</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRIORITIES.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                      priority === p
                        ? cn(PRIORITY_COLORS[p], 'border-current')
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Initiative */}
          <Field label="Initiative">
            <InitiativeCombobox
              initiatives={initiatives}
              value={initiativeId}
              onChange={setInitiativeId}
            />
          </Field>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date">
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </Field>
            <Field label="Target End Date">
              <Input type="date" value={targetEndDate} onChange={e => setTargetEnd(e.target.value)} />
            </Field>
          </div>

          {/* % Complete */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs font-medium text-slate-600">% Complete</Label>
              <span className={cn('text-sm font-semibold', pctColor)}>{percentComplete}%</span>
            </div>
            <Slider
              min={0} max={100} step={5}
              value={[percentComplete]}
              onValueChange={(v) => setPercent(Array.isArray(v) ? v[0] : v)}
            />
          </div>

          {/* Assigned Members */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-600">Assigned Members</Label>
            <MemberMultiSelect
              members={members}
              assignments={assignments}
              onToggle={toggleMember}
            />

            {/* Per-member part + allocation */}
            {assignedMembers.length > 0 && (
              <div className="border rounded-md divide-y divide-slate-100">
                {assignedMembers.map(({ assignment, member }) => {
                  const selectedParts = assignment.part
                    ? assignment.part.split(', ').filter(Boolean)
                    : []
                  return (
                    <div key={assignment.memberId} className="px-3 py-3 space-y-3">
                      <p className="text-xs font-semibold text-slate-700">{member!.name}</p>

                      {/* Part chips */}
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500">Role</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {SDLC_ROLES.map(role => {
                            const active = selectedParts.includes(role)
                            return (
                              <button
                                key={role}
                                type="button"
                                onClick={() => {
                                  const next = active
                                    ? selectedParts.filter(p => p !== role)
                                    : [...selectedParts, role]
                                  updateAssignment(assignment.memberId, { part: next.join(', ') })
                                }}
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-xs font-medium border transition-all',
                                  roleChipClass(role, active),
                                )}
                              >
                                {role}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Member dates */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Start Date</Label>
                          <Input
                            type="date"
                            value={assignment.startDate ?? ''}
                            onChange={e => updateAssignment(assignment.memberId, { startDate: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">End Date</Label>
                          <Input
                            type="date"
                            value={assignment.endDate ?? ''}
                            onChange={e => updateAssignment(assignment.memberId, { endDate: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      {/* Allocation slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <Label className="text-xs text-slate-500">Allocation %</Label>
                          <span className={cn('text-xs font-semibold',
                            assignment.allocation > 80 ? 'text-red-600' :
                            assignment.allocation > 50 ? 'text-amber-600' : 'text-blue-600'
                          )}>{assignment.allocation}%</span>
                        </div>
                        <Slider
                          min={5} max={100} step={5}
                          value={[assignment.allocation]}
                          onValueChange={v => updateAssignment(assignment.memberId, { allocation: Array.isArray(v) ? v[0] : v })}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Stakeholders */}
          <Field label="Stakeholders">
            <StakeholderTagInput value={stakeholders} onChange={setStakeholders} />
          </Field>

          {/* Notes */}
          <Field label="Notes / Updates">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Latest status notes…" />
          </Field>

          {/* Blocked By — only meaningful when editing an existing project.
              Shown for all statuses so dependencies can be set proactively,
              but particularly relevant when status === 'Blocked'. */}
          {isEdit && (
            <Field label="Blocked By">
              <BlockedByMultiSelect
                allProjects={otherProjects}
                selectedIds={blockedByIds}
                onToggle={toggleBlockedBy}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Select any projects that must complete before this one can proceed.
              </p>
            </Field>
          )}

          </div>

          {/* Sticky footer — plain div to avoid DialogFooter's negative-margin bleed */}
          <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200 bg-muted/50 shrink-0 rounded-b-xl">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{isEdit ? 'Save Changes' : 'Add Project'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
