/**
 * PrintPage — read-only, print-optimized capacity report for the current quarter.
 *
 * Stands alone: NOT wrapped in the AppLayout sidebar. Navigated to via /print.
 * Renders a clean Domain → Team → Member breakdown with allocation status colors.
 *
 * Print behavior:
 *   - Back and Print buttons are hidden via `print:hidden`
 *   - All colored elements use inline styles (not Tailwind bg- classes) so they
 *     survive Chrome's "print backgrounds" toggle reliably
 *   - Page background is always white — dark mode is suppressed via `bg-white`
 *     on the root element and `color-scheme: light` on the body
 *
 * Allocation thresholds (matched to the Planning page):
 *   - >100%  → red (over capacity)
 *   - >80%   → amber (at risk)
 *   - ≤80%   → green (healthy)
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { getCurrentQBounds, memberQuarterAllocation } from '@/lib/fiscal'
import { avatarColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format today's date as a readable string for the report header. */
function formatToday(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Return projects that overlap the given quarter window for a specific member.
 * A project overlaps if its date range intersects [qStart, qEnd) AND the member
 * is assigned to it. Used for the "Projects" column in each member row.
 */
function memberQProjects(memberId: string, projects: Project[], qStart: Date, qEnd: Date): Project[] {
  return projects.filter(p => {
    if (!p.startDate || !p.targetEndDate) return false
    if (!p.assignments.some(a => a.memberId === memberId)) return false
    const pStart = new Date(p.startDate + 'T00:00:00')
    const pEnd   = new Date(p.targetEndDate + 'T00:00:00')
    return pStart < qEnd && pEnd > qStart
  })
}

/**
 * Truncate a project list to at most `max` names, appending "+N more" when
 * there are additional projects beyond the limit.
 */
function truncateProjects(projects: Project[], max = 3): string {
  if (projects.length === 0) return '—'
  const shown = projects.slice(0, max).map(p => p.name)
  const rest  = projects.length - max
  if (rest > 0) return shown.join(', ') + `, +${rest} more`
  return shown.join(', ')
}

// ─── Allocation color helpers ─────────────────────────────────────────────────

/** Tailwind text-color class based on allocation vs. capacity. */
function allocTextClass(alloc: number, capacity: number): string {
  if (alloc > capacity) return 'text-red-600 font-bold'
  if (capacity > 0 && alloc / capacity > 0.8) return 'text-amber-600 font-semibold'
  return 'text-green-700 font-semibold'
}

/**
 * Inline background color string (hex) for the allocation badge pill.
 * Inline styles are used instead of Tailwind bg- classes so the color prints
 * reliably regardless of the browser's "print backgrounds" setting.
 */
function allocBgStyle(alloc: number, capacity: number): React.CSSProperties {
  if (alloc > capacity)                           return { backgroundColor: '#fee2e2' } // red-100
  if (capacity > 0 && alloc / capacity > 0.8)    return { backgroundColor: '#fef3c7' } // amber-100
  return                                                 { backgroundColor: '#dcfce7' } // green-100
}

/** Inline text color for the allocation badge pill. */
function allocTextStyle(alloc: number, capacity: number): React.CSSProperties {
  if (alloc > capacity)                           return { color: '#dc2626' } // red-600
  if (capacity > 0 && alloc / capacity > 0.8)    return { color: '#d97706' } // amber-600
  return                                                 { color: '#15803d' } // green-700
}

/** Human-readable capacity status string. */
function capacityLabel(alloc: number, capacity: number): string {
  if (capacity === 0) return '—'
  if (alloc > capacity) return 'Over'
  if (alloc / capacity > 0.8) return 'At Risk'
  return 'OK'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PrintPage() {
  const { domains, teams, members, projects } = usePortfolioStore()

  // Compute quarter bounds once — calling inside useMemo so it's never stale.
  const { qStart, qEnd, qLabel } = useMemo(() => getCurrentQBounds(), [])

  // ── Per-member allocation map ──────────────────────────────────────────────
  // Pre-compute allocation for every member so we can derive summary stats and
  // render each row without re-running the reduce per render.
  const allocByMember = useMemo(() => {
    const map = new Map<string, number>()
    members.forEach(m => {
      map.set(m.id, memberQuarterAllocation(m.id, projects))
    })
    return map
  }, [members, projects])

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalMembers  = members.length
  const overCount     = members.filter(m => {
    const alloc = allocByMember.get(m.id) ?? 0
    return alloc > m.capacity
  }).length
  const atRiskCount   = members.filter(m => {
    const alloc = allocByMember.get(m.id) ?? 0
    const cap   = m.capacity
    return cap > 0 && alloc <= cap && alloc / cap > 0.8
  }).length
  const avgAlloc = totalMembers
    ? Math.round([...allocByMember.values()].reduce((s, v) => s + v, 0) / totalMembers)
    : 0

  // ── Domain → Team → Member hierarchy ──────────────────────────────────────
  const hierarchy = useMemo(() => {
    return domains.map(d => ({
      domain: d,
      teams: teams
        .filter(t => t.domainId === d.id)
        .map(t => ({
          team: t,
          members: members.filter(m => t.memberIds.includes(m.id)),
        }))
        .filter(t => t.members.length > 0),
    })).filter(d => d.teams.length > 0)
  }, [domains, teams, members])

  return (
    // Root: always white, always light — suppress any dark mode that might be
    // active in the host environment so the printed report is always clean.
    <div className="bg-white min-h-screen" style={{ colorScheme: 'light' }}>

      {/* Back button — fixed top-left in screen view, hidden when printing */}
      <Link
        to="/planning"
        className="print:hidden fixed top-4 left-4 z-50 flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Planning
      </Link>

      {/* Print button — fixed top-right in screen view, triggers window.print() */}
      <button
        onClick={() => window.print()}
        className="print:hidden fixed top-4 right-4 z-50 flex items-center gap-1.5 text-sm text-white bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-1.5 shadow-sm transition-colors"
      >
        <Printer size={14} />
        Print / Save PDF
      </button>

      {/* Page body — constrained width, generous padding for readability */}
      <div className="max-w-5xl mx-auto px-8 py-10 print:px-6 print:py-6">

        {/* ── Report header ────────────────────────────────────────────────── */}
        <div className="mb-6 border-b-2 border-slate-800 pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
            Store &amp; Associate Technology
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            {qLabel} Capacity Report
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{formatToday()}</p>
        </div>

        {/* ── Summary row ──────────────────────────────────────────────────── */}
        {/* Four stat chips in a horizontal band — gives leadership a quick snapshot
            before they read the detail tables below. */}
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <SummaryChip label="Total Members"  value={String(totalMembers)}  color="slate" />
          <SummaryChip label="Over Capacity"  value={String(overCount)}     color="red"   />
          <SummaryChip label="At Risk (>80%)" value={String(atRiskCount)}   color="amber" />
          <SummaryChip label="Avg Allocation" value={`${avgAlloc}%`}        color="blue"  />
        </div>

        {/* ── Domain sections ───────────────────────────────────────────────── */}
        {hierarchy.map(({ domain, teams: domainTeams }) => (
          <section key={domain.id} className="mb-10">
            {/* Domain header — large bold rule that anchors the section visually */}
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                {domain.name}
              </h2>
              {domain.description && (
                <p className="text-xs text-slate-400 mt-0.5">{domain.description}</p>
              )}
            </div>

            {domainTeams.map(({ team, members: teamMembers }) => (
              <div key={team.id} className="mb-6">
                {/* Team sub-header */}
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">{team.name}</h3>
                  <span className="text-xs text-slate-400">
                    {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Member table — one row per person */}
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-1.5 pr-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-8" />
                      <th className="text-left py-1.5 pr-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
                      <th className="text-left py-1.5 pr-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Role</th>
                      <th className="text-center py-1.5 pr-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-20">Alloc %</th>
                      <th className="text-center py-1.5 pr-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-20">Status</th>
                      <th className="text-left py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Projects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map(m => {
                      const alloc    = allocByMember.get(m.id) ?? 0
                      const cap      = m.capacity
                      const qProjs   = memberQProjects(m.id, projects, qStart, qEnd)
                      const projText = truncateProjects(qProjs)
                      const colors   = avatarColor(m.name)

                      return (
                        <tr
                          key={m.id}
                          className="border-b border-slate-100 hover:bg-slate-50 print:hover:bg-transparent"
                        >
                          {/* Avatar initials — inline styles for print-safe colors */}
                          <td className="py-2 pr-3">
                            <div
                              className={cn(
                                'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                                colors.bg,
                                colors.text,
                              )}
                            >
                              {m.avatarInitials.slice(0, 2)}
                            </div>
                          </td>

                          <td className="py-2 pr-3 font-medium text-slate-900 whitespace-nowrap">
                            {m.name}
                          </td>

                          <td className="py-2 pr-3 text-slate-500 text-xs whitespace-nowrap">
                            {m.role}
                          </td>

                          {/* Allocation % badge — inline bg/text so it prints with color */}
                          <td className="py-2 pr-3 text-center">
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{ ...allocBgStyle(alloc, cap), ...allocTextStyle(alloc, cap) }}
                            >
                              {alloc > 0 ? `${alloc}%` : '—'}
                            </span>
                          </td>

                          {/* Capacity status label */}
                          <td className={cn('py-2 pr-3 text-center text-xs', allocTextClass(alloc, cap))}>
                            {capacityLabel(alloc, cap)}
                          </td>

                          {/* Q-overlap project names, truncated at 3 */}
                          <td className="py-2 text-xs text-slate-600 max-w-xs">
                            {projText}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        ))}

        {/* Empty state — shown when the store has no data loaded */}
        {hierarchy.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            No domains or members found. Load seed data to populate the report.
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-slate-200 text-xs text-slate-400 flex justify-between">
          <span>Store &amp; Associate Technology — {qLabel} Capacity Report</span>
          <span>{formatToday()}</span>
        </div>
      </div>
    </div>
  )
}

// ─── SummaryChip ──────────────────────────────────────────────────────────────

/**
 * Small stat chip used in the summary row.
 * Color is one of the four semantic options below — drives the tinted background.
 * Uses inline styles for the color tints so they print reliably.
 */
function SummaryChip({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: 'slate' | 'red' | 'amber' | 'blue'
}) {
  // Map color names to inline background/text style objects for print safety
  const BG_MAP: Record<typeof color, React.CSSProperties> = {
    slate: { backgroundColor: '#f8fafc' },
    red:   { backgroundColor: '#fee2e2' },
    amber: { backgroundColor: '#fef3c7' },
    blue:  { backgroundColor: '#eff6ff' },
  }
  const TEXT_MAP: Record<typeof color, React.CSSProperties> = {
    slate: { color: '#475569' },
    red:   { color: '#dc2626' },
    amber: { color: '#d97706' },
    blue:  { color: '#2563eb' },
  }

  return (
    <div
      className="flex flex-col items-center px-5 py-3 rounded-xl border border-slate-200"
      style={BG_MAP[color]}
    >
      <span className="text-xl font-bold" style={TEXT_MAP[color]}>{value}</span>
      <span className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">{label}</span>
    </div>
  )
}
