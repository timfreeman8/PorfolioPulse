import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Target, Link } from 'lucide-react'
import { FilterChip } from '@/components/ui/filter-chip'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { ColorBadge } from '@/components/ui/color-badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { INITIATIVE_STATUS_COLORS, STATUS_COLORS, PHASE_COLORS, PRIORITY_COLORS } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { Initiative, InitiativeStatus } from '@/types'

const STATUSES: InitiativeStatus[] = ['Planning', 'Active', 'Complete', 'On Hold']

const STATUS_BORDER: Record<InitiativeStatus, string> = {
  Planning:  'border-l-slate-400',
  Active:    'border-l-blue-500',
  Complete:  'border-l-green-500',
  'On Hold': 'border-l-amber-400',
}

// Dark-mode variants darken the colored backgrounds so they read well on
// dark surfaces without washing out.
const STATUS_ICON_BG: Record<InitiativeStatus, string> = {
  Planning:  'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
  Active:    'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
  Complete:  'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400',
  'On Hold': 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
}

const QUARTERS = [
  'Q1 2025','Q2 2025','Q3 2025','Q4 2025',
  'Q1 2026','Q2 2026','Q3 2026','Q4 2026',
  'Q1 2027','Q2 2027','Q3 2027','Q4 2027',
]

// ─── Initiative form ──────────────────────────────────────────────────────

function InitiativeForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Initiative>
  onSubmit: (data: Omit<Initiative, 'id'>) => void
  onCancel: () => void
}) {
  const [name, setName]               = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [targetQuarter, setQuarter]   = useState(initial?.targetQuarter ?? 'Q3 2026')
  const [status, setStatus]           = useState<InitiativeStatus>(initial?.status ?? 'Planning')

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit({ name, description, targetQuarter, status }) }}
      className="space-y-4 pt-1"
    >
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Initiative Name *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Unified Store Experience 2026" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Description</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What is this initiative trying to achieve?" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Target Quarter</Label>
          <Select value={targetQuarter} onValueChange={v => v && setQuarter(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUARTERS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Status</Label>
          <Select value={status} onValueChange={v => v && setStatus(v as InitiativeStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Link Projects dialog ─────────────────────────────────────────────────
// Allows the user to pick any projects not already linked to this initiative
// and bulk-assign them by updating each project's initiativeId. Projects
// already linked to OTHER initiatives are shown with a warning so the user
// knows they will be re-assigned.

function LinkProjectsDialog({
  initiative,
  open,
  onClose,
}: {
  initiative: Initiative
  open: boolean
  onClose: () => void
}) {
  // Pull all projects and the updateProject action from the store
  const { projects, initiatives, updateProject } = usePortfolioStore()

  // Local state: text filter and the set of project ids the user has checked
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<Set<string>>(new Set())

  // Only show projects NOT already linked to this initiative. Projects linked
  // to other initiatives are included but flagged so the user sees the impact.
  const linkable = projects.filter(p => p.initiativeId !== initiative.id)

  // Apply case-insensitive name filter
  const filtered = linkable.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  // Toggle a single project's checked state
  function toggleProject(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Commit: set initiativeId on every selected project, then close
  function handleLink() {
    selected.forEach(id => updateProject(id, { initiativeId: initiative.id }))
    // Reset local state so the dialog is clean if re-opened
    setSelected(new Set())
    setSearch('')
    onClose()
  }

  // Cancel: discard selection and close without saving
  function handleCancel() {
    setSelected(new Set())
    setSearch('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && handleCancel()}>
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link size={16} className="text-blue-500" />
            Link Projects to "{initiative.name}"
          </DialogTitle>
        </DialogHeader>

        {/* Search box to filter project list */}
        <div className="mt-3">
          <Input
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Scrollable project list */}
        <div className="mt-3 max-h-80 overflow-y-auto space-y-1 pr-1">
          {filtered.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">
              {linkable.length === 0
                ? 'All projects are already linked to this initiative.'
                : 'No projects match your search.'}
            </p>
          )}

          {filtered.map(p => {
            // Detect if this project belongs to a different initiative so we
            // can show a warning — re-assigning will move it away from there.
            const otherInitiative = p.initiativeId
              ? initiatives.find(i => i.id === p.initiativeId)
              : null

            const isChecked = selected.has(p.id)

            return (
              <label
                key={p.id}
                className={cn(
                  'flex items-start gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors',
                  isChecked ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                )}
              >
                {/* Native checkbox — simple and accessible */}
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleProject(p.id)}
                  className="mt-0.5 accent-blue-600 shrink-0"
                />

                {/* Project info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {p.name}
                    </span>

                    {/* Warn that this project is already assigned elsewhere */}
                    {otherInitiative && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 font-medium shrink-0">
                        Linked to: {otherInitiative.name}
                      </span>
                    )}
                  </div>

                  {/* Status, phase, and priority badges for at-a-glance context */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <ColorBadge className={STATUS_COLORS[p.status]}>{p.status}</ColorBadge>
                    <ColorBadge className={PHASE_COLORS[p.phase]}>{p.phase}</ColorBadge>
                    <ColorBadge className={PRIORITY_COLORS[p.priority]}>{p.priority}</ColorBadge>
                  </div>
                </div>
              </label>
            )
          })}
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          {/* Disable confirm when nothing is selected */}
          <Button onClick={handleLink} disabled={selected.size === 0}>
            Link {selected.size > 0 ? `${selected.size} ` : ''}Project{selected.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Initiative card ──────────────────────────────────────────────────────

function InitiativeCard({
  initiative,
  onEdit,
  onDelete,
}: {
  initiative: Initiative
  onEdit: () => void
  onDelete: () => void
}) {
  const { projects, members } = usePortfolioStore()
  const [expanded, setExpanded]             = useState(false)
  // Controls visibility of the Link Projects dialog for this card
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)

  const iniProjects = projects.filter(p => p.initiativeId === initiative.id)
  const complete    = iniProjects.filter(p => p.status === 'Complete').length
  const inProgress  = iniProjects.filter(p => p.status === 'In Progress').length
  const blocked     = iniProjects.filter(p => p.status === 'Blocked').length
  const pct         = iniProjects.length ? Math.round((complete / iniProjects.length) * 100) : 0

  function memberNames(memberIds: string[]) {
    return memberIds
      .map(id => members.find(m => m.id === id)?.name ?? '?')
      .join(', ')
  }

  return (
    <>
    <Card className={cn('border-l-4 overflow-hidden', STATUS_BORDER[initiative.status])}>
      <CardContent className="p-0">
        {/* Header row */}
        <div className="flex items-start gap-4 px-5 py-4 group">
          {/* Icon */}
          <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg shrink-0 mt-0.5', STATUS_ICON_BG[initiative.status])}>
            <Target size={16} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900">{initiative.name}</h3>
              <ColorBadge className={INITIATIVE_STATUS_COLORS[initiative.status]}>
                {initiative.status}
              </ColorBadge>
              <span className="text-xs text-slate-400">{initiative.targetQuarter}</span>
            </div>
            {initiative.description && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{initiative.description}</p>
            )}

            {/* Progress */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-slate-500">
                  <span>{complete}/{iniProjects.length} complete</span>
                  {inProgress > 0 && <span className="text-blue-600">{inProgress} in progress</span>}
                  {blocked > 0    && <span className="text-red-500">{blocked} blocked</span>}
                </div>
                <span className="font-semibold text-slate-700">{pct}%</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          </div>

          {/* Actions — visible on hover. Link comes first so it's close to the content. */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => setLinkDialogOpen(true)}
              title="Link projects to this initiative"
              className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <Link size={14} />
            </button>
            <button onClick={onEdit} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/40 text-slate-400 hover:text-red-500 dark:hover:text-red-400">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Toggle project list */}
        {iniProjects.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full flex items-center gap-2 px-5 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {expanded ? 'Hide' : 'Show'} {iniProjects.length} project{iniProjects.length !== 1 ? 's' : ''}
            </button>

            {expanded && (
              <div className="border-t border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                      <TableHead className="text-xs">Project</TableHead>
                      <TableHead className="text-xs">Assigned To</TableHead>
                      <TableHead className="text-xs">Phase</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Priority</TableHead>
                      <TableHead className="text-xs">Progress</TableHead>
                      <TableHead className="text-xs">Target Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {iniProjects.map(p => {
                      const endDate = p.targetEndDate
                        ? new Date(p.targetEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                        : '—'
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium text-slate-800 max-w-[180px]">
                            <span className="truncate block" title={p.name}>{p.name}</span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 max-w-[140px]">
                            <span className="truncate block">{memberNames(p.assignments.map(a => a.memberId))}</span>
                          </TableCell>
                          <TableCell>
                            <ColorBadge className={PHASE_COLORS[p.phase]}>{p.phase}</ColorBadge>
                          </TableCell>
                          <TableCell>
                            <ColorBadge className={STATUS_COLORS[p.status]}>{p.status}</ColorBadge>
                          </TableCell>
                          <TableCell>
                            <ColorBadge className={PRIORITY_COLORS[p.priority]}>{p.priority}</ColorBadge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.percentComplete}%` }} />
                              </div>
                              <span className="text-xs text-slate-500">{p.percentComplete}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">{endDate}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        {iniProjects.length === 0 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400 text-center">
            No projects linked to this initiative yet
          </div>
        )}
      </CardContent>
    </Card>

    {/* Link Projects dialog — rendered at card level so it has access to this
        initiative's id without lifting state up to the page */}
    <LinkProjectsDialog
      initiative={initiative}
      open={linkDialogOpen}
      onClose={() => setLinkDialogOpen(false)}
    />
  </>
  )
}

// ─── Initiatives page ─────────────────────────────────────────────────────

type ModalState =
  | { mode: 'add' }
  | { mode: 'edit'; initiative: Initiative }
  | null

export function InitiativesPage() {
  const { initiatives, projects, addInitiative, updateInitiative, deleteInitiative } =
    usePortfolioStore()

  const [modal, setModal]           = useState<ModalState>(null)
  const [deleting, setDeleting]     = useState<Initiative | null>(null)
  const [filterStatus, setFilter]   = useState<InitiativeStatus | 'All'>('All')

  const visible = filterStatus === 'All'
    ? initiatives
    : initiatives.filter(i => i.status === filterStatus)

  function handleSubmit(data: Omit<Initiative, 'id'>) {
    if (!modal) return
    if (modal.mode === 'add') addInitiative(data)
    else updateInitiative(modal.initiative.id, data)
    setModal(null)
  }

  function handleDelete() {
    if (deleting) { deleteInitiative(deleting.id); setDeleting(null) }
  }

  // Summary stats
  const totalProjects = projects.length
  const linked = projects.filter(p => p.initiativeId).length
  const unlinked = totalProjects - linked

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Initiatives</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {initiatives.length} strategic initiative{initiatives.length !== 1 ? 's' : ''} ·{' '}
            {linked} of {totalProjects} projects linked
            {unlinked > 0 && <span className="text-amber-600 dark:text-amber-400"> · {unlinked} unlinked</span>}
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'add' })}>
          <Plus size={15} className="mr-1.5" /> Add Initiative
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['All', ...STATUSES] as const).map(s => (
          <FilterChip
            key={s}
            label={s}
            active={filterStatus === s}
            onClick={() => setFilter(s)}
            count={s === 'All' ? initiatives.length : initiatives.filter(i => i.status === s).length}
          />
        ))}
      </div>

      {/* Initiative cards — or empty state when nothing exists yet */}
      <div className="space-y-4">
        {initiatives.length === 0 ? (
          /* Full empty state: shown when no initiatives have been created at all */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Target size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">
              No initiatives yet
            </h3>
            <p className="text-sm text-slate-400 mb-6 max-w-xs">
              Add your first strategic initiative to track portfolio-level goals.
            </p>
            <Button onClick={() => setModal({ mode: 'add' })}>
              <Plus size={15} className="mr-1.5" /> Add Initiative
            </Button>
          </div>
        ) : visible.length === 0 ? (
          /* Filter empty state: initiatives exist but none match the active filter */
          <div className="text-center py-16 text-slate-400">
            <Target size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="font-medium text-slate-700 dark:text-slate-300">No initiatives found</p>
            <p className="text-sm mt-1">Try changing the filter or add a new initiative</p>
          </div>
        ) : (
          visible.map(ini => (
            <InitiativeCard
              key={ini.id}
              initiative={ini}
              onEdit={() => setModal({ mode: 'edit', initiative: ini })}
              onDelete={() => setDeleting(ini)}
            />
          ))
        )}
      </div>

      {/* Add / Edit modal */}
      <Dialog open={modal !== null} onOpenChange={open => !open && setModal(null)}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target size={16} className="text-blue-500" />
              {modal?.mode === 'add' ? 'Add Initiative' : 'Edit Initiative'}
            </DialogTitle>
          </DialogHeader>
          <InitiativeForm
            initial={modal?.mode === 'edit' ? modal.initiative : undefined}
            onSubmit={handleSubmit}
            onCancel={() => setModal(null)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete initiative?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-slate-800">"{deleting?.name}"</span> will be deleted.
              Projects linked to it will remain but will no longer be associated with this initiative.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
