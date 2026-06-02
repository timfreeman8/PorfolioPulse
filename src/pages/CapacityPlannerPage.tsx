import { useState, useRef, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Palmtree, Trash2, Flag, Search, Printer } from 'lucide-react'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
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
import { PHASE_COLORS, CHART_COLORS, STATUS_COLORS, PRIORITY_COLORS, avatarColor } from '@/lib/colors'
import { SDLC_ROLES, ROLE_COLORS, DEFAULT_ROLE_COLOR } from '@/lib/roles'
import { getCurrentQBounds } from '@/lib/fiscal'
import { cn } from '@/lib/utils'
import type { Project, ProjectPhase, Member, Team, PtoBlock, ProjectMemberAssignment } from '@/types'

/**
 * Capacity Planner page — Gantt-style chart of member workload across FY2026.
 *
 * Two views:
 *   By Member — one row per person, bars = their assigned projects + PTO.
 *               Stacked bars when a member has multiple concurrent projects.
 *   By Project — one row per project, bars = each assigned member's work window,
 *                colored by their SDLC role (Frontend, QA, PM, etc.).
 *
 * The horizontal axis is the Kroger 4-5-4 NRF fiscal calendar. All pixel
 * positions are derived from `dateToX()` which converts an ISO date to a pixel
 * offset from FY_START. WEEK_PX controls the zoom level.
 */

// ─── Fiscal calendar — Kroger 4-5-4 NRF FY2026 ───────────────────────────
// FY2026: Feb 1, 2026 (Sun) – Jan 31, 2027

const FY_START = new Date('2026-02-01T00:00:00')   // Sunday
const WEEK_PX  = 80

// The 4-5-4 pattern groups weeks into periods (months): 4 weeks, 5 weeks, 4 weeks,
// repeating across 4 quarters. This gives 12 periods and exactly 52 weeks per year.
// Each quarter = 13 weeks (4+5+4). P1 starts on FY_START.
const PERIOD_WEEKS = [4, 5, 4,  4, 5, 4,  4, 5, 4,  4, 5, 4]  // P1–P12

interface FiscalWeek {
  index: number       // 0-based week index from FY_START
  date: Date          // Sunday of the week
  periodIndex: number // 0-based (P1 = 0)
  quarterIndex: number // 0-based (Q1 = 0)
  weekInPeriod: number // 1-based
}

interface FiscalPeriod {
  index: number       // 0-based
  label: string       // "P1" … "P12"
  quarterIndex: number
  weekStart: number   // first week index
  weekCount: number
}

interface FiscalQuarter {
  index: number
  label: string       // "Q1" … "Q4"
  weekStart: number
  weekCount: number   // always 13
}

function buildFiscalCalendar(): { weeks: FiscalWeek[]; periods: FiscalPeriod[]; quarters: FiscalQuarter[] } {
  const weeks: FiscalWeek[] = []
  const periods: FiscalPeriod[] = []
  const quarters: FiscalQuarter[] = []

  let weekIndex = 0

  for (let qi = 0; qi < 4; qi++) {
    const qWeekStart = weekIndex
    const pattern = [PERIOD_WEEKS[qi * 3], PERIOD_WEEKS[qi * 3 + 1], PERIOD_WEEKS[qi * 3 + 2]]

    for (let pi = 0; pi < 3; pi++) {
      const pWeekStart = weekIndex
      const count = pattern[pi]
      const periodIdx = qi * 3 + pi

      for (let w = 0; w < count; w++) {
        const date = new Date(FY_START)
        date.setDate(date.getDate() + weekIndex * 7)
        weeks.push({
          index: weekIndex,
          date,
          periodIndex: periodIdx,
          quarterIndex: qi,
          weekInPeriod: w + 1,
        })
        weekIndex++
      }

      periods.push({
        index: periodIdx,
        label: `P${periodIdx + 1}`,
        quarterIndex: qi,
        weekStart: pWeekStart,
        weekCount: count,
      })
    }

    quarters.push({
      index: qi,
      label: `Q${qi + 1}`,
      weekStart: qWeekStart,
      weekCount: 13,
    })
  }

  return { weeks, periods, quarters }
}

const { weeks: FY_WEEKS, periods: FY_PERIODS, quarters: FY_QUARTERS } = buildFiscalCalendar()
const FY_TOTAL_WEEKS = FY_WEEKS.length  // 52
const CHART_WIDTH    = FY_TOTAL_WEEKS * WEEK_PX
const LEFT_COL_W     = 200  // px

// Alternating week column background — every other 80px stripe gets a very
// light tint so week boundaries are immediately readable without grid-line clutter.
// Uses a CSS variable so dark mode automatically flips the stripe opacity.
const WEEK_STRIPE_BG = `repeating-linear-gradient(90deg, transparent 0px, transparent ${WEEK_PX}px, var(--gantt-stripe) ${WEEK_PX}px, var(--gantt-stripe) ${WEEK_PX * 2}px)`

// Gantt bar colors come from the shared roles file — same source as the form's
// Part/Responsibility chip picker, so bar color always matches the chip color.
const PART_COLORS = ROLE_COLORS
const DEFAULT_PART_COLOR = DEFAULT_ROLE_COLOR

// ─── Calendar math helpers ────────────────────────────────────────────────
// Core idea: every date on the timeline maps to a pixel offset from the left
// edge of the chart. dateToX() is the single conversion point — everything
// else (bar positions, today line, auto-scroll target) is derived from it.

/** Number of whole days from a to b. Negative when b is before a. */
function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * Convert an ISO date string to a pixel x-position relative to FY_START.
 * Days are converted to fractional weeks, then multiplied by WEEK_PX.
 * Returns -1 for empty/invalid input so callers can detect missing dates.
 */
function dateToX(iso: string): number {
  if (!iso) return -1
  const d = new Date(iso + 'T00:00:00')
  const days = daysBetween(FY_START, d)
  return (days / 7) * WEEK_PX
}

/**
 * Pixel position of today's date on the chart.
 * Uses local date parts (not toISOString which returns UTC) to avoid
 * the line appearing one day behind near midnight in negative-offset timezones.
 */
function todayX(): number {
  const now = new Date()
  const localIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  // Add half a day so the line sits in the middle of today rather than at
  // its left edge — prevents it from looking like it's on the previous day
  // when today falls near the start of a week column.
  return dateToX(localIso) + WEEK_PX / 14
}

/**
 * Which fiscal quarter contains today, as a 0-based index (Q1=0 … Q4=3).
 * Walks quarters right-to-left and returns the first one whose start is
 * at or before today. Returns 0 if today is before the fiscal year starts.
 */
function currentQuarterIndex(): number {
  const tx = todayX()
  for (let i = FY_QUARTERS.length - 1; i >= 0; i--) {
    if (tx >= FY_QUARTERS[i].weekStart * WEEK_PX) return i
  }
  return 0
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
 *  1. Convert start/end ISO dates to raw pixel offsets via dateToX().
 *  2. Enforce a minimum bar width of half a week so short projects are still visible.
 *  3. Clamp both edges to [0, CHART_WIDTH] so bars don't overflow the FY range.
 *  4. Return null if the bar would be invisible (missing dates or fully off-screen).
 *
 * Used by ProjectBar, PtoBar, and ProjectGanttRow — the single place where
 * date-to-pixel math lives so all bars behave consistently.
 */
function barGeometry(
  startIso: string | undefined,
  endIso: string | undefined,
): { leftPx: number; widthPx: number } | null {
  if (!startIso || !endIso) return null
  const rawLeft  = dateToX(startIso)
  const rawRight = dateToX(endIso)
  const rawWidth = Math.max(rawRight - rawLeft, WEEK_PX * 0.5)  // min half-week
  const clampedLeft  = Math.max(0, rawLeft)
  const clampedWidth = Math.min(CHART_WIDTH, rawLeft + rawWidth) - clampedLeft
  if (clampedWidth <= 0) return null
  return { leftPx: clampedLeft, widthPx: clampedWidth }
}

/**
 * Convert a pixel x-offset back to an ISO date string — the inverse of dateToX.
 * Used by the drag system to turn a bar's final pixel position into dates.
 * Snaps to whole days; clamps to the FY range.
 */
function xToDate(px: number): string {
  const clamped = Math.max(0, Math.min(px, CHART_WIDTH))
  const days = Math.round((clamped / WEEK_PX) * 7)
  const d = new Date(FY_START)
  d.setDate(d.getDate() + days)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
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
  onEdit,
  onCommit,
}: {
  leftPx: number
  widthPx: number
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
    const DAY_PX      = WEEK_PX / 7  // pixels per day, used for snapping
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
        cl = Math.max(0, Math.min(startLeft + snapped, CHART_WIDTH - startWidth))
        cw = startWidth
      } else if (mode === 'resize-left') {
        const d = Math.max(-startLeft, Math.min(snapped, startWidth - MIN_W))
        cl = startLeft + d
        cw = startWidth - d
      } else {
        cw = Math.max(MIN_W, Math.min(startWidth + snapped, CHART_WIDTH - startLeft))
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

function GanttHeaders({ todayLeftPx }: { todayLeftPx: number }) {
  return (
    <div className="relative" style={{ width: CHART_WIDTH }}>
      {/* FY row — very subtle; just an anchor label */}
      <div
        className="flex items-center text-xs text-slate-500 font-medium px-2 border-b border-slate-100"
        style={{ height: 24, width: CHART_WIDTH, background: 'var(--gantt-surface)' }}
      >
        FY2026
      </div>

      {/* Quarter row — alternating bg so Q boundaries are immediately visible.
          Uses CSS vars instead of hardcoded hex so dark mode works without JS. */}
      <div className="flex border-b border-slate-200" style={{ height: 24 }}>
        {FY_QUARTERS.map(q => (
          <div
            key={q.label}
            className="flex items-center justify-center text-xs font-semibold text-slate-500 border-r border-slate-200"
            style={{
              width: q.weekCount * WEEK_PX,
              background: q.index % 2 === 0 ? 'var(--gantt-q-even)' : 'var(--gantt-q-odd)',
            }}
          >
            {q.label}
          </div>
        ))}
      </div>

      {/* Period row — alternating bg matches its parent quarter's shade for rhythm */}
      <div className="flex border-b border-slate-200" style={{ height: 22 }}>
        {FY_PERIODS.map(p => (
          <div
            key={p.label}
            className="flex items-center justify-center text-xs font-medium text-slate-500 border-r border-slate-200 font-semibold"
            style={{
              width: p.weekCount * WEEK_PX,
              background: p.index % 2 === 0 ? 'var(--gantt-p-even)' : 'var(--gantt-p-odd)',
            }}
          >
            {p.label}
          </div>
        ))}
      </div>

      {/* Week date row — subtle alternating bg so individual weeks are easy to scan */}
      <div className="flex border-b border-slate-200" style={{ height: 22 }}>
        {FY_WEEKS.map(w => (
          <div
            key={w.index}
            className="flex items-center justify-center text-xs text-slate-500 border-r border-slate-100 shrink-0"
            style={{
              width: WEEK_PX,
              background: w.index % 2 === 0 ? 'var(--gantt-w-even)' : 'var(--gantt-w-odd)',
            }}
          >
            {formatWeekLabel(w.date)}
          </div>
        ))}
      </div>

      {/* Today marker — container sits at exactly left: todayLeftPx (no transform),
          so the w-px stem line inside stays pixel-perfect with the rows' today line.
          The badge text gets its own translateX(-50%) that only affects its visual
          centering without touching the line position.
          Flex-col layout means the line starts at the badge's bottom edge — it never
          pokes out above the badge. */}
      {todayLeftPx >= 0 && todayLeftPx <= CHART_WIDTH && (
        <div
          className="absolute top-0 bottom-0 flex flex-col items-start pointer-events-none"
          style={{ left: todayLeftPx, zIndex: 15 }}
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

  const assignment = project.assignments.find(a => a.memberId === memberId)
  const barStart   = assignment?.startDate || project.startDate
  const barEnd     = assignment?.endDate   || project.targetEndDate
  const geo        = barGeometry(barStart, barEnd)

  const allocation = assignment?.allocation ?? 0
  const meta       = [project.phase, assignment?.part].filter(Boolean).join(' · ')
  const bgColor    = CHART_COLORS.phase[project.phase] ?? '#60a5fa'
  const darkText   = project.phase === 'QA' || project.phase === 'Deployed'
  const isCritical = project.priority === 'Critical'

  // Hooks must be called before any early return
  const { vLeft, vWidth, isDragging, handleMouseDown } = useBarDrag({
    leftPx:   geo?.leftPx  ?? 0,
    widthPx:  geo?.widthPx ?? 0,
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
  const geo = barGeometry(pto.startDate, pto.endDate)
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
  const [projectModal, setProjectModal] = useState<{ open: boolean; project?: Project }>({ open: false })
  const [ptoOpen, setPtoOpen]          = useState(false)
  const { addProject, updateProject, deletePto } = usePortfolioStore()
  // In User mode, only this member (the active member) can manage their own row.
  const { activeMemberId } = useViewStore()
  const canEdit = activeMemberId === null || activeMemberId === member.id

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

  function handleSave(draft: Omit<Project, 'id' | 'updatedAt'>, id?: string) {
    if (id) updateProject(id, draft)
    else addProject(draft)
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
              {member.avatarInitials}
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
                onClick={() => setProjectModal({ open: true, project: undefined })}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                title="Add project"
              >
                + Project
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
            the sticky left column regardless of their z-index values. */}
        <div className="relative flex-1 shrink-0 isolate" style={{ width: CHART_WIDTH, minHeight: rowHeight, backgroundImage: WEEK_STRIPE_BG }}>
          {/* Week grid lines */}
          {FY_WEEKS.map(w => (
            <div
              key={w.index}
              className="absolute top-0 bottom-0 border-r border-slate-100"
              style={{ left: w.index * WEEK_PX }}
            />
          ))}
          {/* Period dividers */}
          {FY_PERIODS.map(p => (
            <div
              key={p.label}
              className="absolute top-0 bottom-0 border-r border-slate-200"
              style={{ left: p.weekStart * WEEK_PX }}
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
              onEdit={() => setProjectModal({ open: true, project: p })}
            />
          ))}

          {memberProjects.length === 0 && (
            <div className="absolute flex items-center px-3" style={{ top: projectOffset, bottom: 0, left: 0, right: 0 }}>
              <span className="text-xs text-slate-300 italic">No projects — click + to add</span>
            </div>
          )}
        </div>
      </div>

      {/* PTO dialog */}
      {ptoOpen && (
        <PtoDialog open={ptoOpen} onOpenChange={setPtoOpen} member={member} />
      )}

      {/* Project form — shared with rest of app */}
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

  const barStart    = assignment.startDate || project.startDate
  const barEnd      = assignment.endDate   || project.targetEndDate
  const geo         = barGeometry(barStart, barEnd)
  const primaryPart = assignment.part?.split(',')[0]?.trim()
  const colorClass  = (primaryPart && PART_COLORS[primaryPart]) ?? DEFAULT_PART_COLOR
  const partMeta    = [assignment.part, `${assignment.allocation}%`].filter(Boolean).join(' · ')

  // Hook called before early return (React rules)
  const { vLeft, vWidth, isDragging, handleMouseDown } = useBarDrag({
    leftPx:  geo?.leftPx  ?? 0,
    widthPx: geo?.widthPx ?? 0,
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

// ─── Project view: one row per project, stacked member bars ───────────────

function PhaseDivider({ phase }: { phase: string }) {
  return (
    <div className="flex border-b border-slate-200" style={{ minHeight: 26, background: 'var(--gantt-section)' }}>
      <div
        className="sticky left-0 z-10 flex items-center px-3 border-r border-slate-200 shrink-0"
        style={{ width: LEFT_COL_W, background: 'var(--gantt-section)' }}
      >
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{phase}</span>
      </div>
      <div style={{ width: CHART_WIDTH, backgroundImage: WEEK_STRIPE_BG }} />
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
  const assigned = project.assignments
    .map(a => ({ a, member: members.find(m => m.id === a.memberId) }))
    .filter((x): x is { a: typeof x.a; member: Member } => !!x.member)

  const rowCount = Math.max(assigned.length, 1)
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

      {/* Chart area — isolated stacking context prevents bars bleeding past sticky col */}
      <div className="relative flex-1 shrink-0 isolate" style={{ width: CHART_WIDTH, minHeight: rowHeight, backgroundImage: WEEK_STRIPE_BG }}>
        {/* Grid lines */}
        {FY_WEEKS.map(w => (
          <div key={w.index} className="absolute top-0 bottom-0 border-r border-slate-100" style={{ left: w.index * WEEK_PX }} />
        ))}
        {FY_PERIODS.map(p => (
          <div key={p.label} className="absolute top-0 bottom-0 border-r border-slate-200" style={{ left: p.weekStart * WEEK_PX }} />
        ))}

        {/* Assignment bars — each member's window is individually draggable */}
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
      </div>
    </div>
  )
}

// ─── Team section divider ─────────────────────────────────────────────────

function TeamDivider({ team }: { team: Team }) {
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
      <div style={{ width: CHART_WIDTH, backgroundImage: WEEK_STRIPE_BG }} />
    </div>
  )
}

// ─── Timeline row ─────────────────────────────────────────────────────────
// Used by the third "Timeline" view — one row per project, single bar that
// spans the project's start → end date. Colored by priority so critical work
// is immediately visible in the sea of bars.

const PRIORITY_BAR_COLOR: Record<string, string> = {
  Critical: 'bg-red-500',
  High:     'bg-orange-400',
  Medium:   'bg-indigo-400',
  Low:      'bg-slate-300',
}

function TimelineProjectRow({
  project,
}: {
  project: Project
}) {
  const geo = barGeometry(project.startDate, project.targetEndDate)
  const barColor = PRIORITY_BAR_COLOR[project.priority] ?? 'bg-slate-300'

  // Format a short date for the tooltip text shown on hover.
  function fmt(iso: string) {
    return iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
  }

  return (
    <div
      className="flex border-b border-slate-100 hover:bg-slate-50 transition-colors"
      style={{ minWidth: LEFT_COL_W + CHART_WIDTH }}
    >
      {/* Left column — project name + status/phase/priority badges */}
      <div
        className="sticky left-0 z-10 border-r border-slate-200 shrink-0 flex flex-col justify-center px-3 gap-0.5"
        style={{ width: LEFT_COL_W, minHeight: 48, background: 'var(--gantt-surface)' }}
      >
        <p className="text-xs font-semibold text-slate-800 truncate" title={project.name}>
          {project.name}
        </p>
        <div className="flex items-center gap-1 flex-wrap">
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium', PRIORITY_COLORS[project.priority])}>
            {project.priority}
          </span>
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium', STATUS_COLORS[project.status])}>
            {project.status}
          </span>
        </div>
      </div>

      {/* Right column — the single Gantt bar */}
      <div
        className="relative flex-1 shrink-0"
        style={{ width: CHART_WIDTH, minHeight: 48, backgroundImage: WEEK_STRIPE_BG }}
      >
        {geo && (
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 rounded-full h-4 opacity-85 cursor-default',
              barColor,
            )}
            style={{ left: geo.leftPx, width: geo.widthPx }}
            title={`${project.name} · ${fmt(project.startDate)} – ${fmt(project.targetEndDate)}`}
          />
        )}
        {/* Percent complete fill overlay */}
        {geo && project.percentComplete > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full h-4 bg-white/30 pointer-events-none"
            style={{
              left:  geo.leftPx,
              width: geo.widthPx * (project.percentComplete / 100),
            }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Capacity Planner page ────────────────────────────────────────────────

export function PlanningPage() {
  const { domains, teams, members, projects, ptoBlocks, addProject, updateProject } = usePortfolioStore()
  // User mode: filter rows and hide admin controls when a member is selected.
  const { activeMemberId } = useViewStore()
  const isAdmin = activeMemberId === null

  const scrollRef = useRef<HTMLDivElement>(null)
  const [view, setView]     = useState<'member' | 'project' | 'timeline'>('member')
  const [search, setSearch] = useState('')
  // People/team/domain multiselect filters — each is independent; all three
  // are ANDed together so a member must pass every active filter to appear.
  const [selectedDomains,  setSelectedDomains]  = useState<string[]>([])
  const [selectedTeams,    setSelectedTeams]    = useState<string[]>([])
  const [selectedMembers,  setSelectedMembers]  = useState<string[]>([])
  const [projectModal, setProjectModal] = useState<{ open: boolean; project?: Project }>({ open: false })

  const txPx = todayX()
  const qIdx = currentQuarterIndex()
  const currentQ = FY_QUARTERS[qIdx]

  // Auto-scroll to current week on mount
  useEffect(() => {
    if (scrollRef.current && txPx > 0) {
      const scrollTarget = Math.max(0, txPx - LEFT_COL_W - WEEK_PX * 2)
      scrollRef.current.scrollLeft = scrollTarget
    }
  }, [txPx])

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
    const anyActive = selectedDomains.length > 0 || selectedTeams.length > 0 || selectedMembers.length > 0
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
          return true
        })
        .map(m => m.id)
    )
  }, [selectedDomains, selectedTeams, selectedMembers, members, teams])

  // Normalised search term — used to filter both views
  const q = search.trim().toLowerCase()

  // Projects grouped by phase for the By Project view.
  // Filtered by text search and the people/team/domain multiselect dropdowns.
  // A project is shown if at least one of its assigned members passes the filter.
  const projectsByPhase = useMemo(() => {
    // Build a flat id→name map once so the search filter below runs in O(1)
    // per assignment rather than O(M) per assignment via Array.find().
    const memberNameById = new Map(members.map(m => [m.id, m.name.toLowerCase()]))

    const phases = ['Research', 'Discovery', 'Development', 'QA', 'Deployed', 'On Hold'] as const
    return phases
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

  // Summary stats
  const totalMembers = members.length
  const memberAllocations = members.map(m => {
    const mProjects = projects.filter(p => p.assignments.some(a => a.memberId === m.id))
    return calcMemberAllocation(m.id, mProjects)
  })
  const avgAlloc = totalMembers
    ? Math.round(memberAllocations.reduce((a, b) => a + b, 0) / totalMembers)
    : 0

  return (
    <div className="flex flex-col h-full px-8 pt-8 pb-4 w-full gap-3">
      {/* Compact header + summary inline */}
      <div className="flex items-center gap-6 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Planning</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {currentQ.label} FY2026 ·{' '}
            {view === 'member'
              ? <>Colors = project phase · <span className="text-amber-500 font-medium">Amber = PTO</span> · Click bar to edit</>
              : <>Rows = projects · Bars = members · Colors = SDLC role · Click bar to edit</>
            }
          </p>
        </div>

        <div className="flex items-center gap-5 shrink-0 text-center">
          <div>
            <p className="text-base font-bold text-slate-900">{totalMembers}</p>
            <p className="text-xs text-slate-400">Members</p>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <p className="text-base font-bold text-slate-900">{currentQ.label} FY2026</p>
            <p className="text-xs text-slate-400">{currentQ.weekCount} weeks</p>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <p className={cn('text-base font-bold',
              avgAlloc > 100 ? 'text-red-500' : avgAlloc > 80 ? 'text-amber-500' : 'text-green-500'
            )}>{avgAlloc}%</p>
            <p className="text-xs text-slate-400">Avg Alloc</p>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          {/* Print report — navigates to the standalone PrintPage (/print) */}
          <Link
            to="/print"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 transition-colors"
            title="Open printable capacity report"
          >
            <Printer size={13} />
            Print Report
          </Link>
        </div>
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

        {/* Clear all — only shown when any multiselect filter is active */}
        {(selectedDomains.length > 0 || selectedTeams.length > 0 || selectedMembers.length > 0) && (
          <button
            onClick={() => { setSelectedDomains([]); setSelectedTeams([]); setSelectedMembers([]) }}
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Gantt */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-auto border border-slate-200 rounded-xl"
        style={{ minHeight: 0, background: 'var(--gantt-surface)' }}
      >
        {/* Sticky header (calendar rows) */}
        <div className="sticky top-0 z-20 flex" style={{ minWidth: LEFT_COL_W + CHART_WIDTH }}>
          {/* Left column header — view toggle lives here instead of the page header */}
          <div
            className="sticky left-0 z-30 border-r border-b border-slate-200 shrink-0 flex items-center justify-center"
            style={{ width: LEFT_COL_W, background: 'var(--gantt-surface)' }}
          >
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setView('member')}
                className={cn(
                  'px-2 py-1 rounded-md text-[11px] font-medium transition-all',
                  view === 'member' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                Member
              </button>
              <button
                onClick={() => setView('project')}
                className={cn(
                  'px-2 py-1 rounded-md text-[11px] font-medium transition-all',
                  view === 'project' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                Project
              </button>
              <button
                onClick={() => setView('timeline')}
                className={cn(
                  'px-2 py-1 rounded-md text-[11px] font-medium transition-all',
                  view === 'timeline' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                Timeline
              </button>
            </div>
          </div>
          {/* Calendar headers */}
          <GanttHeaders todayLeftPx={txPx} />
        </div>

        {/* Rows — single today line on the container so it's never broken at row boundaries.
            Uses a large explicit height (not bottom:0) because the container has auto height,
            which makes bottom:0 resolve to 0. The scroll container clips any excess. */}
        <div className="relative" style={{ minWidth: LEFT_COL_W + CHART_WIDTH }}>
          {txPx >= 0 && txPx <= CHART_WIDTH && (
            <div
              className="absolute w-px bg-red-500 pointer-events-none"
              style={{ left: LEFT_COL_W + txPx, top: 0, height: 9999, zIndex: 5 }}
            />
          )}
          {view === 'member' ? (
            grouped.map(({ teams: dTeams }) =>
              dTeams.map(({ team, members: teamMembers }) => (
                <div key={team.id}>
                  <TeamDivider team={team} />
                  {teamMembers.map(m => {
                    const mProjects = projects.filter(p => p.assignments.some(a => a.memberId === m.id))
                    const mPto = ptoBlocks.filter(b => b.memberId === m.id)
                    return (
                      <MemberGanttRow
                        key={m.id}
                        member={m}
                        memberProjects={mProjects}
                        memberPto={mPto}
                      />
                    )
                  })}
                </div>
              ))
            )
          ) : view === 'project' ? (
            projectsByPhase.map(({ phase, projects: phaseProjects }) => (
              <div key={phase}>
                <PhaseDivider phase={phase} />
                {phaseProjects.map(p => (
                  <ProjectGanttRow
                    key={p.id}
                    project={p}
                    members={members}
                    onEdit={proj => setProjectModal({ open: true, project: proj })}
                  />
                ))}
              </div>
            ))
          ) : (
            // Timeline view — one row per project sorted by start date, bars colored by priority.
            [...projects]
              .filter(p => p.startDate && p.targetEndDate)
              .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
              .map(p => <TimelineProjectRow key={p.id} project={p} />)
          )}
        </div>
      </div>

      {/* Shared project form for project and timeline views */}
      {(view === 'project' || view === 'timeline') && (
        <ProjectFormDialog
          key={projectModal.project?.id ?? 'new'}
          open={projectModal.open}
          onOpenChange={open => setProjectModal(s => ({ ...s, open }))}
          initial={projectModal.project}
          onSave={(draft, id) => {
            if (id) updateProject(id, draft)
            else addProject(draft)
          }}
        />
      )}
    </div>
  )
}
