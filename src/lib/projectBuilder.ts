/**
 * Project builder helpers — used by ProjectDetailPage to translate between
 * the multi-phase plan UI and the flat root-level Project fields that all
 * other views (Gantt, Dashboard, Analytics, CSV) rely on.
 *
 * The key contract: when a project has `phases`, the root-level fields
 * (startDate, targetEndDate, phase, percentComplete, assignments) are
 * always derived from the phases array before saving. This keeps the rest
 * of the app unaware of the multi-phase model.
 */

import type { Project, ProjectPhaseStep, ProjectMemberAssignment, ProjectPhase, PhaseStatus } from '@/types'

// ─── Derive root-level project fields from phases ─────────────────────────

/**
 * Compute the flat project fields that all non-builder views rely on.
 * Called on every save from ProjectDetailPage so the root fields stay in sync.
 *
 * - startDate       = earliest phase startDate
 * - targetEndDate   = latest phase endDate
 * - phase           = first In Progress phase → first Not Started → Deployed
 * - percentComplete = simple average across all phases
 * - assignments     = union of phase assignments, date-merged per member
 */
export function deriveProjectFields(phases: ProjectPhaseStep[]): {
  startDate: string
  targetEndDate: string
  phase: ProjectPhase
  percentComplete: number
  assignments: ProjectMemberAssignment[]
} {
  // Collect all non-empty dates to find the project span.
  const starts = phases.map(p => p.startDate).filter(Boolean).sort()
  const ends   = phases.map(p => p.endDate).filter(Boolean).sort()

  const startDate     = starts[0]      ?? ''
  const targetEndDate = ends[ends.length - 1] ?? ''

  // Current phase: first In Progress → first Not Started → Deployed (all done).
  const inProgress  = phases.find(p => p.status === 'In Progress')
  const notStarted  = phases.find(p => p.status === 'Not Started')
  const phase: ProjectPhase =
    inProgress?.phase ?? notStarted?.phase ?? 'Deployed'

  // Simple average of all phase completion percentages.
  const percentComplete = phases.length > 0
    ? Math.round(phases.reduce((sum, p) => sum + p.percentComplete, 0) / phases.length)
    : 0

  // Merge assignments across phases: one entry per unique member, using the
  // earliest startDate and latest endDate across all phases they appear in.
  const assignments = mergeAssignments(phases)

  return { startDate, targetEndDate, phase, percentComplete, assignments }
}

/**
 * Union all phase assignments into a single flat array, one entry per member.
 * For members who appear in multiple phases, the merged entry spans from their
 * earliest phase start to their latest phase end — so the Gantt chart shows
 * them on the project for the full relevant window.
 *
 * The `part` from the first phase the member appears in is used.
 * The `allocation` is the max allocation across all phases.
 */
export function mergeAssignments(phases: ProjectPhaseStep[]): ProjectMemberAssignment[] {
  const byMember = new Map<string, ProjectMemberAssignment>()

  for (const phase of phases) {
    for (const a of phase.assignments) {
      const existing = byMember.get(a.memberId)
      if (!existing) {
        // First time seeing this member — use the phase dates if the assignment
        // doesn't have its own date overrides.
        byMember.set(a.memberId, {
          ...a,
          startDate: a.startDate || phase.startDate || undefined,
          endDate:   a.endDate   || phase.endDate   || undefined,
        })
      } else {
        // Already seen — extend the date range and take max allocation.
        const mergedStart = earliestDate(existing.startDate, a.startDate || phase.startDate)
        const mergedEnd   = latestDate(existing.endDate, a.endDate || phase.endDate)
        byMember.set(a.memberId, {
          ...existing,
          startDate:  mergedStart || undefined,
          endDate:    mergedEnd   || undefined,
          allocation: Math.max(existing.allocation, a.allocation),
        })
      }
    }
  }

  return Array.from(byMember.values())
}

// ─── Convert a legacy (single-phase) project into a phases array ──────────

/**
 * When a project without `phases` is opened in the builder, synthesize a
 * single-phase plan from the project's existing root-level fields. This lets
 * the builder work seamlessly with all historical data.
 */
export function legacyToPhases(project: Project): ProjectPhaseStep[] {
  // Map the project-level status to the closest PhaseStatus equivalent.
  const phaseStatus: PhaseStatus =
    project.status === 'Complete'   ? 'Complete'    :
    project.status === 'In Progress' ? 'In Progress' :
    'Not Started'

  return [{
    id:             crypto.randomUUID(),
    phase:          project.phase,
    startDate:      project.startDate      ?? '',
    endDate:        project.targetEndDate  ?? '',
    assignments:    project.assignments    ?? [],
    status:         phaseStatus,
    percentComplete: project.percentComplete ?? 0,
    notes:          project.notes          ?? '',
  }]
}

// ─── Date helpers ──────────────────────────────────────────────────────────

/** Returns the earlier of two ISO date strings, ignoring empty/undefined. */
function earliestDate(a?: string, b?: string): string {
  if (!a) return b ?? ''
  if (!b) return a
  return a < b ? a : b
}

/** Returns the later of two ISO date strings, ignoring empty/undefined. */
function latestDate(a?: string, b?: string): string {
  if (!a) return b ?? ''
  if (!b) return a
  return a > b ? a : b
}
