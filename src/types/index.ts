/**
 * Core data model for the SAT portfolio tool.
 *
 * Data hierarchy:
 *   Portfolio → Domains → Teams → Members → Projects
 *
 * A Domain is a business area (e.g. "Point of Sale"). Each Domain contains
 * Teams, each Team has Members, and Members are assigned to Projects via the
 * ProjectMemberAssignment join type (which also stores allocation % and dates).
 *
 * Projects roll up to Initiatives (strategic themes). IntakeRequests are
 * inbound work requests that can be converted into Projects once approved.
 * PtoBlocks and Escalations are standalone records tied to Members.
 *
 * Everything is stored in localStorage via the Zustand store — no backend.
 */

// ─── Enums / union types ───────────────────────────────────────────────────

export type ProjectStatus = 'Backlog' | 'In Progress' | 'Blocked' | 'Complete'

export type ProjectPhase =
  | 'Research'
  | 'Discovery'
  | 'Development'
  | 'QA'
  | 'Deployed'
  | 'On Hold'

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical'

export type InitiativeStatus = 'Planning' | 'Active' | 'Complete' | 'On Hold'

export type EffortSize = 'S' | 'M' | 'L' | 'XL'

export type IntakeStatus =
  | 'Pending Review'
  | 'Approved'
  | 'Rejected'
  | 'Deferred'

// ─── Core entities ────────────────────────────────────────────────────────

export interface Domain {
  id: string
  name: string
  description: string
  owner: string
}

export interface Team {
  id: string
  domainId: string
  name: string
  description: string
  techLead: string
  memberIds: string[]
}

export interface Member {
  id: string
  /** A member may belong to multiple teams */
  teamIds: string[]
  name: string
  role: string
  /** Manager this member reports to */
  reportsTo?: string
  /** 0–100 percent */
  capacity: number
  avatarInitials: string
  projectIds: string[]
}

export interface ProjectMemberAssignment {
  memberId: string
  /** What this member is responsible for on this project (e.g. "Backend", "QA", "PM") */
  part?: string
  /** 5–100: percentage of working time this member commits during the project's duration */
  allocation: number
  /** When this member's work on the project starts (ISO date) */
  startDate?: string
  /** When this member's work on the project ends (ISO date) */
  endDate?: string
}

export interface Project {
  id: string
  /** Per-member assignments — each entry records who is on the project, what part they own, and their allocation % */
  assignments: ProjectMemberAssignment[]
  name: string
  description: string
  status: ProjectStatus
  phase: ProjectPhase
  /** References an Initiative by id */
  initiativeId: string
  priority: Priority
  /** ISO date string, e.g. "2025-03-01" */
  startDate: string
  /** ISO date string */
  targetEndDate: string
  /** 0–100 */
  percentComplete: number
  stakeholders: string
  notes: string
  /** ISO datetime string — used for "recent activity" feed */
  updatedAt: string
  /**
   * IDs of other projects that must complete (or unblock) before this one can
   * proceed. Only relevant when status === 'Blocked', but stored on all projects
   * so the field is always present and filterable.
   */
  blockedByIds?: string[]
  /** Dollar value expected from the project (revenue gain or cost reduction). */
  estimatedValue?: number
  /** Whether the estimated value is a revenue gain or a cost reduction. */
  valueType?: 'Revenue Impact' | 'Cost Savings'
  /** Actual value realized — populated once the project reaches Complete status. */
  actualValue?: number
}

/**
 * Maps a member role string (e.g. "Software Engineer") to an annual salary cost
 * in dollars. Used for portfolio-level headcount cost calculations.
 * Roles are salaried — the rate is fixed regardless of utilization.
 */
export interface ResourceRate {
  role: string
  annualRate: number
}

export interface Initiative {
  id: string
  name: string
  description: string
  /** e.g. "Q3 2025" */
  targetQuarter: string
  status: InitiativeStatus
}

export interface IntakeRequest {
  id: string
  requesterName: string
  teamOrDomain: string
  description: string
  /** Q2: New vs existing capability */
  capabilityType?: 'New' | 'Existing'
  /** Q3: Whether funding is in place */
  hasFunding?: 'Yes' | 'No' | 'Other'
  /** Q4: Business value / benefits (replaces old businessJustification label) */
  businessJustification: string
  /** Q5: KPIs, metrics, dashboards the team will use to measure success */
  measurementPlan?: string
  estimatedEffort: EffortSize
  priority: Priority
  /** Q7: Person who prioritized the request */
  businessOwner?: string
  /** Q8: Whether this touches store network bandwidth and how */
  networkImpact?: string
  /** ISO date string */
  requestedByDate: string
  status: IntakeStatus
  /** ISO datetime string */
  submittedAt: string
}

export interface PtoBlock {
  id: string
  memberId: string
  startDate: string  // ISO date
  endDate: string    // ISO date
  note: string
}

export type EscalationStatus = 'Open' | 'Resolved'

export interface Escalation {
  id: string
  /** Free-text name of the person blocked */
  memberName: string
  /** Optional reference to a member id */
  memberId?: string
  /** Project they're blocked on (free text) */
  projectName: string
  /** Optional project id */
  projectId?: string
  /** What they're blocked on */
  blockedOn: string
  /** What they need to become unblocked */
  needsTo: string
  status: EscalationStatus
  submittedAt: string
  resolvedAt?: string
  resolvedNote?: string
}

// ─── Root store shape (used by Zustand) ───────────────────────────────────

export interface PortfolioState {
  domains: Domain[]
  teams: Team[]
  members: Member[]
  projects: Project[]
  initiatives: Initiative[]
  intakeRequests: IntakeRequest[]
  escalations: Escalation[]
  ptoBlocks: PtoBlock[]
  /** Role-to-annual-cost mappings for portfolio financial analysis. */
  resourceRates: ResourceRate[]
}
