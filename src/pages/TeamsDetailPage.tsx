/**
 * Teams page — detailed profile view for an individual team.
 *
 * Layout: two-column split.
 *   Left  — scrollable domain/team navigator. Click a team to select it.
 *   Right — selected team's full profile:
 *             • Header: team name, domain, tech lead, description
 *             • Members: cards showing role + current-quarter allocation
 *             • Projects: ranked table of every project any team member
 *               is assigned to, sorted by priority then status then date.
 *               Critical projects show a red flag.
 *
 * Prioritization logic (same order used across the app):
 *   Critical > High > Medium > Low → then In Progress > Blocked > Backlog > Complete
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flag, Users, ChevronRight, ExternalLink } from 'lucide-react'
import { ColorBadge } from '@/components/ui/color-badge'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { STATUS_COLORS, PHASE_COLORS, PRIORITY_COLORS, avatarColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import type { Team, Member, Project, Domain } from '@/types'
import { memberQuarterAllocation } from '@/lib/fiscal'

// ─── Priority sort order ──────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  Critical: 0, High: 1, Medium: 2, Low: 3,
}
const STATUS_ORDER: Record<string, number> = {
  'In Progress': 0, Blocked: 1, Backlog: 2, Complete: 3,
}

// ─── Sub-components ───────────────────────────────────────────────────────

/**
 * MemberRow — one member in the team members section.
 * Shows avatar, name, role, allocation bar, and a link to the member detail page.
 */
function MemberRow({ member, projects, onNavigate }: {
  member: Member
  projects: Project[]
  onNavigate: () => void
}) {
  const alloc = memberQuarterAllocation(member.id, projects)
  const cap = member.capacity
  const isOver  = alloc > cap
  const isAtRisk = !isOver && cap > 0 && alloc / cap > 0.8
  // Dark variants for capacity text — red/amber/green don't flip via global CSS.
  const allocColor = isOver ? 'text-red-600 dark:text-red-400' : isAtRisk ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
  const barColor   = isOver ? 'bg-red-500'   : isAtRisk ? 'bg-amber-400'   : 'bg-green-500'

  return (
    <button
      onClick={onNavigate}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group border-b border-slate-100 last:border-0"
    >
      <div className={cn('w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center shrink-0', avatarColor(member.name).bg, avatarColor(member.name).text)}>
        {member.avatarInitials.slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{member.name}</p>
        <p className="text-xs text-slate-400 truncate">{member.role}</p>
        {/* Allocation bar */}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', barColor)} style={{ width: cap > 0 ? `${Math.min((alloc / cap) * 100, 100)}%` : `${Math.min(alloc, 100)}%` }} />
          </div>
          <span className={cn('text-[10px] font-semibold shrink-0 w-7 text-right', allocColor)}>{alloc}%</span>
        </div>
      </div>
      <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-400 transition-colors shrink-0" />
    </button>
  )
}

/**
 * ProjectRow — one project in the prioritized projects section.
 * Rank number reflects sort position; Critical projects show a red flag.
 */
function ProjectRow({ project, rank, teamMemberIds }: {
  project: Project
  rank: number
  teamMemberIds: string[]
}) {
  const isCritical = project.priority === 'Critical'
  // Members from this team assigned to this project
  const assignees = project.assignments.filter(a => teamMemberIds.includes(a.memberId))

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      {/* Rank */}
      <span className="text-xs font-bold text-slate-400 w-5 shrink-0 text-right">#{rank}</span>

      {/* Critical flag */}
      {isCritical
        ? <Flag size={12} className="text-red-500 shrink-0" fill="currentColor" />
        : <div className="w-3 shrink-0" />}

      {/* Name + progress */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{project.name}</p>
        {project.percentComplete > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
              {/* bg-blue-400 progress fill — darken slightly for dark surfaces */}
              <div className="h-full bg-blue-400 dark:bg-blue-500 rounded-full" style={{ width: `${project.percentComplete}%` }} />
            </div>
            <span className="text-[10px] text-slate-400">{project.percentComplete}%</span>
          </div>
        )}
      </div>

      {/* Assigned team members' parts */}
      {assignees.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {assignees.slice(0, 3).map(a => (
            <span key={a.memberId} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
              {a.part || `${a.allocation}%`}
            </span>
          ))}
        </div>
      )}

      {/* Phase + Status */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ColorBadge className={cn('text-[10px]', PHASE_COLORS[project.phase])}>{project.phase}</ColorBadge>
        <ColorBadge className={cn('text-[10px]', STATUS_COLORS[project.status])}>{project.status}</ColorBadge>
      </div>

      {/* Priority */}
      <ColorBadge className={cn('text-[10px] shrink-0', PRIORITY_COLORS[project.priority])}>
        {project.priority}
      </ColorBadge>

      {/* Target date */}
      <span className="text-[10px] text-slate-400 shrink-0 w-20 text-right">
        {project.targetEndDate || '—'}
      </span>
    </div>
  )
}

// ─── Team detail panel ────────────────────────────────────────────────────

/**
 * TeamDetail — right-hand panel showing the full profile of one team.
 */
function TeamDetail({ team, domain }: { team: Team; domain?: Domain }) {
  const { members, projects } = usePortfolioStore()
  const navigate = useNavigate()

  // Members of this team
  const teamMembers = useMemo(
    () => members.filter(m => team.memberIds.includes(m.id)),
    [members, team.memberIds]
  )

  // All projects where at least one team member is assigned,
  // sorted by priority → status → target date
  const teamProjects = useMemo(() => {
    const seen = new Set<string>()
    const result: Project[] = []
    for (const member of teamMembers) {
      for (const project of projects) {
        if (!seen.has(project.id) && project.assignments.some(a => a.memberId === member.id)) {
          seen.add(project.id)
          result.push(project)
        }
      }
    }
    return result.sort((a, b) => {
      const pdiff = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
      if (pdiff !== 0) return pdiff
      const sdiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
      if (sdiff !== 0) return sdiff
      return (a.targetEndDate ?? '').localeCompare(b.targetEndDate ?? '')
    })
  }, [teamMembers, projects])

  const avgAlloc = useMemo(() => {
    if (teamMembers.length === 0) return 0
    const total = teamMembers.reduce((sum, m) => sum + memberQuarterAllocation(m.id, projects), 0)
    return Math.round(total / teamMembers.length)
  }, [teamMembers, projects])

  // Dark variants for capacity text color — red/amber/green don't flip via global CSS.
  const allocColor =
    avgAlloc > 100 ? 'text-red-600 dark:text-red-400' :
    avgAlloc > 80  ? 'text-amber-600 dark:text-amber-400' :
    'text-green-600 dark:text-green-400'

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Team header */}
      <div className="px-8 pt-6 pb-4 border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              {domain && <span className="text-xs text-slate-400 font-medium">{domain.name}</span>}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{team.name}</h2>
            {team.description && (
              <p className="text-sm text-slate-500 mt-1 max-w-2xl">{team.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span><strong className="text-slate-700">{teamMembers.length}</strong> member{teamMembers.length !== 1 ? 's' : ''}</span>
              <span><strong className="text-slate-700">{teamProjects.length}</strong> project{teamProjects.length !== 1 ? 's' : ''}</span>
              <span>Avg alloc: <strong className={allocColor}>{avgAlloc}%</strong></span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-8">
        {/* Members section */}
        <section>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Users size={14} className="text-slate-400" />
            Members
            <span className="text-xs font-normal text-slate-400">({teamMembers.length})</span>
          </h3>
          {teamMembers.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No members assigned to this team.</p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              {teamMembers.map(m => (
                <MemberRow
                  key={m.id}
                  member={m}
                  projects={projects}
                  onNavigate={() => navigate(`/members/${m.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Projects section */}
        <section>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Flag size={14} className="text-slate-400" />
            Projects
            <span className="text-xs font-normal text-slate-400">({teamProjects.length}) — ranked by priority</span>
          </h3>
          {teamProjects.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No projects assigned to team members.</p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              {/* Column headers */}
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                <span className="w-5 shrink-0" />
                <span className="w-3 shrink-0" />
                <span className="flex-1">Project</span>
                <span className="hidden sm:block w-32 shrink-0">Parts</span>
                <span className="shrink-0">Phase / Status</span>
                <span className="w-14 shrink-0 text-right">Priority</span>
                <span className="w-20 shrink-0 text-right">Due</span>
              </div>
              {teamProjects.map((p, i) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  rank={i + 1}
                  teamMemberIds={team.memberIds}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ─── Teams page ───────────────────────────────────────────────────────────

export function TeamsPage() {
  const { domains, teams } = usePortfolioStore()
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(() => teams[0]?.id ?? null)

  const selectedTeam = teams.find(t => t.id === selectedTeamId)
  const selectedDomain = selectedTeam
    ? domains.find(d => d.id === selectedTeam.domainId)
    : undefined

  // Domains that have at least one team
  const activeDomains = useMemo(
    () => domains.filter(d => teams.some(t => t.domainId === d.id)),
    [domains, teams]
  )

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left nav: domain/team tree ──────────────────────────────── */}
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <h1 className="text-base font-bold text-slate-900">Teams</h1>
          <p className="text-xs text-slate-400 mt-0.5">{teams.length} teams across {activeDomains.length} domains</p>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {activeDomains.map(domain => {
            const domainTeams = teams.filter(t => t.domainId === domain.id)
            return (
              <div key={domain.id} className="mb-2">
                {/* Domain label */}
                <div className="px-4 py-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {domain.name}
                  </span>
                </div>
                {/* Team list */}
                {domainTeams.map(team => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 group',
                      selectedTeamId === team.id
                        // bg-blue-50/text-blue-700 selected state needs dark flip
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-600'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900',
                    )}
                  >
                    <span className="flex-1 truncate">{team.name}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{team.memberIds.length}</span>
                    <ExternalLink size={10} className={cn('shrink-0 opacity-0 group-hover:opacity-100', selectedTeamId === team.id && 'opacity-0')} />
                  </button>
                ))}
              </div>
            )
          })}
        </nav>
      </aside>

      {/* ── Right panel: selected team detail ──────────────────────── */}
      {selectedTeam ? (
        <TeamDetail team={selectedTeam} domain={selectedDomain} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          Select a team to view its profile
        </div>
      )}
    </div>
  )
}
