/**
 * Unit tests for csv.ts — CSV export/import utilities for the SAT portfolio tool.
 *
 * Tests are organized into three sections:
 *   1. detectCsvEntityType — header sniffing returns the correct entity name.
 *   2. Roster round-trip   — exportRosterCsv → importRosterCsv preserves
 *                            domain/team/member data and keeps member IDs stable.
 *   3. Projects round-trip — exportProjectsCsv → importProjectsCsv preserves all
 *                            scalar project fields and resolves blockedBy names.
 *   4. Assignments         — exportAssignmentsCsv → importAssignmentsCsv resolves
 *                            member names back to IDs correctly.
 *
 * None of these tests touch the DOM — they only exercise pure string-in/object-out
 * logic, so the 'node' Vitest project is sufficient.
 */

import { describe, it, expect } from 'vitest'
import {
  detectCsvEntityType,
  exportRosterCsv,
  importRosterCsv,
  exportProjectsCsv,
  importProjectsCsv,
  exportAssignmentsCsv,
  importAssignmentsCsv,
} from './csv'
import type { Domain, Team, Member, Project, Initiative } from '@/types'

// ─── Fixture factories ───────────────────────────────────────────────────────

/** Minimal Domain fixture. */
function makeDomain(id: string, name: string): Domain {
  return { id, name, description: `${name} description`, owner: `${name} Owner` }
}

/** Minimal Team fixture linked to a domain. */
function makeTeam(id: string, domainId: string, name: string, memberIds: string[] = []): Team {
  return { id, domainId, name, description: `${name} desc`, techLead: '', memberIds }
}

/** Minimal Member fixture linked to one team. */
function makeMember(id: string, teamId: string, name: string, capacity = 100): Member {
  return {
    id,
    teamIds:        [teamId],
    name,
    role:           'Engineer',
    reportsTo:      undefined,
    capacity,
    avatarInitials: name.slice(0, 2).toUpperCase(),
    projectIds:     [],
  }
}

/** Minimal Project fixture. */
function makeProject(
  id: string,
  name: string,
  memberId: string,
  allocation: number,
  overrides: Partial<Project> = {},
): Project {
  return {
    id,
    name,
    description:     `${name} desc`,
    status:          'In Progress',
    phase:           'Development',
    priority:        'High',
    initiativeId:    '',
    startDate:       '2026-02-01',
    targetEndDate:   '2026-05-01',
    percentComplete: 25,
    stakeholders:    'Jane Doe',
    notes:           'Some notes',
    updatedAt:       '2026-03-01T12:00:00.000Z',
    blockedByIds:    [],
    assignments:     [{ memberId, allocation }],
    ...overrides,
  }
}

// ─── detectCsvEntityType ─────────────────────────────────────────────────────

describe('detectCsvEntityType', () => {
  it('detects roster CSV from memberName + teamDescription headers', () => {
    const csv = 'domain,domainDescription,domainOwner,team,teamDescription,memberId,memberName,role,reportsTo,capacity,avatarInitials\n'
    expect(detectCsvEntityType(csv)).toBe('roster')
  })

  it('detects roster CSV from memberName + domainOwner headers', () => {
    const csv = 'domain,domainOwner,team,memberId,memberName,role,capacity,avatarInitials\n'
    expect(detectCsvEntityType(csv)).toBe('roster')
  })

  it('detects projects CSV from targetEndDate header', () => {
    const csv = 'id,name,status,phase,priority,startDate,targetEndDate,percentComplete\n'
    expect(detectCsvEntityType(csv)).toBe('projects')
  })

  it('detects projects CSV from percentComplete header (no targetEndDate)', () => {
    const csv = 'id,name,status,phase,priority,startDate,percentComplete\n'
    expect(detectCsvEntityType(csv)).toBe('projects')
  })

  it('detects assignments CSV from project + member + allocation headers', () => {
    const csv = 'project,member,part,allocation,startDate,endDate\n'
    expect(detectCsvEntityType(csv)).toBe('assignments')
  })

  it('detects assignments CSV from legacy projectId + memberId headers', () => {
    const csv = 'projectId,memberId,part,allocation,startDate,endDate\n'
    expect(detectCsvEntityType(csv)).toBe('assignments')
  })

  it('detects initiatives CSV from targetQuarter + status headers', () => {
    const csv = 'id,name,description,targetQuarter,status\n'
    expect(detectCsvEntityType(csv)).toBe('initiatives')
  })

  it('detects intake CSV from requesterName header', () => {
    const csv = 'id,requesterName,teamOrDomain,description,estimatedEffort,priority,status,submittedAt\n'
    expect(detectCsvEntityType(csv)).toBe('intake')
  })

  it('detects intake CSV from businessJustification header', () => {
    const csv = 'id,description,businessJustification,status,submittedAt\n'
    expect(detectCsvEntityType(csv)).toBe('intake')
  })

  it('returns null for unknown headers', () => {
    const csv = 'foo,bar,baz\n'
    expect(detectCsvEntityType(csv)).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(detectCsvEntityType('')).toBeNull()
  })
})

// ─── Roster round-trip ───────────────────────────────────────────────────────

describe('exportRosterCsv / importRosterCsv round-trip', () => {
  // Build a simple two-domain, two-team, two-member fixture.
  const domainA = makeDomain('d1', 'Store Experience')
  const domainB = makeDomain('d2', 'Platform')
  const teamA   = makeTeam('t1', 'd1', 'POS Team', ['m1', 'm2'])
  const teamB   = makeTeam('t2', 'd2', 'Infra Team', ['m3'])
  const alice   = makeMember('m1', 't1', 'Alice', 80)
  const bob     = makeMember('m2', 't1', 'Bob', 100)
  const carol   = makeMember('m3', 't2', 'Carol', 90)

  const domains = [domainA, domainB]
  const teams   = [teamA, teamB]
  const members = [alice, bob, carol]

  it('produces a string with a header row and one row per member', () => {
    const csv = exportRosterCsv(domains, teams, members)
    const lines = csv.split('\n').filter(Boolean)
    // 1 header + 3 member rows.
    expect(lines).toHaveLength(4)
    expect(lines[0]).toContain('memberName')
  })

  it('round-trip preserves domain names and descriptions', () => {
    const csv = exportRosterCsv(domains, teams, members)
    // Pass current arrays so IDs are reused by name match.
    const result = importRosterCsv(csv, domains, teams)

    const names = result.domains.map(d => d.name).sort()
    expect(names).toEqual(['Platform', 'Store Experience'])

    const se = result.domains.find(d => d.name === 'Store Experience')!
    expect(se.description).toBe('Store Experience description')
    expect(se.owner).toBe('Store Experience Owner')
  })

  it('round-trip preserves team names', () => {
    const csv = exportRosterCsv(domains, teams, members)
    const result = importRosterCsv(csv, domains, teams)

    const teamNames = result.teams.map(t => t.name).sort()
    expect(teamNames).toEqual(['Infra Team', 'POS Team'])
  })

  it('round-trip preserves member names, roles, and capacity', () => {
    const csv = exportRosterCsv(domains, teams, members)
    const result = importRosterCsv(csv, domains, teams)

    expect(result.members).toHaveLength(3)
    const a = result.members.find(m => m.name === 'Alice')!
    expect(a).toBeDefined()
    expect(a.capacity).toBe(80)
    expect(a.role).toBe('Engineer')
  })

  it('round-trip reuses existing domain IDs so downstream references survive', () => {
    const csv = exportRosterCsv(domains, teams, members)
    const result = importRosterCsv(csv, domains, teams)

    // IDs must match the originals when names match.
    const d1 = result.domains.find(d => d.name === 'Store Experience')!
    expect(d1.id).toBe('d1')
  })

  it('round-trip reuses existing team IDs so downstream references survive', () => {
    const csv = exportRosterCsv(domains, teams, members)
    const result = importRosterCsv(csv, domains, teams)

    const t1 = result.teams.find(t => t.name === 'POS Team')!
    expect(t1.id).toBe('t1')
  })

  it('round-trip preserves member IDs', () => {
    const csv = exportRosterCsv(domains, teams, members)
    const result = importRosterCsv(csv, domains, teams)

    const m1 = result.members.find(m => m.name === 'Alice')!
    expect(m1.id).toBe('m1')
  })

  it('wires teamIds on members and memberIds on teams after import', () => {
    const csv = exportRosterCsv(domains, teams, members)
    const result = importRosterCsv(csv, domains, teams)

    const posTeam = result.teams.find(t => t.name === 'POS Team')!
    // Alice (m1) and Bob (m2) belong to POS Team.
    expect(posTeam.memberIds).toContain('m1')
    expect(posTeam.memberIds).toContain('m2')

    const alice2 = result.members.find(m => m.name === 'Alice')!
    expect(alice2.teamIds).toContain(posTeam.id)
  })

  it('handles a domain with no teams (domain-only row survives round-trip)', () => {
    const emptyDomain = makeDomain('d3', 'Empty Domain')
    const csv = exportRosterCsv([emptyDomain], [], [])
    const result = importRosterCsv(csv, [emptyDomain], [])

    expect(result.domains).toHaveLength(1)
    expect(result.domains[0].name).toBe('Empty Domain')
    expect(result.teams).toHaveLength(0)
    expect(result.members).toHaveLength(0)
  })
})

// ─── Projects round-trip ─────────────────────────────────────────────────────

describe('exportProjectsCsv / importProjectsCsv round-trip', () => {
  const initiative: Initiative = {
    id: 'i1', name: 'Modernize POS', description: '', targetQuarter: 'Q2 FY2026', status: 'Active',
  }

  const blocker = makeProject('p-blocker', 'Blocker Project', 'm1', 30)
  const main    = makeProject('p-main', 'Main Project', 'm1', 50, {
    initiativeId: 'i1',
    status:       'Blocked',
    blockedByIds: ['p-blocker'],
    percentComplete: 40,
    startDate:    '2026-03-01',
    targetEndDate: '2026-06-30',
    stakeholders: 'CEO',
    notes:        'On hold pending infra',
  })

  const allProjects  = [blocker, main]
  const initiatives  = [initiative]

  it('produces CSV that can be round-tripped without data loss for scalar fields', () => {
    const csv = exportProjectsCsv(allProjects, initiatives)
    // No assignments needed for the project CSV — pass an empty map.
    const imported = importProjectsCsv(csv, new Map(), initiatives, allProjects)

    const m = imported.find(p => p.name === 'Main Project')!
    expect(m).toBeDefined()
    expect(m.status).toBe('Blocked')
    expect(m.phase).toBe('Development')
    expect(m.priority).toBe('High')
    expect(m.percentComplete).toBe(40)
    expect(m.startDate).toBe('2026-03-01')
    expect(m.targetEndDate).toBe('2026-06-30')
    expect(m.stakeholders).toBe('CEO')
    expect(m.notes).toBe('On hold pending infra')
  })

  it('resolves initiative name back to initiative ID on import', () => {
    const csv = exportProjectsCsv(allProjects, initiatives)
    const imported = importProjectsCsv(csv, new Map(), initiatives, allProjects)

    const m = imported.find(p => p.name === 'Main Project')!
    // The CSV stores the initiative name "Modernize POS"; import must re-resolve it to 'i1'.
    expect(m.initiativeId).toBe('i1')
  })

  it('resolves blockedBy project names back to project IDs on import', () => {
    const csv = exportProjectsCsv(allProjects, initiatives)
    const imported = importProjectsCsv(csv, new Map(), initiatives, allProjects)

    const m = imported.find(p => p.name === 'Main Project')!
    // "Blocker Project" name must resolve back to 'p-blocker'.
    expect(m.blockedByIds).toEqual(['p-blocker'])
  })

  it('preserves project IDs through the round-trip', () => {
    const csv = exportProjectsCsv(allProjects, initiatives)
    const imported = importProjectsCsv(csv, new Map(), initiatives, allProjects)

    const ids = imported.map(p => p.id).sort()
    expect(ids).toEqual(['p-blocker', 'p-main'])
  })

  it('silently drops unresolvable blockedBy names', () => {
    // Export a project whose blockedByIds reference a project NOT in allProjects.
    const orphan = makeProject('p-orphan', 'Orphan', 'm1', 20, { blockedByIds: ['nonexistent-id'] })
    // allProjects doesn't contain the blocker, so the name can't be resolved.
    const csv = exportProjectsCsv([orphan], [])
    const imported = importProjectsCsv(csv, new Map(), [], [orphan])

    const o = imported.find(p => p.name === 'Orphan')!
    // The unresolvable name was dropped, so blockedByIds should be empty.
    expect(o.blockedByIds).toEqual([])
  })

  it('produces CSV with the correct header columns', () => {
    const csv = exportProjectsCsv(allProjects, initiatives)
    const header = csv.split('\n')[0]
    expect(header).toContain('targetEndDate')
    expect(header).toContain('percentComplete')
    expect(header).toContain('initiative')
    expect(header).toContain('blockedBy')
  })
})

// ─── Assignments round-trip ──────────────────────────────────────────────────

describe('exportAssignmentsCsv / importAssignmentsCsv', () => {
  const alice = makeMember('m1', 't1', 'Alice')
  const bob   = makeMember('m2', 't1', 'Bob')
  const members = [alice, bob]

  const project: Project = makeProject('p1', 'Alpha Project', 'm1', 60, {
    assignments: [
      { memberId: 'm1', allocation: 60, part: 'Backend', startDate: '2026-02-01', endDate: '2026-04-30' },
      { memberId: 'm2', allocation: 40, part: 'QA' },
    ],
  })

  it('exports one row per assignment with human-readable member names', () => {
    const csv = exportAssignmentsCsv([project], members)
    const lines = csv.split('\n').filter(Boolean)
    // Header + 2 assignment rows.
    expect(lines).toHaveLength(3)
    expect(csv).toContain('Alice')
    expect(csv).toContain('Bob')
  })

  it('imports and resolves member names back to member IDs', () => {
    const csv = exportAssignmentsCsv([project], members)
    const byProject = importAssignmentsCsv(csv, members)

    // The map is keyed by project name (new format).
    const assignments = byProject.get('Alpha Project')!
    expect(assignments).toBeDefined()
    expect(assignments).toHaveLength(2)

    const aliceAssignment = assignments.find(a => a.memberId === 'm1')!
    expect(aliceAssignment).toBeDefined()
    expect(aliceAssignment.allocation).toBe(60)
    expect(aliceAssignment.part).toBe('Backend')
    expect(aliceAssignment.startDate).toBe('2026-02-01')
    expect(aliceAssignment.endDate).toBe('2026-04-30')
  })

  it('resolves Bob\'s assignment allocation and part correctly', () => {
    const csv = exportAssignmentsCsv([project], members)
    const byProject = importAssignmentsCsv(csv, members)

    const assignments = byProject.get('Alpha Project')!
    const bobAssignment = assignments.find(a => a.memberId === 'm2')!
    expect(bobAssignment).toBeDefined()
    expect(bobAssignment.allocation).toBe(40)
    expect(bobAssignment.part).toBe('QA')
  })

  it('returns an empty map for a project with no assignments', () => {
    const emptyProject = makeProject('p2', 'Empty', 'm1', 0, { assignments: [] })
    const csv = exportAssignmentsCsv([emptyProject], members)
    const byProject = importAssignmentsCsv(csv, members)
    // No rows means no keys in the map.
    expect(byProject.size).toBe(0)
  })

  it('falls back to the raw value when a member name cannot be resolved', () => {
    // Craft a CSV with a member name that doesn't match any member in the list.
    const csv = 'project,member,part,allocation,startDate,endDate\nAlpha Project,UnknownPerson,Frontend,20,,\n'
    const byProject = importAssignmentsCsv(csv, members)

    const assignments = byProject.get('Alpha Project')!
    // The unresolvable name is kept as-is (the raw string) since it may be a raw ID.
    expect(assignments[0].memberId).toBe('UnknownPerson')
  })
})
