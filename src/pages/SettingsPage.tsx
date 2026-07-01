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
  FlaskConical, Save, History, CalendarOff, CalendarX, Activity,
  Shield, UserX, UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useAuthStore } from '@/store/useAuthStore'
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
import { buildSeedState, buildSampleProjectState, buildPulseSeedData } from '@/lib/seedData'
import { clearState } from '@/lib/persistence'

import type { PortfolioState, ProjectMemberAssignment } from '@/types'

// ─── Ordering helpers ──────────────────────────────────────────────────────
// These two functions let "Load Sample Data" preserve whatever domain/team/member
// ordering the user has set via drag-and-drop, even after syncing new seed data.
// New items (added in the seed) are appended after known ones in their group.

/**
 * Snapshot the current ordering from the live store state.
 * Returns: ordered domain IDs, ordered team IDs per domain, ordered member IDs per team.
 */
function captureOrdering(state: PortfolioState) {
  return {
    domainIds: state.domains.map(d => d.id),
    teamIdsByDomain: new Map(
      state.domains.map(d => [
        d.id,
        state.teams.filter(t => t.domainId === d.id).map(t => t.id),
      ])
    ),
    memberIdsByTeam: new Map(
      state.teams.map(t => [t.id, [...t.memberIds]])
    ),
  }
}

/**
 * Apply a previously-captured ordering to a fresh seed state.
 * Items whose IDs no longer exist in the new state are silently dropped.
 * Items that are new (not in the saved order) are appended to their group.
 */
function applyOrdering(
  newState: PortfolioState,
  ordering: ReturnType<typeof captureOrdering>
): PortfolioState {
  // Reorder domains — known IDs in saved order, then any brand-new domains at end.
  const domainById = new Map(newState.domains.map(d => [d.id, d]))
  const knownDomainIds = new Set(ordering.domainIds)
  const orderedDomains = [
    ...ordering.domainIds.map(id => domainById.get(id)).filter(Boolean),
    ...newState.domains.filter(d => !knownDomainIds.has(d.id)),
  ] as PortfolioState['domains']

  // Reorder teams within each domain.
  const teamById = new Map(newState.teams.map(t => [t.id, t]))
  const orderedTeams: PortfolioState['teams'] = []
  for (const domain of orderedDomains) {
    const savedTeamIds = ordering.teamIdsByDomain.get(domain.id) ?? []
    const savedTeamIdSet = new Set(savedTeamIds)
    const domainTeams = newState.teams.filter(t => t.domainId === domain.id)
    const domainTeamIds = new Set(domainTeams.map(t => t.id))
    orderedTeams.push(
      // Known teams in saved order (skip any that no longer exist in this domain)
      ...savedTeamIds.filter(id => domainTeamIds.has(id)).map(id => teamById.get(id)!),
      // Brand-new teams not in the saved order
      ...domainTeams.filter(t => !savedTeamIdSet.has(t.id)),
    )
  }

  // Reorder memberIds within each team.
  const reorderedTeams = orderedTeams.map(team => {
    const savedMemberIds = ordering.memberIdsByTeam.get(team.id) ?? []
    const savedMemberIdSet = new Set(savedMemberIds)
    const currentMemberIds = new Set(team.memberIds)
    return {
      ...team,
      memberIds: [
        // Known members in saved order (skip any who left the team)
        ...savedMemberIds.filter(id => currentMemberIds.has(id)),
        // Brand-new members not in the saved order
        ...team.memberIds.filter(id => !savedMemberIdSet.has(id)),
      ],
    }
  })

  return { ...newState, domains: orderedDomains, teams: reorderedTeams }
}

// ─── Project snapshot ──────────────────────────────────────────────────────
// A lightweight checkpoint for the project layer only (projects, initiatives,
// intake requests, and per-member projectIds). Lets the user play with sample
// data and then restore their real work without touching the roster.

const PROJECT_SNAPSHOT_KEY = 'sat_project_snapshot'

type ProjectSnapshot = {
  /** ISO timestamp of when the snapshot was created. */
  savedAt: string
  projects:        PortfolioState['projects']
  initiatives:     PortfolioState['initiatives']
  intakeRequests:  PortfolioState['intakeRequests']
  /** Each member's projectIds at snapshot time, keyed by member ID. */
  memberProjectIds: Record<string, string[]>
}

/** Read an existing snapshot from localStorage, or null if none has been saved. */
function loadProjectSnapshot(): ProjectSnapshot | null {
  try {
    const raw = localStorage.getItem(PROJECT_SNAPSHOT_KEY)
    return raw ? (JSON.parse(raw) as ProjectSnapshot) : null
  } catch {
    return null
  }
}

/** Persist the current project layer to localStorage and return the snapshot object. */
function saveProjectSnapshot(state: PortfolioState): ProjectSnapshot {
  const snap: ProjectSnapshot = {
    savedAt:        new Date().toISOString(),
    projects:       state.projects,
    initiatives:    state.initiatives,
    intakeRequests: state.intakeRequests,
    memberProjectIds: Object.fromEntries(state.members.map(m => [m.id, m.projectIds])),
  }
  localStorage.setItem(PROJECT_SNAPSHOT_KEY, JSON.stringify(snap))
  return snap
}

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
      weeklyPulses:   store.weeklyPulses,
      adminMemberIds: store.adminMemberIds,
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
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/25'
            : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40 dark:hover:bg-blue-900/15',
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
            ? 'bg-green-50 dark:bg-green-900/25 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/25 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300',
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


// ─── Access control section ────────────────────────────────────────────────

/**
 * AccessControlSection — manage which members have administrator access.
 *
 * Admins see all data and can create/edit/delete anything.
 * Everyone else is a "viewer": read-only, filtered to their own projects.
 *
 * When Azure AD authentication is added, this list will be replaced by AAD
 * group membership (e.g., "SAT-Admins" group → admin role). At that point,
 * this section can be removed or converted to a read-only display of who is
 * in the AAD admin group.
 *
 * Bootstrap note: if the admin list is empty, everyone gets admin access on
 * sign-in. Add at least one admin here to activate role enforcement.
 */
function AccessControlSection() {
  const { members, adminMemberIds, setAdminMemberIds } = usePortfolioStore()
  const [addingId, setAddingId] = useState('')

  // Members currently marked as admins, sorted by name.
  const adminMembers = members
    .filter(m => adminMemberIds.includes(m.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Members NOT yet admins — available to add.
  const nonAdminMembers = members
    .filter(m => !adminMemberIds.includes(m.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  function addAdmin() {
    if (!addingId || adminMemberIds.includes(addingId)) return
    setAdminMemberIds([...adminMemberIds, addingId])
    setAddingId('')
  }

  function removeAdmin(id: string) {
    setAdminMemberIds(adminMemberIds.filter(x => x !== id))
  }

  return (
    <section className="space-y-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Members in the Admin list have full create/edit/delete access. Everyone
        else signs in as a Viewer (read-only, filtered to their own projects).
        <br />
        <span className="text-amber-600 dark:text-amber-400 font-medium">
          Empty list = bootstrap mode: every sign-in gets admin access until at
          least one admin is added here.
        </span>
      </p>

      {/* Current admins */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Shield size={14} className="text-blue-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Administrators ({adminMembers.length})
          </span>
          {adminMemberIds.length === 0 && (
            <span className="ml-auto text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
              Bootstrap mode active
            </span>
          )}
        </div>

        {adminMembers.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-400 dark:text-slate-500 text-center italic">
            No admins configured — all users sign in with admin access.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {adminMembers.map(m => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <UserCheck size={14} className="text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{m.name}</p>
                  <p className="text-xs text-slate-400 truncate">{m.role}</p>
                </div>
                <button
                  onClick={() => removeAdmin(m.id)}
                  className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Remove admin access"
                >
                  <UserX size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add admin */}
      {nonAdminMembers.length > 0 && (
        <div className="flex gap-2">
          <select
            value={addingId}
            onChange={e => setAddingId(e.target.value)}
            className="flex-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Add a member as admin…</option>
            {nonAdminMembers.map(m => (
              <option key={m.id} value={m.id}>{m.name} · {m.role}</option>
            ))}
          </select>
          <Button onClick={addAdmin} disabled={!addingId} variant="outline">
            <Shield size={14} className="mr-1.5" /> Add Admin
          </Button>
        </div>
      )}

      {members.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-2">
          No members in the roster yet. Add people via the People page first.
        </p>
      )}

      {/* Azure AD migration note */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
        <p className="font-medium text-slate-600 dark:text-slate-300">Azure AD migration path</p>
        <p>
          When Azure AD authentication is added, roles will be assigned via AAD
          group membership (e.g., members of the "SAT-Admins" group get admin
          access). This admin list will no longer be needed.
        </p>
      </div>
    </section>
  )
}


// ─── Settings page ─────────────────────────────────────────────────────────

export function SettingsPage() {
  const { domains, teams, members, projects, initiatives, intakeRequests } = usePortfolioStore()

  const store = usePortfolioStore()

  // Active settings tab.
  const [activeTab, setActiveTab] = useState<'rates' | 'access' | 'export' | 'import' | 'danger'>('rates')

  // Auth — Access Control tab is only shown to admins.
  const { role: authRole } = useAuthStore()

  // Danger Zone confirmation modal. Set pendingAction to open it; the modal
  // calls onConfirm() when the user clicks the destructive button.
  const [pendingAction, setPendingAction] = useState<{
    title: string
    description: string
    confirmLabel: string
    onConfirm: () => void
  } | null>(null)

  /** Open the warning modal for a Danger Zone action. */
  function danger(title: string, description: string, confirmLabel: string, onConfirm: () => void) {
    setPendingAction({ title, description, confirmLabel, onConfirm })
  }

  // Track whether a project snapshot exists so Save/Restore buttons reflect current state.
  const [projectSnapshot, setProjectSnapshot] = useState<ProjectSnapshot | null>(loadProjectSnapshot)
  const snapshotDate = projectSnapshot
    ? new Date(projectSnapshot.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null

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
      weeklyPulses:  store.weeklyPulses,
      adminMemberIds: store.adminMemberIds,
    }
    const ts = new Date().toISOString().slice(0, 10)
    downloadJson(`sat-snapshot-${ts}.json`, exportFullSnapshot(state))
  }

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="max-w-2xl space-y-6">

      {/* Header + tab bar */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          Manage resource rates, import/export data, and reset the portfolio.
        </p>

        {/* Tab switcher — Access Control is only shown to admins */}
        <div className="flex gap-1 mt-4 border-b border-slate-200 dark:border-slate-700">
          {([
            { id: 'rates',     label: 'Resource Rates',   Icon: DollarSign,  adminOnly: false },
            { id: 'access',    label: 'Access Control',   Icon: Shield,      adminOnly: true  },
            { id: 'export',    label: 'Export',            Icon: Download,    adminOnly: false },
            { id: 'import',    label: 'Import',            Icon: Upload,      adminOnly: false },
            { id: 'danger',    label: 'Danger Zone',       Icon: AlertCircle, adminOnly: false },
          ] as const).filter(t => !t.adminOnly || authRole === 'admin').map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Resource Rates tab */}
      {activeTab === 'rates' && (
        <section>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Set annual salary rates per role to enable portfolio-level cost and ROI analysis.
            Rates are fixed (salaried) — allocation % is used to compute project cost share, not to
            adjust the base rate. Rates auto-save when you leave the field.
          </p>
          <ResourceRatesSection />
        </section>
      )}

      {/* Access Control tab — admin only */}
      {activeTab === 'access' && authRole === 'admin' && (
        <AccessControlSection />
      )}

      {/* Export tab */}
      {activeTab === 'export' && (
        <section>
          {/* Export All shortcut — downloads all CSVs in one click */}
          <div className="mb-4 flex items-center justify-between gap-4 bg-blue-50 dark:bg-blue-900/25 border border-blue-200 dark:border-blue-800 rounded-xl px-5 py-4">
            <div className="flex items-start gap-3">
              <PackageOpen size={16} className="text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Export All CSVs</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                  Downloads all 5 entity files in one click — ready to edit and reimport.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              className="shrink-0 gap-1.5 text-xs border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
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
              label="Epics"
              description={`${projects.length} epics — name, status, phase, priority, dates, % complete, initiative`}
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
          <div className="mt-4 flex items-center justify-between gap-4 bg-violet-50 dark:bg-violet-900/25 border border-violet-200 dark:border-violet-800 rounded-xl px-5 py-4">
            <div className="flex items-start gap-3">
              <Database size={16} className="text-violet-500 dark:text-violet-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-violet-900 dark:text-violet-200">Full Snapshot (JSON)</p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                  Exports the entire portfolio state in one file. Import it to fully restore the app — no ordering concerns.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFullJsonExport}
              className="shrink-0 gap-1.5 text-xs border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50"
            >
              <Download size={13} />
              Download JSON
            </Button>
          </div>
        </section>
      )}

      {/* Import tab */}
      {activeTab === 'import' && (
        <section>
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
      )}


      {/* Danger Zone tab */}
      {activeTab === 'danger' && (
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
              onClick={() => danger(
                'Load Sample Data',
                'This replaces everything — domains, teams, members, and projects — with the built-in sample dataset. Your current data cannot be recovered.',
                'Load Sample Data',
                () => {
                  const s = store as unknown as { hydrate: (s: PortfolioState) => void }
                  const ordering = captureOrdering(usePortfolioStore.getState())
                  s.hydrate(applyOrdering(buildSeedState(), ordering))
                },
              )}
            >
              <RotateCcw size={13} />
              Load Sample Data
            </Button>
          </div>

          {/* Load sample projects — overlays demo projects onto the live roster */}
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <FlaskConical size={15} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">Load Sample Epics</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Overlays 29 realistic projects, 5 initiatives, and 5 intake requests onto your
                  current roster so you can explore analytics, capacity planning, and other features
                  with real names.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-600"
              onClick={() => danger(
                'Load Sample Projects',
                'This replaces all current projects, initiatives, and intake requests with sample data. Your roster (domains, teams, members) will not be affected.',
                'Load Sample Projects',
                () => {
                const s = store as unknown as { hydrate: (s: PortfolioState) => void }
                const current = usePortfolioStore.getState()
                const { projects, initiatives, intakeRequests } = buildSampleProjectState()
                // Rebuild each member's projectIds from the sample projects' assignment lists.
                const projectIdsByMember = new Map<string, string[]>()
                for (const p of projects) {
                  for (const { memberId } of p.assignments) {
                    const arr = projectIdsByMember.get(memberId) ?? []
                    arr.push(p.id)
                    projectIdsByMember.set(memberId, arr)
                  }
                }
                s.hydrate({
                  ...current,
                  projects,
                  initiatives,
                  intakeRequests,
                  members: current.members.map(m => ({
                    ...m,
                    projectIds: projectIdsByMember.get(m.id) ?? [],
                  })),
                })
                },
              )}
            >
              <FlaskConical size={13} />
              Load Samples
            </Button>
          </div>

          {/* Load sample PTO — overlays seed PTO blocks onto the live data */}
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <CalendarOff size={15} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">Load Sample PTO</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Replaces all PTO blocks with the 23 sample entries from the seed dataset
                  (spread across FY2026). Does not affect people, epics, or other data.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-600"
              onClick={() => danger(
                'Load Sample PTO',
                'This replaces all current PTO blocks with the seed dataset. Your roster and epics will not be affected.',
                'Load Sample PTO',
                () => {
                  const s = store as unknown as { hydrate: (s: PortfolioState) => void }
                  const current = usePortfolioStore.getState()
                  s.hydrate({ ...current, ptoBlocks: buildSeedState().ptoBlocks })
                },
              )}
            >
              <CalendarOff size={13} />
              Load Sample PTO
            </Button>
          </div>

          {/* Clear PTO — wipe all PTO blocks */}
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <CalendarX size={15} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">Clear All PTO</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Permanently deletes all PTO blocks. Does not affect people, epics, or other data.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-600"
              onClick={() => danger(
                'Clear All PTO',
                'This permanently deletes every PTO block. Your roster and epics will not be affected.',
                'Clear All PTO',
                () => {
                  const s = store as unknown as { hydrate: (s: PortfolioState) => void }
                  s.hydrate({ ...usePortfolioStore.getState(), ptoBlocks: [] })
                },
              )}
            >
              <CalendarX size={13} />
              Clear All PTO
            </Button>
          </div>

          {/* Save project snapshot — checkpoint real data before loading samples */}
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <Save size={15} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">Save Real Data</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {projectSnapshot
                    ? `Snapshot saved ${snapshotDate}. Save again to overwrite with the current project state.`
                    : 'Save your current projects, initiatives, and intake requests as a restore point before loading sample data.'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-600"
              onClick={() => {
                // If no snapshot yet, save directly without a modal.
                if (!projectSnapshot) {
                  setProjectSnapshot(saveProjectSnapshot(usePortfolioStore.getState()))
                  return
                }
                danger(
                  'Overwrite Snapshot',
                  `You already have a snapshot saved on ${snapshotDate}. Saving now will overwrite it with the current project data.`,
                  'Overwrite Snapshot',
                  () => setProjectSnapshot(saveProjectSnapshot(usePortfolioStore.getState())),
                )
              }}
            >
              <Save size={13} />
              Save Snapshot
            </Button>
          </div>

          {/* Restore project snapshot — revert to real data after playing with samples */}
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <History size={15} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">Restore Real Data</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {projectSnapshot
                    ? `Restore the snapshot saved ${snapshotDate}. Current projects will be replaced.`
                    : 'No snapshot saved yet — use "Save Real Data" first.'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!projectSnapshot}
              className="shrink-0 gap-1.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              onClick={() => {
                if (!projectSnapshot) return
                danger(
                  'Restore Snapshot',
                  `This will replace your current projects, initiatives, and intake requests with the snapshot saved on ${snapshotDate}. Any work added since then will be lost.`,
                  'Restore Snapshot',
                  () => {
                    const s = store as unknown as { hydrate: (s: PortfolioState) => void }
                    const current = usePortfolioStore.getState()
                    s.hydrate({
                      ...current,
                      projects:       projectSnapshot.projects,
                      initiatives:    projectSnapshot.initiatives,
                      intakeRequests: projectSnapshot.intakeRequests,
                      members: current.members.map(m => ({
                        ...m,
                        projectIds: projectSnapshot.memberProjectIds[m.id] ?? [],
                      })),
                    })
                  },
                )
              }}
            >
              <History size={13} />
              Restore Snapshot
            </Button>
          </div>

          {/* Clear project data — roster stays, projects/initiatives/intake wiped */}
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <PackageOpen size={15} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">Clear Epic Data</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deletes all projects, initiatives, and intake requests. Your roster (domains, teams,
                  and members) is kept intact so you can start tracking real work from scratch.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-600"
              onClick={() => danger(
                'Clear Project Data',
                'This permanently deletes all projects, initiatives, and intake requests. Your roster (domains, teams, and members) will not be affected.',
                'Clear Project Data',
                () => {
                  const s = store as unknown as { hydrate: (s: PortfolioState) => void }
                  const current = usePortfolioStore.getState()
                  s.hydrate({
                    ...current,
                    projects: [],
                    initiatives: [],
                    intakeRequests: [],
                    members: current.members.map(m => ({ ...m, projectIds: [] })),
                  })
                },
              )}
            >
              <PackageOpen size={13} />
              Clear Epic Data
            </Button>
          </div>

          {/* Load pulse seed data — replace weekly pulses with multi-week sample entries */}
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <Activity size={15} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">Load Pulse Seed Data</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Replaces all pulse entries with sample data spanning 5 weeks (Jun 1–29). Existing pulse entries will be overwritten.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-600"
              onClick={() => danger(
                'Load Pulse Seed Data',
                'This will replace all existing pulse entries with sample data for 5 weeks (Jun 1–29 2026). Your roster, projects, and other data will not be affected.',
                'Load Seed Data',
                () => {
                  const s = store as unknown as { hydrate: (s: PortfolioState) => void }
                  s.hydrate({ ...usePortfolioStore.getState(), weeklyPulses: buildPulseSeedData() })
                },
              )}
            >
              <Activity size={13} />
              Load Pulse Seed Data
            </Button>
          </div>

          {/* Clear pulse data — wipe all weekly pulse entries, roster and epics stay */}
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <Activity size={15} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">Clear All Pulse Data</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Permanently deletes all weekly pulse entries. Your roster, epics, and other data are not affected.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-600"
              onClick={() => danger(
                'Clear All Pulse Data',
                'This permanently deletes every Design Pulse entry across all weeks. Your roster and epics will not be affected.',
                'Clear All Pulses',
                () => {
                  const s = store as unknown as { hydrate: (s: PortfolioState) => void }
                  s.hydrate({ ...usePortfolioStore.getState(), weeklyPulses: [] })
                },
              )}
            >
              <Activity size={13} />
              Clear All Pulses
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
              onClick={() => danger(
                'Clear All Data',
                'This permanently deletes everything — all domains, teams, members, projects, initiatives, and intake requests. The page will reload empty and this cannot be undone.',
                'Delete Everything',
                () => { clearState(); window.location.reload() },
              )}
            >
              <Trash2 size={13} />
              Clear All Data
            </Button>
          </div>

        </div>
      </section>
      )}

      </div>

      {/* Danger Zone confirmation modal — shown whenever pendingAction is set */}
      <Dialog
        open={!!pendingAction}
        onOpenChange={open => { if (!open) setPendingAction(null) }}
      >
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            {/* Red warning icon + title row */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 shrink-0">
                <AlertCircle size={20} className="text-red-600" />
              </div>
              <DialogTitle className="text-slate-900">{pendingAction?.title}</DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="text-slate-600 pl-[52px]">
            {pendingAction?.description}
          </DialogDescription>
          <DialogFooter className="gap-2">
            {/* Cancel — closes without acting */}
            <DialogClose render={<Button variant="outline" className="flex-1" />}>
              Cancel
            </DialogClose>
            {/* Confirm — fires the callback then closes */}
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => {
                pendingAction?.onConfirm()
                setPendingAction(null)
              }}
            >
              {pendingAction?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
