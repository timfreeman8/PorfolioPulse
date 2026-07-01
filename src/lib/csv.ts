/**
 * CSV export and import utilities for the SAT portfolio tool.
 *
 * Enables a full round-trip: export entity data as CSV, edit in any
 * spreadsheet application, and reimport to replace the store state.
 *
 * Entity CSVs use "id" as the primary key. Multi-value fields (e.g.
 * `memberIds`, `teamIds`) are stored as semicolon-delimited values within a
 * single quoted CSV column, e.g. `"id1;id2;id3"`.
 *
 * Assignments (the project ↔ member join with per-member allocation details)
 * are exported as a separate flat table — `assignments.csv` — because they
 * have several fields of their own that would be awkward to embed in projects.csv.
 *
 * A full JSON snapshot is also supported for lossless backup/restore. The JSON
 * format preserves every field exactly, whereas the CSV format is designed for
 * human readability and easy editing.
 *
 * Import strategy: the caller receives typed arrays back from each parse
 * function and is responsible for merging them into the store. The Settings
 * page calls `hydrate()` to atomically replace the entire store state.
 */

import type {
  Domain,
  Team,
  Member,
  Project,
  ProjectMemberAssignment,
  Initiative,
  IntakeRequest,
  PortfolioState,
} from '@/types'

// ─── Generic CSV primitives ────────────────────────────────────────────────

/**
 * Escape a single cell value for CSV output.
 * Wraps in double-quotes if the value contains commas, quotes, or newlines.
 * Internal double-quotes are escaped by doubling: " → ""
 */
function escapeCell(value: unknown): string {
  const s = value == null ? '' : String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/**
 * Serialize an array of objects to a CSV string.
 * `headers` defines both the column order and the object keys to extract.
 * Extra keys on the objects are silently ignored.
 */
export function objectsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines: string[] = [headers.map(escapeCell).join(',')]
  for (const row of rows) {
    lines.push(headers.map(h => escapeCell(row[h])).join(','))
  }
  return lines.join('\n')
}

/**
 * Parse a CSV string back to an array of plain objects keyed by the header row.
 * Handles RFC-4180 quoting: fields wrapped in double-quotes may contain commas
 * and internal double-quotes (escaped as "").
 *
 * Empty lines at the end are ignored. Returns [] for empty input.
 */
export function csvToObjects(csv: string): Record<string, string>[] {
  // Tokenize: split on newlines but respect quoted fields that span lines.
  const rows = tokenizeCSV(csv)
  if (rows.length < 2) return []

  const headers = rows[0]
  return rows.slice(1).filter(r => r.some(c => c !== '')).map(cells => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = cells[i] ?? '' })
    return obj
  })
}

/**
 * Tokenize a CSV string into a 2-D array of strings [row][col].
 * Handles multi-line quoted fields correctly.
 */
function tokenizeCSV(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let i = 0

  while (i < csv.length) {
    const ch = csv[i]
    if (inQuotes) {
      if (ch === '"') {
        // Peek ahead: "" is an escaped quote; a lone " ends the quoted section.
        if (csv[i + 1] === '"') {
          cell += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        cell += ch
        i++
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
      } else if (ch === ',') {
        row.push(cell)
        cell = ''
        i++
      } else if (ch === '\r' && csv[i + 1] === '\n') {
        row.push(cell)
        rows.push(row)
        row = []
        cell = ''
        i += 2
      } else if (ch === '\n' || ch === '\r') {
        row.push(cell)
        rows.push(row)
        row = []
        cell = ''
        i++
      } else {
        cell += ch
        i++
      }
    }
  }

  // Push the last cell/row even if file doesn't end with a newline.
  row.push(cell)
  if (row.some(c => c !== '')) rows.push(row)

  return rows
}

/**
 * Trigger a browser file download with the given text content.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Trigger a browser download for a JSON string.
 */
export function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Roster CSV (master) ──────────────────────────────────────────────────
// A single denormalized table that replaces separate domains/teams/members CSVs.
// One row per (domain → team → member) leaf node. Teams with no members emit
// one row with blank member fields; domains with no teams emit one row with
// blank team and member fields.
//
// On import, all three entity slices are reconstructed atomically:
//   • Domains — distinct domain names, reusing existing IDs where the name matches
//   • Teams   — distinct (domain, team) pairs, reusing existing IDs by name
//   • Members — distinct memberId rows, collapsing multi-team members across rows
//
// memberId is kept as a UUID so project assignment references survive round-trips.

const ROSTER_HEADERS = [
  'domain', 'domainDescription', 'domainOwner',
  'team', 'teamDescription',
  'memberId', 'memberName', 'role', 'reportsTo', 'capacity', 'avatarInitials',
] as const

/**
 * Export all domains, teams, and members as a single flat roster table.
 * Iterates: domain → teams in that domain → members in each team.
 */
export function exportRosterCsv(
  domains: Domain[],
  teams: Team[],
  members: Member[],
): string {
  const memberById = new Map(members.map(m => [m.id, m]))

  const rows: Record<string, unknown>[] = []

  for (const domain of domains) {
    const domainTeams = teams.filter(t => t.domainId === domain.id)

    if (domainTeams.length === 0) {
      // Domain exists but has no teams yet — still emit a row so it round-trips.
      rows.push({
        domain: domain.name, domainDescription: domain.description, domainOwner: domain.owner,
        team: '', teamDescription: '',
        memberId: '', memberName: '', role: '', reportsTo: '', capacity: '', avatarInitials: '',
      })
      continue
    }

    for (const team of domainTeams) {
      const teamMembers = (team.memberIds ?? [])
        .map(id => memberById.get(id))
        .filter(Boolean) as Member[]

      if (teamMembers.length === 0) {
        // Team with no members — emit a row so the team survives the round-trip.
        rows.push({
          domain: domain.name, domainDescription: domain.description, domainOwner: domain.owner,
          team: team.name, teamDescription: team.description,
          memberId: '', memberName: '', role: '', reportsTo: '', capacity: '', avatarInitials: '',
        })
        continue
      }

      for (const member of teamMembers) {
        rows.push({
          domain:            domain.name,
          domainDescription: domain.description,
          domainOwner:       domain.owner,
          team:              team.name,
          teamDescription:   team.description,
          memberId:          member.id,
          memberName:        member.name,
          role:              member.role,
          reportsTo:         member.reportsTo ?? '',
          capacity:          member.capacity,
          avatarInitials:    member.avatarInitials,
        })
      }
    }
  }

  return objectsToCsv([...ROSTER_HEADERS], rows)
}

/**
 * Parse roster.csv back into the three entity slices.
 * Accepts the current store arrays so existing domain/team IDs can be reused
 * by name — this keeps project assignment references stable across imports.
 */
export function importRosterCsv(
  csv: string,
  currentDomains: Domain[] = [],
  currentTeams: Team[] = [],
): { domains: Domain[]; teams: Team[]; members: Member[] } {
  const rows = csvToObjects(csv)

  // Reuse existing IDs where a name match is found, so downstream references
  // (e.g. member.teamIds, team.domainId) remain stable after round-trips.
  const existingDomainIdByName = new Map(currentDomains.map(d => [d.name.toLowerCase(), d.id]))
  const existingTeamIdByName   = new Map(currentTeams.map(t => [t.name.toLowerCase(), t.id]))

  // ── Build domains ──────────────────────────────────────────────────────
  const domainsByName = new Map<string, Domain>()
  for (const r of rows) {
    if (!r.domain || domainsByName.has(r.domain)) continue
    domainsByName.set(r.domain, {
      id:          existingDomainIdByName.get(r.domain.toLowerCase()) ?? crypto.randomUUID(),
      name:        r.domain,
      description: r.domainDescription || '',
      owner:       r.domainOwner       || '',
    })
  }

  // ── Build teams ────────────────────────────────────────────────────────
  // Key is "domainName|teamName" to handle same-named teams in different domains.
  const teamsByKey = new Map<string, Team>()
  for (const r of rows) {
    if (!r.team) continue
    const key = `${r.domain}|${r.team}`
    if (teamsByKey.has(key)) continue
    teamsByKey.set(key, {
      id:          existingTeamIdByName.get(r.team.toLowerCase()) ?? crypto.randomUUID(),
      domainId:    domainsByName.get(r.domain)?.id ?? '',
      name:        r.team,
      description: r.teamDescription || '',
      techLead:    '',   // not stored in roster CSV
      memberIds:   [],   // populated below when members are wired in
    })
  }

  // ── Build members ──────────────────────────────────────────────────────
  // memberId is preserved from the CSV so project assignment references survive.
  // Members appearing in multiple teams have one row per team; we collapse them.
  const memberState = new Map<string, { member: Member; teamKeys: string[] }>()

  for (const r of rows) {
    if (!r.memberId || !r.memberName) continue
    const teamKey = r.team ? `${r.domain}|${r.team}` : ''

    if (memberState.has(r.memberId)) {
      // Merge additional team membership for multi-team members.
      const s = memberState.get(r.memberId)!
      if (teamKey && !s.teamKeys.includes(teamKey)) s.teamKeys.push(teamKey)
    } else {
      memberState.set(r.memberId, {
        member: {
          id:             r.memberId,
          name:           r.memberName,
          role:           r.role           || '',
          reportsTo:      r.reportsTo      || undefined,
          capacity:       Number(r.capacity) || 100,
          avatarInitials: r.avatarInitials || r.memberName.slice(0, 2).toUpperCase(),
          teamIds:        [],   // populated below
          projectIds:     [],   // rebuilt from assignments on project import
        },
        teamKeys: teamKey ? [teamKey] : [],
      })
    }
  }

  // ── Wire teamIds ↔ memberIds ───────────────────────────────────────────
  for (const [, { member, teamKeys }] of memberState) {
    for (const teamKey of teamKeys) {
      const team = teamsByKey.get(teamKey)
      if (!team) continue
      if (!member.teamIds.includes(team.id))  member.teamIds.push(team.id)
      if (!team.memberIds.includes(member.id)) team.memberIds.push(member.id)
    }
  }

  return {
    domains: [...domainsByName.values()],
    teams:   [...teamsByKey.values()],
    members: [...memberState.values()].map(s => s.member),
  }
}

// ─── Domain CSV (legacy — kept for backward-compatible import of old files) ──

const DOMAIN_HEADERS = ['id', 'name', 'description', 'owner'] as const

export function exportDomainsCsv(domains: Domain[]): string {
  return objectsToCsv([...DOMAIN_HEADERS], domains as unknown as Record<string, unknown>[])
}

export function importDomainsCsv(csv: string): Domain[] {
  return csvToObjects(csv).map(r => ({
    id:          r.id          || crypto.randomUUID(),
    name:        r.name        || '',
    description: r.description || '',
    owner:       r.owner       || '',
  }))
}

// ─── Team CSV ─────────────────────────────────────────────────────────────
// Exports the domain name rather than the raw domainId so the CSV is
// human-readable and editable without needing a lookup table.
// Import resolves the domain name back to a domainId using the domains array.

const TEAM_HEADERS = ['id', 'domain', 'name', 'description', 'memberIds'] as const

export function exportTeamsCsv(teams: Team[], domains: Domain[]): string {
  const domainById = new Map(domains.map(d => [d.id, d.name]))
  const rows = teams.map(t => ({
    id:          t.id,
    domain:      domainById.get(t.domainId) ?? t.domainId,  // fall back to id if name not found
    name:        t.name,
    description: t.description,
    memberIds:   t.memberIds.join(';'),
  }))
  return objectsToCsv([...TEAM_HEADERS], rows as Record<string, unknown>[])
}

export function importTeamsCsv(csv: string, domains: Domain[] = []): Team[] {
  const domainByName = new Map(domains.map(d => [d.name.toLowerCase(), d.id]))
  return csvToObjects(csv).map(r => {
    // Resolve domain name → id; fall back to treating the value as a raw id
    // so files exported before this change (with domainId column) still import.
    const rawDomain = r.domain || r.domainId || ''
    const domainId  = domainByName.get(rawDomain.toLowerCase()) ?? rawDomain
    return {
      id:          r.id          || crypto.randomUUID(),
      domainId,
      name:        r.name        || '',
      description: r.description || '',
      techLead:    '',
      memberIds:   r.memberIds ? r.memberIds.split(';').filter(Boolean) : [],
    }
  })
}

// ─── Member CSV ───────────────────────────────────────────────────────────
// Export uses human-readable domain and team names instead of raw IDs so the
// CSV is legible and editable in a spreadsheet without needing a lookup table.
// Import resolves names back to IDs using the current domains/teams arrays.

const MEMBER_HEADERS = [
  'id', 'domain', 'team', 'name', 'role', 'reportsTo', 'capacity', 'avatarInitials',
] as const

/**
 * Export members with domain and team names resolved from the current store.
 * Each member appears once per team they belong to (usually just one).
 * When a member is in multiple teams, extra rows share the same member id.
 */
export function exportMembersCsv(
  members: Member[],
  teams: Team[],
  domains: Domain[],
): string {
  const teamById   = new Map(teams.map(t => [t.id, t]))
  const domainById = new Map(domains.map(d => [d.id, d]))

  const rows: Record<string, unknown>[] = []
  for (const m of members) {
    // If a member belongs to zero teams, still emit one row with blank team/domain.
    const memberTeams = (m.teamIds ?? []).map(tid => teamById.get(tid)).filter(Boolean) as Team[]
    if (memberTeams.length === 0) {
      rows.push({ id: m.id, domain: '', team: '', name: m.name, role: m.role, reportsTo: m.reportsTo ?? '', capacity: m.capacity, avatarInitials: m.avatarInitials })
    } else {
      for (const team of memberTeams) {
        const domain = domainById.get(team.domainId)
        rows.push({
          id:             m.id,
          domain:         domain?.name ?? '',
          team:           team.name,
          name:           m.name,
          role:           m.role,
          reportsTo:      m.reportsTo ?? '',
          capacity:       m.capacity,
          avatarInitials: m.avatarInitials,
        })
      }
    }
  }
  return objectsToCsv([...MEMBER_HEADERS], rows)
}

/**
 * Import members.csv, resolving team names back to IDs.
 * Rows with the same member `id` are collapsed into one member record with
 * all matched teamIds merged (supports the multi-team-per-row format).
 */
export function importMembersCsv(csv: string, teams: Team[] = [], domains: Domain[] = []): Member[] {
  // Build lookup: "Domain Name / Team Name" → teamId
  const teamLookup = new Map<string, string>()  // key = "domainName|teamName", value = teamId
  for (const t of teams) {
    const domainName = domains.find(d => d.id === t.domainId)?.name.toLowerCase() ?? ''
    teamLookup.set(`${domainName}|${t.name.toLowerCase()}`, t.id)
    // Also allow lookup by team name alone for CSVs with no domain column.
    if (!teamLookup.has(t.name.toLowerCase())) {
      teamLookup.set(t.name.toLowerCase(), t.id)
    }
  }

  // Collapse multi-row members (same id) into one record with merged teamIds.
  const byId = new Map<string, Member>()
  for (const r of csvToObjects(csv)) {
    const id = r.id || crypto.randomUUID()

    // Resolve the team name → teamId
    const teamKey = r.domain
      ? `${r.domain.toLowerCase()}|${(r.team ?? '').toLowerCase()}`
      : (r.team ?? '').toLowerCase()
    const resolvedTeamId = teamLookup.get(teamKey) ?? ''

    if (byId.has(id)) {
      // Merge teamId into existing record without duplicates.
      const existing = byId.get(id)!
      if (resolvedTeamId && !existing.teamIds.includes(resolvedTeamId)) {
        existing.teamIds.push(resolvedTeamId)
      }
    } else {
      byId.set(id, {
        id,
        teamIds:        resolvedTeamId ? [resolvedTeamId] : [],
        name:           r.name           || '',
        role:           r.role           || '',
        reportsTo:      r.reportsTo      || undefined,
        capacity:       Number(r.capacity) || 100,
        avatarInitials: r.avatarInitials || (r.name?.slice(0, 2).toUpperCase() ?? '??'),
        projectIds:     [],   // rebuilt from assignments on import
      })
    }
  }
  return [...byId.values()]
}

// ─── Project CSV ──────────────────────────────────────────────────────────
// Assignments are NOT included here — they live in a separate assignments.csv.
// Initiative name is exported instead of the raw initiativeId for readability.

// `blockedBy` stores the blocking project names as a semicolon-delimited string
// (matching the multi-value convention used for memberIds/teamIds elsewhere).
// Import resolves names back to project IDs using the full projects array.
const PROJECT_HEADERS = [
  'id', 'name', 'description', 'status', 'phase', 'priority',
  'startDate', 'targetEndDate', 'percentComplete',
  'stakeholders', 'notes', 'initiative', 'blockedBy', 'updatedAt',
  'estimatedValue', 'valueType', 'actualValue',
] as const

export function exportProjectsCsv(projects: Project[], initiatives: Initiative[] = []): string {
  const initiativeById = new Map(initiatives.map(i => [i.id, i.name]))
  // Build a name lookup for resolving blockedByIds → names for the CSV column.
  const projectNameById = new Map(projects.map(p => [p.id, p.name]))
  const rows = projects.map(p => ({
    id:              p.id,
    name:            p.name,
    description:     p.description,
    status:          p.status,
    phase:           p.phase,
    priority:        p.priority,
    startDate:       p.startDate,
    targetEndDate:   p.targetEndDate,
    percentComplete: p.percentComplete,
    stakeholders:    p.stakeholders,
    notes:           p.notes,
    initiative:      initiativeById.get(p.initiativeId) ?? '',    // name instead of id
    // Serialize blockedByIds as semicolon-separated project names for readability.
    blockedBy:       (p.blockedByIds ?? [])
                       .map(id => projectNameById.get(id) ?? '')
                       .filter(Boolean)
                       .join(';'),
    updatedAt:       p.updatedAt,
    estimatedValue:  p.estimatedValue ?? '',
    valueType:       p.valueType      ?? '',
    actualValue:     p.actualValue    ?? '',
  }))
  return objectsToCsv([...PROJECT_HEADERS], rows as Record<string, unknown>[])
}

export function importProjectsCsv(
  csv: string,
  assignmentsByProjectId: Map<string, ProjectMemberAssignment[]>,
  initiatives: Initiative[] = [],
  allProjects: Project[] = [],
): Project[] {
  const initiativeByName = new Map(initiatives.map(i => [i.name.toLowerCase(), i.id]))
  // Build a case-insensitive name → id lookup so blockedBy names can be resolved.
  const projectIdByName  = new Map(allProjects.map(p => [p.name.toLowerCase(), p.id]))

  return csvToObjects(csv).map(r => {
    // Resolve initiative name → id; fall back to treating the value as a raw id
    // so files with the old initiativeId column still import correctly.
    const rawInitiative = r.initiative || r.initiativeId || ''
    const initiativeId  = initiativeByName.get(rawInitiative.toLowerCase()) ?? rawInitiative

    // Resolve semicolon-separated blocking project names → IDs.
    // Unrecognised names are silently dropped so stale CSV data doesn't corrupt
    // the store with dangling references.
    const blockedByIds = (r.blockedBy || '')
      .split(';')
      .map((name: string) => name.trim())
      .filter(Boolean)
      .map((name: string) => projectIdByName.get(name.toLowerCase()) ?? '')
      .filter(Boolean)

    return {
      id:              r.id              || crypto.randomUUID(),
      name:            r.name            || '',
      description:     r.description     || '',
      status:          (r.status         || 'Backlog')     as Project['status'],
      phase:           (r.phase          || 'Research')    as Project['phase'],
      priority:        (r.priority       || 'Medium')      as Project['priority'],
      startDate:       r.startDate       || '',
      targetEndDate:   r.targetEndDate   || '',
      percentComplete: Number(r.percentComplete) || 0,
      stakeholders:    r.stakeholders    || '',
      notes:           r.notes           || '',
      initiativeId,
      blockedByIds,
      updatedAt:       r.updatedAt       || new Date().toISOString(),
      // Check by id first (old format) then by name (new format) for backward compat.
      assignments:     assignmentsByProjectId.get(r.id) ?? assignmentsByProjectId.get(r.name) ?? [],
      // Value fields — blank in CSV means undefined (field not set).
      estimatedValue:  r.estimatedValue ? Number(r.estimatedValue) : undefined,
      valueType:       (r.valueType || undefined) as Project['valueType'],
      actualValue:     r.actualValue ? Number(r.actualValue) : undefined,
    }
  })
}

// ─── Assignment CSV ───────────────────────────────────────────────────────
// Flat join table: one row per (project, member) pair.
// Exports human-readable project and member names instead of raw IDs.
// Import resolves names back to IDs using the current members array; the
// returned map is keyed by project name (new format) or project id (old format)
// for backward-compatibility with files exported before this change.

const ASSIGNMENT_HEADERS = [
  'project', 'member', 'part', 'allocation', 'startDate', 'endDate',
] as const

/**
 * Export assignments with project and member names resolved from the store.
 * Accepts the full members array so member names can be looked up by id.
 */
export function exportAssignmentsCsv(projects: Project[], members: Member[] = []): string {
  const memberById = new Map(members.map(m => [m.id, m.name]))
  const rows: Record<string, unknown>[] = []
  for (const project of projects) {
    for (const a of project.assignments) {
      rows.push({
        project:    project.name,
        member:     memberById.get(a.memberId) ?? a.memberId,  // fall back to id if not found
        part:       a.part       ?? '',
        allocation: a.allocation ?? 0,
        startDate:  a.startDate  ?? '',
        endDate:    a.endDate    ?? '',
      })
    }
  }
  return objectsToCsv([...ASSIGNMENT_HEADERS], rows)
}

/**
 * Parse assignments.csv and group them by project name (new format) or project
 * id (old format, for backward compatibility). The returned map key is whatever
 * is in the `project` or `projectId` column, so callers must look up using the
 * same value — `importProjectsCsv` checks both `r.id` and `r.name`.
 *
 * Accepts the current members array so member names can be resolved back to IDs.
 */
export function importAssignmentsCsv(csv: string, members: Member[] = []): Map<string, ProjectMemberAssignment[]> {
  // Build case-insensitive member name → id lookup.
  const memberByName = new Map(members.map(m => [m.name.toLowerCase(), m.id]))

  const byProject = new Map<string, ProjectMemberAssignment[]>()
  for (const r of csvToObjects(csv)) {
    // Support both new ('project'/'member') and old ('projectId'/'memberId') columns.
    const projectKey = r.project || r.projectId || ''
    const rawMember  = r.member  || r.memberId  || ''

    // Resolve member name → id; fall back to treating the value as a raw id.
    const memberId = memberByName.get(rawMember.toLowerCase()) ?? rawMember

    const assignment: ProjectMemberAssignment = {
      memberId,
      part:       r.part       || undefined,
      allocation: Number(r.allocation) || 0,
      startDate:  r.startDate  || undefined,
      endDate:    r.endDate    || undefined,
    }
    if (!memberId || !projectKey) continue
    const existing = byProject.get(projectKey) ?? []
    existing.push(assignment)
    byProject.set(projectKey, existing)
  }
  return byProject
}

// ─── Initiative CSV ───────────────────────────────────────────────────────

const INITIATIVE_HEADERS = ['id', 'name', 'description', 'targetQuarter', 'status'] as const

export function exportInitiativesCsv(initiatives: Initiative[]): string {
  return objectsToCsv([...INITIATIVE_HEADERS], initiatives as unknown as Record<string, unknown>[])
}

export function importInitiativesCsv(csv: string): Initiative[] {
  return csvToObjects(csv).map(r => ({
    id:            r.id            || crypto.randomUUID(),
    name:          r.name          || '',
    description:   r.description   || '',
    targetQuarter: r.targetQuarter || '',
    status:        (r.status       || 'Planning') as Initiative['status'],
  }))
}

// ─── Intake request CSV ────────────────────────────────────────────────────

const INTAKE_HEADERS = [
  'id', 'requesterName', 'teamOrDomain', 'description', 'capabilityType',
  'hasFunding', 'businessJustification', 'measurementPlan', 'estimatedEffort',
  'priority', 'businessOwner', 'networkImpact', 'requestedByDate', 'status', 'submittedAt',
] as const

export function exportIntakeCsv(requests: IntakeRequest[]): string {
  return objectsToCsv([...INTAKE_HEADERS], requests as unknown as Record<string, unknown>[])
}

export function importIntakeCsv(csv: string): IntakeRequest[] {
  return csvToObjects(csv).map(r => ({
    id:                    r.id                    || crypto.randomUUID(),
    requesterName:         r.requesterName         || '',
    teamOrDomain:          r.teamOrDomain          || '',
    description:           r.description           || '',
    capabilityType:        (r.capabilityType       || undefined) as IntakeRequest['capabilityType'],
    hasFunding:            (r.hasFunding           || undefined) as IntakeRequest['hasFunding'],
    businessJustification: r.businessJustification || '',
    measurementPlan:       r.measurementPlan       || undefined,
    estimatedEffort:       (r.estimatedEffort      || 'M') as IntakeRequest['estimatedEffort'],
    priority:              (r.priority             || 'Medium') as IntakeRequest['priority'],
    businessOwner:         r.businessOwner         || undefined,
    networkImpact:         r.networkImpact         || undefined,
    requestedByDate:       r.requestedByDate       || '',
    status:                (r.status               || 'Pending Review') as IntakeRequest['status'],
    submittedAt:           r.submittedAt           || new Date().toISOString(),
  }))
}

// ─── Entity type auto-detection ────────────────────────────────────────────

/**
 * Sniff the entity type from a CSV's header row. Returns the entity name or
 * null if the headers don't match any known schema.
 *
 * Detection is done by checking for a set of columns that are unique to each
 * entity — not all columns need to be present for a match.
 */
export type CsvEntityType =
  | 'roster'        // master: domains + teams + members in one file (new)
  | 'domains'       // legacy individual file
  | 'teams'         // legacy individual file
  | 'members'       // legacy individual file
  | 'projects'
  | 'assignments'
  | 'initiatives'
  | 'intake'

export function detectCsvEntityType(csv: string): CsvEntityType | null {
  const rows = tokenizeCSV(csv)
  if (rows.length === 0) return null
  const headers = new Set(rows[0])

  // Roster must be checked first — its headers overlap with teams and members.
  // The `memberName` column is unique to the roster format.
  if (headers.has('memberName') && (headers.has('teamDescription') || headers.has('domainOwner'))) return 'roster'
  // Support both new ('project'/'member') and old ('projectId'/'memberId') column names.
  if ((headers.has('project') || headers.has('projectId')) && (headers.has('member') || headers.has('memberId')) && headers.has('allocation')) return 'assignments'
  if (headers.has('targetEndDate') || headers.has('percentComplete')) return 'projects'
  if (headers.has('targetQuarter') && headers.has('status')) return 'initiatives'
  if ((headers.has('domainId') || headers.has('domain')) && headers.has('memberIds')) return 'teams'
  if (headers.has('teamIds') || headers.has('capacity') || headers.has('avatarInitials') || (headers.has('team') && headers.has('domain') && headers.has('role'))) return 'members'
  if (headers.has('owner') && headers.has('id') && !headers.has('status')) return 'domains'
  if (headers.has('requesterName') || headers.has('businessJustification')) return 'intake'
  return null
}

// ─── Full JSON snapshot ────────────────────────────────────────────────────

/**
 * Serialize the full portfolio state to a formatted JSON string.
 * This is the lossless backup format — no field is omitted.
 */
export function exportFullSnapshot(state: PortfolioState): string {
  return JSON.stringify(state, null, 2)
}

/**
 * Parse a JSON snapshot back to PortfolioState.
 * Throws if the JSON is invalid or missing required top-level keys.
 */
export function importFullSnapshot(json: string): PortfolioState {
  const parsed = JSON.parse(json)
  const required: (keyof PortfolioState)[] = [
    'domains', 'teams', 'members', 'projects', 'initiatives', 'intakeRequests',
  ]
  for (const key of required) {
    if (!Array.isArray(parsed[key])) {
      throw new Error(`Invalid snapshot: missing or non-array field "${key}"`)
    }
  }
  return {
    domains:        parsed.domains        ?? [],
    teams:          parsed.teams          ?? [],
    members:        parsed.members        ?? [],
    projects:       parsed.projects       ?? [],
    initiatives:    parsed.initiatives    ?? [],
    intakeRequests: parsed.intakeRequests ?? [],
    escalations:    parsed.escalations    ?? [],
    ptoBlocks:      parsed.ptoBlocks      ?? [],
    resourceRates:  parsed.resourceRates  ?? [],
    weeklyPulses:   parsed.weeklyPulses   ?? [],
    adminMemberIds: parsed.adminMemberIds ?? [],
  }
}
