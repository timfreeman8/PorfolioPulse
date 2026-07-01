/**
 * Design Pulse page — weekly status hub for the design team.
 *
 * Each team member fills out their pulse every Friday for the upcoming week:
 *   - Workload sentiment (1–5 scale)
 *   - Current priorities — row-per-item with textarea text input + S/M/L/XL size tag
 *   - Upcoming events, OOO, and releases (numbered rows, same pattern as priorities)
 *   - Development focus / desired project types (numbered rows)
 *   - Quarterly objectives organized by product area
 *
 * Managers see a "Team Pulse" dashboard with all direct reports' cards.
 * Members see "My Pulse" for their own entry; both modes support editing.
 *
 * The edit modal is wide (max-w-4xl) and designed for <1 minute completion.
 * A "Copy from last week" shortcut pre-fills all fields from the prior entry.
 */

import { useState, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Pencil, Plus, Trash2,
  Activity, Users, AlertCircle, Smile, TrendingUp, Copy,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { StatCard } from '@/components/ui/stat-card'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useViewStore } from '@/store/useViewStore'
import { avatarColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { WeeklyPulse, PriorityItem, ObjectiveArea, Member } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────

const SENTIMENT_LABELS: Record<number, string> = {
  1: 'Send me something, anything',
  2: 'Light week',
  3: 'Just right',
  4: 'Busy week',
  5: 'Extremely busy, please no more!',
}

/** Color classes for each sentiment level. */
const SENTIMENT_COLORS: Record<number, { bg: string; text: string; bar: string }> = {
  1: { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',   bar: 'bg-blue-400' },
  2: { bg: 'bg-sky-50 border-sky-200',     text: 'text-sky-700',    bar: 'bg-sky-400' },
  3: { bg: 'bg-green-50 border-green-200', text: 'text-green-700',  bar: 'bg-green-500' },
  4: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700',  bar: 'bg-amber-400' },
  5: { bg: 'bg-red-50 border-red-200',     text: 'text-red-700',    bar: 'bg-red-500' },
}

/** Size options for individual priority items. */
const SIZE_OPTIONS = ['S', 'M', 'L', 'XL'] as const

/** Status options shown as toggle pills on each priority row. */
const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Complete', 'Blocked'] as const

/** Active pill styles per status — used in the edit modal. */
const STATUS_PILL_ACTIVE: Record<string, string> = {
  'Not Started': 'bg-slate-100 text-slate-700 border-slate-400',
  'In Progress': 'bg-blue-50 text-blue-600 border-blue-400',
  'Complete':    'bg-green-500 text-white border-green-500',
  'Blocked':     'bg-red-50 text-red-600 border-red-400',
}

/** Read-only badge styles per status — used in the pulse card. */
const STATUS_BADGE: Record<string, string> = {
  'Not Started': 'border-slate-300 text-slate-500',
  'In Progress': 'border-blue-300 text-blue-600',
  'Complete':    'bg-green-500 text-white border-green-500',
  'Blocked':     'border-red-300 text-red-600',
}

// ─── Date helpers ──────────────────────────────────────────────────────────

/**
 * Returns the ISO date string for the Monday of the upcoming relevant week.
 * Mon–Thu → this week's Monday (in-week context).
 * Fri–Sun → next week's Monday (Friday prep is for the coming week).
 */
function getDefaultWeekOf(): string {
  const today = new Date()
  const day = today.getDay()
  const daysToMonday = day === 0 ? 1 : day <= 4 ? 1 - day : 8 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysToMonday)
  return monday.toISOString().slice(0, 10)
}

/** Format a weekOf ISO date string as "Week of June 15, 2026". */
function formatWeekOf(weekOf: string): string {
  const d = new Date(weekOf + 'T12:00:00') // noon avoids TZ midnight rollback
  return 'Week of ' + d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/** Shift a weekOf date string by ±1 week (±7 days). */
function shiftWeek(weekOf: string, delta: 1 | -1): string {
  const d = new Date(weekOf + 'T12:00:00')
  d.setDate(d.getDate() + delta * 7)
  return d.toISOString().slice(0, 10)
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Returns all members who report directly to `manager` (matched by name string). */
function getDirectReports(manager: Member, members: Member[]): Member[] {
  return members.filter(m => m.reportsTo === manager.name)
}

// ─── Pulse edit dialog ─────────────────────────────────────────────────────
// Wide modal designed for speed. Priorities use row-per-item with a textarea
// text field and S/M/L/XL size pills. Upcoming and Dev Focus are free-form
// textareas (one item per line). "Copy from last week" pre-fills everything.

interface PulseFormState {
  workloadSentiment: 1 | 2 | 3 | 4 | 5
  /** Priority rows — each has text, size, and optional status. */
  currentPriorities: PriorityItem[]
  /** Upcoming items — same shape as currentPriorities, shown in a separate section. */
  upcoming: PriorityItem[]
  /** Development focus / desired project types — text only, no status/size in UI. */
  developmentFocus: PriorityItem[]
  /** Personal development goals — flat strings. */
  personalObjectives: string[]
  /** Team-level OKRs or commitments — flat strings. */
  teamObjectives: string[]
  /** Stretch goals / side work — flat strings. */
  sideQuests: string[]
  /** Legacy objectives kept so existing entries aren't lost on re-save. */
  objectives: ObjectiveArea[]
}

function emptyForm(): PulseFormState {
  return {
    workloadSentiment: 3,
    currentPriorities: [{ text: '', size: 'M' }],
    upcoming: [{ text: '', size: 'M' }],
    developmentFocus: [{ text: '', size: 'M' }],
    personalObjectives: [''],
    teamObjectives: [''],
    sideQuests: [''],
    objectives: [],
  }
}

/** Convert a stored WeeklyPulse into the dialog's editable form state. */
function pulseToForm(pulse: WeeklyPulse): PulseFormState {
  // Derive display values from legacy ObjectiveArea if the new flat fields are absent.
  const legacyPersonal = pulse.objectives.flatMap(o => o.objectives).filter(s => s.trim())
  const legacySideQuests = pulse.objectives.flatMap(o => o.sideQuests).filter(s => s.trim())

  return {
    workloadSentiment: pulse.workloadSentiment,
    currentPriorities: pulse.currentPriorities.length > 0 ? pulse.currentPriorities : [{ text: '', size: 'M' }],
    upcoming: pulse.upcoming.length > 0 ? pulse.upcoming : [{ text: '', size: 'M' }],
    developmentFocus: pulse.developmentFocus.length > 0 ? pulse.developmentFocus : [{ text: '', size: 'M' }],
    personalObjectives: pulse.personalObjectives?.length ? pulse.personalObjectives : legacyPersonal.length ? legacyPersonal : [''],
    teamObjectives: pulse.teamObjectives?.length ? pulse.teamObjectives : [''],
    sideQuests: pulse.sideQuests?.length ? pulse.sideQuests : legacySideQuests.length ? legacySideQuests : [''],
    objectives: pulse.objectives,
  }
}

/**
 * Convert form state back to the WeeklyPulse payload.
 * Strips rows where text is empty so blank placeholder rows aren't persisted.
 */
function cleanForm(form: PulseFormState): Omit<WeeklyPulse, 'id' | 'updatedAt' | 'memberId' | 'weekOf'> {
  return {
    workloadSentiment: form.workloadSentiment,
    currentPriorities: form.currentPriorities.filter(p => p.text.trim()),
    priorityTags: [],
    upcoming: form.upcoming.filter(p => p.text.trim()),
    developmentFocus: form.developmentFocus.filter(p => p.text.trim()),
    personalObjectives: form.personalObjectives.filter(s => s.trim()),
    teamObjectives: form.teamObjectives.filter(s => s.trim()),
    sideQuests: form.sideQuests.filter(s => s.trim()),
    objectives: form.objectives,  // preserve legacy data untouched
  }
}

function PulseEditDialog({
  open,
  member,
  pulse,
  previousPulse,
  weekOf,
  onSave,
  onClose,
}: {
  open: boolean
  member: Member
  pulse?: WeeklyPulse
  previousPulse?: WeeklyPulse
  weekOf: string
  onSave: (data: Omit<WeeklyPulse, 'id' | 'updatedAt'>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<PulseFormState>(() =>
    pulse ? pulseToForm(pulse) : emptyForm()
  )

  /** Pre-fill all fields from the previous week — user only edits what changed. */
  function copyFromLastWeek() {
    if (previousPulse) setForm(pulseToForm(previousPulse))
  }

  // ── PriorityItem list helpers (currentPriorities + upcoming) ─────────────
  // Generic over the field name so both sections share one implementation.

  function updatePriorityField(
    field: 'currentPriorities' | 'upcoming',
    i: number,
    patch: Partial<PriorityItem>,
  ) {
    setForm(f => ({
      ...f,
      [field]: f[field].map((p, idx) => idx === i ? { ...p, ...patch } : p),
    }))
  }

  function addPriorityField(field: 'currentPriorities' | 'upcoming') {
    setForm(f => ({ ...f, [field]: [...f[field], { text: '', size: 'M' }] }))
  }

  function removePriorityField(field: 'currentPriorities' | 'upcoming', i: number) {
    // Always keep at least one row so the section never collapses.
    setForm(f => ({
      ...f,
      [field]: f[field].length > 1
        ? f[field].filter((_, idx) => idx !== i)
        : [{ text: '', size: 'M' }],
    }))
  }

  // ── Development focus helpers ─────────────────────────────────────────────

  function updateDevFocus(i: number, text: string) {
    setForm(f => ({
      ...f,
      developmentFocus: f.developmentFocus.map((p, idx) => idx === i ? { ...p, text } : p),
    }))
  }

  function addDevFocus() {
    setForm(f => ({ ...f, developmentFocus: [...f.developmentFocus, { text: '', size: 'M' }] }))
  }

  function removeDevFocus(i: number) {
    setForm(f => ({
      ...f,
      developmentFocus: f.developmentFocus.length > 1
        ? f.developmentFocus.filter((_, idx) => idx !== i)
        : [{ text: '', size: 'M' }],
    }))
  }

  // ── Flat string-list helpers (personalObjectives, teamObjectives, sideQuests) ──

  function updateSimple(
    field: 'personalObjectives' | 'teamObjectives' | 'sideQuests',
    i: number,
    value: string,
  ) {
    setForm(f => ({ ...f, [field]: f[field].map((v, idx) => idx === i ? value : v) }))
  }

  function addSimple(field: 'personalObjectives' | 'teamObjectives' | 'sideQuests') {
    setForm(f => ({ ...f, [field]: [...f[field], ''] }))
  }

  function removeSimple(field: 'personalObjectives' | 'teamObjectives' | 'sideQuests', i: number) {
    setForm(f => ({
      ...f,
      [field]: f[field].length > 1 ? f[field].filter((_, idx) => idx !== i) : [''],
    }))
  }

  function handleSave() {
    const cleaned = cleanForm(form)
    onSave({ memberId: member.id, weekOf, ...cleaned })
    onClose()
  }

  // ── Shared sub-components ──────────────────────────────────────────────────

  /**
   * A numbered row used by simple string-list sections (Team Objectives,
   * Dev Focus, Side Quests). No status/size pills — just text + delete.
   */
  function SimpleRow({
    value,
    index,
    placeholder,
    onChange,
    onRemove,
  }: {
    value: string
    index: number
    placeholder: string
    onChange: (v: string) => void
    onRemove: () => void
  }) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400 w-5 shrink-0 text-right">{index + 1}.</span>
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm h-9"
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-300 hover:text-red-400 shrink-0"
          aria-label="Remove"
        >
          <Trash2 size={14} />
        </button>
      </div>
    )
  }

  /**
   * A priority row with status toggle pills and S/M/L/XL size pills.
   * Used for both Current Priorities and Upcoming Priorities sections.
   */
  function PriorityRow({
    item,
    index,
    placeholder,
    onChange,
    onRemove,
  }: {
    item: PriorityItem
    index: number
    placeholder: string
    onChange: (patch: Partial<PriorityItem>) => void
    onRemove: () => void
  }) {
    return (
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <span className="text-sm text-slate-400 w-5 shrink-0 text-right">{index + 1}.</span>
        <Input
          value={item.text}
          onChange={e => onChange({ text: e.target.value })}
          placeholder={placeholder}
          className="flex-1 text-sm h-9 min-w-0"
        />
        {/* Status toggle pills */}
        <div className="flex gap-1 shrink-0">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ status: item.status === s ? undefined : s })}
              className={cn(
                'text-xs px-2 py-1 rounded border whitespace-nowrap transition-colors',
                item.status === s
                  ? STATUS_PILL_ACTIVE[s]
                  : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        {/* Size pills */}
        <div className="flex gap-1 shrink-0">
          {SIZE_OPTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ size: s })}
              className={cn(
                'text-xs font-semibold w-7 h-7 rounded border transition-colors',
                item.size === s
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-300 hover:text-red-400 shrink-0"
          aria-label="Remove"
        >
          <Trash2 size={14} />
        </button>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      {/* Wide modal gives the status + size pills enough horizontal room. */}
      {/* flex-col + max-h lets us give the header/footer sticky positions while
          the middle section scrolls independently.                            */}
      <DialogContent className="sm:max-w-[880px] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* ── Sticky header ─────────────────────────────────────────────────── */}
        <div className="shrink-0 px-8 pt-7 pb-5 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Design Pulse — {member.name}
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">{formatWeekOf(weekOf)}</p>
            </div>
          </div>
          {/* Copy from last week — outlined button with icon */}
          {previousPulse && (
            <button
              onClick={copyFromLastWeek}
              className="mt-3 flex items-center gap-2 text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-medium w-fit transition-colors"
            >
              <Copy size={13} />
              Copy from last week
            </button>
          )}
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

        {/* ── 1. Workload Sentiment ───────────────────────────────────────────
            Five card-buttons. The active card gets a colored border + number;
            inactive cards are white with a light gray border.                */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Workload Sentiment
          </p>
          <div className="grid grid-cols-5 gap-2">
            {([1, 2, 3, 4, 5] as const).map(n => {
              const col = SENTIMENT_COLORS[n]
              const active = form.workloadSentiment === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, workloadSentiment: n }))}
                  className={cn(
                    'flex flex-col items-center gap-2 px-2 py-5 rounded-xl border-2 text-center transition-all',
                    active
                      ? `${col.bg} border-current`
                      : 'bg-white border-slate-200 hover:border-slate-300',
                  )}
                >
                  <span className={cn('text-3xl font-bold leading-none', active ? col.text : 'text-slate-300')}>
                    {n}
                  </span>
                  <span className={cn('text-[10px] leading-tight', active ? col.text : 'text-slate-400')}>
                    {SENTIMENT_LABELS[n]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 2. Current Priorities ────────────────────────────────────────────
            Each row: number · text input · status pills · size pills · delete */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Current Priorities
          </p>
          <div className="space-y-2">
            {form.currentPriorities.map((p, i) => (
              <PriorityRow
                key={i}
                item={p}
                index={i}
                placeholder="Current priority description..."
                onChange={patch => updatePriorityField('currentPriorities', i, patch)}
                onRemove={() => removePriorityField('currentPriorities', i)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => addPriorityField('currentPriorities')}
            className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700"
          >
            <Plus size={14} /> Add current priority
          </button>
        </div>

        {/* ── 3. Upcoming Priorities ──────────────────────────────────────────
            Same layout as Current Priorities — status + size pills included.  */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Upcoming Priorities
          </p>
          <div className="space-y-2">
            {form.upcoming.map((p, i) => (
              <PriorityRow
                key={i}
                item={p}
                index={i}
                placeholder="Upcoming priority description..."
                onChange={patch => updatePriorityField('upcoming', i, patch)}
                onRemove={() => removePriorityField('upcoming', i)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => addPriorityField('upcoming')}
            className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700"
          >
            <Plus size={14} /> Add upcoming priority
          </button>
        </div>

        {/* ── 4. Personal Objectives ──────────────────────────────────────────
            Individual growth / development goals. Text-only rows, no pills.  */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Personal Objectives
          </p>
          <div className="space-y-2">
            {form.personalObjectives.map((v, i) => (
              <SimpleRow
                key={i}
                value={v}
                index={i}
                placeholder="Personal objective description..."
                onChange={val => updateSimple('personalObjectives', i, val)}
                onRemove={() => removeSimple('personalObjectives', i)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => addSimple('personalObjectives')}
            className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700"
          >
            <Plus size={14} /> Add personal objective
          </button>
        </div>

        {/* ── 5. Team Objectives ──────────────────────────────────────────────
            Shared team-level OKRs or commitments. Text-only rows.            */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Team Objectives
          </p>
          <div className="space-y-2">
            {form.teamObjectives.map((v, i) => (
              <SimpleRow
                key={i}
                value={v}
                index={i}
                placeholder="Team objective description..."
                onChange={val => updateSimple('teamObjectives', i, val)}
                onRemove={() => removeSimple('teamObjectives', i)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => addSimple('teamObjectives')}
            className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700"
          >
            <Plus size={14} /> Add team objective
          </button>
        </div>

        {/* ── 6. Development Focus / Desired Project Types ─────────────────── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Development Focus / Desired Project Types
          </p>
          <div className="space-y-2">
            {form.developmentFocus.map((p, i) => (
              <SimpleRow
                key={i}
                value={p.text}
                index={i}
                placeholder="Development focus description..."
                onChange={val => updateDevFocus(i, val)}
                onRemove={() => removeDevFocus(i)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={addDevFocus}
            className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700"
          >
            <Plus size={14} /> Add development focus
          </button>
        </div>

        {/* ── 7. Side Quests ──────────────────────────────────────────────────
            Stretch goals or exploratory work. Text-only rows.                */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Side Quests
          </p>
          <div className="space-y-2">
            {form.sideQuests.map((v, i) => (
              <SimpleRow
                key={i}
                value={v}
                index={i}
                placeholder="Side quest description..."
                onChange={val => updateSimple('sideQuests', i, val)}
                onRemove={() => removeSimple('sideQuests', i)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => addSimple('sideQuests')}
            className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700"
          >
            <Plus size={14} /> Add side quest
          </button>
        </div>

        </div>

        {/* ── Sticky footer — always visible, never scrolls out of view ─────── */}
        <div className="shrink-0 px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
            Save Pulse
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Pulse card ────────────────────────────────────────────────────────────
// Compact read-only view of one member's weekly pulse.
// Shows sentiment bar, priorities with size badges, upcoming, focus chips,
// and a collapsible objectives accordion.

function PulseCard({
  member,
  pulse,
  onEdit,
}: {
  member: Member
  pulse?: WeeklyPulse
  onEdit: () => void
}) {
  const av = avatarColor(member.name)

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!pulse) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0', av.bg, av.text)}>
            {member.avatarInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{member.name}</p>
            <p className="text-xs text-slate-400 truncate">{member.role}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0 text-xs h-7 px-2">
            <Plus size={12} className="mr-1" /> Add Pulse
          </Button>
        </div>
        <p className="text-xs text-slate-400 italic text-center py-2">No pulse submitted for this week</p>
      </div>
    )
  }

  const col = SENTIMENT_COLORS[pulse.workloadSentiment]

  // Derive flat lists from legacy ObjectiveArea data for cards that predate the
  // new flat fields — so old seed data still renders meaningful content.
  const personalObjectives = pulse.personalObjectives?.filter(s => s.trim())
    ?? pulse.objectives.flatMap(o => o.objectives).filter(s => s.trim())
  const teamObjectives = pulse.teamObjectives?.filter(s => s.trim()) ?? []
  const sideQuests = pulse.sideQuests?.filter(s => s.trim())
    ?? pulse.objectives.flatMap(o => o.sideQuests).filter(s => s.trim())
  const devFocus = pulse.developmentFocus.map(f => f.text).filter(s => s.trim())

  /** A compact numbered-list section used for plain-text items. */
  function TextSection({ label, items }: { label: string; items: string[] }) {
    if (items.length === 0) return null
    return (
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
        <ol className="space-y-1">
          {items.map((text, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              <span className="text-slate-400 shrink-0 w-4 text-right">{i + 1}.</span>
              <span className="flex-1 text-slate-700 dark:text-slate-300 leading-snug">{text}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  /** A priority list with a status badge and size badge on each row. */
  function PrioritySection({ label, items }: { label: string; items: PriorityItem[] }) {
    if (items.length === 0) return null
    return (
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
        <ol className="space-y-1.5">
          {items.map((p, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              <span className="text-slate-400 shrink-0 w-4 text-right mt-px">{i + 1}.</span>
              <span className="flex-1 text-slate-700 dark:text-slate-300 leading-snug">{p.text}</span>
              {p.status && (
                <span className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0',
                  STATUS_BADGE[p.status],
                )}>
                  {p.status}
                </span>
              )}
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 dark:bg-slate-600 text-white shrink-0">
                {p.size}
              </span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-4 flex flex-col gap-3.5">
      {/* ── Header: avatar + name + role + edit pencil ──────────────────────── */}
      <div className="flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0', av.bg, av.text)}>
          {member.avatarInitials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{member.name}</p>
          <p className="text-xs text-slate-400 truncate">{member.role}</p>
        </div>
        <button
          onClick={onEdit}
          className="text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 transition-colors shrink-0 p-1"
          title="Edit pulse"
        >
          <Pencil size={14} />
        </button>
      </div>

      {/* ── Sentiment bar ────────────────────────────────────────────────────
          Filled segments + label text, colored to match the sentiment level.  */}
      <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', col.bg)}>
        <div className="flex gap-1 flex-1">
          {[1, 2, 3, 4, 5].map(n => (
            <div
              key={n}
              className={cn('h-2 flex-1 rounded-full', n <= pulse.workloadSentiment ? col.bar : 'bg-white/60')}
            />
          ))}
        </div>
        <span className={cn('text-xs font-semibold shrink-0', col.text)}>
          {pulse.workloadSentiment} — {SENTIMENT_LABELS[pulse.workloadSentiment]}
        </span>
      </div>

      {/* ── Priority and objective sections ─────────────────────────────────── */}
      <PrioritySection label="Current Priorities" items={pulse.currentPriorities} />
      <PrioritySection label="Upcoming Priorities" items={pulse.upcoming} />
      <TextSection label="Personal Objectives" items={personalObjectives} />
      <TextSection label="Team Objectives" items={teamObjectives} />
      <TextSection label="Development Focus" items={devFocus} />
      <TextSection label="Side Quests" items={sideQuests} />
    </div>
  )
}

// ─── Pulse analytics ───────────────────────────────────────────────────────
// Aggregates WeeklyPulse data across the team over a rolling time window to
// surface sentiment trends, submission health, and development interests.

function PulseAnalytics({
  members,
  weeklyPulses,
  managerName,
}: {
  members: Member[]
  weeklyPulses: WeeklyPulse[]
  managerName: string
}) {
  const [windowWeeks, setWindowWeeks] = useState<4 | 8 | 12>(8)

  // Build an ordered list of ISO Monday dates covering the rolling window,
  // from oldest to most recent. We start from the most recent past Monday.
  const weekDates = useMemo(() => {
    const result: string[] = []
    const now = new Date()
    const day = now.getDay()
    const daysBack = day === 0 ? 6 : day - 1  // days since Monday
    const latestMonday = new Date(now)
    latestMonday.setDate(now.getDate() - daysBack)
    for (let i = windowWeeks - 1; i >= 0; i--) {
      const d = new Date(latestMonday)
      d.setDate(latestMonday.getDate() - i * 7)
      result.push(d.toISOString().slice(0, 10))
    }
    return result
  }, [windowWeeks])

  // Two-level map: memberId → weekOf → WeeklyPulse for O(1) lookups.
  const pulseMap = useMemo(() => {
    const teamIds = new Set(members.map(m => m.id))
    const weekSet = new Set(weekDates)
    const map = new Map<string, Map<string, WeeklyPulse>>()
    weeklyPulses
      .filter(p => teamIds.has(p.memberId) && weekSet.has(p.weekOf))
      .forEach(p => {
        if (!map.has(p.memberId)) map.set(p.memberId, new Map())
        map.get(p.memberId)!.set(p.weekOf, p)
      })
    return map
  }, [weeklyPulses, members, weekDates])

  // Per-week aggregates used for the trend and submission charts.
  const weekStats = useMemo(() => weekDates.map(wk => {
    const submitted = members.filter(m => pulseMap.get(m.id)?.has(wk))
    const sentiments = submitted.map(m => pulseMap.get(m.id)!.get(wk)!.workloadSentiment)
    const avg = sentiments.length > 0
      ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
      : null
    return {
      weekOf: wk,
      label: new Date(wk + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      submitted: submitted.length,
      total: members.length,
      missing: members.length - submitted.length,
      avgSentiment: avg,
      overloaded: sentiments.filter(s => s >= 4).length,
    }
  }), [weekDates, members, pulseMap])

  // Sentiment distribution for the most recent week — used in the horizontal bar chart.
  const latestWeek = weekDates[weekDates.length - 1]
  const latestStats = weekStats[weekStats.length - 1]

  const sentimentDistColors = ['#60a5fa', '#38bdf8', '#22c55e', '#f59e0b', '#ef4444']
  const sentimentDist = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]  // index 0 = level 1, etc.
    members.forEach(m => {
      const p = pulseMap.get(m.id)?.get(latestWeek)
      if (p) counts[p.workloadSentiment - 1]++
    })
    return ([1, 2, 3, 4, 5] as const).map((n, idx) => ({
      label: SENTIMENT_LABELS[n],
      value: counts[idx],
      fill: sentimentDistColors[idx],
    }))
  }, [members, pulseMap, latestWeek])

  // Development focus frequency — counts how often each focus text appears
  // across all members and all weeks in the window, sorted by frequency.
  const devFocusFreq = useMemo(() => {
    const freq = new Map<string, number>()
    weekDates.forEach(wk => {
      members.forEach(m => {
        const pulse = pulseMap.get(m.id)?.get(wk)
        if (!pulse) return
        pulse.developmentFocus.forEach(item => {
          const key = item.text.trim()
          if (key) freq.set(key, (freq.get(key) ?? 0) + 1)
        })
      })
    })
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  }, [weekDates, members, pulseMap])

  // Chart data shapes for recharts.
  const trendData = weekStats.map(w => ({
    label: w.label,
    avg: w.avgSentiment !== null ? parseFloat(w.avgSentiment.toFixed(2)) : null,
  }))

  const submissionData = weekStats.map(w => ({
    label: w.label,
    Submitted: w.submitted,
    Missing: w.missing,
  }))

  const noMembers = members.length === 0

  return (
    <div className="space-y-6">
      {/* Time window selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Time window</span>
        {([4, 8, 12] as const).map(n => (
          <button
            key={n}
            onClick={() => setWindowWeeks(n)}
            className={cn(
              'text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors',
              windowWeeks === n
                ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400',
            )}
          >
            {n} weeks
          </button>
        ))}
        {managerName && (
          <span className="text-xs text-slate-400 ml-2">
            {managerName}'s team · {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {noMembers ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <TrendingUp size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No team members to analyze.</p>
        </div>
      ) : (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              label="Avg sentiment this week"
              value={latestStats.avgSentiment !== null ? latestStats.avgSentiment.toFixed(1) : '—'}
              icon={<Smile size={18} />}
              iconColor={
                !latestStats.avgSentiment ? 'bg-slate-100 text-slate-400' :
                latestStats.avgSentiment <= 2 ? 'bg-blue-100 text-blue-600' :
                latestStats.avgSentiment <= 3.5 ? 'bg-green-100 text-green-600' :
                'bg-amber-100 text-amber-600'
              }
            />
            <StatCard
              label="Submitted this week"
              value={`${latestStats.submitted} / ${latestStats.total}`}
              icon={<Activity size={18} />}
              iconColor={
                latestStats.submitted === latestStats.total && latestStats.total > 0
                  ? 'bg-green-100 text-green-600'
                  : 'bg-amber-100 text-amber-600'
              }
            />
            <StatCard
              label="High workload (4–5) this week"
              value={latestStats.overloaded}
              icon={<AlertCircle size={18} />}
              iconColor={latestStats.overloaded > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}
              cardTint={latestStats.overloaded > 0 ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20' : undefined}
            />
          </div>

          {/* ── Trend + submission charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Avg sentiment trend over the window */}
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Team Avg Sentiment — {windowWeeks}w Trend
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    formatter={(v) => [(v as number | null)?.toFixed(1) ?? '—', 'Avg sentiment']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  {/* Green reference line at 3 = "Just right" */}
                  <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 2" strokeOpacity={0.5} />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#4471b7"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#4471b7' }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Stacked bar showing submitted vs missing per week */}
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Submission Rate — {windowWeeks}w
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={submissionData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="Submitted" stackId="a" fill="#22c55e" />
                  <Bar dataKey="Missing" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Sentiment heatmap — member × week grid ── */}
          {/* Each cell is colored by the member's sentiment for that week.
              Gray means no submission. Scroll horizontally for large windows. */}
          <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 overflow-x-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Sentiment Heatmap</p>
            <div className="min-w-max">
              {/* Column headers: week dates */}
              <div className="flex gap-1 mb-1.5 pl-[148px]">
                {weekDates.map(wk => (
                  <div key={wk} className="w-[54px] shrink-0 text-center text-[9px] font-medium text-slate-400 leading-tight">
                    {new Date(wk + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                ))}
              </div>
              {/* One row per member */}
              {members.map(m => (
                <div key={m.id} className="flex gap-1 mb-1 items-center">
                  <div className="w-[144px] shrink-0 pr-2 text-right">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate block">{m.name}</span>
                  </div>
                  {weekDates.map(wk => {
                    const pulse = pulseMap.get(m.id)?.get(wk)
                    const s = pulse?.workloadSentiment
                    const col = s ? SENTIMENT_COLORS[s] : null
                    // Build border color from the bg color class, e.g. bg-green-50 → border-green-200
                    const borderCls = col
                      ? col.bg.replace('bg-', 'border-').replace('-50', '-200')
                      : 'border-transparent'
                    return (
                      <div
                        key={wk}
                        title={s ? `${m.name}: ${SENTIMENT_LABELS[s]} (${s})` : `${m.name}: No submission`}
                        className={cn(
                          'w-[54px] h-[30px] shrink-0 rounded-md flex items-center justify-center text-xs font-bold border',
                          col ? `${col.bg} ${col.text} ${borderCls}` : 'bg-slate-100 dark:bg-slate-700/40 text-slate-300 dark:text-slate-600',
                        )}
                      >
                        {s ?? '—'}
                      </div>
                    )
                  })}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 pl-[148px]">
                {([1, 2, 3, 4, 5] as const).map(n => (
                  <div key={n} className="flex items-center gap-1">
                    <div className={cn('w-4 h-4 rounded', SENTIMENT_COLORS[n].bar)} />
                    <span className="text-[10px] text-slate-400">{n} — {SENTIMENT_LABELS[n].split(' — ')[0]}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700" />
                  <span className="text-[10px] text-slate-400">No data</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Workload distribution + Dev focus ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Horizontal bar: how many members at each sentiment level this week */}
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Workload Distribution — {new Date(latestWeek + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
              {latestStats.submitted === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-10">No submissions for this week.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={sentimentDist}
                    layout="vertical"
                    margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                  >
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Members" radius={[0, 4, 4, 0]}>
                      {sentimentDist.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Development focus frequency — aggregated tags with counts */}
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Development Focus — {windowWeeks}w Frequency
              </p>
              {devFocusFreq.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-10">
                  No development focus entries in this window.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {devFocusFreq.map(([text, count]) => (
                    <div
                      key={text}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800"
                    >
                      <span className="text-xs font-medium text-violet-700 dark:text-violet-300">{text}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-200">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Pulse page ────────────────────────────────────────────────────────────

export function PulsePage() {
  const { members, weeklyPulses, addPulse, updatePulse } = usePortfolioStore()
  const { activeMemberId } = useViewStore()

  const [weekOf, setWeekOf] = useState(getDefaultWeekOf)
  const [viewMode, setViewMode] = useState<'mine' | 'team' | 'analytics'>('mine')
  const [editTarget, setEditTarget] = useState<{ member: Member; pulse?: WeeklyPulse } | null>(null)
  const [managerFilter, setManagerFilter] = useState<string>('')
  // Track which history pulse IDs are expanded in My Pulse view.
  const [historyExpanded, setHistoryExpanded] = useState<Set<string>>(new Set())

  // Resolve active member — null in admin mode.
  const activeMember = useMemo(
    () => activeMemberId ? members.find(m => m.id === activeMemberId) ?? null : null,
    [activeMemberId, members],
  )

  // All members who have at least one direct report.
  const managers = useMemo(
    () => members.filter(m => members.some(r => r.reportsTo === m.name)),
    [members],
  )

  const viewedManager = useMemo((): Member | null => {
    if (activeMember) return activeMember
    if (managerFilter) return members.find(m => m.id === managerFilter) ?? null
    return managers[0] ?? null
  }, [activeMember, managers, managerFilter, members])

  const directReports = useMemo(
    () => viewedManager ? getDirectReports(viewedManager, members) : [],
    [viewedManager, members],
  )

  const weekPulses = useMemo(
    () => weeklyPulses.filter(p => p.weekOf === weekOf),
    [weeklyPulses, weekOf],
  )

  // O(1) pulse lookup for the current week.
  const pulseByMember = useMemo(() => {
    const map = new Map<string, WeeklyPulse>()
    weekPulses.forEach(p => map.set(p.memberId, p))
    return map
  }, [weekPulses])

  // Prior-week lookup for "copy from last week".
  const prevWeekOf = shiftWeek(weekOf, -1)
  const prevPulseByMember = useMemo(() => {
    const map = new Map<string, WeeklyPulse>()
    weeklyPulses.filter(p => p.weekOf === prevWeekOf).forEach(p => map.set(p.memberId, p))
    return map
  }, [weeklyPulses, prevWeekOf])

  // Team stats for the stat cards.
  const teamStats = useMemo(() => {
    if (directReports.length === 0) return null
    const submitted = directReports.filter(m => pulseByMember.has(m.id))
    const avgSentiment = submitted.length > 0
      ? submitted.reduce((sum, m) => sum + (pulseByMember.get(m.id)?.workloadSentiment ?? 3), 0) / submitted.length
      : 0
    const overloaded = submitted.filter(m => (pulseByMember.get(m.id)?.workloadSentiment ?? 0) >= 4).length
    return { submitted: submitted.length, total: directReports.length, avgSentiment, overloaded }
  }, [directReports, pulseByMember])

  const hasDirectReports = directReports.length > 0

  // ── My Pulse data ──────────────────────────────────────────────────────────
  // All pulses for the active member sorted newest → oldest. Used to build the
  // history timeline and workload trend chart on the My Pulse tab.
  const myPulses = useMemo(() => {
    if (!activeMember) return []
    return weeklyPulses
      .filter(p => p.memberId === activeMember.id)
      .sort((a, b) => b.weekOf.localeCompare(a.weekOf))
  }, [activeMember, weeklyPulses])

  // Past entries excluding the currently-selected week (shown separately at top).
  const myHistory = useMemo(
    () => myPulses.filter(p => p.weekOf !== weekOf),
    [myPulses, weekOf],
  )

  // Chart data: last 12 available weeks sorted oldest → newest for left-to-right display.
  const myTrendData = useMemo(() => {
    return [...myPulses]
      .slice(0, 12)
      .reverse()
      .map(p => ({
        weekLabel: new Date(p.weekOf + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sentiment: p.workloadSentiment,
        id: p.id,
      }))
  }, [myPulses])

  // Analytics and Team Pulse tabs are only shown when the user has reports or is in admin mode.
  const viewOptions = [
    { value: 'mine', label: 'My Pulse' },
    ...(hasDirectReports || activeMemberId === null ? [
      { value: 'team', label: 'Team Pulse' },
      { value: 'analytics', label: 'Analytics' },
    ] : []),
  ]

  function openEdit(member: Member) {
    setEditTarget({ member, pulse: pulseByMember.get(member.id) })
  }

  function handleSave(data: Omit<WeeklyPulse, 'id' | 'updatedAt'>) {
    const existing = weeklyPulses.find(p => p.memberId === data.memberId && p.weekOf === data.weekOf)
    if (existing) updatePulse(existing.id, data)
    else addPulse(data)
  }

  return (
    <div className="px-4 pt-6 pb-8 md:px-8 md:pt-8 space-y-5 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pulse</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          Weekly status — updated every Friday for the coming week
        </p>
      </div>

      {/* View toggle + week nav on the same row */}
      <div className="flex flex-wrap items-center gap-3">
        {viewOptions.length > 1 && (
          <SegmentedControl
            options={viewOptions}
            value={viewMode}
            onChange={v => setViewMode(v as 'mine' | 'team' | 'analytics')}
          />
        )}
        {activeMemberId === null && (viewMode === 'team' || viewMode === 'analytics') && managers.length > 0 && (
          <select
            value={managerFilter || (managers[0]?.id ?? '')}
            onChange={e => setManagerFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            {managers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        {/* Week navigator — hidden on Analytics which has its own time window control */}
        {viewMode !== 'analytics' && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setWeekOf(w => shiftWeek(w, -1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700 transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 min-w-[180px] text-center">
              {formatWeekOf(weekOf)}
            </span>
            <button
              onClick={() => setWeekOf(w => shiftWeek(w, 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700 transition-colors"
              aria-label="Next week"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Team Pulse view */}
      {viewMode === 'team' && (
        <>
          {teamStats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard
                label="Pulses submitted this week"
                value={`${teamStats.submitted} / ${teamStats.total}`}
                icon={<Activity size={18} />}
                iconColor={teamStats.submitted === teamStats.total ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}
              />
              <StatCard
                label="Avg workload sentiment"
                value={teamStats.submitted > 0 ? teamStats.avgSentiment.toFixed(1) : '—'}
                icon={<Smile size={18} />}
                iconColor={
                  teamStats.avgSentiment <= 2 ? 'bg-blue-100 text-blue-600' :
                  teamStats.avgSentiment <= 3.5 ? 'bg-green-100 text-green-600' :
                  'bg-amber-100 text-amber-600'
                }
              />
              <StatCard
                label="Members at high capacity (4–5)"
                value={teamStats.overloaded}
                icon={<AlertCircle size={18} />}
                iconColor={teamStats.overloaded > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}
                cardTint={teamStats.overloaded > 0 ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20' : undefined}
              />
            </div>
          )}

          {viewedManager && (
            <div className="flex items-center gap-2">
              <Users size={14} className="text-slate-400" />
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Direct reports of <span className="font-semibold text-slate-700 dark:text-slate-200">{viewedManager.name}</span>
                {' '}({directReports.length} member{directReports.length !== 1 ? 's' : ''})
              </span>
            </div>
          )}

          {directReports.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Users size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No direct reports found.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {directReports.map(member => (
              <PulseCard
                key={member.id}
                member={member}
                pulse={pulseByMember.get(member.id)}
                onEdit={() => openEdit(member)}
              />
            ))}
          </div>
        </>
      )}

      {/* My Pulse view — three zones: this week, workload trend, history */}
      {viewMode === 'mine' && (
        <>
          {!activeMember ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <Activity size={40} className="opacity-30" />
              <p className="text-sm">Switch to a member view to see your pulse.</p>
              <p className="text-xs text-slate-300">Use the member selector in the top bar.</p>
            </div>
          ) : (
            <div className="max-w-2xl space-y-6">

              {/* ── This week ── */}
              <section>
                <PulseCard
                  member={activeMember}
                  pulse={pulseByMember.get(activeMember.id)}
                  onEdit={() => openEdit(activeMember)}
                />
              </section>

              {/* ── Workload trend ── */}
              {myTrendData.length > 1 && (
                <section>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Workload Trend
                  </p>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-4">
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={myTrendData} margin={{ top: 8, right: 8, bottom: 0, left: -28 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                          dataKey="weekLabel"
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[1, 5]}
                          ticks={[1, 2, 3, 4, 5]}
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        {/* Reference band for "just right" zone (3) */}
                        <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.4} />
                        <Tooltip
                          formatter={(val) => { const n = val as number; return [`${n} — ${SENTIMENT_LABELS[n]}`, 'Workload'] }}
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                          labelStyle={{ fontWeight: 600, marginBottom: 2 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="sentiment"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={(props: { cx?: number; cy?: number; payload: { sentiment: number } }) => {
                            // SENTIMENT_COLORS unused here — color is derived from value range directly.
                            const fill = props.payload.sentiment <= 2 ? '#38bdf8'
                              : props.payload.sentiment === 3 ? '#22c55e'
                              : props.payload.sentiment === 4 ? '#fbbf24' : '#ef4444'
                            return (
                              <circle
                                key={`dot-${props.cx}-${props.cy}`}
                                cx={props.cx}
                                cy={props.cy}
                                r={4}
                                fill={fill}
                                stroke="#fff"
                                strokeWidth={2}
                              />
                            )
                          }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    {/* Sentiment legend */}
                    <div className="flex items-center justify-center gap-4 mt-2 flex-wrap">
                      {([1, 2, 3, 4, 5] as const).map(n => (
                        <span key={n} className={cn('text-[10px] font-medium', SENTIMENT_COLORS[n].text)}>
                          {n} — {SENTIMENT_LABELS[n]}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* ── History ── */}
              {myHistory.length > 0 && (
                <section>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    History
                  </p>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
                    {myHistory.map(pulse => {
                      const col = SENTIMENT_COLORS[pulse.workloadSentiment]
                      const isOpen = historyExpanded.has(pulse.id)
                      return (
                        <div key={pulse.id}>
                          {/* Row header — click to expand */}
                          <button
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
                            onClick={() => setHistoryExpanded(prev => {
                              const next = new Set(prev)
                              isOpen ? next.delete(pulse.id) : next.add(pulse.id)
                              return next
                            })}
                          >
                            {/* Week label */}
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 min-w-[130px]">
                              {formatWeekOf(pulse.weekOf)}
                            </span>
                            {/* Sentiment pill */}
                            <span className={cn(
                              'text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0',
                              col.bg, col.text,
                            )}>
                              {pulse.workloadSentiment} — {SENTIMENT_LABELS[pulse.workloadSentiment]}
                            </span>
                            {/* Priority preview (collapsed only) */}
                            {!isOpen && pulse.currentPriorities.length > 0 && (
                              <span className="text-xs text-slate-400 truncate flex-1 hidden sm:block">
                                {pulse.currentPriorities[0].text}
                                {pulse.currentPriorities.length > 1 && ` +${pulse.currentPriorities.length - 1} more`}
                              </span>
                            )}
                            <span className="ml-auto shrink-0">
                              <ChevronRight size={14} className={cn('text-slate-300 transition-transform', isOpen && 'rotate-90')} />
                            </span>
                          </button>

                          {/* Expanded detail */}
                          {isOpen && (
                            <div className="px-4 pb-4 pt-1 space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
                              {/* Edit link */}
                              <div className="flex justify-end">
                                <button
                                  className="text-[11px] text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                                  onClick={() => {
                                    // Navigate to this week in the header and open the edit dialog.
                                    setWeekOf(pulse.weekOf)
                                    setEditTarget({ member: activeMember, pulse })
                                  }}
                                >
                                  <Pencil size={11} /> Edit
                                </button>
                              </div>

                              {/* Priorities */}
                              {pulse.currentPriorities.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Priorities</p>
                                  <ol className="space-y-1">
                                    {pulse.currentPriorities.map((p, i) => (
                                      <li key={i} className="flex items-start gap-1.5 text-xs">
                                        <span className="text-slate-400 shrink-0 w-3 mt-px">{i + 1}.</span>
                                        <span className="flex-1 text-slate-700 dark:text-slate-200 leading-tight">{p.text}</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 shrink-0">{p.size}</span>
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}

                              {/* Upcoming */}
                              {pulse.upcoming.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Upcoming</p>
                                  <ul className="space-y-0.5">
                                    {pulse.upcoming.map((item, i) => (
                                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                                        <span className="text-slate-300 mt-0.5 shrink-0">·</span>
                                        <span className="leading-tight">{item.text}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Dev focus */}
                              {pulse.developmentFocus.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-1">Focus</span>
                                  {pulse.developmentFocus.map((f, i) => (
                                    <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">
                                      {f.text}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Empty history state */}
              {myPulses.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                  <TrendingUp size={32} className="opacity-30" />
                  <p className="text-sm">No pulse history yet.</p>
                  <p className="text-xs text-slate-300">Fill in this week's pulse to get started.</p>
                </div>
              )}

            </div>
          )}
        </>
      )}

      {/* Analytics view — uses the same manager scoping as Team Pulse */}
      {viewMode === 'analytics' && (
        <PulseAnalytics
          members={directReports}
          weeklyPulses={weeklyPulses}
          managerName={viewedManager?.name ?? ''}
        />
      )}

      {/* Edit dialog */}
      {editTarget && (
        <PulseEditDialog
          open
          member={editTarget.member}
          pulse={editTarget.pulse}
          previousPulse={prevPulseByMember.get(editTarget.member.id)}
          weekOf={weekOf}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}
