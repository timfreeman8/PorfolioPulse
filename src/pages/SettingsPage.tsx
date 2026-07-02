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

import { useState } from 'react'
import {
  Download, Database, AlertCircle, CheckCircle2,
  PackageOpen, DollarSign, X, Trash2,
  Save, History, CalendarX,
  Shield, UserX, UserCheck, Bell, HardDrive,
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
} from '@/lib/csv'
import { clearState, getStorageSizeBytes } from '@/lib/persistence'
import { getTeamsWebhookUrl, setTeamsWebhookUrl } from '@/lib/notifications'

import type { PortfolioState } from '@/types'

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
  const [activeTab, setActiveTab] = useState<'rates' | 'access' | 'notifications' | 'export' | 'danger'>('rates')

  // Teams webhook URL — read from localStorage on mount; saved on blur.
  const [webhookUrl, setWebhookUrl] = useState(() => getTeamsWebhookUrl())
  const [webhookSaved, setWebhookSaved] = useState(false)

  /** Persist the webhook URL and briefly show a save confirmation. */
  function handleWebhookSave() {
    setTeamsWebhookUrl(webhookUrl)
    setWebhookSaved(true)
    setTimeout(() => setWebhookSaved(false), 2000)
  }

  // localStorage usage — computed once on render (fast string length check).
  const storageSizeBytes   = getStorageSizeBytes()
  const storageSizeKB      = (storageSizeBytes / 1024).toFixed(0)
  const storageSizeMB      = (storageSizeBytes / 1_000_000).toFixed(2)
  // 5MB practical limit = 5,000,000 bytes (UTF-16 string length × 2)
  const storagePercent     = Math.min((storageSizeBytes / 5_000_000) * 100, 100)
  const storageIsWarning   = storagePercent >= 60  // amber at 60%
  const storageIsCritical  = storagePercent >= 85  // red at 85%

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
      <div className="max-w-5xl space-y-6">

      {/* Header + tab bar */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          Manage resource rates, import/export data, and reset the portfolio.
        </p>

        {/* Tab switcher — Access Control is only shown to admins */}
        <div className="flex gap-1 mt-4 border-b border-slate-200 dark:border-slate-700">
          {([
            { id: 'rates',         label: 'Resource Rates',   Icon: DollarSign,  adminOnly: false },
            { id: 'access',        label: 'Access Control',   Icon: Shield,      adminOnly: true  },
            { id: 'notifications', label: 'Notifications',    Icon: Bell,        adminOnly: false },
            { id: 'export',        label: 'Export',           Icon: Download,    adminOnly: false },
            { id: 'danger',        label: 'Danger Zone',      Icon: AlertCircle, adminOnly: false },
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

      {/* Notifications tab — Teams webhook configuration */}
      {activeTab === 'notifications' && (
        <section className="space-y-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Connect Portfolio Pulse to a Microsoft Teams channel via an incoming webhook.
            The app will post a message when a project is marked <strong>Blocked</strong> or
            when a member's total assignment allocation exceeds their capacity ceiling.
          </p>

          {/* Webhook URL input */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-slate-400 shrink-0" />
              <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Microsoft Teams Incoming Webhook
              </h3>
            </div>

            {/* How to get a webhook URL */}
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              In Teams, go to a channel → <strong>⋯ → Connectors → Incoming Webhook → Configure</strong>.
              Copy the webhook URL and paste it below.
            </p>

            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://outlook.office.com/webhook/..."
                value={webhookUrl}
                onChange={e => { setWebhookUrl(e.target.value); setWebhookSaved(false) }}
                className="flex-1 text-sm dark:bg-slate-700 dark:border-slate-600"
              />
              <Button
                size="sm"
                onClick={handleWebhookSave}
                className="shrink-0 gap-1.5"
              >
                {webhookSaved ? <CheckCircle2 size={13} /> : <Save size={13} />}
                {webhookSaved ? 'Saved' : 'Save'}
              </Button>
            </div>

            {/* Current status */}
            {webhookUrl.trim() ? (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 size={11} />
                Webhook configured — notifications will fire automatically.
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                No webhook configured — notifications are disabled.
              </p>
            )}
          </div>

          {/* What triggers a notification */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3">
              Triggers
            </h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">🚨</span>
                <span><strong>Project Blocked</strong> — fires when any project's status changes to Blocked.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">⚠️</span>
                <span><strong>Member Over Capacity</strong> — fires when an assignment pushes a member's total allocation above their capacity ceiling.</span>
              </li>
            </ul>
          </div>
        </section>
      )}

      {/* Export tab */}
      {activeTab === 'export' && (
        <section>
          {/* Storage usage indicator — helps users know when to export a backup */}
          <div className={cn(
            'mb-4 flex items-center gap-4 rounded-xl px-5 py-4 border',
            storageIsCritical
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : storageIsWarning
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
          )}>
            <HardDrive size={16} className={cn(
              'shrink-0',
              storageIsCritical ? 'text-red-500' : storageIsWarning ? 'text-amber-500' : 'text-slate-400',
            )} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  localStorage usage
                </span>
                <span className={cn(
                  'text-xs font-bold tabular-nums',
                  storageIsCritical ? 'text-red-600 dark:text-red-400' : storageIsWarning ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400',
                )}>
                  {storageSizeKB} KB / ~5 MB
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    storageIsCritical ? 'bg-red-500' : storageIsWarning ? 'bg-amber-400' : 'bg-green-500',
                  )}
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
              {(storageIsWarning || storageIsCritical) && (
                <p className="text-[11px] mt-1 text-amber-700 dark:text-amber-400">
                  {storageIsCritical
                    ? `${storageSizeMB} MB — export a JSON snapshot now before you hit the 5 MB limit.`
                    : `${storageSizeMB} MB — consider exporting a backup soon.`}
                </p>
              )}
            </div>
          </div>

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

      {/* Danger Zone tab */}
      {activeTab === 'danger' && (
        <section>
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle size={16} className="text-red-400" />
          <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
        </div>
        <div className="border border-red-200 rounded-xl divide-y divide-red-100">

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
