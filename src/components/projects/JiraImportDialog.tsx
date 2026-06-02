/**
 * JiraImportDialog — import Jira Epics as SAT projects.
 *
 * Current mode: Paste JSON (user copies a Jira /search API response and pastes it).
 * Future mode:  Live API connection (tabs are already in place; just unlock the tab
 *               and wire fetchJiraEpics() from adapter.ts when the backend proxy is ready).
 *
 * Flow:
 *   1. User opens the dialog and selects "Paste JSON" (only active tab for now).
 *   2. User pastes JSON from a Jira /search query filtered to Epics.
 *   3. Parser validates the JSON and maps each Epic to a project preview.
 *   4. User reviews the list, deselects anything they don't want, then imports.
 *   5. addProject() is called for each selected epic; dialog closes.
 */
import { useState } from 'react'
import { ClipboardPaste, Wifi, Check, AlertTriangle, ExternalLink, ChevronRight } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ColorBadge } from '@/components/ui/color-badge'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { parseJiraJson, mapEpicToProject } from '@/lib/jira/adapter'
import { STATUS_COLORS, PHASE_COLORS, PRIORITY_COLORS } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { JiraEpic } from '@/lib/jira/types'

// ─── Source tab ────────────────────────────────────────────────────────────
// Tabs represent the two data sources: paste (now) and live API (later).
// Adding a live connection means unlocking the API tab and filling in its panel.

type SourceTab = 'paste' | 'api'

// ─── Step ──────────────────────────────────────────────────────────────────
// The dialog moves through two steps: configure source → review & import.

type Step = 'source' | 'review'

// ─── Preview row ───────────────────────────────────────────────────────────

/**
 * A single row in the preview table. Shows the mapped project fields so the
 * user can confirm they look right before committing to the import.
 */
function PreviewRow({
  epic,
  selected,
  onToggle,
}: {
  epic: JiraEpic
  selected: boolean
  onToggle: () => void
}) {
  const draft = mapEpicToProject(epic)

  return (
    <tr
      className={cn(
        'border-b border-slate-100 cursor-pointer transition-colors',
        selected ? 'bg-white' : 'bg-slate-50 opacity-50',
      )}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <td className="px-3 py-2.5 w-8">
        <div className={cn(
          'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
          selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300',
        )}>
          {selected && <Check size={10} className="text-white" />}
        </div>
      </td>
      {/* Jira key */}
      <td className="px-3 py-2.5 w-24">
        <span className="text-xs font-mono text-slate-500">{epic.key}</span>
      </td>
      {/* Name */}
      <td className="px-3 py-2.5 max-w-[220px]">
        <p className="text-sm font-medium text-slate-800 truncate" title={draft.name}>{draft.name}</p>
      </td>
      {/* Status */}
      <td className="px-3 py-2.5">
        <ColorBadge className={STATUS_COLORS[draft.status]}>{draft.status}</ColorBadge>
      </td>
      {/* Phase */}
      <td className="px-3 py-2.5">
        <ColorBadge className={PHASE_COLORS[draft.phase]}>{draft.phase}</ColorBadge>
      </td>
      {/* Priority */}
      <td className="px-3 py-2.5">
        <ColorBadge className={PRIORITY_COLORS[draft.priority]}>{draft.priority}</ColorBadge>
      </td>
      {/* Target date */}
      <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">
        {draft.targetEndDate || '—'}
      </td>
    </tr>
  )
}

// ─── Main dialog ───────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function JiraImportDialog({ open, onOpenChange }: Props) {
  const { addProject } = usePortfolioStore()

  const [tab, setTab]       = useState<SourceTab>('paste')
  const [step, setStep]     = useState<Step>('source')
  const [json, setJson]     = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [epics, setEpics]   = useState<JiraEpic[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  /** Reset all state when the dialog closes. */
  function handleClose() {
    setTab('paste')
    setStep('source')
    setJson('')
    setParseError(null)
    setEpics([])
    setSelected(new Set())
    onOpenChange(false)
  }

  /** Parse the pasted JSON and advance to the review step. */
  function handleParse() {
    const result = parseJiraJson(json)
    if (result.error) {
      setParseError(result.error)
      return
    }
    setParseError(null)
    setEpics(result.epics)
    // Pre-select all epics.
    setSelected(new Set(result.epics.map(e => e.id)))
    setStep('review')
  }

  /** Toggle a single epic in/out of the selected set. */
  function toggleEpic(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  /** Toggle all epics at once. */
  function toggleAll() {
    if (selected.size === epics.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(epics.map(e => e.id)))
    }
  }

  /** Import selected epics as projects and close. */
  function handleImport() {
    epics
      .filter(e => selected.has(e.id))
      .forEach(e => addProject(mapEpicToProject(e)))
    handleClose()
  }

  const selectedCount = selected.size
  const allSelected   = selectedCount === epics.length

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {/* Jira icon (simplified "J" mark) */}
            <span className="flex items-center justify-center w-5 h-5 rounded bg-blue-600 text-white text-[10px] font-black leading-none shrink-0">J</span>
            Import from Jira
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* ── Source tabs ─────────────────────────────────────────── */}
          {/* The API tab is locked until a backend proxy is wired up. */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              onClick={() => setTab('paste')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                tab === 'paste'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <ClipboardPaste size={14} />
              Paste JSON
            </button>
            {/* API tab — locked, shown so the future slot is obvious */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 cursor-not-allowed select-none"
              title="Live API connection coming soon"
            >
              <Wifi size={14} />
              Live API
              <span className="text-[10px] font-semibold bg-slate-200 text-slate-400 px-1.5 py-0.5 rounded-full leading-none ml-0.5">Soon</span>
            </div>
          </div>

          {/* ── Step: source configuration ──────────────────────────── */}
          {step === 'source' && tab === 'paste' && (
            <div className="space-y-4">
              {/* Instructions */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">How to get your Jira JSON</p>
                <ol className="space-y-1.5 text-sm text-slate-600 list-decimal list-inside">
                  <li>Open your Jira project and go to <strong>Issues → Advanced search</strong></li>
                  <li>Run this JQL query, replacing <code className="bg-slate-200 px-1 rounded text-xs">PROJ</code> with your project key:
                    <div className="mt-1.5 flex items-center gap-2 bg-white border border-slate-200 rounded px-3 py-2 font-mono text-xs text-slate-700">
                      <span className="flex-1">project = PROJ AND issuetype = Epic ORDER BY created DESC</span>
                    </div>
                  </li>
                  <li>Call the REST API:
                    <div className="mt-1.5 flex items-center gap-2 bg-white border border-slate-200 rounded px-3 py-2 font-mono text-xs text-slate-700 break-all">
                      <span>GET https://YOUR-DOMAIN.atlassian.net/rest/api/3/search?jql=project%3DPROJ%20AND%20issuetype%3DEpic</span>
                    </div>
                  </li>
                  <li>Copy the full JSON response and paste it below</li>
                </ol>
                <a
                  href="https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/#api-rest-api-3-search-post"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                >
                  Jira REST API docs <ExternalLink size={10} />
                </a>
              </div>

              {/* Paste area */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Paste JSON here</label>
                <Textarea
                  value={json}
                  onChange={e => { setJson(e.target.value); setParseError(null) }}
                  rows={10}
                  placeholder={'{\n  "issues": [\n    { "id": "10001", "key": "PROJ-1", "fields": { ... } }\n  ]\n}'}
                  className="font-mono text-xs"
                />
              </div>

              {parseError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg">
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{parseError}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Step: review ────────────────────────────────────────── */}
          {step === 'review' && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{epics.length}</span> epic{epics.length !== 1 ? 's' : ''} found ·{' '}
                  <span className="font-semibold text-blue-600">{selectedCount}</span> selected for import
                </p>
                <button
                  onClick={() => setStep('source')}
                  className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                >
                  ← Back
                </button>
              </div>

              {/* Preview table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {/* Select-all checkbox */}
                      <th className="px-3 py-2 w-8">
                        <div
                          onClick={toggleAll}
                          className={cn(
                            'w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors',
                            allSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 hover:border-blue-400',
                          )}
                        >
                          {allSelected && <Check size={10} className="text-white" />}
                        </div>
                      </th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-500">Key</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-500">Name</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-500">Status</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-500">Phase</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-500">Priority</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-500">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {epics.map(epic => (
                      <PreviewRow
                        key={epic.id}
                        epic={epic}
                        selected={selected.has(epic.id)}
                        onToggle={() => toggleEpic(epic.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Info note about what gets imported */}
              <p className="text-xs text-slate-400">
                Assignees and initiative links are not imported — assign members after import via the project editor.
                Each imported project includes the Jira key in its notes field.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {step === 'source' ? (
            <Button
              onClick={handleParse}
              disabled={!json.trim()}
            >
              <ChevronRight size={14} className="mr-1" />
              Preview Epics
            </Button>
          ) : (
            <Button
              onClick={handleImport}
              disabled={selectedCount === 0}
            >
              Import {selectedCount > 0 ? `${selectedCount} ` : ''}Project{selectedCount !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
