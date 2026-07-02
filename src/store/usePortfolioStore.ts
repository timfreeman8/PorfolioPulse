/**
 * Global application state — the single source of truth for all portfolio data.
 *
 * Built with Zustand. Every action that mutates state also calls `persist()`
 * so changes are saved to localStorage immediately. Reading state is always
 * synchronous via `usePortfolioStore()` in any component.
 *
 * Cascade deletes: removing a high-level entity (Domain → Team → Member)
 * automatically cleans up all child records to keep the store consistent.
 * Member.projectIds and Team.memberIds are denormalized for quick lookups and
 * are kept in sync by the add/update/delete actions below.
 *
 * To add a new entity type: define its interface in types/index.ts, add it to
 * PortfolioState, add CRUD actions to PortfolioActions, and implement them in
 * the store below following the same pattern.
 */
import { create } from 'zustand'
import { loadState, saveState, scheduleSave } from '@/lib/persistence'
import { sendTeamsAlert } from '@/lib/notifications'
import { normalizeRoles, roleCategoryOf } from '@/lib/roles'
import { legacyToPhases } from '@/lib/projectBuilder'
import type {
  Domain,
  Escalation,
  Initiative,
  IntakeRequest,
  Member,
  PortfolioState,
  Project,
  PtoBlock,
  RoleDefinition,
  Team,
  WeeklyPulse,
} from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID()
}

/**
 * Schedule a debounced write after every mutation.
 * Rapid consecutive mutations (e.g. dragging a Gantt bar) are coalesced into
 * a single localStorage write 500ms after the last change, keeping the main
 * thread unblocked. See persistence.ts for details and trade-offs.
 *
 * Exception: the hydrate() action calls saveState() directly because it is a
 * one-time bulk write that must complete before the caller triggers a reload.
 */
function persist(state: PortfolioState) {
  scheduleSave(state)
}

// ─── Store actions interface ───────────────────────────────────────────────

interface PortfolioActions {
  /** Replace the entire state (used by seed loader). */
  hydrate: (state: PortfolioState) => void

  // Domains
  addDomain: (payload: Omit<Domain, 'id'>) => Domain
  updateDomain: (id: string, patch: Partial<Omit<Domain, 'id'>>) => void
  deleteDomain: (id: string) => void
  /** Persist a new display order for all domains (drag-to-reorder on Portfolio page). */
  reorderDomains: (orderedIds: string[]) => void

  // Teams
  addTeam: (payload: Omit<Team, 'id' | 'memberIds'>) => Team
  updateTeam: (id: string, patch: Partial<Omit<Team, 'id'>>) => void
  deleteTeam: (id: string) => void
  /** Persist a new display order for teams within a single domain. */
  reorderDomainTeams: (domainId: string, orderedTeamIds: string[]) => void

  // Members
  addMember: (payload: Omit<Member, 'id' | 'projectIds'>) => Member
  updateMember: (id: string, patch: Partial<Omit<Member, 'id'>>) => void
  deleteMember: (id: string) => void
  reorderTeamMembers: (teamId: string, orderedMemberIds: string[]) => void
  /** Persist a new project order for a member (drag-to-set-priority on Member Detail). */
  reorderMemberProjects: (memberId: string, orderedProjectIds: string[]) => void

  // Projects
  addProject: (payload: Omit<Project, 'id' | 'updatedAt'>) => Project
  updateProject: (id: string, patch: Partial<Omit<Project, 'id'>>) => void
  deleteProject: (id: string) => void

  // Initiatives
  addInitiative: (payload: Omit<Initiative, 'id'>) => Initiative
  updateInitiative: (id: string, patch: Partial<Omit<Initiative, 'id'>>) => void
  deleteInitiative: (id: string) => void

  // Intake requests
  addIntakeRequest: (payload: Omit<IntakeRequest, 'id' | 'submittedAt'>) => IntakeRequest
  updateIntakeRequest: (id: string, patch: Partial<Omit<IntakeRequest, 'id'>>) => void
  deleteIntakeRequest: (id: string) => void

  // PTO
  addPto: (payload: Omit<PtoBlock, 'id'>) => PtoBlock
  deletePto: (id: string) => void

  // Escalations
  addEscalation: (payload: Omit<Escalation, 'id' | 'submittedAt' | 'status'>) => Escalation
  resolveEscalation: (id: string, note: string) => void
  deleteEscalation: (id: string) => void

  /**
   * Convert an approved intake request into a real project and assign it to a
   * member. Marks the intake as 'Approved' and creates the project in one
   * atomic action.
   */
  convertIntakeToProject: (
    intakeId: string,
    projectPayload: Omit<Project, 'id' | 'updatedAt'>,
  ) => Project

  // Weekly Pulse
  addPulse: (payload: Omit<WeeklyPulse, 'id' | 'updatedAt'>) => WeeklyPulse
  updatePulse: (id: string, patch: Partial<Omit<WeeklyPulse, 'id'>>) => void
  deletePulse: (id: string) => void

  // Resource rates (legacy — kept for backwards compat; prefer roleDefinitions)
  /**
   * Upsert an annual rate for a role. Creates the entry if the role is new,
   * or updates the existing entry when the role already has a rate.
   */
  setResourceRate: (role: string, annualRate: number) => void
  /** Remove the rate entry for a role (role will show as "no rate defined"). */
  removeResourceRate: (role: string) => void

  // Role definitions — the primary source of truth for job title metadata
  /** Create a new role definition. Returns the created definition with its generated id. */
  addRoleDefinition: (def: Omit<RoleDefinition, 'id'>) => RoleDefinition
  /** Update any subset of fields on an existing role definition. */
  updateRoleDefinition: (id: string, patch: Partial<Omit<RoleDefinition, 'id'>>) => void
  /** Delete a role definition by id. Does not cascade to members — their role string is left unchanged. */
  removeRoleDefinition: (id: string) => void

  // Access control
  /** Replace the full list of admin member IDs (used by Settings → Access Control). */
  setAdminMemberIds: (ids: string[]) => void
}

// ─── Empty initial state ───────────────────────────────────────────────────

const EMPTY_STATE: PortfolioState = {
  domains: [],
  teams: [],
  members: [],
  projects: [],
  initiatives: [],
  intakeRequests: [],
  escalations: [],
  ptoBlocks: [],
  weeklyPulses: [],
  resourceRates: [],
  roleDefinitions: [],
  adminMemberIds: [],
}

// ─── Store ────────────────────────────────────────────────────────────────

/**
 * Migrate loaded state to normalize legacy role strings (e.g. "PM" → "Product
 * Management", "Design" → "UI Design") so existing localStorage data stays in
 * sync with the canonical role list in src/lib/roles.ts.
 */
function migrateState(state: PortfolioState): PortfolioState {
  // ── Seed roleDefinitions from existing data if not yet populated ────────
  // When loading a store that pre-dates this field, build the initial set from
  // every unique member role string + any existing resourceRate entries. This
  // ensures users who already configured rates don't lose them on upgrade.
  const rawRoleDefinitions: RoleDefinition[] = state.roleDefinitions ?? []
  const seededRoleDefinitions: RoleDefinition[] = rawRoleDefinitions.length > 0
    ? rawRoleDefinitions
    : (() => {
        const existingRates: { role: string; annualRate: number }[] = state.resourceRates ?? []
        const rateMap = new Map(existingRates.map(r => [r.role, r.annualRate]))
        const uniqueRoles = [...new Set((state.members ?? []).map(m => m.role).filter(Boolean))]
        return uniqueRoles.map(name => ({
          id: crypto.randomUUID(),
          name,
          category: roleCategoryOf(name),
          annualRate: rateMap.get(name) ?? 0,
          aadJobTitle: '',
        }))
      })()

  return {
    ...state,
    // Backfill resourceRates for stores created before this field existed.
    resourceRates: state.resourceRates ?? [],
    // Seed roleDefinitions — empty on first load, preserved on subsequent loads.
    roleDefinitions: seededRoleDefinitions,
    // Backfill adminMemberIds for stores created before role-based access was added.
    adminMemberIds: state.adminMemberIds ?? [],
    // Backfill weeklyPulses for stores created before this field existed.
    // Migrates three historical shapes into the current PriorityItem[] format:
    //   1. Old PriorityItem  { text, size, label? } — strip label, keep text+size.
    //   2. Plain string      (intermediate refactor) — wrap with default size 'M'.
    //   3. Current format    PriorityItem { text, size } — pass through as-is.
    weeklyPulses: (state.weeklyPulses ?? []).map((p: WeeklyPulse & {
      currentPriorities: (string | { text: string; size?: string; label?: string })[]
    }) => ({
      ...p,
      priorityTags: p.priorityTags ?? [],
      currentPriorities: p.currentPriorities.map((item) => {
        if (typeof item === 'string') return { text: item, size: 'M' as const }
        const size = (['S', 'M', 'L', 'XL'] as const).includes(item.size as never)
          ? (item.size as 'S' | 'M' | 'L' | 'XL')
          : 'M' as const
        return { text: item.text, size }
      }),
    })),
    projects: state.projects.map(p => ({
      ...p,
      // Backfill blockedByIds for records that pre-date this field.
      blockedByIds: p.blockedByIds ?? [],
      // Backfill value fields for records that pre-date cost/value tracking.
      estimatedValue: p.estimatedValue ?? undefined,
      valueType:      p.valueType      ?? undefined,
      actualValue:    p.actualValue    ?? undefined,
      assignments: p.assignments.map(a => ({
        ...a,
        part: normalizeRoles(a.part),
      })),
      // Auto-convert single-phase projects to the phases model.
      // Projects that already have phases (like p30) are left untouched.
      phases: p.phases ?? legacyToPhases(p),
    })),
  }
}

export const usePortfolioStore = create<PortfolioState & PortfolioActions>(
  (set, get) => ({
    // Load persisted state (migrating legacy role names) or start empty
    ...(loadState() ? migrateState(loadState()!) : EMPTY_STATE),

    // ── Hydrate ────────────────────────────────────────────────────────────
    hydrate(state) {
      set(state)
      // Use saveState directly (not scheduleSave) — hydrate is a bulk import
      // that must be written before the caller triggers a page reload.
      saveState(state)
    },

    // ── Domains ────────────────────────────────────────────────────────────
    addDomain(payload) {
      const domain: Domain = { id: uid(), ...payload }
      set(s => {
        const next = { ...s, domains: [...s.domains, domain] }
        persist(next)
        return next
      })
      return domain
    },
    updateDomain(id, patch) {
      set(s => {
        const next = {
          ...s,
          domains: s.domains.map(d => (d.id === id ? { ...d, ...patch } : d)),
        }
        persist(next)
        return next
      })
    },
    deleteDomain(id) {
      set(s => {
        // Cascade: remove teams → members → projects in that domain
        const teamIds = s.teams.filter(t => t.domainId === id).map(t => t.id)
        const memberIds = s.members.filter(m => m.teamIds.some(tid => teamIds.includes(tid))).map(m => m.id)
        const projectIds = s.projects
          .filter(p => p.assignments.some(a => memberIds.includes(a.memberId)))
          .map(p => p.id)
        const next: PortfolioState = {
          ...s,
          domains: s.domains.filter(d => d.id !== id),
          teams: s.teams.filter(t => !teamIds.includes(t.id)),
          members: s.members.filter(m => !memberIds.includes(m.id)),
          projects: s.projects.filter(p => !projectIds.includes(p.id)),
          initiatives: s.initiatives,
          intakeRequests: s.intakeRequests,
        }
        persist(next)
        return next
      })
    },

    reorderDomains(orderedIds) {
      set(s => {
        // Rebuild domains array in the requested order, preserving all domain data.
        const byId = new Map(s.domains.map(d => [d.id, d]))
        const next = { ...s, domains: orderedIds.map(id => byId.get(id)!).filter(Boolean) }
        persist(next)
        return next
      })
    },

    // ── Teams ──────────────────────────────────────────────────────────────
    addTeam(payload) {
      const team: Team = { id: uid(), memberIds: [], ...payload }
      set(s => {
        // Register teamId in parent domain's teams list (via team.domainId)
        const next = { ...s, teams: [...s.teams, team] }
        persist(next)
        return next
      })
      return team
    },
    reorderDomainTeams(domainId, orderedTeamIds) {
      set(s => {
        // Find the indices in the global teams array that belong to this domain,
        // then swap in the reordered list at those same slots so teams from other
        // domains are unaffected.
        const slots = s.teams
          .map((t, i) => ({ t, i }))
          .filter(({ t }) => t.domainId === domainId)
          .map(({ i }) => i)
        const byId = new Map(s.teams.map(t => [t.id, t]))
        const reordered = orderedTeamIds.map(id => byId.get(id)!).filter(Boolean)
        const newTeams = [...s.teams]
        reordered.forEach((team, idx) => { newTeams[slots[idx]] = team })
        const next = { ...s, teams: newTeams }
        persist(next)
        return next
      })
    },
    reorderTeamMembers(teamId, orderedMemberIds) {
      set(s => {
        const next = {
          ...s,
          teams: s.teams.map(t =>
            t.id === teamId ? { ...t, memberIds: orderedMemberIds } : t
          ),
        }
        persist(next)
        return next
      })
    },
    reorderMemberProjects(memberId, orderedProjectIds) {
      // Persist the user's drag-ordered project list so it can be used as a
      // priority ranking across the member's project table.
      set(s => {
        const next = {
          ...s,
          members: s.members.map(m =>
            m.id === memberId ? { ...m, projectIds: orderedProjectIds } : m
          ),
        }
        persist(next)
        return next
      })
    },
    updateTeam(id, patch) {
      set(s => {
        const next = {
          ...s,
          teams: s.teams.map(t => (t.id === id ? { ...t, ...patch } : t)),
        }
        persist(next)
        return next
      })
    },
    deleteTeam(id) {
      set(s => {
        // Remove team from members' teamIds; only delete members who have no teams left
        const updatedMembers = s.members.map(m => ({
          ...m,
          teamIds: m.teamIds.filter(tid => tid !== id),
        }))
        const removedMemberIds = updatedMembers.filter(m => m.teamIds.length === 0).map(m => m.id)
        const projectIds = s.projects
          .filter(p => p.assignments.some(a => removedMemberIds.includes(a.memberId)))
          .map(p => p.id)
        const next: PortfolioState = {
          ...s,
          teams: s.teams.filter(t => t.id !== id),
          members: updatedMembers.filter(m => m.teamIds.length > 0),
          projects: s.projects.filter(p => !projectIds.includes(p.id)),
          domains: s.domains,
          initiatives: s.initiatives,
          intakeRequests: s.intakeRequests,
        }
        persist(next)
        return next
      })
    },

    // ── Members ────────────────────────────────────────────────────────────
    addMember(payload) {
      const member: Member = { id: uid(), projectIds: [], ...payload }
      set(s => {
        const next: PortfolioState = {
          ...s,
          members: [...s.members, member],
          // Keep all teams' memberIds in sync
          teams: s.teams.map(t =>
            member.teamIds.includes(t.id)
              ? { ...t, memberIds: [...t.memberIds, member.id] }
              : t,
          ),
        }
        persist(next)
        return next
      })
      return member
    },
    updateMember(id, patch) {
      set(s => {
        const updated = s.members.map(m => (m.id === id ? { ...m, ...patch } : m))
        // If teamIds changed, re-sync team.memberIds
        let teams = s.teams
        if (patch.teamIds) {
          teams = s.teams.map(t => {
            const hasNow   = patch.teamIds!.includes(t.id)
            const hadBefore = t.memberIds.includes(id)
            if (hasNow && !hadBefore) return { ...t, memberIds: [...t.memberIds, id] }
            if (!hasNow && hadBefore) return { ...t, memberIds: t.memberIds.filter(mid => mid !== id) }
            return t
          })
        }
        const next = { ...s, members: updated, teams }
        persist(next)
        return next
      })
    },
    deleteMember(id) {
      set(s => {
        const projectIds = s.projects
          .filter(p => p.assignments.some(a => a.memberId === id))
          .map(p => p.id)
        const next: PortfolioState = {
          ...s,
          members: s.members.filter(m => m.id !== id),
          teams: s.teams.map(t => ({
            ...t,
            memberIds: t.memberIds.filter(mid => mid !== id),
          })),
          projects: s.projects.filter(p => !projectIds.includes(p.id)),
          domains: s.domains,
          initiatives: s.initiatives,
          intakeRequests: s.intakeRequests,
        }
        persist(next)
        return next
      })
    },

    // ── Projects ───────────────────────────────────────────────────────────
    addProject(payload) {
      const project: Project = {
        // Default blockedByIds to [] so the field is always present even when
        // callers (e.g. intake conversion) don't supply it explicitly.
        blockedByIds: [],
        id: uid(),
        updatedAt: new Date().toISOString(),
        ...payload,
      }
      set(s => {
        const next: PortfolioState = {
          ...s,
          projects: [...s.projects, project],
          // Keep each member's projectIds in sync
          members: s.members.map(m =>
            project.assignments.some(a => a.memberId === m.id)
              ? { ...m, projectIds: [...m.projectIds, project.id] }
              : m,
          ),
        }
        persist(next)
        return next
      })
      return project
    },
    updateProject(id, patch) {
      set(s => {
        const existing = s.projects.find(p => p.id === id)
        if (!existing) return s

        const updated: Project = {
          ...existing,
          ...patch,
          updatedAt: new Date().toISOString(),
        }

        // If assignments changed, re-sync member.projectIds
        let members = s.members
        if (patch.assignments) {
          const existingMids = existing.assignments.map(a => a.memberId)
          const newMids = patch.assignments.map(a => a.memberId)
          const removed = existingMids.filter(mid => !newMids.includes(mid))
          const added = newMids.filter(mid => !existingMids.includes(mid))
          members = s.members.map(m => {
            if (removed.includes(m.id))
              return { ...m, projectIds: m.projectIds.filter(pid => pid !== id) }
            if (added.includes(m.id))
              return { ...m, projectIds: [...m.projectIds, id] }
            return m
          })
        }

        const next: PortfolioState = {
          ...s,
          projects: s.projects.map(p => (p.id === id ? updated : p)),
          members,
        }
        persist(next)

        // ── Teams webhook: fire on status → Blocked ───────────────────────
        // Runs after the state update so the notification never blocks the write.
        // sendTeamsAlert is a no-op when no webhook URL is configured.
        if (patch.status === 'Blocked' && existing.status !== 'Blocked') {
          const assigneeNames = existing.assignments
            .map(a => s.members.find(m => m.id === a.memberId)?.name)
            .filter(Boolean)
            .join(', ')
          sendTeamsAlert(
            '🚨 Project Blocked',
            `**${updated.name}** is now Blocked.` +
            (assigneeNames ? ` Assigned to: ${assigneeNames}.` : ''),
          )
        }

        // ── Teams webhook: fire when assignments push a member over capacity ──
        // Computes the total allocation for each affected member across ALL their
        // current projects (sum of assignment.allocation). Fires once per member
        // that crosses the capacity ceiling.
        if (patch.assignments) {
          const affectedMemberIds = new Set([
            ...existing.assignments.map(a => a.memberId),
            ...updated.assignments.map(a => a.memberId),
          ])
          affectedMemberIds.forEach(mid => {
            const member = next.members.find(m => m.id === mid)
            if (!member) return
            // Total allocation across all of this member's active projects.
            const totalAlloc = next.projects
              .flatMap(p => p.assignments)
              .filter(a => a.memberId === mid)
              .reduce((sum, a) => sum + (a.allocation ?? 0), 0)
            // Only fire if they were NOT already over before this update.
            const prevTotal = s.projects
              .flatMap(p => p.assignments)
              .filter(a => a.memberId === mid)
              .reduce((sum, a) => sum + (a.allocation ?? 0), 0)
            if (totalAlloc > member.capacity && prevTotal <= member.capacity) {
              sendTeamsAlert(
                '⚠️ Member Over Capacity',
                `**${member.name}** is now at ${totalAlloc}% allocation ` +
                `(capacity ceiling: ${member.capacity}%).`,
              )
            }
          })
        }

        return next
      })
    },
    deleteProject(id) {
      set(s => {
        const next: PortfolioState = {
          ...s,
          projects: s.projects
            .filter(p => p.id !== id)
            // Remove the deleted project from any other project's blockedByIds
            // so there are no dangling references in the store.
            .map(p =>
              p.blockedByIds?.includes(id)
                ? { ...p, blockedByIds: p.blockedByIds.filter(bid => bid !== id) }
                : p
            ),
          members: s.members.map(m => ({
            ...m,
            projectIds: m.projectIds.filter(pid => pid !== id),
          })),
          domains: s.domains,
          teams: s.teams,
          initiatives: s.initiatives,
          intakeRequests: s.intakeRequests,
        }
        persist(next)
        return next
      })
    },

    // ── Initiatives ────────────────────────────────────────────────────────
    addInitiative(payload) {
      const initiative: Initiative = { id: uid(), ...payload }
      set(s => {
        const next = { ...s, initiatives: [...s.initiatives, initiative] }
        persist(next)
        return next
      })
      return initiative
    },
    updateInitiative(id, patch) {
      set(s => {
        const next = {
          ...s,
          initiatives: s.initiatives.map(i => (i.id === id ? { ...i, ...patch } : i)),
        }
        persist(next)
        return next
      })
    },
    deleteInitiative(id) {
      set(s => {
        const next: PortfolioState = {
          ...s,
          initiatives: s.initiatives.filter(i => i.id !== id),
          // Detach projects from deleted initiative (set initiativeId to '')
          projects: s.projects.map(p =>
            p.initiativeId === id ? { ...p, initiativeId: '' } : p,
          ),
          domains: s.domains,
          teams: s.teams,
          members: s.members,
          intakeRequests: s.intakeRequests,
        }
        persist(next)
        return next
      })
    },

    // ── Intake requests ────────────────────────────────────────────────────
    addIntakeRequest(payload) {
      const request: IntakeRequest = {
        id: uid(),
        submittedAt: new Date().toISOString(),
        ...payload,
      }
      set(s => {
        const next = { ...s, intakeRequests: [...s.intakeRequests, request] }
        persist(next)
        return next
      })
      return request
    },
    updateIntakeRequest(id, patch) {
      set(s => {
        const existing = s.intakeRequests.find(r => r.id === id)
        if (!existing) return s

        // Auto-append to the status audit trail whenever the status field changes
        const extraFields: Partial<typeof existing> = {}
        if (patch.status && patch.status !== existing.status) {
          extraFields.statusHistory = [
            ...(existing.statusHistory ?? []),
            { status: patch.status, changedAt: new Date().toISOString() },
          ]
        }

        const next = {
          ...s,
          intakeRequests: s.intakeRequests.map(r =>
            r.id === id ? { ...r, ...patch, ...extraFields } : r
          ),
        }
        persist(next)
        return next
      })
    },
    deleteIntakeRequest(id) {
      set(s => {
        const next = {
          ...s,
          intakeRequests: s.intakeRequests.filter(r => r.id !== id),
        }
        persist(next)
        return next
      })
    },

    // ── PTO ────────────────────────────────────────────────────────────────
    addPto(payload) {
      const block: PtoBlock = { id: uid(), ...payload }
      set(s => {
        const next = { ...s, ptoBlocks: [...s.ptoBlocks, block] }
        persist(next)
        return next
      })
      return block
    },
    deletePto(id) {
      set(s => {
        const next = { ...s, ptoBlocks: s.ptoBlocks.filter(p => p.id !== id) }
        persist(next)
        return next
      })
    },

    // ── Escalations ────────────────────────────────────────────────────────
    addEscalation(payload) {
      const escalation: Escalation = {
        id: uid(),
        status: 'Open',
        submittedAt: new Date().toISOString(),
        ...payload,
      }
      set(s => {
        const next = { ...s, escalations: [escalation, ...s.escalations] }
        persist(next)
        return next
      })
      return escalation
    },
    resolveEscalation(id, note) {
      set(s => {
        const next = {
          ...s,
          escalations: s.escalations.map(e =>
            e.id === id
              ? { ...e, status: 'Resolved' as const, resolvedAt: new Date().toISOString(), resolvedNote: note }
              : e
          ),
        }
        persist(next)
        return next
      })
    },
    deleteEscalation(id) {
      set(s => {
        const next = { ...s, escalations: s.escalations.filter(e => e.id !== id) }
        persist(next)
        return next
      })
    },

    // ── Convert intake → project ───────────────────────────────────────────
    convertIntakeToProject(intakeId, projectPayload) {
      const { addProject, updateIntakeRequest } = get()
      // Create the project first so we have its generated ID
      const project = addProject(projectPayload)
      // Store the project ID back on the intake request so the pipeline can
      // show an "Epic" badge and link directly to the project page
      updateIntakeRequest(intakeId, { status: 'Approved', convertedProjectId: project.id })
      return project
    },

    // ── Weekly Pulse ───────────────────────────────────────────────────────
    addPulse(payload) {
      const pulse: WeeklyPulse = {
        id: uid(),
        updatedAt: new Date().toISOString(),
        ...payload,
      }
      set(s => {
        const next = { ...s, weeklyPulses: [pulse, ...s.weeklyPulses] }
        persist(next)
        return next
      })
      return pulse
    },
    updatePulse(id, patch) {
      set(s => {
        const next = {
          ...s,
          weeklyPulses: s.weeklyPulses.map(p =>
            p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
          ),
        }
        persist(next)
        return next
      })
    },
    deletePulse(id) {
      set(s => {
        const next = { ...s, weeklyPulses: s.weeklyPulses.filter(p => p.id !== id) }
        persist(next)
        return next
      })
    },

    // ── Resource rates ─────────────────────────────────────────────────────
    setResourceRate(role, annualRate) {
      set(s => {
        // Replace the existing entry for this role, or append a new one.
        const exists = s.resourceRates.some(r => r.role === role)
        const next: PortfolioState = {
          ...s,
          resourceRates: exists
            ? s.resourceRates.map(r => r.role === role ? { role, annualRate } : r)
            : [...s.resourceRates, { role, annualRate }],
        }
        persist(next)
        return next
      })
    },
    removeResourceRate(role) {
      set(s => {
        const next: PortfolioState = {
          ...s,
          resourceRates: s.resourceRates.filter(r => r.role !== role),
        }
        persist(next)
        return next
      })
    },

    // ── Role definitions ────────────────────────────────────────────────────
    addRoleDefinition(def) {
      const definition: RoleDefinition = { id: uid(), ...def }
      set(s => {
        const next: PortfolioState = {
          ...s,
          roleDefinitions: [...s.roleDefinitions, definition],
        }
        persist(next)
        return next
      })
      return definition
    },
    updateRoleDefinition(id, patch) {
      set(s => {
        const next: PortfolioState = {
          ...s,
          roleDefinitions: s.roleDefinitions.map(d =>
            d.id === id ? { ...d, ...patch } : d
          ),
        }
        persist(next)
        return next
      })
    },
    removeRoleDefinition(id) {
      set(s => {
        const next: PortfolioState = {
          ...s,
          roleDefinitions: s.roleDefinitions.filter(d => d.id !== id),
        }
        persist(next)
        return next
      })
    },

    setAdminMemberIds(ids) {
      set(s => {
        const next: PortfolioState = { ...s, adminMemberIds: ids }
        persist(next)
        return next
      })
    },
  }),
)
