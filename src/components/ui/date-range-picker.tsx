/**
 * DateRangePicker — two-click date range selector for fiscal planning.
 *
 * Left panel: fiscal calendar hierarchy — Today shortcut, then Q1–Q4 as
 * collapsible group headers with P1–P12 nested inside. Each row shows the
 * full date range so users can see exactly what they're picking.
 *
 * Right panel: duration pills (Periods / Weeks) that appear after a start
 * date is chosen. Hovering a pill previews the computed end date. Clicking
 * one sets the end date and closes the popover.
 *
 * Typical flow: click "Period 5" → click "2P" → done in two clicks.
 * A small custom mm/dd/yyyy input lives at the bottom for exact dates.
 *
 * Portal-rendered into document.body to escape dialog overflow clipping.
 */

import { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Fiscal calendar (FY2026, Kroger 4-5-4 NRF) ──────────────────────────────

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const FY_START = new Date(2026, 1, 1) // Feb 1, 2026
const PERIOD_WEEK_OFFSETS = [0, 4, 9, 13, 17, 22, 26, 30, 35, 39, 43, 48]
const PERIOD_STARTS = PERIOD_WEEK_OFFSETS.map(w => addDays(FY_START, w * 7))

// Precompute period end dates: end of period i = start of period (i+1) - 1 day.
const PERIOD_ENDS = PERIOD_STARTS.map((_, i) =>
  i < PERIOD_STARTS.length - 1
    ? toISO(addDays(PERIOD_STARTS[i + 1], -1))
    : '2027-01-31'
)

/** Quarters: each covers 3 periods. */
const QUARTERS = [0, 1, 2, 3].map(qi => ({
  label:    `Q${qi + 1}`,
  startISO: toISO(PERIOD_STARTS[qi * 3]),
  endISO:   PERIOD_ENDS[qi * 3 + 2],
  periods:  [0, 1, 2].map(pi => ({
    index:    qi * 3 + pi,           // 0–11
    startISO: toISO(PERIOD_STARTS[qi * 3 + pi]),
    endISO:   PERIOD_ENDS[qi * 3 + pi],
  })),
}))

// ─── Formatting ───────────────────────────────────────────────────────────────

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ─── Calendar grid helpers ────────────────────────────────────────────────────

const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']

/**
 * Returns an array of day-of-month numbers (1-based) padded with nulls so
 * the first day lands on the correct weekday column. Length is always a
 * multiple of 7.
 */
function buildCalGrid(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(firstWeekday).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** Formats year + 0-indexed month + day as an ISO date string. */
function calCellISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

function formatShort(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTH_SHORT[m - 1]} ${d}, ${y}`
}

/**
 * Compact date-range label: "Feb 1 – Feb 28" (omits year for FY2026 dates;
 * appends year when the end date is in 2027).
 */
function rangeLabel(startISO: string, endISO: string): string {
  const [sy, sm, sd] = startISO.split('-').map(Number)
  const [ey, em, ed] = endISO.split('-').map(Number)
  const s = `${MONTH_SHORT[sm - 1]} ${sd}`
  const e = ey !== sy ? `${MONTH_SHORT[em - 1]} ${ed}, ${ey}` : `${MONTH_SHORT[em - 1]} ${ed}`
  return `${s} – ${e}`
}

function isoToMDY(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${m}/${d}/${y}`
}

function parseMDY(text: string): string | null {
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, mm, dd, yyyy] = match
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  if (isNaN(date.getTime()) || date.getMonth() !== Number(mm) - 1) return null
  return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
}

// ─── Duration helpers ─────────────────────────────────────────────────────────

/**
 * Returns the end ISO date for N fiscal periods starting from `start`.
 * Finds which period contains start, then returns day-before period (idx+N).
 */
function endDateForPeriods(start: string, n: number): string {
  const startD = new Date(start + 'T00:00:00')
  let idx = 0
  for (let i = PERIOD_STARTS.length - 1; i >= 0; i--) {
    if (PERIOD_STARTS[i] <= startD) { idx = i; break }
  }
  const nextIdx = idx + n
  if (nextIdx >= PERIOD_STARTS.length) return '2027-01-31'
  return toISO(addDays(PERIOD_STARTS[nextIdx], -1))
}

/** Returns end date for N full weeks from start (end = start + N×7 − 1). */
function endDateForWeeks(start: string, w: number): string {
  return toISO(addDays(new Date(start + 'T00:00:00'), w * 7 - 1))
}

const PERIOD_DURATIONS = [
  { label: '1 Period',              short: '1P',       n: 1  },
  { label: '2 Periods',             short: '2P',       n: 2  },
  { label: '3 Periods (1 Quarter)', short: '3P (1Q)',  n: 3  },
  { label: '4 Periods',             short: '4P',       n: 4  },
  { label: '6 Periods (Half Year)', short: '6P (½Y)',  n: 6  },
  { label: '9 Periods',             short: '9P',       n: 9  },
  { label: '12 Periods (Full Year)',short: '12P (FY)', n: 12 },
]

const WEEK_DURATIONS = [
  { label: '1 Week',  short: '1W',  w: 1  },
  { label: '2 Weeks', short: '2W',  w: 2  },
  { label: '4 Weeks', short: '4W',  w: 4  },
  { label: '8 Weeks', short: '8W',  w: 8  },
  { label: '13 Weeks (1 Quarter)', short: '13W (1Q)', w: 13 },
]

// ─── Main component ───────────────────────────────────────────────────────────

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onChange: (start: string, end: string) => void
  placeholder?: string
  className?: string
}

export function DateRangePicker({
  startDate, endDate, onChange,
  placeholder = 'Pick date range', className,
}: DateRangePickerProps) {
  const [open, setOpen]         = useState(false)
  const [pos,  setPos]          = useState<{ top: number; left: number; width: number } | null>(null)
  const triggerRef  = useRef<HTMLButtonElement>(null)
  const popoverRef  = useRef<HTMLDivElement>(null)

  const [customText,  setCustomText]  = useState(isoToMDY(startDate))
  // Which quarter groups are expanded. Default: expand the one containing startDate.
  const [expanded, setExpanded] = useState<boolean[]>(() => {
    const init = [false, false, false, false]
    if (startDate) {
      const startD = new Date(startDate + 'T00:00:00')
      const qi = QUARTERS.findIndex(q =>
        new Date(q.startISO + 'T00:00:00') <= startD &&
        startD <= new Date(q.endISO + 'T00:00:00')
      )
      if (qi !== -1) init[qi] = true
      else init[0] = true
    } else {
      init[0] = true // default: expand Q1
    }
    return init
  })

  // Hover preview: shows what the end date would be for the hovered duration pill.
  const [previewEnd, setPreviewEnd] = useState('')

  // Toggle between fiscal-period pills, week pills, and calendar end-date picker.
  const [durationMode, setDurationMode] = useState<'fiscal' | 'weeks' | 'calendar'>('fiscal')

  // Calendar view state for the end-date calendar (month mode).
  const [calYear,  setCalYear]  = useState(() => {
    const d = startDate ? new Date(startDate + 'T00:00:00') : new Date()
    return d.getFullYear()
  })
  const [calMonth, setCalMonth] = useState(() => {
    const d = startDate ? new Date(startDate + 'T00:00:00') : new Date()
    return d.getMonth()
  })

  const today = toISO(new Date())

  // ── Open / close ─────────────────────────────────────────────────────────

  function openPicker() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    // Use the trigger's natural width; clamp so it doesn't overflow the viewport.
    const popW = Math.max(rect.width, 520)
    const left = Math.min(rect.left, window.innerWidth - popW - 8)
    setPos({ top: rect.bottom + 4, left: Math.max(8, left), width: popW })
    setOpen(true)
  }

  /** Clears both start and end dates and closes the popover. */
  function clearDates(e: React.MouseEvent) {
    e.stopPropagation() // don't re-open the picker
    onChange('', '')
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !popoverRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  useEffect(() => { setCustomText(isoToMDY(startDate)) }, [startDate])

  // When the start date changes, navigate the calendar to that month so the
  // user can immediately see their start point and pick an end date nearby.
  useEffect(() => {
    if (startDate) {
      const d = new Date(startDate + 'T00:00:00')
      setCalYear(d.getFullYear())
      setCalMonth(d.getMonth())
    }
  }, [startDate])

  // ── Set start ─────────────────────────────────────────────────────────────
  // Clears end when the new start is on/after the existing end (invalid range).

  function applyStart(iso: string) {
    const newEnd = (endDate && iso >= endDate) ? '' : endDate
    onChange(iso, newEnd)
  }

  function handleCustomText(raw: string) {
    setCustomText(raw)
    const iso = parseMDY(raw)
    if (iso) applyStart(iso)
  }

  // ── Apply duration → set end and close ───────────────────────────────────

  function applyDuration(type: 'periods' | 'weeks', n: number) {
    if (!startDate) return
    const end = type === 'periods' ? endDateForPeriods(startDate, n) : endDateForWeeks(startDate, n)
    onChange(startDate, end)
    setOpen(false)
  }

  // ── Trigger label ─────────────────────────────────────────────────────────

  function triggerLabel() {
    if (startDate && endDate) return `${formatShort(startDate)} → ${formatShort(endDate)}`
    if (startDate)             return `${formatShort(startDate)} →`
    return placeholder
  }

  // ── Displayed end (hover preview OR committed endDate) ────────────────────

  // ─── Popover ─────────────────────────────────────────────────────────────

  const pillBase = 'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap'
  const pillIdle = 'border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50 cursor-pointer'

  const popover = open && pos ? ReactDOM.createPortal(
    <div
      ref={popoverRef}
      style={{ top: pos.top, left: pos.left, position: 'fixed', zIndex: 9999, width: pos.width }}
      className="flex rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden"
    >
      {/* ── Left: fiscal calendar hierarchy ────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-slate-100 flex flex-col">
        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Start Date
        </p>

        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 380 }}>
          {/* Today shortcut — styled like a nav button */}
          <div className="px-2 py-0.5">
            <button
              type="button"
              onClick={() => applyStart(today)}
              className={cn(
                'w-full flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                startDate === today
                  ? 'bg-slate-200 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <span>Today</span>
              <span className="text-xs text-slate-400">{formatShort(today)}</span>
            </button>
          </div>

          {/* Q1–Q4 with nested periods — no divider between Today and quarters */}
          {QUARTERS.map((q, qi) => {
            const isQSelected = startDate === q.startISO
            const hasSelectedPeriod = q.periods.some(p => p.startISO === startDate)
            const isOpen = expanded[qi]

            // Quarter start: "Feb 1" (month + day only)
            const [, qm, qd] = q.startISO.split('-').map(Number)
            const qStartLabel = `${MONTH_SHORT[qm - 1]} ${qd}`

            return (
              <div key={qi} className="px-2 py-1">
                {/* Quarter row */}
                <div className={cn(
                  'flex items-center rounded-md transition-colors',
                  isQSelected
                    ? 'bg-slate-200 text-slate-900'
                    : hasSelectedPeriod
                    ? 'bg-slate-50'
                    : 'hover:bg-slate-100',
                )}>
                  <button
                    type="button"
                    onClick={() => setExpanded(prev => prev.map((v, i) => i === qi ? !v : v))}
                    className="pl-2 pr-1 py-2 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                  >
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyStart(q.startISO)}
                    className="flex-1 flex items-center justify-between pr-3 py-2 text-sm font-medium transition-colors"
                  >
                    <span>{q.label} — {qStartLabel}</span>
                    <span className="text-xs font-normal text-slate-400">
                      {rangeLabel(q.startISO, q.endISO)}
                    </span>
                  </button>
                </div>

                {/* Nested periods — space-y-0.5 gives a small gap between each pill */}
                {isOpen && (
                  <div className="space-y-0.5 mt-0.5">
                    {q.periods.map(p => {
                      const isPSelected = startDate === p.startISO
                      return (
                        <button
                          key={p.index}
                          type="button"
                          onClick={() => applyStart(p.startISO)}
                          className={cn(
                            'w-full flex items-center justify-between rounded-md pl-8 pr-3 py-1.5 text-sm font-medium transition-colors',
                            isPSelected
                              ? 'bg-slate-200 text-slate-900'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                          )}
                        >
                          <span>Period {p.index + 1}</span>
                          <span className="text-xs font-normal text-slate-400">
                            {rangeLabel(p.startISO, p.endISO)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Custom date input — font-size locked to text-sm so it doesn't shift while typing */}
        <div className="border-t border-slate-100 px-4 py-2.5">
          <input
            type="text"
            placeholder="Custom date: mm/dd/yyyy"
            value={customText}
            onChange={e => handleCustomText(e.target.value)}
            style={{ fontSize: '0.875rem', lineHeight: '1.5', fontFamily: 'inherit' }}
            className="w-full outline-none text-slate-700 placeholder:text-slate-400 placeholder:text-sm bg-transparent"
          />
        </div>
      </div>

      {/* ── Right: duration ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Header row — "Duration" label, mirrors "Start Date" header height on left */}
        <p className="px-5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Duration
        </p>

        {!startDate ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-5 pb-5">
            <p className="text-sm font-medium text-slate-500">Pick a start date</p>
            <p className="text-xs text-slate-400">
              Select a quarter or period on the left,<br />
              then choose how long the phase runs.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-5 pt-2.5 pb-5 flex-1">
            {/* Fiscal / Weeks / Calendar toggle */}
            <div className="flex items-center gap-1 self-start rounded-lg border border-slate-200 p-0.5">
              {(['fiscal', 'weeks', 'calendar'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setDurationMode(mode); setPreviewEnd('') }}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors capitalize',
                    durationMode === mode
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {mode === 'fiscal' ? 'Fiscal' : mode === 'weeks' ? 'Weeks' : 'Calendar'}
                </button>
              ))}
            </div>

            {/* Duration pills — fiscal or weeks mode */}
            {(durationMode === 'fiscal' || durationMode === 'weeks') && (
              <div className="flex flex-wrap gap-1.5">
                {durationMode === 'fiscal'
                  ? PERIOD_DURATIONS.map(({ short, n }) => (
                      <button
                        key={n}
                        type="button"
                        onMouseEnter={() => setPreviewEnd(endDateForPeriods(startDate, n))}
                        onMouseLeave={() => setPreviewEnd('')}
                        onClick={() => applyDuration('periods', n)}
                        className={cn(pillBase, pillIdle)}
                      >
                        {short}
                      </button>
                    ))
                  : WEEK_DURATIONS.map(({ short, w }) => (
                      <button
                        key={w}
                        type="button"
                        onMouseEnter={() => setPreviewEnd(endDateForWeeks(startDate, w))}
                        onMouseLeave={() => setPreviewEnd('')}
                        onClick={() => applyDuration('weeks', w)}
                        className={cn(pillBase, pillIdle)}
                      >
                        {short}
                      </button>
                    ))
                }
              </div>
            )}

            {/* Calendar end-date picker — shown in calendar mode */}
            {durationMode === 'calendar' && (() => {
              const cells = buildCalGrid(calYear, calMonth)
              // Month navigation helpers
              const prevMonth = () => {
                if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
                else setCalMonth(m => m - 1)
              }
              const nextMonth = () => {
                if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
                else setCalMonth(m => m + 1)
              }
              return (
                <div>
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={prevMonth}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 transition-colors"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-sm font-semibold text-slate-800">
                      {MONTH_NAMES[calMonth]} {calYear}
                    </span>
                    <button
                      type="button"
                      onClick={nextMonth}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {/* Day-of-week headers */}
                  <div className="grid grid-cols-7 mb-0.5">
                    {DOW.map(d => (
                      <span key={d} className="text-center text-[10px] font-medium text-slate-400 py-0.5">{d}</span>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div
                    className="grid grid-cols-7 gap-y-0.5"
                    onMouseLeave={() => setPreviewEnd('')}
                  >
                    {cells.map((day, i) => {
                      if (!day) return <div key={i} />
                      const iso      = calCellISO(calYear, calMonth, day)
                      const isBefore = iso <= startDate        // before or equal to start → disabled
                      const isStart  = iso === startDate
                      const rangeEnd = previewEnd || endDate
                      const inRange  = rangeEnd && iso > startDate && iso < rangeEnd
                      const isEnd    = rangeEnd && iso === rangeEnd && iso !== startDate
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={isBefore}
                          onMouseEnter={() => !isBefore && setPreviewEnd(iso)}
                          onClick={() => {
                            if (isBefore) return
                            onChange(startDate, iso)
                            setOpen(false)
                          }}
                          className={cn(
                            'flex mx-auto items-center justify-center rounded-full h-7 w-7 text-xs transition-colors',
                            isStart
                              ? 'bg-blue-600 text-white font-semibold'
                              : isEnd
                              ? 'bg-blue-500 text-white font-semibold'
                              : inRange
                              ? 'bg-blue-50 text-blue-800'
                              : isBefore
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-700 hover:bg-slate-100 cursor-pointer',
                          )}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/*
              Start / preview line — replaces the old hint text.
              Shows "From [start]" when no duration is hovered, or
              "From [start] → [preview]" while hovering a pill.
            */}
            <p className="text-sm text-slate-500">
              From <span className="font-medium text-slate-700">{formatShort(startDate)}</span>
              {previewEnd && (
                <>
                  <span className="mx-2 text-slate-300">→</span>
                  <span className="font-medium text-blue-600">{formatShort(previewEnd)}</span>
                </>
              )}
            </p>

            {/* Committed range + Done — only visible after a duration is selected */}
            {endDate && !previewEnd && (
              <div className="mt-auto border-t border-slate-100 pt-3 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">{formatShort(startDate)}</span>
                  <span className="mx-2 text-slate-400">→</span>
                  <span className="font-semibold">{formatShort(endDate)}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 shrink-0"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  ) : null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-white px-3 text-sm transition-colors',
          'hover:border-slate-400 focus:outline-none focus:border-primary',
          open && 'border-primary',
          !startDate && 'text-muted-foreground',
        )}
      >
        <CalendarIcon size={14} className="shrink-0 text-slate-400" />
        <span className="flex-1 text-left">{triggerLabel()}</span>
        {/* Clear button — only shown when a date is set */}
        {startDate && (
          <span
            role="button"
            onClick={clearDates}
            className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={11} />
            <span>Clear</span>
          </span>
        )}
      </button>
      {popover}
    </div>
  )
}
