/**
 * Unit tests for fiscal.ts — FY2026 Kroger 4-5-4 NRF calendar utilities.
 *
 * Strategy: we mock Date.now() to place "today" at a known point in the fiscal
 * year, then assert that getCurrentQBounds() returns the expected quarter
 * window and label. We also verify that memberQuarterAllocation() correctly
 * sums only the assignments whose project date range overlaps the current quarter.
 *
 * FY2026 quarter boundaries (13 weeks each, starting Feb 1 2026):
 *   Q1: 2026-02-01 → 2026-05-03  (exclusive end)
 *   Q2: 2026-05-03 → 2026-08-02
 *   Q3: 2026-08-02 → 2026-11-01
 *   Q4: 2026-11-01 → 2027-01-31
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getCurrentQBounds, memberQuarterAllocation } from './fiscal'
import type { Project } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal Project stub with just the fields fiscal.ts touches. */
function makeProject(
  id: string,
  startDate: string,
  targetEndDate: string,
  memberId: string,
  allocation: number,
): Project {
  return {
    id,
    name:            `Project ${id}`,
    description:     '',
    status:          'In Progress',
    phase:           'Development',
    priority:        'Medium',
    initiativeId:    '',
    startDate,
    targetEndDate,
    percentComplete: 0,
    stakeholders:    '',
    notes:           '',
    updatedAt:       new Date().toISOString(),
    blockedByIds:    [],
    assignments:     [{ memberId, allocation }],
  }
}

// ─── getCurrentQBounds ───────────────────────────────────────────────────────

describe('getCurrentQBounds', () => {
  // Restore real Date.now after each test so other test suites aren't polluted.
  afterEach(() => { vi.restoreAllMocks() })

  it('returns Q1 FY2026 label and correct date bounds when today is in Q1', () => {
    // Place "today" at 2026-03-01 — well inside Q1 (Feb 1 – May 3 2026).
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-01').getTime())

    const { qStart, qEnd, qLabel } = getCurrentQBounds()

    // Q1 starts on FY start: Feb 1 2026.
    expect(qStart.toISOString().slice(0, 10)).toBe('2026-02-01')
    // Q1 ends exactly 91 days later (13 weeks × 7 days).
    expect(qEnd.toISOString().slice(0, 10)).toBe('2026-05-03')
    expect(qLabel).toBe('Q1 FY2026')
  })

  it('returns Q2 FY2026 when today is in Q2', () => {
    // Place "today" at 2026-06-01 — inside Q2 (May 3 – Aug 2 2026).
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-01').getTime())

    const { qStart, qEnd, qLabel } = getCurrentQBounds()

    expect(qStart.toISOString().slice(0, 10)).toBe('2026-05-03')
    expect(qEnd.toISOString().slice(0, 10)).toBe('2026-08-02')
    expect(qLabel).toBe('Q2 FY2026')
  })

  it('returns Q3 FY2026 when today is in Q3', () => {
    // Place "today" at 2026-09-15 — inside Q3 (Aug 2 – Nov 1 2026).
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-09-15').getTime())

    const { qStart, qEnd, qLabel } = getCurrentQBounds()

    expect(qStart.toISOString().slice(0, 10)).toBe('2026-08-02')
    expect(qEnd.toISOString().slice(0, 10)).toBe('2026-11-01')
    expect(qLabel).toBe('Q3 FY2026')
  })

  it('returns Q4 FY2026 when today is in Q4', () => {
    // Place "today" at 2026-12-01 — inside Q4 (Nov 1 2026 – Jan 31 2027).
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-12-01').getTime())

    const { qStart, qEnd, qLabel } = getCurrentQBounds()

    expect(qStart.toISOString().slice(0, 10)).toBe('2026-11-01')
    expect(qEnd.toISOString().slice(0, 10)).toBe('2027-01-31')
    expect(qLabel).toBe('Q4 FY2026')
  })

  it('clamps to Q4 when today is after the fiscal year ends', () => {
    // Place "today" well past FY end — should still return Q4, not blow up.
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2030-01-01').getTime())

    const { qLabel } = getCurrentQBounds()

    expect(qLabel).toBe('Q4 FY2026')
  })

  it('label matches the pattern "Q<n> FY2026"', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-01').getTime())
    const { qLabel } = getCurrentQBounds()
    expect(qLabel).toMatch(/^Q[1-4] FY2026$/)
  })
})

// ─── memberQuarterAllocation ─────────────────────────────────────────────────

describe('memberQuarterAllocation', () => {
  beforeEach(() => {
    // Pin "today" to 2026-03-01 so we're in Q1 (2026-02-01 → 2026-05-03).
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-01').getTime())
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('returns 0 for a member with no projects', () => {
    expect(memberQuarterAllocation('member-1', [])).toBe(0)
  })

  it('returns 0 when member has no assignment on any project', () => {
    // Project is within Q1 but the member isn't assigned to it.
    const project = makeProject('p1', '2026-02-01', '2026-04-30', 'other-member', 50)
    expect(memberQuarterAllocation('member-1', [project])).toBe(0)
  })

  it('returns the allocation for a project spanning the full quarter', () => {
    // Project covers entire Q1; member assigned at 50%.
    const project = makeProject('p1', '2026-02-01', '2026-05-03', 'member-1', 50)
    expect(memberQuarterAllocation('member-1', [project])).toBe(50)
  })

  it('returns the allocation for a project partially overlapping the quarter', () => {
    // Project starts mid-quarter and ends inside it — still overlaps.
    const project = makeProject('p1', '2026-03-15', '2026-04-15', 'member-1', 30)
    expect(memberQuarterAllocation('member-1', [project])).toBe(30)
  })

  it('sums allocations from multiple overlapping projects', () => {
    // Two projects both in Q1; member committed at 40% + 30% = 70%.
    const p1 = makeProject('p1', '2026-02-01', '2026-03-31', 'member-1', 40)
    const p2 = makeProject('p2', '2026-03-01', '2026-04-30', 'member-1', 30)
    expect(memberQuarterAllocation('member-1', [p1, p2])).toBe(70)
  })

  it('returns 0 for a project that ends before the quarter starts', () => {
    // Project ended in January — outside Q1.
    const project = makeProject('p1', '2025-11-01', '2026-01-31', 'member-1', 50)
    expect(memberQuarterAllocation('member-1', [project])).toBe(0)
  })

  it('returns 0 for a project that starts after the quarter ends', () => {
    // Project starts in Q2 — outside Q1.
    const project = makeProject('p1', '2026-05-10', '2026-06-30', 'member-1', 50)
    expect(memberQuarterAllocation('member-1', [project])).toBe(0)
  })

  it('returns 0 for projects missing startDate or targetEndDate', () => {
    // Missing dates means overlap can't be determined — should be skipped.
    const project: Project = {
      id: 'p1', name: 'Incomplete', description: '', status: 'Backlog',
      phase: 'Research', priority: 'Low', initiativeId: '',
      startDate: '', targetEndDate: '',
      percentComplete: 0, stakeholders: '', notes: '',
      updatedAt: new Date().toISOString(), blockedByIds: [],
      assignments: [{ memberId: 'member-1', allocation: 60 }],
    }
    expect(memberQuarterAllocation('member-1', [project])).toBe(0)
  })

  it('can exceed 100 when member is over-committed', () => {
    // Member stacked on three projects — allocation deliberately over 100%.
    const p1 = makeProject('p1', '2026-02-01', '2026-04-30', 'member-1', 50)
    const p2 = makeProject('p2', '2026-02-01', '2026-04-30', 'member-1', 50)
    const p3 = makeProject('p3', '2026-02-01', '2026-04-30', 'member-1', 25)
    expect(memberQuarterAllocation('member-1', [p1, p2, p3])).toBe(125)
  })
})
