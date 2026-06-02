/**
 * Intake page — submit, review, approve/reject, and convert intake requests.
 *
 * Form questions match the Product Intake Request Form spec:
 *   Q1  Describe your request
 *   Q2  New vs existing capability
 *   Q3  Funding status
 *   Q4  Business value / benefits
 *   Q5  Measurement plan (KPIs, metrics, dashboards)
 *   Q6  Priority level
 *   Q7  Business owner who set the priority
 *   Q8  Network bandwidth impact
 *   Q9  Target completion date
 *
 * Admin users can approve / reject / defer / convert requests to projects.
 */
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ClipboardList, Plus, ChevronDown, CheckCircle, XCircle,
  Clock, FolderKanban, Pencil, Trash2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FilterChip } from '@/components/ui/filter-chip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ColorBadge } from '@/components/ui/color-badge'
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
import { ProjectFormDialog } from '@/components/projects/ProjectFormDialog'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { INTAKE_STATUS_COLORS, PRIORITY_COLORS } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { IntakeRequest, IntakeStatus, Priority } from '@/types'

// ─── Status config ─────────────────────────────────────────────────────────

const STATUS_ICON: Record<IntakeStatus, React.ElementType> = {
  'Pending Review': Clock,
  'Approved':       CheckCircle,
  'Rejected':       XCircle,
  'Deferred':       ChevronDown,
}

// ─── Reusable form primitives ──────────────────────────────────────────────

/**
 * Numbered question block matching the intake form design.
 * Shows a bold number + question label, then renders children as the answer area.
 */
function Question({
  number, label, required, children,
}: {
  number: number
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-slate-500 shrink-0">{number}.</span>
        <Label className="text-sm font-medium text-slate-800 leading-snug">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
      </div>
      <div className="ml-5">{children}</div>
    </div>
  )
}

/**
 * Styled radio button row. Uses native <input type="radio"> for simplicity
 * and accessibility; styled with Tailwind to match the form's visual language.
 */
function RadioGroup({
  name, options, value, onChange,
}: {
  name: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-2.5 cursor-pointer group">
          <div className="relative">
            <input
              type="radio"
              name={name}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="sr-only"
            />
            <div className={cn(
              'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
              value === opt
                ? 'border-blue-600 bg-white'
                : 'border-slate-300 bg-white group-hover:border-slate-400',
            )}>
              {value === opt && <div className="w-2 h-2 rounded-full bg-blue-600" />}
            </div>
          </div>
          <span className="text-sm text-slate-700">{opt}</span>
        </label>
      ))}
    </div>
  )
}

// ─── Intake form ──────────────────────────────────────────────────────────

function IntakeForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<IntakeRequest>
  onSubmit: (data: Omit<IntakeRequest, 'id' | 'submittedAt'>) => void
  onCancel: () => void
}) {
  const [requesterName, setRequester]     = useState(initial?.requesterName ?? '')
  const [teamOrDomain, setTeamOrDomain]   = useState(initial?.teamOrDomain ?? '')
  const [description, setDescription]     = useState(initial?.description ?? '')
  const [capabilityType, setCapability]   = useState(initial?.capabilityType ?? '')
  const [hasFunding, setFunding]          = useState(initial?.hasFunding ?? '')
  const [businessJustification, setBiz]   = useState(initial?.businessJustification ?? '')
  const [measurementPlan, setMeasurement] = useState(initial?.measurementPlan ?? '')
  const [priority, setPriority]           = useState<Priority>(initial?.priority ?? 'Medium')
  const [businessOwner, setOwner]         = useState(initial?.businessOwner ?? '')
  const [networkImpact, setNetwork]       = useState(initial?.networkImpact ?? '')
  const [requestedByDate, setByDate]      = useState(initial?.requestedByDate ?? '')
  const [status, setStatus]               = useState<IntakeStatus>(initial?.status ?? 'Pending Review')

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSubmit({
          requesterName, teamOrDomain, description,
          capabilityType: capabilityType as 'New' | 'Existing' | undefined,
          hasFunding: hasFunding as 'Yes' | 'No' | 'Other' | undefined,
          businessJustification, measurementPlan, estimatedEffort: 'M',
          priority, businessOwner, networkImpact, requestedByDate, status,
        })
      }}
      className="space-y-6 pt-1"
    >
      {/* Submitter info — name + team */}
      <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Your Name <span className="text-red-500">*</span></Label>
          <Input value={requesterName} onChange={e => setRequester(e.target.value)} required placeholder="Full name" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Team / Domain</Label>
          <Input value={teamOrDomain} onChange={e => setTeamOrDomain(e.target.value)} placeholder="e.g. Store Experience" />
        </div>
      </div>

      {/* Q1 */}
      <Question number={1} label="Please describe your request?" required>
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
          rows={3}
          placeholder="Enter your answer"
          className="text-sm"
        />
      </Question>

      {/* Q2 */}
      <Question number={2} label="Is the request for a new or an existing capability?" required>
        <RadioGroup
          name="capabilityType"
          options={['New', 'Existing capability']}
          value={capabilityType}
          onChange={v => setCapability(v === 'Existing capability' ? 'Existing' : 'New')}
        />
      </Question>

      {/* Q3 */}
      <Question number={3} label="Do you have funding for this request?" required>
        <RadioGroup
          name="hasFunding"
          options={['Yes', 'No', 'Other']}
          value={hasFunding}
          onChange={setFunding}
        />
      </Question>

      {/* Q4 */}
      <Question number={4} label="What is the business value associated with this request? (Please include benefits measurements)" required>
        <Textarea
          value={businessJustification}
          onChange={e => setBiz(e.target.value)}
          required
          rows={3}
          placeholder="Enter your answer"
          className="text-sm"
        />
      </Question>

      {/* Q5 */}
      <Question number={5} label="What is the Measurement Plan for this request? (KPIs, Metrics, PowerBI Dashboards etc.)">
        <Textarea
          value={measurementPlan}
          onChange={e => setMeasurement(e.target.value)}
          rows={2}
          placeholder="Enter your answer"
          className="text-sm"
        />
      </Question>

      {/* Q6 */}
      <Question number={6} label="Has this request been prioritized?" required>
        <RadioGroup
          name="priority"
          options={['High', 'Medium', 'Low']}
          value={priority}
          onChange={v => setPriority(v as Priority)}
        />
      </Question>

      {/* Q7 */}
      <Question number={7} label="Who is the business owner that set the priority?" required>
        <Input
          value={businessOwner}
          onChange={e => setOwner(e.target.value)}
          placeholder="Enter your answer"
          className="text-sm"
        />
      </Question>

      {/* Q8 */}
      <Question number={8} label="Does this feature have an impact on a store's network bandwidth? If so, what is the impact?">
        <Textarea
          value={networkImpact}
          onChange={e => setNetwork(e.target.value)}
          rows={2}
          placeholder="Enter your answer"
          className="text-sm"
        />
      </Question>

      {/* Q9 */}
      <Question number={9} label="Is there a target date for completion?">
        <Input
          type="date"
          value={requestedByDate}
          onChange={e => setByDate(e.target.value)}
          className="text-sm w-48"
        />
      </Question>

      {/* Admin-only: status field when editing an existing request */}
      {initial?.id && (
        <div className="pt-4 border-t border-slate-100 space-y-1.5">
          <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Admin</Label>
          <div className="flex items-center gap-3">
            {(['Pending Review','Approved','Rejected','Deferred'] as IntakeStatus[]).map(s => (
              <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                <span className="text-xs text-slate-600">{s}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">
          {initial?.id ? 'Save Changes' : 'Submit Request'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ─── Read-only view ────────────────────────────────────────────────────────

/**
 * Read-only rendering of all Q&A answers for a submission.
 * Used inside the view dialog so reviewers can read the full submission
 * without accidentally editing it.
 */
function IntakeView({ request: r }: { request: IntakeRequest }) {
  function fmtDate(iso: string) {
    if (!iso) return '—'
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
  }

  /** One read-only Q&A row. */
  function QA({ number, label, answer }: { number: number; label: string; answer?: string }) {
    return (
      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-slate-400 shrink-0">{number}.</span>
          <span className="text-sm font-medium text-slate-600 leading-snug">{label}</span>
        </div>
        <p className="ml-5 text-sm text-slate-900 whitespace-pre-wrap">
          {answer?.trim() || <span className="text-slate-300 italic">No answer provided</span>}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Submitter info */}
      <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Requester</p>
          <p className="text-sm font-medium text-slate-900">{r.requesterName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Team / Domain</p>
          <p className="text-sm text-slate-900">{r.teamOrDomain || '—'}</p>
        </div>
      </div>

      <QA number={1} label="Please describe your request?" answer={r.description} />
      <QA number={2} label="Is the request for a new or an existing capability?" answer={r.capabilityType} />
      <QA number={3} label="Do you have funding for this request?" answer={r.hasFunding} />
      <QA number={4} label="What is the business value associated with this request?" answer={r.businessJustification} />
      <QA number={5} label="What is the Measurement Plan for this request?" answer={r.measurementPlan} />
      <QA number={6} label="Has this request been prioritized?" answer={r.priority} />
      <QA number={7} label="Who is the business owner that set the priority?" answer={r.businessOwner} />
      <QA number={8} label="Does this feature have an impact on a store's network bandwidth?" answer={r.networkImpact} />
      <QA number={9} label="Is there a target date for completion?" answer={r.requestedByDate ? fmtDate(r.requestedByDate) : undefined} />
    </div>
  )
}

// ─── Convert-to-project ────────────────────────────────────────────────────

function useConvertToProject() {
  const { convertIntakeToProject } = usePortfolioStore()
  const [convertingIntake, setConverting] = useState<IntakeRequest | null>(null)

  function startConvert(request: IntakeRequest)  { setConverting(request) }
  function cancelConvert()                        { setConverting(null) }

  function confirmConvert(draft: Parameters<typeof convertIntakeToProject>[1]) {
    if (!convertingIntake) return
    convertIntakeToProject(convertingIntake.id, draft)
    setConverting(null)
  }

  return { convertingIntake, startConvert, cancelConvert, confirmConvert }
}

// ─── Page ──────────────────────────────────────────────────────────────────

type ModalState =
  | { mode: 'add' }
  | { mode: 'view'; request: IntakeRequest }
  | { mode: 'edit'; request: IntakeRequest }
  | null

const STATUS_FILTERS: Array<IntakeStatus | 'All'> = [
  'All', 'Pending Review', 'Approved', 'Rejected', 'Deferred',
]

export function PipelinePage() {
  const { intakeRequests, addIntakeRequest, updateIntakeRequest, deleteIntakeRequest } =
    usePortfolioStore()

  const [modal, setModal]       = useState<ModalState>(null)
  const [deleting, setDeleting] = useState<IntakeRequest | null>(null)
  const [filterStatus, setFilter] = useState<IntakeStatus | 'All'>('All')
  const { convertingIntake, startConvert, cancelConvert, confirmConvert } = useConvertToProject()

  // If the dashboard links here with ?view=<id>, auto-open the view modal.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const viewId = searchParams.get('view')
    if (viewId) {
      const req = intakeRequests.find(r => r.id === viewId)
      if (req) setModal({ mode: 'view', request: req })
      setSearchParams({}, { replace: true }) // clean up the URL
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sorted  = [...intakeRequests].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  const visible = filterStatus === 'All' ? sorted : sorted.filter(r => r.status === filterStatus)

  function handleSubmit(data: Omit<IntakeRequest, 'id' | 'submittedAt'>) {
    if (!modal) return
    if (modal.mode === 'add') addIntakeRequest(data)
    else updateIntakeRequest(modal.request.id, data)
    setModal(null)
  }

  const pending  = intakeRequests.filter(r => r.status === 'Pending Review').length
  const approved = intakeRequests.filter(r => r.status === 'Approved').length

  function relativeDate(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const days = Math.floor(diff / 86_400_000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 30)  return `${days}d ago`
    return `${Math.floor(days / 30)}mo ago`
  }

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pipeline</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {intakeRequests.length} total · <span className="text-amber-600 dark:text-amber-400 font-medium">{pending} pending review</span>
            {approved > 0 && <> · <span className="text-green-600 dark:text-green-400 font-medium">{approved} approved</span></>}
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'add' })}>
          <Plus size={15} className="mr-1.5" /> Submit Request
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_FILTERS.slice(1).map(s => {
          const count = intakeRequests.filter(r => r.status === s).length
          const Icon = STATUS_ICON[s as IntakeStatus]
          return (
            <Card
              key={s}
              className={cn(
                'cursor-pointer transition-all',
                filterStatus === s ? 'ring-2 ring-blue-500' : 'hover:border-blue-300',
              )}
              onClick={() => setFilter(filterStatus === s ? 'All' : s as IntakeStatus)}
            >
              <CardContent className="flex items-center gap-3 pt-4 pb-3">
                <Icon size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{count}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">{s}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <FilterChip
            key={s}
            label={s}
            active={filterStatus === s}
            onClick={() => setFilter(s)}
            count={s === 'All' ? intakeRequests.length : intakeRequests.filter(r => r.status === s).length}
          />
        ))}
      </div>

      {/* Requests table */}
      <Card>
        <CardHeader className="pb-0 pt-4">
          <CardTitle className="text-base dark:text-slate-100">
            {filterStatus === 'All' ? 'All Requests' : filterStatus}
            <span className="ml-2 text-sm font-normal text-slate-400 dark:text-slate-500">({visible.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          {visible.length === 0 ? (
            /* Empty state — shown when no requests exist or none match the active filter */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList size={40} className="text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                No intake requests
              </h3>
              <p className="text-xs text-slate-400">
                {filterStatus === 'All'
                  ? 'Submitted requests will appear here.'
                  : `No requests with status "${filterStatus}".`}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Funding</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(req => {
                  const targetDate = req.requestedByDate
                    ? new Date(req.requestedByDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                    : '—'

                  return (
                    // Entire row opens the view dialog; only the trash button overrides this.
                    <TableRow
                      key={req.id}
                      className="align-middle cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      onClick={() => setModal({ mode: 'view', request: req })}
                    >
                      <TableCell className="max-w-[220px]">
                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm line-clamp-2">{req.description}</p>
                        {req.businessJustification && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{req.businessJustification}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{req.requesterName}</TableCell>
                      <TableCell>
                        {req.capabilityType ? (
                          <ColorBadge className={req.capabilityType === 'New' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}>
                            {req.capabilityType}
                          </ColorBadge>
                        ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </TableCell>
                      <TableCell>
                        {req.hasFunding ? (
                          <ColorBadge className={
                            req.hasFunding === 'Yes' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                            req.hasFunding === 'No'  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                          }>
                            {req.hasFunding}
                          </ColorBadge>
                        ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </TableCell>
                      <TableCell>
                        <ColorBadge className={PRIORITY_COLORS[req.priority]}>{req.priority}</ColorBadge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 dark:text-slate-400">{req.businessOwner || '—'}</TableCell>
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{targetDate}</TableCell>
                      <TableCell className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{relativeDate(req.submittedAt)}</TableCell>
                      <TableCell>
                        <ColorBadge className={INTAKE_STATUS_COLORS[req.status]}>{req.status}</ColorBadge>
                      </TableCell>
                      {/* Only the delete button lives in the row; all other actions are in the view dialog */}
                      <TableCell onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setDeleting(req)}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/40 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          title="Delete"
                        ><Trash2 size={13} /></button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View modal — read-only with action buttons */}
      {modal?.mode === 'view' && (
        <Dialog open onOpenChange={open => !open && setModal(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList size={16} className="text-amber-500" />
                  Intake Submission
                </DialogTitle>
                {/* Status badge + submitted date */}
                <div className="flex items-center gap-2">
                  <ColorBadge className={INTAKE_STATUS_COLORS[modal.request.status]}>
                    {modal.request.status}
                  </ColorBadge>
                  <span className="text-xs text-slate-400">
                    {new Date(modal.request.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </DialogHeader>

            <IntakeView request={modal.request} />

            {/* Footer: workflow actions + Edit button */}
            <DialogFooter className="flex-wrap gap-2 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                {modal.request.status === 'Pending Review' && (
                  <>
                    <button
                      onClick={() => { updateIntakeRequest(modal.request.id, { status: 'Approved' }); setModal(null) }}
                      className="px-3 py-1.5 rounded text-sm bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-400 dark:hover:bg-green-900/60 font-medium"
                    >Approve</button>
                    <button
                      onClick={() => { updateIntakeRequest(modal.request.id, { status: 'Rejected' }); setModal(null) }}
                      className="px-3 py-1.5 rounded text-sm bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60 font-medium"
                    >Reject</button>
                    <button
                      onClick={() => { updateIntakeRequest(modal.request.id, { status: 'Deferred' }); setModal(null) }}
                      className="px-3 py-1.5 rounded text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-900/60 font-medium"
                    >Defer</button>
                  </>
                )}
                {modal.request.status === 'Approved' && (
                  <button
                    onClick={() => { startConvert(modal.request); setModal(null) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 font-medium"
                  >
                    <FolderKanban size={13} /> Convert to Project
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setModal({ mode: 'edit', request: modal.request })}>
                  <Pencil size={13} className="mr-1.5" /> Edit
                </Button>
                <Button variant="outline" onClick={() => setModal(null)}>Close</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add / Edit modal */}
      {(modal?.mode === 'add' || modal?.mode === 'edit') && (
        <Dialog open onOpenChange={open => !open && setModal(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList size={16} className="text-amber-500" />
                {modal.mode === 'add' ? 'Submit New Request' : 'Edit Request'}
              </DialogTitle>
            </DialogHeader>
            <IntakeForm
              initial={modal.mode === 'edit' ? modal.request : undefined}
              onSubmit={handleSubmit}
              onCancel={() => setModal(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Convert to project */}
      {convertingIntake && (
        <ProjectFormDialog
          open={!!convertingIntake}
          onOpenChange={open => !open && cancelConvert()}
          initial={undefined}
          onSave={confirmConvert}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete intake request?</AlertDialogTitle>
            <AlertDialogDescription>
              This request from <span className="font-medium text-slate-800">{deleting?.requesterName}</span> will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleting) { deleteIntakeRequest(deleting.id); setDeleting(null) } }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
