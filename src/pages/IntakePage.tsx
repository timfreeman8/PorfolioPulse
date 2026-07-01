/**
 * Intake / Pipeline page — submit, review, triage, and convert intake requests.
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
 *   Q10 Estimated effort (S / M / L / XL)
 *
 * Features:
 * - Inline triage (Approve / Reject / Defer) directly in table rows
 * - Triage dialog captures optional reviewer notes before confirming
 * - Sortable columns — click any header to sort asc/desc
 * - Priority score: Priority rank × (4/Effort rank) — shown in table + card view
 * - Toggle between table and card view
 * - Initiative tagging for approved requests
 * - Estimated value + value type for financial scoring
 */
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  ClipboardList, Plus, ChevronDown, CheckCircle, XCircle,
  FolderKanban, Pencil, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, List, MessageSquare,
  Download, Search, AlertTriangle, History, Kanban,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { FilterChip } from '@/components/ui/filter-chip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ColorBadge } from '@/components/ui/color-badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ProjectFormDialog } from '@/components/projects/ProjectFormDialog'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useViewStore } from '@/store/useViewStore'
import { INTAKE_STATUS_COLORS, PRIORITY_COLORS, avatarColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { relativeDate, formatLocalDate } from '@/lib/dates'
import type { IntakeRequest, IntakeStatus, Priority, EffortSize, IntakeComment, IntakeStatusChange } from '@/types'

// ─── Staleness ─────────────────────────────────────────────────────────────

/** Requests idle in an active state longer than this are flagged as stale. */
const STALE_MS = 14 * 86_400_000

/**
 * True if a non-terminal request has had no status activity for 14+ days.
 * Uses the most recent status-change timestamp when available, otherwise
 * falls back to the original submission date.
 */
function isStale(req: IntakeRequest): boolean {
  if (req.status === 'Approved' || req.status === 'Rejected' || req.status === 'Deferred') return false
  const lastActivity = req.statusHistory?.at(-1)?.changedAt ?? req.submittedAt
  return (Date.now() - new Date(lastActivity).getTime()) > STALE_MS
}

// ─── CSV export ────────────────────────────────────────────────────────────

/**
 * Generates and immediately downloads a CSV file from the supplied request list.
 * Each cell is double-quote-escaped so commas in text fields don't break parsing.
 */
function exportCSV(requests: IntakeRequest[]) {
  const headers = ['Description', 'Requester', 'Team', 'Priority', 'Effort', 'Score', 'Status', 'Est. Value ($K)', 'Submitted', 'Review Deadline']
  const rows = requests.map(r => [
    r.description,
    r.requesterName,
    r.teamOrDomain,
    r.priority,
    r.estimatedEffort,
    scoreRequest(r),
    r.status,
    r.estimatedValue ?? '',
    new Date(r.submittedAt).toLocaleDateString('en-US'),
    r.reviewDeadline ?? '',
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Status config ─────────────────────────────────────────────────────────


// ─── Priority score ─────────────────────────────────────────────────────────
// Score = Priority rank × Effort inverse rank. Higher score = do first.
// Priority: Low=1, Med=2, Hi=3, Critical=4
// Effort:   XL=1, L=2, M=3, S=4  (smaller effort → higher inverse rank)
// Range: 1 (Low+XL) to 16 (Critical+S). Optional value boost from estimatedValue.
// Defined at module level so scoreRequest() and the sort comparator share the same maps.

const PRIORITY_RANK: Record<string, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 }
const EFFORT_RANK:   Record<string, number> = { XL: 1, L: 2, M: 3, S: 4 }

function scoreRequest(req: IntakeRequest): number {
  const P = PRIORITY_RANK[req.priority] ?? 2
  const E = EFFORT_RANK[req.estimatedEffort] ?? 2
  const V = req.estimatedValue ? 1 + Math.log10(req.estimatedValue + 1) / 3 : 1
  return Math.round(P * E * V)
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 10 ? 'bg-green-100 text-green-700' : score >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
  return <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold tabular-nums', color)}>{score}</span>
}

// ─── Sortable table header ──────────────────────────────────────────────────

function SortHead({
  col, label, sortCol, sortDir, onSort, className,
}: {
  col: string; label: string
  sortCol: string; sortDir: 'asc' | 'desc'
  onSort: (col: string) => void
  className?: string
}) {
  const active = sortCol === col
  return (
    <TableHead
      className={cn('cursor-pointer select-none hover:bg-slate-50', className)}
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active
          ? sortDir === 'asc' ? <ArrowUp size={11} className="text-blue-500" /> : <ArrowDown size={11} className="text-blue-500" />
          : <ArrowUpDown size={11} className="text-slate-300" />
        }
      </div>
    </TableHead>
  )
}

// ─── Triage dialog ──────────────────────────────────────────────────────────
// Shown when the user clicks Approve / Reject / Defer — lets them enter
// optional reviewer notes before confirming the status change.

function TriageDialog({
  action, request, onConfirm, onCancel,
}: {
  action: 'Approved' | 'Rejected' | 'Deferred'
  request: IntakeRequest
  onConfirm: (notes?: string) => void
  onCancel: () => void
}) {
  const [notes, setNotes] = useState('')
  const colors: Record<string, string> = {
    Approved: 'text-green-700',
    Rejected: 'text-red-700',
    Deferred: 'text-amber-700',
  }
  const btnColors: Record<string, string> = {
    Approved: 'bg-green-600 hover:bg-green-700 text-white',
    Rejected: 'bg-red-600 hover:bg-red-700 text-white',
    Deferred: 'bg-amber-600 hover:bg-amber-700 text-white',
  }
  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="sticky top-0 z-10 bg-popover border-b px-6 pt-5 pb-4">
          <DialogTitle className={cn('flex items-center gap-2', colors[action])}>
            {action === 'Approved' ? <CheckCircle size={15} /> : action === 'Rejected' ? <XCircle size={15} /> : <ChevronDown size={15} />}
            {action} Request
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            <span className="font-medium text-slate-800 line-clamp-2">"{request.description}"</span>
            {' '}will be marked as{' '}
            <span className={cn('font-semibold', colors[action])}>{action}</span>.
            {action === 'Deferred' && ' You can reopen this request later via the Edit button.'}
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Reviewer Notes <span className="text-slate-400">(optional)</span></Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Add reasoning or context for this decision…"
              autoFocus
            />
          </div>
        </div>
        <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 px-4 py-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button className={btnColors[action]} onClick={() => onConfirm(notes.trim() || undefined)}>
            Confirm {action}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
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
  const { initiatives } = usePortfolioStore()
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
  const [estimatedEffort, setEffort]      = useState<EffortSize>(initial?.estimatedEffort ?? 'M')
  const [estimatedValue, setValue]        = useState<string>(initial?.estimatedValue != null ? String(initial.estimatedValue) : '')
  const [valueType, setValueType]         = useState<'Revenue Impact' | 'Cost Savings' | ''>(initial?.valueType ?? '')
  const [initiativeId, setInitiativeId]   = useState(initial?.initiativeId ?? '')
  const [reviewerNotes, setReviewerNotes] = useState(initial?.reviewerNotes ?? '')
  const [reviewDeadline, setReviewDeadline] = useState(initial?.reviewDeadline ?? '')
  const [status, setStatus]               = useState<IntakeStatus>(initial?.status ?? 'Pending Review')

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSubmit({
          requesterName, teamOrDomain, description,
          capabilityType: capabilityType as 'New' | 'Existing' | undefined,
          hasFunding: hasFunding as 'Yes' | 'No' | 'Other' | undefined,
          businessJustification, measurementPlan, estimatedEffort,
          priority, businessOwner, networkImpact, requestedByDate, status,
          estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
          valueType: valueType || undefined,
          initiativeId: initiativeId || undefined,
          reviewerNotes: reviewerNotes.trim() || undefined,
          reviewDeadline: reviewDeadline || undefined,
        })
      }}
      // flex-col + flex-1 lets the form fill the space below the sticky DialogHeader
      // so the scrollable body and sticky footer can be laid out correctly.
      className="flex flex-col flex-1 min-h-0"
    >
      {/* Scrollable question body — min-h-0 is required so the flex-1 child can shrink and scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-8">

      {/* Submitter info — name + team */}
      <div className="grid grid-cols-2 gap-3 pb-6 border-b border-slate-100">
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

      {/* Q10 — Estimated effort */}
      <Question number={10} label="What is the estimated effort for this request?" required>
        <div className="flex items-center gap-2">
          {(['S', 'M', 'L', 'XL'] as EffortSize[]).map(size => (
            <button
              key={size}
              type="button"
              onClick={() => setEffort(size)}
              className={cn(
                'w-10 h-9 rounded-md text-sm font-semibold border transition-colors',
                estimatedEffort === size
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600',
              )}
            >
              {size}
            </button>
          ))}
          <span className="text-xs text-slate-400 ml-1">S = small (&lt;1 wk) · M = medium · L = large · XL = extra-large (&gt;1 mo)</span>
        </div>
      </Question>

      {/* Estimated value + value type — used for priority scoring */}
      <div className="grid grid-cols-2 gap-4 pb-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Estimated Value ($K) <span className="text-slate-400">(optional)</span></Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={estimatedValue}
            onChange={e => setValue(e.target.value)}
            placeholder="e.g. 500"
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Value Type</Label>
          <div className="flex items-center gap-2 pt-1.5">
            {(['Revenue Impact', 'Cost Savings'] as const).map(vt => (
              <button
                key={vt}
                type="button"
                onClick={() => setValueType(prev => prev === vt ? '' : vt)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  valueType === vt
                    ? vt === 'Revenue Impact'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                )}
              >
                {vt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Admin-only section — shown only when editing an existing request.
          Initiative tagging lets reviewers link this request to a strategic theme.
          Deferred is a terminal state — once set it cannot be changed via the form. */}
      {initial?.id && (
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Admin</Label>

          {/* Initiative tagging — links the approved request to a strategic initiative */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Link to Initiative</Label>
            <Select value={initiativeId || 'none'} onValueChange={v => setInitiativeId(v == null || v === 'none' ? '' : v)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {initiatives.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status radios — all statuses are editable including Approved and Deferred */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Status</Label>
            <div className="flex flex-wrap items-center gap-3">
              {(['Pending Review', 'Under Review', 'Approved', 'Rejected', 'Deferred'] as IntakeStatus[]).map(s => (
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

          {/* Review deadline — date by which a triage decision should be made */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Review Deadline</Label>
            <Input
              type="date"
              value={reviewDeadline}
              onChange={e => setReviewDeadline(e.target.value)}
              className="text-sm w-48"
            />
          </div>

          {/* Reviewer notes — editable when existing notes are present; reviewers can also add via triage dialog */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Reviewer Notes</Label>
            <Textarea
              value={reviewerNotes}
              onChange={e => setReviewerNotes(e.target.value)}
              rows={2}
              placeholder="Notes from the triage decision…"
              className="text-sm"
            />
          </div>
        </div>
      )}

      </div>{/* end scrollable body */}

      {/* Sticky footer — stays at the bottom of the modal regardless of scroll position */}
      <div className="shrink-0 flex items-center justify-end gap-2 px-8 py-4 border-t bg-muted/50">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">
          {initial?.id ? 'Save Changes' : 'Submit Request'}
        </Button>
      </div>
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
  const { initiatives } = usePortfolioStore()

  const initiativeName = r.initiativeId
    ? initiatives.find(i => i.id === r.initiativeId)?.name
    : undefined

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

  const score = scoreRequest(r)

  return (
    <div className="space-y-5">
      {/* Submitter info + score summary */}
      <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Requester</p>
          <p className="text-sm font-medium text-slate-900">{r.requesterName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Team / Domain</p>
          <p className="text-sm text-slate-900">{r.teamOrDomain || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Effort</p>
          <p className="text-sm text-slate-900">{r.estimatedEffort || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Priority Score</p>
          <ScoreBadge score={score} />
        </div>
        {(r.estimatedValue != null) && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Est. Value</p>
            <p className="text-sm text-slate-900">${r.estimatedValue.toLocaleString()}K {r.valueType && <span className="text-slate-400">({r.valueType})</span>}</p>
          </div>
        )}
        {initiativeName && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Initiative</p>
            <p className="text-sm text-slate-900">{initiativeName}</p>
          </div>
        )}
      </div>

      <QA number={1} label="Please describe your request?" answer={r.description} />
      <QA number={2} label="Is the request for a new or an existing capability?" answer={r.capabilityType} />
      <QA number={3} label="Do you have funding for this request?" answer={r.hasFunding} />
      <QA number={4} label="What is the business value associated with this request?" answer={r.businessJustification} />
      <QA number={5} label="What is the Measurement Plan for this request?" answer={r.measurementPlan} />
      <QA number={6} label="Has this request been prioritized?" answer={r.priority} />
      <QA number={7} label="Who is the business owner that set the priority?" answer={r.businessOwner} />
      <QA number={8} label="Does this feature have an impact on a store's network bandwidth?" answer={r.networkImpact} />
      <QA number={9} label="Is there a target date for completion?" answer={r.requestedByDate ? formatLocalDate(r.requestedByDate) : undefined} />
      <QA number={10} label="Estimated effort?" answer={r.estimatedEffort} />

      {/* Review deadline — shown with overdue warning when past due */}
      {r.reviewDeadline && (() => {
        const deadlineDate = new Date(r.reviewDeadline + 'T00:00:00')
        const isOverdue    = deadlineDate < new Date()
        return (
          <div className="pt-3 border-t border-slate-100 space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Review Deadline</p>
            <p className={cn('text-sm font-medium', isOverdue ? 'text-red-600 flex items-center gap-1' : 'text-slate-700')}>
              {isOverdue && <AlertTriangle size={13} />}
              {deadlineDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {isOverdue && ' — Overdue'}
            </p>
          </div>
        )
      })()}

      {/* Reviewer notes — shown if a triage decision included notes */}
      {r.reviewerNotes && (
        <div className="pt-3 border-t border-slate-100 space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Reviewer Notes</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.reviewerNotes}</p>
        </div>
      )}

      {/* Status audit trail — automatic log of every status transition */}
      {(r.statusHistory?.length ?? 0) > 0 && (
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <History size={11} /> Status History
          </p>
          <div className="space-y-1.5">
            {/* Show initial submission as first entry */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-32 shrink-0 tabular-nums text-slate-400">{relativeDate(r.submittedAt)}</span>
              <span className="text-slate-400">Submitted</span>
              <ColorBadge className={INTAKE_STATUS_COLORS['Pending Review']}>Pending Review</ColorBadge>
            </div>
            {r.statusHistory!.map((entry: IntakeStatusChange, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-32 shrink-0 tabular-nums text-slate-400">{relativeDate(entry.changedAt)}</span>
                <span className="text-slate-400">→</span>
                <ColorBadge className={INTAKE_STATUS_COLORS[entry.status]}>{entry.status}</ColorBadge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Discussion thread ─────────────────────────────────────────────────────
//
// Lets multiple reviewers add named notes to an intake request before a final
// triage decision is made. Comments are appended to request.comments[] and
// persist in the Zustand store (localStorage). Author name is remembered in
// localStorage so it pre-fills on the next visit.

function Discussion({ request }: { request: IntakeRequest }) {
  const { updateIntakeRequest } = usePortfolioStore()

  // Pre-fill author name from the last session so reviewers don't re-type it
  const [authorName, setAuthorName] = useState(() =>
    localStorage.getItem('sat-comment-author') ?? ''
  )
  const [text, setText] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedAuthor = authorName.trim()
    const trimmedText   = text.trim()
    if (!trimmedAuthor || !trimmedText) return

    const comment: IntakeComment = {
      id: crypto.randomUUID(),
      authorName: trimmedAuthor,
      text: trimmedText,
      createdAt: new Date().toISOString(),
    }

    // Persist the author name so it's ready for the next comment
    localStorage.setItem('sat-comment-author', trimmedAuthor)

    // Append to existing comments array (or start a new one)
    updateIntakeRequest(request.id, {
      comments: [...(request.comments ?? []), comment],
    })
    setText('')
  }

  const comments = request.comments ?? []

  return (
    <div className="pt-5 mt-5 border-t border-slate-100 space-y-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
        <MessageSquare size={12} />
        Discussion
        {comments.length > 0 && (
          <span className="normal-case font-normal">({comments.length})</span>
        )}
      </p>

      {/* Existing comments — shown in submission order */}
      {comments.length > 0 ? (
        <div className="space-y-4">
          {comments.map(c => {
            const { bg, text: textCol } = avatarColor(c.authorName)
            return (
              <div key={c.id} className="flex gap-3">
                {/* Avatar — color is derived from the author's name so it's stable */}
                <div className={cn(
                  'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold',
                  bg, textCol,
                )}>
                  {c.authorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-slate-700">{c.authorName}</span>
                    <span className="text-xs text-slate-400">{relativeDate(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{c.text}</p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">
          No notes yet — add context to help reviewers make a decision.
        </p>
      )}

      {/* Add-note form — stays open so multiple notes can be added without closing the modal */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-1">
        <Input
          value={authorName}
          onChange={e => setAuthorName(e.target.value)}
          placeholder="Your name"
          className="text-sm"
          required
        />
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a note or observation before the triage decision…"
          rows={2}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={!authorName.trim() || !text.trim()}
          >
            <MessageSquare size={13} className="mr-1.5" />
            Add Note
          </Button>
        </div>
      </form>
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

// ─── Epic name inline ──────────────────────────────────────────────────────
// Small sub-component used in table rows to show the name + phase of the
// project this intake was converted to, without prop-drilling projects down.

function EpicNameInline({ projectId }: { projectId: string }) {
  const { projects } = usePortfolioStore()
  const proj = projects.find(p => p.id === projectId)
  if (!proj) return null
  return (
    <p className="text-[10px] text-violet-600 font-medium flex items-center gap-0.5 mt-0.5">
      <FolderKanban size={9} /> {proj.name} · {proj.phase}
    </p>
  )
}

// ─── Kanban view ───────────────────────────────────────────────────────────
//
// Displays all requests in status-based swimlane columns. Each card is
// clickable to open the view modal — the same as in table and grid view.
// Columns are fixed-width with independent vertical scroll so long lists
// don't push the other columns off-screen.

const KANBAN_COLS: IntakeStatus[] = ['Pending Review', 'Under Review', 'Approved', 'Rejected', 'Deferred']

function KanbanView({
  requests,
  onOpen,
}: {
  requests: IntakeRequest[]
  onOpen: (req: IntakeRequest) => void
}) {
  const { projects } = usePortfolioStore()

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 px-4 pt-3 min-h-[300px]">
      {KANBAN_COLS.map(col => {
        const colReqs = requests.filter(r => r.status === col)
        return (
          <div key={col} className="flex flex-col shrink-0 w-64">
            {/* Column header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <ColorBadge className={INTAKE_STATUS_COLORS[col]}>{col}</ColorBadge>
              <span className="text-xs text-slate-400 font-medium tabular-nums">{colReqs.length}</span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vh]">
              {colReqs.length === 0 && (
                <div className="border-2 border-dashed border-slate-100 rounded-lg h-16 flex items-center justify-center">
                  <span className="text-xs text-slate-300">Empty</span>
                </div>
              )}
              {colReqs.map(req => {
                const score    = scoreRequest(req)
                const stale    = isStale(req)
                const epicProj = req.convertedProjectId ? projects.find(p => p.id === req.convertedProjectId) : undefined
                const overdue  = req.reviewDeadline && new Date(req.reviewDeadline + 'T00:00:00') < new Date()
                return (
                  <div
                    key={req.id}
                    onClick={() => onOpen(req)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all space-y-2"
                  >
                    {/* Score + staleness / overdue flags */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <ScoreBadge score={score} />
                        {stale && <span title="Stale — no activity in 14+ days"><AlertTriangle size={11} className="text-amber-500" /></span>}
                        {overdue && <span title="Review deadline passed"><AlertTriangle size={11} className="text-red-500" /></span>}
                      </div>
                      <ColorBadge className={PRIORITY_COLORS[req.priority]}>{req.priority}</ColorBadge>
                    </div>

                    {/* Description */}
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-3 leading-snug">
                      {req.description}
                    </p>

                    {/* Epic link if converted */}
                    {epicProj && (
                      <p className="text-[10px] text-violet-600 font-medium flex items-center gap-0.5">
                        <FolderKanban size={9} /> {epicProj.name}
                      </p>
                    )}

                    {/* Footer: requester + effort + comment count */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="truncate">{req.requesterName}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-semibold bg-slate-100 text-slate-500 px-1 rounded">{req.estimatedEffort}</span>
                        {(req.comments?.length ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5">
                            <MessageSquare size={9} />{req.comments!.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

type ModalState =
  | { mode: 'add' }
  | { mode: 'view'; request: IntakeRequest }
  | { mode: 'edit'; request: IntakeRequest }
  | null

const STATUS_FILTERS: Array<IntakeStatus | 'All'> = [
  'All', 'Pending Review', 'Under Review', 'Approved', 'Rejected', 'Deferred',
]

type SortCol = 'description' | 'priority' | 'effort' | 'score' | 'status' | 'submittedAt'
type ViewMode = 'table' | 'cards' | 'kanban'
type TriageState = { request: IntakeRequest; action: 'Approved' | 'Rejected' | 'Deferred' } | null

export function PipelinePage() {
  const { intakeRequests, addIntakeRequest, updateIntakeRequest, deleteIntakeRequest } =
    usePortfolioStore()

  // Role gating: Admin (null) can triage/approve/edit; any selected member is read-only.
  const { activeMemberId } = useViewStore()
  const isAdmin = activeMemberId === null

  const navigate = useNavigate()

  const [modal, setModal]               = useState<ModalState>(null)
  const [deleting, setDeleting]         = useState<IntakeRequest | null>(null)
  const [filterStatus, setFilter]       = useState<IntakeStatus | 'All'>('All')
  const [search, setSearch]             = useState('')

  // Sort and view mode persist across navigation so the user's last preference is
  // restored when they return to this page. search and filterStatus are intentionally
  // ephemeral — resetting them avoids confusion about why items are hidden.
  const [sortCol, setSortCol]   = useState<SortCol>(() => {
    try { return (JSON.parse(localStorage.getItem('sat-pipeline-prefs') ?? '{}').sortCol as SortCol) || 'score' }
    catch { return 'score' }
  })
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>(() => {
    try { return (JSON.parse(localStorage.getItem('sat-pipeline-prefs') ?? '{}').sortDir as 'asc' | 'desc') || 'desc' }
    catch { return 'desc' }
  })
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { return (JSON.parse(localStorage.getItem('sat-pipeline-prefs') ?? '{}').viewMode as ViewMode) || 'table' }
    catch { return 'table' }
  })
  const [triageState, setTriageState]   = useState<TriageState>(null)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus]     = useState<IntakeStatus | ''>('')
  // Controls the inline status dropdown in the view modal header
  const [editingStatus, setEditingStatus] = useState(false)
  const { convertingIntake, startConvert, cancelConvert, confirmConvert } = useConvertToProject()

  // Persist sort and view mode whenever they change.
  useEffect(() => {
    localStorage.setItem('sat-pipeline-prefs', JSON.stringify({ sortCol, sortDir, viewMode }))
  }, [sortCol, sortDir, viewMode])

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

  // Sort by the active column using the module-level rank maps shared with scoreRequest().
  function sortValue(r: IntakeRequest): number | string {
    switch (sortCol) {
      case 'priority':    return PRIORITY_RANK[r.priority] ?? 0
      case 'effort':      return EFFORT_RANK[r.estimatedEffort] ?? 0
      case 'score':       return scoreRequest(r)
      case 'status':      return r.status
      case 'description': return r.description.toLowerCase()
      default:            return r.submittedAt
    }
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const byStatus = filterStatus === 'All'
    ? intakeRequests
    : intakeRequests.filter(r => r.status === filterStatus)

  // Text search across the most useful free-text fields
  const searchLower = search.toLowerCase()
  const bySearch = searchLower
    ? byStatus.filter(r =>
        r.description.toLowerCase().includes(searchLower) ||
        r.requesterName.toLowerCase().includes(searchLower) ||
        r.businessJustification.toLowerCase().includes(searchLower) ||
        r.teamOrDomain.toLowerCase().includes(searchLower)
      )
    : byStatus

  const visible = [...bySearch].sort((a, b) => {
    const av = sortValue(a), bv = sortValue(b)
    const cmp = typeof av === 'number' ? av - (bv as number) : (av as string).localeCompare(bv as string)
    return sortDir === 'desc' ? -cmp : cmp
  })

  function handleSubmit(data: Omit<IntakeRequest, 'id' | 'submittedAt'>) {
    if (!modal) return
    if (modal.mode === 'add') addIntakeRequest(data)
    else updateIntakeRequest(modal.request.id, data)
    setModal(null)
  }

  /** Triggered by triage dialog confirm — saves status + optional reviewer notes. */
  function handleTriage(notes?: string) {
    if (!triageState) return
    updateIntakeRequest(triageState.request.id, {
      status: triageState.action,
      reviewerNotes: notes,
    })
    setTriageState(null)
    // Close view modal if it's showing the same request
    setModal(null)
  }

  // Single-pass count map — used by both the header summary and the filter chips,
  // so we scan intakeRequests once instead of once per chip + twice for the header.
  const statusCounts = intakeRequests.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  const pending  = statusCounts['Pending Review'] ?? 0
  const approved = statusCounts['Approved'] ?? 0

  // Live lookup keeps the view modal up-to-date after store mutations (e.g. adding
  // a comment) without requiring the user to close and reopen the modal.
  const currentRequest = modal?.mode === 'view'
    ? (intakeRequests.find(r => r.id === modal.request.id) ?? modal.request)
    : null

  // Bulk action handler — applies the chosen status to all selected requests
  function applyBulkStatus() {
    if (!bulkStatus) return
    selectedIds.forEach(id => updateIntakeRequest(id, { status: bulkStatus as IntakeStatus }))
    setSelectedIds(new Set())
    setBulkStatus('')
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds(prev =>
      prev.size === visible.length ? new Set() : new Set(visible.map(r => r.id))
    )
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(visible)} title="Export visible rows to CSV">
            <Download size={13} className="mr-1.5" /> Export
          </Button>
          {isAdmin && (
            <Button onClick={() => setModal({ mode: 'add' })}>
              <Plus size={15} className="mr-1.5" /> Submit Request
            </Button>
          )}
        </div>
      </div>

      {/* Search + filter chips + view toggle all on one row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Search — fixed width so it doesn't crowd the chips */}
          <div className="relative shrink-0 w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8 text-sm h-9"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <FilterChip
              key={s}
              label={s}
              active={filterStatus === s}
              onClick={() => { setFilter(s); setSelectedIds(new Set()) }}
              count={s === 'All' ? intakeRequests.length : (statusCounts[s] ?? 0)}
            />
          ))}
          </div>
        </div>
        {/* View mode toggle — one button per mode, shared className logic */}
        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-md p-0.5 shrink-0">
          {([
            { mode: 'table',  icon: List,       label: 'List'  },
            { mode: 'cards',  icon: LayoutGrid,  label: 'Grid'  },
            { mode: 'kanban', icon: Kanban,      label: 'Board' },
          ] as { mode: ViewMode; icon: React.ElementType; label: string }[]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); if (mode === 'kanban') setSelectedIds(new Set()) }}
              className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors',
                viewMode === mode
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-700 dark:text-slate-200'
                  : 'text-slate-400 hover:text-slate-600')}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action toolbar — admin only; appears when rows are selected in table view */}
      {isAdmin && selectedIds.size > 0 && viewMode === 'table' && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedIds.size} selected
          </span>
          <span className="text-blue-300 dark:text-blue-700">|</span>
          <span className="text-xs text-blue-600 dark:text-blue-400">Move to:</span>
          {(['Pending Review', 'Under Review', 'Approved', 'Rejected', 'Deferred'] as IntakeStatus[]).map(s => (
            <button
              key={s}
              onClick={() => { setBulkStatus(s); }}
              className={cn(
                'px-2 py-1 rounded text-xs font-medium border transition-colors',
                bulkStatus === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400',
              )}
            >{s}</button>
          ))}
          <Button size="sm" onClick={applyBulkStatus} disabled={!bulkStatus} className="ml-auto">
            Apply
          </Button>
          <button onClick={() => { setSelectedIds(new Set()); setBulkStatus('') }} className="text-xs text-blue-500 hover:text-blue-700">
            Clear
          </button>
        </div>
      )}

      {/* Requests — table, card, or kanban view */}
      <Card>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList size={40} className="text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">No intake requests</h3>
              <p className="text-xs text-slate-400">
                {search ? `No results for "${search}".` : filterStatus === 'All' ? 'Submitted requests will appear here.' : `No requests with status "${filterStatus}".`}
              </p>
            </div>
          ) : viewMode === 'kanban' ? (
            /* Kanban receives search-filtered requests but ignores the status chip
               so every status column stays populated. KanbanView splits by status. */
            <KanbanView requests={bySearch} onOpen={req => setModal({ mode: 'view', request: req })} />
          ) : viewMode === 'cards' ? (
            /* ── Card view — sorted by score descending ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {visible.map(req => {
                const score   = scoreRequest(req)
                const stale   = isStale(req)
                const overdue = req.reviewDeadline && new Date(req.reviewDeadline + 'T00:00:00') < new Date()
                return (
                  <div
                    key={req.id}
                    className="border rounded-lg p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all bg-white dark:bg-slate-800 dark:border-slate-700 space-y-3"
                    onClick={() => setModal({ mode: 'view', request: req })}
                  >
                    {/* Header row: score + flags + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <ScoreBadge score={score} />
                        {stale  && <span title="Stale — 14+ days without activity"><AlertTriangle size={12} className="text-amber-400" /></span>}
                        {overdue && <span title="Review deadline overdue"><AlertTriangle size={12} className="text-red-500" /></span>}
                      </div>
                      <ColorBadge className={INTAKE_STATUS_COLORS[req.status]}>{req.status}</ColorBadge>
                    </div>
                    {/* Description */}
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-3 leading-snug">{req.description}</p>
                    {/* Meta chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ColorBadge className={PRIORITY_COLORS[req.priority]}>{req.priority}</ColorBadge>
                      <span className="text-xs font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{req.estimatedEffort}</span>
                      {req.hasFunding && (
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded font-medium',
                          req.hasFunding === 'Yes' ? 'bg-green-100 text-green-700' : req.hasFunding === 'No' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        )}>{req.hasFunding} funding</span>
                      )}
                    </div>
                    {/* Requester + value */}
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{req.requesterName}</span>
                      {req.estimatedValue != null && <span className="font-medium text-slate-600">${req.estimatedValue.toLocaleString()}K</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* ── Table view ── */
            /* table-fixed + explicit header widths enforce column sizes so cells
               can't steal space from each other. overflow-x-auto lets the table
               scroll horizontally on very narrow viewports. */
            <div className="overflow-x-auto">
            <Table className="table-fixed min-w-[860px]">
              <TableHeader>
                <TableRow>
                  {/* Select-all checkbox */}
                  <TableHead className="w-8 pr-0" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={visible.length > 0 && selectedIds.size === visible.length}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                    />
                  </TableHead>
                  <SortHead col="description" label="Request" sortCol={sortCol} sortDir={sortDir} onSort={c => toggleSort(c as SortCol)} className="w-[260px]" />
                  <TableHead className="w-28">Requester</TableHead>
                  <TableHead className="w-20">Type</TableHead>
                  <TableHead className="w-20">Funding</TableHead>
                  <SortHead col="priority" label="Priority" sortCol={sortCol} sortDir={sortDir} onSort={c => toggleSort(c as SortCol)} className="w-24" />
                  <SortHead col="effort" label="Effort" sortCol={sortCol} sortDir={sortDir} onSort={c => toggleSort(c as SortCol)} className="w-16" />
                  <SortHead col="score" label="Score" sortCol={sortCol} sortDir={sortDir} onSort={c => toggleSort(c as SortCol)} className="w-16" />
                  <SortHead col="status" label="Status" sortCol={sortCol} sortDir={sortDir} onSort={c => toggleSort(c as SortCol)} className="w-32" />
                  <SortHead col="submittedAt" label="Submitted" sortCol={sortCol} sortDir={sortDir} onSort={c => toggleSort(c as SortCol)} className="w-24" />
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(req => {
                  const score    = scoreRequest(req)
                  const stale    = isStale(req)
                  const overdue  = req.reviewDeadline && new Date(req.reviewDeadline + 'T00:00:00') < new Date()
                  return (
                    <TableRow
                      key={req.id}
                      className={cn(
                        'align-middle cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                        selectedIds.has(req.id) && 'bg-blue-50/50 dark:bg-blue-950/20',
                      )}
                      onClick={() => setModal({ mode: 'view', request: req })}
                    >
                      {/* Row checkbox */}
                      <TableCell className="pr-0" onClick={e => { e.stopPropagation(); toggleSelect(req.id) }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(req.id)}
                          onChange={() => toggleSelect(req.id)}
                          className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                        />
                      </TableCell>
                      {/* overflow-hidden is required on table cells with table-fixed so
                          long text clips to the column width rather than overflowing. */}
                      <TableCell className="overflow-hidden">
                        <div className="flex items-start gap-1.5">
                          {/* Staleness / overdue warning flags */}
                          {(stale || overdue) && (
                            <span title={overdue ? 'Review deadline overdue' : 'Stale — no activity in 14+ days'}>
                              <AlertTriangle
                                size={13}
                                className={cn('mt-0.5 shrink-0', overdue ? 'text-red-500' : 'text-amber-400')}
                              />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate" title={req.description}>{req.description}</p>
                            {req.convertedProjectId && (
                              <EpicNameInline projectId={req.convertedProjectId} />
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400 overflow-hidden">
                        <span className="truncate block" title={req.requesterName}>{req.requesterName}</span>
                      </TableCell>
                      <TableCell>
                        {req.capabilityType ? (
                          <ColorBadge className={req.capabilityType === 'New' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}>
                            {req.capabilityType}
                          </ColorBadge>
                        ) : <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell>
                        {req.hasFunding ? (
                          <ColorBadge className={
                            req.hasFunding === 'Yes' ? 'bg-green-100 text-green-700' :
                            req.hasFunding === 'No'  ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }>{req.hasFunding}</ColorBadge>
                        ) : <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell>
                        <ColorBadge className={PRIORITY_COLORS[req.priority]}>{req.priority}</ColorBadge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{req.estimatedEffort}</span>
                      </TableCell>
                      <TableCell>
                        <ScoreBadge score={score} />
                      </TableCell>
                      <TableCell>
                        <ColorBadge className={INTAKE_STATUS_COLORS[req.status]}>{req.status}</ColorBadge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 whitespace-nowrap">{relativeDate(req.submittedAt)}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {/* Comment count badge — visible only when notes exist */}
                          {(req.comments?.length ?? 0) > 0 && (
                            <button
                              onClick={() => setModal({ mode: 'view', request: req })}
                              className="flex items-center gap-0.5 px-1 py-0.5 rounded text-slate-400 hover:text-blue-500 transition-colors"
                              title={`${req.comments!.length} note${req.comments!.length !== 1 ? 's' : ''}`}
                            >
                              <MessageSquare size={11} />
                              <span className="text-[10px] font-medium tabular-nums">{req.comments!.length}</span>
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => setDeleting(req)}
                              className="p-1 rounded text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="Delete"
                            ><Trash2 size={13} /></button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View modal — read-only with action buttons.
          Uses [display:flex] to override the base DialogContent grid so the
          sticky header and footer layout works correctly within max-h. */}
      {modal?.mode === 'view' && currentRequest && (
        <Dialog open onOpenChange={open => { if (!open) { setModal(null); setEditingStatus(false) } }}>
          <DialogContent className="sm:max-w-3xl gap-0 p-0 overflow-hidden">

            {/* Sticky header — stays in place while the body scrolls */}
            <div className="shrink-0 px-8 pt-6 pb-5 border-b pr-14">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-amber-500" />
                    Intake Submission
                  </DialogTitle>

                  {/* Status area — Epic badge (with project link) or editable status badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {new Date(currentRequest.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>

                    {currentRequest.convertedProjectId ? (
                      /* Epic badge — replaces status; clicking navigates to the project page */
                      <button
                        onClick={() => { setModal(null); navigate(`/projects/${currentRequest.convertedProjectId}`) }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                      >
                        <FolderKanban size={11} /> Epic ↗
                      </button>
                    ) : (
                      /* Normal status badge + inline edit pencil (admin only) */
                      <div className="relative flex items-center gap-1">
                        <ColorBadge className={INTAKE_STATUS_COLORS[currentRequest.status]}>
                          {currentRequest.status}
                        </ColorBadge>
                        {isAdmin && (
                          <button
                            onClick={() => setEditingStatus(v => !v)}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            title="Change status"
                          >
                            <Pencil size={11} />
                          </button>
                        )}

                        {/* Inline status dropdown — admin only */}
                        {isAdmin && editingStatus && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setEditingStatus(false)} />
                            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 py-1 min-w-[160px]">
                              {(['Pending Review', 'Under Review', 'Approved', 'Rejected', 'Deferred'] as IntakeStatus[]).map(s => (
                                <button
                                  key={s}
                                  onClick={() => {
                                    updateIntakeRequest(currentRequest.id, { status: s })
                                    setEditingStatus(false)
                                  }}
                                  className={cn(
                                    'w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors',
                                    s === currentRequest.status && 'font-semibold text-blue-600',
                                  )}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </DialogHeader>
            </div>

            {/* Scrollable body — key=id forces scroll to top when switching between requests.
                Includes Q&A view + discussion thread; uses currentRequest so new comments
                appear immediately without closing and reopening the modal. */}
            <div key={currentRequest.id} className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
              <IntakeView request={currentRequest} />
              <Discussion request={currentRequest} />
            </div>

            {/* Sticky footer — staged triage workflow (admin only).
                Pending Review → Mark Under Review → Approve / Reject / Defer
                Under Review   → Approve / Reject / Defer
                Approved       → Convert to Epic
            */}
            <div className="shrink-0 flex flex-wrap items-center gap-2 px-8 py-4 border-t bg-muted/50">
              {isAdmin && (
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                  {/* "Mark Under Review" — moves from initial submission into active evaluation */}
                  {currentRequest.status === 'Pending Review' && (
                    <button
                      onClick={() => { updateIntakeRequest(currentRequest.id, { status: 'Under Review' }); setModal(null) }}
                      className="px-3 py-1.5 rounded text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium border border-blue-200"
                    >
                      Mark Under Review
                    </button>
                  )}
                  {/* Final triage decisions — available from both Pending Review and Under Review */}
                  {(currentRequest.status === 'Pending Review' || currentRequest.status === 'Under Review') && (
                    <>
                      <button
                        onClick={() => setTriageState({ request: currentRequest, action: 'Approved' })}
                        className="px-3 py-1.5 rounded text-sm bg-green-50 text-green-700 hover:bg-green-100 font-medium"
                      >Approve</button>
                      <button
                        onClick={() => setTriageState({ request: currentRequest, action: 'Rejected' })}
                        className="px-3 py-1.5 rounded text-sm bg-red-50 text-red-700 hover:bg-red-100 font-medium"
                      >Reject</button>
                      <button
                        onClick={() => setTriageState({ request: currentRequest, action: 'Deferred' })}
                        className="px-3 py-1.5 rounded text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium"
                      >Defer</button>
                    </>
                  )}
                  {currentRequest.status === 'Approved' && (
                    <button
                      onClick={() => { startConvert(currentRequest); setModal(null) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                    >
                      <FolderKanban size={13} /> Convert to Epic
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 ml-auto">
                {isAdmin && (
                  <Button variant="outline" onClick={() => setModal({ mode: 'edit', request: currentRequest })}>
                    <Pencil size={13} className="mr-1.5" /> Edit
                  </Button>
                )}
                <Button variant="outline" onClick={() => setModal(null)}>Close</Button>
              </div>
            </div>

          </DialogContent>
        </Dialog>
      )}

      {/* Add / Edit modal — IntakeForm fills flex-1 below the header and manages
          its own scrollable body + sticky footer internally. */}
      {(modal?.mode === 'add' || modal?.mode === 'edit') && (
        <Dialog open onOpenChange={open => !open && setModal(null)}>
          <DialogContent className="sm:max-w-3xl gap-0 p-0 overflow-hidden">

            {/* Sticky header */}
            <div className="shrink-0 px-8 pt-6 pb-5 border-b pr-14">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList size={16} className="text-amber-500" />
                  {modal.mode === 'add' ? 'Submit New Request' : 'Edit Request'}
                </DialogTitle>
              </DialogHeader>
            </div>

            {/* IntakeForm is flex-col flex-1 so it fills the remaining space */}
            <IntakeForm
              initial={modal.mode === 'edit' ? modal.request : undefined}
              onSubmit={handleSubmit}
              onCancel={() => setModal(null)}
            />

          </DialogContent>
        </Dialog>
      )}

      {/* Triage dialog — captures reviewer notes before confirming approve/reject/defer */}
      {triageState && (
        <TriageDialog
          action={triageState.action}
          request={triageState.request}
          onConfirm={handleTriage}
          onCancel={() => setTriageState(null)}
        />
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
