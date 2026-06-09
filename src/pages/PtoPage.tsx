/**
 * PTO Tracking page — Gantt-style calendar showing team member PTO blocks.
 *
 * Layout:
 *   - Stats bar: on PTO today | PTO blocks this quarter | upcoming in 14 days
 *   - Controls: zoom toggle (Year | Quarter | Month | Week) + domain/team/search filters
 *   - Scrollable timeline: sticky left column (domain → team → member) + amber PTO bars
 *
 * Zoom modes match the Planning (CapacityPlanner) page exactly:
 *   Year    — all 52 weeks, weekPx scales to fill container width
 *   Quarter — 13 weeks for the selected quarter, fill-to-fit weekPx
 *   Period  — 4-5 weeks for the selected period (fiscal month), fill-to-fit
 *   Week    — single week at maximum resolution; day-of-week row in headers
 *
 * Adding PTO:  click the "+" on a member row → Add PTO dialog (date range + note).
 * Deleting PTO: click an existing bar → confirm-delete dialog.
 *
 * The fiscal calendar is identical to the one used in CapacityPlannerPage
 * (Kroger 4-5-4 NRF, FY2026: Feb 1 2026 – Jan 31 2027).
 *
 * Route: /pto
 */

import { useState, useRef, useEffect, useMemo, createContext, useContext } from 'react'
import { CalendarOff, CalendarPlus, Trash2, Search, Users, Building2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { getCurrentQBounds } from '@/lib/fiscal'
import { avatarColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { PtoBlock, Member, Team, Domain } from '@/types'

// ─── Fiscal calendar (Kroger 4-5-4 NRF FY2026) ────────────────────────────
// Identical setup to CapacityPlannerPage — copy kept local so this page is
// self-contained and doesn't introduce a circular shared-constants file.

const FY_START = new Date('2026-02-01T00:00:00')

// 4-5-4 repeating period lengths across 4 quarters (P1–P12)
const PERIOD_WEEKS = [4, 5, 4,  4, 5, 4,  4, 5, 4,  4, 5, 4]

/** Fiscal years covered by this calendar. FY2026 is the base (week 0). */
const SUPPORTED_FY_YEARS = [2026, 2027, 2028]
const WEEKS_PER_FY = 52

interface FiscalWeek {
  index: number        // global 0-based week index (continuous across all years)
  date: Date
  periodIndex: number  // global 0-based period index
  quarterIndex: number // global 0-based quarter index
  weekInPeriod: number // 1-based position within the period (used for sparse week labels)
  fyYear: number       // which fiscal year this week belongs to (e.g. 2026)
}

interface FiscalPeriod {
  index: number
  label: string        // "P1" … "P12" (restarts each year)
  monthLabel: string   // abbreviated month name from the period's first week, e.g. "Feb"
  quarterIndex: number // global quarter index
  weekStart: number    // global first week index
  weekCount: number
  fyYear: number       // which fiscal year this period belongs to
}

interface FiscalQuarter {
  index: number
  label: string        // "Q1" … "Q4" (restarts each year)
  weekStart: number    // global first week index
  weekCount: number
  fyYear: number       // which fiscal year this quarter belongs to
}

/** One fiscal year entry — tracks the global week boundaries for each FY. */
interface FiscalYear {
  fyYear: number    // e.g. 2026
  weekStart: number // global week index of the first week in this FY
  weekCount: number // 52
}

/**
 * Build a multi-year 4-5-4 NRF fiscal calendar starting at FY_START (FY2026).
 * Each supported year is exactly WEEKS_PER_FY (52) weeks. Global week indices
 * are continuous: FY2026 = 0-51, FY2027 = 52-103, FY2028 = 104-155.
 */
function buildMultiYearCalendar(): {
  weeks: FiscalWeek[]
  periods: FiscalPeriod[]
  quarters: FiscalQuarter[]
  years: FiscalYear[]
} {
  const weeks: FiscalWeek[] = []
  const periods: FiscalPeriod[] = []
  const quarters: FiscalQuarter[] = []
  const years: FiscalYear[] = []

  let weekIndex = 0

  for (let yi = 0; yi < SUPPORTED_FY_YEARS.length; yi++) {
    const fyYear = SUPPORTED_FY_YEARS[yi]
    const yearWeekStart = weekIndex

    for (let qi = 0; qi < 4; qi++) {
      const qWeekStart = weekIndex
      // Global quarter index: unique across all years so filter/lookup is unambiguous
      const qGlobalIdx = yi * 4 + qi

      for (let pi = 0; pi < 3; pi++) {
        const pWeekStart = weekIndex
        const pGlobalIdx = yi * 12 + qi * 3 + pi
        const count = PERIOD_WEEKS[qi * 3 + pi]

        for (let w = 0; w < count; w++) {
          const date = new Date(FY_START)
          date.setDate(date.getDate() + weekIndex * 7)
          weeks.push({
            index: weekIndex,
            date,
            periodIndex: pGlobalIdx,
            quarterIndex: qGlobalIdx,
            weekInPeriod: w + 1,
            fyYear,
          })
          weekIndex++
        }

        // monthLabel derived from the period's first day — accurate for any year
        const periodStartDate = new Date(FY_START)
        periodStartDate.setDate(periodStartDate.getDate() + pWeekStart * 7)
        const monthLabel = periodStartDate.toLocaleDateString('en-US', { month: 'short' })

        periods.push({
          index: pGlobalIdx,
          label: `P${qi * 3 + pi + 1}`,
          monthLabel,
          quarterIndex: qGlobalIdx,
          weekStart: pWeekStart,
          weekCount: count,
          fyYear,
        })
      }

      quarters.push({
        index: qGlobalIdx,
        label: `Q${qi + 1}`,
        weekStart: qWeekStart,
        weekCount: 13,
        fyYear,
      })
    }

    years.push({
      fyYear,
      weekStart: yearWeekStart,
      weekCount: WEEKS_PER_FY,
    })
  }

  return { weeks, periods, quarters, years }
}

const { weeks: FY_WEEKS, periods: FY_PERIODS, quarters: FY_QUARTERS, years: FY_YEARS } =
  buildMultiYearCalendar()

/** Pixel width of the sticky left-column (member names). */
const LEFT_COL_W = 192

// ─── PTO chart context ────────────────────────────────────────────────────
// Distributes zoom-level state to all child bar/header components so they
// don't need the config passed as a prop through multiple layers.

interface PtoConfig {
  weekPx: number
  chartWidth: number
  visibleWeeks: FiscalWeek[]
  visiblePeriods: FiscalPeriod[]
  visibleQuarters: FiscalQuarter[]
  /** Index of first visible week in FY_WEEKS (used to align dateToX). */
  visibleOffset: number
  /** Pixel x of today inside the visible window, or -1 if outside. */
  todayXPos: number
  dateToX: (iso: string) => number
  /** Populated only in week zoom mode: the 7 individual days of the visible week. */
  weekDays?: { label: string; iso: string }[]
}

const PtoCtx = createContext<PtoConfig | null>(null)

function usePto(): PtoConfig {
  const ctx = useContext(PtoCtx)
  if (!ctx) throw new Error('usePto must be inside a PtoCtx.Provider')
  return ctx
}

// ─── Calendar math helpers ────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
}

/** Today's local ISO date string, e.g. "2026-06-04". */
function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * Returns the current fiscal year/quarter/week indices for the default state.
 * yearIdx — index into FY_YEARS (0 = FY2026, 1 = FY2027, etc.)
 * qIdx    — 0-3 within the year (Q1=0 … Q4=3)
 * wkIdx   — global week index in FY_WEEKS
 */
function currentFYInfo(): { yearIdx: number; qIdx: number; wkIdx: number } {
  const today = new Date()
  const wkIdx = FY_WEEKS.findIndex(w => {
    const end = new Date(w.date)
    end.setDate(end.getDate() + 7)
    return w.date <= today && today < end
  })
  const safeWkIdx = wkIdx >= 0 ? wkIdx : 0
  const wk = FY_WEEKS[safeWkIdx]
  const yearIdx = Math.max(0, FY_YEARS.findIndex(y => y.fyYear === wk.fyYear))
  const yearQuarters = FY_QUARTERS.filter(q => q.fyYear === wk.fyYear)
  const qIdx = Math.max(0, yearQuarters.findIndex(q => q.index === wk.quarterIndex))
  return { yearIdx, qIdx, wkIdx: safeWkIdx }
}

/** Repeating alternating-week stripe for grid lines. */
function makeStripe(weekPx: number): string {
  return `repeating-linear-gradient(90deg, transparent 0px, transparent ${weekPx}px, var(--gantt-stripe) ${weekPx}px, var(--gantt-stripe) ${weekPx * 2}px)`
}

// ─── PTO stat helpers ─────────────────────────────────────────────────────

/** True when [blockStart, blockEnd] contains `isoDate`. */
function ptoContainsDate(block: PtoBlock, isoDate: string): boolean {
  return block.startDate <= isoDate && block.endDate >= isoDate
}

/** True when the PTO block overlaps [qStart, qEnd). */
function ptoOverlapsRange(block: PtoBlock, from: string, to: string): boolean {
  return block.startDate < to && block.endDate >= from
}

// ─── Stat card ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 flex flex-col gap-1">
      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
    </div>
  )
}

// ─── Timeline headers ─────────────────────────────────────────────────────
// Renders quarter labels (top row) + period labels (middle) + week tick marks (bottom).
// In week zoom mode, an additional day-of-week row appears at the bottom, matching
// the layout used in CapacityPlannerPage's GanttHeaders.

function PtoHeaders() {
  const { weekPx, visibleWeeks, visiblePeriods, visibleQuarters, visibleOffset, weekDays } = usePto()
  // dayPx is the pixel width of each day column in week zoom mode.
  const dayPx = weekDays ? weekPx / 7 : 0

  return (
    <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 select-none">
      {/* Quarter labels — bold dark text for clear hierarchy. Label includes the
          calendar year derived from fyYear so multi-year views read "Q1 2026" etc. */}
      <div className="flex" style={{ height: 24 }}>
        {visibleQuarters.map(q => {
          const visibleWeekCount = visibleWeeks.filter(w => w.quarterIndex === q.index).length
          return (
            <div
              key={q.index}
              className="shrink-0 flex items-center px-2 border-r border-slate-200 text-[10px] font-bold"
              style={{
                width: visibleWeekCount * weekPx,
                background: q.index % 2 === 0 ? 'var(--gantt-q-even)' : 'var(--gantt-q-odd)',
                color: 'var(--gantt-q-text)',
              }}
            >
              {q.label} {q.fyYear}
            </div>
          )
        })}
      </div>

      {/* Period labels — show abbreviated month name (e.g. "Feb") for readability */}
      <div className="flex" style={{ height: 20 }}>
        {visiblePeriods.map(p => {
          const visibleWeekCount = visibleWeeks.filter(w => w.periodIndex === p.index).length
          if (visibleWeekCount === 0) return null
          return (
            <div
              key={p.label}
              className="shrink-0 flex items-center px-2 border-r border-slate-200 text-[10px] font-semibold"
              style={{
                width: visibleWeekCount * weekPx,
                background: p.index % 2 === 0 ? 'var(--gantt-p-even)' : 'var(--gantt-p-odd)',
                color: 'var(--gantt-p-text)',
              }}
            >
              {p.monthLabel}
            </div>
          )
        })}
      </div>

      {/* Week tick marks — near-white for a clean bar backdrop */}
      <div className="flex" style={{ height: 20 }}>
        {visibleWeeks.map(w => {
          const isFirst = w.index === visibleOffset
          const label = w.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return (
            <div
              key={w.index}
              className={cn(
                'shrink-0 flex items-center px-1 border-r border-slate-200 text-[9px] font-medium',
                isFirst && 'pl-2',
              )}
              style={{
                width: weekPx,
                background: w.index % 2 === 0 ? 'var(--gantt-w-even)' : 'var(--gantt-w-odd)',
                color: 'var(--gantt-w-text)',
              }}
            >
              {weekPx >= 60 || w.weekInPeriod === 1 ? label : ''}
            </div>
          )
        })}
      </div>

      {/* Day-of-week row — week zoom only; weekends get an indigo tint like Planning page */}
      {weekDays && (
        <div className="flex" style={{ height: 20 }}>
          {weekDays.map((day, i) => (
            <div
              key={day.iso}
              className="shrink-0 flex items-center px-1 border-r border-slate-200 text-[9px] font-semibold"
              style={{
                // All cells white; weekends use a lighter text color for distinction
                width: dayPx,
                background: '#ffffff',
                color: i >= 5 ? '#94a3b8' : 'var(--gantt-w-text)',
              }}
            >
              {day.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PTO bar ─────────────────────────────────────────────────────────────
// Amber bar rendered inside a member's row for a single PTO block.
// Clicking opens the delete-confirm dialog.

function PtoBarItem({
  block,
  onClick,
}: {
  block: PtoBlock
  onClick: () => void
}) {
  const { dateToX, chartWidth, weekPx } = usePto()

  const rawLeft  = dateToX(block.startDate)
  const rawRight = dateToX(block.endDate) + weekPx  // include the end day's week

  // Clamp so bars don't extend outside the visible window
  const left  = Math.max(0, rawLeft)
  const right = Math.min(chartWidth, rawRight)
  const width = right - left

  if (width <= 0) return null

  return (
    <div
      className="absolute top-1 bottom-1 flex items-center px-2 rounded cursor-pointer group"
      style={{ left, width, background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.45)' }}
      onClick={onClick}
      title={block.note || 'PTO'}
    >
      {/* Delete icon appears on hover */}
      <Trash2 size={10} className="shrink-0 text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity mr-1" />
      {width > 60 && (
        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 truncate">
          {block.note || 'PTO'}
        </span>
      )}
    </div>
  )
}

// ─── Member row ───────────────────────────────────────────────────────────
// One row per member: sticky left-side avatar/name + timeline with PTO bars.

function PtoMemberRow({
  member,
  blocks,
  onAdd,
  onDeleteBlock,
}: {
  member: Member
  blocks: PtoBlock[]
  onAdd: () => void
  onDeleteBlock: (block: PtoBlock) => void
}) {
  const { chartWidth, todayXPos, weekPx } = usePto()
  const { bg, text } = avatarColor(member.name)

  return (
    <div className="flex min-h-[44px] border-b border-slate-100 dark:border-slate-800 group/row">
      {/* Left label */}
      <div
        className="sticky left-0 z-10 flex items-center gap-2.5 px-3 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 shrink-0"
        style={{ width: LEFT_COL_W }}
      >
        <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', bg, text)}>
          {member.avatarInitials.slice(0, 2)}
        </div>
        <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1" title={member.name}>
          {member.name}
        </span>
        {/* Add PTO button — visible on row hover */}
        <button
          onClick={onAdd}
          className="shrink-0 p-1 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-300 hover:text-amber-500 opacity-0 group-hover/row:opacity-100 transition-all"
          title="Add PTO"
        >
          <CalendarPlus size={12} />
        </button>
      </div>

      {/* Timeline area */}
      <div
        className="relative flex-1"
        style={{
          width: chartWidth,
          minWidth: chartWidth,
          background: makeStripe(weekPx),
        }}
      >
        {/* Today marker */}
        {todayXPos >= 0 && todayXPos <= chartWidth && (
          <div
            className="absolute top-0 bottom-0 w-px bg-blue-400/50 dark:bg-blue-500/40 pointer-events-none"
            style={{ left: todayXPos }}
          />
        )}

        {/* PTO bars */}
        {blocks.map(b => (
          <PtoBarItem key={b.id} block={b} onClick={() => onDeleteBlock(b)} />
        ))}
      </div>
    </div>
  )
}

// ─── Team header row ──────────────────────────────────────────────────────

function TeamHeaderRow({ team }: { team: Team }) {
  const { chartWidth } = usePto()
  return (
    <div className="flex min-h-[28px] border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
      <div
        className="sticky left-0 z-10 flex items-center gap-2 px-3 bg-slate-50 dark:bg-slate-800/40 border-r border-slate-200 dark:border-slate-700 shrink-0"
        style={{ width: LEFT_COL_W }}
      >
        <Users size={11} className="shrink-0 text-slate-400 dark:text-slate-500" />
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">{team.name}</span>
      </div>
      <div style={{ width: chartWidth, minWidth: chartWidth }} />
    </div>
  )
}

// ─── Domain header row ────────────────────────────────────────────────────

function DomainHeaderRow({ domain }: { domain: Domain }) {
  const { chartWidth } = usePto()
  return (
    <div className="flex min-h-[32px] border-b border-slate-200 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/70">
      <div
        className="sticky left-0 z-10 flex items-center gap-2 px-3 bg-slate-100/60 dark:bg-slate-800/70 border-r border-slate-200 dark:border-slate-700 shrink-0"
        style={{ width: LEFT_COL_W }}
      >
        <Building2 size={11} className="shrink-0 text-violet-500 dark:text-violet-400" />
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider truncate">
          {domain.name}
        </span>
      </div>
      <div style={{ width: chartWidth, minWidth: chartWidth }} />
    </div>
  )
}

// ─── Add PTO dialog ───────────────────────────────────────────────────────
// Form to create a new PTO block for a given member.
// Pre-populates the member field; allows changing dates and adding a note.

function AddPtoDialog({
  open,
  memberId,
  memberName,
  onClose,
  onSave,
}: {
  open: boolean
  memberId: string
  memberName: string
  onClose: () => void
  onSave: (payload: Omit<PtoBlock, 'id'>) => void
}) {
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [note,      setNote]      = useState('')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStartDate('')
      setEndDate('')
      setNote('')
    }
  }, [open])

  function handleSave() {
    if (!startDate || !endDate) return
    onSave({ memberId, startDate, endDate, note })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add PTO — {memberName}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pto-start">Start date</Label>
              <Input
                id="pto-start"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pto-end">End date</Label>
              <Input
                id="pto-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pto-note">Note (optional)</Label>
            <Textarea
              id="pto-note"
              placeholder="Vacation, family leave, etc."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!startDate || !endDate} className="bg-amber-500 hover:bg-amber-600 text-white">
            Add PTO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

/**
 * Zoom modes for the PTO timeline — intentionally identical to CapacityPlannerPage
 * so the two calendars feel consistent when users switch between them.
 */
type ZoomMode = 'year' | 'quarter' | 'period' | 'week'

export function PtoPage() {
  const { domains, teams, members, ptoBlocks, addPto, deletePto } = usePortfolioStore()

  // ── Zoom state ─────────────────────────────────────────────────────────
  // Default to quarter view (matching Planning page behaviour).
  const [zoomMode,        setZoomMode]        = useState<ZoomMode>('quarter')
  // selectedYearIdx: which fiscal year is shown (0 = FY2026, 1 = FY2027, 2 = FY2028)
  const [selectedYearIdx, setSelectedYearIdx] = useState<number>(() => currentFYInfo().yearIdx)
  // selectedQIdx: 0-3 within the selected year (Q1=0 … Q4=3)
  const [selectedQIdx,    setSelectedQIdx]    = useState<number>(() => currentFYInfo().qIdx)
  // selectedPIdx tracks the active fiscal period (0-11) within the selected year.
  const [selectedPIdx,    setSelectedPIdx]    = useState<number>(0)
  // selectedWkIdx: global index across all years — defaults to current week
  const [selectedWkIdx,   setSelectedWkIdx]   = useState<number>(() => currentFYInfo().wkIdx)

  // ── Filter state ────────────────────────────────────────────────────────
  const [searchText,      setSearchText]      = useState('')
  const [filterDomainIds, setFilterDomainIds] = useState<string[]>([])
  const [filterTeamIds,   setFilterTeamIds]   = useState<string[]>([])

  // ── Dialog state ────────────────────────────────────────────────────────
  const [addDialog,    setAddDialog]    = useState<{ memberId: string; memberName: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PtoBlock | null>(null)

  // ── Container width measurement (for fill-to-fit weekPx) ────────────────
  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!scrollRef.current) return
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width)
    })
    ro.observe(scrollRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Derived chart config ─────────────────────────────────────────────────
  // Compute the visible date window + weekPx based on zoom mode and selected year.
  // Logic mirrors CapacityPlannerPage.ganttConfig so the two pages feel identical.
  // Scopes weeks/periods/quarters to the selected fiscal year before further
  // narrowing to quarter/period/week zoom windows within that year.
  const ptoConfig = useMemo<PtoConfig>(() => {
    // Available chart space (subtract left column)
    const available = containerWidth > LEFT_COL_W ? containerWidth - LEFT_COL_W : 0

    // Scope the calendar to the selected fiscal year first
    const fyYear = FY_YEARS[selectedYearIdx]
    const yearWeeks    = FY_WEEKS.filter(w => w.fyYear === fyYear.fyYear)
    const yearQuarters = FY_QUARTERS.filter(q => q.fyYear === fyYear.fyYear)
    const yearPeriods  = FY_PERIODS.filter(p => p.fyYear === fyYear.fyYear)

    let visibleWeeks: FiscalWeek[]
    let visibleOffset: number
    let weekPx: number
    let windowStart: Date

    if (zoomMode === 'year') {
      // Show entire selected fiscal year; fill to fit (min 40px so labels remain readable)
      visibleWeeks  = yearWeeks
      windowStart   = new Date(FY_START)
      windowStart.setDate(windowStart.getDate() + fyYear.weekStart * 7)
      visibleOffset = fyYear.weekStart
      weekPx = available > 0 ? Math.max(40, Math.floor(available / yearWeeks.length)) : 80
    } else if (zoomMode === 'quarter') {
      const q = yearQuarters[selectedQIdx] ?? yearQuarters[0]
      visibleWeeks  = yearWeeks.filter(w => w.quarterIndex === q.index)
      visibleOffset = q.weekStart
      windowStart   = new Date(FY_WEEKS[q.weekStart].date)
      weekPx = available > 0 ? Math.floor(available / visibleWeeks.length) : 120
    } else if (zoomMode === 'period') {
      const p = yearPeriods[selectedPIdx] ?? yearPeriods[0]
      visibleWeeks  = yearWeeks.filter(w => w.periodIndex === p.index)
      visibleOffset = p.weekStart
      windowStart   = new Date(FY_WEEKS[p.weekStart].date)
      weekPx = available > 0 ? Math.floor(available / visibleWeeks.length) : 200
    } else {
      // Week mode — single week fills the full available width
      const w = FY_WEEKS[selectedWkIdx]
      visibleWeeks  = [w]
      visibleOffset = selectedWkIdx
      windowStart   = new Date(w.date)
      weekPx = available > 0 ? available : 980
    }

    const chartWidth = visibleWeeks.length * weekPx

    // Periods and quarters visible in the current window — weekCount is adjusted
    // to the number of visible weeks so header cells sum exactly to chartWidth.
    const visiblePeriodIndices  = new Set(visibleWeeks.map(w => w.periodIndex))
    const visibleQuarterIndices = new Set(visibleWeeks.map(w => w.quarterIndex))
    const visiblePeriods  = FY_PERIODS.filter(p => visiblePeriodIndices.has(p.index))
    const visibleQuarters = FY_QUARTERS.filter(q => visibleQuarterIndices.has(q.index))

    function dateToX(iso: string): number {
      if (!iso) return -1
      const d = new Date(iso + 'T00:00:00')
      return (daysBetween(windowStart, d) / 7) * weekPx
    }

    // Today marker — hide if today is outside the visible window
    const todayX = dateToX(todayIso())
    const todayXPos = todayX >= 0 && todayX <= chartWidth ? todayX : -1

    // In week mode, generate the 7 individual days so PtoHeaders can render
    // a day-of-week row identical to the one on the Planning page.
    const weekDays = zoomMode === 'week'
      ? Array.from({ length: 7 }, (_, i) => {
          const d = new Date(windowStart)
          d.setDate(d.getDate() + i)
          return {
            label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
            iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
          }
        })
      : undefined

    return {
      weekPx,
      chartWidth,
      visibleWeeks,
      visiblePeriods,
      visibleQuarters,
      visibleOffset,
      todayXPos,
      dateToX,
      weekDays,
    }
  }, [zoomMode, selectedYearIdx, selectedQIdx, selectedPIdx, selectedWkIdx, containerWidth])

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = todayIso()
    const { qStart, qEnd } = getCurrentQBounds()
    const qStartIso = qStart.toISOString().slice(0, 10)
    const qEndIso   = qEnd.toISOString().slice(0, 10)

    // 14 days from today
    const in14 = new Date()
    in14.setDate(in14.getDate() + 14)
    const in14Iso = `${in14.getFullYear()}-${String(in14.getMonth() + 1).padStart(2, '0')}-${String(in14.getDate()).padStart(2, '0')}`

    const onPtoToday    = ptoBlocks.filter(b => ptoContainsDate(b, today)).length
    const thisQuarter   = ptoBlocks.filter(b => ptoOverlapsRange(b, qStartIso, qEndIso)).length
    const upcomingBlocks = ptoBlocks.filter(b => b.startDate > today && b.startDate <= in14Iso).length

    return { onPtoToday, thisQuarter, upcomingBlocks }
  }, [ptoBlocks])

  // ── Filtered member tree ──────────────────────────────────────────────────
  // Build domain → team → member hierarchy respecting all active filters.
  const filteredTree = useMemo(() => {
    const search = searchText.trim().toLowerCase()

    return domains
      .map(domain => {
        // Domain filter
        if (filterDomainIds.length > 0 && !filterDomainIds.includes(domain.id)) return null

        const domainTeams = teams
          .filter(t => t.domainId === domain.id)
          .map(team => {
            // Team filter
            if (filterTeamIds.length > 0 && !filterTeamIds.includes(team.id)) return null

            const teamMembers = (team.memberIds ?? [])
              .map(mid => members.find(m => m.id === mid))
              .filter((m): m is Member => !!m)
              .filter(m => !search || m.name.toLowerCase().includes(search) || m.role.toLowerCase().includes(search))

            if (teamMembers.length === 0) return null
            return { team, members: teamMembers }
          })
          .filter(Boolean) as { team: Team; members: Member[] }[]

        if (domainTeams.length === 0) return null
        return { domain, teams: domainTeams }
      })
      .filter(Boolean) as { domain: Domain; teams: { team: Team; members: Member[] }[] }[]
  }, [domains, teams, members, searchText, filterDomainIds, filterTeamIds])

  // Lookup: PTO blocks by memberId for fast access in row rendering
  const ptoByMember = useMemo(() => {
    const map = new Map<string, PtoBlock[]>()
    for (const b of ptoBlocks) {
      if (!map.has(b.memberId)) map.set(b.memberId, [])
      map.get(b.memberId)!.push(b)
    }
    return map
  }, [ptoBlocks])

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleAddPto(payload: Omit<PtoBlock, 'id'>) {
    addPto(payload)
  }

  function handleDeletePto() {
    if (deleteTarget) {
      deletePto(deleteTarget.id)
      setDeleteTarget(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarOff size={18} className="text-amber-500" />
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">PTO Tracking</h1>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="On PTO today"         value={stats.onPtoToday}    sub="team members currently out" />
          <StatCard label="PTO blocks this qtr"  value={stats.thisQuarter}   sub="across all members" />
          <StatCard label="Upcoming (14 days)"   value={stats.upcomingBlocks} sub="blocks starting soon" />
        </div>

        {/* Controls row: zoom toggle + filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* "View" section label */}
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">View</span>

          {/* Zoom toggle — identical options to Planning page for consistency */}
          <SegmentedControl
            options={[
              { value: 'year',    label: 'Year' },
              { value: 'quarter', label: 'Quarter' },
              { value: 'period',  label: 'Month' },
              { value: 'week',    label: 'Week' },
            ] as { value: ZoomMode; label: string }[]}
            value={zoomMode}
            onChange={setZoomMode}
          />

          {/* Year navigation — always visible so the user can switch fiscal years in any zoom mode */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setSelectedYearIdx(i => Math.max(0, i - 1))}
              disabled={selectedYearIdx === 0}
              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
              title="Previous fiscal year"
            >‹</button>
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              FY{FY_YEARS[selectedYearIdx].fyYear}
            </span>
            <button
              onClick={() => setSelectedYearIdx(i => Math.min(FY_YEARS.length - 1, i + 1))}
              disabled={selectedYearIdx === FY_YEARS.length - 1}
              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
              title="Next fiscal year"
            >›</button>
          </div>

          {/* Quarter navigation arrows — 0-3 within the selected year */}
          {zoomMode === 'quarter' && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setSelectedQIdx(i => Math.max(0, i - 1))}
                disabled={selectedQIdx === 0}
                className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
                title="Previous quarter"
              >‹</button>
              <span className="text-xs font-semibold text-slate-700 w-6 text-center">
                {FY_QUARTERS.filter(q => q.fyYear === FY_YEARS[selectedYearIdx].fyYear)[selectedQIdx]?.label}
              </span>
              <button
                onClick={() => setSelectedQIdx(i => Math.min(FY_QUARTERS.filter(q => q.fyYear === FY_YEARS[selectedYearIdx].fyYear).length - 1, i + 1))}
                disabled={selectedQIdx === FY_QUARTERS.filter(q => q.fyYear === FY_YEARS[selectedYearIdx].fyYear).length - 1}
                className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
                title="Next quarter"
              >›</button>
            </div>
          )}

          {/* Period (Month) navigation arrows — periods are scoped to the selected year */}
          {zoomMode === 'period' && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setSelectedPIdx(i => Math.max(0, i - 1))}
                disabled={selectedPIdx === 0}
                className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
                title="Previous period"
              >‹</button>
              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                {FY_PERIODS.filter(p => p.fyYear === FY_YEARS[selectedYearIdx].fyYear)[selectedPIdx]?.monthLabel}
              </span>
              <button
                onClick={() => setSelectedPIdx(i => Math.min(FY_PERIODS.filter(p => p.fyYear === FY_YEARS[selectedYearIdx].fyYear).length - 1, i + 1))}
                disabled={selectedPIdx === FY_PERIODS.filter(p => p.fyYear === FY_YEARS[selectedYearIdx].fyYear).length - 1}
                className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
                title="Next period"
              >›</button>
            </div>
          )}

          {/* Week navigation arrows */}
          {zoomMode === 'week' && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setSelectedWkIdx(i => Math.max(0, i - 1))}
                disabled={selectedWkIdx === 0}
                className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
                title="Previous week"
              >‹</button>
              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                {FY_WEEKS[selectedWkIdx].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <button
                onClick={() => setSelectedWkIdx(i => Math.min(FY_WEEKS.length - 1, i + 1))}
                disabled={selectedWkIdx === FY_WEEKS.length - 1}
                className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
                title="Next week"
              >›</button>
            </div>
          )}

          {/* "Filter" section label */}
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 ml-3">Filter</span>

          {/* Domain filter */}
          <MultiSelectDropdown
            label="Domain"
            options={domains.map(d => ({ id: d.id, label: d.name }))}
            selected={filterDomainIds}
            onChange={setFilterDomainIds}
          />

          {/* Team filter */}
          <MultiSelectDropdown
            label="Team"
            options={teams.map(t => ({ id: t.id, label: t.name }))}
            selected={filterTeamIds}
            onChange={setFilterTeamIds}
          />

          {/* Member search */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search members…"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable chart ─────────────────────────────────────────────── */}
      <PtoCtx.Provider value={ptoConfig}>
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto"
          style={{ scrollbarGutter: 'stable' }}
        >
          {/* Sticky header row: left label column + timeline headers */}
          <div className="sticky top-0 z-30 flex">
            {/* Left column label */}
            <div
              className="sticky left-0 z-40 shrink-0 bg-white dark:bg-slate-900 border-r border-b border-slate-200 dark:border-slate-700 flex items-end px-3 pb-1"
              style={{ width: LEFT_COL_W, minHeight: 64 }}
            >
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Member</span>
            </div>
            {/* Calendar headers */}
            <div className="flex-1 overflow-x-hidden">
              <PtoHeaders />
            </div>
          </div>

          {/* Domain → Team → Member rows */}
          {filteredTree.map(({ domain, teams: domainTeams }) => (
            <div key={domain.id}>
              <DomainHeaderRow domain={domain} />
              {domainTeams.map(({ team, members: teamMembers }) => (
                <div key={team.id}>
                  <TeamHeaderRow team={team} />
                  {teamMembers.map(member => (
                    <PtoMemberRow
                      key={member.id}
                      member={member}
                      blocks={ptoByMember.get(member.id) ?? []}
                      onAdd={() => setAddDialog({ memberId: member.id, memberName: member.name })}
                      onDeleteBlock={block => setDeleteTarget(block)}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}

          {filteredTree.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
              <CalendarOff size={32} className="mb-3 opacity-30" />
              <p className="text-sm">No members match the current filters.</p>
            </div>
          )}
        </div>
      </PtoCtx.Provider>

      {/* ── Add PTO dialog ──────────────────────────────────────────────── */}
      {addDialog && (
        <AddPtoDialog
          open={!!addDialog}
          memberId={addDialog.memberId}
          memberName={addDialog.memberName}
          onClose={() => setAddDialog(null)}
          onSave={handleAddPto}
        />
      )}

      {/* ── Delete PTO confirm ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove PTO block?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.note
                ? `"${deleteTarget.note}" — ${deleteTarget.startDate} to ${deleteTarget.endDate}`
                : `${deleteTarget?.startDate} to ${deleteTarget?.endDate}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePto} className="bg-red-500 hover:bg-red-600">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
