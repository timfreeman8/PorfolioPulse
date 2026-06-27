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

/** Status of a single phase within a multi-phase project plan. */
export type PhaseStatus = 'Not Started' | 'In Progress' | 'Complete'

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
  | 'Under Review'
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
  /**
   * One or more discipline / specialization tags for this member, e.g.
   * ["Web Developer", "UX Researcher"]. Distinct from `role` (the formal job
   * title) — used for filtering and at-a-glance categorization.
   */
  discipline?: string[]
  /** Manager this member reports to */
  reportsTo?: string
  /** 0–100 percent */
  capacity: number
  avatarInitials: string
  projectIds: string[]
  /** Kroger FTE (default) or external contractor (e.g. Deloitte). Optional — absence means FTE. */
  employmentType?: 'FTE' | 'Contractor'
}

/**
 * A single phase within a multi-phase project plan. Each step has its own
 * date range, team assignments, and completion state — independent of the
 * other phases. The project-level startDate, targetEndDate, phase, and
 * percentComplete are derived from the collection of steps on save.
 */
export interface ProjectPhaseStep {
  id: string
  /** Which SDLC phase this step represents */
  phase: ProjectPhase
  startDate: string
  endDate: string
  /** Members working during this phase, with their role and allocation */
  assignments: ProjectMemberAssignment[]
  status: PhaseStatus
  /** 0–100 */
  percentComplete: number
  /** Optional phase-level notes */
  notes?: string
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
  /**
   * Ordered sequence of phases that make up the project plan. When present,
   * startDate, targetEndDate, phase, percentComplete, and assignments are
   * derived from this array on save so all other views (Gantt, Dashboard,
   * Analytics) continue to work without modification.
   *
   * Legacy projects without this field are auto-converted to a single-step
   * plan when opened in the project builder.
   */
  phases?: ProjectPhaseStep[]
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

/**
 * One entry in the automatic status-change audit trail.
 * Written by the store whenever a request's status field changes so there is
 * always a complete, timestamped record of how a request moved through triage.
 */
export interface IntakeStatusChange {
  status: IntakeStatus
  /** ISO datetime string */
  changedAt: string
}

/**
 * A single note added by a reviewer during the pre-triage discussion period.
 * Multiple people can comment on the same request before a final decision is made.
 */
export interface IntakeComment {
  id: string
  authorName: string
  text: string
  /** ISO datetime string */
  createdAt: string
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
  /** Dollar value estimate (thousands) — used for priority scoring */
  estimatedValue?: number
  /** Whether the value is revenue-generating or cost-reducing */
  valueType?: 'Revenue Impact' | 'Cost Savings'
  /** Linked strategic initiative (set by admin after approval) */
  initiativeId?: string
  /** Notes added by the reviewer when approving, rejecting, or deferring */
  reviewerNotes?: string
  /** Pre-triage discussion thread — multiple reviewers can add notes before a final decision */
  comments?: IntakeComment[]
  /** ID of the Project created when this request was converted to an epic */
  convertedProjectId?: string
  /** Automatic audit trail — one entry appended each time status changes */
  statusHistory?: IntakeStatusChange[]
  /** Date by which a triage decision should be made (ISO date string) */
  reviewDeadline?: string
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

// ─── Design Pulse — weekly status ─────────────────────────────────────────

/**
 * A single priority item in a weekly pulse.
 * Stores the priority text plus an effort-size tag so the reader can
 * quickly gauge relative weight of each item.
 */
export interface PriorityItem {
  text: string
  /** Rough effort/complexity size for this priority. */
  size: 'S' | 'M' | 'L' | 'XL'
  /** Optional delivery status for this priority item. */
  status?: 'Not Started' | 'In Progress' | 'Complete' | 'Blocked'
}

/** One product area within the quarterly objectives section. */
export interface ObjectiveArea {
  /** Name of the product or focus area, e.g. "Digital Shelf Labels". */
  product: string
  /** Bullet-point objectives for this area. One string per objective. */
  objectives: string[]
  /** Optional side quests / stretch goals under this area. */
  sideQuests: string[]
}

/**
 * A member's weekly "Design Pulse" status entry.
 * Filled out every Friday for the upcoming week.
 * Managers see all their direct reports' pulses in one view.
 */
export interface WeeklyPulse {
  id: string
  memberId: string
  /** ISO date of the Monday that opens the week, e.g. "2026-06-15". */
  weekOf: string
  /** 1 = send me anything, 3 = just right, 5 = extremely busy. */
  workloadSentiment: 1 | 2 | 3 | 4 | 5
  /** Ordered list of priority items, each with text and a size tag. */
  currentPriorities: PriorityItem[]
  /** Shared context tags for the priorities section, e.g. "DSL", "AI". */
  priorityTags: string[]
  /** Upcoming events, OOO, or feature releases — same PriorityItem shape as currentPriorities so each has an effort size. */
  upcoming: PriorityItem[]
  /** Skill areas or project types the member wants to develop or work in — stored as PriorityItem so size can be tagged. */
  developmentFocus: PriorityItem[]
  /** Quarterly objectives organized by product area. Kept for backward-compat; new entries use flat arrays below. */
  objectives: ObjectiveArea[]
  /** Personal development goals — individual growth focus for the week. */
  personalObjectives?: string[]
  /** Team-level OKRs or shared commitments for the current period. */
  teamObjectives?: string[]
  /** Stretch goals or exploratory side work. */
  sideQuests?: string[]
  updatedAt: string
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
  weeklyPulses: WeeklyPulse[]
  /** Role-to-annual-cost mappings for portfolio financial analysis. */
  resourceRates: ResourceRate[]
}
