import { useState, useRef, useEffect, useMemo, createContext, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Palmtree, Trash2, Flag, Search, Printer, CalendarOff, Users2, Zap, AlertTriangle, TrendingUp } from 'lucide-react'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTooltip } from '@/components/ui/tooltip'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ProjectFormDialog } from '@/components/projects/ProjectFormDialog'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useViewStore } from '@/store/useViewStore'
import { PHASE_COLORS, CHART_COLORS, avatarColor } from '@/lib/colors'
import { deriveProjectFields } from '@/lib/projectBuilder'
import { SDLC_ROLES, ROLE_COLORS, DEFAULT_ROLE_COLOR, roleCategoryOf, ALL_ROLE_CATEGORIES } from '@/lib/roles'
import { getCurrentQBounds } from '@/lib/fiscal'
import { cn } from '@/lib/utils'
import type { Project, ProjectPhase, Member, Team, PtoBlock, ProjectMemberAssignment, ProjectPhaseStep } from '@/types'

/**
 * Capacity Planner page — Gantt-style chart of member workload across FY2026.
 *
 * Two views:
 *   By Member — one row per person, bars = their assigned projects + PTO.
 *               Stacked bars when a member has multiple concurrent projects.
 *   By Project — one row per project, bars = each assigned member's work window,
 *                colored by their SDLC role (Frontend, QA, PM, etc.).
 *
 * The horizontal axis is the Kroger 4-5-4 NRF fiscal calendar spanning FY2026–FY2028
 * (156 continuous weeks). All pixel positions are computed by ganttConfig.dateToX()
 * which converts an ISO date to a pixel offset from the visible window's start date.
 */

// ─── Fiscal calendar — Kroger 4-5-4 NRF FY2025–FY2028 ────────────────────
// FY2025: Feb 2, 2025 (Sun) – Feb 1, 2026  (52 weeks exactly)
// FY2026: Feb 1, 2026 (Sun) – Jan 31, 2027
// FY2027 / FY2028 follow at 52-week intervals.
// FY_START is the Sunday that begins FY2025 — the global week-0 origin.

const FY_START = new Date('2025-02-02T00:00:00')   // Sunday — global origin for all week date math

// The 4-5-4 pattern groups weeks into periods (months): 4 weeks, 5 weeks, 4 weeks,
// repeating across 4 quarters. This gives 12 periods and exactly 52 weeks per year.
// Each quarter = 13 weeks (4+5+4). P1 starts on FY_START.
const PERIOD_WEEKS = [4, 5, 4,  4, 5, 4,  4, 5, 4,  4, 5, 4]  // P1–P12

/** Fiscal years covered by this calendar. FY2025 is the base (week 0). */
const SUPPORTED_FY_YEARS = [2025, 2026, 2027, 2028]
const WEEKS_PER_FY = 52

interface FiscalWeek {
  index: number        // global 0-based week index from FY_START (continuous across all years)
  date: Date           // Sunday of the week
  periodIndex: number  // global 0-based period index (P1 of FY2026 = 0, P1 of FY2027 = 12, etc.)
  quarterIndex: number // global 0-based quarter index (Q1 of FY2026 = 0, Q1 of FY2027 = 4, etc.)
  weekInPeriod: number // 1-based position within the period
  fyYear: number       // which fiscal year this week belongs to (e.g. 2026)
}

interface FiscalPeriod {
  index: number        // global 0-based
  label: string        // "P1" … "P12" (used in full calendar headers; restarts each year)
  monthLabel: string   // abbreviated month name derived from the period's first week date, e.g. "Feb"
  quarterIndex: number // global quarter index
  weekStart: number    // global first week index
  weekCount: number
  fyYear: number       // which fiscal year this period belongs to
}

interface FiscalQuarter {
  index: number
  label: string        // "Q1" … "Q4" (restarts each year)
  weekStart: number    // global first week index
  weekCount: number    // always 13
  fyYear: number       // which fiscal year this quarter belongs to
}

/** One fiscal year entry — tracks the global week boundaries for each FY. */
interface FiscalYear {
  fyYear: number    // e.g. 2026
  weekStart: number // global week index of the first week in this FY
  weekCount: number // 52
}

/**
 * Build a multi-year 4-5-4 NRF fiscal calendar starting at FY_START (FY2025).
 * Each supported year is exactly WEEKS_PER_FY (52) weeks. Global week indices
 * are continuous: FY2025 = 0-51, FY2026 = 52-103, FY2027 = 104-155, FY2028 = 156-207.
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

        // monthLabel derived from the period's first day — keeps it accurate
        // for any year without hard-coding the 12 month names.
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
const LEFT_COL_W = 200  // px — width of the sticky member/project name column

// ── Virtual-scroll constants ───────────────────────────────────────────────
const ROW_BAR_H  = 28  // px height of one project or PTO bar slot
const ROW_PAD_H  = 8   // extra vertical padding at the top/bottom of each row
const PTO_SLOT_H = 28  // additional height added when a member has PTO blocks
const DIVIDER_H  = 28  // height of team/phase section divider rows
const OVERSCAN   = 8   // extra rows rendered above/below the visible window
                        // to avoid visible blank gaps during fast scrolling

/**
 * Binary search: returns the largest index i such that cum[i] <= target.
 * cum is the prefix-sum array produced by the cumHeights useMemo below.
 * Used to find the first and last visible row given a scrollTop value in O(log N).
 */
function lowerBound(cum: number[], target: number): number {
  let lo = 0, hi = cum.length - 2
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (cum[mid] <= target) lo = mid
    else hi = mid - 1
  }
  return lo
}

// Gantt bar colors come from the shared roles file — same source as the form's
// Part/Responsibility chip picker, so bar color always matches the chip color.
const PART_COLORS = ROLE_COLORS
const DEFAULT_PART_COLOR = DEFAULT_ROLE_COLOR

// ─── Gantt configuration context ─────────────────────────────────────────
// Distributes dynamic chart values (zoom level, visible window, coordinate
// conversion) to all child components so they don't need to be passed as props.
interface GanttConfig {
  weekPx: number
  chartWidth: number
  visibleWeeks: FiscalWeek[]
  visiblePeriods: FiscalPeriod[]    // periods visible in the current window
  visibleQuarters: FiscalQuarter[]  // quarters visible in the current window (with weekCount adjusted)
  visibleOffset: number             // index of the first visible week in the full FY_WEEKS array
  todayXPos: number                 // pixel x of today relative to visibleStart (or -1 if outside window)
  dateToX: (iso: string) => number  // convert ISO date → pixel x relative to visibleStart
  xToDate: (px: number) => string   // convert pixel x back to ISO date
  /** Populated only in week zoom mode: the 7 individual days of the visible week. */
  weekDays?: { label: string; iso: string }[]
}
const GanttCtx = createContext<GanttConfig | null>(null)

/** Access the current Gantt chart configuration from any component in the tree. */
function useGantt(): GanttConfig {
  const ctx = useContext(GanttCtx)
  if (!ctx) throw new Error('useGantt must be called inside a GanttCtx.Provider')
  return ctx
}

/** Generate a CSS repeating stripe background that scales with the zoom level. */
function makeStripe(weekPx: number): string {
  return `repeating-linear-gradient(90deg, transparent 0px, transparent ${weekPx}px, var(--gantt-stripe) ${weekPx}px, var(--gantt-stripe) ${weekPx * 2}px)`
}

// ─── Calendar math helpers ────────────────────────────────────────────────
// All pixel-position math is context-relative: ganttConfig.dateToX() converts
// an ISO date to pixels from the visible window's start date. The module-level
// daysBetween() is the only shared primitive; everything else lives in the memo.

/** Number of whole days from a to b. Negative when b is before a. */
function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
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

/**
 * Returns true when a project's date range overlaps the current fiscal quarter.
 * Delegates to the shared getCurrentQBounds() utility so the quarter window is
 * identical to the one used on the Roster and Teams Detail pages.
 */
function overlapsCurrentQuarter(p: Project): boolean {
  if (!p.startDate || !p.targetEndDate) return false
  const { qStart, qEnd } = getCurrentQBounds()
  const pStart = new Date(p.startDate + 'T00:00:00')
  const pEnd   = new Date(p.targetEndDate + 'T00:00:00')
  return pStart < qEnd && pEnd > qStart
}

function formatWeekLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Compute the clamped pixel position and width for a Gantt bar.
 *
 * Steps:
 *  1. Convert start/end ISO dates to raw pixel offsets via the provided dateToX().
 *  2. Enforce a minimum bar width of half a week so short projects are still visible.
 *  3. Clamp both edges to [0, chartWidth] so bars don't overflow the visible window.
 *  4. Return null if the bar would be invisible (missing dates or fully off-screen).
 *
 * Accepts config parameters instead of referencing module-level constants so it
 * works correctly in any zoom mode (year / quarter / period).
 *
 * Used by ProjectBar, PtoBar, AssignmentBar, and PhaseBar — the single place where
 * date-to-pixel math lives so all bars behave consistently.
 */
function barGeometry(
  startIso: string | undefined,
  endIso: string | undefined,
  dateToX: (iso: string) => number,
  weekPx: number,
  chartWidth: number,
): { leftPx: number; widthPx: number } | null {
  if (!startIso || !endIso) return null
  const rawLeft  = dateToX(startIso)
  const rawRight = dateToX(endIso)
  const rawWidth = Math.max(rawRight - rawLeft, weekPx * 0.5)  // min half-week
  const clampedLeft  = Math.max(0, rawLeft)
  const clampedWidth = Math.min(chartWidth, rawLeft + rawWidth) - clampedLeft
  if (clampedWidth <= 0) return null
  return { leftPx: clampedLeft, widthPx: clampedWidth }
}

// ─── Gantt bar drag hook ──────────────────────────────────────────────────

/**
 * useBarDrag — move + edge-resize for a single Gantt bar.
 *
 * Three modes detected from where the user presses on the bar:
 *   move         — drag body → shifts both endpoints by the same delta
 *   resize-left  — drag left edge zone → changes only the start date
 *   resize-right — drag right edge zone → changes only the end date
 *
 * Visual position (vLeft, vWidth) updates immediately via local state so
 * the bar moves with no lag. onCommit is called once on mouseup with the
 * final pixel geometry; callers convert to ISO dates and persist.
 *
 * A short mousedown + mouseup with < 5px movement fires onEdit instead
 * of onCommit, so a normal click still opens the project editor.
 *
 * @param leftPx   Current bar left edge in chart pixels
 * @param widthPx  Current bar width in chart pixels
 * @param onEdit   Called on click (no meaningful drag occurred)
 * @param onCommit Called on drag end with final (leftPx, widthPx)
 */
function useBarDrag({
  leftPx,
  widthPx,
  weekPx,
  chartWidth,
  onEdit,
  onCommit,
}: {
  leftPx: number
  widthPx: number
  weekPx: number
  chartWidth: number
  onEdit: () => void
  onCommit: (newLeft: number, newWidth: number) => void
}) {
  const [vLeft, setVLeft]           = useState(leftPx)
  const [vWidth, setVWidth]         = useState(widthPx)
  const [isDragging, setIsDragging] = useState(false)
  const activeRef   = useRef(false)
  const onEditRef   = useRef(onEdit)
  const onCommitRef = useRef(onCommit)
  onEditRef.current   = onEdit
  onCommitRef.current = onCommit

  // Sync from props when idle (another edit updated the dates externally)
  useEffect(() => {
    if (!activeRef.current) {
      setVLeft(leftPx)
      setVWidth(widthPx)
    }
  }, [leftPx, widthPx])

  /**
   * Attach to onMouseDown on the bar element.
   * Reads the click position within the bar to choose move vs resize mode,
   * then registers document-level move/up listeners for the drag lifetime.
   */
  function handleMouseDown(e: React.MouseEvent) {
    const rect  = e.currentTarget.getBoundingClientRect()
    const relX  = e.clientX - rect.left
    const edge  = Math.min(12, rect.width * 0.2) // resize zone: 12px or 20% of width

    const mode: 'move' | 'resize-left' | 'resize-right' =
      relX <= edge              ? 'resize-left'  :
      relX >= rect.width - edge ? 'resize-right' :
      'move'

    e.preventDefault()
    e.stopPropagation()

    const startMouseX = e.clientX
    const startLeft   = leftPx   // snapshot at drag start — always current from props
    const startWidth  = widthPx
    const DAY_PX      = weekPx / 7  // pixels per day, used for snapping
    const MIN_W       = DAY_PX        // bars must be at least 1 day wide

    let cl = startLeft, cw = startWidth
    let moved = false

    activeRef.current = true
    setIsDragging(true)

    function onMouseMove(ev: MouseEvent) {
      const dx      = ev.clientX - startMouseX
      const snapped = Math.round(dx / DAY_PX) * DAY_PX  // snap to nearest day
      if (Math.abs(dx) > 5) moved = true

      if (mode === 'move') {
        cl = Math.max(0, Math.min(startLeft + snapped, chartWidth - startWidth))
        cw = startWidth
      } else if (mode === 'resize-left') {
        const d = Math.max(-startLeft, Math.min(snapped, startWidth - MIN_W))
        cl = startLeft + d
        cw = startWidth - d
      } else {
        cw = Math.max(MIN_W, Math.min(startWidth + snapped, chartWidth - startLeft))
      }

      setVLeft(cl)
      setVWidth(cw)
    }

    function onMouseUp() {
      activeRef.current = false
      setIsDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      if (moved) onCommitRef.current(cl, cw)
      else onEditRef.current()
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return { vLeft, vWidth, isDragging, handleMouseDown }
}

/**
 * Total allocation % for a member in the current fiscal quarter.
 * Used both in each member's Gantt row label and in the page-level avg summary.
 * Only counts projects whose date range overlaps the current quarter.
 */
function calcMemberAllocation(memberId: string, memberProjects: Project[]): number {
  return memberProjects
    .filter(p => overlapsCurrentQuarter(p))
    .reduce((sum, p) => sum + (p.assignments.find(a => a.memberId === memberId)?.allocation ?? 0), 0)
}

// ─── Fiscal phase order (used by legend sorting) ─────────────────────────

// Ordered list of all phases in SDLC progression — used to sort the By Member
// phase legend so it reads left-to-right in workflow order, not alphabetically.
const PHASE_ORDER: ProjectPhase[] = ['Research', 'Discovery', 'Development', 'QA', 'Deployed', 'On Hold']

// ─── Gantt header rows ────────────────────────────────────────────────────
// Light, airy header rows so the colored bars are the visual focus.
// FY → Quarter → Period → Week date, each row slightly lighter/more subtle.

function GanttHeaders() {
  // Pull all chart dimensions and visible-window data from context so this
  // component re-renders automatically when the zoom mode or selection changes.
  const { weekPx, chartWidth, visibleWeeks, visiblePeriods, visibleQuarters, todayXPos, weekDays } = useGantt()
  // dayPx is the pixel width of each day column in week zoom mode.
  const dayPx = weekDays ? weekPx / 7 : 0

  return (
    <div className="relative" style={{ width: chartWidth }}>
      {/* Quarter row — bold dark text establishes the hierarchy. Label includes the
          calendar year derived from fyYear so multi-year views read "Q1 2026" etc.
          Vertical dividers mark Q boundaries clearly. */}
      <div className="flex border-b border-slate-200" style={{ height: 24 }}>
        {visibleQuarters.map(q => (
          <div
            key={q.index}
            className="flex items-center justify-center text-xs font-bold border-r border-slate-200"
            style={{
              width: q.weekCount * weekPx,
              background: q.index % 2 === 0 ? 'var(--gantt-q-even)' : 'var(--gantt-q-odd)',
              color: 'var(--gantt-q-text)',
            }}
          >
            {q.label} {q.fyYear}
          </div>
        ))}
      </div>

      {/* Period row — shows abbreviated month name (e.g. "Feb") in period zoom,
          or full month + P-number label (e.g. "Feb (P1)") when there are multiple
          periods visible so users can cross-reference Jira sprint names if needed. */}
      <div className="flex border-b border-slate-200" style={{ height: 22 }}>
        {visiblePeriods.map(p => (
          <div
            key={p.label}
            className="flex items-center justify-center text-xs font-semibold border-r border-slate-200"
            style={{
              width: p.weekCount * weekPx,
              background: p.index % 2 === 0 ? 'var(--gantt-p-even)' : 'var(--gantt-p-odd)',
              color: 'var(--gantt-p-text)',
            }}
          >
            {p.monthLabel}
          </div>
        ))}
      </div>

      {/* Week date row — near-white so colored bars have a clean backdrop */}
      <div className="flex border-b border-slate-200" style={{ height: 22 }}>
        {visibleWeeks.map(w => (
          <div
            key={w.index}
            className="flex items-center justify-center text-xs font-medium border-r border-slate-200 shrink-0"
            style={{
              width: weekPx,
              background: w.index % 2 === 0 ? 'var(--gantt-w-even)' : 'var(--gantt-w-odd)',
              color: 'var(--gantt-w-text)',
            }}
          >
            {formatWeekLabel(w.date)}
          </div>
        ))}
      </div>

      {/* Day-of-week row — visible only in week zoom mode. Shows Mon–Sun labels
          across the single visible week, each cell = weekPx/7 wide.
          Weekends (Sat/Sun, index ≥ 5) get a slightly tinted background. */}
      {weekDays && (
        <div className="flex border-b border-slate-200" style={{ height: 22 }}>
          {weekDays.map((day, i) => (
            <div
              key={day.iso}
              className="flex items-center justify-center text-[10px] font-semibold border-r border-slate-200 shrink-0"
              style={{
                width: dayPx,
                // All day cells white; weekends get a slightly dimmer text color only
                background: '#ffffff',
                color: i >= 5 ? '#94a3b8' : 'var(--gantt-w-text)',
              }}
            >
              {day.label}
            </div>
          ))}
        </div>
      )}

      {/* Today marker — container sits at exactly left: todayXPos (no transform),
          so the w-px stem line inside stays pixel-perfect with the rows' today line.
          The badge text gets its own translateX(-50%) that only affects its visual
          centering without touching the line position.
          Flex-col layout means the line starts at the badge's bottom edge — it never
          pokes out above the badge. */}
      {todayXPos >= 0 && todayXPos <= chartWidth && (
        <div
          className="absolute top-0 bottom-0 flex flex-col items-start pointer-events-none"
          style={{ left: todayXPos, zIndex: 15 }}
        >
          {/* Badge — centered over the left edge of the container via its own transform */}
          <div
            className="mt-0.5 shrink-0"
            style={{ transform: 'translateX(-50%)' }}
          >
            <div
              className="flex flex-col items-center px-1.5 py-0.5 rounded text-white font-bold whitespace-nowrap"
              style={{ background: '#ef4444' }}
            >
              <span style={{ fontSize: 10, lineHeight: '14px' }}>Today</span>
              <span style={{ fontSize: 9, lineHeight: '12px', opacity: 0.9, fontWeight: 500 }}>
                {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
          {/* Stem — flows below the badge naturally; left: 0 keeps it at the exact pixel */}
          <div className="flex-1 w-px bg-red-500" />
        </div>
      )}
    </div>
  )
}

// ─── Project bar (By Member view) ────────────────────────────────────────
// One draggable bar per project in a member's row. Drag the body to move
// both dates; drag either edge to resize (change only start or end date).
// A normal click (no drag) opens the project editor.
// A red flag appears on Critical priority projects.

function ProjectBar({
  project,
  memberId,
  rowIndex,
  rowOffset = 0,
  onEdit,
}: {
  project: Project
  memberId: string
  rowIndex: number
  rowOffset?: number
  onEdit: () => void
}) {
  const { updateProject } = usePortfolioStore()
  // Pull coordinate conversion and sizing from context so drag math is always
  // relative to the currently visible window, not the full fiscal year.
  const { dateToX, xToDate, weekPx, chartWidth } = useGantt()

  const assignment = project.assignments.find(a => a.memberId === memberId)
  const barStart   = assignment?.startDate || project.startDate
  const barEnd     = assignment?.endDate   || project.targetEndDate
  const geo        = barGeometry(barStart, barEnd, dateToX, weekPx, chartWidth)

  const allocation = assignment?.allocation ?? 0
  const meta       = [project.phase, assignment?.part].filter(Boolean).join(' · ')
  const bgColor    = CHART_COLORS.phase[project.phase] ?? '#60a5fa'
  const darkText   = project.phase === 'QA' || project.phase === 'Deployed'
  const isCritical = project.priority === 'Critical'

  // Hooks must be called before any early return
  const { vLeft, vWidth, isDragging, handleMouseDown } = useBarDrag({
    leftPx:    geo?.leftPx  ?? 0,
    widthPx:   geo?.widthPx ?? 0,
    weekPx,
    chartWidth,
    onEdit,
    // Drag commits new dates to the project-level start/end so all member bars shift together
    onCommit: (newLeft, newWidth) => {
      updateProject(project.id, {
        ...project,
        startDate:     xToDate(newLeft),
        targetEndDate: xToDate(newLeft + newWidth),
      } as Parameters<typeof updateProject>[1])
    },
  })

  const tooltipContent = (
    <div>
      <p className="text-sm font-semibold leading-snug mb-1">{project.name}</p>
      <p className="text-[11px] text-slate-300">{barStart} → {barEnd}</p>
      <p className="text-[11px] text-slate-300">Allocation: {allocation}%</p>
      <p className="text-[10px] text-slate-400 mt-1">Drag to move · drag edges to resize</p>
    </div>
  )
  const { onMouseEnter, onMouseMove, onMouseLeave, tip } = useTooltip(tooltipContent)

  if (!geo) return null

  return (
    <>
      <div
        className="absolute group/bar"
        style={{
          top:    rowOffset + rowIndex * 28 + 4,
          left:   vLeft,
          width:  vWidth,
          height: 22,
          zIndex: isDragging ? 20 : undefined,
        }}
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <div
          className={cn(
            'w-full h-full rounded-full flex items-center overflow-hidden relative select-none',
            isDragging ? 'shadow-lg' : 'hover:opacity-90',
          )}
          style={{ background: bgColor, cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
        >
          {/* Left resize zone — wider hit area, always-visible grip dots hint resize is possible */}
          <div className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center gap-px shrink-0">
            <div className="w-px h-3 bg-white/30 rounded-full group-hover/bar:bg-white/60 pointer-events-none transition-colors" />
            <div className="w-px h-3 bg-white/30 rounded-full group-hover/bar:bg-white/60 pointer-events-none transition-colors" />
          </div>

          {/* Critical flag — small red icon at the left of the label */}
          {isCritical && (
            <Flag
              size={9}
              className={cn('shrink-0 ml-4 mr-0.5', darkText ? 'text-red-700' : 'text-red-300')}
              fill="currentColor"
            />
          )}
          <span className={cn('flex items-baseline gap-1.5 min-w-0 px-4 relative z-10 select-none', isCritical && 'pl-1')}>
            <span className={cn('text-xs font-semibold truncate min-w-0', darkText ? 'text-slate-900' : 'text-white')}>
              {project.name}
            </span>
            {meta && (
              <span className={cn('text-[10px] font-normal shrink-0', darkText ? 'text-slate-600' : 'text-white/60')}>
                {allocation}% · {meta}
              </span>
            )}
          </span>

          {/* Right resize zone — matching grip dots */}
          <div className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center gap-px shrink-0">
            <div className="w-px h-3 bg-white/30 rounded-full group-hover/bar:bg-white/60 pointer-events-none transition-colors" />
            <div className="w-px h-3 bg-white/30 rounded-full group-hover/bar:bg-white/60 pointer-events-none transition-colors" />
          </div>
        </div>
      </div>
      {tip}
    </>
  )
}

// ─── PTO bar ──────────────────────────────────────────────────────────────

function PtoBar({ pto, onDelete }: { pto: PtoBlock; onDelete: () => void }) {
  // PTO bars are read-only (no drag), so we only need the coordinate functions
  // and sizing — not xToDate. Pull from context for zoom-mode correctness.
  const { dateToX, weekPx, chartWidth } = useGantt()
  const geo = barGeometry(pto.startDate, pto.endDate, dateToX, weekPx, chartWidth)
  const tooltipContent = (
    <div>
      <p className="text-sm font-semibold leading-snug mb-1">PTO</p>
      <p className="text-[11px] text-slate-300">{pto.startDate} → {pto.endDate}</p>
      {pto.note && <p className="text-[11px] text-slate-300">{pto.note}</p>}
    </div>
  )
  const { onMouseEnter, onMouseMove, onMouseLeave, tip } = useTooltip(tooltipContent)

  if (!geo) return null

  return (
    <>
      <div
        className="absolute group"
        style={{ top: 3, left: geo.leftPx, width: geo.widthPx, height: 20, zIndex: 3 }}
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <div className="w-full h-full bg-amber-400 hover:bg-amber-500 rounded-full flex items-center px-2 overflow-hidden transition-colors">
          <span className="text-amber-900 text-xs font-medium truncate select-none flex-1">
            PTO{pto.note ? ` · ${pto.note}` : ''}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="opacity-0 group-hover:opacity-100 text-amber-800 hover:text-red-600 ml-1 shrink-0"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>
      {tip}
    </>
  )
}

// ─── PTO dialog ───────────────────────────────────────────────────────────

function PtoDialog({
  open, onOpenChange, member,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  member: Member
}) {
  const { addPto } = usePortfolioStore()
  const [startDate, setStart] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEnd]     = useState('')
  const [note, setNote]       = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addPto({ memberId: member.id, startDate, endDate: endDate || startDate, note })
    onOpenChange(false)
    setNote('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <Palmtree size={16} />
            Add PTO — {member.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date *</Label>
              <Input type="date" value={startDate} onChange={e => setStart(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Date *</Label>
              <Input type="date" value={endDate} min={startDate} onChange={e => setEnd(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note (optional)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="e.g. Family vacation" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white">Add PTO</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Epic picker dialog ───────────────────────────────────────────────────
// Shown when clicking "+ Epic" on a member row. Lets the user either assign
// the member to an existing epic they're not already on, or open the full
// project form to create a brand-new epic.

function EpicPickerDialog({
  open,
  member,
  onAssignExisting,
  onCreateNew,
  onClose,
}: {
  open: boolean
  member: Member
  onAssignExisting: (project: Project) => void
  onCreateNew: () => void
  onClose: () => void
}) {
  const { projects } = usePortfolioStore()
  const [search, setSearch] = useState('')

  // Epics the member is NOT already assigned to, sorted by name
  const available = useMemo(() =>
    projects
      .filter(p => !p.assignments.some(a => a.memberId === member.id))
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [projects, member.id, search]
  )

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Epic for {member.name}</DialogTitle>
        </DialogHeader>

        {/* Create new option — always at the top */}
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg border-2 border-dashed border-blue-200 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm font-medium"
        >
          <span className="text-lg leading-none">+</span>
          Create new epic
        </button>

        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">
          Or assign to existing
        </div>

        {/* Search input */}
        <Input
          placeholder="Search epics…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-sm"
          autoFocus
        />

        {/* Scrollable epic list */}
        <div className="max-h-64 overflow-y-auto flex flex-col gap-1 -mx-1 px-1">
          {available.length === 0 && (
            <p className="text-sm text-slate-400 py-4 text-center">
              {search ? 'No epics match your search' : 'No unassigned epics available'}
            </p>
          )}
          {available.map(p => (
            <button
              key={p.id}
              onClick={() => onAssignExisting(p)}
              className="flex flex-col items-start gap-0.5 w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors group"
            >
              <span className="text-sm font-medium text-slate-800 group-hover:text-blue-700 leading-tight">
                {p.name}
              </span>
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', PHASE_COLORS[p.phase])}>
                  {p.phase}
                </span>
                <span className="text-[10px] text-slate-400">{p.status}</span>
              </div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Member row ───────────────────────────────────────────────────────────

function MemberGanttRow({
  member,
  memberProjects,
  memberPto,
}: {
  member: Member
  memberProjects: Project[]
  memberPto: PtoBlock[]
}) {
  const [projectModal, setProjectModal]   = useState<{ open: boolean; project?: Project }>({ open: false })
  const [ptoOpen, setPtoOpen]             = useState(false)
  const [epicPickerOpen, setEpicPickerOpen] = useState(false)
  const { addProject, updateProject, deletePto } = usePortfolioStore()
  const navigate = useNavigate()
  // In User mode, only this member (the active member) can manage their own row.
  const { activeMemberId } = useViewStore()
  const canEdit = activeMemberId === null || activeMemberId === member.id
  // Chart dimensions come from context so this row scales with the active zoom mode.
  const { weekPx, chartWidth, visibleWeeks, visiblePeriods, visibleOffset } = useGantt()
  const weekStripe = makeStripe(weekPx)

  const hasPto = memberPto.length > 0
  const rowCount = Math.max(memberProjects.length, 1)
  const rowHeight = (hasPto ? 28 : 0) + rowCount * 28 + 8
  const projectOffset = hasPto ? 28 : 0

  const totalAlloc = calcMemberAllocation(member.id, memberProjects)
  const cap = member.capacity
  const isOver   = totalAlloc > cap
  const isAtRisk = !isOver && cap > 0 && totalAlloc / cap > 0.8

  const allocColor =
    isOver   ? 'text-red-600 font-semibold' :
    isAtRisk ? 'text-amber-600 font-semibold' :
    'text-slate-500'

  // Only called for new projects — editing navigates to ProjectDetailPage.
  function handleSave(draft: Omit<Project, 'id' | 'updatedAt'>) {
    addProject(draft)
  }

  return (
    <>
      <div className="flex border-b border-slate-100" style={{ minHeight: rowHeight }}>
        {/* Left column: sticky member info.
            background uses a CSS var so it's opaque in both light and dark mode,
            preventing chart bar content from bleeding through when scrolling right. */}
        <div
          className="sticky left-0 z-10 shrink-0 flex flex-col justify-center px-3 py-2 border-r border-slate-200 gap-0.5"
          style={{ width: LEFT_COL_W, background: 'var(--gantt-surface)' }}
        >
          <div className="flex items-center gap-2">
            {/* Avatar color is derived from the member's name for consistent identity across views */}
            <div className={cn('w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0', avatarColor(member.name).bg, avatarColor(member.name).text)}>
              {member.avatarInitials.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{member.name}</p>
              <p className="text-xs text-slate-400 truncate">{member.role}</p>
            </div>
          </div>
          {/* Chip-style action buttons — match the phase chip design used in By Project view */}
          {canEdit && (
            <div className="flex items-center gap-1 flex-wrap mt-0.5">
              <button
                onClick={() => setEpicPickerOpen(true)}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                title="Add epic"
              >
                + Epic
              </button>
              <button
                onClick={() => setPtoOpen(true)}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                title="Add PTO"
              >
                + PTO
              </button>
            </div>
          )}

          {/* Allocation bar — mirrors the percentComplete bar in By Project view.
              Bar fills up to 100% visually; color shifts amber >80% and red >100%. */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  isOver   ? 'bg-red-500' :
                  isAtRisk ? 'bg-amber-400' :
                  'bg-blue-500',
                )}
                style={{ width: cap > 0 ? `${Math.min((totalAlloc / cap) * 100, 100)}%` : `${Math.min(totalAlloc, 100)}%` }}
              />
            </div>
            <span className={cn('text-[10px] shrink-0', allocColor)}>
              {totalAlloc > 0 ? `${totalAlloc}%` : '—'}
            </span>
          </div>
        </div>

        {/* Chart area — isolate creates a stacking context so bars can't bleed above
            the sticky left column regardless of their z-index values.
            width and stripe come from context so they resize with the zoom mode. */}
        <div className="relative flex-1 shrink-0 isolate" style={{ width: chartWidth, minHeight: rowHeight, backgroundImage: weekStripe }}>
          {/* Week grid lines — positions are relative to visibleOffset so they align
              correctly even when only a subset of weeks are shown (quarter/period zoom). */}
          {visibleWeeks.map(w => (
            <div
              key={w.index}
              className="absolute top-0 bottom-0 border-r border-slate-100"
              style={{ left: (w.index - visibleOffset) * weekPx }}
            />
          ))}
          {/* Period dividers — same offset logic as week grid lines */}
          {visiblePeriods.map(p => (
            <div
              key={p.label}
              className="absolute top-0 bottom-0 border-r border-slate-200"
              style={{ left: (p.weekStart - visibleOffset) * weekPx }}
            />
          ))}

          {/* PTO bars */}
          {memberPto.map(pto => (
            <PtoBar key={pto.id} pto={pto} onDelete={() => deletePto(pto.id)} />
          ))}

          {/* Project bars */}
          {memberProjects.map((p, i) => (
            <ProjectBar
              key={p.id}
              project={p}
              memberId={member.id}
              rowIndex={i}
              rowOffset={projectOffset}
              onEdit={() => navigate(`/projects/${p.id}`, { state: { from: '/planning' } })}
            />
          ))}

          {memberProjects.length === 0 && (
            <div className="absolute flex items-center px-3" style={{ top: projectOffset, bottom: 0, left: 0, right: 0 }}>
              <span className="text-xs text-slate-300 italic">No epics — click + to add</span>
            </div>
          )}
        </div>
      </div>

      {/* Epic picker — shown when clicking "+ Epic"; choose existing or create new */}
      <EpicPickerDialog
        open={epicPickerOpen}
        member={member}
        onClose={() => setEpicPickerOpen(false)}
        onAssignExisting={project => {
          // Append a new assignment for this member with a default allocation of 50%
          updateProject(project.id, {
            assignments: [
              ...project.assignments,
              { memberId: member.id, allocation: 50 },
            ],
          })
          setEpicPickerOpen(false)
        }}
        onCreateNew={() => {
          setEpicPickerOpen(false)
          setProjectModal({ open: true, project: undefined })
        }}
      />

      {/* PTO dialog */}
      {ptoOpen && (
        <PtoDialog open={ptoOpen} onOpenChange={setPtoOpen} member={member} />
      )}

      {/* Project form — opened when user chooses "Create new epic" from the picker */}
      <ProjectFormDialog
        key={projectModal.project?.id ?? 'new'}
        open={projectModal.open}
        onOpenChange={open => setProjectModal(s => ({ ...s, open }))}
        initial={projectModal.project}
        defaultMemberId={member.id}
        onSave={handleSave}
      />
    </>
  )
}

// ─── Assignment bar (By Project view) ────────────────────────────────────
// One draggable bar per member assigned to a project. Dragging updates
// that member's assignment-specific dates, not the project-level dates,
// so each member's window can shift independently.

function AssignmentBar({
  project,
  assignment,
  member,
  rowIndex,
  onEdit,
}: {
  project: Project
  assignment: ProjectMemberAssignment
  member: Member
  rowIndex: number
  onEdit: () => void
}) {
  const { updateProject } = usePortfolioStore()
  // Pull coordinate conversion and sizing from context so drag math is always
  // relative to the currently visible window, not the full fiscal year.
  const { dateToX, xToDate, weekPx, chartWidth } = useGantt()

  const barStart    = assignment.startDate || project.startDate
  const barEnd      = assignment.endDate   || project.targetEndDate
  const geo         = barGeometry(barStart, barEnd, dateToX, weekPx, chartWidth)
  const primaryPart = assignment.part?.split(',')[0]?.trim()
  const colorClass  = (primaryPart && PART_COLORS[primaryPart]) ?? DEFAULT_PART_COLOR
  const partMeta    = [assignment.part, `${assignment.allocation}%`].filter(Boolean).join(' · ')

  // Hook called before early return (React rules)
  const { vLeft, vWidth, isDragging, handleMouseDown } = useBarDrag({
    leftPx:  geo?.leftPx  ?? 0,
    widthPx: geo?.widthPx ?? 0,
    weekPx,
    chartWidth,
    onEdit,
    // Commit updates only this member's assignment dates within the project
    onCommit: (newLeft, newWidth) => {
      updateProject(project.id, {
        ...project,
        assignments: project.assignments.map(a =>
          a.memberId === assignment.memberId
            ? { ...a, startDate: xToDate(newLeft), endDate: xToDate(newLeft + newWidth) }
            : a
        ),
      } as Parameters<typeof updateProject>[1])
    },
  })

  const tooltipContent = (
    <div>
      <p className="text-sm font-semibold leading-snug mb-1">{member.name}</p>
      <p className="text-[11px] text-slate-300">{assignment.part || 'No part'} · {assignment.allocation}%</p>
      <p className="text-[11px] text-slate-300">{barStart} → {barEnd}</p>
      <p className="text-[10px] text-slate-400 mt-1">Drag to move · drag edges to resize</p>
    </div>
  )
  const { onMouseEnter, onMouseMove, onMouseLeave, tip } = useTooltip(tooltipContent)

  if (!geo) return null

  return (
    <>
      <div
        className="absolute group/bar"
        style={{ top: rowIndex * 28 + 4, left: vLeft, width: vWidth, height: 22, zIndex: isDragging ? 20 : undefined }}
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <div
          className={cn(
            'w-full h-full rounded-full flex items-center overflow-hidden relative select-none',
            colorClass,
            isDragging ? 'shadow-lg' : 'hover:opacity-80',
          )}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
        >
          {/* Left resize zone with grip dots */}
          <div className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center gap-px shrink-0">
            <div className="w-px h-3 bg-white/30 rounded-full group-hover/bar:bg-white/60 pointer-events-none transition-colors" />
            <div className="w-px h-3 bg-white/30 rounded-full group-hover/bar:bg-white/60 pointer-events-none transition-colors" />
          </div>
          <span className="flex items-baseline gap-1.5 min-w-0 px-4 relative z-10 select-none">
            <span className="text-white text-xs font-semibold truncate min-w-0">{member.name}</span>
            {partMeta && (
              <span className="text-white/60 text-[10px] font-normal shrink-0">{partMeta}</span>
            )}
          </span>
          {/* Right resize zone with grip dots */}
          <div className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center gap-px shrink-0">
            <div className="w-px h-3 bg-white/30 rounded-full group-hover/bar:bg-white/60 pointer-events-none transition-colors" />
            <div className="w-px h-3 bg-white/30 rounded-full group-hover/bar:bg-white/60 pointer-events-none transition-colors" />
          </div>
        </div>
      </div>
      {tip}
    </>
  )
}

// ─── Phase bar (By Project view, multi-phase projects) ────────────────────
// When a project has an explicit `phases` array, we render one PhaseBar per
// phase. Bars are draggable/resizable like AssignmentBar; clicking navigates
// to the full ProjectDetailPage. Members assigned to each phase are shown in
// the bar label and tooltip.

function PhaseBar({
  phase,
  phaseIndex,
  project,
  rowIndex,
  members,
}: {
  phase: ProjectPhaseStep
  phaseIndex: number
  project: Project
  rowIndex: number
  members: Member[]
}) {
  const { updateProject } = usePortfolioStore()
  const navigate = useNavigate()
  // Pull coordinate conversion and sizing from context so drag math is always
  // relative to the currently visible window, not the full fiscal year.
  const { dateToX, xToDate, weekPx, chartWidth } = useGantt()

  const geo = barGeometry(phase.startDate, phase.endDate, dateToX, weekPx, chartWidth)
  // Use the shared phase palette so colors stay consistent across views
  const bgColor  = CHART_COLORS.phase[phase.phase] ?? '#60a5fa'
  // QA and Deployed use lighter backgrounds — dark text reads better on those
  const darkText = phase.phase === 'QA' || phase.phase === 'Deployed'

  // Resolve assigned member objects for display in the bar and tooltip
  const phaseMembers = phase.assignments
    .map(a => ({ a, member: members.find(m => m.id === a.memberId) }))
    .filter((x): x is { a: typeof x.a; member: Member } => !!x.member)

  // Hooks must be called before any early return
  const { vLeft, vWidth, isDragging, handleMouseDown } = useBarDrag({
    leftPx:  geo?.leftPx  ?? 0,
    widthPx: geo?.widthPx ?? 0,
    weekPx,
    chartWidth,
    // Click with no drag → open the project detail page
    onEdit: () => navigate(`/projects/${project.id}`, { state: { from: '/planning' } }),
    // Drag commit → update this phase's dates and re-derive root project fields
    onCommit: (newLeft, newWidth) => {
      const newPhases = project.phases!.map((ph, i) =>
        i === phaseIndex
          ? { ...ph, startDate: xToDate(newLeft), endDate: xToDate(newLeft + newWidth) }
          : ph
      )
      const derived = deriveProjectFields(newPhases)
      updateProject(project.id, {
        ...project,
        ...derived,
        phases: newPhases,
      } as Parameters<typeof updateProject>[1])
    },
  })

  const tooltipContent = (
    <div>
      <p className="text-sm font-semibold leading-snug mb-1">{phase.phase}</p>
      <p className="text-[11px] text-slate-300">{phase.startDate} → {phase.endDate}</p>
      <p className="text-[11px] text-slate-300">
        {phase.percentComplete}% complete · {phase.status}
      </p>
      {phaseMembers.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {phaseMembers.map(({ a, member }) => (
            <p key={member.id} className="text-[11px] text-slate-300">
              {member.name} · {a.part} · {a.allocation}%
            </p>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-400 mt-1">Drag to move · drag edges to resize · click to edit</p>
    </div>
  )
  const { onMouseEnter, onMouseMove, onMouseLeave, tip } = useTooltip(tooltipContent)

  if (!geo) return null

  // Abbreviated member names for the bar label — initials when space is tight
  const memberLabel = phaseMembers.map(({ member }) => member.avatarInitials).join(' · ')

  return (
    <>
      <div
        className="absolute group/bar"
        style={{
          top:    rowIndex * 28 + 4,
          left:   vLeft,
          width:  vWidth,
          height: 22,
          zIndex: isDragging ? 20 : undefined,
        }}
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <div
          className={cn(
            'w-full h-full rounded-full flex items-center overflow-hidden relative select-none',
            isDragging ? 'shadow-lg' : 'hover:opacity-90',
          )}
          style={{ background: bgColor, cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
        >
          {/* Left resize zone */}
          <div className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center gap-px shrink-0">
            <div className="w-px h-3 bg-white/30 rounded-full group-hover/bar:bg-white/60 pointer-events-none transition-colors" />
            <div className="w-px h-3 bg-white/30 rounded-full group-hover/bar:bg-white/60 pointer-events-none transition-colors" />
          </div>

          {/* Bar label: phase name · % · member initials */}
          <span className="flex items-baseline gap-1.5 min-w-0 px-4 relative z-10 select-none">
            <span className={cn('text-xs font-semibold truncate min-w-0', darkText ? 'text-slate-900' : 'text-white')}>
              {phase.phase}
            </span>
            {phase.percentComplete > 0 && (
              <span className={cn('text-[10px] font-normal shrink-0', darkText ? 'text-slate-600' : 'text-white/60')}>
                {phase.percentComplete}%
              </span>
            )}
            {memberLabel && (
              <span className={cn('text-[10px] font-normal shrink-0', darkText ? 'text-slate-500' : 'text-white/50')}>
                · {memberLabel}
              </span>
            )}
          </span>

          {/* Right resize zone */}
          <div className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center gap-px shrink-0">
            <div className="w-px h-3 bg-white/30 rounded-full group-hover/bar:bg-white/60 pointer-events-none transition-colors" />
            <div className="w-px h-3 bg-white/30 rounded-full group-hover/bar:bg-white/60 pointer-events-none transition-colors" />
          </div>
        </div>
      </div>
      {tip}
    </>
  )
}

// ─── Project view: one row per project, stacked member bars ───────────────

function PhaseDivider({ phase }: { phase: string }) {
  // Chart width and stripe pattern come from context so the divider row stays
  // the same width as the data rows in all zoom modes.
  const { chartWidth, weekPx } = useGantt()
  const weekStripe = makeStripe(weekPx)
  return (
    <div className="flex border-b border-slate-200" style={{ minHeight: 26, background: 'var(--gantt-section)' }}>
      <div
        className="sticky left-0 z-10 flex items-center px-3 border-r border-slate-200 shrink-0"
        style={{ width: LEFT_COL_W, background: 'var(--gantt-section)' }}
      >
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{phase}</span>
      </div>
      <div style={{ width: chartWidth, backgroundImage: weekStripe }} />
    </div>
  )
}

function ProjectGanttRow({
  project,
  members,
  onEdit,
}: {
  project: Project
  members: Member[]
  /** Opens the project editor — used for both bar clicks and the assign button */
  onEdit: (p: Project) => void
}) {
  // Chart dimensions come from context so this row scales with the active zoom mode.
  const { weekPx, chartWidth, visibleWeeks, visiblePeriods, visibleOffset } = useGantt()
  const weekStripe = makeStripe(weekPx)

  // If the project has an explicit phases array, render phase bars instead of
  // per-member assignment bars. This gives a clearer picture of when each
  // phase of work happens rather than who is doing what.
  const phases    = project.phases ?? []
  const hasPhases = phases.length > 0

  const assigned = project.assignments
    .map(a => ({ a, member: members.find(m => m.id === a.memberId) }))
    .filter((x): x is { a: typeof x.a; member: Member } => !!x.member)

  // Row height scales to whichever list is longer — phases when present,
  // else assigned members, with a minimum of one bar height.
  const rowCount  = hasPhases ? Math.max(phases.length, 1) : Math.max(assigned.length, 1)
  const rowHeight = rowCount * 28 + 8

  return (
    <div className="flex border-b border-slate-100" style={{ minHeight: rowHeight }}>
      {/* Left: project info */}
      <div
        className="sticky left-0 z-10 shrink-0 flex flex-col justify-center px-3 py-2 border-r border-slate-200 gap-1"
        style={{ width: LEFT_COL_W, background: 'var(--gantt-surface)' }}
      >
        {/* Critical flag next to name */}
        <div className="flex items-start gap-1">
          {project.priority === 'Critical' && (
            <Flag size={10} className="text-red-500 shrink-0 mt-0.5" fill="currentColor" />
          )}
          <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">{project.name}</p>
        </div>

        {/* Phase chip + assign chip — match the By Member chip button style */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', PHASE_COLORS[project.phase])}>
            {project.phase}
          </span>
          <button
            onClick={() => onEdit(project)}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors border border-slate-200 hover:border-blue-200"
          >
            {assigned.length > 0
              ? `+ ${assigned.length} member${assigned.length !== 1 ? 's' : ''}`
              : '+ Assign'}
          </button>
        </div>

        {/* Progress bar */}
        {project.percentComplete > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${project.percentComplete}%` }} />
            </div>
            <span className="text-[10px] text-slate-400 shrink-0">{project.percentComplete}%</span>
          </div>
        )}
      </div>

      {/* Chart area — isolated stacking context prevents bars bleeding past sticky col.
          Width and stripe come from context so they resize with the zoom mode. */}
      <div className="relative flex-1 shrink-0 isolate" style={{ width: chartWidth, minHeight: rowHeight, backgroundImage: weekStripe }}>
        {/* Grid lines — positions are relative to visibleOffset so they align
            correctly even when only a subset of weeks are shown (quarter/period zoom). */}
        {visibleWeeks.map(w => (
          <div key={w.index} className="absolute top-0 bottom-0 border-r border-slate-100" style={{ left: (w.index - visibleOffset) * weekPx }} />
        ))}
        {visiblePeriods.map(p => (
          <div key={p.label} className="absolute top-0 bottom-0 border-r border-slate-200" style={{ left: (p.weekStart - visibleOffset) * weekPx }} />
        ))}

        {/* Phase bars — one bar per phase when project has an explicit phases array.
            Fall back to per-member assignment bars for legacy single-phase projects. */}
        {hasPhases ? (
          phases.map((ph, i) => (
            <PhaseBar key={ph.id} phase={ph} phaseIndex={i} project={project} rowIndex={i} members={members} />
          ))
        ) : (
          <>
            {assigned.map(({ a, member }, i) => (
              <AssignmentBar
                key={a.memberId}
                project={project}
                assignment={a}
                member={member}
                rowIndex={i}
                onEdit={() => onEdit(project)}
              />
            ))}
            {assigned.length === 0 && (
              <div className="absolute flex items-center px-3" style={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                <span className="text-xs text-slate-300 italic">No one assigned</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Team section divider ─────────────────────────────────────────────────

function TeamDivider({ team }: { team: Team }) {
  // Chart width and stripe pattern come from context so the divider row stays
  // the same width as the data rows in all zoom modes.
  const { chartWidth, weekPx } = useGantt()
  const weekStripe = makeStripe(weekPx)
  return (
    <div className="flex border-b border-slate-200" style={{ minHeight: 28, background: 'var(--gantt-section)' }}>
      <div
        className="sticky left-0 z-10 flex items-center px-3 border-r border-slate-200 shrink-0"
        style={{ width: LEFT_COL_W, background: 'var(--gantt-section)' }}
      >
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate">
          {team.name}
        </span>
      </div>
      <div style={{ width: chartWidth, backgroundImage: weekStripe }} />
    </div>
  )
}

// roleCategoryOf and ALL_ROLE_CATEGORIES are imported from '@/lib/roles'
// (shared with OrgPage so the filter buckets stay in sync).

// ─── PTO stats helpers ────────────────────────────────────────────────────

/** Today's local date as an ISO string, e.g. "2026-06-05". */
function todayIsoStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** True when a PTO block's [startDate, endDate] range contains the given ISO date. */
function ptoContainsDate(block: PtoBlock, isoDate: string): boolean {
  return block.startDate <= isoDate && block.endDate >= isoDate
}

/** True when a PTO block overlaps the given ISO date range [from, to]. */
function ptoOverlapsRange(block: PtoBlock, from: string, to: string): boolean {
  return block.startDate < to && block.endDate >= from
}

// ─── Capacity Planner page ────────────────────────────────────────────────

export function PlanningPage() {
  const { domains, teams, members, projects, ptoBlocks } = usePortfolioStore()
  const navigate = useNavigate()
  // User mode: filter rows and hide admin controls when a member is selected.
  const { activeMemberId } = useViewStore()
  const isAdmin = activeMemberId === null

  const scrollRef = useRef<HTMLDivElement>(null)
  const [view, setView]     = useState<'member' | 'project'>('member')
  const [search, setSearch] = useState('')
  // People/team/domain multiselect filters — each is independent; all three
  // are ANDed together so a member must pass every active filter to appear.
  const [selectedDomains,         setSelectedDomains]         = useState<string[]>([])
  const [selectedTeams,           setSelectedTeams]           = useState<string[]>([])
  const [selectedMembers,         setSelectedMembers]         = useState<string[]>([])
  const [selectedRoleCategories,  setSelectedRoleCategories]  = useState<string[]>([])
  // Zoom mode: year shows all 52 weeks of the selected FY, quarter shows 13 weeks,
  // period shows 4-5 weeks, week shows 7 days of a single selected week.
  // selectedYearIdx / selectedQIdx / selectedPIdx / selectedWkIdx track which window is shown.
  type ZoomMode = 'year' | 'quarter' | 'period' | 'week'
  const [zoomMode, setZoomMode]             = useState<ZoomMode>('year')
  // selectedYearIdx: which fiscal year is shown (0 = FY2025, 1 = FY2026, 2 = FY2027, 3 = FY2028)
  const [selectedYearIdx, setSelectedYearIdx] = useState<number>(() => currentFYInfo().yearIdx)
  // selectedQIdx: 0-3 within the selected year (Q1=0 … Q4=3)
  const [selectedQIdx, setSelectedQIdx]     = useState<number>(() => currentFYInfo().qIdx)
  const [selectedPIdx, setSelectedPIdx]     = useState<number>(0)
  // selectedWkIdx: global index across all years — defaults to current week
  const [selectedWkIdx, setSelectedWkIdx]   = useState<number>(() => currentFYInfo().wkIdx)

  // Measured width of the scroll container — updated via ResizeObserver so
  // quarter and period views can fill the available space rather than using
  // a fixed px/week value that leaves empty space on wide screens.
  const [containerWidth,  setContainerWidth]  = useState(0)
  // containerHeight tracks the visible height of the scroll panel — needed to
  // compute how many rows fit in the viewport for virtual scrolling.
  const [containerHeight, setContainerHeight] = useState(600)
  // scrollTop mirrors the panel's vertical scroll position so the visible row
  // range can be derived in the render phase without an extra effect.
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    if (!scrollRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setContainerWidth(width)
      setContainerHeight(height)
    })
    ro.observe(scrollRef.current)
    return () => ro.disconnect()
  // scrollRef is a stable ref object; the effect only needs to run once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Derive display values for the selected year/quarter — used in the page header summary.
  const selectedFYYear = FY_YEARS[selectedYearIdx]
  const yearQuartersForDisplay = FY_QUARTERS.filter(q => q.fyYear === selectedFYYear.fyYear)
  const currentQ = yearQuartersForDisplay[selectedQIdx] ?? yearQuartersForDisplay[0]

  // hasScrolled prevents repeat auto-scroll when zoom/year changes after mount.
  const hasScrolled = useRef(false)

  // Build the Gantt context value for the current zoom mode and selected year.
  // Scopes all weeks/periods/quarters to the selected fiscal year first, then
  // further narrows to the selected quarter/period/week window within that year.
  // visibleOffset is the global week index of the first visible week, used to
  // convert global positions to chart-relative pixel positions.
  // Re-computed whenever zoomMode, selectedYearIdx, selectedQIdx, selectedPIdx,
  // selectedWkIdx, or containerWidth changes.
  const ganttConfig = useMemo((): GanttConfig => {
    const availableWidth = containerWidth > LEFT_COL_W ? containerWidth - LEFT_COL_W : 0

    // Scope the calendar to the selected fiscal year first
    const fyYear = FY_YEARS[selectedYearIdx]
    const yearWeeks    = FY_WEEKS.filter(w => w.fyYear === fyYear.fyYear)
    const yearQuarters = FY_QUARTERS.filter(q => q.fyYear === fyYear.fyYear)
    const yearPeriods  = FY_PERIODS.filter(p => p.fyYear === fyYear.fyYear)

    let visibleWeeks: FiscalWeek[]
    let visibleStart: Date
    let weekPx: number
    let visibleOffset: number

    if (zoomMode === 'year') {
      // Show the entire selected fiscal year at the default zoom (80px/week)
      visibleWeeks  = yearWeeks
      visibleStart  = new Date(FY_START)
      visibleStart.setDate(visibleStart.getDate() + fyYear.weekStart * 7)
      weekPx        = 80
      visibleOffset = fyYear.weekStart
    } else if (zoomMode === 'quarter') {
      // Fill available space across 13 weeks of the selected quarter
      const q = yearQuarters[selectedQIdx] ?? yearQuarters[0]
      visibleWeeks  = yearWeeks.filter(w => w.quarterIndex === q.index)
      visibleStart  = new Date(FY_WEEKS[q.weekStart].date)
      weekPx        = availableWidth > 0 ? availableWidth / visibleWeeks.length : 120
      visibleOffset = q.weekStart
    } else if (zoomMode === 'period') {
      // Fill available space across 4-5 weeks of the selected period
      const p = yearPeriods[selectedPIdx] ?? yearPeriods[0]
      visibleWeeks  = yearWeeks.filter(w => w.periodIndex === p.index)
      visibleStart  = new Date(FY_WEEKS[p.weekStart].date)
      weekPx        = availableWidth > 0 ? availableWidth / visibleWeeks.length : 200
      visibleOffset = p.weekStart
    } else {
      // Week mode — single week fills the entire available width so each day is clearly readable.
      // weekPx here represents the full week; individual day columns use weekPx/7.
      const w = FY_WEEKS[selectedWkIdx]
      visibleWeeks  = [w]
      visibleStart  = new Date(w.date)
      weekPx        = availableWidth > 0 ? availableWidth : 980
      visibleOffset = selectedWkIdx
    }

    const chartWidth = visibleWeeks.length * weekPx

    // Periods visible in the window — include a period if any of its weeks are visible.
    // weekCount is clamped to the number of visible weeks so the header cell widths sum
    // to exactly chartWidth (important for today marker alignment).
    const visiblePeriodIndices = new Set(visibleWeeks.map(w => w.periodIndex))
    const visiblePeriods: FiscalPeriod[] = FY_PERIODS
      .filter(p => visiblePeriodIndices.has(p.index))
      .map(p => {
        const weeksInPeriod = visibleWeeks.filter(w => w.periodIndex === p.index).length
        return { ...p, weekCount: weeksInPeriod }
      })

    // Quarters — show the parent quarters of all visible weeks.
    // Each entry's weekCount = number of visible weeks it contributes.
    const visibleQIndices = new Set(visibleWeeks.map(w => w.quarterIndex))
    const visibleQuarters: FiscalQuarter[] = FY_QUARTERS
      .filter(q => visibleQIndices.has(q.index))
      .map(q => {
        const weeksInQ = visibleWeeks.filter(w => w.quarterIndex === q.index).length
        return { ...q, weekCount: weeksInQ }
      })

    // Dynamic coordinate functions relative to the visible window's start date.
    // These replace the module-level dateToX / xToDate for all child components.
    const dToX = (iso: string): number => {
      if (!iso) return -1
      const d = new Date(iso + 'T00:00:00')
      return (daysBetween(visibleStart, d) / 7) * weekPx
    }

    const xToD = (px: number): string => {
      const clamped = Math.max(0, Math.min(px, chartWidth))
      const days = Math.round((clamped / weekPx) * 7)
      const d = new Date(visibleStart)
      d.setDate(d.getDate() + days)
      return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ].join('-')
    }

    // Today's pixel position relative to visibleStart.
    // Offset by half a day so the line sits in the middle of today's column.
    const now = new Date()
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const todayXPos = dToX(todayIso) + weekPx / 14

    // In week mode, generate the 7 individual days of the visible week so
    // GanttHeaders can render a day-of-week row below the week date row.
    // Each day label uses short weekday + numeric date (e.g. "Mon 2").
    const weekDays = zoomMode === 'week'
      ? Array.from({ length: 7 }, (_, i) => {
          const d = new Date(visibleStart)
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
      dateToX: dToX,
      xToDate: xToD,
      weekDays,
    }
  }, [zoomMode, selectedYearIdx, selectedQIdx, selectedPIdx, selectedWkIdx, containerWidth])

  // Auto-scroll to today on first render, using the context's todayXPos which is
  // already relative to the visible window's start — no need for a module-level todayX().
  useEffect(() => {
    if (!scrollRef.current || hasScrolled.current || ganttConfig.todayXPos <= 0) return
    hasScrolled.current = true
    const scrollTarget = Math.max(0, ganttConfig.todayXPos - 2 * ganttConfig.weekPx)
    scrollRef.current.scrollLeft = scrollTarget
  }, [ganttConfig.todayXPos, ganttConfig.weekPx])

  // Unique phases used by plotted projects, sorted in SDLC order, for the By Member legend.
  const legendPhases = useMemo(() => {
    const phases = new Set<ProjectPhase>()
    projects
      .filter(p => p.startDate || p.targetEndDate)
      .forEach(p => phases.add(p.phase))
    return PHASE_ORDER.filter(ph => phases.has(ph))
  }, [projects])

  // SDLC roles actually used in plotted projects, for the By Project legend.
  // Only approved roles (from SDLC_ROLES) are included — stale seed-data role
  // names that don't match the current list are silently dropped.
  // Order follows the canonical SDLC_ROLES list, not alphabetical.
  const legendParts = useMemo(() => {
    const used = new Set<string>()
    projects
      .filter(p => p.startDate || p.targetEndDate)
      .forEach(p => p.assignments.forEach(a => {
        // Each assignment may have multiple comma-separated roles; check all of them
        a.part?.split(',').forEach(r => {
          const role = r.trim()
          if (role) used.add(role)
        })
      }))
    // Return in canonical role order, skipping any that aren't in the approved list
    return SDLC_ROLES.filter(role => used.has(role))
  }, [projects])

  // Resolve the three people/team/domain multiselect filters into a Set of
  // member IDs. null means no restriction (all filters are empty).
  // A member must pass ALL active filters (Domain AND Team AND Member).
  const selectedMemberIds = useMemo((): Set<string> | null => {
    const anyActive = selectedDomains.length > 0 || selectedTeams.length > 0 ||
                      selectedMembers.length > 0 || selectedRoleCategories.length > 0
    if (!anyActive) return null

    return new Set(
      members
        .filter(m => {
          const memberTeam = teams.find(t => t.memberIds.includes(m.id))
          if (!memberTeam) return false
          // Domain filter
          if (selectedDomains.length > 0 && !selectedDomains.includes(memberTeam.domainId)) return false
          // Team filter
          if (selectedTeams.length > 0 && !selectedTeams.includes(memberTeam.id)) return false
          // Member filter
          if (selectedMembers.length > 0 && !selectedMembers.includes(m.id)) return false
          // Role category filter
          if (selectedRoleCategories.length > 0 && !selectedRoleCategories.includes(roleCategoryOf(m.role))) return false
          return true
        })
        .map(m => m.id)
    )
  }, [selectedDomains, selectedTeams, selectedMembers, selectedRoleCategories, members, teams])

  // Normalised search term — used to filter both views
  const q = search.trim().toLowerCase()

  // Projects grouped by phase for the By Project view.
  // Filtered by text search and the people/team/domain multiselect dropdowns.
  // A project is shown if at least one of its assigned members passes the filter.
  const projectsByPhase = useMemo(() => {
    // Build a flat id→name map once so the search filter below runs in O(1)
    // per assignment rather than O(M) per assignment via Array.find().
    const memberNameById = new Map(members.map(m => [m.id, m.name.toLowerCase()]))

    // Use the canonical PHASE_ORDER so grouping always follows SDLC sequence,
    // not insertion order of the projects array.
    return PHASE_ORDER
      .map(ph => ({
        phase: ph,
        projects: projects
          .filter(p => {
            if (p.phase !== ph) return false
            if (!p.startDate && !p.targetEndDate) return false
            if (!isAdmin && !p.assignments.some(a => a.memberId === activeMemberId)) return false
            // People/team/domain multiselect: keep only projects with ≥1 matching member
            if (selectedMemberIds && !p.assignments.some(a => selectedMemberIds.has(a.memberId))) return false
            if (!q) return true
            // Text search: match project name or any assigned member's name (O(1) map lookup)
            if (p.name.toLowerCase().includes(q)) return true
            return p.assignments.some(a => memberNameById.get(a.memberId)?.includes(q))
          })
          .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')),
      }))
      .filter(g => g.projects.length > 0)
  }, [projects, activeMemberId, isAdmin, q, members, selectedMemberIds])

  // Group members by team for the By Member view.
  // Filtered by text search and the people/team/domain multiselect dropdowns.
  const grouped = useMemo(() => {
    return domains.map(d => {
      const domainTeams = teams.filter(t => t.domainId === d.id)
      return {
        domain: d,
        teams: domainTeams.map(t => ({
          team: t,
          members: members.filter(m => {
            if (!t.memberIds.includes(m.id)) return false
            if (!isAdmin && m.id !== activeMemberId) return false
            // People/team/domain multiselect
            if (selectedMemberIds && !selectedMemberIds.has(m.id)) return false
            if (!q) return true
            // Text search: member name, team name, or any of their project names
            if (m.name.toLowerCase().includes(q)) return true
            if (t.name.toLowerCase().includes(q)) return true
            return projects.some(p =>
              p.assignments.some(a => a.memberId === m.id) &&
              p.name.toLowerCase().includes(q)
            )
          }),
        })).filter(t => t.members.length > 0),
      }
    }).filter(d => d.teams.length > 0)
  }, [domains, teams, members, activeMemberId, isAdmin, q, projects, selectedMemberIds])

  // ── Virtual scroll flat-row list ──────────────────────────────────────────
  // Flatten the nested domain→team→member (or phase→project) hierarchy into a
  // 1-D array with a pre-computed pixel height for each row. The virtual scroll
  // logic uses this to render only the subset of rows that fall inside (or just
  // outside) the visible viewport, keeping the DOM small even with 5 000+ rows.
  //
  // Row heights mirror the same formulas used inside MemberGanttRow /
  // ProjectGanttRow to ensure the spacers are exactly the right size.

  type FlatGanttRow =
    | { kind: 'team-divider';  team: Team;       height: number }
    | { kind: 'member';        member: Member;    mProjects: Project[]; mPto: PtoBlock[]; height: number }
    | { kind: 'phase-divider'; phase: ProjectPhase; height: number }
    | { kind: 'project';       project: Project;  height: number }

  const flatRows = useMemo<FlatGanttRow[]>(() => {
    const rows: FlatGanttRow[] = []
    if (view === 'member') {
      for (const { teams: dTeams } of grouped) {
        for (const { team, members: teamMembers } of dTeams) {
          rows.push({ kind: 'team-divider', team, height: DIVIDER_H })
          for (const m of teamMembers) {
            const mProjects = projects.filter(p => p.assignments.some(a => a.memberId === m.id))
            const mPto      = ptoBlocks.filter(b => b.memberId === m.id)
            const rowCount  = Math.max(mProjects.length, 1)
            const height    = (mPto.length > 0 ? PTO_SLOT_H : 0) + rowCount * ROW_BAR_H + ROW_PAD_H
            rows.push({ kind: 'member', member: m, mProjects, mPto, height })
          }
        }
      }
    } else {
      for (const { phase, projects: phaseProjects } of projectsByPhase) {
        rows.push({ kind: 'phase-divider', phase, height: DIVIDER_H })
        for (const p of phaseProjects) {
          // Mirror ProjectGanttRow's own height calculation:
          //   multi-phase projects → one slot per phase
          //   legacy projects       → one slot per assignment (or 1 if unassigned)
          const rowCount = p.phases?.length
            ? Math.max(p.phases.length, 1)
            : Math.max(p.assignments.length, 1)
          rows.push({ kind: 'project', project: p, height: rowCount * ROW_BAR_H + ROW_PAD_H })
        }
      }
    }
    return rows
  }, [view, grouped, projectsByPhase, projects, ptoBlocks])

  // Prefix-sum array over flatRows heights — cum[i] is the pixel offset of the
  // top of row i from the very top of the rows container.
  const cumHeights = useMemo(() => {
    const cum = new Array<number>(flatRows.length + 1)
    cum[0] = 0
    for (let i = 0; i < flatRows.length; i++) cum[i + 1] = cum[i] + flatRows[i].height
    return cum
  }, [flatRows])

  // ── Capacity summary stats ────────────────────────────────────────────────
  const totalMembers = members.length
  const memberAllocations = members.map(m => {
    const mProjects = projects.filter(p => p.assignments.some(a => a.memberId === m.id))
    return calcMemberAllocation(m.id, mProjects)
  })
  const avgAlloc = totalMembers
    ? Math.round(memberAllocations.reduce((a, b) => a + b, 0) / totalMembers)
    : 0
  const overCapacity = memberAllocations.filter(a => a > 100).length
  const atRisk       = memberAllocations.filter(a => a > 80 && a <= 100).length

  // ── PTO summary stats ─────────────────────────────────────────────────────
  const ptoStats = useMemo(() => {
    const today = todayIsoStr()
    const { qStart, qEnd } = getCurrentQBounds()
    const qStartIso = qStart.toISOString().slice(0, 10)
    const qEndIso   = qEnd.toISOString().slice(0, 10)
    const in14 = new Date()
    in14.setDate(in14.getDate() + 14)
    const in14Iso = `${in14.getFullYear()}-${String(in14.getMonth() + 1).padStart(2, '0')}-${String(in14.getDate()).padStart(2, '0')}`
    return {
      onPtoToday:    ptoBlocks.filter(b => ptoContainsDate(b, today)).length,
      thisQuarter:   ptoBlocks.filter(b => ptoOverlapsRange(b, qStartIso, qEndIso)).length,
      upcomingBlocks: ptoBlocks.filter(b => b.startDate > today && b.startDate <= in14Iso).length,
    }
  }, [ptoBlocks])

  return (
    <div className="flex flex-col h-full px-8 pt-8 pb-4 w-full gap-3">
      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planning</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {(() => {
              const active   = projects.filter(p => p.status === 'In Progress').length
              const blocked  = projects.filter(p => p.status === 'Blocked').length
              const complete = projects.filter(p => p.status === 'Complete').length
              return (
                <>
                  <span className="text-slate-700 font-medium">{active}</span> in flight
                  {' · '}
                  <span className={blocked > 0 ? 'text-red-500 font-medium' : 'text-slate-700 font-medium'}>{blocked}</span> blocked
                  {' · '}
                  <span className="text-green-600 font-medium">{complete}</span> complete
                  {overCapacity > 0 && (
                    <> · <span className="text-red-500 font-medium">{overCapacity} over capacity</span></>
                  )}
                </>
              )
            })()}
          </p>
        </div>
        {/* Print report — navigates to the standalone PrintPage (/print) */}
        <Link
          to="/print"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 transition-colors shrink-0"
          title="Open printable capacity report"
        >
          <Printer size={13} />
          Print Report
        </Link>
      </div>

      {/* Stats bar — 7 equal-width metric cards in one row.
          Capacity cards on the left, PTO cards on the right, divided by a hairline. */}
      <div className="flex gap-2 shrink-0">
        {([
          { label: 'Total Members',  value: totalMembers,         sub: 'in the org',       icon: <Users2 size={14} />,        iconCls: 'bg-blue-100 text-blue-600'     },
          { label: 'Over Capacity',  value: overCapacity,         sub: 'over 100%',         icon: <Zap size={14} />,           iconCls: 'bg-red-100 text-red-500'       },
          { label: 'At Risk (>80%)', value: atRisk,               sub: '80–100% alloc',     icon: <AlertTriangle size={14} />, iconCls: 'bg-amber-100 text-amber-500'   },
          { label: 'Avg Allocation', value: `${avgAlloc}%`,       sub: 'across all members', icon: <TrendingUp size={14} />,   iconCls: 'bg-violet-100 text-violet-500' },
        ] as const).map(c => (
          <div key={c.label} className="flex-1 min-w-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded', c.iconCls)}>{c.icon}</span>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">{c.label}</p>
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none">{c.value}</p>
            <p className="text-[11px] text-slate-400 truncate">{c.sub}</p>
          </div>
        ))}

        {/* Divider between capacity and PTO sections */}
        <div className="w-px bg-slate-200 dark:bg-slate-700 self-stretch mx-1" />

        {([
          { label: 'On PTO Today',        value: ptoStats.onPtoToday,     sub: 'currently out',  icon: <CalendarOff size={14} />, iconCls: 'bg-amber-100 text-amber-500' },
          { label: 'PTO Blocks This Qtr', value: ptoStats.thisQuarter,    sub: 'all members',    icon: <CalendarOff size={14} />, iconCls: 'bg-amber-100 text-amber-500' },
          { label: 'Upcoming (14 Days)',   value: ptoStats.upcomingBlocks, sub: 'starting soon',  icon: <CalendarOff size={14} />, iconCls: 'bg-amber-100 text-amber-500' },
        ] as const).map(c => (
          <div key={c.label} className="flex-1 min-w-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded', c.iconCls)}>{c.icon}</span>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">{c.label}</p>
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none">{c.value}</p>
            <p className="text-[11px] text-slate-400 truncate">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Color legends — phase legend for member view, SDLC role legend for project view */}
      {view === 'member' && legendPhases.length > 0 && (
        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap shrink-0 px-1">
          <span className="text-xs font-medium text-slate-400 shrink-0">Phase</span>
          {legendPhases.map(phase => (
            <div key={phase} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS.phase[phase] ?? '#60a5fa' }} />
              <span className="text-xs text-slate-600">{phase}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-amber-400" />
            <span className="text-xs text-slate-600">PTO</span>
          </div>
        </div>
      )}
      {view === 'project' && legendParts.length > 0 && (
        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap shrink-0 px-1">
          <span className="text-xs font-medium text-slate-400 shrink-0">Role</span>
          {legendParts.map(part => (
            <div key={part} className="flex items-center gap-1.5">
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', PART_COLORS[part] ?? DEFAULT_PART_COLOR)} />
              <span className="text-xs text-slate-600">{part}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search + people/team/domain multiselect filters */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search project, member, or team…"
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          )}
        </div>

        {/* "Filter" section label — visually groups the domain/team/member selects */}
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 ml-3">Filter</span>

        {/* Domain filter */}
        <MultiSelectDropdown
          label="Domain"
          options={domains.map(d => ({ id: d.id, label: d.name }))}
          selected={selectedDomains}
          onChange={setSelectedDomains}
        />

        {/* Team filter */}
        <MultiSelectDropdown
          label="Team"
          options={teams.map(t => ({ id: t.id, label: t.name }))}
          selected={selectedTeams}
          onChange={setSelectedTeams}
        />

        {/* Member filter */}
        <MultiSelectDropdown
          label="Member"
          options={members.map(m => ({ id: m.id, label: m.name }))}
          selected={selectedMembers}
          onChange={setSelectedMembers}
        />

        {/* Role category filter — groups members by discipline (Engineering, QA, etc.) */}
        <MultiSelectDropdown
          label="Role"
          options={ALL_ROLE_CATEGORIES.map(cat => ({ id: cat, label: cat }))}
          selected={selectedRoleCategories}
          onChange={setSelectedRoleCategories}
        />

        {/* "View" section label — visually groups the zoom mode toggle and year/Q/P/W nav */}
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 ml-2">View</span>

        {/* Zoom mode toggle — inline, right after the View label so it's close
            to the content it affects. Navigation arrows appear beside it when a
            sub-window (quarter / period / week) is selected. */}
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
          >
            ‹
          </button>
          <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            FY{FY_YEARS[selectedYearIdx].fyYear}
          </span>
          <button
            onClick={() => setSelectedYearIdx(i => Math.min(FY_YEARS.length - 1, i + 1))}
            disabled={selectedYearIdx === FY_YEARS.length - 1}
            className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
            title="Next fiscal year"
          >
            ›
          </button>
        </div>

        {/* Quarter navigation — prev/next arrows with the current quarter label (within selected year) */}
        {zoomMode === 'quarter' && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setSelectedQIdx(i => Math.max(0, i - 1))}
              disabled={selectedQIdx === 0}
              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
              title="Previous quarter"
            >
              ‹
            </button>
            <span className="text-xs font-semibold text-slate-700 w-6 text-center">
              {yearQuartersForDisplay[selectedQIdx]?.label}
            </span>
            <button
              onClick={() => setSelectedQIdx(i => Math.min(yearQuartersForDisplay.length - 1, i + 1))}
              disabled={selectedQIdx === yearQuartersForDisplay.length - 1}
              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
              title="Next quarter"
            >
              ›
            </button>
          </div>
        )}

        {/* Period (Month) navigation — shows abbreviated month name; periods are scoped to selected year */}
        {zoomMode === 'period' && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setSelectedPIdx(i => Math.max(0, i - 1))}
              disabled={selectedPIdx === 0}
              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
              title="Previous period"
            >
              ‹
            </button>
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              {FY_PERIODS.filter(p => p.fyYear === FY_YEARS[selectedYearIdx].fyYear)[selectedPIdx]?.monthLabel}
            </span>
            <button
              onClick={() => setSelectedPIdx(i => Math.min(FY_PERIODS.filter(p => p.fyYear === FY_YEARS[selectedYearIdx].fyYear).length - 1, i + 1))}
              disabled={selectedPIdx === FY_PERIODS.filter(p => p.fyYear === FY_YEARS[selectedYearIdx].fyYear).length - 1}
              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
              title="Next period"
            >
              ›
            </button>
          </div>
        )}

        {/* Week navigation — prev/next arrows with the week's start date label */}
        {zoomMode === 'week' && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setSelectedWkIdx(i => Math.max(0, i - 1))}
              disabled={selectedWkIdx === 0}
              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
              title="Previous week"
            >
              ‹
            </button>
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              {formatWeekLabel(FY_WEEKS[selectedWkIdx].date)}
            </span>
            <button
              onClick={() => setSelectedWkIdx(i => Math.min(FY_WEEKS.length - 1, i + 1))}
              disabled={selectedWkIdx === FY_WEEKS.length - 1}
              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
              title="Next week"
            >
              ›
            </button>
          </div>
        )}

        {/* Clear all — only shown when any multiselect filter is active */}
        {(selectedDomains.length > 0 || selectedTeams.length > 0 || selectedMembers.length > 0 || selectedRoleCategories.length > 0) && (
          <button
            onClick={() => { setSelectedDomains([]); setSelectedTeams([]); setSelectedMembers([]); setSelectedRoleCategories([]) }}
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Gantt — wrapped in GanttCtx.Provider so all descendant components (headers,
          row bars, dividers) receive the correct zoom-relative chart dimensions and
          coordinate functions without prop drilling. */}
      <GanttCtx.Provider value={ganttConfig}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-auto border border-slate-200 rounded-xl"
        style={{ minHeight: 0, background: 'var(--gantt-surface)' }}
        onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
      >
        {/* Sticky header (calendar rows).
            minWidth uses ganttConfig.chartWidth so the header always spans exactly
            the visible window, regardless of zoom mode. */}
        <div className="sticky top-0 z-20 flex" style={{ minWidth: LEFT_COL_W + ganttConfig.chartWidth }}>
          {/* Left column header — view toggle lives here instead of the page header */}
          <div
            className="sticky left-0 z-30 border-r border-b border-slate-200 shrink-0 flex items-center justify-center"
            style={{ width: LEFT_COL_W, background: 'var(--gantt-surface)' }}
          >
            <SegmentedControl
              options={[
                { value: 'member',  label: 'Member' },
                { value: 'project', label: 'Epic' },
              ] as { value: typeof view; label: string }[]}
              value={view}
              onChange={setView}
            />
          </div>
          {/* Calendar headers — reads dimensions and visible windows from GanttCtx */}
          <GanttHeaders />
        </div>

        {/* Rows — virtual-scrolled so only the rows visible in the viewport (plus
            OVERSCAN buffer rows above/below) are mounted. With large datasets (5 000+
            epics) this keeps the DOM small and prevents the browser from locking up.
            paddingTop / paddingBottom spacers give the scrollbar the correct travel
            distance as if all rows were rendered. The today line spans the full total
            height so it's never clipped by the spacers. */}
        {(() => {
          const totalH     = cumHeights[flatRows.length]
          const startIdx   = Math.max(0, lowerBound(cumHeights, scrollTop) - OVERSCAN)
          const endIdx     = Math.min(flatRows.length - 1, lowerBound(cumHeights, scrollTop + containerHeight) + OVERSCAN)
          const paddingTop = cumHeights[startIdx]
          const paddingBot = totalH - cumHeights[Math.min(endIdx + 1, flatRows.length)]

          return (
            <div className="relative" style={{ minWidth: LEFT_COL_W + ganttConfig.chartWidth }}>
              {ganttConfig.todayXPos >= 0 && ganttConfig.todayXPos <= ganttConfig.chartWidth && (
                <div
                  className="absolute w-px bg-red-500 pointer-events-none"
                  style={{ left: LEFT_COL_W + ganttConfig.todayXPos, top: 0, height: Math.max(totalH, 400), zIndex: 5 }}
                />
              )}
              <div style={{ height: paddingTop }} />
              {flatRows.slice(startIdx, endIdx + 1).map(row => {
                if (row.kind === 'team-divider')  return <TeamDivider  key={row.team.id}  team={row.team} />
                if (row.kind === 'member')         return <MemberGanttRow key={row.member.id} member={row.member} memberProjects={row.mProjects} memberPto={row.mPto} />
                if (row.kind === 'phase-divider')  return <PhaseDivider  key={row.phase}    phase={row.phase} />
                return (
                  <ProjectGanttRow
                    key={row.project.id}
                    project={row.project}
                    members={members}
                    onEdit={proj => navigate(`/projects/${proj.id}`, { state: { from: '/planning' } })}
                  />
                )
              })}
              <div style={{ height: paddingBot }} />
            </div>
          )
        })()}
      </div>
      </GanttCtx.Provider>
    </div>
  )
}
