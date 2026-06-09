/**
 * JiraImportDialog — import Jira Epics as SAT projects.
 *
 * Supports two data sources:
 *   1. Paste JSON  — user copies a Jira /search API response and pastes it
 *   2. CSV File    — user exports "CSV - all fields" from Jira and uploads the file
 *
 * Both sources converge on the same review step: a preview table where the
 * user can deselect rows before committing the import.
 *
 * Future: Live API connection (tab is reserved; unlock when a backend proxy exists).
 *
 * Flow:
 *   source step → parse (JSON or CSV) → review step → addProject() per row → close
 */
import { useState, useRef } from 'react'
import { ClipboardPaste, Wifi, FileText, Check, AlertTriangle, ExternalLink, ChevronRight, Upload, Info, CheckCircle2, Users, SkipForward } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ColorBadge } from '@/components/ui/color-badge'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { parseJiraJson, mapEpicToProject } from '@/lib/jira/adapter'
import { parseJiraCsv } from '@/lib/jira/csv-adapter'
import { matchAssignees } from '@/lib/jira/match-assignee'
import { STATUS_COLORS, PHASE_COLORS, PRIORITY_COLORS } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'

// ─── Source tab ────────────────────────────────────────────────────────────

type SourceTab = 'paste' | 'csv' | 'api'

// ─── Step ──────────────────────────────────────────────────────────────────

type Step = 'source' | 'review' | 'report'

// ─── Unified import item ───────────────────────────────────────────────────

/**
 * A single row destined for the review table. Both JSON and CSV paths are
 * normalised into this shape before the review step renders, so the table
 * code is identical regardless of source.
 */
interface ImportDraft {
  /** Stable key used for the selected set (epic.id for JSON, jiraKey for CSV). */
  id: string
  /** The Jira issue key shown in the Key column (e.g. SATART-142956). */
  jiraKey: string
  /** The fully-mapped project fields, ready to pass to addProject(). */
  draft: Omit<Project, 'id' | 'updatedAt'>
  /** Raw Jira assignee name (CSV only; empty string for JSON imports). */
  assigneeName: string
  /** Matched SAT member name, if the roster lookup succeeded. */
  matchedMemberName?: string
}

// ─── Preview row ───────────────────────────────────────────────────────────

/**
 * A single row in the review table. Clicking anywhere on the row toggles its
 * selection state.
 */
function PreviewRow({
  item,
  selected,
  onToggle,
}: {
  item: ImportDraft
  selected: boolean
  onToggle: () => void
}) {
  const { draft } = item

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
      <td className="px-3 py-2.5 w-28">
        <span className="text-xs font-mono text-slate-500">{item.jiraKey || '—'}</span>
      </td>
      {/* Name */}
      <td className="px-3 py-2.5 max-w-[180px]">
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
      {/* Assignee match — only shown when the source provided an assignee */}
      <td className="px-3 py-2.5 max-w-[120px]">
        {item.assigneeName ? (
          item.matchedMemberName ? (
            <span className="flex items-center gap-1 text-xs text-green-700" title={`Matched from "${item.assigneeName}"`}>
              <Check size={11} className="text-green-500 shrink-0" />
              <span className="truncate">{item.matchedMemberName}</span>
            </span>
          ) : (
            <span className="text-xs text-amber-500 truncate" title={`"${item.assigneeName}" not found in roster`}>
              {item.assigneeName}
            </span>
          )
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
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
  const { addProject, members } = usePortfolioStore()

  // Navigation state
  const [tab, setTab]   = useState<SourceTab>('paste')
  const [step, setStep] = useState<Step>('source')

  // JSON tab state
  const [json, setJson]           = useState('')
  const [parseError, setParseError] = useState<string | null>(null)

  // CSV tab state
  const [csvFile, setCsvFile]       = useState<File | null>(null)
  const [epicsOnly, setEpicsOnly]   = useState(true)
  const [skipCount, setSkipCount]   = useState(0)
  const [assigneesFound, setAssigneesFound] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Report state (populated after a successful import)
  const [importedCount, setImportedCount] = useState(0)

  // Shared review state — normalised ImportDraft list from either source
  const [items, setItems]       = useState<ImportDraft[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  /** Reset all state when the dialog closes. */
  function handleClose() {
    setTab('paste')
    setStep('source')
    setJson('')
    setParseError(null)
    setCsvFile(null)
    setEpicsOnly(true)
    setSkipCount(0)
    setItems([])
    setSelected(new Set())
    onOpenChange(false)
  }

  // ── JSON path ─────────────────────────────────────────────────────────────

  /** Parse pasted JSON and advance to review. */
  function handleJsonParse() {
    const result = parseJiraJson(json)
    if (result.error) {
      setParseError(result.error)
      return
    }
    setParseError(null)

    // Normalise JiraEpic[] → ImportDraft[]
    const drafts: ImportDraft[] = result.epics.map(epic => ({
      id:           epic.id,
      jiraKey:      epic.key,
      assigneeName: epic.fields.assignee?.displayName ?? '',
      draft:        mapEpicToProject(epic),
    }))

    setItems(drafts)
    setSelected(new Set(drafts.map(d => d.id)))
    setStep('review')
  }

  // ── CSV path ──────────────────────────────────────────────────────────────

  /** Read the selected CSV file, parse it, and advance to review. */
  function handleCsvParse() {
    if (!csvFile) return
    setParseError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const result = parseJiraCsv(text, epicsOnly)

      if (result.error) {
        setParseError(result.error)
        return
      }

      // Match all unique assignee names against the roster in one pass
      const assigneeMatchMap = matchAssignees(result.assigneesFound, members)

      // Normalise CsvProjectDraft[] → ImportDraft[], injecting assignment data
      const drafts: ImportDraft[] = result.drafts.map((d, i) => {
        const matchResult = d.assigneeName ? assigneeMatchMap.get(d.assigneeName) : null
        const matchedMember = matchResult?.member ?? null

        return {
          id:                d.jiraKey || String(i),
          jiraKey:           d.jiraKey,
          assigneeName:      d.assigneeName,
          matchedMemberName: matchedMember?.name,
          draft: {
            ...d,
            // Wire up the matched member as an assignment (allocation 0 = TBD)
            assignments: matchedMember
              ? [{ memberId: matchedMember.id, allocation: 0 }]
              : [],
          },
        }
      })

      setSkipCount(result.skipped.length)
      setAssigneesFound(result.assigneesFound)
      setItems(drafts)
      setSelected(new Set(drafts.map(d => d.id)))
      setStep('review')
    }
    reader.onerror = () => setParseError('Could not read the file. Try again.')
    reader.readAsText(csvFile)
  }

  // ── Shared preview actions ────────────────────────────────────────────────

  function toggleItem(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map(d => d.id)))
    }
  }

  /** Import selected items as projects, then show the summary report. */
  function handleImport() {
    const toImport = items.filter(item => selected.has(item.id))
    toImport.forEach(item => addProject(item.draft))
    setImportedCount(toImport.length)
    setStep('report')
  }

  const selectedCount = selected.size
  const allSelected   = selectedCount === items.length && items.length > 0

  // ── Can the "Preview" button be clicked? ─────────────────────────────────
  const canPreview = tab === 'paste' ? json.trim().length > 0 : csvFile !== null

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded bg-blue-600 text-white text-[10px] font-black leading-none shrink-0">J</span>
            Import from Jira
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">

          {/* ── Source tabs ───────────────────────────────────────────── */}
          {/* Only shown on the source step; hidden once the user moves to review */}
          {step === 'source' && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              <button
                onClick={() => { setTab('paste'); setParseError(null) }}
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
              <button
                onClick={() => { setTab('csv'); setParseError(null) }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  tab === 'csv'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <FileText size={14} />
                CSV File
              </button>
              {/* API tab — locked until a backend proxy exists */}
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 cursor-not-allowed select-none"
                title="Live API connection coming soon"
              >
                <Wifi size={14} />
                Live API
                <span className="text-[10px] font-semibold bg-slate-200 text-slate-400 px-1.5 py-0.5 rounded-full leading-none ml-0.5">Soon</span>
              </div>
            </div>
          )}

          {/* ── Source step: Paste JSON ───────────────────────────────── */}
          {step === 'source' && tab === 'paste' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">How to get your Jira JSON</p>
                <ol className="space-y-1.5 text-sm text-slate-600 list-decimal list-inside">
                  <li>Open your Jira project and go to <strong>Issues → Advanced search</strong></li>
                  <li>Run this JQL:
                    <div className="mt-1.5 bg-white border border-slate-200 rounded px-3 py-2 font-mono text-xs text-slate-700">
                      project = PROJ AND issuetype = Epic ORDER BY created DESC
                    </div>
                  </li>
                  <li>Call the REST API:
                    <div className="mt-1.5 bg-white border border-slate-200 rounded px-3 py-2 font-mono text-xs text-slate-700 break-all">
                      GET https://YOUR-DOMAIN.atlassian.net/rest/api/3/search?jql=project%3DPROJ%20AND%20issuetype%3DEpic
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

              {parseError && <ParseErrorBanner message={parseError} />}
            </div>
          )}

          {/* ── Source step: CSV File ─────────────────────────────────── */}
          {step === 'source' && tab === 'csv' && (
            <div className="space-y-4">
              {/* Instructions */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">How to export from Jira</p>
                <ol className="space-y-1.5 text-sm text-slate-600 list-decimal list-inside">
                  <li>In Jira, run your Epic search (e.g. <span className="font-mono text-xs bg-slate-200 px-1 rounded">project = SATART AND issuetype = Epic</span>)</li>
                  <li>Click the <strong>···</strong> menu (top-right of the issue list)</li>
                  <li>Choose <strong>Export → CSV - all fields</strong></li>
                  <li>Upload the downloaded <span className="font-mono text-xs">.csv</span> file below</li>
                </ol>
                {/* Assignee note */}
                <div className="flex items-start gap-2 pt-1">
                  <Info size={13} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500">
                    Assignees from Jira are not imported — team members can be linked after import
                    via the epic editor. Each project keeps the Jira key in its Notes field.
                  </p>
                </div>
              </div>

              {/* File picker */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600">Upload CSV file</label>

                {/* Hidden native input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0] ?? null
                    setCsvFile(file)
                    setParseError(null)
                  }}
                />

                {/* Drop-zone style button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 text-sm transition-colors',
                    csvFile
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-600',
                  )}
                >
                  {csvFile ? (
                    <>
                      <FileText size={22} className="text-blue-500" />
                      <span className="font-medium">{csvFile.name}</span>
                      <span className="text-xs text-blue-500">Click to choose a different file</span>
                    </>
                  ) : (
                    <>
                      <Upload size={22} />
                      <span className="font-medium">Click to choose a CSV file</span>
                      <span className="text-xs">Jira "CSV - all fields" export</span>
                    </>
                  )}
                </button>
              </div>

              {/* Epics-only toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
                <div
                  onClick={() => setEpicsOnly(prev => !prev)}
                  className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                    epicsOnly ? 'bg-blue-600 border-blue-600' : 'border-slate-300 hover:border-blue-400',
                  )}
                >
                  {epicsOnly && <Check size={10} className="text-white" />}
                </div>
                <span className="text-sm text-slate-700">
                  Epics only
                  <span className="ml-1.5 text-xs text-slate-400">(uncheck to import all issue types)</span>
                </span>
              </label>

              {parseError && <ParseErrorBanner message={parseError} />}
            </div>
          )}

          {/* ── Review step ───────────────────────────────────────────── */}
          {step === 'review' && (
            <div className="space-y-3">
              {/* Summary row */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{items.length}</span> epic{items.length !== 1 ? 's' : ''} found
                  {skipCount > 0 && (
                    <span className="text-slate-400"> · {skipCount} skipped (wrong type)</span>
                  )}
                  {' · '}
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
                      <th className="px-3 py-2 text-xs font-medium text-slate-500">Assignee</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-500">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <PreviewRow
                        key={item.id}
                        item={item}
                        selected={selected.has(item.id)}
                        onToggle={() => toggleItem(item.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-400">
                Assignees and initiative links are not imported — assign members after import via the epic editor.
                Each project includes the Jira key in its notes field.
              </p>
            </div>
          )}

          {/* ── Report step ───────────────────────────────────────────── */}
          {step === 'report' && (
            <div className="space-y-4">
              {/* Success banner */}
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">
                    {importedCount} project{importedCount !== 1 ? 's' : ''} imported successfully
                  </p>
                  <p className="text-xs text-green-600 mt-0.5">
                    They are now visible on the Epics page. Use the epic editor to link team members and initiatives.
                  </p>
                </div>
              </div>

              {/* Skipped rows */}
              {skipCount > 0 && (
                <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <SkipForward size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {skipCount} row{skipCount !== 1 ? 's' : ''} skipped
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      These rows had a non-Epic issue type (Story, Task, Sub-task, etc.) and were filtered out.
                      Uncheck "Epics only" on the CSV tab to include them.
                    </p>
                  </div>
                </div>
              )}

              {/* Assignee match summary — only shown for CSV imports */}
              {assigneesFound.length > 0 && (() => {
                // Compute matched vs unmatched from the items that were imported
                const importedItems = items.filter(item => selected.has(item.id) || step === 'report')
                const unmatched = assigneesFound.filter(
                  name => !importedItems.some(item => item.assigneeName === name && item.matchedMemberName)
                )
                const matchedCount = assigneesFound.length - unmatched.length

                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-slate-400" />
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Assignees
                      </p>
                    </div>

                    {/* Matched summary */}
                    {matchedCount > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
                        <Check size={13} className="text-green-500 shrink-0" />
                        <p className="text-xs text-green-700">
                          <span className="font-semibold">{matchedCount}</span> assignee{matchedCount !== 1 ? 's' : ''} automatically linked to roster members
                        </p>
                      </div>
                    )}

                    {/* Unmatched — need manual linking */}
                    {unmatched.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                        <p className="text-xs font-medium text-amber-800">
                          {unmatched.length} name{unmatched.length !== 1 ? 's' : ''} not found in the roster — link manually via the epic editor:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {unmatched.map(name => (
                            <span
                              key={name}
                              className="inline-block text-xs bg-white border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* No assignees in CSV */}
              {assigneesFound.length === 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500">
                    No assignees in the CSV (all issues were unassigned). Link team members via the epic editor.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <DialogFooter className="pt-2">
          {step !== 'report' && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}
          {step === 'source' && (
            <Button
              onClick={tab === 'csv' ? handleCsvParse : handleJsonParse}
              disabled={!canPreview}
            >
              <ChevronRight size={14} className="mr-1" />
              Preview Epics
            </Button>
          )}
          {step === 'review' && (
            <Button onClick={handleImport} disabled={selectedCount === 0}>
              Import {selectedCount > 0 ? `${selectedCount} ` : ''}Epic{selectedCount !== 1 ? 's' : ''}
            </Button>
          )}
          {step === 'report' && (
            <Button onClick={handleClose}>
              <Check size={14} className="mr-1" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Shared sub-components ─────────────────────────────────────────────────

/** Red error banner shown below the paste/upload area on parse failure. */
function ParseErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg">
      <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  )
}
