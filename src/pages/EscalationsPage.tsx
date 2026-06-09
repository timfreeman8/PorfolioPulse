/**
 * EscalationsPage — tracks active and resolved blockers raised by team members.
 *
 * Dark mode: non-slate color classes (red-*, green-*) are not covered by the
 * global dark overrides in index.css, so each colored surface has an explicit
 * dark: variant. Card border-red-200, avatar/status bg-red-100/bg-green-100,
 * resolved note bg-green-50, and status badge backgrounds all need manual flips.
 */
import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EscalateModal } from '@/components/escalation/EscalateModal'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { cn } from '@/lib/utils'
import type { Escalation } from '@/types'

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 60)  return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}

function EscalationCard({ escalation }: { escalation: Escalation }) {
  const { resolveEscalation, deleteEscalation, members } = usePortfolioStore()
  const [resolving, setResolving] = useState(false)
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const member = members.find(m => m.id === escalation.memberId)
  const isOpen = escalation.status === 'Open'

  return (
    <div className={cn(
      'bg-white rounded-xl border p-5 space-y-4',
      // border-red-200 and border-slate-100 need dark variants; bg-white covered globally
      isOpen ? 'border-red-200 shadow-sm dark:border-red-900/60' : 'border-slate-100 opacity-70',
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Avatar circle: bg-red-100/text-red-600 for open, slate for resolved — both need dark flips */}
          <div className={cn(
            'flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shrink-0',
            isOpen
              ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300'
              : 'bg-slate-100 text-slate-500',
          )}>
            {member?.avatarInitials ?? escalation.memberName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{escalation.memberName}</p>
            <p className="text-xs text-slate-400">{member?.role ?? ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Status badge: red for Open, green for Resolved — both need dark variants */}
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            isOpen
              ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300'
              : 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300',
          )}>
            {escalation.status}
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock size={11} /> {timeAgo(escalation.submittedAt)}
          </span>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Project tag */}
      {escalation.projectName && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Epic:</span>
          <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
            {escalation.projectName}
          </span>
        </div>
      )}

      {/* Blocker details */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Blocked on</p>
          <p className="text-sm text-slate-800">{escalation.blockedOn}</p>
        </div>
        {escalation.needsTo && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Needs to unblock</p>
            <p className="text-sm text-slate-800">{escalation.needsTo}</p>
          </div>
        )}
      </div>

      {/* Resolved note — bg-green-50/text-green-700/text-green-800 all need dark flips */}
      {!isOpen && escalation.resolvedNote && (
        <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">Resolution</p>
          <p className="text-sm text-green-800 dark:text-green-300">{escalation.resolvedNote}</p>
        </div>
      )}

      {/* Resolve action */}
      {isOpen && (
        <div className="border-t pt-4 space-y-2">
          {resolving ? (
            <>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="How was this blocker resolved?"
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => { resolveEscalation(escalation.id, note); setResolving(false) }}
                >
                  <CheckCircle2 size={13} className="mr-1" /> Mark Resolved
                </Button>
                <Button size="sm" variant="outline" onClick={() => setResolving(false)}>Cancel</Button>
              </div>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setResolving(true)}>
              <CheckCircle2 size={13} className="mr-1.5" /> Mark as Resolved
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete escalation?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this escalation report.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteEscalation(escalation.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function EscalationsPage() {
  const { escalations } = usePortfolioStore()
  const [escalateOpen, setEscalateOpen] = useState(false)

  const open     = escalations.filter(e => e.status === 'Open')
  const resolved = escalations.filter(e => e.status === 'Resolved')

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Escalations</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Active escalations requiring help — {open.length} open, {resolved.length} resolved
          </p>
        </div>
        <Button
          onClick={() => setEscalateOpen(true)}
          variant="destructive"
          className="shrink-0 flex items-center gap-2"
        >
          <AlertTriangle size={15} />
          I'm Blocked! Escalate
        </Button>
      </div>

      <EscalateModal open={escalateOpen} onOpenChange={setEscalateOpen} />

      {escalations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <CheckCircle2 size={40} className="text-green-400 mb-3" />
          <p className="font-medium text-base text-slate-600">No active blockers</p>
          <p className="text-sm mt-1">Use the "I'm Blocked" button to escalate an issue</p>
        </div>
      ) : (
        <div className="space-y-8">
          {open.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-500" />
                <h2 className="text-sm font-semibold text-red-600">Open ({open.length})</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {open.map(e => <EscalationCard key={e.id} escalation={e} />)}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-green-500" />
                <h2 className="text-sm font-semibold text-slate-500">Resolved ({resolved.length})</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {resolved.map(e => <EscalationCard key={e.id} escalation={e} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
