/**
 * PulseEditDialog — wide modal for creating or editing a weekly pulse entry.
 *
 * Extracted from PulsePage so both PulsePage and ProfilePage can open the
 * same edit experience without duplicating the form logic.
 *
 * Sections (in order):
 *   1. Workload sentiment (1–5 card buttons)
 *   2. Current priorities (text + status pills + S/M/L/XL size)
 *   3. Upcoming priorities (same shape)
 *   4. Personal objectives (text only)
 *   5. Team objectives (text only)
 *   6. Development focus / desired project types (text only)
 *   7. Side quests (text only)
 *
 * The "Copy from last week" button pre-fills all fields from `previousPulse`
 * so the user only has to change what's different.
 *
 * Also exports the shared constants and `formatWeekOf` helper so PulsePage
 * can import them from here instead of duplicating them.
 */

import { useState } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { WeeklyPulse, PriorityItem, ObjectiveArea, Member } from '@/types'

// ─── Shared constants ─────────────────────────────────────────────────────────
// Exported so PulsePage and ProfilePage can reference the same labels/colors
// without duplicating the definitions.

export const SENTIMENT_LABELS: Record<number, string> = {
  1: 'Send me something, anything',
  2: 'Light week',
  3: 'Just right',
  4: 'Busy week',
  5: 'Extremely busy, please no more!',
}

/** Tailwind classes for each sentiment level's card background, text, and bar fill. */
export const SENTIMENT_COLORS: Record<number, { bg: string; text: string; bar: string }> = {
  1: { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',   bar: 'bg-blue-400' },
  2: { bg: 'bg-sky-50 border-sky-200',     text: 'text-sky-700',    bar: 'bg-sky-400' },
  3: { bg: 'bg-green-50 border-green-200', text: 'text-green-700',  bar: 'bg-green-500' },
  4: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700',  bar: 'bg-amber-400' },
  5: { bg: 'bg-red-50 border-red-200',     text: 'text-red-700',    bar: 'bg-red-500' },
}

/** Size options for individual priority items. */
export const SIZE_OPTIONS = ['S', 'M', 'L', 'XL'] as const

/** Status options shown as toggle pills on each priority row. */
export const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Complete', 'Blocked'] as const

/** Active pill styles per status — used in the edit modal. */
export const STATUS_PILL_ACTIVE: Record<string, string> = {
  'Not Started': 'bg-slate-100 text-slate-700 border-slate-400',
  'In Progress': 'bg-blue-50 text-blue-600 border-blue-400',
  'Complete':    'bg-green-500 text-white border-green-500',
  'Blocked':     'bg-red-50 text-red-600 border-red-400',
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Format a weekOf ISO date string as "Week of June 15, 2026". */
export function formatWeekOf(weekOf: string): string {
  const d = new Date(weekOf + 'T12:00:00') // noon avoids TZ midnight rollback
  return 'Week of ' + d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ─── Form state ───────────────────────────────────────────────────────────────

export interface PulseFormState {
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

export function emptyForm(): PulseFormState {
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
export function pulseToForm(pulse: WeeklyPulse): PulseFormState {
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
export function cleanForm(form: PulseFormState): Omit<WeeklyPulse, 'id' | 'updatedAt' | 'memberId' | 'weekOf'> {
  return {
    workloadSentiment: form.workloadSentiment,
    currentPriorities: form.currentPriorities.filter(p => p.text.trim()),
    priorityTags: [],
    upcoming: form.upcoming.filter(p => p.text.trim()),
    developmentFocus: form.developmentFocus.filter(p => p.text.trim()),
    personalObjectives: form.personalObjectives.filter(s => s.trim()),
    teamObjectives: form.teamObjectives.filter(s => s.trim()),
    sideQuests: form.sideQuests.filter(s => s.trim()),
    objectives: form.objectives, // preserve legacy data untouched
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Wide edit modal for creating or updating a weekly pulse entry.
 * Designed for <1 minute completion.  "Copy from last week" pre-fills all
 * fields from `previousPulse` so the user only has to change what changed.
 */
export function PulseEditDialog({
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
