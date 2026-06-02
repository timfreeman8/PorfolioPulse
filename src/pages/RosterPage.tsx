/**
 * RosterPage — full team roster grouped by Domain → Team.
 *
 * Layout:
 *   1. Stats bar — 4 summary cards (total members, over-capacity count, at-risk
 *      count, average allocation %).
 *   2. Filters — text search (name / role / team name) + Domain multiselect.
 *   3. Domain sections — one collapsible section per domain, each containing
 *      one sub-section per team, each team showing a grid of member cards.
 *
 * Member cards surface the key capacity signals at a glance:
 *   - Avatar, name, role, team name
 *   - Q allocation % computed fresh from the current fiscal quarter
 *   - A colored capacity bar (green / amber / red) with the member's capacity ceiling
 *   - Project count for the current quarter
 *   - Red left border when over-capacity; amber when at-risk (>80 % of capacity)
 *
 * All allocation math is delegated to `memberQuarterAllocation` from fiscal.ts
 * so this page stays consistent with the Capacity Planner and Dashboard.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Search, SearchX, TrendingUp, AlertTriangle, Zap, UserCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
import { FilterChip } from '@/components/ui/filter-chip'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { memberQuarterAllocation, getCurrentQBounds } from '@/lib/fiscal'
import { avatarColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { Member, Project } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the count of projects overlapping the current fiscal quarter for a
 * given member. Used to show "N projects this quarter" on member cards.
 */
function memberQuarterProjectCount(memberId: string, projects: Project[]): number {
  const { qStart, qEnd } = getCurrentQBounds()
  return projects.filter(p => {
    if (!p.startDate || !p.targetEndDate) return false
    if (!p.assignments.some(a => a.memberId === memberId)) return false
    const pStart = new Date(p.startDate + 'T00:00:00')
    const pEnd   = new Date(p.targetEndDate + 'T00:00:00')
    return pStart < qEnd && pEnd > qStart
  }).length
}

// ─── Stat card ────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  /** Tailwind classes for the icon container background + text */
  iconColor: string
  /** Optional soft tint on the card itself for warning states */
  cardTint?: string
}

function StatCard({ label, value, icon, iconColor, cardTint }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-4',
      'dark:bg-slate-800 dark:border-slate-700',
      cardTint,
    )}>
      {/* Colored icon bubble */}
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', iconColor)}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      </div>
    </div>
  )
}

// ─── Member card ──────────────────────────────────────────────────────────

interface MemberCardProps {
  member: Member
  teamName: string
  onClick: () => void
}

function MemberCard({ member, teamName, onClick }: MemberCardProps) {
  const { projects } = usePortfolioStore()

  // Compute allocation once per render; memoization lives at the page level
  // so we do a direct call here (fiscal.ts guards against stale values).
  const alloc    = memberQuarterAllocation(member.id, projects)
  const cap      = member.capacity
  const isOver   = alloc > cap
  // At-risk: within capacity but >80 % of it (only meaningful when cap > 0)
  const isAtRisk = !isOver && cap > 0 && alloc / cap > 0.8

  const qProjectCount = memberQuarterProjectCount(member.id, projects)

  // Bar fill is capped at 100 % visually; the color communicates the overflow state.
  const barPct   = cap > 0 ? Math.min((alloc / cap) * 100, 100) : Math.min(alloc, 100)
  const barColor = isOver ? 'bg-red-500' : isAtRisk ? 'bg-amber-400' : 'bg-green-500'
  const allocTextColor = isOver ? 'text-red-600 dark:text-red-400' : isAtRisk ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'

  // Left border signals capacity status without requiring the user to read numbers.
  const borderAccent = isOver
    ? 'border-l-4 border-l-red-400'
    : isAtRisk
    ? 'border-l-4 border-l-amber-400'
    : 'border-l-4 border-l-transparent'

  // Card tint gives a very subtle background wash on problem cards.
  const cardTint = isOver
    ? 'bg-red-50 dark:bg-red-950/20'
    : isAtRisk
    ? 'bg-amber-50 dark:bg-amber-950/20'
    : 'bg-white dark:bg-slate-800'

  const { bg: avatarBg, text: avatarText } = avatarColor(member.name)

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border border-slate-200 dark:border-slate-700',
        'p-4 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md',
        'transition-all group',
        borderAccent,
        cardTint,
      )}
    >
      {/* Row 1: Avatar + name + role */}
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
          avatarBg,
          avatarText,
        )}>
          {member.avatarInitials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
            {member.name}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{member.role}</p>
        </div>
      </div>

      {/* Row 2: Team name badge */}
      <div className="mt-2.5">
        <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <Users size={10} className="shrink-0" />
          {teamName}
        </span>
      </div>

      {/* Row 3: Capacity bar + allocation % */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400 dark:text-slate-500">Q Allocation</span>
          <span className={cn('text-xs font-bold tabular-nums', allocTextColor)}>
            {alloc}%
            {/* Show capacity ceiling so users understand the threshold */}
            <span className="font-normal text-slate-400 dark:text-slate-500"> / {cap}%</span>
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      {/* Row 4: Project count for the quarter */}
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {qProjectCount === 0
            ? 'No projects this quarter'
            : `${qProjectCount} project${qProjectCount !== 1 ? 's' : ''} this quarter`
          }
        </span>
        {/* Capacity status label — shows only for problem states */}
        {isOver && (
          <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
            Over
          </span>
        )}
        {isAtRisk && (
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            At Risk
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Allocation filter type ────────────────────────────────────────────────

type AllocFilter = 'all' | 'at-risk' | 'over'

// ─── Roster page ──────────────────────────────────────────────────────────

export function RosterPage() {
  const { domains, teams, members, projects } = usePortfolioStore()
  const navigate = useNavigate()

  const [search, setSearch]               = useState('')
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])
  const [allocFilter, setAllocFilter]     = useState<AllocFilter>('all')

  // ── Stats — computed over all members, not the filtered subset ───────────
  // We compute these once and rely on the fiscal helper's own caching.
  const stats = useMemo(() => {
    let overCount  = 0
    let riskCount  = 0
    let totalAlloc = 0

    for (const m of members) {
      const alloc = memberQuarterAllocation(m.id, projects)
      const cap   = m.capacity
      totalAlloc += alloc
      if (alloc > cap) overCount++
      else if (cap > 0 && alloc / cap > 0.8) riskCount++
    }

    const avgAlloc = members.length > 0
      ? Math.round(totalAlloc / members.length)
      : 0

    return { total: members.length, overCount, riskCount, avgAlloc }
  }, [members, projects])

  // ── Filtered + grouped data ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    // Look up team name for a member (used in search matching below)
    const teamNameForMember = (m: Member): string => {
      const t = teams.find(t => t.memberIds.includes(m.id))
      return t?.name ?? ''
    }

    const matchesMember = (m: Member): boolean => {
      // Text search across name, role, and team name
      if (q) {
        const teamName = teamNameForMember(m)
        const haystack = `${m.name} ${m.role} ${teamName}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }

      // Allocation filter — at-risk and over-capacity chips
      if (allocFilter !== 'all') {
        const alloc = memberQuarterAllocation(m.id, projects)
        const cap   = m.capacity
        if (allocFilter === 'over'    && alloc <= cap) return false
        if (allocFilter === 'at-risk' && !(alloc <= cap && cap > 0 && alloc / cap > 0.8)) return false
      }

      return true
    }

    return domains
      // Optional domain filter via multiselect
      .filter(d => selectedDomains.length === 0 || selectedDomains.includes(d.id))
      .map(d => ({
        domain: d,
        teams: teams
          .filter(t => t.domainId === d.id)
          .map(t => ({
            team: t,
            // Only include members that pass the search/alloc filter
            members: members.filter(m => t.memberIds.includes(m.id) && matchesMember(m)),
          }))
          // Drop teams that have no matching members after filtering
          .filter(t => t.members.length > 0),
      }))
      // Drop domains that have no matching teams
      .filter(d => d.teams.length > 0)
  }, [domains, teams, members, projects, search, selectedDomains, allocFilter])

  const totalShowing = filtered.reduce(
    (sum, d) => sum + d.teams.reduce((s, t) => s + t.members.length, 0),
    0,
  )

  const hasActiveFilters =
    search.trim() !== '' || selectedDomains.length > 0 || allocFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setSelectedDomains([])
    setAllocFilter('all')
  }

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Roster</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          {totalShowing === stats.total
            ? `${stats.total} member${stats.total !== 1 ? 's' : ''} · click a card to open their profile`
            : `${totalShowing} of ${stats.total} members shown · click a card to open their profile`
          }
        </p>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Members"
          value={stats.total}
          icon={<UserCheck size={18} />}
          iconColor="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        />
        <StatCard
          label="Over Capacity"
          value={stats.overCount}
          icon={<Zap size={18} />}
          iconColor="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          cardTint={stats.overCount > 0 ? 'bg-red-50/50 dark:bg-red-950/10' : undefined}
        />
        <StatCard
          label="At Risk (>80%)"
          value={stats.riskCount}
          icon={<AlertTriangle size={18} />}
          iconColor="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          cardTint={stats.riskCount > 0 ? 'bg-amber-50/50 dark:bg-amber-950/10' : undefined}
        />
        <StatCard
          label="Avg Allocation"
          value={`${stats.avgAlloc}%`}
          icon={<TrendingUp size={18} />}
          iconColor="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
        />
      </div>

      {/* ── Search + filters ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Free-text search */}
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, role, or team…"
            className="pl-8 h-9 text-sm dark:bg-slate-800 dark:border-slate-600"
          />
        </div>

        {/* Allocation filter chips */}
        <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">Filter</span>
        {([
          { key: 'all',     label: 'All' },
          { key: 'at-risk', label: '>80% allocated' },
          { key: 'over',    label: 'Over capacity' },
        ] as { key: AllocFilter; label: string }[]).map(({ key, label }) => (
          <FilterChip
            key={key}
            label={label}
            active={allocFilter === key}
            onClick={() => setAllocFilter(key)}
          />
        ))}

        {/* Domain multiselect */}
        <MultiSelectDropdown
          label="Domain"
          options={domains.map(d => ({ id: d.id, label: d.name }))}
          selected={selectedDomains}
          onChange={setSelectedDomains}
        />

        {/* Clear all — only visible when any filter is active */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Results ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        /* Empty state — shown when search / filters yield no results */
        <div className="text-center py-20">
          <SearchX size={44} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
          <p className="font-semibold text-slate-500 dark:text-slate-400">No members match your filters</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Try adjusting your search or clearing the active filters.
          </p>
          <button
            onClick={clearFilters}
            className="mt-4 text-sm text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {filtered.map(({ domain, teams: domainTeams }) => {
            // Total member count visible in this domain after filtering
            const domainMemberCount = domainTeams.reduce((s, t) => s + t.members.length, 0)

            return (
              <div key={domain.id}>
                {/* Domain header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {domain.name}
                  </h2>
                  {/* Member count badge */}
                  <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                    {domainMemberCount} member{domainMemberCount !== 1 ? 's' : ''}
                  </span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>

                <div className="space-y-5">
                  {domainTeams.map(({ team, members: teamMembers }) => (
                    <div key={team.id}>
                      {/* Team sub-header */}
                      <div className="flex items-center gap-2 mb-3">
                        <Users size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {team.name}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          · {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Member card grid — responsive: 1 → 2 → 3 columns */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {teamMembers.map(m => (
                          <MemberCard
                            key={m.id}
                            member={m}
                            teamName={team.name}
                            onClick={() => navigate(`/members/${m.id}`)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
