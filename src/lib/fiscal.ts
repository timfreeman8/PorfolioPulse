/**
 * Fiscal calendar utilities for FY2026 (Kroger 4-5-4 NRF calendar).
 *
 * FY2026 runs Feb 1, 2026 → Jan 31, 2027. Each quarter is exactly 13 weeks
 * (Q1: P1–P3, Q2: P4–P6, Q3: P7–P9, Q4: P10–P12).
 *
 * These helpers are shared across the Roster, Teams Detail, Dashboard, and
 * Planning pages so quarter-bound calculations are consistent everywhere.
 *
 * NOTE: Do NOT call getCurrentQBounds() at module scope. Doing so freezes the
 * result at JS-module-load time, making it stale if the quarter changes while
 * the app is open. Always call inside a component or useMemo.
 */

import type { Project } from '@/types'

const FY_START = new Date('2026-02-01T00:00:00')
const QUARTER_WEEKS = 13
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Returns the inclusive start and exclusive end of the current fiscal quarter,
 * plus a human-readable label ("Q1 FY2026" … "Q4 FY2026").
 *
 * Called fresh each time so it always reflects the real current date.
 */
export function getCurrentQBounds(): { qStart: Date; qEnd: Date; qLabel: string } {
  const msSinceFY    = Math.max(0, Date.now() - FY_START.getTime())
  const weeksSinceFY = Math.floor(msSinceFY / WEEK_MS)
  const qIdx         = Math.min(3, Math.floor(weeksSinceFY / QUARTER_WEEKS))

  const qStart = new Date(FY_START)
  qStart.setDate(qStart.getDate() + qIdx * QUARTER_WEEKS * 7)

  const qEnd = new Date(qStart)
  qEnd.setDate(qEnd.getDate() + QUARTER_WEEKS * 7)

  return { qStart, qEnd, qLabel: `Q${qIdx + 1} FY2026` }
}

/**
 * Total allocation percentage a member has committed in the current fiscal
 * quarter. Only projects whose date range overlaps [qStart, qEnd) are counted.
 *
 * @param memberId - The member whose allocation to sum.
 * @param projects - Full project list from the store.
 * @returns Sum of allocation values (may exceed 100 if over-committed).
 */
export function memberQuarterAllocation(memberId: string, projects: Project[]): number {
  const { qStart, qEnd } = getCurrentQBounds()
  return projects.reduce((sum, p) => {
    if (!p.startDate || !p.targetEndDate) return sum
    const assignment = p.assignments.find(a => a.memberId === memberId)
    if (!assignment) return sum
    // Project must overlap the quarter window
    const pStart = new Date(p.startDate + 'T00:00:00')
    const pEnd   = new Date(p.targetEndDate + 'T00:00:00')
    if (pStart >= qEnd || pEnd <= qStart) return sum
    return sum + (assignment.allocation ?? 0)
  }, 0)
}
