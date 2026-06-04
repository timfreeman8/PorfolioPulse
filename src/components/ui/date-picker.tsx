/**
 * DatePicker — custom date picker with fiscal Quick Select and a calendar.
 *
 * The trigger button shows the selected date formatted as "Month D, YYYY".
 * Clicking it opens a portal-rendered popover (so it escapes dialog overflow)
 * with two panels:
 *
 *   Left  — Quick Select: Today, Start of Q1–Q4, Period 1–12 (FY2026 4-5-4)
 *   Right — Custom Date: text input (mm/dd/yyyy) + calendar with a Monthly /
 *            Quarterly toggle. Monthly shows one month; Quarterly shows the
 *            three months of the current fiscal quarter side-by-side.
 *
 * Value is always an ISO date string ("YYYY-MM-DD") or empty string.
 * The popover is rendered into document.body via ReactDOM.createPortal so it
 * always sits above dialog overlays.
 */

import { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Fiscal calendar (FY2026, Kroger 4-5-4 NRF) ──────────────────────────────
// FY2026: Feb 1, 2026 – Jan 31, 2027.
// Period week offsets from FY_START (0-indexed, 4-5-4 pattern).

const FY_START = new Date(2026, 1, 1) // Feb 1, 2026

const PERIOD_WEEK_OFFSETS = [0, 4, 9, 13, 17, 22, 26, 30, 35, 39, 43, 48]

/** Fiscal periods: each entry is [year, month0] for the period's start month. */
const FISCAL_QUARTERS_MONTHS: [number, number][][] = [
  [[2026, 1], [2026, 2], [2026, 3]],   // Q1: Feb–Apr 2026
  [[2026, 4], [2026, 5], [2026, 6]],   // Q2: May–Jul 2026
  [[2026, 7], [2026, 8], [2026, 9]],   // Q3: Aug–Oct 2026
  [[2026, 10], [2026, 11], [2027, 0]], // Q4: Nov–Dec 2026, Jan 2027
]

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Start dates for P1–P12. */
const PERIOD_STARTS = PERIOD_WEEK_OFFSETS.map(w => addDays(FY_START, w * 7))

// ─── Formatting helpers ───────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/** ISO → "Month D, YYYY" for the trigger button label. */
function formatDisplay(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`
}

/** ISO → mm/d/yyyy for the text input. */
function isoToMDY(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${m}/${d}/${y}`
}

/** mm/dd/yyyy → ISO, or null if invalid. */
function parseMDY(text: string): string | null {
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, mm, dd, yyyy] = match
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  // Reject invalid dates (e.g. Feb 30)
  if (isNaN(date.getTime()) || date.getMonth() !== Number(mm) - 1) return null
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

/**
 * Returns an array of day numbers (1-based) padded with nulls to align the
 * first day to the correct weekday column. Length is always a multiple of 7.
 */
function buildGrid(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(firstWeekday).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** Format YYYY-MM-DD for a given year + 0-indexed month + day. */
function cellISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Which fiscal quarter (0–3) does a given year+month0 fall in? -1 if out of FY. */
function quarterOf(year: number, month: number): number {
  return FISCAL_QUARTERS_MONTHS.findIndex(q =>
    q.some(([y, m]) => y === year && m === month)
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/**
 * MonthGrid — a single calendar month.
 * showHeader: whether to render the "Su Mo … Sa" weekday row (omit in quarterly view).
 */
function MonthGrid({
  year, month, selected, today, onSelect, compact = false,
}: {
  year: number
  month: number
  selected: string
  today: string
  onSelect: (iso: string) => void
  compact?: boolean
}) {
  const cells = buildGrid(year, month)
  const cellSize = compact ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm'

  return (
    <div>
      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-0.5">
        {DOW.map(d => (
          <span key={d} className={cn(
            'text-center text-slate-400 font-medium',
            compact ? 'text-[10px] py-0.5' : 'text-xs py-1',
          )}>{d}</span>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const iso = cellISO(year, month, day)
          const isSelected = iso === selected
          const isToday = iso === today
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(iso)}
              className={cn(
                'flex mx-auto items-center justify-center rounded-full transition-colors',
                cellSize,
                isSelected
                  ? 'bg-blue-600 text-white font-semibold'
                  : isToday
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-700 hover:bg-slate-100',
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function DatePicker({
  value, onChange, placeholder = 'Pick a date', className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  // Position of the popover (fixed, computed from trigger bounding rect on open).
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Calendar view: which month is shown in monthly mode.
  const initialDate = value ? new Date(value + 'T00:00:00') : new Date()
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())

  // Which fiscal quarter is shown in quarterly mode.
  const initialQ = Math.max(0, quarterOf(initialDate.getFullYear(), initialDate.getMonth()))
  const [viewQuarter, setViewQuarter] = useState(initialQ === -1 ? 0 : initialQ)

  // Monthly vs. quarterly calendar toggle.
  const [calMode, setCalMode] = useState<'monthly' | 'quarterly'>('monthly')

  // Raw text in the date input (mm/dd/yyyy).
  const [textValue, setTextValue] = useState(isoToMDY(value))

  const today = toISO(new Date())

  // ── Open / close ─────────────────────────────────────────────────────────

  function openPicker() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    // Clamp left so it doesn't overflow the right edge of the viewport.
    const popW = 520
    const left = Math.min(rect.left, window.innerWidth - popW - 8)
    setPos({ top: rect.bottom + 4, left: Math.max(8, left) })
    setOpen(true)
  }

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const target = e.target as Node
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // ── Sync state when value prop changes externally ─────────────────────────

  useEffect(() => {
    setTextValue(isoToMDY(value))
    if (value) {
      const d = new Date(value + 'T00:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
      const q = quarterOf(d.getFullYear(), d.getMonth())
      if (q !== -1) setViewQuarter(q)
    }
  }, [value])

  // ── Selection ─────────────────────────────────────────────────────────────

  function selectDate(iso: string) {
    onChange(iso)
    setOpen(false)
  }

  // ── Text input ────────────────────────────────────────────────────────────

  function handleTextChange(raw: string) {
    setTextValue(raw)
    const iso = parseMDY(raw)
    if (iso) {
      onChange(iso)
      const d = new Date(iso + 'T00:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
      const q = quarterOf(d.getFullYear(), d.getMonth())
      if (q !== -1) setViewQuarter(q)
    }
  }

  // ── Monthly navigation ────────────────────────────────────────────────────

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // ── Quick Select items ────────────────────────────────────────────────────

  const quickItems: { label: string; iso: string }[] = [
    { label: 'Today', iso: today },
    ...([0, 1, 2, 3] as const).map(qi => ({
      label: `Start of Q${qi + 1}`,
      iso: toISO(PERIOD_STARTS[qi * 3]),
    })),
    ...PERIOD_STARTS.map((d, i) => ({
      label: `Period ${i + 1}`,
      iso: toISO(d),
    })),
  ]

  // ── Quarterly view months ─────────────────────────────────────────────────

  const quarterMonths = FISCAL_QUARTERS_MONTHS[viewQuarter] ?? FISCAL_QUARTERS_MONTHS[0]

  // ── Popover content ───────────────────────────────────────────────────────

  const popover = open && pos ? ReactDOM.createPortal(
    <div
      ref={popoverRef}
      style={{ top: pos.top, left: pos.left, position: 'fixed', zIndex: 9999 }}
      className="flex rounded-xl border border-slate-200 bg-white shadow-xl"
    >
      {/* ── Left: Quick Select ────────────────────────────────────────── */}
      <div className="w-44 shrink-0 border-r border-slate-100 py-3">
        <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Quick Select
        </p>
        <div className="max-h-[340px] overflow-y-auto">
          {quickItems.map(({ label, iso }) => (
            <button
              key={label}
              type="button"
              onClick={() => selectDate(iso)}
              className={cn(
                'w-full px-4 py-1.5 text-left text-sm transition-colors hover:bg-slate-50',
                value === iso
                  ? 'font-medium text-blue-600'
                  : 'text-slate-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: Custom Date ────────────────────────────────────────── */}
      <div className="p-4 flex flex-col gap-3" style={{ width: 340 }}>
        {/* Section header */}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Custom Date
        </p>

        {/* Text input */}
        <input
          type="text"
          placeholder="mm/dd/yyyy"
          value={textValue}
          onChange={e => handleTextChange(e.target.value)}
          className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-blue-500"
        />

        {/* Monthly / Quarterly toggle */}
        <div className="flex items-center gap-1 self-start rounded-lg border border-slate-200 p-0.5">
          {(['monthly', 'quarterly'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setCalMode(mode)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                calMode === mode
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* ── Monthly calendar ───────────────────────────────────────── */}
        {calMode === 'monthly' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={prevMonth}
                className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm font-semibold text-slate-800">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <MonthGrid
              year={viewYear}
              month={viewMonth}
              selected={value}
              today={today}
              onSelect={selectDate}
            />
          </div>
        )}

        {/* ── Quarterly calendar ─────────────────────────────────────── */}
        {calMode === 'quarterly' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setViewQuarter(q => Math.max(0, q - 1))}
                disabled={viewQuarter === 0}
                className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm font-semibold text-slate-800">
                Q{viewQuarter + 1} FY2026
              </span>
              <button
                type="button"
                onClick={() => setViewQuarter(q => Math.min(3, q + 1))}
                disabled={viewQuarter === 3}
                className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Three months side by side */}
            <div className="grid grid-cols-3 gap-2">
              {quarterMonths.map(([year, month], mi) => (
                <div key={mi}>
                  <p className="text-center text-[11px] font-semibold text-slate-600 mb-1">
                    {MONTH_SHORT[month]}
                    {/* Period label: P1–P12 */}
                    <span className="ml-1 text-[10px] font-normal text-slate-400">
                      P{viewQuarter * 3 + mi + 1}
                    </span>
                  </p>
                  <MonthGrid
                    year={year}
                    month={month}
                    selected={value}
                    today={today}
                    onSelect={selectDate}
                    compact
                  />
                </div>
              ))}
            </div>
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
          !value && 'text-muted-foreground',
        )}
      >
        <CalendarIcon size={14} className="shrink-0 text-slate-400" />
        <span className="flex-1 text-left">
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>
      {popover}
    </div>
  )
}
