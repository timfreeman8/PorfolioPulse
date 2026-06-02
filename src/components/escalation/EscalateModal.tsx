import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EscalateModal({ open, onOpenChange }: Props) {
  const { members, projects, domains, addEscalation } = usePortfolioStore()

  const [memberId, setMemberId]   = useState('')
  const [projectId, setProjectId] = useState('')
  const [blockedOn, setBlockedOn] = useState('')
  const [needsTo, setNeedsTo]     = useState('')
  const [submitted, setSubmitted] = useState(false)

  const domainLeads = domains.map(d => d.owner).filter(Boolean)

  const memberProjects = memberId
    ? projects.filter(p => p.assignments.some(a => a.memberId === memberId))
    : projects

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const member  = members.find(m => m.id === memberId)
    const project = projects.find(p => p.id === projectId)
    addEscalation({
      memberName: member?.name ?? '',
      memberId:   memberId  || undefined,
      projectName: project?.name ?? '',
      projectId:   projectId || undefined,
      blockedOn,
      needsTo,
    })
    setSubmitted(true)
  }

  function handleClose() {
    setMemberId('')
    setProjectId('')
    setBlockedOn('')
    setNeedsTo('')
    setSubmitted(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={18} />
            Escalate a Blocker
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 size={40} className="text-green-500" />
            <p className="font-semibold text-slate-800">Escalation submitted</p>
            <p className="text-sm text-slate-500">The following domain leads have been notified:</p>
            <p className="text-sm font-medium text-slate-700">
              {domainLeads.length > 0 ? domainLeads.join(', ') : 'All domain leads'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Your escalation has been added to the Escalations page.</p>
            <Button className="mt-2" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Who is blocked? *</Label>
              <Select value={memberId} onValueChange={v => { setMemberId(v ?? ''); setProjectId('') }}>
                <SelectTrigger><SelectValue placeholder="Select a team member…" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name} — {m.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Blocked on which project? *</Label>
              <Select value={projectId} onValueChange={v => setProjectId(v ?? '')} disabled={!memberId}>
                <SelectTrigger>
                  <SelectValue placeholder={memberId ? 'Select a project…' : 'Select a member first'} />
                </SelectTrigger>
                <SelectContent>
                  {memberProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">What are you blocked on? *</Label>
              <Textarea
                value={blockedOn}
                onChange={e => setBlockedOn(e.target.value)}
                rows={3}
                placeholder="Describe the blocker in detail…"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">What do you need to get unblocked?</Label>
              <Textarea
                value={needsTo}
                onChange={e => setNeedsTo(e.target.value)}
                rows={2}
                placeholder="e.g. Decision from Finance, access to staging environment…"
              />
            </div>

            {domainLeads.length > 0 && (
              <p className="text-xs text-slate-400">
                Will notify: <span className="font-medium text-slate-600">{domainLeads.join(', ')}</span>
              </p>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={!memberId || !projectId || !blockedOn.trim()}
              >
                Submit Escalation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
