/**
 * Settings page — data management hub for the SAT portfolio tool.
 *
 * Three sections (top to bottom):
 *
 * 1. RESOURCE RATES — Editable table mapping each unique member role to an
 *    annual salary rate. Rates auto-save on blur. Used by the Analytics
 *    Financial tab to calculate portfolio headcount cost and project ROI.
 *
 * 2. EXPORT — Download any entity collection as a CSV file, or export the
 *    entire portfolio state as a JSON snapshot. CSVs are designed for human
 *    editing in spreadsheet applications (Excel, Numbers, Google Sheets).
 *
 * 3. IMPORT — Upload a previously-exported CSV or JSON snapshot to replace
 *    the current data. The entity type is auto-detected from the CSV headers,
 *    so there's no need to select it manually. Importing replaces the entity
 *    collection atomically via the store's `hydrate()` action.
 *
 * Workflow:
 *   Export → edit in a spreadsheet → import back → the app reflects the changes.
 *
 * Notes on CSV format:
 *   - Multi-value fields (memberIds, teamIds) are stored as semicolon-separated
 *     values in a single column.
 *   - Assignments (project ↔ member links) are a separate file because they
 *     carry per-member allocation data that can't be flattened cleanly.
 *   - When importing projects, upload assignments.csv FIRST so the parser can
 *     attach assignments to the right project rows.
 */

import { useRef, useState } from 'react'
import {
  Download, Upload, Database, FileText, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, PackageOpen, DollarSign, X, RotateCcw, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { cn } from '@/lib/utils'
import {
  downloadCsv,
  downloadJson,
  exportRosterCsv,
  exportProjectsCsv,
  exportAssignmentsCsv,
  exportInitiativesCsv,
  exportIntakeCsv,
  exportFullSnapshot,
  importRosterCsv,
  importDomainsCsv,
  importTeamsCsv,
  importMembersCsv,
  importProjectsCsv,
  importAssignmentsCsv,
  importInitiativesCsv,
  importIntakeCsv,
  importFullSnapshot,
  detectCsvEntityType,
  type CsvEntityType,
} from '@/lib/csv'
import { buildSeedState } from '@/lib/seedData'
import { clearState } from '@/lib/persistence'
import type { PortfolioState, ProjectMemberAssignment } from '@/types'

// ─── Currency helpers ──────────────────────────────────────────────────────

/**
 * Format a dollar amount in compact notation, e.g. 120000 → "$120K".
 * Used for the summary line in the Resource Rates section.
 */
function fmtCompact(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    notation: 'compact', maximumFractionDigits: 0,
  }).format(n)
}

/**
 * Format a number as a plain dollar amount, e.g. 120000 → "120,000".
 * Used inside input fields (without $ — the $ is a prefix element).
 */
function fmtNumber(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
}

// ─── Resource Rates section ────────────────────────────────────────────────

/**
 * ResourceRatesSection — table of unique member roles with editable annual rates.
 *
 * Rates are saved to the store on blur (auto-save pattern). Each role row shows
 * the role name, an annual cost input, and a clear button. Roles without a rate
 * show a placeholder "—" and an "Add rate" affordance. A summary line at the
 * bottom shows how many roles have rates and the total headcount cost.
 */
function ResourceRatesSection() {
  const { members, resourceRates, setResourceRate, removeResourceRate } = usePortfolioStore()

  // Collect the unique set of role strings across all members.
  const uniqueRoles = Array.from(new Set(members.map(m => m.role))).sort()

  // Local state for in-flight edits — maps role → current input string.
  // We store the raw string so the user can type freely before committing on blur.
  const [editing, setEditing] = useState<Record<string, string>>({})

  // Build a fast lookup from the store's resourceRates array.
  const rateByRole = new Map(resourceRates.map(r => [r.role, r.annualRate]))

  // Summary calculations.
  const rolesWithRate = uniqueRoles.filter(r => rateByRole.has(r))
  const totalCost = rolesWithRate.reduce((sum, role) => {
    // Count distinct members with this role for the total cost.
    const count = members.filter(m => m.role === role).length
    return sum + (rateByRole.get(role) ?? 0) * count
  }, 0)

  /** Called when the user changes the input for a role. Tracks raw string only. */
  function handleChange(role: string, raw: string) {
    setEditing(prev => ({ ...prev, [role]: raw }))
  }

  /**
   * On blur: parse the input value and persist to the store if valid and changed.
   * Strip commas and dollar signs so users can paste formatted numbers.
   */
  function handleBlur(role: string) {
    const raw = editing[role]
    if (raw === undefined) return  // untouched field — nothing to save
    // Clean user input: remove "$", "," and whitespace before parsing.
    const cleaned = raw.replace(/[$,\s]/g, '')
    const parsed = Number(cleaned)
    if (!cleaned || isNaN(parsed) || parsed <= 0) {
      // Invalid entry — revert display by clearing the editing state for this role.
      setEditing(prev => { const next = { ...prev }; delete next[role]; return next })
      return
    }
    setResourceRate(role, Math.round(parsed))
    // Clear the editing override so the display reverts to the formatted store value.
    setEditing(prev => { const next = { ...prev }; delete next[role]; return next })
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span>Role</span>
        <span>Annual Rate</span>
        <span />
      </div>

      {/* Role rows */}
      {uniqueRoles.map(role => {
        const stored = rateByRole.get(role)
        const hasRate = stored !== undefined
        // Prefer the in-flight edit value; otherwise show the stored value formatted.
        const displayValue = editing[role] !== undefined
          ? editing[role]
          : (hasRate ? fmtNumber(stored!) : '')

        return (
          <div
            key={role}
            className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0"
          >
            <span className="text-sm text-slate-700 dark:text-slate-200">{role}</span>

            {/* Annual rate input with $ prefix */}
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-400 dark:text-slate-500">$</span>
              <Input
                type="text"
                inputMode="numeric"
                value={displayValue}
                placeholder={hasRate ? '' : 'Add rate'}
                onChange={e => handleChange(role, e.target.value)}
                onBlur={() => handleBlur(role)}
                className={cn(
                  'h-8 w-32 text-right text-sm',
                  !hasRate && 'placeholder:text-slate-400 dark:placeholder:text-slate-500 italic',
                )}
              />
            </div>

            {/* Clear button — only shown when a rate is defined */}
            {hasRate ? (
              <button
                type="button"
                onClick={() => removeResourceRate(role)}
                title="Clear rate"
                className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
            ) : (
              /* Placeholder to keep grid alignment consistent */
              <span className="w-4" />
            )}
          </div>
        )
      })}

      {/* Summary line */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {rolesWithRate.length} of {uniqueRoles.length}
          </span>
          {' '}roles have rates defined
          {totalCost > 0 && (
            <>
              {' · '}
              Total annual headcount cost:{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {fmtCompact(totalCost)}
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface ImportResult {
  ok: boolean
  message: string
  detail?: string
}

// ─── Export card ──────────────────────────────────────────────────────────

/**
 * ExportCard — one entity's export controls.
 * Shows a label, description, and a Download button.
 */
function ExportCard({
  label,
  description,
  onDownload,
}: {
  label: string
  description: string
  onDownload: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onDownload}
        className="shrink-0 gap-1.5 text-xs"
      >
        <Download size={13} />
        Download CSV
      </Button>
    </div>
  )
}

// ─── Pending assignments state ─────────────────────────────────────────────
// When importing projects, the user should upload assignments.csv first so
// the parser can attach assignments. We keep parsed assignments in module-level
// state (outside React) since they're ephemeral and survive re-renders.

let pendingAssignments: Map<string, ProjectMemberAssignment[]> = new Map()

// ─── Import section ────────────────────────────────────────────────────────

/**
 * ImportSection — file upload UI that auto-detects entity type and applies
 * the import to the store. Provides clear feedback on what was imported.
 */
function ImportSection() {
  const store = usePortfolioStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragging, setDragging] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  /** Apply a parsed CSV to the appropriate slice of the store state. */
  function applyImport(entityType: CsvEntityType, csvText: string): ImportResult {
    const state = store as unknown as PortfolioState & { hydrate: (s: PortfolioState) => void }
    const current: PortfolioState = {
      domains:        store.domains,
      teams:          store.teams,
      members:        store.members,
      projects:       store.projects,
      initiatives:    store.initiatives,
      intakeRequests: store.intakeRequests,
      escalations:    store.escalations,
      ptoBlocks:      store.ptoBlocks,
      resourceRates:  store.resourceRates,
    }

    switch (entityType) {
      case 'roster': {
        // Single file replaces domains + teams + members atomically.
        // Current arrays are passed so existing IDs can be reused by name,
        // keeping project assignment references stable.
        const { domains, teams, members } = importRosterCsv(csvText, current.domains, current.teams)
        state.hydrate({ ...current, domains, teams, members })
        return {
          ok: true,
          message: `Imported ${domains.length} domains, ${teams.length} teams, ${members.length} members.`,
        }
      }
      // Legacy cases — still handled so old individual CSV files can be reimported.
      case 'domains': {
        const imported = importDomainsCsv(csvText)
        state.hydrate({ ...current, domains: imported })
        return { ok: true, message: `Imported ${imported.length} domains.` }
      }
      case 'teams': {
        const imported = importTeamsCsv(csvText, current.domains)
        state.hydrate({ ...current, teams: imported })
        return { ok: true, message: `Imported ${imported.length} teams.` }
      }
      case 'members': {
        const imported = importMembersCsv(csvText, current.teams, current.domains)
        state.hydrate({ ...current, members: imported })
        return { ok: true, message: `Imported ${imported.length} members.` }
      }
      case 'assignments': {
        // Store parsed assignments so they're available when projects are imported next.
        // Pass current members so member names in the CSV can be resolved to IDs.
        pendingAssignments = importAssignmentsCsv(csvText, current.members)
        const total = [...pendingAssignments.values()].reduce((s, a) => s + a.length, 0)
        return {
          ok: true,
          message: `Parsed ${total} assignments for ${pendingAssignments.size} projects.`,
          detail: 'Now upload projects.csv to attach these assignments to projects.',
        }
      }
      case 'projects': {
        // Pass current initiatives and projects so names resolve to IDs (including blockedBy).
        const imported = importProjectsCsv(csvText, pendingAssignments, current.initiatives, current.projects)
        // Rebuild member.projectIds from assignments to keep the store consistent.
        const updatedMembers = current.members.map(m => ({
          ...m,
          projectIds: imported
            .filter(p => p.assignments.some(a => a.memberId === m.id))
            .map(p => p.id),
        }))
        state.hydrate({ ...current, projects: imported, members: updatedMembers })
        // Clear pending assignments after use.
        pendingAssignments = new Map()
        return {
          ok: true,
          message: `Imported ${imported.length} projects.`,
          detail: `${imported.filter(p => p.assignments.length > 0).length} projects have assignments attached.`,
        }
      }
      case 'initiatives': {
        const imported = importInitiativesCsv(csvText)
        state.hydrate({ ...current, initiatives: imported })
        return { ok: true, message: `Imported ${imported.length} initiatives.` }
      }
      case 'intake': {
        const imported = importIntakeCsv(csvText)
        state.hydrate({ ...current, intakeRequests: imported })
        return { ok: true, message: `Imported ${imported.length} intake requests.` }
      }
    }
  }

  /** Handle a file from the input or drop event. */
  function processFile(file: File) {
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) {
        setResult({ ok: false, message: 'File is empty.' })
        return
      }

      // JSON snapshot path
      if (file.name.endsWith('.json') || text.trimStart().startsWith('{')) {
        try {
          const snapshot = importFullSnapshot(text)
          const s = store as unknown as { hydrate: (s: PortfolioState) => void }
          s.hydrate(snapshot)
          setResult({
            ok: true,
            message: `Full snapshot imported.`,
            detail: `${snapshot.domains.length} domains, ${snapshot.teams.length} teams, ${snapshot.members.length} members, ${snapshot.projects.length} projects.`,
          })
        } catch (err) {
          setResult({ ok: false, message: 'Invalid JSON snapshot.', detail: String(err) })
        }
        return
      }

      // CSV path — auto-detect entity type
      const entityType = detectCsvEntityType(text)
      if (!entityType) {
        setResult({
          ok: false,
          message: 'Could not detect entity type from CSV headers.',
          detail: 'Make sure the file was exported from this tool and the header row is intact.',
        })
        return
      }

      try {
        const res = applyImport(entityType, text)
        setResult(res)
      } catch (err) {
        setResult({ ok: false, message: 'Import failed.', detail: String(err) })
      }
    }
    reader.readAsText(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset input so the same file can be re-uploaded if needed.
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40',
        )}
      >
        <Upload size={24} className="mx-auto mb-2 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">Drop a CSV or JSON file here</p>
        <p className="text-xs text-slate-400 mt-1">or click to browse</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json"
          className="sr-only"
          onChange={onFileChange}
        />
      </div>

      {/* Result feedback */}
      {result && (
        <div className={cn(
          'flex gap-3 p-4 rounded-lg border',
          result.ok
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800',
        )}>
          {result.ok
            ? <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
          }
          <div>
            <p className="text-sm font-medium">{result.message}</p>
            {result.detail && <p className="text-xs mt-0.5 opacity-80">{result.detail}</p>}
          </div>
        </div>
      )}

      {/* Import order instructions */}
      <button
        onClick={() => setShowInstructions(i => !i)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors"
      >
        {showInstructions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Import order &amp; tips
      </button>
      {showInstructions && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-4 space-y-1 border border-slate-100">
          <p className="font-medium text-slate-700 mb-2">Recommended import order</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>roster.csv — domains + teams + members in one file</li>
            <li>initiatives.csv — must exist before projects reference them</li>
            <li>assignments.csv — <strong>upload before projects.csv</strong> so assignments attach correctly</li>
            <li>projects.csv — assignments from step 3 are attached automatically</li>
            <li>intake.csv — standalone, no dependencies</li>
          </ol>
          <p className="mt-3 text-slate-400">
            Tip: for a full replace, use <strong>Export Full Snapshot → JSON</strong> and re-import the JSON.
            It restores everything in one step with no ordering concerns.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Settings page ─────────────────────────────────────────────────────────

export function SettingsPage() {
  const { domains, teams, members, projects, initiatives, intakeRequests } = usePortfolioStore()

  const store = usePortfolioStore()

  /**
   * Download all CSV files sequentially with a small delay between each so
   * browsers don't block multiple simultaneous download prompts.
   */
  async function handleExportAll() {
    const ts = new Date().toISOString().slice(0, 10)
    // Roster replaces the 3 separate domain/team/member files.
    const files: [string, string][] = [
      [`roster-${ts}.csv`,      exportRosterCsv(domains, teams, members)],
      [`assignments-${ts}.csv`, exportAssignmentsCsv(projects, members)],
      [`projects-${ts}.csv`,    exportProjectsCsv(projects, initiatives)],
      [`initiatives-${ts}.csv`, exportInitiativesCsv(initiatives)],
      [`intake-${ts}.csv`,      exportIntakeCsv(intakeRequests)],
    ]
    for (const [filename, content] of files) {
      downloadCsv(filename, content)
      // Small delay so each download registers before the next triggers.
      await new Promise(r => setTimeout(r, 150))
    }
  }

  function handleFullJsonExport() {
    const state = {
      domains,
      teams,
      members,
      projects,
      initiatives,
      intakeRequests,
      escalations:   store.escalations,
      ptoBlocks:     store.ptoBlocks,
      resourceRates: store.resourceRates,
    }
    const ts = new Date().toISOString().slice(0, 10)
    downloadJson(`sat-snapshot-${ts}.json`, exportFullSnapshot(state))
  }

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Data Management</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Export data to CSV for editing in a spreadsheet, then reimport to update the portfolio.
          Use the JSON snapshot for a full lossless backup.
        </p>
      </div>

      {/* Resource Rates section — above Export */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={16} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Resource Rates</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Set annual salary rates per role to enable portfolio-level cost and ROI analysis.
          Rates are fixed (salaried) — allocation % is used to compute project cost share, not to
          adjust the base rate. Rates auto-save when you leave the field.
        </p>
        <ResourceRatesSection />
      </section>

      {/* Export section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Download size={16} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-800">Export</h2>
        </div>

        {/* Export All shortcut — downloads all CSVs in one click */}
        <div className="mb-4 flex items-center justify-between gap-4 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
          <div className="flex items-start gap-3">
            <PackageOpen size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Export All CSVs</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Downloads all 5 entity files in one click — ready to edit and reimport.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            className="shrink-0 gap-1.5 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
          >
            <Download size={13} />
            Export All
          </Button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl px-5 divide-y divide-slate-100">
          <ExportCard
            label="Roster"
            description={`${domains.length} domains · ${teams.length} teams · ${members.length} members — one flat file`}
            onDownload={() => downloadCsv('roster.csv', exportRosterCsv(domains, teams, members))}
          />
          <ExportCard
            label="Projects"
            description={`${projects.length} projects — name, status, phase, priority, dates, % complete, initiative`}
            onDownload={() => downloadCsv('projects.csv', exportProjectsCsv(projects, initiatives))}
          />
          <ExportCard
            label="Assignments"
            description={`${projects.reduce((s, p) => s + p.assignments.length, 0)} rows — project, member, part, allocation, dates`}
            onDownload={() => downloadCsv('assignments.csv', exportAssignmentsCsv(projects, members))}
          />
          <ExportCard
            label="Initiatives"
            description={`${initiatives.length} initiatives — name, description, targetQuarter, status`}
            onDownload={() => downloadCsv('initiatives.csv', exportInitiativesCsv(initiatives))}
          />
          <ExportCard
            label="Intake Requests"
            description={`${intakeRequests.length} requests — requester, description, priority, status`}
            onDownload={() => downloadCsv('intake.csv', exportIntakeCsv(intakeRequests))}
          />
        </div>

        {/* Full JSON snapshot — separate from individual CSVs */}
        <div className="mt-4 flex items-center justify-between gap-4 bg-violet-50 border border-violet-200 rounded-xl px-5 py-4">
          <div className="flex items-start gap-3">
            <Database size={16} className="text-violet-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-violet-900">Full Snapshot (JSON)</p>
              <p className="text-xs text-violet-600 mt-0.5">
                Exports the entire portfolio state in one file. Import it to fully restore the app — no ordering concerns.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFullJsonExport}
            className="shrink-0 gap-1.5 text-xs border-violet-300 text-violet-700 hover:bg-violet-100"
          >
            <Download size={13} />
            Download JSON
          </Button>
        </div>
      </section>

      {/* Import section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Upload size={16} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-800">Import</h2>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-5 pb-4 border-b border-slate-100">
            <FileText size={15} className="text-slate-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload any CSV or JSON file exported from this tool. The entity type is auto-detected
              from the header row — no need to specify it manually. Importing <strong>replaces</strong> the
              entity collection entirely (existing rows are overwritten, rows not in the file are removed).
            </p>
          </div>
          <ImportSection />
        </div>
      </section>

      {/* Danger Zone — reset and clear actions */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle size={16} className="text-red-400" />
          <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
        </div>
        <div className="border border-red-200 rounded-xl divide-y divide-red-100">

          {/* Load sample data */}
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <RotateCcw size={15} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">Load Sample Data</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Replaces all current data with the built-in sample dataset. Use this to reset
                  to a known good state for testing.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-600"
              onClick={() => {
                if (!confirm('Replace all data with the sample dataset? This cannot be undone.')) return
                const s = store as unknown as { hydrate: (s: PortfolioState) => void }
                s.hydrate(buildSeedState())
              }}
            >
              <RotateCcw size={13} />
              Load Sample Data
            </Button>
          </div>

          {/* Clear all data */}
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <Trash2 size={15} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">Clear All Data</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Permanently deletes everything — all members, projects, teams, and initiatives.
                  The app will reload empty so you can start from scratch.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-600"
              onClick={() => {
                if (!confirm('Delete all data permanently? The page will reload empty.')) return
                clearState()
                window.location.reload()
              }}
            >
              <Trash2 size={13} />
              Clear All Data
            </Button>
          </div>

        </div>
      </section>
      </div>
    </div>
  )
}
