/**
 * ARCHIVED SEED DATA — original fictitious dataset.
 *
 * Kept for reference only. Active seed data is in seedData.ts, which uses
 * real SAT organization data from SAT-Seed-Data.csv (imported June 2026).
 *
 * Do not import or use this file in the application.
 */

import { loadState } from '@/lib/persistence'
import type {
  Domain,
  Initiative,
  IntakeRequest,
  Member,
  PortfolioState,
  Project,
  Team,
} from '@/types'

// ─── Domains ──────────────────────────────────────────────────────────────

const domains: Domain[] = [
  {
    id: 'd1',
    name: 'Store Experience',
    description: 'Customer-facing in-store technology: POS, digital displays, and associate tools.',
    owner: 'Sarah Mitchell',
  },
  {
    id: 'd2',
    name: 'Inventory & Supply Chain',
    description: 'End-to-end inventory visibility, fulfillment, demand planning, and logistics.',
    owner: 'James Torres',
  },
  {
    id: 'd3',
    name: 'Platform & Infrastructure',
    description: 'Core platform services, cloud infrastructure, DevOps, and data engineering.',
    owner: 'Lisa Chen',
  },
]

// ─── Initiatives ──────────────────────────────────────────────────────────

const initiatives: Initiative[] = [
  {
    id: 'i1',
    name: 'Unified Store Experience 2026',
    description: 'Modernize all customer-facing checkout and in-store touchpoints.',
    targetQuarter: 'Q3 2026',
    status: 'Active',
  },
  {
    id: 'i2',
    name: 'Supply Chain Modernization',
    description: 'End-to-end supply chain visibility and automation across all fulfillment channels.',
    targetQuarter: 'Q4 2026',
    status: 'Active',
  },
  {
    id: 'i3',
    name: 'Platform Resilience Initiative',
    description: 'Multi-region failover, service mesh, and zero-downtime deployments.',
    targetQuarter: 'Q2 2027',
    status: 'Planning',
  },
  {
    id: 'i4',
    name: 'Digital Associate Tools',
    description: 'Mobile-first tools to empower store associates with real-time data and task management.',
    targetQuarter: 'Q2 2026',
    status: 'Active',
  },
  {
    id: 'i5',
    name: 'Data & Analytics Foundation',
    description: 'Build the data lake, governance framework, and real-time analytics pipelines.',
    targetQuarter: 'Q3 2026',
    status: 'Planning',
  },
]

// ─── Teams ────────────────────────────────────────────────────────────────
// memberIds are computed below from the members list.

const rawTeams: Omit<Team, 'memberIds'>[] = [
  // Domain: Store Experience
  { id: 't1', domainId: 'd1', name: 'POS & Checkout', description: 'Point-of-sale systems, payment processing, and checkout hardware.', techLead: 'Marcus Johnson' },
  { id: 't2', domainId: 'd1', name: 'Digital In-Store', description: 'Digital signage, product locators, and interactive in-store displays.', techLead: 'Priya Patel' },
  { id: 't3', domainId: 'd1', name: 'Associate Experience', description: 'Mobile apps, task management, and tools for store associates.', techLead: 'Derek Williams' },
  // Domain: Inventory & Supply Chain
  { id: 't4', domainId: 'd2', name: 'Inventory Management', description: 'Real-time inventory tracking, RFID, and shrink analytics.', techLead: 'Rachel Kim' },
  { id: 't5', domainId: 'd2', name: 'Fulfillment & Logistics', description: 'Ship-from-store, BOPIS, same-day delivery, and carrier integrations.', techLead: 'Carlos Rivera' },
  { id: 't6', domainId: 'd2', name: 'Demand Planning', description: 'ML-driven forecasting, seasonal planning, and supplier collaboration.', techLead: 'Amy Nguyen' },
  // Domain: Platform & Infrastructure
  { id: 't7', domainId: 'd3', name: 'Core Platform', description: 'API gateway, event streaming, service mesh, and identity platform.', techLead: 'Brian Scott' },
  { id: 't8', domainId: 'd3', name: 'DevOps & Cloud', description: 'CI/CD pipelines, multi-region cloud infrastructure, and SRE.', techLead: 'Naomi Foster' },
  { id: 't9', domainId: 'd3', name: 'Data Engineering', description: 'Data lake, real-time pipelines, governance, and store performance reporting.', techLead: 'Kevin Park' },
]

// ─── Members ──────────────────────────────────────────────────────────────
// projectIds are computed below from the projects list.

const rawMembers: Omit<Member, 'projectIds'>[] = [
  // t1 – POS & Checkout
  { id: 'm1', teamIds: ['t1'], name: 'Alex Thompson',  role: 'Senior Engineer',      capacity: 80,  avatarInitials: 'AT' },
  { id: 'm2', teamIds: ['t1'], name: 'Jordan Lee',      role: 'Engineer',             capacity: 65,  avatarInitials: 'JL' },
  { id: 'm3', teamIds: ['t1'], name: 'Casey Morgan',    role: 'QA Engineer',          capacity: 70,  avatarInitials: 'CM' },
  // t2 – Digital In-Store
  { id: 'm4', teamIds: ['t2'], name: 'Taylor Brooks',   role: 'Senior Engineer',      capacity: 90,  avatarInitials: 'TB' },
  { id: 'm5', teamIds: ['t2'], name: 'Morgan Davis',    role: 'Engineer',             capacity: 75,  avatarInitials: 'MD' },
  { id: 'm6', teamIds: ['t2'], name: 'Riley Chen',      role: 'UX Engineer',          capacity: 60,  avatarInitials: 'RC' },
  // t3 – Associate Experience
  { id: 'm7', teamIds: ['t3'], name: 'Sam Wilson',      role: 'Senior Engineer',      capacity: 85,  avatarInitials: 'SW' },
  { id: 'm8', teamIds: ['t3'], name: 'Jamie Parker',    role: 'Engineer',             capacity: 50,  avatarInitials: 'JP' },
  { id: 'm9', teamIds: ['t3'], name: 'Drew Martinez',   role: 'Product Engineer',     capacity: 70,  avatarInitials: 'DM' },
  // t4 – Inventory Management
  { id: 'm10', teamIds: ['t4'], name: 'Avery Johnson',  role: 'Senior Engineer',      capacity: 95,  avatarInitials: 'AJ' },
  { id: 'm11', teamIds: ['t4'], name: 'Quinn Roberts',  role: 'Engineer',             capacity: 80,  avatarInitials: 'QR' },
  { id: 'm12', teamIds: ['t4'], name: 'Sage Williams',  role: 'Data Engineer',        capacity: 65,  avatarInitials: 'SW' },
  // t5 – Fulfillment & Logistics
  { id: 'm13', teamIds: ['t5'], name: 'Blake Turner',   role: 'Senior Engineer',      capacity: 75,  avatarInitials: 'BT' },
  { id: 'm14', teamIds: ['t5'], name: 'Hayden Clark',   role: 'Engineer',             capacity: 60,  avatarInitials: 'HC' },
  { id: 'm15', teamIds: ['t5'], name: 'Kennedy Hall',   role: 'Systems Engineer',     capacity: 85,  avatarInitials: 'KH' },
  // t6 – Demand Planning
  { id: 'm16', teamIds: ['t6'], name: 'Reese Adams',    role: 'Senior Engineer',      capacity: 70,  avatarInitials: 'RA' },
  { id: 'm17', teamIds: ['t6'], name: 'Skyler Wright',  role: 'Engineer',             capacity: 55,  avatarInitials: 'SWr' },
  // t7 – Core Platform
  { id: 'm18', teamIds: ['t7'], name: 'Cameron Evans',  role: 'Staff Engineer',       capacity: 90,  avatarInitials: 'CE' },
  { id: 'm19', teamIds: ['t7'], name: 'Dana Scott',     role: 'Senior Engineer',      capacity: 80,  avatarInitials: 'DS' },
  { id: 'm20', teamIds: ['t7'], name: 'Evan Foster',    role: 'Engineer',             capacity: 65,  avatarInitials: 'EF' },
  // t8 – DevOps & Cloud
  { id: 'm21', teamIds: ['t8'], name: 'Finley King',    role: 'Senior DevOps Engineer', capacity: 100, avatarInitials: 'FK' },
  { id: 'm22', teamIds: ['t8'], name: 'Gray Mitchell',  role: 'Cloud Engineer',       capacity: 85,  avatarInitials: 'GM' },
  { id: 'm23', teamIds: ['t8'], name: 'Harper Lee',     role: 'Site Reliability Engineer', capacity: 75, avatarInitials: 'HL' },
  // t9 – Data Engineering
  { id: 'm24', teamIds: ['t9'], name: 'Indigo Taylor',  role: 'Senior Data Engineer', capacity: 70,  avatarInitials: 'IT' },
  { id: 'm25', teamIds: ['t9'], name: 'Jules Martin',   role: 'Data Engineer',        capacity: 60,  avatarInitials: 'JM' },
]

// ─── Projects ─────────────────────────────────────────────────────────────

const projects: Project[] = [
  // ── m1 – Alex Thompson (POS & Checkout) ──────────────────────────────
  {
    id: 'p1', assignments: [
      { memberId: 'm1', part: 'Backend', allocation: 40, startDate: '2025-09-01', endDate: '2026-06-30' },
      { memberId: 'm2', part: 'Frontend', allocation: 25, startDate: '2025-12-01', endDate: '2026-05-31' },
      { memberId: 'm3', part: 'QA', allocation: 30, startDate: '2026-03-01', endDate: '2026-06-30' },
    ],
    name: 'POS Terminal Refresh',
    description: 'Hardware and software upgrade for all POS terminals across 400+ stores.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i1', priority: 'High',
    startDate: '2025-09-01', targetEndDate: '2026-06-30', percentComplete: 75,
    stakeholders: 'Store Ops, Merchandising', notes: 'On track. Pilot stores complete.',
    updatedAt: '2026-05-20T10:30:00Z',
  },
  {
    id: 'p2', assignments: [
      { memberId: 'm1', part: 'Backend', allocation: 60, startDate: '2025-11-01', endDate: '2026-06-15' },
      { memberId: 'm2', part: 'Frontend', allocation: 30, startDate: '2026-01-01', endDate: '2026-06-15' },
      { memberId: 'm3', part: 'QA', allocation: 20, startDate: '2026-03-01', endDate: '2026-06-15' },
    ],
    name: 'Contactless Payment v2',
    description: 'NFC and tap-to-pay upgrade supporting Apple Pay, Google Pay, and tap debit.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i1', priority: 'Critical',
    startDate: '2025-11-01', targetEndDate: '2026-06-15', percentComplete: 90,
    stakeholders: 'Finance, Store Ops', notes: 'UAT complete. Awaiting payment processor sign-off.',
    updatedAt: '2026-05-25T14:00:00Z',
  },
  {
    id: 'p3', assignments: [
      { memberId: 'm1', part: 'Backend', allocation: 50, startDate: '2026-04-01', endDate: '2026-12-31' },
      { memberId: 'm6', part: 'Design', allocation: 25, startDate: '2026-04-01', endDate: '2026-09-30' },
    ],
    name: 'Self-Checkout Kiosk Upgrade',
    description: 'Redesign self-checkout UX and upgrade underlying hardware platform.',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i1', priority: 'High',
    startDate: '2026-04-01', targetEndDate: '2026-12-31', percentComplete: 15,
    stakeholders: 'Store Ops, Loss Prevention', notes: 'Requirements gathering in progress.',
    updatedAt: '2026-05-10T09:00:00Z',
  },
  // ── m2 – Jordan Lee ──────────────────────────────────────────────────
  {
    id: 'p4', assignments: [
      { memberId: 'm2', part: 'Frontend', allocation: 25, startDate: '2025-10-15', endDate: '2026-05-31' },
      { memberId: 'm9', part: 'Backend', allocation: 20, startDate: '2025-10-15', endDate: '2026-05-31' },
    ],
    name: 'Receipt Management System',
    description: 'Digital receipt delivery via email and SMS with opt-in preference center.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i1', priority: 'Medium',
    startDate: '2025-10-15', targetEndDate: '2026-05-31', percentComplete: 60,
    stakeholders: 'Marketing, Store Ops', notes: 'Email delivery complete; SMS in dev.',
    updatedAt: '2026-05-18T11:00:00Z',
  },
  {
    id: 'p5', assignments: [{ memberId: 'm2', allocation: 65 }],
    name: 'EMV Compliance Update',
    description: 'EMV chip reader firmware and certification updates for all store terminals.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i1', priority: 'Critical',
    startDate: '2025-07-01', targetEndDate: '2025-12-31', percentComplete: 100,
    stakeholders: 'Finance, Compliance', notes: 'Fully deployed. Compliance certification received.',
    updatedAt: '2026-01-05T08:00:00Z',
  },
  // ── m3 – Casey Morgan ─────────────────────────────────────────────────
  {
    id: 'p6', assignments: [
      { memberId: 'm3', part: 'QA', allocation: 45, startDate: '2025-12-01', endDate: '2026-05-31' },
      { memberId: 'm2', part: 'QA', allocation: 25, startDate: '2026-01-01', endDate: '2026-05-31' },
    ],
    name: 'POS Integration Test Suite',
    description: 'Automated regression suite covering all POS payment and inventory flows.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i1', priority: 'High',
    startDate: '2025-12-01', targetEndDate: '2026-05-31', percentComplete: 80,
    stakeholders: 'Engineering, QA', notes: '92% coverage achieved. Final edge cases in progress.',
    updatedAt: '2026-05-22T15:00:00Z',
  },
  {
    id: 'p7', assignments: [
      { memberId: 'm3', part: 'QA', allocation: 20, startDate: '2026-07-01', endDate: '2026-12-31' },
      { memberId: 'm12', part: 'Data', allocation: 25, startDate: '2026-07-01', endDate: '2026-12-31' },
    ],
    name: 'Cashier Performance Analytics',
    description: 'Dashboard tracking cashier transaction speed, error rates, and throughput.',
    status: 'Backlog', phase: 'Research', initiativeId: 'i5', priority: 'Low',
    startDate: '2026-07-01', targetEndDate: '2026-12-31', percentComplete: 10,
    stakeholders: 'Store Ops, HR', notes: 'Exploratory. Pending data governance approval.',
    updatedAt: '2026-04-15T09:00:00Z',
  },
  {
    id: 'p8', assignments: [{ memberId: 'm3', allocation: 40 }],
    name: 'Payment Reconciliation Tool',
    description: 'Automated daily reconciliation of POS transactions against financial ledger.',
    status: 'Blocked', phase: 'Development', initiativeId: 'i1', priority: 'High',
    startDate: '2025-11-15', targetEndDate: '2026-06-30', percentComplete: 45,
    stakeholders: 'Finance', notes: 'Blocked on Finance API access. Ticket open with vendor.',
    updatedAt: '2026-05-01T10:00:00Z',
  },
  // ── m4 – Taylor Brooks (Digital In-Store) ─────────────────────────────
  {
    id: 'p9', assignments: [
      { memberId: 'm4', part: 'Backend', allocation: 60, startDate: '2025-10-01', endDate: '2026-07-31' },
      { memberId: 'm5', part: 'Frontend', allocation: 35, startDate: '2025-10-01', endDate: '2026-06-30' },
      { memberId: 'm6', part: 'Design', allocation: 25, startDate: '2025-10-01', endDate: '2026-03-31' },
    ],
    name: 'Digital Signage Platform',
    description: 'Centralized CMS for managing in-store digital displays and promotions.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i4', priority: 'High',
    startDate: '2025-10-01', targetEndDate: '2026-07-31', percentComplete: 65,
    stakeholders: 'Marketing, Merchandising', notes: 'CMS core built. Integration with display hardware ongoing.',
    updatedAt: '2026-05-21T13:00:00Z',
  },
  {
    id: 'p10', assignments: [
      { memberId: 'm4', part: 'Backend', allocation: 20, startDate: '2025-08-15', endDate: '2026-04-30' },
      { memberId: 'm6', part: 'UX Research', allocation: 20, startDate: '2025-08-15', endDate: '2025-12-31' },
      { memberId: 'm5', part: 'Frontend', allocation: 30, startDate: '2025-10-01', endDate: '2026-04-30' },
    ],
    name: 'Product Locator App',
    description: 'In-store product search and aisle locator for customer-facing kiosks.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i4', priority: 'Medium',
    startDate: '2025-08-15', targetEndDate: '2026-04-30', percentComplete: 85,
    stakeholders: 'Merchandising, Store Ops', notes: 'User testing complete. Final QA pass in progress.',
    updatedAt: '2026-05-19T11:30:00Z',
  },
  {
    id: 'p11', assignments: [{ memberId: 'm4', allocation: 20 }],
    name: 'Interactive Display SDK',
    description: 'SDK enabling third-party vendors to build apps for in-store interactive screens.',
    status: 'Backlog', phase: 'Research', initiativeId: 'i4', priority: 'Low',
    startDate: '2026-08-01', targetEndDate: '2027-02-28', percentComplete: 5,
    stakeholders: 'Vendor Relations', notes: 'Feasibility study not yet started.',
    updatedAt: '2026-03-01T09:00:00Z',
  },
  // ── m5 – Morgan Davis ─────────────────────────────────────────────────
  {
    id: 'p12', assignments: [
      { memberId: 'm5', part: 'Frontend', allocation: 35, startDate: '2025-11-01', endDate: '2026-08-31' },
      { memberId: 'm8', part: 'Backend', allocation: 25, startDate: '2026-01-01', endDate: '2026-08-31' },
    ],
    name: 'In-Store Navigation System',
    description: 'Bluetooth beacon-based indoor navigation for customer smartphones.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i4', priority: 'Medium',
    startDate: '2025-11-01', targetEndDate: '2026-08-31', percentComplete: 50,
    stakeholders: 'Store Ops, Marketing', notes: 'Beacon hardware deployed in 10 pilot stores.',
    updatedAt: '2026-05-14T10:00:00Z',
  },
  {
    id: 'p13', assignments: [{ memberId: 'm5', allocation: 20 }],
    name: 'QR Code Shopping Experience',
    description: 'Scan-to-learn product details, reviews, and cross-sell recommendations via QR.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i4', priority: 'Medium',
    startDate: '2025-06-01', targetEndDate: '2025-12-31', percentComplete: 100,
    stakeholders: 'Marketing, Merchandising', notes: 'Live in all stores. 18% scan adoption rate.',
    updatedAt: '2026-01-10T08:00:00Z',
  },
  // ── m6 – Riley Chen ───────────────────────────────────────────────────
  {
    id: 'p14', assignments: [
      { memberId: 'm6', part: 'Design', allocation: 40, startDate: '2026-03-01', endDate: '2026-11-30' },
      { memberId: 'm8', part: 'Mobile', allocation: 35, startDate: '2026-04-01', endDate: '2026-11-30' },
    ],
    name: 'Store Mobile Web App',
    description: 'Progressive web app for shoppers: shopping lists, store map, deals.',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i4', priority: 'High',
    startDate: '2026-03-01', targetEndDate: '2026-11-30', percentComplete: 20,
    stakeholders: 'Marketing, Digital', notes: 'Wireframes in review with stakeholders.',
    updatedAt: '2026-05-05T09:00:00Z',
  },
  {
    id: 'p15', assignments: [{ memberId: 'm6', allocation: 20 }],
    name: 'Accessibility Audit & Remediation',
    description: 'WCAG 2.1 AA compliance audit and remediation across all in-store digital surfaces.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i4', priority: 'Medium',
    startDate: '2025-12-01', targetEndDate: '2026-06-30', percentComplete: 40,
    stakeholders: 'Legal, Store Ops', notes: 'Audit complete. Remediation 40% done.',
    updatedAt: '2026-05-16T14:00:00Z',
  },
  // ── m7 – Sam Wilson (Associate Experience) ────────────────────────────
  {
    id: 'p16', assignments: [
      { memberId: 'm7', part: 'Full Stack', allocation: 45, startDate: '2025-09-15', endDate: '2026-06-30' },
      { memberId: 'm8', part: 'Mobile', allocation: 40, startDate: '2025-09-15', endDate: '2026-05-31' },
      { memberId: 'm9', part: 'PM', allocation: 20, startDate: '2025-09-15', endDate: '2026-06-30' },
    ],
    name: 'Associate Mobile App v3',
    description: 'Complete rebuild of the associate companion app with real-time inventory lookup.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i4', priority: 'High',
    startDate: '2025-09-15', targetEndDate: '2026-06-30', percentComplete: 70,
    stakeholders: 'Store Ops, HR', notes: 'Core features complete. Inventory integration in progress.',
    updatedAt: '2026-05-23T10:00:00Z',
  },
  {
    id: 'p17', assignments: [
      { memberId: 'm7', part: 'Full Stack', allocation: 45, startDate: '2025-07-01', endDate: '2026-03-31' },
      { memberId: 'm8', part: 'Frontend', allocation: 30, startDate: '2025-09-01', endDate: '2026-03-31' },
    ],
    name: 'Task Management Portal',
    description: 'Web portal for managers to assign, track, and report on associate daily tasks.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i4', priority: 'High',
    startDate: '2025-07-01', targetEndDate: '2026-03-31', percentComplete: 88,
    stakeholders: 'Store Ops', notes: 'Passed UAT. Final regression testing underway.',
    updatedAt: '2026-05-26T09:30:00Z',
  },
  {
    id: 'p18', assignments: [{ memberId: 'm7', allocation: 40 }],
    name: 'Push Notification Service',
    description: 'Centralized notification hub delivering alerts to associate mobile devices.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i4', priority: 'Medium',
    startDate: '2025-05-01', targetEndDate: '2025-11-30', percentComplete: 100,
    stakeholders: 'Store Ops', notes: 'Live in production. 3,200 daily active users.',
    updatedAt: '2025-12-01T08:00:00Z',
  },
  // ── m8 – Jamie Parker ─────────────────────────────────────────────────
  {
    id: 'p19', assignments: [
      { memberId: 'm8', part: 'Mobile', allocation: 40, startDate: '2026-06-01', endDate: '2026-12-31' },
      { memberId: 'm20', part: 'API', allocation: 25, startDate: '2026-06-01', endDate: '2026-12-31' },
    ],
    name: 'Training Integration API',
    description: 'API connecting the LMS with the associate app for in-context training prompts.',
    status: 'Backlog', phase: 'Research', initiativeId: 'i4', priority: 'Medium',
    startDate: '2026-06-01', targetEndDate: '2026-12-31', percentComplete: 15,
    stakeholders: 'HR, L&D', notes: 'LMS vendor evaluation in progress.',
    updatedAt: '2026-04-20T09:00:00Z',
  },
  {
    id: 'p20', assignments: [{ memberId: 'm8', allocation: 40 }],
    name: 'Schedule Management Tool',
    description: 'Mobile-friendly scheduling tool integrating with the workforce management system.',
    status: 'Blocked', phase: 'Development', initiativeId: 'i4', priority: 'High',
    startDate: '2026-01-15', targetEndDate: '2026-08-31', percentComplete: 35,
    stakeholders: 'HR, Store Ops', notes: 'Blocked on WFM system API documentation from vendor.',
    updatedAt: '2026-05-12T11:00:00Z',
  },
  // ── m9 – Drew Martinez ────────────────────────────────────────────────
  {
    id: 'p21', assignments: [{ memberId: 'm9', allocation: 20 }],
    name: 'Feedback & Survey Platform',
    description: 'In-app survey tool for collecting associate feedback on processes and tools.',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i4', priority: 'Low',
    startDate: '2026-07-01', targetEndDate: '2027-01-31', percentComplete: 8,
    stakeholders: 'HR, Store Ops', notes: 'Backlog. Prioritized for H2 2026.',
    updatedAt: '2026-03-10T09:00:00Z',
  },
  {
    id: 'p22', assignments: [{ memberId: 'm9', allocation: 25 }],
    name: 'Badge & Access Control Integration',
    description: 'Integrate associate identity with physical access control and digital systems.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i3', priority: 'Medium',
    startDate: '2025-12-01', targetEndDate: '2026-07-31', percentComplete: 55,
    stakeholders: 'Security, HR', notes: 'Identity provider integration complete. Door hardware next.',
    updatedAt: '2026-05-17T13:00:00Z',
  },
  // ── m10 – Avery Johnson (Inventory Management) ────────────────────────
  {
    id: 'p23', assignments: [
      { memberId: 'm10', part: 'Backend', allocation: 80, startDate: '2025-08-01', endDate: '2026-07-31' },
      { memberId: 'm11', part: 'API', allocation: 35, startDate: '2025-12-01', endDate: '2026-07-31' },
      { memberId: 'm12', part: 'Data', allocation: 30, startDate: '2026-02-01', endDate: '2026-07-31' },
    ],
    name: 'Real-time Inventory Sync',
    description: 'Event-driven inventory sync between store systems and the central OMS.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i2', priority: 'Critical',
    startDate: '2025-08-01', targetEndDate: '2026-07-31', percentComplete: 60,
    stakeholders: 'Merchandising, Supply Chain', notes: 'Kafka integration live. Store adapters in dev.',
    updatedAt: '2026-05-24T10:00:00Z',
  },
  {
    id: 'p24', assignments: [
      { memberId: 'm10', part: 'Backend', allocation: 55, startDate: '2025-10-01', endDate: '2026-09-30' },
      { memberId: 'm11', part: 'API', allocation: 30, startDate: '2025-12-01', endDate: '2026-09-30' },
    ],
    name: 'RFID Integration',
    description: 'RFID reader integration for automated inventory counts in apparel departments.',
    status: 'Blocked', phase: 'Discovery', initiativeId: 'i2', priority: 'High',
    startDate: '2025-10-01', targetEndDate: '2026-09-30', percentComplete: 25,
    stakeholders: 'Merchandising, Store Ops', notes: 'Blocked: hardware vendor delayed shipment Q1 2026.',
    updatedAt: '2026-04-30T09:00:00Z',
  },
  {
    id: 'p25', assignments: [
      { memberId: 'm10', part: 'Backend', allocation: 45, startDate: '2025-11-01', endDate: '2026-04-30' },
      { memberId: 'm12', part: 'Data', allocation: 20, startDate: '2026-01-01', endDate: '2026-04-30' },
    ],
    name: 'Inventory Accuracy Dashboard',
    description: 'Real-time dashboard showing on-hand accuracy, shrink, and cycle count status.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i2', priority: 'High',
    startDate: '2025-11-01', targetEndDate: '2026-04-30', percentComplete: 80,
    stakeholders: 'Merchandising, Finance', notes: 'Dashboard functional. Performance tuning in progress.',
    updatedAt: '2026-05-20T14:00:00Z',
  },
  // ── m11 – Quinn Roberts ───────────────────────────────────────────────
  {
    id: 'p26', assignments: [{ memberId: 'm11', allocation: 35 }],
    name: 'Cycle Count Automation',
    description: 'Automate cycle count scheduling and variance reporting using historical data.',
    status: 'Backlog', phase: 'Research', initiativeId: 'i2', priority: 'Medium',
    startDate: '2026-05-01', targetEndDate: '2026-11-30', percentComplete: 10,
    stakeholders: 'Store Ops', notes: 'Research phase. Evaluating existing tools.',
    updatedAt: '2026-05-02T09:00:00Z',
  },
  {
    id: 'p27', assignments: [
      { memberId: 'm11', part: 'API', allocation: 60, startDate: '2025-12-15', endDate: '2026-08-31' },
      { memberId: 'm20', part: 'API', allocation: 20, startDate: '2026-02-01', endDate: '2026-08-31' },
    ],
    name: 'Vendor Replenishment API',
    description: 'API enabling suppliers to trigger automated replenishment orders from inventory signals.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i2', priority: 'High',
    startDate: '2025-12-15', targetEndDate: '2026-08-31', percentComplete: 45,
    stakeholders: 'Procurement, Supply Chain', notes: '3 of 8 vendor connectors built.',
    updatedAt: '2026-05-19T10:00:00Z',
  },
  // ── m12 – Sage Williams ───────────────────────────────────────────────
  {
    id: 'p28', assignments: [
      { memberId: 'm12', part: 'Data', allocation: 50, startDate: '2025-11-01', endDate: '2026-08-31' },
      { memberId: 'm24', part: 'Data', allocation: 30, startDate: '2026-02-01', endDate: '2026-08-31' },
    ],
    name: 'Shrink Analytics Engine',
    description: 'ML-powered shrink detection and root cause analysis across product categories.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i5', priority: 'High',
    startDate: '2025-11-01', targetEndDate: '2026-08-31', percentComplete: 55,
    stakeholders: 'Loss Prevention, Finance', notes: 'Model v1 trained. Integration with POS data ongoing.',
    updatedAt: '2026-05-22T11:00:00Z',
  },
  {
    id: 'p29', assignments: [{ memberId: 'm12', allocation: 20 }],
    name: 'Loss Prevention Dashboard',
    description: 'Operational dashboard for LP teams surfacing high-risk transactions and patterns.',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i5', priority: 'Medium',
    startDate: '2026-06-01', targetEndDate: '2026-12-31', percentComplete: 20,
    stakeholders: 'Loss Prevention', notes: 'Wireframes drafted. Awaiting LP team review.',
    updatedAt: '2026-04-25T09:00:00Z',
  },
  // ── m13 – Blake Turner (Fulfillment & Logistics) ──────────────────────
  {
    id: 'p30', assignments: [
      { memberId: 'm13', part: 'Backend', allocation: 45, startDate: '2025-10-01', endDate: '2026-08-31' },
      { memberId: 'm14', part: 'Frontend', allocation: 30, startDate: '2025-10-01', endDate: '2026-05-31' },
      { memberId: 'm15', part: 'QA', allocation: 25, startDate: '2026-04-01', endDate: '2026-08-31' },
    ],
    name: 'Ship-from-Store v3',
    description: 'Next-gen SFS platform with wave picking, rate shopping, and print-on-demand labels.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i2', priority: 'High',
    startDate: '2025-10-01', targetEndDate: '2026-08-31', percentComplete: 65,
    stakeholders: 'Fulfillment, Store Ops', notes: 'Wave picking module complete. Rate shopping in dev.',
    updatedAt: '2026-05-23T13:00:00Z',
  },
  {
    id: 'p31', assignments: [{ memberId: 'm13', allocation: 55 }],
    name: 'BOPIS Order Enhancement',
    description: 'Improvements to buy-online-pickup-in-store: faster ready times and curbside UX.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i2', priority: 'High',
    startDate: '2025-04-01', targetEndDate: '2025-11-30', percentComplete: 100,
    stakeholders: 'Omnichannel, Store Ops', notes: 'Deployed. Ready times improved by 22%.',
    updatedAt: '2025-12-15T08:00:00Z',
  },
  {
    id: 'p32', assignments: [{ memberId: 'm13', allocation: 70 }],
    name: 'Same-Day Delivery Integration',
    description: 'Integration with third-party same-day delivery platforms (DoorDash, Instacart).',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i2', priority: 'Critical',
    startDate: '2026-06-01', targetEndDate: '2027-01-31', percentComplete: 15,
    stakeholders: 'Omnichannel, Marketing', notes: 'Contract negotiations underway with partners.',
    updatedAt: '2026-05-08T09:00:00Z',
  },
  // ── m14 – Hayden Clark ────────────────────────────────────────────────
  {
    id: 'p33', assignments: [
      { memberId: 'm14', part: 'Frontend', allocation: 30, startDate: '2025-09-01', endDate: '2026-04-30' },
      { memberId: 'm13', part: 'Backend', allocation: 25, startDate: '2025-09-01', endDate: '2026-03-31' },
      { memberId: 'm15', part: 'QA', allocation: 20, startDate: '2026-02-01', endDate: '2026-04-30' },
    ],
    name: 'Returns Processing System v2',
    description: 'Streamlined returns flow with instant credit, disposition routing, and vendor returns.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i2', priority: 'Medium',
    startDate: '2025-09-01', targetEndDate: '2026-04-30', percentComplete: 85,
    stakeholders: 'Store Ops, Finance', notes: 'UAT passed. Production cutover scheduled for June.',
    updatedAt: '2026-05-25T10:00:00Z',
  },
  {
    id: 'p34', assignments: [
      { memberId: 'm14', part: 'Frontend', allocation: 45, startDate: '2026-01-01', endDate: '2026-09-30' },
      { memberId: 'm13', part: 'Backend', allocation: 25, startDate: '2026-01-01', endDate: '2026-09-30' },
    ],
    name: 'Carrier Integration Hub',
    description: 'Unified carrier API abstraction layer supporting UPS, FedEx, USPS, and regional carriers.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i2', priority: 'High',
    startDate: '2026-01-01', targetEndDate: '2026-09-30', percentComplete: 50,
    stakeholders: 'Logistics, Finance', notes: 'UPS and FedEx connectors live. USPS in dev.',
    updatedAt: '2026-05-18T11:00:00Z',
  },
  // ── m15 – Kennedy Hall ────────────────────────────────────────────────
  {
    id: 'p35', assignments: [{ memberId: 'm15', allocation: 25 }],
    name: 'Last Mile Tracking Dashboard',
    description: 'Real-time shipment tracking aggregator for all outbound fulfillment channels.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i2', priority: 'Medium',
    startDate: '2025-11-15', targetEndDate: '2026-06-30', percentComplete: 70,
    stakeholders: 'Logistics, Customer Service', notes: 'Carrier feeds integrated. UI polish remaining.',
    updatedAt: '2026-05-21T14:00:00Z',
  },
  {
    id: 'p36', assignments: [{ memberId: 'm15', allocation: 30 }],
    name: 'Fulfillment SLA Monitor',
    description: 'Automated alerting when fulfillment SLAs are at risk by store, carrier, or region.',
    status: 'Backlog', phase: 'Research', initiativeId: 'i2', priority: 'Medium',
    startDate: '2026-07-01', targetEndDate: '2026-12-31', percentComplete: 5,
    stakeholders: 'Logistics, Store Ops', notes: 'Not yet started. Q3 2026 target.',
    updatedAt: '2026-03-20T09:00:00Z',
  },
  // ── m16 – Reese Adams (Demand Planning) ──────────────────────────────
  {
    id: 'p37', assignments: [
      { memberId: 'm16', part: 'Backend', allocation: 60, startDate: '2025-09-01', endDate: '2026-09-30' },
      { memberId: 'm24', part: 'Data', allocation: 35, startDate: '2025-11-01', endDate: '2026-09-30' },
      { memberId: 'm25', part: 'Data', allocation: 20, startDate: '2026-02-01', endDate: '2026-09-30' },
    ],
    name: 'ML Demand Forecasting Model',
    description: 'Machine learning model replacing legacy statistical forecasting for all SKUs.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i5', priority: 'Critical',
    startDate: '2025-09-01', targetEndDate: '2026-09-30', percentComplete: 55,
    stakeholders: 'Merchandising, Supply Chain', notes: 'Model v2 in training. Outperforming legacy by 18% MAPE.',
    updatedAt: '2026-05-24T13:00:00Z',
  },
  {
    id: 'p38', assignments: [{ memberId: 'm16', allocation: 40 }],
    name: 'Seasonal Planning Tool',
    description: 'Collaborative planning tool for merchants to adjust demand curves for seasonal events.',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i2', priority: 'High',
    startDate: '2026-04-01', targetEndDate: '2026-11-30', percentComplete: 20,
    stakeholders: 'Merchandising, Planning', notes: 'Merchant interviews complete. Wireframes in progress.',
    updatedAt: '2026-05-06T09:00:00Z',
  },
  {
    id: 'p39', assignments: [{ memberId: 'm16', allocation: 35 }],
    name: 'Promotional Lift Analysis',
    description: 'Post-promotion analytics measuring actual vs. predicted sales lift by promotion type.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i5', priority: 'Medium',
    startDate: '2025-12-01', targetEndDate: '2026-05-31', percentComplete: 75,
    stakeholders: 'Marketing, Merchandising', notes: 'Analysis framework built. Validation against 6 months of promos.',
    updatedAt: '2026-05-20T10:00:00Z',
  },
  // ── m17 – Skyler Wright ───────────────────────────────────────────────
  {
    id: 'p40', assignments: [{ memberId: 'm17', allocation: 10 }],
    name: 'Supplier Collaboration Portal',
    description: 'Vendor-facing portal for sharing demand signals, POs, and replenishment confirmations.',
    status: 'Backlog', phase: 'Research', initiativeId: 'i2', priority: 'Low',
    startDate: '2026-08-01', targetEndDate: '2027-02-28', percentComplete: 10,
    stakeholders: 'Procurement, Supply Chain', notes: 'RFP in progress for portal platform.',
    updatedAt: '2026-04-01T09:00:00Z',
  },
  {
    id: 'p41', assignments: [{ memberId: 'm17', allocation: 50 }],
    name: 'Inventory Allocation Engine',
    description: 'Automated allocation of constrained inventory across stores and channels by priority rules.',
    status: 'Blocked', phase: 'Development', initiativeId: 'i2', priority: 'High',
    startDate: '2026-01-15', targetEndDate: '2026-09-30', percentComplete: 30,
    stakeholders: 'Merchandising, Supply Chain', notes: 'Blocked on data access from legacy ERP. IT ticket escalated.',
    updatedAt: '2026-05-13T10:00:00Z',
  },
  // ── m18 – Cameron Evans (Core Platform) ──────────────────────────────
  {
    id: 'p42', assignments: [
      { memberId: 'm18', part: 'Architecture', allocation: 70, startDate: '2025-08-01', endDate: '2026-06-30' },
      { memberId: 'm19', part: 'Backend', allocation: 40, startDate: '2025-08-01', endDate: '2026-04-30' },
      { memberId: 'm20', part: 'DevOps', allocation: 20, startDate: '2025-11-01', endDate: '2026-06-30' },
    ],
    name: 'API Gateway v2',
    description: 'Migration to Kong Gateway with rate limiting, auth, and observability built in.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i3', priority: 'Critical',
    startDate: '2025-08-01', targetEndDate: '2026-06-30', percentComplete: 70,
    stakeholders: 'All engineering teams', notes: '14 of 22 services migrated. On track.',
    updatedAt: '2026-05-25T11:00:00Z',
  },
  {
    id: 'p43', assignments: [
      { memberId: 'm18', part: 'Architecture', allocation: 60, startDate: '2025-10-01', endDate: '2026-05-31' },
      { memberId: 'm19', part: 'Backend', allocation: 35, startDate: '2025-10-01', endDate: '2026-05-31' },
      { memberId: 'm22', part: 'DevOps', allocation: 20, startDate: '2026-01-01', endDate: '2026-05-31' },
    ],
    name: 'Event Streaming Platform',
    description: 'Kafka-based event bus standardizing async messaging across all platform services.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i3', priority: 'High',
    startDate: '2025-10-01', targetEndDate: '2026-05-31', percentComplete: 90,
    stakeholders: 'All engineering teams', notes: 'Load testing complete. Final security review pending.',
    updatedAt: '2026-05-26T09:00:00Z',
  },
  {
    id: 'p44', assignments: [
      { memberId: 'm18', part: 'Architecture', allocation: 50, startDate: '2025-12-01', endDate: '2026-09-30' },
      { memberId: 'm21', part: 'Infrastructure', allocation: 40, startDate: '2026-01-01', endDate: '2026-09-30' },
    ],
    name: 'Service Mesh Rollout',
    description: 'Istio service mesh deployment for traffic management, mTLS, and observability.',
    status: 'Blocked', phase: 'Development', initiativeId: 'i3', priority: 'High',
    startDate: '2025-12-01', targetEndDate: '2026-09-30', percentComplete: 40,
    stakeholders: 'Platform, Security', notes: 'Blocked on security policy approval for mTLS config.',
    updatedAt: '2026-05-15T10:00:00Z',
  },
  // ── m19 – Dana Scott ──────────────────────────────────────────────────
  {
    id: 'p45', assignments: [
      { memberId: 'm19', part: 'Backend', allocation: 60, startDate: '2025-09-01', endDate: '2026-07-31' },
      { memberId: 'm20', part: 'Backend', allocation: 30, startDate: '2025-11-01', endDate: '2026-07-31' },
    ],
    name: 'Auth & Identity Platform',
    description: 'Centralized identity platform (Okta) replacing 4 legacy auth systems.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i3', priority: 'Critical',
    startDate: '2025-09-01', targetEndDate: '2026-07-31', percentComplete: 60,
    stakeholders: 'Security, All teams', notes: '2 legacy systems decommissioned. 2 remaining.',
    updatedAt: '2026-05-22T14:00:00Z',
  },
  {
    id: 'p46', assignments: [{ memberId: 'm19', allocation: 55 }],
    name: 'GraphQL Federation Layer',
    description: 'Apollo Federation layer unifying store, inventory, and customer data into one graph.',
    status: 'Backlog', phase: 'Research', initiativeId: 'i3', priority: 'High',
    startDate: '2026-06-01', targetEndDate: '2027-01-31', percentComplete: 15,
    stakeholders: 'Platform, Digital', notes: 'Architecture spike in progress. POC planned for Q3.',
    updatedAt: '2026-05-08T09:00:00Z',
  },
  {
    id: 'p47', assignments: [{ memberId: 'm19', allocation: 40 }],
    name: 'Legacy API Deprecation',
    description: 'Sunset 12 internal SOAP APIs replaced by REST equivalents.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i3', priority: 'Medium',
    startDate: '2025-05-01', targetEndDate: '2025-12-31', percentComplete: 100,
    stakeholders: 'All engineering teams', notes: 'All 12 APIs deprecated. No active consumers remaining.',
    updatedAt: '2026-01-08T08:00:00Z',
  },
  // ── m20 – Evan Foster ─────────────────────────────────────────────────
  {
    id: 'p48', assignments: [{ memberId: 'm20', allocation: 20 }],
    name: 'Internal Developer Portal',
    description: 'Backstage-based developer portal with service catalog, docs, and runbooks.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i3', priority: 'Medium',
    startDate: '2025-11-01', targetEndDate: '2026-08-31', percentComplete: 50,
    stakeholders: 'Engineering', notes: 'Service catalog populated. Plugin development ongoing.',
    updatedAt: '2026-05-20T11:00:00Z',
  },
  {
    id: 'p49', assignments: [{ memberId: 'm20', allocation: 15 }],
    name: 'SDK & Client Library Refresh',
    description: 'Updated TypeScript and Python SDKs for all internal platform APIs.',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i3', priority: 'Low',
    startDate: '2026-07-01', targetEndDate: '2026-12-31', percentComplete: 12,
    stakeholders: 'Engineering', notes: 'Inventory of existing SDKs underway.',
    updatedAt: '2026-04-10T09:00:00Z',
  },
  // ── m21 – Finley King (DevOps & Cloud) ───────────────────────────────
  {
    id: 'p50', assignments: [
      { memberId: 'm21', part: 'Infrastructure', allocation: 60, startDate: '2025-10-01', endDate: '2026-09-30' },
      { memberId: 'm22', part: 'DevOps', allocation: 35, startDate: '2025-10-01', endDate: '2026-06-30' },
      { memberId: 'm23', part: 'QA', allocation: 25, startDate: '2026-06-01', endDate: '2026-09-30' },
    ],
    name: 'Multi-Region Failover',
    description: 'Active-active multi-region deployment across us-east-1 and us-west-2.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i3', priority: 'Critical',
    startDate: '2025-10-01', targetEndDate: '2026-09-30', percentComplete: 55,
    stakeholders: 'Platform, Finance', notes: 'Data replication configured. Failover runbooks drafted.',
    updatedAt: '2026-05-24T13:00:00Z',
  },
  {
    id: 'p51', assignments: [{ memberId: 'm21', allocation: 60 }],
    name: 'Container Platform Upgrade',
    description: 'EKS upgrade from v1.27 to v1.30 with zero-downtime rolling deployments.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i3', priority: 'High',
    startDate: '2025-06-01', targetEndDate: '2025-12-31', percentComplete: 100,
    stakeholders: 'Platform, All teams', notes: 'All clusters upgraded. 0 incidents.',
    updatedAt: '2026-01-03T08:00:00Z',
  },
  {
    id: 'p52', assignments: [{ memberId: 'm21', allocation: 30 }],
    name: 'Cloud Cost Optimization',
    description: 'Right-sizing, reserved instance strategy, and Spot instance adoption to reduce cloud spend.',
    status: 'Backlog', phase: 'Research', initiativeId: 'i3', priority: 'Medium',
    startDate: '2026-07-01', targetEndDate: '2026-12-31', percentComplete: 10,
    stakeholders: 'Finance, Platform', notes: 'Baseline cost analysis complete. Strategy in draft.',
    updatedAt: '2026-05-01T09:00:00Z',
  },
  // ── m22 – Gray Mitchell ───────────────────────────────────────────────
  {
    id: 'p53', assignments: [
      { memberId: 'm22', part: 'DevOps', allocation: 60, startDate: '2025-11-01', endDate: '2026-06-30' },
      { memberId: 'm23', part: 'QA', allocation: 20, startDate: '2026-02-01', endDate: '2026-06-30' },
    ],
    name: 'CI/CD Pipeline v3',
    description: 'GitOps-based delivery pipeline with automated security scanning and progressive rollouts.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i3', priority: 'High',
    startDate: '2025-11-01', targetEndDate: '2026-06-30', percentComplete: 75,
    stakeholders: 'Engineering', notes: 'GitHub Actions migration 75% complete. ArgoCD integration live.',
    updatedAt: '2026-05-25T10:00:00Z',
  },
  {
    id: 'p54', assignments: [
      { memberId: 'm22', part: 'DevOps', allocation: 50, startDate: '2025-09-15', endDate: '2026-04-30' },
      { memberId: 'm21', part: 'Infrastructure', allocation: 30, startDate: '2025-09-15', endDate: '2026-04-30' },
    ],
    name: 'Infrastructure as Code Migration',
    description: 'Migrate all cloud resources from ClickOps to Terraform-managed IaC.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i3', priority: 'High',
    startDate: '2025-09-15', targetEndDate: '2026-04-30', percentComplete: 85,
    stakeholders: 'Platform', notes: '95% of resources in Terraform. Drift detection enabled.',
    updatedAt: '2026-05-21T13:00:00Z',
  },
  {
    id: 'p55', assignments: [{ memberId: 'm22', allocation: 20 }],
    name: 'Cloud Cost Tagging Framework',
    description: 'Mandatory resource tagging policy with enforcement and chargeback reporting.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i3', priority: 'Low',
    startDate: '2025-07-01', targetEndDate: '2025-11-30', percentComplete: 100,
    stakeholders: 'Finance, Platform', notes: '100% tag compliance across all accounts.',
    updatedAt: '2025-12-10T08:00:00Z',
  },
  // ── m23 – Harper Lee ──────────────────────────────────────────────────
  {
    id: 'p56', assignments: [{ memberId: 'm23', allocation: 25 }],
    name: 'SRE Runbook Automation',
    description: 'Automated remediation runbooks for top 20 recurring production incidents.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i3', priority: 'Medium',
    startDate: '2025-12-01', targetEndDate: '2026-05-31', percentComplete: 70,
    stakeholders: 'Platform, On-call teams', notes: '14 of 20 runbooks automated. 6 in QA.',
    updatedAt: '2026-05-22T10:00:00Z',
  },
  {
    id: 'p57', assignments: [{ memberId: 'm23', allocation: 40 }],
    name: 'Incident Management Platform',
    description: 'PagerDuty + Slack integration with AI-assisted incident triage and postmortems.',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i3', priority: 'High',
    startDate: '2026-05-01', targetEndDate: '2026-11-30', percentComplete: 20,
    stakeholders: 'Platform, Engineering leads', notes: 'Vendor evaluation in progress.',
    updatedAt: '2026-05-10T09:00:00Z',
  },
  // ── m24 – Indigo Taylor (Data Engineering) ────────────────────────────
  {
    id: 'p58', assignments: [
      { memberId: 'm24', part: 'Data', allocation: 40, startDate: '2025-09-01', endDate: '2026-07-31' },
      { memberId: 'm25', part: 'Backend', allocation: 25, startDate: '2025-09-01', endDate: '2026-05-31' },
    ],
    name: 'Data Lake Modernization',
    description: 'Migrate from legacy Hadoop to Databricks lakehouse with Delta Lake format.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i5', priority: 'High',
    startDate: '2025-09-01', targetEndDate: '2026-07-31', percentComplete: 65,
    stakeholders: 'Analytics, Finance', notes: 'Core domains migrated. Retail domain in progress.',
    updatedAt: '2026-05-23T11:00:00Z',
  },
  {
    id: 'p59', assignments: [
      { memberId: 'm24', part: 'Data', allocation: 45, startDate: '2025-11-01', endDate: '2026-05-31' },
      { memberId: 'm25', part: 'Backend', allocation: 30, startDate: '2025-11-01', endDate: '2026-05-31' },
    ],
    name: 'Real-time Analytics Pipeline',
    description: 'Kafka → Flink → Delta Lake pipeline for sub-minute store performance metrics.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i5', priority: 'High',
    startDate: '2025-11-01', targetEndDate: '2026-05-31', percentComplete: 80,
    stakeholders: 'Analytics, Store Ops', notes: 'Pipeline live in UAT. Latency p99 < 45s.',
    updatedAt: '2026-05-26T10:00:00Z',
  },
  {
    id: 'p60', assignments: [{ memberId: 'm24', allocation: 30 }],
    name: 'Data Governance Framework',
    description: 'Data catalog, lineage tracking, and PII classification across all data assets.',
    status: 'Backlog', phase: 'Research', initiativeId: 'i5', priority: 'Medium',
    startDate: '2026-06-01', targetEndDate: '2027-01-31', percentComplete: 15,
    stakeholders: 'Legal, Analytics, Engineering', notes: 'Collibra evaluation underway.',
    updatedAt: '2026-04-28T09:00:00Z',
  },
  // ── m25 – Jules Martin ────────────────────────────────────────────────
  {
    id: 'p61', assignments: [{ memberId: 'm25', allocation: 20 }],
    name: 'Store Performance Dashboard',
    description: 'Executive and store-level dashboard: sales, traffic, conversion, and operational KPIs.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i5', priority: 'Medium',
    startDate: '2025-12-15', targetEndDate: '2026-08-31', percentComplete: 45,
    stakeholders: 'Exec, Store Ops, Finance', notes: 'Sales and traffic widgets live. Ops KPIs in dev.',
    updatedAt: '2026-05-19T10:00:00Z',
  },
  {
    id: 'p62', assignments: [{ memberId: 'm25', allocation: 25 }],
    name: 'Data Quality Monitoring',
    description: 'Automated data quality checks and alerting across all critical data pipelines.',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i5', priority: 'Medium',
    startDate: '2026-07-01', targetEndDate: '2027-01-31', percentComplete: 10,
    stakeholders: 'Analytics, Engineering', notes: 'Great Expectations POC scoped for Q3.',
    updatedAt: '2026-05-03T09:00:00Z',
  },
]

// ─── Intake Requests ──────────────────────────────────────────────────────

const intakeRequests: IntakeRequest[] = [
  {
    id: 'r1',
    requesterName: 'Maria Gonzalez',
    teamOrDomain: 'Store Experience',
    description: 'Scan & Go mobile checkout allowing customers to scan items with their phone and skip the register.',
    businessJustification: 'Reduces checkout wait times by an estimated 35% and improves NPS. Competitors have had this feature for 2+ years.',
    estimatedEffort: 'L',
    priority: 'High',
    requestedByDate: '2026-09-01',
    status: 'Pending Review',
    submittedAt: '2026-05-10T10:00:00Z',
  },
  {
    id: 'r2',
    requesterName: 'David Ng',
    teamOrDomain: 'Associate Experience',
    description: 'AI-powered scheduling assistant that auto-generates optimal associate schedules based on traffic forecasts and labor rules.',
    businessJustification: 'Managers spend 4+ hours/week on scheduling. AI scheduling projected to reduce labor cost by 3% via optimized coverage.',
    estimatedEffort: 'XL',
    priority: 'Medium',
    requestedByDate: '2026-12-01',
    status: 'Approved',
    submittedAt: '2026-04-22T14:00:00Z',
  },
  {
    id: 'r3',
    requesterName: 'Sandra Patel',
    teamOrDomain: 'Inventory & Supply Chain',
    description: 'Computer vision system using existing store cameras to detect shoplifting events in real time.',
    businessJustification: 'Annual shrink cost is $42M. CV detection estimated to reduce ORC-related shrink by 15%.',
    estimatedEffort: 'XL',
    priority: 'Critical',
    requestedByDate: '2026-06-01',
    status: 'Deferred',
    submittedAt: '2026-03-15T09:00:00Z',
  },
  {
    id: 'r4',
    requesterName: 'Tom Baker',
    teamOrDomain: 'Store Experience',
    description: 'Unified cross-channel returns portal allowing customers to initiate returns online and complete them in-store or via mail.',
    businessJustification: 'Current returns process requires customers to call or visit. Unified portal expected to reduce return processing cost by 20%.',
    estimatedEffort: 'L',
    priority: 'High',
    requestedByDate: '2026-10-01',
    status: 'Pending Review',
    submittedAt: '2026-05-20T11:00:00Z',
  },
  {
    id: 'r5',
    requesterName: 'Lisa Huang',
    teamOrDomain: 'Platform & Infrastructure',
    description: 'A centralized supply chain visibility hub giving all teams a single view of inventory, orders, and shipment status.',
    businessJustification: 'Teams currently use 5 different systems. Consolidation estimated to save 10 hrs/week per team in data reconciliation.',
    estimatedEffort: 'XL',
    priority: 'Medium',
    requestedByDate: '2027-03-01',
    status: 'Rejected',
    submittedAt: '2026-02-28T08:00:00Z',
  },
]

// ─── Derive cross-reference arrays ────────────────────────────────────────

function buildState(): PortfolioState {
  // team.memberIds: collect member IDs grouped by teamIds
  const teamMemberMap = new Map<string, string[]>()
  for (const m of rawMembers) {
    for (const tid of m.teamIds) {
      const arr = teamMemberMap.get(tid) ?? []
      arr.push(m.id)
      teamMemberMap.set(tid, arr)
    }
  }
  const teams: Team[] = rawTeams.map(t => ({
    ...t,
    memberIds: teamMemberMap.get(t.id) ?? [],
  }))

  // member.projectIds: collect project IDs grouped by memberId
  const memberProjectMap = new Map<string, string[]>()
  for (const p of projects) {
    for (const a of p.assignments) {
      const arr = memberProjectMap.get(a.memberId) ?? []
      arr.push(p.id)
      memberProjectMap.set(a.memberId, arr)
    }
  }
  const members: Member[] = rawMembers.map(m => ({
    ...m,
    projectIds: memberProjectMap.get(m.id) ?? [],
  }))

  return { domains, teams, members, projects, initiatives, intakeRequests, escalations: [], ptoBlocks: [], resourceRates: [] }
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Call once at app startup. If no persisted state exists, builds the seed
 * dataset and passes it to the store's hydrate action.
 */
export function seedIfEmpty(hydrate: (state: PortfolioState) => void): void {
  if (loadState() !== null) return          // already seeded — do nothing
  hydrate(buildState())
}
