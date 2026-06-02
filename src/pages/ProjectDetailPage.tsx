/**
 * ProjectDetailPage — full-page project builder.
 *
 * Replaces the modal dialog for creating and editing projects from the
 * Projects page. Renders at /projects/new (create) and /projects/:projectId
 * (edit). The modal (ProjectFormDialog) is kept for inline edits on the
 * Planning and Member Detail pages where navigation would be disruptive.
 *
 * Layout: two-column on desktop
 *   Left  — static project metadata (name, status, priority, initiative, value, etc.)
 *   Right — phase builder: ordered list of PhaseCard components, one per phase step
 *
 * On save, deriveProjectFields() recomputes the root-level flat fields
 * (startDate, targetEndDate, phase, percentComplete, assignments) from the
 * phases array. All other views consume those flat fields and remain unchanged.
 *
 * Legacy projects without a phases array are auto-converted to a single-step
 * plan by legacyToPhases() so opening any existing project just works.
 */

import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, ChevronUp, ChevronDown, Trash2, X, Check,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { PHASE_COLORS, STATUS_COLORS, PRIORITY_COLORS } from '@/lib/colors'
import { SDLC_ROLES, ROLE_COLORS } from '@/lib/roles'
import { deriveProjectFields, legacyToPhases } from '@/lib/projectBuilder'
import { cn } from '@/lib/utils'
import type {
  Project, ProjectPhase, ProjectStatus, Priority,
  ProjectPhaseStep, ProjectMemberAssignment, Member, Initiative,
} from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────

const PHASES:   ProjectPhase[] = ['Research', 'Discovery', 'Development', 'QA', 'Deployed', 'On Hold']
const STATUSES: ProjectStatus[] = ['Backlog', 'In Progress', 'Blocked', 'Complete']
const PRIORITIES: Priority[]   = ['Low', 'Medium', 'High', 'Critical']
const PHASE_STATUSES = ['Not Started', 'In Progress', 'Complete'] as const
const VALUE_TYPES    = ['Revenue Impact', 'Cost Savings'] as const

/** Create a blank phase step with a fresh UUID. */
function newPhase(): ProjectPhaseStep {
  return {
    id:              crypto.randomUUID(),
    phase:           'Discovery',
    startDate:       '',
    endDate:         '',
    assignments:     [],
    status:          'Not Started',
    percentComplete: 0,
    notes:           '',
  }
}

// ─── Shared chip-style button ─────────────────────────────────────────────

/** Active chip classes derived from ROLE_COLORS — same as ProjectFormDialog. */
function roleChipClass(role: string, active: boolean): string {
  if (!active) return 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
  const bg     = ROLE_COLORS[role] ?? 'bg-slate-400'
  const border = bg.replace('bg-', 'border-')
  return cn(bg, 'text-white', border)
}

// ─── Stakeholder tag input ────────────────────────────────────────────────
// Comma-separated tags stored as a plain string; same implementation as
// the one inside ProjectFormDialog so behaviour is identical.

function StakeholderTagInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tags  = value.split(',').map(t => t.trim()).filter(Boolean)
  const [input, setInput] = useState('')

  function addTag(raw: string) {
    const tag = raw.trim()
    if (tag && !tags.includes(tag)) onChange([...tags, tag].join(', '))
    setInput('')
  }
  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag).join(', '))
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-10 bg-white cursor-text">
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium shrink-0">
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="hover:bg-slate-200 rounded-full p-0.5">
            <X size={9} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input) }
          else if (e.key === 'Backspace' && !input && tags.length > 0) removeTag(tags[tags.length - 1])
        }}
        onBlur={() => addTag(input)}
        placeholder={tags.length === 0 ? 'Type and press Enter or comma…' : ''}
        className="flex-1 min-w-[140px] text-sm outline-none bg-transparent placeholder:text-slate-400"
      />
    </div>
  )
}

// ─── Initiative combobox ──────────────────────────────────────────────────

function InitiativeCombobox({ initiatives, value, onChange }: {
  initiatives: Initiative[]
  value: string
  onChange: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const selected = initiatives.find(i => i.id === value)
  const filtered = initiatives.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))

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
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="w-full text-sm outline-none placeholder:text-slate-400" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(''); setOpen(false) }}
              className={cn('w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 text-slate-400 italic', !value && 'bg-blue-50 text-blue-700 not-italic font-medium')}
            >
              — None —
              {!value && <Check size={13} className="text-blue-600" />}
            </button>
            {filtered.map(i => (
              <button key={i.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(i.id); setOpen(false) }}
                className={cn('w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors', value === i.id && 'text-blue-700 bg-blue-50 hover:bg-blue-50')}
              >
                {i.name}
                {value === i.id && <Check size={13} className="text-blue-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Blocked-by multi-select ──────────────────────────────────────────────

function BlockedByMultiSelect({ allProjects, selectedIds, onToggle }: {
  allProjects: Project[]
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const selected = allProjects.filter(p => selectedIds.includes(p.id))
  const filtered = allProjects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-10 bg-white cursor-text" onClick={() => setOpen(true)}>
        {selected.map(p => (
          <span key={p.id} className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 bg-red-600 text-white rounded-full text-xs font-medium shrink-0">
            {p.name}
            <button type="button" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onToggle(p.id) }} className="hover:bg-red-700 rounded-full p-0.5">
              <X size={9} />
            </button>
          </span>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setOpen(true)} placeholder={selected.length === 0 ? 'Search projects…' : ''} className="flex-1 min-w-[100px] text-sm outline-none bg-transparent placeholder:text-slate-400" />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0
            ? <p className="px-3 py-2 text-sm text-slate-400">No projects found</p>
            : filtered.map(p => {
              const sel = selectedIds.includes(p.id)
              return (
                <button key={p.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onToggle(p.id); setSearch('') }}
                  className={cn('w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors', sel && 'text-red-700 bg-red-50 hover:bg-red-50')}
                >
                  {p.name}
                  {sel && <Check size={13} className="text-red-600" />}
                </button>
              )
            })
          }
        </div>
      )}
    </div>
  )
}

// ─── Phase member picker ──────────────────────────────────────────────────
// Inline multi-select for members within a single phase. Selecting a member
// adds them with a default 50% allocation; they can be tuned below the picker.

function PhaseMemberPicker({ members, assignments, onToggle }: {
  members: Member[]
  assignments: ProjectMemberAssignment[]
  onToggle: (memberId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const selectedIds = assignments.map(a => a.memberId)
  const selected    = members.filter(m => selectedIds.includes(m.id))
  const filtered    = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-9 bg-white cursor-text" onClick={() => setOpen(true)}>
        {selected.map(m => (
          <span key={m.id} className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 bg-blue-600 text-white rounded-full text-xs font-medium shrink-0">
            {m.name}
            <button type="button" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onToggle(m.id) }} className="hover:bg-blue-700 rounded-full p-0.5">
              <X size={9} />
            </button>
          </span>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setOpen(true)} placeholder={selected.length === 0 ? 'Add team members…' : ''} className="flex-1 min-w-[120px] text-xs outline-none bg-transparent placeholder:text-slate-400" />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0
            ? <p className="px-3 py-2 text-xs text-slate-400">No members found</p>
            : filtered.map(m => {
              const sel = selectedIds.includes(m.id)
              return (
                <button key={m.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onToggle(m.id); setSearch('') }}
                  className={cn('w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors', sel && 'text-blue-700 bg-blue-50 hover:bg-blue-50')}
                >
                  <span>{m.name} <span className="text-slate-400">· {m.role}</span></span>
                  {sel && <Check size={12} className="text-blue-600 shrink-0" />}
                </button>
              )
            })
          }
        </div>
      )}
    </div>
  )
}

// ─── Phase card ───────────────────────────────────────────────────────────

/**
 * PhaseCard — one card per phase step in the project plan.
 * Shows phase type chips, date range, status, % complete, and the member
 * assignment section (each member gets a role picker + allocation slider).
 * Up/down arrows reorder; trash removes the phase.
 */
function PhaseCard({
  step,
  index,
  total,
  members,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  step: ProjectPhaseStep
  index: number
  total: number
  members: Member[]
  onChange: (updated: ProjectPhaseStep) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  /** Update a single field on the phase step. */
  function set<K extends keyof ProjectPhaseStep>(key: K, val: ProjectPhaseStep[K]) {
    onChange({ ...step, [key]: val })
  }

  /** Toggle a member in this phase's assignment list. */
  function toggleMember(memberId: string) {
    const exists = step.assignments.some(a => a.memberId === memberId)
    set('assignments', exists
      ? step.assignments.filter(a => a.memberId !== memberId)
      : [...step.assignments, { memberId, allocation: 50 }]
    )
  }

  /** Patch a single field on one member's assignment. */
  function updateAssignment(memberId: string, patch: Partial<Omit<ProjectMemberAssignment, 'memberId'>>) {
    set('assignments', step.assignments.map(a => a.memberId === memberId ? { ...a, ...patch } : a))
  }

  // Color the progress number based on completion level.
  const pctColor =
    step.percentComplete >= 100 ? 'text-green-600' :
    step.percentComplete >= 60  ? 'text-blue-600'  :
    'text-slate-600'

  // Derive the border accent color from the phase type.
  const phaseAccent = PHASE_COLORS[step.phase]?.split(' ').find(c => c.startsWith('border-')) ?? 'border-slate-300'

  const assignedMembers = step.assignments
    .map(a => ({ assignment: a, member: members.find(m => m.id === a.memberId) }))
    .filter(x => x.member)

  return (
    <div className={cn('border-l-4 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden', phaseAccent)}>
      {/* Card header — phase label + reorder/delete controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Phase {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={index === 0} className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Move up">
            <ChevronUp size={14} />
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Move down">
            <ChevronDown size={14} />
          </button>
          <button type="button" onClick={onRemove} className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors ml-1" title="Remove phase">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Phase type chips */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Phase Type</Label>
          <div className="flex flex-wrap gap-1.5">
            {PHASES.map(p => (
              <button key={p} type="button" onClick={() => set('phase', p)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  step.phase === p
                    ? cn(PHASE_COLORS[p], 'border-current')
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">Start Date</Label>
            <Input type="date" value={step.startDate} onChange={e => set('startDate', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">End Date</Label>
            <Input type="date" value={step.endDate} onChange={e => set('endDate', e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        {/* Status + % Complete */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Phase Status</Label>
            <div className="flex flex-wrap gap-1.5">
              {PHASE_STATUSES.map(s => (
                <button key={s} type="button" onClick={() => set('status', s)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                    step.status === s
                      ? s === 'Complete'    ? 'bg-green-100 text-green-700 border-green-300'
                        : s === 'In Progress' ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label className="text-xs font-medium text-slate-600">% Complete</Label>
              <span className={cn('text-xs font-semibold', pctColor)}>{step.percentComplete}%</span>
            </div>
            <Slider
              min={0} max={100} step={5}
              value={[step.percentComplete]}
              onValueChange={v => set('percentComplete', Array.isArray(v) ? v[0] : v)}
            />
          </div>
        </div>

        {/* Team assignment */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-600">Team Members</Label>
          <PhaseMemberPicker members={members} assignments={step.assignments} onToggle={toggleMember} />

          {/* Per-member: role chips + allocation slider */}
          {assignedMembers.length > 0 && (
            <div className="border rounded-lg divide-y divide-slate-100 mt-2">
              {assignedMembers.map(({ assignment, member }) => {
                const selectedParts = assignment.part
                  ? assignment.part.split(', ').filter(Boolean)
                  : []
                return (
                  <div key={assignment.memberId} className="px-3 py-3 space-y-2.5">
                    <p className="text-xs font-semibold text-slate-700">{member!.name}
                      <span className="ml-1.5 font-normal text-slate-400">· {member!.role}</span>
                    </p>

                    {/* Role chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {SDLC_ROLES.map(role => {
                        const active = selectedParts.includes(role)
                        return (
                          <button key={role} type="button"
                            onClick={() => {
                              const next = active
                                ? selectedParts.filter(p => p !== role)
                                : [...selectedParts, role]
                              updateAssignment(assignment.memberId, { part: next.join(', ') })
                            }}
                            className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all', roleChipClass(role, active))}
                          >
                            {role}
                          </button>
                        )
                      })}
                    </div>

                    {/* Allocation slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-slate-500">Allocation</span>
                        <span className={cn('text-[10px] font-semibold',
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

        {/* Optional phase notes */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-600">Phase Notes</Label>
          <Textarea
            value={step.notes ?? ''}
            onChange={e => set('notes', e.target.value)}
            rows={2}
            placeholder="Notes specific to this phase…"
            className="text-sm resize-none"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Left-panel field wrapper ─────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate      = useNavigate()
  const { projects, members, initiatives, addProject, updateProject } = usePortfolioStore()

  // Resolve existing project (undefined for /projects/new).
  const existing = projectId ? projects.find(p => p.id === projectId) : undefined
  const isEdit   = !!existing

  // ── Left panel — project metadata ──────────────────────────────────────
  const [name,           setName]          = useState(existing?.name            ?? '')
  const [description,    setDescription]   = useState(existing?.description     ?? '')
  const [status,         setStatus]        = useState<ProjectStatus>(existing?.status   ?? 'Backlog')
  const [priority,       setPriority]      = useState<Priority>(existing?.priority ?? 'Medium')
  const [initiativeId,   setInitiativeId]  = useState(existing?.initiativeId    ?? '')
  const [stakeholders,   setStakeholders]  = useState(existing?.stakeholders    ?? '')
  const [notes,          setNotes]         = useState(existing?.notes           ?? '')
  const [blockedByIds,   setBlockedByIds]  = useState<string[]>(existing?.blockedByIds ?? [])
  const [valueType,      setValueType]     = useState<'Revenue Impact' | 'Cost Savings' | ''>(existing?.valueType ?? '')
  const [estimatedValue, setEstimatedValue] = useState<string>(existing?.estimatedValue?.toString() ?? '')
  const [actualValue,    setActualValue]   = useState<string>(existing?.actualValue?.toString()    ?? '')

  // ── Right panel — phases ───────────────────────────────────────────────
  // If the project already has phases use them; legacy projects are auto-
  // converted; new projects start with one empty phase.
  const [phases, setPhases] = useState<ProjectPhaseStep[]>(() => {
    if (existing?.phases && existing.phases.length > 0) return existing.phases
    if (existing) return legacyToPhases(existing)
    return [newPhase()]
  })

  // All other projects — used for the Blocked By picker.
  const otherProjects = projects.filter(p => p.id !== existing?.id)

  // ── Phase mutations ────────────────────────────────────────────────────

  function updatePhase(index: number, updated: ProjectPhaseStep) {
    setPhases(prev => prev.map((p, i) => i === index ? updated : p))
  }

  function addPhase() {
    setPhases(prev => [...prev, newPhase()])
  }

  function removePhase(index: number) {
    setPhases(prev => prev.filter((_, i) => i !== index))
  }

  function movePhase(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1
    setPhases(prev => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  // ── Save ───────────────────────────────────────────────────────────────

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    // Derive the flat root-level fields from the phases array so all other
    // views (Gantt, Dashboard, Analytics) continue to work unchanged.
    const derived = deriveProjectFields(phases)

    const parsedEstimated = estimatedValue ? Number(estimatedValue.replace(/[$,\s]/g, '')) : undefined
    const parsedActual    = actualValue    ? Number(actualValue.replace(/[$,\s]/g, ''))    : undefined

    const draft: Omit<Project, 'id' | 'updatedAt'> = {
      ...derived,
      name:           name.trim(),
      description,
      status,
      priority,
      initiativeId,
      stakeholders,
      notes,
      blockedByIds:   isEdit ? blockedByIds : [],
      valueType:      valueType || undefined,
      estimatedValue: valueType && parsedEstimated && !isNaN(parsedEstimated) ? parsedEstimated : undefined,
      actualValue:    status === 'Complete' && parsedActual && !isNaN(parsedActual) ? parsedActual : undefined,
      phases,
    }

    if (isEdit) {
      updateProject(existing!.id, draft)
    } else {
      addProject(draft)
    }
    navigate('/projects')
  }

  // ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">

      {/* ── Sticky page header ─────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/projects" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors shrink-0">
            <ArrowLeft size={15} />
            Projects
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-base font-semibold text-slate-800 truncate">
            {name.trim() || (isEdit ? 'Edit Project' : 'New Project')}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/projects')}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={!name.trim()}>
            {isEdit ? 'Save Changes' : 'Create Project'}
          </Button>
        </div>
      </div>

      {/* ── Two-column body ────────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="flex flex-1 min-h-0 gap-0">

        {/* Left panel — static project metadata */}
        <aside className="w-96 shrink-0 bg-white border-r border-slate-200 overflow-y-auto p-5 space-y-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Project Details</h2>

          <Field label="Project Name *">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. POS Terminal Refresh"
              required
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this project trying to achieve?"
              className="resize-none"
            />
          </Field>

          {/* Status chips */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Current Status</Label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
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

          {/* Priority chips */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Priority</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)}
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

          <Field label="Initiative">
            <InitiativeCombobox initiatives={initiatives} value={initiativeId} onChange={setInitiativeId} />
          </Field>

          {/* Value tracking */}
          <Field label="Value Type">
            <Select value={valueType || undefined} onValueChange={v => setValueType(v as 'Revenue Impact' | 'Cost Savings')}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {VALUE_TYPES.map(vt => <SelectItem key={vt} value={vt}>{vt}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          {valueType && (
            <Field label="Estimated Value" hint={`Dollar amount of expected ${valueType.toLowerCase()}.`}>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-500">$</span>
                <Input type="text" inputMode="numeric" value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} placeholder="e.g. 500000" className="text-right" />
              </div>
            </Field>
          )}

          {status === 'Complete' && (
            <Field label="Actual Value Realized" hint="Actual value delivered after project completion.">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-500">$</span>
                <Input type="text" inputMode="numeric" value={actualValue} onChange={e => setActualValue(e.target.value)} placeholder="e.g. 450000" className="text-right" />
              </div>
            </Field>
          )}

          {/* Blocked By — edit mode only; new projects have no dependencies yet */}
          {isEdit && (
            <Field label="Blocked By" hint="Projects that must complete before this one can proceed.">
              <BlockedByMultiSelect allProjects={otherProjects} selectedIds={blockedByIds} onToggle={id => setBlockedByIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} />
            </Field>
          )}

          <Field label="Stakeholders">
            <StakeholderTagInput value={stakeholders} onChange={setStakeholders} />
          </Field>

          <Field label="Project Notes">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Latest status notes…" className="resize-none" />
          </Field>
        </aside>

        {/* Right panel — phase builder */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-4">

            {/* Panel header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Project Plan</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Break the project into sequential phases. Each phase has its own team, timeline, and progress.
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addPhase} className="gap-1.5 shrink-0">
                <Plus size={14} />
                Add Phase
              </Button>
            </div>

            {/* Phase cards */}
            {phases.length === 0 ? (
              <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-sm">No phases yet.</p>
                <button type="button" onClick={addPhase} className="mt-2 text-sm text-blue-600 hover:underline">
                  Add your first phase →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {phases.map((step, i) => (
                  <PhaseCard
                    key={step.id}
                    step={step}
                    index={i}
                    total={phases.length}
                    members={members}
                    onChange={updated => updatePhase(i, updated)}
                    onMoveUp={() => movePhase(i, 'up')}
                    onMoveDown={() => movePhase(i, 'down')}
                    onRemove={() => removePhase(i)}
                  />
                ))}

                {/* Add phase button at the bottom of the list */}
                <button
                  type="button"
                  onClick={addPhase}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={15} />
                  Add Phase
                </button>
              </div>
            )}
          </div>
        </main>
      </form>
    </div>
  )
}
