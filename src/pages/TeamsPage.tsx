/**
 * Roster page — all team members organised by Domain → Team.
 *
 * Features:
 *   • Search by name or role (case-insensitive substring match)
 *   • Filter by domain (dropdown; "All Domains" shows everything)
 *   • Allocation filter: all | at-risk (>80%) | over-capacity (>100%)
 *   • Empty teams and domains are hidden when filters are active
 *   • Each member card links to their detail page
 *
 * Allocation is calculated against the current fiscal quarter so the numbers
 * reflect real workload rather than raw capacity percentage.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, ChevronRight, Search, SearchX } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FilterChip } from '@/components/ui/filter-chip'
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown'
import { ColorBadge } from '@/components/ui/color-badge'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { PHASE_COLORS, avatarColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { Member } from '@/types'
import { memberQuarterAllocation } from '@/lib/fiscal'

// ─── Member card ──────────────────────────────────────────────────────────

function MemberCard({ member, onClick }: { member: Member; onClick: () => void }) {
  const { projects } = usePortfolioStore()
  const memberProjects = projects.filter(p => p.assignments.some(a => a.memberId === member.id))
  const totalAlloc = memberQuarterAllocation(member.id, projects)
  // Compare against the member's own capacity setting so part-time members
  // are flagged at the right threshold, not always at 80/100.
  const cap = member.capacity
  const isOver  = totalAlloc > cap
  const isAtRisk = !isOver && cap > 0 && totalAlloc / cap > 0.8

  const allocColor = isOver ? 'text-red-600' : isAtRisk ? 'text-amber-600' : 'text-green-600'
  const barColor   = isOver ? 'bg-red-500'   : isAtRisk ? 'bg-amber-400'   : 'bg-green-500'

  const phaseBreakdown = (
    ['Research','Discovery','Development','QA','Deployed','On Hold'] as const
  )
    .map(ph => ({ ph, count: memberProjects.filter(p => p.phase === ph).length }))
    .filter(x => x.count > 0)

  const active  = memberProjects.filter(p => p.status === 'In Progress').length
  const blocked = memberProjects.filter(p => p.status === 'Blocked').length

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all group"
    >
      {/* Top row: avatar + name + chevron */}
      <div className="flex items-center gap-3">
        <div className={cn('flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs shrink-0', avatarColor(member.name).bg, avatarColor(member.name).text)}>
          {member.avatarInitials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm">{member.name}</p>
          <p className="text-xs text-slate-400">{member.role}</p>
        </div>
        <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-400 transition-colors shrink-0" />
      </div>

      {/* Allocation bar */}
      <div className="mt-3">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-slate-400">Allocation (current quarter)</span>
          <span className={cn('text-xs font-semibold', allocColor)}>{totalAlloc}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full', barColor)}
            style={{ width: cap > 0 ? `${Math.min((totalAlloc / cap) * 100, 100)}%` : `${Math.min(totalAlloc, 100)}%` }}
          />
        </div>
      </div>

      {/* Phase breakdown */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {phaseBreakdown.map(({ ph, count }) => (
            <ColorBadge key={ph} className={cn('text-xs', PHASE_COLORS[ph])}>
              {count} {ph}
            </ColorBadge>
          ))}
          {phaseBreakdown.length === 0 && (
            <span className="text-xs text-slate-300">No projects</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs shrink-0 ml-2">
          {active  > 0 && <span className="text-blue-600 font-medium">{active} active</span>}
          {blocked > 0 && <span className="text-red-500 font-medium">{blocked} blocked</span>}
        </div>
      </div>
    </button>
  )
}

// ─── Roster page ──────────────────────────────────────────────────────────

type AllocFilter = 'all' | 'at-risk' | 'over'

export function RosterPage() {
  const { domains, teams, members, projects } = usePortfolioStore()
  const navigate = useNavigate()

  const [search, setSearch]                   = useState('')
  const [selectedDomains,  setSelectedDomains]  = useState<string[]>([])
  const [selectedTeams,    setSelectedTeams]    = useState<string[]>([])
  const [selectedMembers,  setSelectedMembers]  = useState<string[]>([])
  const [allocFilter, setAllocFilter]           = useState<AllocFilter>('all')

  // ── Build filtered grouped data ──────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    const matchesMember = (m: Member) => {
      if (q && !m.name.toLowerCase().includes(q) && !m.role.toLowerCase().includes(q)) return false
      if (selectedMembers.length > 0 && !selectedMembers.includes(m.id)) return false
      if (allocFilter !== 'all') {
        const alloc = memberQuarterAllocation(m.id, projects)
        const mCap  = m.capacity
        if (allocFilter === 'at-risk' && !(alloc <= mCap && mCap > 0 && alloc / mCap > 0.8)) return false
        if (allocFilter === 'over'    && alloc <= mCap) return false
      }
      return true
    }

    return domains
      .filter(d => selectedDomains.length === 0 || selectedDomains.includes(d.id))
      .map(d => ({
        domain: d,
        teams: teams
          .filter(t => t.domainId === d.id)
          .filter(t => selectedTeams.length === 0 || selectedTeams.includes(t.id))
          .map(t => ({
            team: t,
            members: members.filter(m => t.memberIds.includes(m.id) && matchesMember(m)),
          }))
          .filter(t => t.members.length > 0),
      }))
      .filter(d => d.teams.length > 0)
  }, [domains, teams, members, projects, search, selectedDomains, selectedTeams, selectedMembers, allocFilter])

  const totalShowing = filtered.reduce((sum, d) =>
    sum + d.teams.reduce((s, t) => s + t.members.length, 0), 0)
  const totalMembers = members.length

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Roster</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {totalShowing === totalMembers
            ? `${totalMembers} member${totalMembers !== 1 ? 's' : ''} · Click a member to view their profile`
            : `${totalShowing} of ${totalMembers} members · Click a member to view their profile`
          }
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Text search */}
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or role…"
            className="pl-8 h-9 text-sm"
          />
        </div>

        {/* Sort label + allocation chips — "All" is first */}
        <span className="text-xs text-slate-400 ml-1">Sort</span>
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

        {/* Domain, Team, Member multiselect dropdowns */}
        <MultiSelectDropdown
          label="Domain"
          options={domains.map(d => ({ id: d.id, label: d.name }))}
          selected={selectedDomains}
          onChange={setSelectedDomains}
        />
        <MultiSelectDropdown
          label="Team"
          options={teams.map(t => ({ id: t.id, label: t.name }))}
          selected={selectedTeams}
          onChange={setSelectedTeams}
        />
        <MultiSelectDropdown
          label="Member"
          options={members.map(m => ({ id: m.id, label: m.name }))}
          selected={selectedMembers}
          onChange={setSelectedMembers}
        />

        {/* Clear all — sits right after the last dropdown, visible when any multiselect is active */}
        {(selectedDomains.length > 0 || selectedTeams.length > 0 || selectedMembers.length > 0) && (
          <button
            onClick={() => { setSelectedDomains([]); setSelectedTeams([]); setSelectedMembers([]) }}
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <SearchX size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No members match your filters</p>
          <button
            onClick={() => { setSearch(''); setSelectedDomains([]); setSelectedTeams([]); setSelectedMembers([]); setAllocFilter('all') }}
            className="text-sm text-blue-500 hover:underline mt-2 block mx-auto"
          >
            Clear filters
          </button>
        </div>
      ) : (
        filtered.map(({ domain, teams: domainTeams }) => (
          <div key={domain.id}>
            {/* Domain header */}
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-base font-semibold text-slate-700">{domain.name}</h2>
              <span className="text-xs text-slate-400">
                {domainTeams.reduce((s, t) => s + t.members.length, 0)} member{domainTeams.reduce((s, t) => s + t.members.length, 0) !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-4">
              {domainTeams.map(({ team, members: teamMembers }) => (
                <div key={team.id}>
                  {/* Team label */}
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={13} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-600">{team.name}</span>
                    <ChevronRight size={12} className="text-slate-300" />
                    <span className="text-xs text-slate-400">{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {teamMembers.map(m => (
                      <MemberCard key={m.id} member={m} onClick={() => navigate(`/members/${m.id}`)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
