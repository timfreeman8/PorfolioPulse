/**
 * Seed data — real SAT organization data.
 *
 * Source: org-roster-2026-06-04.csv (imported June 2026).
 * Previous fictitious dataset is archived in: seedData.archive.ts.
 *
 * Structure:
 *   - 9 domains (8 functional + SAT Leadership)
 *   - 35 teams (34 functional + Store Technology Leadership)
 *   - 136 members sourced from org-roster-2026-06-04.csv (June 2026)
 *   - 29 representative projects — use Jira import or add via UI for real project data
 *   - 5 strategic initiatives covering the main SAT program areas
 *   - 5 sample intake requests representative of real SAT work requests
 *
 * Reporting chain (top-down):
 *   James Clendenen (CIO, not in roster)
 *     └── Ryan Schreier (Sr Store & Associate Technology Director)
 *           ├── Brandon Wells  → Labor & Shrink Technology (d5): AP, Compliance,
 *           │                    Labor & Productivity; also Architecture
 *           ├── Megan Clarke  → Store Ops Technology (d4): FAST, Warrior Squad, DSL,
 *           │                    Inventorious, DSD, Freddy Kroger, Little Einsteins,
 *           │                    Interface, Code Busters
 *           ├── Stephen Lay    → DevSecOps (d11): SAT DevSecOps, SAT Support
 *           ├── Sam Saleh  → Core Services (d1)
 *           ├── Priya Anand → QAOps (d10)
 *           └── Mike Silver → Seamless AX (d2), Alt Profit/KPF (d3)
 */

import { loadState } from '@/lib/persistence'
import { legacyToPhases } from '@/lib/projectBuilder'
import type {
  Domain,
  Initiative,
  IntakeRequest,
  Member,
  PortfolioState,
  Project,
  ProjectPhaseStep,
  PtoBlock,
  ResourceRate,
  Team,
  WeeklyPulse,
} from '@/types'

// ─── Domains ──────────────────────────────────────────────────────────────
// One domain per unique "SAT Domain" value from the CSV, plus an Architecture
// domain for the Solutions Architects whose manager position was listed as OPEN.

const domains: Domain[] = [
  {
    id: 'd1',
    name: 'Core Services',
    description: 'Platform engineering, data engineering, and foundational services for the SAT ecosystem.',
    owner: 'Sam Saleh',
  },
  {
    id: 'd2',
    name: 'Seamless AX',
    description: 'Associate experience products: IRIS, Cookie Monster, Little Bird, Blade Runners, HomeBase, and shared platform services.',
    owner: 'Mike Silver',
  },
  {
    id: 'd3',
    name: 'Alt Profit (KPF)',
    description: 'Alternative profit technology: Kroger Personal Finance credit card, gift cards, and money services.',
    owner: 'Michael Holland',
  },
  {
    id: 'd4',
    name: 'Store Ops Technology',
    description: 'Store operations technology: FAST, Warrior Squad, inventory cycle count, DSD, ordering, price execution, and digital shelf labels.',
    owner: 'Megan Clarke',
  },
  {
    id: 'd5',
    name: 'Labor & Shrink Technology',
    description: 'Labor and shrink technology: accounts payable, compliance, and labor productivity systems.',
    owner: 'Brandon Wells',
  },
  {
    id: 'd10',
    name: 'QAOps',
    description: 'Quality engineering and test operations across all SAT product teams.',
    owner: 'Priya Anand',
  },
  {
    id: 'd11',
    name: 'DevSecOps',
    description: 'Security-first developer operations: CI/CD pipelines, security tooling, platform DevOps, and production support.',
    owner: 'Stephen Lay',
  },
  {
    id: 'd16',
    name: 'Architecture',
    description: 'Enterprise and solutions architecture across the full SAT portfolio.',
    owner: 'Brandon Wells',
  },
  {
    id: 'd17',
    name: 'SAT Leadership',
    description: 'Store technology executive and director leadership reporting to the CIO.',
    owner: 'Ryan Schreier',
  },
]

// ─── Initiatives ──────────────────────────────────────────────────────────

const initiatives: Initiative[] = [
  {
    id: 'i1',
    name: 'Seamless AX Platform Evolution',
    description: 'Modernize and expand associate experience products including IRIS, Cookie Monster, Little Bird, and HomeBase.',
    targetQuarter: 'Q4 2026',
    status: 'Active',
  },
  {
    id: 'i2',
    name: 'Store Ops Modernization',
    description: 'Transform store operations technology across production, ordering, and inventory management.',
    targetQuarter: 'Q3 2026',
    status: 'Active',
  },
  {
    id: 'i3',
    name: 'SAT Quality & Reliability',
    description: 'Elevate quality engineering practices and DevSecOps capabilities across the SAT portfolio.',
    targetQuarter: 'Q2 2026',
    status: 'Active',
  },
  {
    id: 'i4',
    name: 'Financial Systems Transformation',
    description: 'Modernize AP, compliance, and KPF financial technology platforms.',
    targetQuarter: 'Q1 2027',
    status: 'Planning',
  },
  {
    id: 'i5',
    name: 'SAT Data & Core Services',
    description: 'Build foundational data pipelines, core APIs, and platform services for the SAT ecosystem.',
    targetQuarter: 'Q3 2026',
    status: 'Active',
  },

  // ── FY2025 completed initiatives — historical context for year-over-year comparison ──
  {
    id: 'i6',
    name: 'FY2025 Associate Experience Foundation',
    description: 'First-generation DEX products: IRIS v1 mobile overhaul, Cookie Monster v2, and the HomeBase team collaboration hub. All shipped FY2025.',
    targetQuarter: 'Q4 FY2025',
    status: 'Complete',
  },
  {
    id: 'i7',
    name: 'FY2025 Platform & Security Hardening',
    description: 'CI/CD foundation, unified authentication service, and observability baseline rolled out across all SAT product teams in FY2025.',
    targetQuarter: 'Q3 FY2025',
    status: 'Complete',
  },

  // ── FY2027 planning initiatives — future roadmap items ────────────────────
  {
    id: 'i8',
    name: 'Next-Gen Store Intelligence',
    description: 'AI/ML-powered store analytics: predictive labor, smart inventory replenishment, and a unified real-time store intelligence dashboard. Planned for FY2027.',
    targetQuarter: 'Q3 FY2027',
    status: 'Planning',
  },
  {
    id: 'i9',
    name: 'Associate Platform 3.0',
    description: 'Convergence of IRIS, Cookie Monster, and HomeBase into a single unified associate platform with personalized workspaces. Planned for FY2027.',
    targetQuarter: 'Q4 FY2027',
    status: 'Planning',
  },
]

// ─── Resource Rates ───────────────────────────────────────────────────────
// Annual salary benchmarks for roles that appear in the seed member data.
// These are round-number approximations used to power portfolio cost analytics.
// All roles are salaried — costs are fixed regardless of project utilization.

const resourceRates: ResourceRate[] = [
  // ── Engineering ICs ───────────────────────────────────────────────────
  { role: 'Software Engineer',                          annualRate: 120000 },
  { role: 'Sr Software Engineer',                       annualRate: 150000 },
  { role: 'Advanced Software Engineer',                 annualRate: 155000 },
  { role: 'Sr Advanced Software Engineer',              annualRate: 165000 },
  // ── Engineering Managers ──────────────────────────────────────────────
  { role: 'Advanced Software Engineering Manager',      annualRate: 170000 },
  { role: 'Sr Software Engineering Manager',            annualRate: 180000 },
  { role: 'Senior Advanced Software Engineering Manager', annualRate: 190000 },
  // ── Product ───────────────────────────────────────────────────────────
  { role: 'Product Manager',                            annualRate: 120000 },
  { role: 'Senior Product Manager',                     annualRate: 140000 },
  { role: 'Product Management Group Manager',           annualRate: 160000 },
  // ── Design ────────────────────────────────────────────────────────────
  { role: 'Product Designer',                           annualRate: 110000 },
  { role: 'Senior Product Designer',                    annualRate: 130000 },
  { role: 'Associate Product Designer',                 annualRate: 90000  },
  { role: 'Sr Product Designer Manager',                annualRate: 150000 },
  // ── Data ──────────────────────────────────────────────────────────────
  { role: 'Data Engineer',                              annualRate: 125000 },
  { role: 'Advanced Data Engineer',                     annualRate: 145000 },
  { role: 'Sr Advanced Data Engineering Manager',       annualRate: 185000 },
  // ── SRE / DevOps ──────────────────────────────────────────────────────
  { role: 'Site Reliability & Devops Engineer',         annualRate: 130000 },
  { role: 'Senior Site Reliability/Devops Engineer',    annualRate: 150000 },
  { role: 'Advanced Site Reliability/Devops Engineer',  annualRate: 160000 },
  { role: 'Release Manager',                            annualRate: 115000 },
  // ── Quality ───────────────────────────────────────────────────────────
  { role: 'Quality Engineer',                           annualRate: 110000 },
  { role: 'Senior Quality Engineer',                    annualRate: 130000 },
  { role: 'Advanced Quality Engineer',                  annualRate: 145000 },
  { role: 'Advanced QA Manager',                        annualRate: 155000 },
  // ── Support / Analysts ────────────────────────────────────────────────
  { role: 'Application Systems Analyst',                annualRate: 100000 },
  { role: 'Senior Application Systems Analyst',         annualRate: 115000 },
  { role: 'Associate Application Systems Analyst',      annualRate: 85000  },
  // ── Architecture ──────────────────────────────────────────────────────
  { role: 'Advanced Solutions Architect',               annualRate: 160000 },
  { role: 'Senior Advanced Solutions Architect',        annualRate: 175000 },
  // ── Leadership ────────────────────────────────────────────────────────
  { role: 'Labor & Shrink Technology Director',         annualRate: 210000 },
  { role: 'Store Ops Technology Director',              annualRate: 210000 },
  { role: 'Sr Store & Associate Technology Director',   annualRate: 230000 },
]

// ─── Teams ────────────────────────────────────────────────────────────────
// One team per unique "Product Team" value, grouped under its domain.
// memberIds are computed below from the members list.

const rawTeams: Omit<Team, 'memberIds'>[] = [
  // ── Core Services (d1) ─────────────────────────────────────────────
  { id: 't1',  domainId: 'd1', name: 'SpaceForce',       description: 'Core platform engineering team building foundational SAT services.',                          techLead: 'Charles Kirk' },
  { id: 't2',  domainId: 'd1', name: 'RedBull',           description: 'Core services integration and advanced engineering.',                                         techLead: 'Manish Kumar' },
  { id: 't3',  domainId: 'd1', name: 'SAT-Data',          description: 'Data engineering and product management for SAT data platforms.',                             techLead: 'David Ross' },
  // ── Seamless AX (d2) ───────────────────────────────────────────────
  { id: 't4',  domainId: 'd2', name: 'IRIS',              description: 'Increasing revenue through intelligent selling.',                                              techLead: 'Gayathri Depuru' },
  { id: 't5',  domainId: 'd2', name: 'Cookie Monster',    description: 'Associate Performance, Search, Our Service Guarantee',                                        techLead: 'Ethan Duncan' },
  { id: 't6',  domainId: 'd2', name: 'Little Bird',       description: 'Digital shelf label and Little Bird platform engineering.',                                    techLead: 'Drew Winters' },
  { id: 't7',  domainId: 'd2', name: 'Blade Runners',     description: 'Backend API and middleware engineering for Seamless AX services.',                            techLead: 'Veera Madine' },
  { id: 't8',  domainId: 'd2', name: 'HomeBase',          description: 'HomeBase associate scheduling and management platform.',                                       techLead: 'Samuel Powell' },
  { id: 't9',  domainId: 'd2', name: 'Data Goblins',      description: 'Metrics that matter (MTM) and MAGIC applications.',                                           techLead: 'Dakota Kelsey' },
  { id: 't10', domainId: 'd2', name: 'QuickSales',        description: 'Executive sales reporting.',                                                                   techLead: 'Ramya Gajula' },
  // t11 KPF Product dissolved — PMs distributed to Credit Card, Gift Cards, Money Services teams
  { id: 't12', domainId: 'd2', name: 'Seamless AX Leadership', description: 'Engineering, design and product leadership for the Seamless AX domain.',                techLead: 'Mark Vance' },
  { id: 't39', domainId: 'd2', name: 'In Store Communications', description: 'In-store communications technology and associate-facing notification systems.',         techLead: 'Chris Upton' },
  // ── Alt Profit / KPF (d3) ──────────────────────────────────────────
  { id: 't13', domainId: 'd3', name: 'Credit Card',       description: 'Kroger Personal Finance credit card technology and customer-facing experiences.',             techLead: 'Nina Daniels' },
  { id: 't14', domainId: 'd3', name: 'Gift Cards',        description: 'Gift card program technology and system integrations.',                                        techLead: 'Christopher Reed' },
  { id: 't15', domainId: 'd3', name: 'Money Services',    description: 'Money services and financial products technology.',                                            techLead: 'Emma Garrett' },
  // ── Store Ops Technology (d4) ──────────────────────────────────────
  // t16 Codebusters and t17 Store Ops Projects dissolved; designer (m44/m45) reassigned
  { id: 't19', domainId: 'd4', name: 'FAST',              description: 'FAST production efficiency and labor forecasting systems.',                                    techLead: 'Rosa Garcia' },
  { id: 't20', domainId: 'd4', name: 'DSL',               description: 'Digital Shelf Labels — in-store price execution and label management systems.',               techLead: 'Brian Bishop' },
  { id: 't21', domainId: 'd4', name: 'Inventorious',      description: 'Inventorious inventory cycle-count and accuracy platform.',                                    techLead: 'Chris Jordan' },
  { id: 't22', domainId: 'd4', name: 'DSD',               description: 'Direct Store Delivery receiving and vendor management systems.',                               techLead: 'Rajan Mohan' },
  { id: 't25', domainId: 'd4', name: 'Freddy Kroger',     description: 'Freddy Kroger production management and store operations platform.',                          techLead: 'Ryan Ware' },
  { id: 't27', domainId: 'd4', name: 'Little Einsteins',  description: 'Intelligent demand-driven ordering and automated replenishment.',                              techLead: 'Thomas Pell' },
  { id: 't28', domainId: 'd4', name: 'Interface',         description: 'Vendor interface and ordering system integrations.',                                           techLead: 'Rajiv Nair' },
  { id: 't29', domainId: 'd4', name: 'Code Busters',      description: 'Order management, code compliance, and ordering workflow systems.',                            techLead: 'Praj Sharma' },
  { id: 't23', domainId: 'd4', name: 'Warrior Squad',     description: 'Production planning and deli/bakery operational technology.',                                  techLead: 'Sirisha Yarla' },
  { id: 't40', domainId: 'd4', name: 'Store Ops Technology Leadership', description: 'Store Ops Technology director and design leadership.',                           techLead: 'Megan Clarke' },
  // ── Labor & Shrink Technology (d5) ─────────────────────────────────
  // t18 Inventorious (d5 design) dissolved; designer (m46) reassigned to t21.
  // t24 FAST and t26 Boat dissolved into t19 FAST (Store Ops d4).
  { id: 't34', domainId: 'd5', name: 'AP',               description: 'Accounts payable automation and financial systems.',                                            techLead: 'Adrian Cole' },
  { id: 't35', domainId: 'd5', name: 'Compliance',        description: 'Regulatory compliance technology, audit systems, reporting, SPA and Recalls applications.',   techLead: 'Sandeep Singh' },
  { id: 't36', domainId: 'd5', name: 'Labor & Productivity', description: 'Labor scheduling, productivity tracking, and workforce management.',                       techLead: 'Kurt Benson' },
  { id: 't41', domainId: 'd5', name: 'Labor & Shrink Technology Leadership', description: 'Labor & Shrink Technology director and design leadership.',                 techLead: 'Brandon Wells' },
  // ── QAOps (d10) ────────────────────────────────────────────────────
  { id: 't30', domainId: 'd10', name: 'DEX SWAT',         description: 'Digital experience SWAT team for rapid quality response across SAT products.',                techLead: 'Mo Irfan' },
  { id: 't31', domainId: 'd10', name: 'DEX QAOps Mavericks', description: 'DEX quality operations and test automation excellence.',                                   techLead: 'Deepak Pillai' },
  // ── DevSecOps (d11) ────────────────────────────────────────────────
  { id: 't32', domainId: 'd11', name: 'SAT DevSecOps',    description: 'Security-first DevOps: CI/CD pipelines, vulnerability scanning, and platform security.',     techLead: 'Justin Parker' },
  { id: 't33', domainId: 'd11', name: 'SAT Support',      description: 'Level 3 technical support for all SAT production systems.',                                   techLead: 'Troy Cooper' },
  // ── Architecture (d16) ─────────────────────────────────────────────
  { id: 't37', domainId: 'd16', name: 'Architecture',     description: 'Enterprise solutions architecture and technical strategy across the SAT portfolio.',           techLead: 'Jonathan Frank' },
  // ── SAT Leadership (d17) ───────────────────────────────────────────
  { id: 't38', domainId: 'd17', name: 'Store Technology Leadership', description: 'Portfolio lead and L5 directors spanning all SAT domains.',                        techLead: 'Ryan Schreier' },
]

// ─── Members ──────────────────────────────────────────────────────────────
// Source: SAT-Seed-Data.csv. All non-OPEN rows included.
// capacity defaults to 80 (no capacity data in the CSV; managers are set lower).
// projectIds are computed below from the projects list.

const rawMembers: Omit<Member, 'projectIds'>[] = [
  // ── Core Services — SpaceForce (t1) ────────────────────────────────
  { id: 'm1',  teamIds: ['t1'],  name: 'Swati Chinta',           role: 'Sr Software Engineer',                  reportsTo: 'Sam Saleh',           capacity: 80, avatarInitials: 'SC' },
  { id: 'm2',  teamIds: ['t1'],  name: 'Meena Ganesh',         role: 'Sr Software Engineer',                  reportsTo: 'Sam Saleh',           capacity: 80, avatarInitials: 'MG' },
  { id: 'm3',  teamIds: ['t1'],  name: 'Charles Kirk',             role: 'Sr Advanced Software Engineer',         reportsTo: 'Sam Saleh',           capacity: 85, avatarInitials: 'CK' },
  { id: 'm4',  teamIds: ['t1'],  name: 'Venkat Sai',              role: 'Advanced Site Reliability/Devops Engineer', reportsTo: 'Sam Saleh',        capacity: 80, avatarInitials: 'VS' },
  { id: 'm5',  teamIds: ['t1'],  name: 'Rio Marques',               role: 'Sr Software Engineer',                  reportsTo: 'Sam Saleh',           capacity: 80, avatarInitials: 'RM' },
  // ── Core Services — RedBull (t2) ───────────────────────────────────
  { id: 'm6',  teamIds: ['t2'],  name: 'Vijay Goudi',              role: 'Sr Software Engineer',                  reportsTo: 'Sam Saleh',           capacity: 80, avatarInitials: 'VG' },
  { id: 'm7',  teamIds: ['t2'],  name: 'Rohit Kadam',                role: 'Sr Software Engineer',                  reportsTo: 'Sam Saleh',           capacity: 80, avatarInitials: 'RK' },
  { id: 'm8',  teamIds: ['t2'],  name: 'Manish Kumar',                   role: 'Advanced Software Engineer',            reportsTo: 'Sam Saleh',           capacity: 80, avatarInitials: 'MK' },
  // ── Core Services — SAT-Data (t3) ──────────────────────────────────
  { id: 'm9',  teamIds: ['t3'],  name: 'Nathan Moore',           role: 'Data Engineer',                         reportsTo: 'Sam Saleh',           capacity: 80, avatarInitials: 'NM' },
  { id: 'm11', teamIds: ['t3'],  name: 'David Ross',                  role: 'Advanced Data Engineer',                reportsTo: 'Sam Saleh',           capacity: 85, avatarInitials: 'DR' },
  // ── Seamless AX — IRIS (t4) ────────────────────────────────────────
  { id: 'm12', teamIds: ['t4'],  name: 'Gayathri Depuru',            role: 'Sr Software Engineer',                  reportsTo: 'Sanjay Penmet', capacity: 80, avatarInitials: 'GD' },
  { id: 'm13', teamIds: ['t4'],  name: 'John Monroe',                  role: 'Senior Site Reliability/Devops Engineer', reportsTo: 'Sanjay Penmet', capacity: 80, avatarInitials: 'JM' },
  { id: 'm14', teamIds: ['t4'],  name: 'Raj Murthy',          role: 'Sr Software Engineer',                  reportsTo: 'Sanjay Penmet', capacity: 80, avatarInitials: 'RM' },
  { id: 'm15', teamIds: ['t4'],  name: 'Arjun Mehta',               role: 'Advanced Software Engineer',            reportsTo: 'Sanjay Penmet', capacity: 80, avatarInitials: 'AM' },
  { id: 'm16', teamIds: ['t4'],  name: 'Bhavna Iyer',              role: 'Senior Quality Engineer',               reportsTo: 'Sanjay Penmet', capacity: 80, avatarInitials: 'BI' },
  { id: 'm17', teamIds: ['t4'],  name: 'Mary Pierce',           role: 'Senior Product Manager',                reportsTo: 'Mike Silver',          capacity: 75, avatarInitials: 'MP' },
  { id: 'm19', teamIds: ['t4'],  name: 'David Henson',                role: 'Product Designer',                      reportsTo: 'Tyler Freeman',         capacity: 80, avatarInitials: 'DH' },
  // ── Seamless AX — In Store Communications (t39) ────────────────────
  { id: 'm18', teamIds: ['t39'], name: 'Chris Upton',                     role: 'Senior Product Manager',                reportsTo: 'Mike Silver',          capacity: 75, avatarInitials: 'CU' },
  // ── Seamless AX — Cookie Monster (t5) ──────────────────────────────
  { id: 'm20', teamIds: ['t5'],  name: 'Samuel Bryant',                 role: 'Senior Product Manager',                reportsTo: 'Mike Silver',          capacity: 75, avatarInitials: 'SB' },
  { id: 'm21', teamIds: ['t5'],  name: 'Ethan Duncan',                  role: 'Sr Software Engineer',                  reportsTo: 'Mark Vance',          capacity: 80, avatarInitials: 'ED' },
  { id: 'm23', teamIds: ['t5', 't8'],  name: 'Taylor Rose',              role: 'Senior Product Designer',               reportsTo: 'Tyler Freeman',         capacity: 80, avatarInitials: 'TR' },
  { id: 'm24', teamIds: ['t35'], name: 'Sydney Baker',           role: 'Product Designer',                      reportsTo: 'Tyler Freeman',         capacity: 80, avatarInitials: 'SB' },
  // ── Seamless AX — Little Bird (t6) ─────────────────────────────────
  { id: 'm25', teamIds: ['t6'],  name: 'Jordan Bradley',                  role: 'Sr Software Engineer',                  reportsTo: 'Mark Vance',          capacity: 80, avatarInitials: 'JB' },
  { id: 'm26', teamIds: ['t6'],  name: 'Drew Winters',                role: 'Advanced Software Engineer',            reportsTo: 'Mark Vance',          capacity: 85, avatarInitials: 'DW' },
  { id: 'm27', teamIds: ['t6', 't20'], name: 'Ryan Holloway',           role: 'Product Designer',                      reportsTo: 'Tyler Freeman',         capacity: 80, avatarInitials: 'RH' },
  // ── Seamless AX — Blade Runners (t7) ───────────────────────────────
  { id: 'm28', teamIds: ['t7'],  name: 'Veera Madine',            role: 'Sr Software Engineer',                  reportsTo: 'Mark Vance',          capacity: 80, avatarInitials: 'VM' },
  { id: 'm29', teamIds: ['t7'],  name: 'Michael Ortiz',                role: 'Software Engineer',                     reportsTo: 'Mark Vance',          capacity: 80, avatarInitials: 'MO' },
  // ── Seamless AX — HomeBase (t8) ────────────────────────────────────
  { id: 'm30', teamIds: ['t6', 't7', 't8'], name: 'Samuel Powell',       role: 'Senior Product Manager',                reportsTo: 'Mike Silver',          capacity: 75, avatarInitials: 'SP' },
  // ── Seamless AX — Data Goblins (t9) ────────────────────────────────
  { id: 'm31', teamIds: ['t9'],  name: 'Dakota Kelsey',              role: 'Software Engineer',                     reportsTo: 'Sanjay Penmet', capacity: 80, avatarInitials: 'DK' },
  // ── Seamless AX — QuickSales (t10) ─────────────────────────────────
  { id: 'm32', teamIds: ['t10'], name: 'Ramya Gajula',      role: 'Sr Software Engineer',                  reportsTo: 'Sanjay Penmet', capacity: 80, avatarInitials: 'RG' },
  // ── Alt Profit / KPF — PMs distributed to their product teams ──────
  { id: 'm33', teamIds: ['t13'], name: 'Nina Daniels',           role: 'Product Manager',                       reportsTo: 'Michael Holland',          capacity: 75, avatarInitials: 'ND' },
  { id: 'm34', teamIds: ['t15'], name: 'Emma Garrett',             role: 'Senior Product Manager',                reportsTo: 'Michael Holland',          capacity: 75, avatarInitials: 'EG' },
  { id: 'm35', teamIds: ['t14'], name: 'Sharon Davis',                  role: 'Senior Product Manager',                reportsTo: 'Michael Holland',          capacity: 75, avatarInitials: 'SD' },
  // ── Seamless AX — Platform / Managers (t12) ────────────────────────
  { id: 'm36', teamIds: ['t33'], name: 'Mason Murphy',                role: 'Site Reliability & Devops Engineer',    reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'MM' },
  { id: 'm37', teamIds: ['t12', 't40', 't41'], name: 'Tyler Freeman', role: 'Sr Product Designer Manager',           reportsTo: 'Mike Silver',          capacity: 70, avatarInitials: 'TF' },
  { id: 'm38', teamIds: ['t12'], name: 'Michael Holland',                role: 'Product Management Group Manager',      reportsTo: 'Mike Silver',          capacity: 70, avatarInitials: 'MH' },
  { id: 'm39', teamIds: ['t12'], name: 'Sanjay Penmet',       role: 'Advanced Software Engineering Manager', reportsTo: 'Mike Silver',          capacity: 70, avatarInitials: 'SP' },
  { id: 'm40', teamIds: ['t12'], name: 'Mark Vance',                role: 'Senior Advanced Software Engineering Manager', reportsTo: 'Mike Silver',  capacity: 65, avatarInitials: 'MV' },
  // ── Seamless AX — Cookie Monster (t5) — Jin Liu ─────────────────
  { id: 'm140', teamIds: ['t5'],  name: 'Jin Liu',                    role: 'Advanced Software Engineer',            reportsTo: 'Mark Vance',          capacity: 80, avatarInitials: 'JL' },
  // ── Seamless AX — Cookie Monster (t5) additions ───────────────────
  { id: 'm41', teamIds: ['t5'],  name: 'Isabelle Renard',             role: 'Associate Product Designer',            reportsTo: 'Tyler Freeman',         capacity: 80, avatarInitials: 'IR' },
  // ── KPF — Gift Cards (t14) ─────────────────────────────────────────
  { id: 'm42', teamIds: ['t14'], name: 'Christopher Reed',          role: 'Senior Product Designer',               reportsTo: 'Tyler Freeman',         capacity: 80, avatarInitials: 'CR' },
  // ── Labor & Shrink Technology — Compliance (t35) additions ─────────
  { id: 'm43', teamIds: ['t35'], name: 'Ryan Rooney',                  role: 'Product Designer',                      reportsTo: 'Tyler Freeman',         capacity: 80, avatarInitials: 'RR' },
  // ── Store Ops Technology — Code Busters (t29) ─────────────────────
  { id: 'm44', teamIds: ['t29'], name: 'Dana Powell',                    role: 'Product Designer',                      reportsTo: 'Tyler Freeman',         capacity: 80, avatarInitials: 'DP' },
  // ── Store Ops Technology — Freddy Kroger (t25) ─────────────────────
  { id: 'm45', teamIds: ['t25'], name: 'Kayla Long',                  role: 'Senior Product Designer',               reportsTo: 'Tyler Freeman',         capacity: 80, avatarInitials: 'KL' },
  // ── Store Ops Technology — Inventorious (t21) ──────────────────────
  { id: 'm46', teamIds: ['t21'], name: 'Tarun Kulkarni',                role: 'Senior Product Designer',               reportsTo: 'Tyler Freeman',         capacity: 80, avatarInitials: 'TK' },
  // ── Labor & Shrink Technology — FAST (t19) ─────────────────────────
  { id: 'm47', teamIds: ['t19'], name: 'Aaron Olson',                    role: 'Senior Product Designer',               reportsTo: 'Tyler Freeman',         capacity: 80, avatarInitials: 'AO' },
  // ── Price Execution — ISA (t20) ────────────────────────────────────
  { id: 'm48', teamIds: ['t20'], name: 'Kevin Lane',                  role: 'Associate Application Systems Analyst', reportsTo: 'Brian Bishop',         capacity: 80, avatarInitials: 'KL' },
  { id: 'm49', teamIds: ['t20'], name: 'Michael Provost',            role: 'Senior Application Systems Analyst',    reportsTo: 'Brian Bishop',         capacity: 80, avatarInitials: 'MP' },
  { id: 'm50', teamIds: ['t20'], name: 'Jeffrey Stone',               role: 'Senior Application Systems Analyst',    reportsTo: 'Brian Bishop',         capacity: 80, avatarInitials: 'JS' },
  { id: 'm51', teamIds: ['t20'], name: 'Jonathan Simms',                 role: 'Senior Application Systems Analyst',    reportsTo: 'Brian Bishop',         capacity: 80, avatarInitials: 'JS' },
  { id: 'm52', teamIds: ['t20'], name: 'Jacob Wolf',                   role: 'Software Engineer',                     reportsTo: 'Brian Bishop',         capacity: 80, avatarInitials: 'JW' },
  { id: 'm53', teamIds: ['t20'], name: 'Claire Foster',                  role: 'Senior Product Manager',                reportsTo: 'Megan Clarke',           capacity: 75, avatarInitials: 'CF' },
  { id: 'm54', teamIds: ['t20', 't40'], name: 'Brian Bishop',         role: 'Sr Software Engineering Manager',       reportsTo: 'Megan Clarke',           capacity: 70, avatarInitials: 'BB' },
  // ── Inventory — Inventorious (t21) ─────────────────────────────────
  { id: 'm55', teamIds: ['t21'], name: 'Chris Jordan',                 role: 'Advanced Software Engineer',            reportsTo: 'Robert Carson',          capacity: 85, avatarInitials: 'CJ' },
  { id: 'm56', teamIds: ['t21'], name: 'Sai Nandan',       role: 'Advanced Software Engineer',            reportsTo: 'Robert Carson',          capacity: 85, avatarInitials: 'SN' },
  { id: 'm57', teamIds: ['t21'], name: 'Travis Osborne',                role: 'Software Engineer',                     reportsTo: 'Robert Carson',          capacity: 80, avatarInitials: 'TO' },
  { id: 'm58', teamIds: ['t21'], name: 'Paula Thornton',                role: 'Advanced Software Engineer',            reportsTo: 'Robert Carson',          capacity: 85, avatarInitials: 'PT' },
  { id: 'm59', teamIds: ['t21', 't22', 't40'], name: 'Robert Carson',   role: 'Advanced Software Engineering Manager', reportsTo: 'Megan Clarke',           capacity: 70, avatarInitials: 'RC' },
  { id: 'm60', teamIds: ['t21'], name: 'Saran Jaya',            role: 'Senior Product Manager',                reportsTo: 'Brandon Wells',           capacity: 75, avatarInitials: 'SJ' },
  // ── Inventory — DSD (t22) ──────────────────────────────────────────
  { id: 'm61', teamIds: ['t22'], name: 'Alex Diotte',                 role: 'Senior Application Systems Analyst',    reportsTo: 'Robert Carson',          capacity: 80, avatarInitials: 'AD' },
  { id: 'm62', teamIds: ['t22'], name: 'Rajan Mohan',                role: 'Advanced Software Engineer',            reportsTo: 'Robert Carson',          capacity: 85, avatarInitials: 'RM' },
  { id: 'm63', teamIds: ['t22'], name: 'Andrew Porter',           role: 'Senior Site Reliability/Devops Engineer', reportsTo: 'Robert Carson',       capacity: 80, avatarInitials: 'AP' },
  { id: 'm64', teamIds: ['t22'], name: 'Erik Rhodes',                  role: 'Application Systems Analyst',           reportsTo: 'Robert Carson',          capacity: 80, avatarInitials: 'ER' },
  // ── Production — Warrior Squad (t23) ───────────────────────────────
  { id: 'm65', teamIds: ['t23'], name: 'Jason Cruz',                    role: 'Software Engineer',                     reportsTo: 'Rosa Garcia',             capacity: 80, avatarInitials: 'JC' },
  { id: 'm66', teamIds: ['t23'], name: 'Sirisha Yarla',           role: 'Sr Software Engineer',                  reportsTo: 'Rosa Garcia',             capacity: 80, avatarInitials: 'SY' },
  { id: 'm67', teamIds: ['t19', 't23', 't25', 't40'], name: 'Rosa Garcia', role: 'Senior Advanced Software Engineering Manager', reportsTo: 'Megan Clarke', capacity: 70, avatarInitials: 'RG' },
  // ── Store Ops Technology — FAST (t19) — former t24/t26 members ─────
  { id: 'm68', teamIds: ['t19'], name: 'Amara Jackson',                role: 'Software Engineer',                     reportsTo: 'Rosa Garcia',             capacity: 80, avatarInitials: 'AJ' },
  { id: 'm69', teamIds: ['t19'], name: 'Daniel Park',                 role: 'Advanced Software Engineer',            reportsTo: 'Rosa Garcia',             capacity: 85, avatarInitials: 'DP' },
  { id: 'm70', teamIds: ['t19'], name: 'Kavya Sharma',             role: 'Advanced Quality Engineer',             reportsTo: 'Rosa Garcia',             capacity: 80, avatarInitials: 'KS' },
  { id: 'm74', teamIds: ['t19'], name: 'Nicholas Moss',                role: 'Sr Software Engineer',                  reportsTo: 'Rosa Garcia',             capacity: 80, avatarInitials: 'NM' },
  // ── Store Ops Technology — Freddy Kroger (t25) ─────────────────────
  { id: 'm71', teamIds: ['t25'], name: 'Rohit Kaveri',                 role: 'Sr Software Engineer',                  reportsTo: 'Rosa Garcia',             capacity: 80, avatarInitials: 'RK' },
  { id: 'm72', teamIds: ['t25'], name: 'Ryan Ware',                     role: 'Advanced Software Engineer',            reportsTo: 'Rosa Garcia',             capacity: 85, avatarInitials: 'RW' },
  { id: 'm73', teamIds: ['t25'], name: 'Sarah Proctor',                 role: 'Senior Product Manager',                reportsTo: 'Megan Clarke',           capacity: 75, avatarInitials: 'SP' },
  // ── Ordering — Little Einsteins (t27) ──────────────────────────────
  { id: 'm75', teamIds: ['t27'], name: 'Douglas Manning',            role: 'Software Engineer',                     reportsTo: 'Michelle Trask',        capacity: 80, avatarInitials: 'DM' },
  { id: 'm76', teamIds: ['t28'], name: 'Thomas Pell',                role: 'Advanced Software Engineer',            reportsTo: 'Michelle Trask',        capacity: 85, avatarInitials: 'TP' },
  { id: 'm77', teamIds: ['t27'], name: 'Thomas Toll',                  role: 'Software Engineer',                     reportsTo: 'Michelle Trask',        capacity: 80, avatarInitials: 'TT' },
  { id: 'm78', teamIds: ['t27', 't28', 't29', 't40'], name: 'Michelle Trask', role: 'Advanced Software Engineering Manager', reportsTo: 'Megan Clarke',    capacity: 70, avatarInitials: 'MT' },
  // ── Ordering — Interface (t28) ─────────────────────────────────────
  { id: 'm79', teamIds: ['t28'], name: 'Rajiv Nair',                    role: 'Sr Software Engineer',                  reportsTo: 'Michelle Trask',        capacity: 80, avatarInitials: 'RN' },
  { id: 'm80', teamIds: ['t28'], name: 'Sara Sizemore',                role: 'Sr Software Engineer',                  reportsTo: 'Michelle Trask',        capacity: 80, avatarInitials: 'SS' },
  { id: 'm81', teamIds: ['t19'], name: 'Michael Parks',           role: 'Senior Product Manager',                reportsTo: 'Megan Clarke',           capacity: 75, avatarInitials: 'MP' },
  // ── Ordering — Code Busters (t29) ──────────────────────────────────
  { id: 'm82', teamIds: ['t29'], name: 'Connor Hayes',                  role: 'Senior Application Systems Analyst',    reportsTo: 'Michelle Trask',        capacity: 80, avatarInitials: 'CH' },
  { id: 'm83', teamIds: ['t28'], name: 'Derek Stafford',             role: 'Site Reliability & Devops Engineer',    reportsTo: 'Michelle Trask',        capacity: 80, avatarInitials: 'DS' },
  { id: 'm84', teamIds: ['t29'], name: 'Praj Sharma',                 role: 'Advanced Software Engineer',            reportsTo: 'Michelle Trask',        capacity: 80, avatarInitials: 'PS' },
  { id: 'm85', teamIds: ['t29'], name: 'Mary Kane',                    role: 'Product Manager',                       reportsTo: 'Megan Clarke',           capacity: 75, avatarInitials: 'MK' },
  // ── QAOps — DEX SWAT (t30) ─────────────────────────────────────────
  { id: 'm86', teamIds: ['t30'], name: 'Rajesh Kumar', role: 'Senior Quality Engineer',           reportsTo: 'Priya Anand',        capacity: 80, avatarInitials: 'RK' },
  { id: 'm87', teamIds: ['t30'], name: 'Mo Irfan',                role: 'Sr Software Engineer',                  reportsTo: 'Priya Anand',        capacity: 80, avatarInitials: 'MI' },
  // ── QAOps — DEX QAOps Mavericks (t31) ─────────────────────────────
  { id: 'm88', teamIds: ['t31'], name: 'Sanjay Ghosh',                  role: 'Senior Quality Engineer',               reportsTo: 'Priya Anand',        capacity: 80, avatarInitials: 'SG' },
  { id: 'm89', teamIds: ['t31'], name: 'Pradeep Reddy',       role: 'Senior Quality Engineer',               reportsTo: 'Priya Anand',        capacity: 80, avatarInitials: 'PR' },
  { id: 'm90', teamIds: ['t31'], name: 'Chandra Krishnan',   role: 'Senior Quality Engineer',               reportsTo: 'Priya Anand',        capacity: 80, avatarInitials: 'CK' },
  { id: 'm91', teamIds: ['t31'], name: 'Subha Prabhu',          role: 'Senior Quality Engineer',               reportsTo: 'Priya Anand',        capacity: 80, avatarInitials: 'SP' },
  { id: 'm92', teamIds: ['t31'], name: 'Joshua Stephens',               role: 'Quality Engineer',                      reportsTo: 'Priya Anand',        capacity: 80, avatarInitials: 'JS' },
  { id: 'm93', teamIds: ['t31'], name: 'Kiran Suresh',           role: 'Senior Quality Engineer',               reportsTo: 'Priya Anand',        capacity: 80, avatarInitials: 'KS' },
  { id: 'm94', teamIds: ['t31'], name: 'Harini Reddy',             role: 'Senior Quality Engineer',               reportsTo: 'Priya Anand',        capacity: 80, avatarInitials: 'HR' },
  { id: 'm95', teamIds: ['t31'], name: 'Deepak Pillai',           role: 'Advanced Quality Engineer',             reportsTo: 'Priya Anand',        capacity: 85, avatarInitials: 'DP' },
  // ── DevSecOps — SAT DevSecOps (t32) ────────────────────────────────
  { id: 'm96', teamIds: ['t32'], name: 'Neil Aggarwal',               role: 'Senior Product Manager',                reportsTo: 'Stephen Lay',             capacity: 75, avatarInitials: 'NA' },
  { id: 'm97', teamIds: ['t32'], name: 'Theodore Fark',                 role: 'Senior Site Reliability/Devops Engineer', reportsTo: 'Stephen Lay',           capacity: 80, avatarInitials: 'TF' },
  { id: 'm98', teamIds: ['t32'], name: 'Justin Parker',                 role: 'Advanced Site Reliability/Devops Engineer', reportsTo: 'Stephen Lay',         capacity: 85, avatarInitials: 'JP' },
  // ── L3 Support — SAT Support (t33) ─────────────────────────────────
  { id: 'm100', teamIds: ['t33'], name: 'Troy Cooper',                  role: 'Release Manager',                       reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'TC' },
  { id: 'm101', teamIds: ['t33'], name: 'Marcus Webb',               role: 'Senior Application Systems Analyst',    reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'MW' },
  { id: 'm102', teamIds: ['t33'], name: 'Blake Morgan',                role: 'Software Engineer',                     reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'BM' },
  { id: 'm103', teamIds: ['t33'], name: 'Christopher Penn',             role: 'Associate Application Systems Analyst', reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'CP' },
  { id: 'm104', teamIds: ['t33'], name: 'Katie Spencer',               role: 'Application Systems Analyst',           reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'KS' },
  { id: 'm105', teamIds: ['t33'], name: 'Will Brinkley',             role: 'Associate Application Systems Analyst', reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'WB' },
  // ── AP — AP (t34) ──────────────────────────────────────────────────
  { id: 'm106', teamIds: ['t34', 't41'], name: 'Adrian Cole',         role: 'Advanced Software Engineering Manager', reportsTo: 'Brandon Wells',           capacity: 70, avatarInitials: 'AC' },
  { id: 'm107', teamIds: ['t34'], name: 'Nick Carter',              role: 'Senior Application Systems Analyst',    reportsTo: 'Adrian Cole',          capacity: 80, avatarInitials: 'NC' },
  { id: 'm108', teamIds: ['t34'], name: 'Quinn Carter',               role: 'Associate Application Systems Analyst', reportsTo: 'Adrian Cole',          capacity: 80, avatarInitials: 'QC' },
  { id: 'm109', teamIds: ['t34'], name: 'Karen Grimes',           role: 'Associate Application Systems Analyst', reportsTo: 'Adrian Cole',          capacity: 80, avatarInitials: 'KG' },
  { id: 'm110', teamIds: ['t34'], name: 'Terrence Lewis',               role: 'Application Systems Analyst',           reportsTo: 'Adrian Cole',          capacity: 80, avatarInitials: 'TL' },
  { id: 'm111', teamIds: ['t34'], name: 'Richard Soler',               role: 'Application Systems Analyst',           reportsTo: 'Adrian Cole',          capacity: 80, avatarInitials: 'RS' },
  // ── Compliance — Compliance (t35) ──────────────────────────────────
  { id: 'm112', teamIds: ['t35', 't41'], name: 'Sandeep Singh',          role: 'Senior Advanced Software Engineering Manager', reportsTo: 'Brandon Wells',   capacity: 65, avatarInitials: 'SS' },
  { id: 'm113', teamIds: ['t35'], name: 'Sai Chandra',            role: 'Senior Quality Engineer',               reportsTo: 'Sandeep Singh',           capacity: 80, avatarInitials: 'SC' },
  { id: 'm114', teamIds: ['t35'], name: 'Jake Flynn',                   role: 'Software Engineer',                     reportsTo: 'Sandeep Singh',           capacity: 80, avatarInitials: 'JF' },
  { id: 'm115', teamIds: ['t35'], name: 'Derek Ford',                  role: 'Software Engineer',                     reportsTo: 'Sandeep Singh',           capacity: 80, avatarInitials: 'DF' },
  { id: 'm116', teamIds: ['t35'], name: 'Kiran Kumar',   role: 'Advanced Software Engineer',            reportsTo: 'Sandeep Singh',           capacity: 85, avatarInitials: 'KK' },
  { id: 'm117', teamIds: ['t35'], name: 'Divya Reddy',                role: 'Sr Software Engineer',                  reportsTo: 'Sandeep Singh',           capacity: 80, avatarInitials: 'DR' },
  { id: 'm118', teamIds: ['t35'], name: 'Eric Trapp',                 role: 'Senior Site Reliability/Devops Engineer', reportsTo: 'Sandeep Singh',           capacity: 80, avatarInitials: 'ET' },
  // ── Labor & Productivity — Labor & Productivity (t36) ──────────────
  { id: 'm120', teamIds: ['t36'], name: 'Kurt Benson',                  role: 'Advanced Software Engineer',            reportsTo: 'Diana Wilson',         capacity: 85, avatarInitials: 'KB' },
  { id: 'm121', teamIds: ['t36'], name: 'Jyoti Rao',                 role: 'Senior Product Manager',                reportsTo: 'Diana Wilson',         capacity: 75, avatarInitials: 'JR' },
  { id: 'm122', teamIds: ['t34'], name: 'Lauren Reed',                 role: 'Senior Product Manager',                reportsTo: 'Brandon Wells',           capacity: 75, avatarInitials: 'LR' },
  { id: 'm123', teamIds: ['t35'], name: 'Priyanka Das',                  role: 'Product Manager',                       reportsTo: 'Brandon Wells',           capacity: 75, avatarInitials: 'PD' },
  // ── Architecture — Architecture (t37) ──────────────────────────────
  { id: 'm124', teamIds: ['t37'], name: 'Omar Sheikh',                 role: 'Advanced Solutions Architect',          reportsTo: 'Brandon Wells',           capacity: 80, avatarInitials: 'OS' },
  { id: 'm125', teamIds: ['t37'], name: 'Greg Blanco',                 role: 'Advanced Solutions Architect',          reportsTo: 'Brandon Wells',           capacity: 80, avatarInitials: 'GB' },
  { id: 'm126', teamIds: ['t37'], name: 'Jonathan Frank',               role: 'Senior Advanced Solutions Architect',   reportsTo: 'Brandon Wells',           capacity: 80, avatarInitials: 'JF' },
  { id: 'm127', teamIds: ['t37'], name: 'Madhu Mohan',              role: 'Advanced Solutions Architect',          reportsTo: 'Brandon Wells',           capacity: 80, avatarInitials: 'MM' },
  { id: 'm128', teamIds: ['t37'], name: 'Angela Brooks',                  role: 'Advanced Solutions Architect',          reportsTo: 'Brandon Wells',           capacity: 80, avatarInitials: 'AB' },
  { id: 'm129', teamIds: ['t37'], name: 'Eric Ross',                    role: 'Advanced Solutions Architect',          reportsTo: 'Brandon Wells',           capacity: 80, avatarInitials: 'ER' },
  // ── SAT Leadership — Store Technology Leadership (t38) ─────────────
  // Executive and director-level leaders. Ryan Schreier is the portfolio lead
  // reporting to James Clendenen (CIO, not in roster).
  { id: 'm130', teamIds: ['t38'], name: 'Ryan Schreier',                 role: 'Sr Store & Associate Technology Director', reportsTo: 'James Clendenen',       capacity: 60, avatarInitials: 'RS' },
  { id: 'm131', teamIds: ['t38', 't41'], name: 'Brandon Wells',         role: 'Labor & Shrink Technology Director',    reportsTo: 'Ryan Schreier',            capacity: 65, avatarInitials: 'BW' },
  { id: 'm132', teamIds: ['t38', 't40'], name: 'Megan Clarke',         role: 'Store Ops Technology Director',         reportsTo: 'Ryan Schreier',            capacity: 65, avatarInitials: 'MC' },
  { id: 'm133', teamIds: ['t38'], name: 'Stephen Lay',                  role: 'Senior Advanced Software Engineering Manager', reportsTo: 'Ryan Schreier',    capacity: 65, avatarInitials: 'SL' },
  { id: 'm134', teamIds: ['t38'], name: 'Sam Saleh',                role: 'Sr Advanced Data Engineering Manager',  reportsTo: 'Ryan Schreier',            capacity: 65, avatarInitials: 'SS' },
  { id: 'm135', teamIds: ['t38'], name: 'Priya Anand',             role: 'Advanced QA Manager',                   reportsTo: 'Ryan Schreier',            capacity: 65, avatarInitials: 'PA' },
  { id: 'm136', teamIds: ['t38', 't12'], name: 'Mike Silver',        role: 'Product Management Group Manager',      reportsTo: 'Ryan Schreier',            capacity: 65, avatarInitials: 'MS' },
  // ── Labor & Productivity — Labor & Productivity (t36) additions ────
  { id: 'm137', teamIds: ['t36'], name: 'Diana Wilson',              role: 'Advanced Software Engineer',            reportsTo: 'Brandon Wells',           capacity: 80, avatarInitials: 'DW' },
  // ── AP — AP (t34) additions ────────────────────────────────────────
  { id: 'm138', teamIds: ['t34'], name: 'Dylan Stone',                 role: 'Application Systems Analyst',           reportsTo: 'Adrian Cole',          capacity: 80, avatarInitials: 'DS' },
  // ── Compliance — Compliance (t35) additions ────────────────────────
  { id: 'm139', teamIds: ['t35'], name: 'Ravi Senthil',                role: 'Software Engineer',                     reportsTo: 'Sandeep Singh',           capacity: 80, avatarInitials: 'RS' },
]

// ─── Projects ─────────────────────────────────────────────────────────────
// Representative projects only — the real project inventory lives in Jira.
// Use "Import from Jira" or "Add Project" to populate with real work.
// Allocations reflect realistic team workloads; dates span FY 2025–2027.

const projects: Project[] = [
  // ── Seamless AX — IRIS (i1) ───────────────────────────────────────────
  // Three phases: Discovery (requirements + UX) → Development → QA.
  // Discovery is complete; Development is ~55% done; QA begins Aug 2026.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p1',
        phase: 'Discovery',
        startDate: '2025-10-01',
        endDate:   '2025-12-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'Platform architecture finalized. Offline-sync approach signed off by Store Ops.',
        assignments: [
          { memberId: 'm19', part: 'UX Research', allocation: 30 },
        ],
      },
      {
        id: 'ph2-p1',
        phase: 'Development',
        startDate: '2026-01-01',
        endDate:   '2026-07-31',
        status: 'In Progress',
        percentComplete: 55,
        notes: 'Core data sync rebuilt. Offline mode in development.',
        assignments: [
          { memberId: 'm12', part: 'Backend',   allocation: 50 },
          { memberId: 'm14', part: 'Backend',   allocation: 40 },
          { memberId: 'm15', part: 'Backend',   allocation: 40 },
          { memberId: 'm19', part: 'UI Design', allocation: 30 },
        ],
      },
      {
        id: 'ph3-p1',
        phase: 'QA',
        startDate: '2026-08-01',
        endDate:   '2026-09-30',
        status: 'Not Started',
        percentComplete: 0,
        notes: 'Test plan drafted. Awaiting development handoff.',
        assignments: [
          { memberId: 'm12', part: 'Backend', allocation: 30 },
        ],
      },
    ]
    const project: Project = {
      id: 'p1',
      name: 'IRIS Platform v2',
      description: 'Major version upgrade to the IRIS associate platform with improved real-time data sync and offline support.',
      status: 'In Progress',
      phase: 'Development',
      priority: 'Critical',
      initiativeId: 'i1',
      startDate: '2025-10-01',
      targetEndDate: '2026-09-30',
      percentComplete: 55,
      stakeholders: 'Store Ops, Merchandising',
      notes: 'Core data sync rebuilt. Offline mode in development.',
      updatedAt: '2026-05-28T10:00:00Z',
      estimatedValue: 4500000, valueType: 'Revenue Impact',
      // Root assignments union all phases; per-member date windows reflect their actual span.
      assignments: [
        { memberId: 'm19', part: 'UX Research & Design', allocation: 30, startDate: '2025-10-01', endDate: '2026-07-31' },
        { memberId: 'm12', part: 'Backend',              allocation: 50, startDate: '2026-01-01', endDate: '2026-09-30' },
        { memberId: 'm14', part: 'Backend',              allocation: 40, startDate: '2026-01-01', endDate: '2026-07-31' },
        { memberId: 'm15', part: 'Backend',              allocation: 40, startDate: '2026-01-01', endDate: '2026-07-31' },
      ],
      phases,
    }
    return project
  })(),
  {
    id: 'p2',
    assignments: [
      { memberId: 'm13', part: 'Infrastructure', allocation: 60, startDate: '2026-01-01', endDate: '2026-08-31' },
      { memberId: 'm36', part: 'SRE',            allocation: 40, startDate: '2026-01-01', endDate: '2026-08-31' },
    ],
    name: 'IRIS Infrastructure Reliability',
    description: 'SRE improvements for IRIS: high-availability configuration, runbook automation, and observability dashboards.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i1', priority: 'High',
    startDate: '2026-01-01', targetEndDate: '2026-08-31', percentComplete: 45,
    stakeholders: 'Engineering',
    notes: 'HA config complete. Monitoring dashboards in progress.',
    updatedAt: '2026-05-25T09:00:00Z',
  },
  // ── Seamless AX — Cookie Monster (i1) ────────────────────────────────
  // Three phases: Discovery (UX + requirements) → Development → QA & Deploy.
  // Discovery shipped Mar 2026; Development is ~25% done; QA queued for Oct.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p3',
        phase: 'Discovery',
        startDate: '2026-02-01',
        endDate:   '2026-03-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'UX research and API contract defined. Wireframes approved by Store Ops.',
        assignments: [
          { memberId: 'm20', part: 'Product Management', allocation: 50 },
          { memberId: 'm23', part: 'UX Research',        allocation: 50 },
          { memberId: 'm24', part: 'UI Design',          allocation: 40 },
        ],
      },
      {
        id: 'ph2-p3',
        phase: 'Development',
        startDate: '2026-04-01',
        endDate:   '2026-09-30',
        status: 'In Progress',
        percentComplete: 25,
        notes: 'API integration complete. Frontend checkout flow in development.',
        assignments: [
          { memberId: 'm20', part: 'Product Management', allocation: 50 },
          { memberId: 'm21', part: 'Frontend',           allocation: 60 },
          { memberId: 'm23', part: 'UI Design',          allocation: 50 },
          { memberId: 'm24', part: 'UI Design',          allocation: 40 },
        ],
      },
      {
        id: 'ph3-p3',
        phase: 'QA',
        startDate: '2026-10-01',
        endDate:   '2026-10-31',
        status: 'Not Started',
        percentComplete: 0,
        notes: 'Test cases drafted. Awaiting development completion.',
        assignments: [],
      },
    ]
    const project: Project = {
      id: 'p3',
      name: 'Cookie Monster Associate Checkout',
      description: 'New associate-facing checkout experience replacing legacy POS integration with a modern API-driven flow.',
      status: 'In Progress',
      phase: 'Development',
      priority: 'High',
      initiativeId: 'i1',
      startDate: '2026-02-01',
      targetEndDate: '2026-10-31',
      percentComplete: 35,
      stakeholders: 'Store Ops, Finance',
      notes: 'API integration complete. UI in development.',
      updatedAt: '2026-05-27T11:00:00Z',
      estimatedValue: 2800000, valueType: 'Revenue Impact',
      assignments: [
        { memberId: 'm20', part: 'Product Management', allocation: 50, startDate: '2026-02-01', endDate: '2026-09-30' },
        { memberId: 'm23', part: 'UX Research & Design', allocation: 50, startDate: '2026-02-01', endDate: '2026-09-30' },
        { memberId: 'm24', part: 'UI Design',           allocation: 40, startDate: '2026-02-01', endDate: '2026-09-30' },
        { memberId: 'm21', part: 'Frontend',             allocation: 60, startDate: '2026-04-01', endDate: '2026-09-30' },
      ],
      phases,
    }
    return project
  })(),
  // ── Seamless AX — Little Bird (i1) ───────────────────────────────────
  // Three phases: Research → Development & Integration → QA & Rollout.
  // Research and Development are done; QA covers the final 50 stores.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p4',
        phase: 'Research',
        startDate: '2025-11-01',
        endDate:   '2025-12-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'Firmware vendor selected. CMS integration spec approved.',
        assignments: [
          { memberId: 'm27', part: 'UX Research', allocation: 50 },
        ],
      },
      {
        id: 'ph2-p4',
        phase: 'Development',
        startDate: '2026-01-01',
        endDate:   '2026-05-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'CMS integration complete. Firmware deployed to 150 stores.',
        assignments: [
          { memberId: 'm25', part: 'Backend',   allocation: 70 },
          { memberId: 'm26', part: 'Backend',   allocation: 80 },
          { memberId: 'm27', part: 'UI Design', allocation: 50 },
        ],
      },
      {
        id: 'ph3-p4',
        phase: 'QA',
        startDate: '2026-06-01',
        endDate:   '2026-07-31',
        status: 'In Progress',
        percentComplete: 50,
        notes: 'Final 50 stores in QA. Label sync validation underway.',
        assignments: [
          { memberId: 'm25', part: 'Backend', allocation: 50 },
          { memberId: 'm26', part: 'Backend', allocation: 60 },
        ],
      },
    ]
    const project: Project = {
      id: 'p4',
      name: 'Digital Shelf Label Rollout',
      description: 'Enterprise rollout of digital shelf labels across 200 pilot stores with firmware and CMS integration.',
      status: 'In Progress',
      phase: 'QA',
      priority: 'High',
      initiativeId: 'i1',
      startDate: '2025-11-01',
      targetEndDate: '2026-07-31',
      percentComplete: 83,   // avg of [100, 100, 50] across three phases
      stakeholders: 'Merchandising, Store Ops',
      notes: '150 stores complete. Final 50 stores in QA.',
      updatedAt: '2026-05-26T10:00:00Z',
      assignments: [
        { memberId: 'm27', part: 'UX Research & Design', allocation: 50, startDate: '2025-11-01', endDate: '2026-05-31' },
        { memberId: 'm25', part: 'Backend',              allocation: 70, startDate: '2025-11-01', endDate: '2026-07-31' },
        { memberId: 'm26', part: 'Backend',              allocation: 80, startDate: '2025-11-01', endDate: '2026-07-31' },
      ],
      phases,
    }
    return project
  })(),
  // ── Seamless AX — Blade Runners (i1) ─────────────────────────────────
  {
    id: 'p5',
    assignments: [
      { memberId: 'm28', part: 'Backend', allocation: 80, startDate: '2026-03-01', endDate: '2026-11-30' },
      { memberId: 'm29', part: 'Backend', allocation: 70, startDate: '2026-03-01', endDate: '2026-11-30' },
    ],
    name: 'Seamless AX API Consolidation',
    description: 'Consolidate 14 legacy microservices into a unified Seamless AX backend API layer.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i1', priority: 'Medium',
    startDate: '2026-03-01', targetEndDate: '2026-11-30', percentComplete: 25,
    stakeholders: 'Engineering',
    notes: '4 of 14 services migrated.',
    updatedAt: '2026-05-24T14:00:00Z',
  },
  // ── Core Services — SpaceForce (i5) ──────────────────────────────────
  // Three phases: Discovery → Development → QA & Hardening.
  // Discovery complete; auth token service live; event bus now in QA hardening.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p6',
        phase: 'Discovery',
        startDate: '2025-09-01',
        endDate:   '2025-11-30',
        status: 'Complete',
        percentComplete: 100,
        notes: 'Service catalog defined. Auth, event-bus, and config management scoped.',
        assignments: [
          { memberId: 'm3', part: 'Architecture', allocation: 40 },
        ],
      },
      {
        id: 'ph2-p6',
        phase: 'Development',
        startDate: '2025-12-01',
        endDate:   '2026-06-30',
        status: 'Complete',
        percentComplete: 100,
        notes: 'Auth token service live. Event bus built and deployed to staging.',
        assignments: [
          { memberId: 'm1', part: 'Backend',      allocation: 60 },
          { memberId: 'm3', part: 'Architecture', allocation: 40 },
          { memberId: 'm4', part: 'SRE',          allocation: 50 },
        ],
      },
      {
        id: 'ph3-p6',
        phase: 'QA',
        startDate: '2026-07-01',
        endDate:   '2026-08-31',
        status: 'In Progress',
        percentComplete: 30,
        notes: 'Event bus load testing underway. Config management hardening in progress.',
        assignments: [
          { memberId: 'm1', part: 'Backend', allocation: 40 },
          { memberId: 'm4', part: 'SRE',     allocation: 60 },
        ],
      },
    ]
    const project: Project = {
      id: 'p6',
      name: 'SAT Core Platform Services',
      description: 'Build and maintain foundational shared services: auth tokens, event bus, and config management for SAT products.',
      status: 'In Progress',
      phase: 'QA',
      priority: 'Critical',
      initiativeId: 'i5',
      startDate: '2025-09-01',
      targetEndDate: '2026-08-31',
      percentComplete: 77,   // avg of [100, 100, 30] across three phases
      stakeholders: 'All engineering teams',
      notes: 'Auth token service live. Event bus in QA hardening.',
      updatedAt: '2026-05-27T10:00:00Z',
      estimatedValue: 3200000, valueType: 'Cost Savings',
      assignments: [
        { memberId: 'm3', part: 'Architecture', allocation: 40, startDate: '2025-09-01', endDate: '2026-06-30' },
        { memberId: 'm1', part: 'Backend',      allocation: 60, startDate: '2025-12-01', endDate: '2026-08-31' },
        { memberId: 'm4', part: 'SRE',          allocation: 50, startDate: '2025-12-01', endDate: '2026-08-31' },
      ],
      phases,
    }
    return project
  })(),
  {
    id: 'p7',
    assignments: [
      { memberId: 'm2', part: 'Backend', allocation: 60, startDate: '2026-01-15', endDate: '2026-09-30' },
      { memberId: 'm5', part: 'Backend', allocation: 50, startDate: '2026-01-15', endDate: '2026-09-30' },
    ],
    name: 'SpaceForce Reliability Initiative',
    description: 'Improve SpaceForce platform resilience: distributed tracing, alerting, and chaos testing.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i5', priority: 'High',
    startDate: '2026-01-15', targetEndDate: '2026-09-30', percentComplete: 40,
    stakeholders: 'Platform, Engineering',
    notes: 'Distributed tracing configured. Alerting in progress.',
    updatedAt: '2026-05-22T11:00:00Z',
  },
  // ── Core Services — RedBull (i5) ──────────────────────────────────────
  {
    id: 'p8',
    assignments: [
      { memberId: 'm6', part: 'Backend', allocation: 70, startDate: '2025-12-01', endDate: '2026-07-31' },
      { memberId: 'm7', part: 'Backend', allocation: 60, startDate: '2025-12-01', endDate: '2026-07-31' },
      { memberId: 'm8', part: 'Backend', allocation: 80, startDate: '2025-12-01', endDate: '2026-07-31' },
    ],
    name: 'RedBull Integration Hub',
    description: 'Unified integration hub connecting SAT systems to enterprise data sources.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i5', priority: 'High',
    startDate: '2025-12-01', targetEndDate: '2026-07-31', percentComplete: 50,
    stakeholders: 'Core Services, Analytics',
    notes: '6 of 12 integration adapters complete.',
    updatedAt: '2026-05-23T13:00:00Z',
  },
  // ── Core Services — SAT-Data (i5) ─────────────────────────────────────
  // Three phases: Discovery & Design → Development → Domain Rollout.
  // Kafka cluster is live; rolling out to domains one by one (40% done).
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p9',
        phase: 'Discovery',
        startDate: '2025-10-01',
        endDate:   '2025-12-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'Streaming architecture chosen (Kafka). Domain data contracts defined.',
        assignments: [
          { memberId: 'm9', part: 'Data Architecture', allocation: 70 },
        ],
      },
      {
        id: 'ph2-p9',
        phase: 'Development',
        startDate: '2026-01-01',
        endDate:   '2026-06-30',
        status: 'Complete',
        percentComplete: 100,
        notes: 'Kafka cluster live. Core pipeline framework built and validated.',
        assignments: [
          { memberId: 'm9',  part: 'Data', allocation: 70 },
          { memberId: 'm11', part: 'Data', allocation: 80 },
        ],
      },
      {
        id: 'ph3-p9',
        phase: 'Deployed',
        startDate: '2026-07-01',
        endDate:   '2026-08-31',
        status: 'In Progress',
        percentComplete: 40,
        notes: 'Domain onboarding at 40%. Seamless AX and Core Services onboarded; others in progress.',
        assignments: [
          { memberId: 'm9',  part: 'Data', allocation: 50 },
          { memberId: 'm11', part: 'Data', allocation: 60 },
        ],
      },
    ]
    const project: Project = {
      id: 'p9',
      name: 'SAT Data Pipeline Modernization',
      description: 'Replace batch ETL with streaming data pipelines for real-time analytics across all SAT domains.',
      status: 'In Progress',
      phase: 'Deployed',
      priority: 'Critical',
      initiativeId: 'i5',
      startDate: '2025-10-01',
      targetEndDate: '2026-08-31',
      percentComplete: 80,   // avg of [100, 100, 40] across three phases
      stakeholders: 'Analytics, All domains',
      notes: 'Kafka cluster live. Domain onboarding at 40%.',
      updatedAt: '2026-05-26T09:00:00Z',
      estimatedValue: 3800000, valueType: 'Revenue Impact',
      assignments: [
        { memberId: 'm9',  part: 'Data', allocation: 70, startDate: '2025-10-01', endDate: '2026-08-31' },
        { memberId: 'm11', part: 'Data', allocation: 80, startDate: '2026-01-01', endDate: '2026-08-31' },
      ],
      phases,
    }
    return project
  })(),
  // ── Price Execution — ISA (i2) ────────────────────────────────────────
  // Three phases: Research & Requirements → Development → QA.
  // Requirements locked down Jan 2026; rule engine rebuilt; store sync in dev.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p10',
        phase: 'Research',
        startDate: '2025-11-01',
        endDate:   '2026-01-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'Compliance rule taxonomy documented. Store sync data contract finalized.',
        assignments: [
          { memberId: 'm49', part: 'Analysis', allocation: 70 },
          { memberId: 'm50', part: 'Analysis', allocation: 60 },
        ],
      },
      {
        id: 'ph2-p10',
        phase: 'Development',
        startDate: '2026-02-01',
        endDate:   '2026-06-30',
        status: 'In Progress',
        percentComplete: 55,
        notes: 'Rule engine rebuilt. Store sync integration in development.',
        assignments: [
          { memberId: 'm49', part: 'Analysis', allocation: 70 },
          { memberId: 'm50', part: 'Analysis', allocation: 60 },
          { memberId: 'm52', part: 'Backend',  allocation: 60 },
        ],
      },
      {
        id: 'ph3-p10',
        phase: 'QA',
        startDate: '2026-07-01',
        endDate:   '2026-08-31',
        status: 'Not Started',
        percentComplete: 0,
        notes: 'QA test plan drafted. Awaiting development handoff.',
        assignments: [
          { memberId: 'm48', part: 'QA',      allocation: 50 },
          { memberId: 'm52', part: 'Backend', allocation: 30 },
        ],
      },
    ]
    const project: Project = {
      id: 'p10',
      name: 'ISA Price Engine v3',
      description: 'Next-generation price execution engine for real-time shelf compliance and automated correction workflows.',
      status: 'In Progress',
      phase: 'Development',
      priority: 'High',
      initiativeId: 'i2',
      startDate: '2025-11-01',
      targetEndDate: '2026-08-31',
      percentComplete: 55,
      stakeholders: 'Merchandising, Store Ops',
      notes: 'Rule engine rebuilt. Store sync integration in development.',
      updatedAt: '2026-05-25T11:00:00Z',
      estimatedValue: 1800000, valueType: 'Cost Savings',
      assignments: [
        { memberId: 'm49', part: 'Analysis', allocation: 70, startDate: '2025-11-01', endDate: '2026-06-30' },
        { memberId: 'm50', part: 'Analysis', allocation: 60, startDate: '2025-11-01', endDate: '2026-06-30' },
        { memberId: 'm52', part: 'Backend',  allocation: 60, startDate: '2026-02-01', endDate: '2026-08-31' },
        { memberId: 'm48', part: 'QA',       allocation: 50, startDate: '2026-07-01', endDate: '2026-08-31' },
      ],
      phases,
    }
    return project
  })(),
  // ── Price Execution — ISA Compliance (i2) ─────────────────────────────
  // Three phases: Research & Spec → Development → QA.
  // Reports are functional; performance-tuning QA is in progress.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p11',
        phase: 'Research',
        startDate: '2026-02-01',
        endDate:   '2026-03-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'Compliance reporting requirements documented. Data model approved.',
        assignments: [
          { memberId: 'm51', part: 'Analysis', allocation: 80 },
        ],
      },
      {
        id: 'ph2-p11',
        phase: 'Development',
        startDate: '2026-04-01',
        endDate:   '2026-07-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'All reports built and deployed to staging. Drill-down views complete.',
        assignments: [
          { memberId: 'm51', part: 'Analysis',   allocation: 80 },
          { memberId: 'm54', part: 'Engineering', allocation: 30 },
        ],
      },
      {
        id: 'ph3-p11',
        phase: 'QA',
        startDate: '2026-08-01',
        endDate:   '2026-09-30',
        status: 'In Progress',
        percentComplete: 50,
        notes: 'Reports functional. Performance tuning underway for large-store queries.',
        assignments: [
          { memberId: 'm51', part: 'Analysis',   allocation: 60 },
          { memberId: 'm54', part: 'Engineering', allocation: 30 },
        ],
      },
    ]
    const project: Project = {
      id: 'p11',
      name: 'ISA Compliance Reporting',
      description: 'Automated price compliance reporting across all stores with drill-down by department and item.',
      status: 'In Progress',
      phase: 'QA',
      priority: 'Medium',
      initiativeId: 'i2',
      startDate: '2026-02-01',
      targetEndDate: '2026-09-30',
      percentComplete: 75,
      stakeholders: 'Compliance, Finance',
      notes: 'Reports functional. Performance tuning in QA.',
      updatedAt: '2026-05-20T10:00:00Z',
      assignments: [
        { memberId: 'm51', part: 'Analysis',    allocation: 80, startDate: '2026-02-01', endDate: '2026-09-30' },
        { memberId: 'm54', part: 'Engineering', allocation: 30, startDate: '2026-04-01', endDate: '2026-09-30' },
      ],
      phases,
    }
    return project
  })(),
  // ── Inventory — Inventorious (i2) ─────────────────────────────────────
  // Three phases: Discovery & UX → Development → QA & Rollout.
  // Mobile MVP shipped; variance reporting integration is in active development.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p12',
        phase: 'Discovery',
        startDate: '2025-12-01',
        endDate:   '2026-01-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'Mobile UX flows designed. Variance calculation rules defined with Store Ops.',
        assignments: [
          { memberId: 'm57', part: 'UX Design', allocation: 60 },
        ],
      },
      {
        id: 'ph2-p12',
        phase: 'Development',
        startDate: '2026-02-01',
        endDate:   '2026-07-31',
        status: 'In Progress',
        percentComplete: 50,
        notes: 'Mobile app MVP complete. Variance reporting integration in development.',
        assignments: [
          { memberId: 'm55', part: 'Backend',  allocation: 80 },
          { memberId: 'm56', part: 'Backend',  allocation: 75 },
          { memberId: 'm57', part: 'Frontend', allocation: 60 },
          { memberId: 'm58', part: 'Backend',  allocation: 70 },
        ],
      },
      {
        id: 'ph3-p12',
        phase: 'QA',
        startDate: '2026-08-01',
        endDate:   '2026-09-30',
        status: 'Not Started',
        percentComplete: 0,
        notes: 'Pilot store selection complete. QA scripts drafted.',
        assignments: [
          { memberId: 'm55', part: 'Backend',  allocation: 40 },
          { memberId: 'm57', part: 'Frontend', allocation: 40 },
        ],
      },
    ]
    const project: Project = {
      id: 'p12',
      name: 'Inventorious Cycle Count Platform',
      description: 'Mobile-first cycle count platform replacing paper-based counting with real-time variance tracking.',
      status: 'In Progress',
      phase: 'Development',
      priority: 'High',
      initiativeId: 'i2',
      startDate: '2025-12-01',
      targetEndDate: '2026-09-30',
      percentComplete: 50,
      stakeholders: 'Store Ops, Merchandising',
      notes: 'Mobile app MVP complete. Variance reporting integration in development.',
      updatedAt: '2026-05-24T12:00:00Z',
      estimatedValue: 2200000, valueType: 'Cost Savings',
      assignments: [
        { memberId: 'm57', part: 'UX Design & Frontend', allocation: 60, startDate: '2025-12-01', endDate: '2026-09-30' },
        { memberId: 'm55', part: 'Backend',              allocation: 80, startDate: '2026-02-01', endDate: '2026-09-30' },
        { memberId: 'm56', part: 'Backend',              allocation: 75, startDate: '2026-02-01', endDate: '2026-07-31' },
        { memberId: 'm58', part: 'Backend',              allocation: 70, startDate: '2026-02-01', endDate: '2026-07-31' },
      ],
      phases,
    }
    return project
  })(),
  // ── Inventory — DSD (i2) ──────────────────────────────────────────────
  {
    id: 'p13',
    assignments: [
      { memberId: 'm61', part: 'Analysis', allocation: 70, startDate: '2026-01-15', endDate: '2026-10-31' },
      { memberId: 'm62', part: 'Backend',  allocation: 80, startDate: '2026-01-15', endDate: '2026-10-31' },
      { memberId: 'm64', part: 'Analysis', allocation: 60, startDate: '2026-01-15', endDate: '2026-10-31' },
    ],
    name: 'DSD Receiving System Upgrade',
    description: 'Modernize direct store delivery receiving: barcode scanning, vendor portal integration, and exception management.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i2', priority: 'Medium',
    startDate: '2026-01-15', targetEndDate: '2026-10-31', percentComplete: 40,
    stakeholders: 'Supply Chain, Vendors',
    notes: 'Barcode scanning module complete. Vendor portal in development.',
    updatedAt: '2026-05-21T10:00:00Z',
  },
  // ── Production — Warrior Squad (i2) ──────────────────────────────────
  {
    id: 'p14',
    assignments: [
      { memberId: 'm65', part: 'Backend', allocation: 70, startDate: '2026-02-01', endDate: '2026-11-30' },
      { memberId: 'm66', part: 'Backend', allocation: 80, startDate: '2026-02-01', endDate: '2026-11-30' },
    ],
    name: 'Warrior Squad Production Planning',
    description: 'Production planning system for deli and prepared foods with demand forecasting and waste reduction.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i2', priority: 'High',
    startDate: '2026-02-01', targetEndDate: '2026-11-30', percentComplete: 35,
    stakeholders: 'Store Ops, Merchandising',
    notes: 'Demand model integrated. Scheduling UI in development.',
    updatedAt: '2026-05-23T14:00:00Z',
  },
  // ── Production — FAST (i2) ────────────────────────────────────────────
  // Two phases: Research & Development → QA & Pilot.
  // Model trained and validated; QA is underway across pilot stores.
  // percentComplete: avg of [100, 45] = 72.5 ≈ 72.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p15',
        phase: 'Research',
        startDate: '2025-10-15',
        endDate:   '2026-03-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'AI model trained and validated on 12 months of production data.',
        assignments: [
          { memberId: 'm68', part: 'Backend',      allocation: 70 },
          { memberId: 'm69', part: 'Architecture', allocation: 60 },
        ],
      },
      {
        id: 'ph2-p15',
        phase: 'QA',
        startDate: '2026-04-01',
        endDate:   '2026-07-31',
        status: 'In Progress',
        percentComplete: 45,
        notes: 'QA underway with 8 pilot stores. Schedule accuracy at 88%.',
        assignments: [
          { memberId: 'm68', part: 'Backend', allocation: 40 },
          { memberId: 'm70', part: 'QA',      allocation: 70 },
        ],
      },
    ]
    const project: Project = {
      id: 'p15',
      name: 'FAST Labor Optimization Engine',
      description: 'AI-driven labor optimization for production departments reducing overstaffing and scheduling waste.',
      status: 'In Progress',
      phase: 'QA',
      priority: 'High',
      initiativeId: 'i2',
      startDate: '2025-10-15',
      targetEndDate: '2026-07-31',
      percentComplete: 72,
      stakeholders: 'HR, Store Ops',
      notes: 'Model trained and validated. QA underway with pilot stores.',
      updatedAt: '2026-05-25T10:00:00Z',
      assignments: [
        { memberId: 'm68', part: 'Backend',      allocation: 70, startDate: '2025-10-15', endDate: '2026-07-31' },
        { memberId: 'm69', part: 'Architecture', allocation: 60, startDate: '2025-10-15', endDate: '2026-03-31' },
        { memberId: 'm70', part: 'QA',           allocation: 70, startDate: '2026-04-01', endDate: '2026-07-31' },
      ],
      phases,
    }
    return project
  })(),
  // ── Production — Freddy Kroger (i2) ──────────────────────────────────
  {
    id: 'p16',
    assignments: [
      { memberId: 'm71', part: 'Backend', allocation: 80, startDate: '2026-01-01', endDate: '2026-09-30' },
      { memberId: 'm72', part: 'Backend', allocation: 80, startDate: '2026-01-01', endDate: '2026-09-30' },
    ],
    name: 'Freddy Kroger Store Ops Platform',
    description: 'Integrated store operations platform for Freddy Kroger production management and team coordination.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i2', priority: 'Medium',
    startDate: '2026-01-01', targetEndDate: '2026-09-30', percentComplete: 45,
    stakeholders: 'Store Ops',
    notes: 'Core scheduling module complete. Reporting in development.',
    updatedAt: '2026-05-20T11:00:00Z',
  },
  // ── Ordering — Little Einsteins (i2) ─────────────────────────────────
  // Three phases: Research & ML Design → Development → UAT & Deploy.
  // ML model live; exception workflow in dev; UAT planned for Jul–Aug 2026.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p17',
        phase: 'Research',
        startDate: '2025-11-01',
        endDate:   '2025-12-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'ML reorder model designed and baseline-tested against historical data.',
        assignments: [
          { memberId: 'm75', part: 'Data Science', allocation: 70 },
          { memberId: 'm76', part: 'Backend',       allocation: 80 },
        ],
      },
      {
        id: 'ph2-p17',
        phase: 'Development',
        startDate: '2026-01-01',
        endDate:   '2026-06-30',
        status: 'In Progress',
        percentComplete: 65,
        notes: 'ML model deployed to prod. Exception workflow in development.',
        assignments: [
          { memberId: 'm75', part: 'Backend',  allocation: 70 },
          { memberId: 'm76', part: 'Backend',  allocation: 80 },
          { memberId: 'm77', part: 'Frontend', allocation: 60 },
        ],
      },
      {
        id: 'ph3-p17',
        phase: 'QA',
        startDate: '2026-07-01',
        endDate:   '2026-08-31',
        status: 'Not Started',
        percentComplete: 0,
        notes: 'UAT plan with Merchandising drafted. Awaiting dev handoff.',
        assignments: [
          { memberId: 'm75', part: 'Backend',  allocation: 40 },
          { memberId: 'm77', part: 'Frontend', allocation: 40 },
        ],
      },
    ]
    const project: Project = {
      id: 'p17',
      name: 'Intelligent Ordering System',
      description: 'Demand-driven automated ordering with ML-based reorder point calculations and exception management.',
      status: 'In Progress',
      phase: 'Development',
      priority: 'Critical',
      initiativeId: 'i2',
      startDate: '2025-11-01',
      targetEndDate: '2026-08-31',
      percentComplete: 55,   // avg of [100, 65, 0] across three phases
      stakeholders: 'Merchandising, Supply Chain',
      notes: 'ML model deployed. Exception workflow in development.',
      updatedAt: '2026-05-26T13:00:00Z',
      estimatedValue: 5500000, valueType: 'Revenue Impact',
      assignments: [
        { memberId: 'm75', part: 'Backend',  allocation: 70, startDate: '2025-11-01', endDate: '2026-08-31' },
        { memberId: 'm76', part: 'Backend',  allocation: 80, startDate: '2025-11-01', endDate: '2026-06-30' },
        { memberId: 'm77', part: 'Frontend', allocation: 60, startDate: '2026-01-01', endDate: '2026-08-31' },
      ],
      phases,
    }
    return project
  })(),
  // ── Ordering — Interface (i2) ─────────────────────────────────────────
  {
    id: 'p18',
    assignments: [
      { memberId: 'm79', part: 'Backend', allocation: 70, startDate: '2026-03-01', endDate: '2026-10-31' },
      { memberId: 'm80', part: 'Backend', allocation: 70, startDate: '2026-03-01', endDate: '2026-10-31' },
    ],
    name: 'Vendor Ordering Interface',
    description: 'Standardized vendor ordering interface for automated purchase order creation and confirmation.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i2', priority: 'High',
    startDate: '2026-03-01', targetEndDate: '2026-10-31', percentComplete: 30,
    stakeholders: 'Procurement, Supply Chain',
    notes: '3 of 8 vendor connectors live.',
    updatedAt: '2026-05-22T12:00:00Z',
  },
  // ── QAOps — DEX SWAT (i3) ─────────────────────────────────────────────
  // Three phases: Discovery & Framework Design → Development & Integration → Rollout.
  // Core framework built; IRIS and Cookie Monster integrations in progress.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p19',
        phase: 'Discovery',
        startDate: '2026-01-01',
        endDate:   '2026-02-28',
        status: 'Complete',
        percentComplete: 100,
        notes: 'Framework architecture chosen. Integration patterns for DEX products documented.',
        assignments: [
          { memberId: 'm86', part: 'QA Architect', allocation: 80 },
          { memberId: 'm87', part: 'Automation',   allocation: 80 },
        ],
      },
      {
        id: 'ph2-p19',
        phase: 'Development',
        startDate: '2026-03-01',
        endDate:   '2026-07-31',
        status: 'In Progress',
        percentComplete: 35,
        notes: 'Framework core built. IRIS and Cookie Monster integrations in progress.',
        assignments: [
          { memberId: 'm86', part: 'QA',         allocation: 80 },
          { memberId: 'm87', part: 'Automation', allocation: 80 },
        ],
      },
      {
        id: 'ph3-p19',
        phase: 'Deployed',
        startDate: '2026-08-01',
        endDate:   '2026-09-30',
        status: 'Not Started',
        percentComplete: 0,
        notes: 'Rollout plan drafted. Team onboarding sessions scheduled.',
        assignments: [
          { memberId: 'm86', part: 'QA', allocation: 60 },
        ],
      },
    ]
    const project: Project = {
      id: 'p19',
      name: 'DEX SWAT Test Automation Platform',
      description: 'Cross-product test automation framework for rapid quality validation across all SAT DEX products.',
      status: 'In Progress',
      phase: 'Development',
      priority: 'High',
      initiativeId: 'i3',
      startDate: '2026-01-01',
      targetEndDate: '2026-09-30',
      percentComplete: 45,   // avg of [100, 35, 0] across three phases
      stakeholders: 'All engineering teams',
      notes: 'Framework core built. Integrating with IRIS and Cookie Monster.',
      updatedAt: '2026-05-24T10:00:00Z',
      assignments: [
        { memberId: 'm86', part: 'QA',         allocation: 80, startDate: '2026-01-01', endDate: '2026-09-30' },
        { memberId: 'm87', part: 'Automation', allocation: 80, startDate: '2026-01-01', endDate: '2026-07-31' },
      ],
      phases,
    }
    return project
  })(),
  // ── QAOps — DEX QAOps Mavericks (i3) ─────────────────────────────────
  {
    id: 'p20',
    assignments: [
      { memberId: 'm88', part: 'QA Lead', allocation: 60, startDate: '2025-12-01', endDate: '2026-07-31' },
      { memberId: 'm89', part: 'QA',      allocation: 70, startDate: '2025-12-01', endDate: '2026-07-31' },
      { memberId: 'm90', part: 'QA',      allocation: 70, startDate: '2025-12-01', endDate: '2026-07-31' },
      { memberId: 'm95', part: 'QA',      allocation: 80, startDate: '2026-01-01', endDate: '2026-07-31' },
    ],
    name: 'Quality Operations Excellence Framework',
    description: 'Establish SAT-wide quality operations standards, metrics, and continuous testing practices.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i3', priority: 'Medium',
    startDate: '2025-12-01', targetEndDate: '2026-07-31', percentComplete: 55,
    stakeholders: 'Engineering leadership',
    notes: 'Standards defined. Adoption rollout at 60%.',
    updatedAt: '2026-05-23T10:00:00Z',
  },
  // ── DevSecOps — SAT DevSecOps (i3) ───────────────────────────────────
  // Three phases: Discovery & Standards → Pipeline Development → Team Rollout.
  // GitHub Actions standard set; security gates in dev; rollout begins Jul 2026.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p21',
        phase: 'Discovery',
        startDate: '2025-10-01',
        endDate:   '2025-12-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'GitHub Actions standard defined. SAST/DAST tooling selected.',
        assignments: [
          { memberId: 'm97', part: 'DevOps',   allocation: 80 },
          { memberId: 'm98', part: 'Security', allocation: 80 },
        ],
      },
      {
        id: 'ph2-p21',
        phase: 'Development',
        startDate: '2026-01-01',
        endDate:   '2026-06-30',
        status: 'In Progress',
        percentComplete: 55,
        notes: 'Core pipeline built. Security gates and SBOM generation in progress.',
        assignments: [
          { memberId: 'm97', part: 'DevOps',   allocation: 80 },
          { memberId: 'm98', part: 'Security', allocation: 80 },
        ],
      },
      {
        id: 'ph3-p21',
        phase: 'Deployed',
        startDate: '2026-07-01',
        endDate:   '2026-09-30',
        status: 'Not Started',
        percentComplete: 0,
        notes: 'Rollout schedule drafted. 12 teams targeted for Q3 onboarding.',
        assignments: [
          { memberId: 'm97', part: 'DevOps', allocation: 60 },
        ],
      },
    ]
    const project: Project = {
      id: 'p21',
      name: 'SAT DevSecOps CI/CD Pipeline',
      description: 'Secure, standardized CI/CD pipeline with automated SAST/DAST scanning, SBOM generation, and policy gates.',
      status: 'In Progress',
      phase: 'Development',
      priority: 'Critical',
      initiativeId: 'i3',
      startDate: '2025-10-01',
      targetEndDate: '2026-09-30',
      percentComplete: 52,   // avg of [100, 55, 0] across three phases
      stakeholders: 'All engineering teams, Security',
      notes: 'GitHub Actions standard in place. Security gates being rolled out to all teams.',
      updatedAt: '2026-05-26T11:00:00Z',
      estimatedValue: 1500000, valueType: 'Cost Savings',
      assignments: [
        { memberId: 'm97', part: 'DevOps',   allocation: 80, startDate: '2025-10-01', endDate: '2026-09-30' },
        { memberId: 'm98', part: 'Security', allocation: 80, startDate: '2025-10-01', endDate: '2026-06-30' },
      ],
      phases,
    }
    return project
  })(),
  // ── AP — AP Team (i4) ─────────────────────────────────────────────────
  {
    id: 'p22',
    assignments: [
      { memberId: 'm107', part: 'Analysis', allocation: 80, startDate: '2026-01-01', endDate: '2026-09-30' },
      { memberId: 'm110', part: 'Analysis', allocation: 80, startDate: '2026-01-01', endDate: '2026-09-30' },
      { memberId: 'm111', part: 'Analysis', allocation: 70, startDate: '2026-01-01', endDate: '2026-09-30' },
    ],
    name: 'AP Automation Platform',
    description: 'Automate accounts payable workflows: invoice matching, approval routing, and payment processing.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i4', priority: 'High',
    startDate: '2026-01-01', targetEndDate: '2026-09-30', percentComplete: 45,
    stakeholders: 'Finance, Procurement',
    notes: 'Invoice matching engine built. Approval workflow in development.',
    updatedAt: '2026-05-22T14:00:00Z',
    estimatedValue: 2000000, valueType: 'Cost Savings',
  },
  // ── Compliance (i4) ───────────────────────────────────────────────────
  // Three phases: Research & Requirements → Development → QA & Certification.
  // Food safety module built; labor compliance module in development.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p23',
        phase: 'Research',
        startDate: '2026-02-01',
        endDate:   '2026-03-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'Regulatory requirements documented with Legal. Food safety rules validated.',
        assignments: [
          { memberId: 'm114', part: 'Analysis', allocation: 70 },
          { memberId: 'm115', part: 'Analysis', allocation: 70 },
        ],
      },
      {
        id: 'ph2-p23',
        phase: 'Development',
        startDate: '2026-04-01',
        endDate:   '2026-08-31',
        status: 'In Progress',
        percentComplete: 30,
        notes: 'Food safety module complete. Labor compliance in development.',
        assignments: [
          { memberId: 'm114', part: 'Backend', allocation: 70 },
          { memberId: 'm115', part: 'Backend', allocation: 70 },
          { memberId: 'm116', part: 'Backend', allocation: 80 },
          { memberId: 'm113', part: 'QA',      allocation: 60 },
        ],
      },
      {
        id: 'ph3-p23',
        phase: 'QA',
        startDate: '2026-09-01',
        endDate:   '2026-10-31',
        status: 'Not Started',
        percentComplete: 0,
        notes: 'Certification testing plan drafted with Compliance team.',
        assignments: [
          { memberId: 'm113', part: 'QA',      allocation: 60 },
          { memberId: 'm114', part: 'Backend', allocation: 40 },
        ],
      },
    ]
    const project: Project = {
      id: 'p23',
      name: 'Regulatory Compliance Platform',
      description: 'Automated compliance monitoring and reporting for food safety, labor, and financial regulations.',
      status: 'In Progress',
      phase: 'Development',
      priority: 'Critical',
      initiativeId: 'i4',
      startDate: '2026-02-01',
      targetEndDate: '2026-10-31',
      percentComplete: 40,
      stakeholders: 'Legal, Compliance, Finance',
      notes: 'Food safety module complete. Labor compliance in development.',
      updatedAt: '2026-05-25T13:00:00Z',
      assignments: [
        { memberId: 'm114', part: 'Backend', allocation: 70, startDate: '2026-02-01', endDate: '2026-10-31' },
        { memberId: 'm115', part: 'Backend', allocation: 70, startDate: '2026-02-01', endDate: '2026-08-31' },
        { memberId: 'm116', part: 'Backend', allocation: 80, startDate: '2026-04-01', endDate: '2026-08-31' },
        { memberId: 'm113', part: 'QA',      allocation: 60, startDate: '2026-04-01', endDate: '2026-10-31' },
      ],
      phases,
    }
    return project
  })(),
  // ── Labor & Productivity (i5) ─────────────────────────────────────────
  {
    id: 'p24',
    assignments: [
      { memberId: 'm120', part: 'Backend', allocation: 80, startDate: '2026-01-01', endDate: '2026-10-31' },
      { memberId: 'm121', part: 'Product Management',      allocation: 70, startDate: '2026-01-01', endDate: '2026-10-31' },
      { memberId: 'm122', part: 'Product Management',      allocation: 60, startDate: '2026-01-01', endDate: '2026-10-31' },
    ],
    name: 'Labor Productivity Analytics',
    description: 'Real-time labor productivity dashboards with KPI benchmarking across stores and departments.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i5', priority: 'High',
    startDate: '2026-01-01', targetEndDate: '2026-10-31', percentComplete: 40,
    stakeholders: 'HR, Store Ops, Finance',
    notes: 'Core dashboard built. Store-level drill-down in development.',
    updatedAt: '2026-05-23T10:00:00Z',
  },
  // ── Architecture (i5) ─────────────────────────────────────────────────
  // Three phases: Discovery & Inventory → Standards Development → Review & Publication.
  // API standards v1 published; event-driven and security patterns in dev.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p25',
        phase: 'Discovery',
        startDate: '2025-10-01',
        endDate:   '2026-01-31',
        status: 'Complete',
        percentComplete: 100,
        notes: 'Existing patterns inventoried. Gaps identified across all domains.',
        assignments: [
          { memberId: 'm124', part: 'Architecture', allocation: 60 },
          { memberId: 'm125', part: 'Architecture', allocation: 60 },
        ],
      },
      {
        id: 'ph2-p25',
        phase: 'Development',
        startDate: '2026-02-01',
        endDate:   '2026-08-31',
        status: 'In Progress',
        percentComplete: 55,
        notes: 'API standards v1 published. Event-driven patterns in stakeholder review.',
        assignments: [
          { memberId: 'm124', part: 'Architecture', allocation: 60 },
          { memberId: 'm125', part: 'Architecture', allocation: 60 },
          { memberId: 'm126', part: 'Architecture', allocation: 70 },
        ],
      },
      {
        id: 'ph3-p25',
        phase: 'Deployed',
        startDate: '2026-09-01',
        endDate:   '2026-12-31',
        status: 'Not Started',
        percentComplete: 0,
        notes: 'Publication plan drafted. CTO review session scheduled for Q4.',
        assignments: [
          { memberId: 'm124', part: 'Architecture', allocation: 40 },
          { memberId: 'm125', part: 'Architecture', allocation: 40 },
          { memberId: 'm126', part: 'Architecture', allocation: 50 },
        ],
      },
    ]
    const project: Project = {
      id: 'p25',
      name: 'SAT Reference Architecture',
      description: 'Define and document SAT reference architecture: API design standards, event-driven patterns, and security baselines.',
      status: 'In Progress',
      phase: 'Development',
      priority: 'High',
      initiativeId: 'i5',
      startDate: '2025-10-01',
      targetEndDate: '2026-12-31',
      percentComplete: 50,
      stakeholders: 'All engineering teams',
      notes: 'API standards v1 published. Event-driven patterns in review.',
      updatedAt: '2026-05-24T11:00:00Z',
      assignments: [
        { memberId: 'm124', part: 'Architecture', allocation: 60, startDate: '2025-10-01', endDate: '2026-12-31' },
        { memberId: 'm125', part: 'Architecture', allocation: 60, startDate: '2025-10-01', endDate: '2026-12-31' },
        { memberId: 'm126', part: 'Architecture', allocation: 70, startDate: '2026-02-01', endDate: '2026-12-31' },
      ],
      phases,
    }
    return project
  })(),
  // ── KPF (i4) ──────────────────────────────────────────────────────────
  {
    id: 'p26',
    assignments: [
      { memberId: 'm33', part: 'Product Management',     allocation: 70, startDate: '2026-01-01', endDate: '2026-09-30' },
      { memberId: 'm34', part: 'Product Management',     allocation: 60, startDate: '2026-01-01', endDate: '2026-09-30' },
      { memberId: 'm35', part: 'Product Management',     allocation: 60, startDate: '2026-01-01', endDate: '2026-09-30' },
      { memberId: 'm41', part: 'UI Design', allocation: 60, startDate: '2026-01-01', endDate: '2026-07-31' },
    ],
    name: 'KPF Product Suite Redesign',
    description: 'Cross-KPF UX redesign for credit card, gift cards, and money services products.',
    status: 'In Progress', phase: 'Discovery', initiativeId: 'i4', priority: 'High',
    startDate: '2026-01-01', targetEndDate: '2026-09-30', percentComplete: 25,
    stakeholders: 'KPF, Finance',
    notes: 'Research complete. Wireframes in stakeholder review.',
    updatedAt: '2026-05-20T09:00:00Z',
  },
  {
    id: 'p27',
    assignments: [
      { memberId: 'm42', part: 'UI Design', allocation: 70, startDate: '2026-02-01', endDate: '2026-08-31' },
    ],
    name: 'Gift Card Digital Experience',
    description: 'Digital gift card purchasing and management experience for Kroger web and mobile channels.',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i4', priority: 'Medium',
    startDate: '2026-02-01', targetEndDate: '2026-08-31', percentComplete: 15,
    stakeholders: 'KPF, Marketing',
    notes: 'Competitive analysis complete. Requirements gathering in progress.',
    updatedAt: '2026-05-15T09:00:00Z',
  },
  // ── FY2025 COMPLETED PROJECTS ──────────────────────────────────────────
  // All five shipped during FY2025 (Feb 2025 – Jan 2026).  Status = Complete,
  // percentComplete = 100.  Included so analytics charts show a historical
  // baseline to compare against current FY2026 delivery pace.

  {
    id: 'p31',
    assignments: [
      { memberId: 'm12', part: 'Backend',            allocation: 60, startDate: '2025-02-01', endDate: '2025-07-31' },
      { memberId: 'm14', part: 'Backend',            allocation: 50, startDate: '2025-02-01', endDate: '2025-07-31' },
      { memberId: 'm19', part: 'UX Research',        allocation: 40, startDate: '2025-02-01', endDate: '2025-04-30' },
    ],
    name: 'IRIS v1 Mobile Overhaul',
    description: 'Rebuilt the IRIS associate app on a native mobile framework with offline support, biometric login, and a redesigned task-management UI.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i6', priority: 'Critical',
    startDate: '2025-02-01', targetEndDate: '2025-07-31', percentComplete: 100,
    stakeholders: 'Store Ops, Seamless AX',
    notes: 'Shipped to all stores July 2025. 94% associate adoption within 60 days.',
    updatedAt: '2025-07-31T17:00:00Z',
    estimatedValue: 3800000, valueType: 'Revenue Impact',
  },
  {
    id: 'p32',
    assignments: [
      { memberId: 'm20', part: 'Product Management', allocation: 60, startDate: '2025-03-01', endDate: '2025-10-31' },
      { memberId: 'm23', part: 'UX Research',        allocation: 50, startDate: '2025-03-01', endDate: '2025-06-30' },
      { memberId: 'm24', part: 'UI Design',          allocation: 60, startDate: '2025-04-01', endDate: '2025-10-31' },
      { memberId: 'm25', part: 'Backend',            allocation: 70, startDate: '2025-05-01', endDate: '2025-10-31' },
    ],
    name: 'Cookie Monster v2',
    description: 'Second major version of Cookie Monster: rule engine rewrite, drag-and-drop discount builder, and real-time preview across all store formats.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i6', priority: 'High',
    startDate: '2025-03-01', targetEndDate: '2025-10-31', percentComplete: 100,
    stakeholders: 'Merchandising, Store Ops',
    notes: 'Launched Oct 2025. Promotion config time reduced by 70%.',
    updatedAt: '2025-10-31T16:00:00Z',
    estimatedValue: 2200000, valueType: 'Cost Savings',
  },
  {
    id: 'p33',
    assignments: [
      { memberId: 'm97', part: 'DevOps',     allocation: 80, startDate: '2025-04-01', endDate: '2025-09-30' },
      { memberId: 'm98', part: 'Security',   allocation: 70, startDate: '2025-04-01', endDate: '2025-09-30' },
      { memberId: 'm96', part: 'DevOps',     allocation: 60, startDate: '2025-04-01', endDate: '2025-09-30' },
    ],
    name: 'SAT CI/CD Foundation',
    description: 'Standardized CI/CD pipelines across all 35 SAT teams: GitHub Actions templates, automated security gates, and container image scanning.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i7', priority: 'High',
    startDate: '2025-04-01', targetEndDate: '2025-09-30', percentComplete: 100,
    stakeholders: 'All engineering teams',
    notes: 'Shipped Sep 2025. All 35 teams migrated. Mean deploy time down 45%.',
    updatedAt: '2025-09-30T15:00:00Z',
    estimatedValue: 1200000, valueType: 'Cost Savings',
  },
  {
    id: 'p34',
    assignments: [
      { memberId: 'm5',  part: 'Backend',      allocation: 70, startDate: '2025-05-01', endDate: '2025-11-30' },
      { memberId: 'm6',  part: 'Backend',      allocation: 60, startDate: '2025-05-01', endDate: '2025-11-30' },
      { memberId: 'm8',  part: 'Architecture', allocation: 50, startDate: '2025-05-01', endDate: '2025-08-31' },
    ],
    name: 'Unified Auth Service',
    description: 'Centralized OAuth 2.0 / SAML SSO service replacing 8 separate login systems across SAT products.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i7', priority: 'Critical',
    startDate: '2025-05-01', targetEndDate: '2025-11-30', percentComplete: 100,
    stakeholders: 'Security, All engineering teams',
    notes: 'Launched Nov 2025. All SAT products migrated off legacy auth.',
    updatedAt: '2025-11-30T17:00:00Z',
    estimatedValue: 900000, valueType: 'Cost Savings',
  },
  {
    id: 'p35',
    assignments: [
      { memberId: 'm68', part: 'Backend',      allocation: 70, startDate: '2025-06-01', endDate: '2025-12-31' },
      { memberId: 'm69', part: 'Architecture', allocation: 60, startDate: '2025-06-01', endDate: '2025-10-31' },
      { memberId: 'm70', part: 'QA',           allocation: 60, startDate: '2025-09-01', endDate: '2025-12-31' },
    ],
    name: 'FAST Labor Scheduler v1',
    description: 'First version of the AI-assisted labor scheduling engine for production departments, replacing the legacy spreadsheet-based process.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i6', priority: 'High',
    startDate: '2025-06-01', targetEndDate: '2025-12-31', percentComplete: 100,
    stakeholders: 'Store Ops, HR',
    notes: 'Deployed to 120 stores by Dec 2025. Labor waste down 18%.',
    updatedAt: '2025-12-31T16:00:00Z',
    estimatedValue: 4100000, valueType: 'Cost Savings',
  },

  // ── EARLY FY2026 COMPLETED PROJECTS ────────────────────────────────────
  // Shipped in Q1–Q2 FY2026 (Feb–Jul 2026); status = Complete.
  // Show that the team continued to ship even while FY2026 programs ramped up.

  {
    id: 'p36',
    assignments: [
      { memberId: 'm7',  part: 'Frontend', allocation: 70, startDate: '2026-02-01', endDate: '2026-04-30' },
      { memberId: 'm9',  part: 'Backend',  allocation: 60, startDate: '2026-02-01', endDate: '2026-04-30' },
      { memberId: 'm19', part: 'UI Design', allocation: 40, startDate: '2026-02-01', endDate: '2026-03-31' },
    ],
    name: 'HomeBase Team Hub v1',
    description: 'Launched the HomeBase team collaboration hub with shift handoff notes, team announcements, and direct manager messaging.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i1', priority: 'Medium',
    startDate: '2026-02-01', targetEndDate: '2026-04-30', percentComplete: 100,
    stakeholders: 'Store Ops, Seamless AX',
    notes: 'Launched Apr 2026. 4,200 associates active in first week.',
    updatedAt: '2026-04-30T15:00:00Z',
    estimatedValue: 1500000, valueType: 'Revenue Impact',
  },
  {
    id: 'p37',
    assignments: [
      { memberId: 'm86', part: 'QA Architect', allocation: 70, startDate: '2026-02-01', endDate: '2026-05-31' },
      { memberId: 'm87', part: 'Automation',   allocation: 80, startDate: '2026-02-01', endDate: '2026-05-31' },
      { memberId: 'm88', part: 'QA',           allocation: 70, startDate: '2026-03-01', endDate: '2026-05-31' },
    ],
    name: 'DEX Shared Test Framework',
    description: 'Common test harness adopted by IRIS, Cookie Monster, and HomeBase teams: shared fixtures, data factories, and contract-test runner.',
    status: 'Complete', phase: 'Deployed', initiativeId: 'i3', priority: 'High',
    startDate: '2026-02-01', targetEndDate: '2026-05-31', percentComplete: 100,
    stakeholders: 'QAOps, All Seamless AX teams',
    notes: 'Shipped May 2026. Reduced regression suite runtime by 60%.',
    updatedAt: '2026-05-31T16:00:00Z',
    estimatedValue: 800000, valueType: 'Cost Savings',
  },

  // ── FY2026 BLOCKED PROJECTS ────────────────────────────────────────────
  // Two projects stalled mid-flight — dependency gaps or resourcing issues.
  // Realistic to include in analytics for blocked-project tracking.

  {
    id: 'p38',
    assignments: [
      { memberId: 'm61', part: 'Analysis',     allocation: 50, startDate: '2026-04-01', endDate: '2026-12-31' },
      { memberId: 'm64', part: 'Analysis',     allocation: 50, startDate: '2026-04-01', endDate: '2026-12-31' },
    ],
    name: 'Digital Shelf Label Integration',
    description: 'API integration between the SAT ordering system and Hanshow digital shelf label hardware across 200 pilot stores.',
    status: 'Blocked', phase: 'Development', initiativeId: 'i2', priority: 'High',
    startDate: '2026-04-01', targetEndDate: '2026-12-31', percentComplete: 20,
    stakeholders: 'Store Ops, Merchandising, Hanshow',
    notes: 'Blocked: Hanshow API documentation incomplete. Vendor engagement ongoing.',
    updatedAt: '2026-05-15T10:00:00Z',
    blockedByIds: [],
  },
  {
    id: 'p39',
    assignments: [
      { memberId: 'm107', part: 'Analysis',          allocation: 60, startDate: '2026-05-01', endDate: '2027-03-31' },
      { memberId: 'm33',  part: 'Product Management', allocation: 50, startDate: '2026-05-01', endDate: '2027-03-31' },
    ],
    name: 'Money Services Platform Rewrite',
    description: 'Full rewrite of the KPF money services backend on a modern microservices stack with enhanced regulatory reporting.',
    status: 'Blocked', phase: 'Discovery', initiativeId: 'i4', priority: 'Critical',
    startDate: '2026-05-01', targetEndDate: '2027-03-31', percentComplete: 10,
    stakeholders: 'KPF, Legal, Compliance, Finance',
    notes: 'Blocked: pending legal sign-off on new data residency requirements. Expected Q3 2026.',
    updatedAt: '2026-05-28T11:00:00Z',
    blockedByIds: [],
  },

  // ── FY2027 PLANNED PROJECTS ────────────────────────────────────────────
  // Backlog / Planning status — dates in FY2027 (Feb 2027 – Jan 2028).
  // Assignments are sparse or absent: staffing decisions happen closer to start.
  // These give the analytics page future-roadmap visibility.

  {
    id: 'p40',
    assignments: [],
    name: 'Real-Time Store Intelligence Dashboard',
    description: 'Unified AI analytics dashboard surfacing live labor, inventory, and sales signals to store managers and district leads.',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i8', priority: 'Critical',
    startDate: '2027-02-01', targetEndDate: '2027-09-30', percentComplete: 0,
    stakeholders: 'Store Ops, Finance, HR',
    notes: 'In roadmap planning. Requires FY2027 headcount approval.',
    updatedAt: '2026-05-01T09:00:00Z',
    estimatedValue: 6000000, valueType: 'Revenue Impact',
  },
  {
    id: 'p41',
    assignments: [],
    name: 'Predictive Labor Planning Engine',
    description: 'Extend FAST with multi-week forecasting: demand signals from Merchandising + historical patterns to auto-generate 4-week labor plans.',
    status: 'Backlog', phase: 'Research', initiativeId: 'i8', priority: 'High',
    startDate: '2027-03-01', targetEndDate: '2027-11-30', percentComplete: 0,
    stakeholders: 'HR, Store Ops, Finance',
    notes: 'Scoping in progress. Estimated XL effort — 6 engineers for 9 months.',
    updatedAt: '2026-05-10T09:00:00Z',
    estimatedValue: 5500000, valueType: 'Cost Savings',
  },
  {
    id: 'p42',
    assignments: [],
    name: 'Smart Inventory Replenishment',
    description: 'ML-driven replenishment recommendations integrated into the ordering workflow, replacing static reorder points with dynamic demand sensing.',
    status: 'Backlog', phase: 'Research', initiativeId: 'i8', priority: 'High',
    startDate: '2027-04-01', targetEndDate: '2027-12-31', percentComplete: 0,
    stakeholders: 'Supply Chain, Merchandising',
    notes: 'Dependent on Intelligent Ordering System (p17) shipping and stabilizing first.',
    updatedAt: '2026-04-20T09:00:00Z',
    estimatedValue: 7200000, valueType: 'Revenue Impact',
  },
  {
    id: 'p43',
    assignments: [],
    name: 'Associate Platform 3.0 — Core Shell',
    description: 'Single unified shell app replacing IRIS, Cookie Monster, and HomeBase with a shared navigation, notification, and personalization layer.',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i9', priority: 'Critical',
    startDate: '2027-02-01', targetEndDate: '2027-12-31', percentComplete: 0,
    stakeholders: 'Seamless AX, Store Ops, HR',
    notes: 'Requires completion of IRIS Platform v2 (p1) and Cookie Monster Promotions Engine (p3).',
    updatedAt: '2026-05-15T09:00:00Z',
    estimatedValue: 9500000, valueType: 'Revenue Impact',
  },
  {
    id: 'p44',
    assignments: [],
    name: 'Personalized Associate Workspace',
    description: 'Role-based personalization layer for Associate Platform 3.0: customizable task tiles, department-specific widgets, and adaptive notifications.',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i9', priority: 'High',
    startDate: '2027-06-01', targetEndDate: '2028-01-31', percentComplete: 0,
    stakeholders: 'Seamless AX, HR, Store Ops',
    notes: 'Blocked by Associate Platform 3.0 Core Shell (p43). Planned for H2 FY2027.',
    updatedAt: '2026-05-15T09:00:00Z',
    estimatedValue: 4800000, valueType: 'Revenue Impact',
  },

  // ── Unassigned — shown as examples of backlog work ────────────────────
  {
    id: 'p28',
    assignments: [],
    name: 'Money Services Compliance Update',
    description: 'Regulatory compliance updates for money services products to meet updated state requirements.',
    status: 'Backlog', phase: 'Research', initiativeId: 'i4', priority: 'Critical',
    startDate: '2026-07-01', targetEndDate: '2027-01-31', percentComplete: 5,
    stakeholders: 'Legal, Compliance, KPF',
    notes: 'Awaiting legal analysis. Legal team engaged.',
    updatedAt: '2026-05-10T09:00:00Z',
  },
  {
    id: 'p29',
    assignments: [],
    name: 'L3 Support Knowledge Base',
    description: 'Centralized knowledge base for SAT L3 support with runbooks, known issues, and escalation paths.',
    status: 'Backlog', phase: 'Discovery', initiativeId: 'i3', priority: 'Medium',
    startDate: '2026-08-01', targetEndDate: '2027-01-31', percentComplete: 0,
    stakeholders: 'Engineering, Support',
    notes: 'Not yet started. Planned for Q3 2026.',
    updatedAt: '2026-04-20T09:00:00Z',
  },

  // ── Multi-phase example — shows the project builder in action ─────────────
  // This project is intentionally structured as a full three-phase plan:
  // Discovery → Development → QA & Deploy. Each phase has its own team,
  // dates, and progress. The root-level fields are pre-derived from the
  // phases so the Gantt and all other views continue to work.
  (() => {
    const phases: ProjectPhaseStep[] = [
      {
        id: 'ph1-p30',
        phase: 'Discovery',
        startDate: '2026-02-02',
        endDate:   '2026-04-04',
        status: 'Complete',
        percentComplete: 100,
        notes: 'User research complete. Requirements doc signed off.',
        assignments: [
          { memberId: 'm19', part: 'UX Research',        allocation: 70 },
        ],
      },
      {
        id: 'ph2-p30',
        phase: 'Development',
        startDate: '2026-04-07',
        endDate:   '2026-08-01',
        status: 'In Progress',
        percentComplete: 40,
        notes: 'Core API layer complete. Frontend build in progress.',
        assignments: [
          { memberId: 'm6',  part: 'Backend',            allocation: 70 },
          { memberId: 'm7',  part: 'Frontend',           allocation: 70 },
          { memberId: 'm20', part: 'Product Management', allocation: 30 },
        ],
      },
      {
        id: 'ph3-p30',
        phase: 'QA',
        startDate: '2026-08-03',
        endDate:   '2026-09-26',
        status: 'Not Started',
        percentComplete: 0,
        notes: 'Test plan drafted. Awaiting development handoff.',
        assignments: [
          { memberId: 'm16', part: 'QA Lead', allocation: 80 },
          { memberId: 'm6',  part: 'Backend', allocation: 30 },
        ],
      },
    ]

    // Derived root-level fields — computed from phases so the Gantt, Dashboard,
    // and Analytics views all work without any changes.
    const project: Project = {
      id: 'p30',
      name: 'Store Associate Portal Redesign',
      description: 'Full redesign of the in-store associate portal: new UX, modernized API layer, and consolidated tooling across checkout, inventory, and task management.',
      status: 'In Progress',
      phase: 'Development',          // first In Progress phase
      priority: 'High',
      initiativeId: 'i1',
      startDate: '2026-02-02',       // earliest phase start
      targetEndDate: '2026-09-26',   // latest phase end
      percentComplete: 47,           // avg of [100, 40, 0] ≈ 47
      stakeholders: 'Store Ops, Merchandising, Finance',
      notes: 'Discovery complete. Development 40% done. QA begins August.',
      updatedAt: '2026-06-01T10:00:00Z',
      estimatedValue: 2800000,
      valueType: 'Revenue Impact',
      // Merged union of all phase assignments (min startDate / max endDate per member)
      assignments: [
        { memberId: 'm19', part: 'UX Research',        allocation: 70, startDate: '2026-02-02', endDate: '2026-04-04' },
        { memberId: 'm6',  part: 'Backend',            allocation: 70, startDate: '2026-04-07', endDate: '2026-09-26' },
        { memberId: 'm7',  part: 'Frontend',           allocation: 70, startDate: '2026-04-07', endDate: '2026-08-01' },
        { memberId: 'm20', part: 'Product Management', allocation: 30, startDate: '2026-04-07', endDate: '2026-08-01' },
        { memberId: 'm16', part: 'QA Lead',            allocation: 80, startDate: '2026-08-03', endDate: '2026-09-26' },
      ],
      phases,
    }
    return project
  })(),
]

// ─── Intake Requests ──────────────────────────────────────────────────────

const intakeRequests: IntakeRequest[] = [
  {
    id: 'r1',
    requesterName: 'Jean Olasov',
    teamOrDomain: 'Core Services',
    description: 'Real-time store performance dashboard visible to all store managers, showing live sales, labor, and inventory metrics.',
    capabilityType: 'New',
    hasFunding: 'Yes',
    businessJustification: 'Store managers currently rely on end-of-day reports. A real-time dashboard would allow same-day course corrections on labor and inventory.',
    measurementPlan: 'Track adoption rate (target: 80% of managers using daily within 3 months). Measure reduction in store-level escalations.',
    estimatedEffort: 'L',
    priority: 'High',
    businessOwner: 'Sam Saleh',
    networkImpact: 'Data polling every 60 seconds — minimal bandwidth impact. Uses existing store network infrastructure.',
    requestedByDate: '2026-10-01',
    status: 'Approved',
    submittedAt: '2026-04-15T10:00:00Z',
  },
  {
    id: 'r2',
    requesterName: 'Samuel Bryant',
    teamOrDomain: 'Seamless AX',
    description: 'Push notifications to associate mobile devices for task assignments, schedule changes, and urgent store communications.',
    capabilityType: 'Existing',
    hasFunding: 'No',
    businessJustification: 'Associates miss critical task updates sent via manager broadcast. Push notification layer projected to reduce missed tasks by 40%.',
    estimatedEffort: 'M',
    priority: 'Medium',
    requestedByDate: '2026-09-01',
    status: 'Pending Review',
    submittedAt: '2026-05-12T14:00:00Z',
  },
  {
    id: 'r3',
    requesterName: 'Claire Foster',
    teamOrDomain: 'Price Execution',
    description: 'Automated nightly price audit tool that scans all shelf tags and flags discrepancies between the POS price and the shelf label.',
    capabilityType: 'New',
    hasFunding: 'Yes',
    businessJustification: 'Price discrepancies result in customer complaints and potential FTC violations. Automated auditing would catch issues before store open.',
    measurementPlan: 'Track discrepancies caught pre-open vs. reported by customers. Target: 90% caught before store open.',
    estimatedEffort: 'L',
    priority: 'High',
    businessOwner: 'Megan Clarke',
    requestedByDate: '2026-08-01',
    status: 'Pending Review',
    submittedAt: '2026-05-20T09:00:00Z',
  },
  {
    id: 'r4',
    requesterName: 'Mary Kane',
    teamOrDomain: 'Ordering',
    description: 'AI-powered order quantity recommendations based on historical sales, seasonal patterns, and current inventory levels.',
    capabilityType: 'New',
    hasFunding: 'Other',
    businessJustification: 'Manual order quantities result in 15% overstock and 8% stockouts weekly. AI recommendations projected to reduce both metrics by 50%.',
    estimatedEffort: 'XL',
    priority: 'Critical',
    requestedByDate: '2027-01-01',
    status: 'Deferred',
    submittedAt: '2026-03-01T11:00:00Z',
  },
  {
    id: 'r5',
    requesterName: 'Neil Aggarwal',
    teamOrDomain: 'DevSecOps',
    description: 'Automated software bill of materials (SBOM) generation and vulnerability tracking for all SAT application deployments.',
    capabilityType: 'New',
    hasFunding: 'Yes',
    businessJustification: 'Federal contractor requirements and Kroger security policy now require SBOM for all production deployments. Manual tracking is not scalable.',
    measurementPlan: 'SBOM coverage across all SAT services (target: 100% within 6 months). Vulnerability remediation SLA compliance rate.',
    estimatedEffort: 'M',
    priority: 'High',
    businessOwner: 'Stephen Lay',
    networkImpact: 'No store network impact — all scanning happens in CI/CD pipeline (cloud infrastructure).',
    requestedByDate: '2026-07-01',
    status: 'Approved',
    submittedAt: '2026-05-01T13:00:00Z',
  },
]

// ─── Derive cross-reference arrays ────────────────────────────────────────
// The store stores memberIds on Team and projectIds on Member as denormalized
// arrays for fast reads. We compute them here from the primary data above so
// the source of truth stays in one place.

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

  // Ensure every seed project has blockedByIds so the field is always present.
  const projectsWithBlockedBy = projects.map(p => ({
    ...p,
    blockedByIds: p.blockedByIds ?? [],
  }))

  // ── PTO blocks ──────────────────────────────────────────────────────────
  // Spread across FY2026 to give realistic stats in the Planning page.
  // Current date: 2026-06-05. Ranges chosen so stats show:
  //   On PTO Today (active on 2026-06-05): m3, m8, m15
  //   Upcoming 14 days (starts 2026-06-06 to 2026-06-19): m6, m11, m17
  //   PTO Blocks This Qtr (Q2: ~May 3 – Aug 1): all of the above + Q2 blocks
  const ptoBlocks: PtoBlock[] = [
    // ── Active today (2026-06-05) ──────────────────────────────────────────
    { id: 'pto1',  memberId: 'm3',   startDate: '2026-06-03', endDate: '2026-06-07', note: 'Family vacation' },
    { id: 'pto2',  memberId: 'm8',   startDate: '2026-06-05', endDate: '2026-06-05', note: 'Personal day' },
    { id: 'pto3',  memberId: 'm15',  startDate: '2026-06-02', endDate: '2026-06-10', note: 'Trip abroad' },

    // ── Upcoming within 14 days (starts after today, before 2026-06-19) ───
    { id: 'pto4',  memberId: 'm6',   startDate: '2026-06-08', endDate: '2026-06-12', note: 'Vacation' },
    { id: 'pto5',  memberId: 'm11',  startDate: '2026-06-09', endDate: '2026-06-10', note: 'Doctor appointments' },
    { id: 'pto6',  memberId: 'm17',  startDate: '2026-06-16', endDate: '2026-06-20', note: 'Wedding' },

    // ── Earlier Q2 FY2026 blocks (May 3 – Aug 1) ─────────────────────────
    { id: 'pto7',  memberId: 'm1',   startDate: '2026-05-18', endDate: '2026-05-22', note: 'Spring break' },
    { id: 'pto8',  memberId: 'm5',   startDate: '2026-05-25', endDate: '2026-05-29', note: 'Memorial Day week' },
    { id: 'pto9',  memberId: 'm7',   startDate: '2026-06-22', endDate: '2026-06-26', note: 'Summer vacation' },
    { id: 'pto10', memberId: 'm12',  startDate: '2026-06-29', endDate: '2026-07-03', note: 'Fourth of July trip' },
    { id: 'pto11', memberId: 'm16',  startDate: '2026-07-06', endDate: '2026-07-10', note: 'Vacation' },
    { id: 'pto12', memberId: 'm20',  startDate: '2026-07-13', endDate: '2026-07-17', note: 'Beach trip' },
    { id: 'pto13', memberId: 'm25',  startDate: '2026-07-20', endDate: '2026-07-24', note: 'Family reunion' },

    // ── Q3 FY2026 (Aug – Oct) ─────────────────────────────────────────────
    { id: 'pto14', memberId: 'm2',   startDate: '2026-08-10', endDate: '2026-08-14', note: 'Summer vacation' },
    { id: 'pto15', memberId: 'm14',  startDate: '2026-08-24', endDate: '2026-08-28', note: 'Back-to-school travel' },
    { id: 'pto16', memberId: 'm26',  startDate: '2026-09-07', endDate: '2026-09-11', note: 'Labor Day extension' },
    { id: 'pto17', memberId: 'm4',   startDate: '2026-09-21', endDate: '2026-09-25', note: 'Personal trip' },
    { id: 'pto18', memberId: 'm21',  startDate: '2026-10-05', endDate: '2026-10-09', note: 'Fall break' },

    // ── Q4 FY2026 (Oct – Jan) ─────────────────────────────────────────────
    { id: 'pto19', memberId: 'm28',  startDate: '2026-11-23', endDate: '2026-11-27', note: 'Thanksgiving' },
    { id: 'pto20', memberId: 'm29',  startDate: '2026-11-23', endDate: '2026-11-27', note: 'Thanksgiving week' },
    { id: 'pto21', memberId: 'm9',   startDate: '2026-12-21', endDate: '2026-12-31', note: 'Holiday break' },
    { id: 'pto22', memberId: 'm13',  startDate: '2026-12-24', endDate: '2026-12-31', note: 'Holiday travel' },
    { id: 'pto23', memberId: 'm32',  startDate: '2027-01-02', endDate: '2027-01-02', note: 'New Year bridge day' },
  ]

  // ── Weekly Pulses — design team, week of 2026-06-15 ──────────────────────
  // Representative entries for Tyler Freeman's direct reports, seeded so the
  // Pulse page has visible data on first launch without manual entry.
  const weeklyPulses: WeeklyPulse[] = [
    {
      // Taylor Rose — matches the user's Design Pulse example closely
      id: 'pulse1',
      memberId: 'm23',
      weekOf: '2026-06-15',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Remaining AI Driver\'s License Sections',         size: 'L'  },
        { text: 'Finish Store Interviews (Scan Coordinator)',       size: 'M'  },
        { text: 'Web Space Planning',                              size: 'S'  },
        { text: 'Peer-to-Peer APK live in Alpha - Store Testing',  size: 'M'  },
        { text: 'Finish Design Epics',                             size: 'S'  },
      ],
      priorityTags: ['AI', 'DSL'],
      upcoming: [
        { text: 'OOO - 6/19–6/26', size: 'L' },
        { text: 'Research: Improving Target Audience for Notifications', size: 'M' },
        { text: 'Feature release: Mobile Reporting - Ad Processing', size: 'S' },
        { text: 'Feature release: Page Flip - display out of stock message on DSL', size: 'S' },
      ],
      developmentFocus: [
        { text: 'Designing w/ AI', size: 'M' },
        { text: 'IOT & Edge', size: 'M' },
      ],
      objectives: [
        {
          product: 'Digital Shelf Labels',
          objectives: [
            'OBJ: Use Cases + Features/Capabilities that unlock partner and store value',
            'OBJ: Accelerate end-to-end tag and sign execution by delivering a hackathon prototype',
            'OBJ: Begin the shift from being reactive to proactive for digital tag support + comms',
          ],
          sideQuests: [],
        },
        {
          product: 'Notifications',
          objectives: ['TBD — can\'t access in Upraise'],
          sideQuests: [
            'Research Plan - HMW reduce lost sales due to out-of-stock product?',
          ],
        },
      ],
      updatedAt: '2026-06-13T16:30:00.000Z',
    },
    {
      // David Henson — busy week
      id: 'pulse2',
      memberId: 'm19',
      weekOf: '2026-06-15',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'IRIS Phase 2 UX handoff to engineering',   size: 'XL' },
        { text: 'Conduct usability testing sessions (x3)',  size: 'L'  },
        { text: 'Update design system component library',   size: 'M'  },
      ],
      priorityTags: ['IRIS'],
      upcoming: [
        { text: 'Usability testing sessions: 6/17, 6/18', size: 'L' },
        { text: 'Sprint review presentation: 6/19', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Design Systems', size: 'M' },
        { text: 'Accessibility', size: 'M' },
      ],
      objectives: [
        {
          product: 'IRIS Platform',
          objectives: [
            'OBJ: Deliver polished UX specs for Phase 2 re-architecture',
            'OBJ: Validate information architecture through usability testing',
          ],
          sideQuests: ['Explore motion design patterns for transitions'],
        },
      ],
      updatedAt: '2026-06-13T15:00:00.000Z',
    },
    {
      // Sydney Baker — light week
      id: 'pulse3',
      memberId: 'm24',
      weekOf: '2026-06-15',
      workloadSentiment: 2,
      currentPriorities: [
        { text: 'HomeBase team hub design review',    size: 'M' },
        { text: 'Gather feedback from pilot stores',  size: 'L' },
      ],
      priorityTags: ['HomeBase'],
      upcoming: [
        { text: 'OOO - 6/16 (doctor appointment)', size: 'S' },
        { text: 'Pilot store feedback synthesis due 6/20', size: 'M' },
      ],
      developmentFocus: [
        { text: 'User Research', size: 'M' },
        { text: 'Prototyping', size: 'M' },
      ],
      objectives: [
        {
          product: 'HomeBase',
          objectives: ['OBJ: Complete v1 design validation with 3 pilot stores'],
          sideQuests: ['Spatial Intelligence research [Help Syd]'],
        },
      ],
      updatedAt: '2026-06-13T14:15:00.000Z',
    },
    {
      // Christopher Reed — just right
      id: 'pulse4',
      memberId: 'm42',
      weekOf: '2026-06-15',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'DEX shared component audit',                  size: 'L'  },
        { text: 'Storybook documentation for 5 core components', size: 'XL' },
        { text: 'Review contractor design deliverables',        size: 'M'  },
      ],
      priorityTags: ['DEX'],
      upcoming: [
        { text: 'DEX sync with engineering: 6/17', size: 'M' },
        { text: 'Component library v2 release: 6/30 target', size: 'L' },
      ],
      developmentFocus: [
        { text: 'Design Engineering', size: 'M' },
        { text: 'Design Systems', size: 'M' },
      ],
      objectives: [
        {
          product: 'DEX (Developer + Designer Experience)',
          objectives: [
            'OBJ: Establish shared component library used across 3+ teams',
            'OBJ: Document all components in Storybook with usage guidelines',
          ],
          sideQuests: ['HMW better understand what work is active and upcoming'],
        },
      ],
      updatedAt: '2026-06-13T17:00:00.000Z',
    },

    // ── Week of June 1 — 7 new members ──

    {
      // Ryan Holloway — search + DSL busy sprint
      id: 'pulse30',
      memberId: 'm27',
      weekOf: '2026-06-01',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Search: zero-result page redesign handoff to eng',       size: 'L' },
        { text: 'Associate performance dashboard — stakeholder review',   size: 'M' },
        { text: 'DSL admin panel: finalize icon set',                     size: 'S' },
      ],
      priorityTags: ['Cookie Monster', 'DSL'],
      upcoming: [
        { text: 'Search handoff session: 6/3', size: 'M' },
        { text: 'DSL admin review: 6/4', size: 'S' },
      ],
      developmentFocus: [
        { text: 'Design Systems', size: 'M' },
      ],
      objectives: [
        {
          product: 'Cookie Monster / Search',
          objectives: ['OBJ: Improve search relevance UX to reduce zero-result exits'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-30T15:30:00.000Z',
    },
    {
      // Isabelle Renard — light week, onboarding in review
      id: 'pulse31',
      memberId: 'm41',
      weekOf: '2026-06-01',
      workloadSentiment: 2,
      currentPriorities: [
        { text: 'Onboarding flow: incorporate design critique feedback', size: 'M' },
        { text: 'Associate performance: competitive analysis',           size: 'L' },
      ],
      priorityTags: ['Cookie Monster'],
      upcoming: [
        { text: 'Onboarding prototype demo: 6/4', size: 'S' },
      ],
      developmentFocus: [
        { text: 'Research Methods', size: 'M' },
        { text: 'Interaction Design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Cookie Monster / Associate Performance',
          objectives: ['OBJ: Reduce associate onboarding time through clearer UX'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-30T13:00:00.000Z',
    },
    {
      // Ryan Rooney — recalls triage in full swing
      id: 'pulse32',
      memberId: 'm43',
      weekOf: '2026-06-01',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'Recalls triage redesign: high-fidelity prototype',       size: 'XL' },
        { text: 'SPA audit tool: final IA walkthrough with stakeholders', size: 'L'  },
        { text: 'Compliance reporting: handoff notes to engineering',     size: 'M'  },
      ],
      priorityTags: ['Compliance', 'Recalls'],
      upcoming: [
        { text: 'Recalls prototype review: 6/2', size: 'L' },
        { text: 'SPA handoff: 6/5', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Complex workflow design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Compliance / Recalls',
          objectives: ['OBJ: Reduce time-to-action for recalls exceptions by redesigning triage flow'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-30T16:00:00.000Z',
    },
    {
      // Dana Powell — ordering checkout redesign approaching handoff
      id: 'pulse33',
      memberId: 'm44',
      weekOf: '2026-06-01',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'Ordering checkout: finalize prototype for usability test', size: 'XL' },
        { text: 'Code compliance UX: document findings + recommendations', size: 'L'  },
        { text: 'Order management: stakeholder sign-off prep',             size: 'M'  },
      ],
      priorityTags: ['Code Busters'],
      upcoming: [
        { text: 'Usability test sessions: 6/3–6/4', size: 'L' },
        { text: 'Stakeholder sign-off: 6/5', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Prototyping', size: 'M' },
      ],
      objectives: [
        {
          product: 'Code Busters / Ordering',
          objectives: ['OBJ: Reduce ordering workflow errors by simplifying checkout step 3'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-30T16:30:00.000Z',
    },
    {
      // Kayla Long — post-v2 share-out, pivoting to shift management
      id: 'pulse34',
      memberId: 'm45',
      weekOf: '2026-06-01',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Production schedule v2: incorporate stakeholder feedback', size: 'L' },
        { text: 'Shift management UX: discovery kickoff',                   size: 'M' },
        { text: 'Store manager dashboard: annotation pass',                 size: 'S' },
      ],
      priorityTags: ['Freddy Kroger'],
      upcoming: [
        { text: 'Shift management discovery share-out: 6/5', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Dashboard design', size: 'M' },
        { text: 'User Research', size: 'S' },
      ],
      objectives: [
        {
          product: 'Freddy Kroger',
          objectives: ['OBJ: Ship production schedule v2 that reduces scheduling errors for store leads'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-30T14:30:00.000Z',
    },
    {
      // Tarun Kulkarni — post-usability-test synthesis
      id: 'pulse35',
      memberId: 'm46',
      weekOf: '2026-06-01',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Cycle-count usability test synthesis + report',    size: 'XL' },
        { text: 'Inventory accuracy dashboard: iteration 2 comps',  size: 'L'  },
        { text: 'Exception handling UI: initial wireframes',        size: 'M'  },
      ],
      priorityTags: ['Inventorious'],
      upcoming: [
        { text: 'Usability findings share-out: 6/4', size: 'M' },
      ],
      developmentFocus: [
        { text: 'User Research', size: 'M' },
        { text: 'Mobile UX', size: 'M' },
      ],
      objectives: [
        {
          product: 'Inventorious',
          objectives: ['OBJ: Reduce cycle-count errors through improved step-by-step flow'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-30T14:00:00.000Z',
    },
    {
      // Aaron Olson — lighter week, labor forecast prototype in review
      id: 'pulse36',
      memberId: 'm47',
      weekOf: '2026-06-01',
      workloadSentiment: 2,
      currentPriorities: [
        { text: 'FAST labor forecast prototype: address review feedback', size: 'L' },
        { text: 'Production efficiency dashboard: concept refinement',   size: 'M' },
      ],
      priorityTags: ['FAST'],
      upcoming: [
        { text: 'Labor forecast demo to product: 6/3', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Data visualization', size: 'M' },
      ],
      objectives: [
        {
          product: 'FAST',
          objectives: ['OBJ: Simplify labor forecast input to reduce manager time-on-task by 30%'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-30T13:30:00.000Z',
    },

    // ── Week of June 8 (prior week) — same reporters, different priorities ──

    {
      // Taylor Rose — prior week: busier, pre-OOO push
      id: 'pulse5',
      memberId: 'm23',
      weekOf: '2026-06-08',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'AI Driver\'s License — Section 3 wireframes',   size: 'L'  },
        { text: 'DSL board redesign stakeholder review',         size: 'M'  },
        { text: 'Store interview scheduling (Scan Coordinator)', size: 'S'  },
        { text: 'Backlog grooming with PM',                      size: 'S'  },
      ],
      priorityTags: ['AI', 'DSL'],
      upcoming: [
        { text: 'Stakeholder review: DSL board redesign (6/10)', size: 'M' },
        { text: 'OOO next week: 6/19–6/26 (heads up)', size: 'S' },
      ],
      developmentFocus: [
        { text: 'Designing w/ AI', size: 'M' },
        { text: 'IOT & Edge', size: 'M' },
      ],
      objectives: [
        {
          product: 'Digital Shelf Labels',
          objectives: [
            'OBJ: Use Cases + Features/Capabilities that unlock partner and store value',
            'OBJ: Accelerate end-to-end tag and sign execution by delivering a hackathon prototype',
          ],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-06T17:00:00.000Z',
    },
    {
      // David Henson — prior week: moderate workload
      id: 'pulse6',
      memberId: 'm19',
      weekOf: '2026-06-08',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'IRIS Phase 2 design review with product',  size: 'L'  },
        { text: 'Usability test script finalization',       size: 'M'  },
        { text: 'Update design system tokens (color)',      size: 'S'  },
      ],
      priorityTags: ['IRIS'],
      upcoming: [
        { text: 'Design review with product: 6/9', size: 'M' },
        { text: 'Recruit usability test participants by 6/11', size: 'S' },
      ],
      developmentFocus: [
        { text: 'Design Systems', size: 'M' },
        { text: 'Accessibility', size: 'M' },
      ],
      objectives: [
        {
          product: 'IRIS Platform',
          objectives: [
            'OBJ: Deliver polished UX specs for Phase 2 re-architecture',
            'OBJ: Validate information architecture through usability testing',
          ],
          sideQuests: ['Explore motion design patterns for transitions'],
        },
      ],
      updatedAt: '2026-06-06T15:00:00.000Z',
    },
    {
      // Christopher Reed — prior week: light week
      id: 'pulse7',
      memberId: 'm42',
      weekOf: '2026-06-08',
      workloadSentiment: 2,
      currentPriorities: [
        { text: 'Kick off component audit (DEX)',               size: 'M' },
        { text: 'Review open Figma comments from last sprint',  size: 'S' },
      ],
      priorityTags: ['DEX'],
      upcoming: [
        { text: 'DEX planning session: 6/10', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Design Engineering', size: 'M' },
        { text: 'Design Systems', size: 'M' },
      ],
      objectives: [
        {
          product: 'DEX (Developer + Designer Experience)',
          objectives: [
            'OBJ: Establish shared component library used across 3+ teams',
          ],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-06T14:00:00.000Z',
    },

    // ── Week of May 25 — all 11 members ──

    {
      // Taylor Rose — pre-sprint wind-down
      id: 'pulse19',
      memberId: 'm23',
      weekOf: '2026-05-25',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'AI Driver\'s License — Section 2 polish',    size: 'L' },
        { text: 'DSL board: initial concept explorations',    size: 'M' },
        { text: 'Update store interview discussion guide',     size: 'S' },
      ],
      priorityTags: ['AI', 'DSL'],
      upcoming: [
        { text: 'DSL stakeholder preview: 6/4', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Designing w/ AI', size: 'M' },
      ],
      objectives: [
        {
          product: 'Digital Shelf Labels',
          objectives: ['OBJ: Use Cases + Features/Capabilities that unlock partner and store value'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-23T16:00:00.000Z',
    },
    {
      // David Henson — IRIS Phase 2 ramp-up
      id: 'pulse20',
      memberId: 'm19',
      weekOf: '2026-05-25',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'IRIS Phase 2 scope document — draft 1',        size: 'L' },
        { text: 'Design system: color accessibility audit',     size: 'M' },
        { text: 'Stakeholder alignment meeting prep',           size: 'S' },
      ],
      priorityTags: ['IRIS'],
      upcoming: [
        { text: 'IRIS stakeholder alignment: 5/27', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Design Systems', size: 'M' },
      ],
      objectives: [
        {
          product: 'IRIS Platform',
          objectives: ['OBJ: Deliver polished UX specs for Phase 2 re-architecture'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-23T14:30:00.000Z',
    },
    {
      // Sydney Baker — pilot store prep
      id: 'pulse21',
      memberId: 'm24',
      weekOf: '2026-05-25',
      workloadSentiment: 2,
      currentPriorities: [
        { text: 'HomeBase pilot store outreach', size: 'M' },
        { text: 'Update discussion guide for store visits', size: 'S' },
      ],
      priorityTags: ['HomeBase'],
      upcoming: [
        { text: 'First pilot store visit: 6/8', size: 'L' },
      ],
      developmentFocus: [
        { text: 'User Research', size: 'M' },
      ],
      objectives: [
        {
          product: 'HomeBase',
          objectives: ['OBJ: Complete v1 design validation with 3 pilot stores'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-23T13:00:00.000Z',
    },
    {
      // Christopher Reed — DEX audit scope setting
      id: 'pulse22',
      memberId: 'm42',
      weekOf: '2026-05-25',
      workloadSentiment: 2,
      currentPriorities: [
        { text: 'Define DEX component audit scope and criteria',    size: 'M' },
        { text: 'Set up Storybook scaffolding for core components', size: 'M' },
      ],
      priorityTags: ['DEX'],
      upcoming: [
        { text: 'DEX kickoff with engineering: 6/3', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Design Engineering', size: 'M' },
      ],
      objectives: [
        {
          product: 'DEX (Developer + Designer Experience)',
          objectives: ['OBJ: Establish shared component library used across 3+ teams'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-23T12:00:00.000Z',
    },
    {
      // Ryan Holloway — search UX + DSL admin
      id: 'pulse23',
      memberId: 'm27',
      weekOf: '2026-05-25',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Search results page UX audit',                    size: 'L' },
        { text: 'Associate performance dashboard — concept v1',    size: 'M' },
        { text: 'DSL admin panel: review open design comments',    size: 'S' },
      ],
      priorityTags: ['Cookie Monster', 'DSL'],
      upcoming: [
        { text: 'Search UX review with engineering: 5/27', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Design Systems', size: 'M' },
        { text: 'User Research', size: 'S' },
      ],
      objectives: [
        {
          product: 'Cookie Monster / Search',
          objectives: ['OBJ: Improve search relevance UX to reduce zero-result exits'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-23T15:00:00.000Z',
    },
    {
      // Isabelle Renard — onboarding + research (lighter load, newer designer)
      id: 'pulse24',
      memberId: 'm41',
      weekOf: '2026-05-25',
      workloadSentiment: 2,
      currentPriorities: [
        { text: 'Associate onboarding flow wireframes — iteration 2', size: 'M' },
        { text: 'Search results research synthesis',                   size: 'L' },
      ],
      priorityTags: ['Cookie Monster'],
      upcoming: [
        { text: 'Design critique: onboarding wireframes 5/28', size: 'S' },
      ],
      developmentFocus: [
        { text: 'Research Methods', size: 'M' },
        { text: 'Interaction Design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Cookie Monster / Associate Performance',
          objectives: ['OBJ: Reduce associate onboarding time through clearer UX'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-23T13:30:00.000Z',
    },
    {
      // Ryan Rooney — SPA audit tool + recalls dashboard
      id: 'pulse25',
      memberId: 'm43',
      weekOf: '2026-05-25',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'SPA audit tool redesign — information architecture',    size: 'L' },
        { text: 'Recalls dashboard: mockups for exception triage view',  size: 'XL' },
        { text: 'Compliance reporting: filter bar update',               size: 'S' },
      ],
      priorityTags: ['Compliance', 'Recalls'],
      upcoming: [
        { text: 'Recalls dashboard review: 5/27', size: 'M' },
        { text: 'SPA audit IA walkthrough with product: 5/29', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Complex workflow design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Compliance / Recalls',
          objectives: ['OBJ: Reduce time-to-action for recalls exceptions by redesigning triage flow'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-23T14:00:00.000Z',
    },
    {
      // Dana Powell — ordering workflow + code compliance
      id: 'pulse26',
      memberId: 'm44',
      weekOf: '2026-05-25',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Ordering workflow redesign — step 3 checkout flow',   size: 'XL' },
        { text: 'Code compliance UX audit: identify friction points',  size: 'L' },
        { text: 'Order management onboarding: copyedits',              size: 'S' },
      ],
      priorityTags: ['Code Busters'],
      upcoming: [
        { text: 'Ordering flow prototype review: 5/27', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Prototyping', size: 'M' },
        { text: 'Interaction Design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Code Busters / Ordering',
          objectives: ['OBJ: Reduce ordering workflow errors by simplifying checkout step 3'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-23T15:30:00.000Z',
    },
    {
      // Kayla Long — production schedule v2 push
      id: 'pulse27',
      memberId: 'm45',
      weekOf: '2026-05-25',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'Production schedule interface v2 — high-fidelity comps', size: 'XL' },
        { text: 'Store manager dashboard: stakeholder feedback integration', size: 'L' },
        { text: 'Sprint planning + backlog grooming with PM',              size: 'S' },
      ],
      priorityTags: ['Freddy Kroger'],
      upcoming: [
        { text: 'Production schedule v2 share-out: 5/28', size: 'L' },
      ],
      developmentFocus: [
        { text: 'Dashboard design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Freddy Kroger',
          objectives: ['OBJ: Ship production schedule v2 that reduces scheduling errors for store leads'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-23T16:00:00.000Z',
    },
    {
      // Tarun Kulkarni — cycle-count UX
      id: 'pulse28',
      memberId: 'm46',
      weekOf: '2026-05-25',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Inventorious cycle-count flow redesign — step 2 & 3', size: 'L' },
        { text: 'Inventory accuracy dashboard: chart spec review',      size: 'M' },
        { text: 'Usability test planning — participant recruitment',    size: 'S' },
      ],
      priorityTags: ['Inventorious'],
      upcoming: [
        { text: 'Cycle-count prototype review: 5/26', size: 'M' },
        { text: 'Usability test sessions: 6/2–6/3', size: 'L' },
      ],
      developmentFocus: [
        { text: 'User Research', size: 'M' },
        { text: 'Mobile UX', size: 'M' },
      ],
      objectives: [
        {
          product: 'Inventorious',
          objectives: ['OBJ: Reduce cycle-count errors through improved step-by-step flow'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-23T14:00:00.000Z',
    },
    {
      // Aaron Olson — labor forecasting redesign
      id: 'pulse29',
      memberId: 'm47',
      weekOf: '2026-05-25',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'FAST labor forecast input redesign — manager view',    size: 'L' },
        { text: 'Production efficiency dashboard: concept explorations', size: 'XL' },
        { text: 'FAST onboarding flow: content audit',                  size: 'S' },
      ],
      priorityTags: ['FAST'],
      upcoming: [
        { text: 'Labor forecast prototype review: 5/27', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Data visualization', size: 'M' },
        { text: 'Complex workflow design', size: 'M' },
      ],
      objectives: [
        {
          product: 'FAST',
          objectives: ['OBJ: Simplify labor forecast input to reduce manager time-on-task by 30%'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-23T14:30:00.000Z',
    },

    // ── Week of June 1 — two weeks prior ──

    {
      // Taylor Rose — steady pre-sprint week
      id: 'pulse11',
      memberId: 'm23',
      weekOf: '2026-06-01',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'AI Driver\'s License — Section 2 layout review',  size: 'L' },
        { text: 'Schedule store interviews (Scan Coordinator)',     size: 'M' },
        { text: 'DSL board: initial concept explorations',         size: 'M' },
        { text: 'Sprint planning with PM',                         size: 'S' },
      ],
      priorityTags: ['AI', 'DSL'],
      upcoming: [
        { text: 'Sprint planning: 6/2', size: 'S' },
        { text: 'DSL stakeholder preview: 6/4', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Designing w/ AI', size: 'M' },
        { text: 'IOT & Edge', size: 'M' },
      ],
      objectives: [
        {
          product: 'Digital Shelf Labels',
          objectives: [
            'OBJ: Use Cases + Features/Capabilities that unlock partner and store value',
          ],
          sideQuests: [],
        },
        {
          product: 'Notifications',
          objectives: ['TBD — can\'t access in Upraise'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-30T16:00:00.000Z',
    },
    {
      // David Henson — kicking off IRIS Phase 2
      id: 'pulse12',
      memberId: 'm19',
      weekOf: '2026-06-01',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'IRIS Phase 2 kick-off — scope alignment with product', size: 'L' },
        { text: 'Draft IA proposal for IRIS re-architecture',           size: 'XL' },
        { text: 'Design system: accessibility audit (color pass)',      size: 'M' },
      ],
      priorityTags: ['IRIS'],
      upcoming: [
        { text: 'IRIS kick-off meeting: 6/2', size: 'M' },
        { text: 'Accessibility review with dev: 6/5', size: 'S' },
      ],
      developmentFocus: [
        { text: 'Design Systems', size: 'M' },
        { text: 'Accessibility', size: 'M' },
      ],
      objectives: [
        {
          product: 'IRIS Platform',
          objectives: [
            'OBJ: Deliver polished UX specs for Phase 2 re-architecture',
          ],
          sideQuests: ['Explore motion design patterns for transitions'],
        },
      ],
      updatedAt: '2026-05-30T14:30:00.000Z',
    },
    {
      // Sydney Baker — pilot store prep
      id: 'pulse13',
      memberId: 'm24',
      weekOf: '2026-06-01',
      workloadSentiment: 2,
      currentPriorities: [
        { text: 'HomeBase pilot store recruitment outreach', size: 'M' },
        { text: 'Update discussion guide for store visits',  size: 'S' },
      ],
      priorityTags: ['HomeBase'],
      upcoming: [
        { text: 'First pilot store visit: 6/8', size: 'L' },
      ],
      developmentFocus: [
        { text: 'User Research', size: 'M' },
        { text: 'Prototyping', size: 'M' },
      ],
      objectives: [
        {
          product: 'HomeBase',
          objectives: ['OBJ: Complete v1 design validation with 3 pilot stores'],
          sideQuests: ['Spatial Intelligence research [Help Syd]'],
        },
      ],
      updatedAt: '2026-05-30T13:00:00.000Z',
    },
    {
      // Christopher Reed — planning DEX audit
      id: 'pulse14',
      memberId: 'm42',
      weekOf: '2026-06-01',
      workloadSentiment: 2,
      currentPriorities: [
        { text: 'Define DEX component audit scope and criteria', size: 'M' },
        { text: 'Set up Storybook scaffolding for core components', size: 'M' },
      ],
      priorityTags: ['DEX'],
      upcoming: [
        { text: 'DEX kickoff with engineering: 6/3', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Design Engineering', size: 'M' },
        { text: 'Design Systems', size: 'M' },
      ],
      objectives: [
        {
          product: 'DEX (Developer + Designer Experience)',
          objectives: [
            'OBJ: Establish shared component library used across 3+ teams',
          ],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-05-30T12:00:00.000Z',
    },

    // ── Week of June 8 — Sydney Baker (gap fill) + 7 new members ──

    {
      // Sydney Baker — first pilot store visit week
      id: 'pulse37',
      memberId: 'm24',
      weekOf: '2026-06-08',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'HomeBase pilot store visit #1 — synthesis notes',  size: 'L' },
        { text: 'HomeBase v1: update prototype based on early findings', size: 'M' },
      ],
      priorityTags: ['HomeBase'],
      upcoming: [
        { text: 'Pilot store visit #2: 6/12', size: 'L' },
      ],
      developmentFocus: [
        { text: 'User Research', size: 'M' },
        { text: 'Prototyping', size: 'M' },
      ],
      objectives: [
        {
          product: 'HomeBase',
          objectives: ['OBJ: Complete v1 design validation with 3 pilot stores'],
          sideQuests: ['Spatial Intelligence research [Help Syd]'],
        },
      ],
      updatedAt: '2026-06-06T14:00:00.000Z',
    },
    {
      // Ryan Holloway — search in eng, pivoting to assoc performance
      id: 'pulse38',
      memberId: 'm27',
      weekOf: '2026-06-08',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Associate performance dashboard: iteration 2 comps', size: 'L' },
        { text: 'Search: support engineering questions on handoff',    size: 'M' },
        { text: 'Our Service Guarantee: initial discovery kickoff',    size: 'M' },
      ],
      priorityTags: ['Cookie Monster', 'DSL'],
      upcoming: [
        { text: 'Assoc performance review: 6/10', size: 'M' },
        { text: 'Our Service Guarantee kick-off: 6/9', size: 'S' },
      ],
      developmentFocus: [
        { text: 'Design Systems', size: 'M' },
      ],
      objectives: [
        {
          product: 'Cookie Monster / Search',
          objectives: ['OBJ: Improve search relevance UX to reduce zero-result exits'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-06T15:00:00.000Z',
    },
    {
      // Isabelle Renard — onboarding prototype in testing
      id: 'pulse39',
      memberId: 'm41',
      weekOf: '2026-06-08',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Associate onboarding: usability test synthesis',       size: 'L' },
        { text: 'Search results: A/B test variant mockups',             size: 'M' },
        { text: 'Team design critique: prep 3 frames for review',      size: 'S' },
      ],
      priorityTags: ['Cookie Monster'],
      upcoming: [
        { text: 'Onboarding share-out: 6/11', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Research Methods', size: 'M' },
        { text: 'Interaction Design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Cookie Monster / Associate Performance',
          objectives: ['OBJ: Reduce associate onboarding time through clearer UX'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-06T13:30:00.000Z',
    },
    {
      // Ryan Rooney — recalls prototype in usability test, SPA in engineering
      id: 'pulse40',
      memberId: 'm43',
      weekOf: '2026-06-08',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'Recalls triage: run 4 usability test sessions',        size: 'XL' },
        { text: 'SPA audit tool: answer engineering handoff questions', size: 'L'  },
        { text: 'Compliance reporting: dark mode pass',                 size: 'S'  },
      ],
      priorityTags: ['Compliance', 'Recalls'],
      upcoming: [
        { text: 'Recalls usability sessions: 6/9, 6/10, 6/11, 6/12', size: 'XL' },
      ],
      developmentFocus: [
        { text: 'Complex workflow design', size: 'M' },
        { text: 'Accessibility', size: 'S' },
      ],
      objectives: [
        {
          product: 'Compliance / Recalls',
          objectives: ['OBJ: Reduce time-to-action for recalls exceptions by redesigning triage flow'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-06T16:00:00.000Z',
    },
    {
      // Dana Powell — post-usability synthesis, ordering handoff
      id: 'pulse41',
      memberId: 'm44',
      weekOf: '2026-06-08',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Ordering checkout: usability test synthesis + report', size: 'XL' },
        { text: 'Code Busters: design handoff documentation',           size: 'L'  },
        { text: 'Order management: quick-win UX fixes from audit',      size: 'M'  },
      ],
      priorityTags: ['Code Busters'],
      upcoming: [
        { text: 'Usability findings share-out: 6/11', size: 'M' },
        { text: 'Engineering handoff: 6/12', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Prototyping', size: 'M' },
        { text: 'Interaction Design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Code Busters / Ordering',
          objectives: ['OBJ: Reduce ordering workflow errors by simplifying checkout step 3'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-06T15:30:00.000Z',
    },
    {
      // Kayla Long — extremely busy: production v2 + shift management + sprint
      id: 'pulse42',
      memberId: 'm45',
      weekOf: '2026-06-08',
      workloadSentiment: 5,
      currentPriorities: [
        { text: 'Production schedule v2: final iteration for release',    size: 'XL' },
        { text: 'Shift management UX: three concept directions',          size: 'XL' },
        { text: 'Store manager dashboard: responsive breakpoints',        size: 'L'  },
        { text: 'Sprint review prep',                                     size: 'S'  },
      ],
      priorityTags: ['Freddy Kroger'],
      upcoming: [
        { text: 'Production schedule v2 release: 6/15 target', size: 'XL' },
        { text: 'Sprint review: 6/12', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Dashboard design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Freddy Kroger',
          objectives: ['OBJ: Ship production schedule v2 that reduces scheduling errors for store leads'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-06T17:00:00.000Z',
    },
    {
      // Tarun Kulkarni — incorporating findings, exception handling
      id: 'pulse43',
      memberId: 'm46',
      weekOf: '2026-06-08',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Cycle-count: redesign step 2 & 3 based on usability findings', size: 'L' },
        { text: 'Exception handling UI: three wireframe directions',             size: 'XL' },
        { text: 'Inventory accuracy: chart annotations for stakeholder review',  size: 'S'  },
      ],
      priorityTags: ['Inventorious'],
      upcoming: [
        { text: 'Exception handling review: 6/10', size: 'M' },
      ],
      developmentFocus: [
        { text: 'User Research', size: 'M' },
        { text: 'Mobile UX', size: 'M' },
      ],
      objectives: [
        {
          product: 'Inventorious',
          objectives: ['OBJ: Reduce cycle-count errors through improved step-by-step flow'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-06T14:30:00.000Z',
    },
    {
      // Aaron Olson — labor forecast ready for demo, efficiency dashboard ramp
      id: 'pulse44',
      memberId: 'm47',
      weekOf: '2026-06-08',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'FAST labor forecast: final prototype for PM demo',          size: 'L' },
        { text: 'Production efficiency dashboard: concept direction agreed', size: 'XL' },
        { text: 'FAST onboarding: copyedit pass complete, annotate frames',  size: 'M'  },
      ],
      priorityTags: ['FAST'],
      upcoming: [
        { text: 'Labor forecast PM demo: 6/9', size: 'M' },
        { text: 'Efficiency dashboard kickoff: 6/11', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Data visualization', size: 'M' },
        { text: 'Complex workflow design', size: 'M' },
      ],
      objectives: [
        {
          product: 'FAST',
          objectives: ['OBJ: Simplify labor forecast input to reduce manager time-on-task by 30%'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-06T14:00:00.000Z',
    },

    // ── Week of June 15 — 7 new members ──

    {
      // Ryan Holloway — service guarantee discovery, assoc performance mid-sprint
      id: 'pulse45',
      memberId: 'm27',
      weekOf: '2026-06-15',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Our Service Guarantee: concept explorations (3 directions)', size: 'L' },
        { text: 'Associate performance dashboard: interaction spec',           size: 'XL' },
        { text: 'DSL admin panel: final QA pass',                             size: 'S'  },
      ],
      priorityTags: ['Cookie Monster', 'DSL'],
      upcoming: [
        { text: 'Service Guarantee concept review: 6/17', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Design Systems', size: 'M' },
      ],
      objectives: [
        {
          product: 'Cookie Monster / Search',
          objectives: ['OBJ: Improve search relevance UX to reduce zero-result exits'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-13T15:00:00.000Z',
    },
    {
      // Isabelle Renard — search variant A/B and onboarding iteration
      id: 'pulse46',
      memberId: 'm41',
      weekOf: '2026-06-15',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Search results: A/B variant — refine based on PM feedback', size: 'L' },
        { text: 'Associate onboarding: v3 handoff prep',                     size: 'M' },
        { text: 'Competitive analysis: associate performance tools',         size: 'M' },
      ],
      priorityTags: ['Cookie Monster'],
      upcoming: [
        { text: 'Search A/B review: 6/18', size: 'M' },
        { text: 'Onboarding v3 handoff: 6/19', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Interaction Design', size: 'M' },
        { text: 'Research Methods', size: 'M' },
      ],
      objectives: [
        {
          product: 'Cookie Monster / Associate Performance',
          objectives: ['OBJ: Reduce associate onboarding time through clearer UX'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-13T14:00:00.000Z',
    },
    {
      // Ryan Rooney — recalls synthesis, SPA in QA
      id: 'pulse47',
      memberId: 'm43',
      weekOf: '2026-06-15',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Recalls usability synthesis: findings report draft',   size: 'XL' },
        { text: 'SPA audit: support QA with design clarifications',     size: 'M'  },
        { text: 'Compliance reporting: final accessibility review',     size: 'L'  },
      ],
      priorityTags: ['Compliance', 'Recalls'],
      upcoming: [
        { text: 'Recalls findings share-out: 6/17', size: 'L' },
      ],
      developmentFocus: [
        { text: 'Complex workflow design', size: 'M' },
        { text: 'Accessibility', size: 'M' },
      ],
      objectives: [
        {
          product: 'Compliance / Recalls',
          objectives: ['OBJ: Reduce time-to-action for recalls exceptions by redesigning triage flow'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-13T15:30:00.000Z',
    },
    {
      // Dana Powell — post-handoff, scoping next project
      id: 'pulse48',
      memberId: 'm44',
      weekOf: '2026-06-15',
      workloadSentiment: 2,
      currentPriorities: [
        { text: 'Code Busters: support engineering questions from handoff', size: 'M' },
        { text: 'Next project scoping: vendor ordering portal discovery',   size: 'L' },
      ],
      priorityTags: ['Code Busters'],
      upcoming: [
        { text: 'Vendor ordering portal kick-off: 6/18', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Prototyping', size: 'M' },
        { text: 'Interaction Design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Code Busters / Ordering',
          objectives: ['OBJ: Reduce ordering workflow errors by simplifying checkout step 3'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-13T13:00:00.000Z',
    },
    {
      // Kayla Long — post-v2 release, catching breath
      id: 'pulse49',
      memberId: 'm45',
      weekOf: '2026-06-15',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Production schedule v2: release support + bug triage',  size: 'M' },
        { text: 'Shift management: converge on one concept direction',    size: 'XL' },
        { text: 'Store manager dashboard: post-release polish tweaks',   size: 'S'  },
      ],
      priorityTags: ['Freddy Kroger'],
      upcoming: [
        { text: 'Shift management concept alignment: 6/16', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Dashboard design', size: 'M' },
        { text: 'User Research', size: 'S' },
      ],
      objectives: [
        {
          product: 'Freddy Kroger',
          objectives: ['OBJ: Ship production schedule v2 that reduces scheduling errors for store leads'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-13T14:30:00.000Z',
    },
    {
      // Tarun Kulkarni — exception handling high-fi, cycle-count in eng
      id: 'pulse50',
      memberId: 'm46',
      weekOf: '2026-06-15',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'Exception handling UI: high-fidelity prototype',       size: 'XL' },
        { text: 'Cycle-count v2: unblock engineering questions',        size: 'L'  },
        { text: 'Inventory accuracy dashboard: KPI card spec',          size: 'M'  },
      ],
      priorityTags: ['Inventorious'],
      upcoming: [
        { text: 'Exception handling prototype review: 6/17', size: 'L' },
        { text: 'Inventorious sprint review: 6/19', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Mobile UX', size: 'M' },
      ],
      objectives: [
        {
          product: 'Inventorious',
          objectives: ['OBJ: Reduce cycle-count errors through improved step-by-step flow'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-13T16:00:00.000Z',
    },
    {
      // Aaron Olson — efficiency dashboard moving fast, labor forecast in eng
      id: 'pulse51',
      memberId: 'm47',
      weekOf: '2026-06-15',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'Production efficiency dashboard: high-fidelity comps', size: 'XL' },
        { text: 'Labor forecast: address 8 open engineering questions',  size: 'L'  },
        { text: 'FAST onboarding: coordinate content review with PMs',  size: 'M'  },
      ],
      priorityTags: ['FAST'],
      upcoming: [
        { text: 'Efficiency dashboard mid-sprint review: 6/17', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Data visualization', size: 'M' },
        { text: 'Complex workflow design', size: 'M' },
      ],
      objectives: [
        {
          product: 'FAST',
          objectives: ['OBJ: Simplify labor forecast input to reduce manager time-on-task by 30%'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-13T15:00:00.000Z',
    },

    // ── Week of June 22 — Christopher Reed (gap fill) + 7 new members ──

    {
      // Christopher Reed — Storybook docs mid-sprint, v2 release imminent
      id: 'pulse52',
      memberId: 'm42',
      weekOf: '2026-06-22',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'Storybook: document 8 remaining core components',      size: 'XL' },
        { text: 'Component library v2: pre-release regression review',  size: 'L'  },
        { text: 'DEX: support 2 teams migrating to shared components',  size: 'M'  },
      ],
      priorityTags: ['DEX'],
      upcoming: [
        { text: 'Component library v2 release: 6/30', size: 'XL' },
        { text: 'Migration support sessions: 6/23, 6/24', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Design Engineering', size: 'M' },
        { text: 'Design Systems', size: 'M' },
      ],
      objectives: [
        {
          product: 'DEX (Developer + Designer Experience)',
          objectives: [
            'OBJ: Establish shared component library used across 3+ teams',
            'OBJ: Document all components in Storybook with usage guidelines',
          ],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-20T17:00:00.000Z',
    },
    {
      // Ryan Holloway — service guarantee in testing, assoc perf shipped
      id: 'pulse53',
      memberId: 'm27',
      weekOf: '2026-06-22',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Our Service Guarantee: usability test sessions (x3)',    size: 'XL' },
        { text: 'Associate performance dashboard: handoff to engineering', size: 'L'  },
        { text: 'Cookie Monster: Q3 roadmap design input',                size: 'M'  },
      ],
      priorityTags: ['Cookie Monster'],
      upcoming: [
        { text: 'Service Guarantee usability: 6/23, 6/24, 6/25', size: 'XL' },
        { text: 'Q3 roadmap session: 6/26', size: 'M' },
      ],
      developmentFocus: [
        { text: 'User Research', size: 'M' },
      ],
      objectives: [
        {
          product: 'Cookie Monster / Search',
          objectives: ['OBJ: Validate Our Service Guarantee redesign with store associates'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-20T15:00:00.000Z',
    },
    {
      // Isabelle Renard — steady week, building confidence post-handoff
      id: 'pulse54',
      memberId: 'm41',
      weekOf: '2026-06-22',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Associate performance: v2 discovery research plan',    size: 'L' },
        { text: 'Search A/B: coordinate with analytics on metrics',     size: 'M' },
        { text: 'Design portfolio update',                              size: 'S' },
      ],
      priorityTags: ['Cookie Monster'],
      upcoming: [
        { text: 'Performance v2 discovery kickoff: 6/25', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Research Methods', size: 'M' },
        { text: 'Data-driven design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Cookie Monster / Associate Performance',
          objectives: ['OBJ: Reduce associate onboarding time through clearer UX'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-20T14:00:00.000Z',
    },
    {
      // Ryan Rooney — recalls approved for build, new project scoping
      id: 'pulse55',
      memberId: 'm43',
      weekOf: '2026-06-22',
      workloadSentiment: 2,
      currentPriorities: [
        { text: 'Recalls: support engineering kickoff, answer design Qs', size: 'M' },
        { text: 'Regulatory audit workflow: scoping + discovery',         size: 'L' },
      ],
      priorityTags: ['Compliance'],
      upcoming: [
        { text: 'Regulatory audit kickoff: 6/24', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Complex workflow design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Compliance',
          objectives: ['OBJ: Improve regulatory audit workflow to reduce manual steps by 40%'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-20T13:30:00.000Z',
    },
    {
      // Dana Powell — vendor ordering portal discovery in full swing
      id: 'pulse56',
      memberId: 'm44',
      weekOf: '2026-06-22',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'Vendor ordering portal: stakeholder interviews (x4)',      size: 'XL' },
        { text: 'Ordering portal: journey map from interview synthesis',    size: 'L'  },
        { text: 'Code Busters: quick-win UX polish shipped — retro notes', size: 'S'  },
      ],
      priorityTags: ['Code Busters'],
      upcoming: [
        { text: 'Stakeholder interviews: 6/23–6/25', size: 'XL' },
        { text: 'Journey map share-out: 6/26', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Service design', size: 'M' },
        { text: 'User Research', size: 'M' },
      ],
      objectives: [
        {
          product: 'Code Busters / Vendor Ordering',
          objectives: ['OBJ: Understand vendor pain points to inform portal redesign'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-20T16:30:00.000Z',
    },
    {
      // Kayla Long — shift management concept locked, moving to high-fi
      id: 'pulse57',
      memberId: 'm45',
      weekOf: '2026-06-22',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Shift management: high-fidelity comps — day view',   size: 'XL' },
        { text: 'Shift management: high-fidelity comps — week view',  size: 'XL' },
        { text: 'Production schedule v2: release retrospective',      size: 'S'  },
      ],
      priorityTags: ['Freddy Kroger'],
      upcoming: [
        { text: 'Shift management mid-sprint review: 6/24', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Dashboard design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Freddy Kroger',
          objectives: ['OBJ: Deliver shift management v1 design for Q3 engineering kickoff'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-20T14:30:00.000Z',
    },
    {
      // Tarun Kulkarni — exception handling in eng, accuracy dashboard shipped
      id: 'pulse58',
      memberId: 'm46',
      weekOf: '2026-06-22',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Exception handling: answer engineering build questions', size: 'L' },
        { text: 'Inventory accuracy dashboard: post-launch monitoring',  size: 'M' },
        { text: 'Inventorious Q3 planning: design input on 3 epics',    size: 'L' },
      ],
      priorityTags: ['Inventorious'],
      upcoming: [
        { text: 'Q3 planning session: 6/25', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Mobile UX', size: 'M' },
        { text: 'Data visualization', size: 'S' },
      ],
      objectives: [
        {
          product: 'Inventorious',
          objectives: ['OBJ: Ship exception handling UI to reduce inventory variance resolution time'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-20T15:00:00.000Z',
    },
    {
      // Aaron Olson — efficiency dashboard approaching handoff
      id: 'pulse59',
      memberId: 'm47',
      weekOf: '2026-06-22',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'Efficiency dashboard: finalize all chart states + empty states', size: 'XL' },
        { text: 'Labor forecast: post-launch metrics review with PM',             size: 'M'  },
        { text: 'FAST: Q3 feature roadmap — design POV doc',                     size: 'L'  },
      ],
      priorityTags: ['FAST'],
      upcoming: [
        { text: 'Efficiency dashboard handoff: 6/26', size: 'L' },
        { text: 'Q3 roadmap review: 6/25', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Data visualization', size: 'M' },
      ],
      objectives: [
        {
          product: 'FAST',
          objectives: ['OBJ: Simplify labor forecast input to reduce manager time-on-task by 30%'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-20T16:00:00.000Z',
    },

    // ── Week of June 29 — 7 new members ──

    {
      // Ryan Holloway — service guarantee findings, Q3 planning
      id: 'pulse60',
      memberId: 'm27',
      weekOf: '2026-06-29',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Our Service Guarantee: usability findings report + recommendations', size: 'XL' },
        { text: 'Q3 Cookie Monster roadmap: design scope for 3 epics',               size: 'L'  },
        { text: 'Associate performance dashboard: post-launch QA support',            size: 'M'  },
      ],
      priorityTags: ['Cookie Monster'],
      upcoming: [
        { text: 'Service Guarantee findings share-out: 7/1', size: 'L' },
        { text: 'Q3 roadmap sign-off: 7/2', size: 'M' },
      ],
      developmentFocus: [
        { text: 'User Research', size: 'M' },
        { text: 'Strategic design', size: 'S' },
      ],
      objectives: [
        {
          product: 'Cookie Monster',
          objectives: ['OBJ: Validate Our Service Guarantee redesign with store associates'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-27T15:00:00.000Z',
    },
    {
      // Isabelle Renard — performance v2 discovery ongoing
      id: 'pulse61',
      memberId: 'm41',
      weekOf: '2026-06-29',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Associate performance v2: 3 discovery interviews',   size: 'L' },
        { text: 'Search A/B: review analytics results with product',  size: 'M' },
        { text: 'Contribute 1 section to team Q3 design brief',       size: 'M' },
      ],
      priorityTags: ['Cookie Monster'],
      upcoming: [
        { text: 'Discovery interviews: 6/29, 6/30, 7/1', size: 'L' },
        { text: 'Q3 design brief review: 7/3', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Research Methods', size: 'M' },
        { text: 'Data-driven design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Cookie Monster / Associate Performance',
          objectives: ['OBJ: Synthesize v2 discovery to inform Q3 roadmap'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-27T13:30:00.000Z',
    },
    {
      // Ryan Rooney — regulatory audit ramping, recalls in build
      id: 'pulse62',
      memberId: 'm43',
      weekOf: '2026-06-29',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'Regulatory audit workflow: wireframes for steps 1–4',   size: 'XL' },
        { text: 'Recalls triage: answer daily engineering build Qs',     size: 'L'  },
        { text: 'Compliance reporting: post-launch feature requests log', size: 'S'  },
      ],
      priorityTags: ['Compliance'],
      upcoming: [
        { text: 'Regulatory audit wireframe review: 7/1', size: 'L' },
      ],
      developmentFocus: [
        { text: 'Complex workflow design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Compliance',
          objectives: ['OBJ: Improve regulatory audit workflow to reduce manual steps by 40%'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-27T16:00:00.000Z',
    },
    {
      // Dana Powell — journey map to concepts
      id: 'pulse63',
      memberId: 'm44',
      weekOf: '2026-06-29',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Vendor ordering portal: 3 concept directions from journey map', size: 'XL' },
        { text: 'Ordering portal: affinity mapping from stakeholder interviews',  size: 'L'  },
        { text: 'Code Busters: Q3 epic prioritization — design POV input',       size: 'M'  },
      ],
      priorityTags: ['Code Busters'],
      upcoming: [
        { text: 'Concept direction review: 7/2', size: 'L' },
      ],
      developmentFocus: [
        { text: 'Service design', size: 'M' },
        { text: 'Prototyping', size: 'M' },
      ],
      objectives: [
        {
          product: 'Code Busters / Vendor Ordering',
          objectives: ['OBJ: Understand vendor pain points to inform portal redesign'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-27T14:00:00.000Z',
    },
    {
      // Kayla Long — shift management prototype complete, usability next
      id: 'pulse64',
      memberId: 'm45',
      weekOf: '2026-06-29',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'Shift management: prototype complete — prep usability test', size: 'XL' },
        { text: 'Shift management: recruit participants for testing',         size: 'M'  },
        { text: 'Store manager dashboard: v1.1 hotfix designs',              size: 'L'  },
      ],
      priorityTags: ['Freddy Kroger'],
      upcoming: [
        { text: 'Usability test sessions: 7/6–7/8', size: 'XL' },
        { text: 'Dashboard v1.1 release: 7/1', size: 'M' },
      ],
      developmentFocus: [
        { text: 'User Research', size: 'M' },
        { text: 'Dashboard design', size: 'M' },
      ],
      objectives: [
        {
          product: 'Freddy Kroger',
          objectives: ['OBJ: Deliver shift management v1 design for Q3 engineering kickoff'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-27T16:30:00.000Z',
    },
    {
      // Tarun Kulkarni — Q3 planning + exception handling support
      id: 'pulse65',
      memberId: 'm46',
      weekOf: '2026-06-29',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Inventorious Q3 epics: write design briefs for top 2', size: 'L' },
        { text: 'Exception handling: final QA review and sign-off',      size: 'M' },
        { text: 'Cycle-count v2: post-launch metrics check with PM',    size: 'S' },
      ],
      priorityTags: ['Inventorious'],
      upcoming: [
        { text: 'Q3 design brief share-out: 7/2', size: 'M' },
        { text: 'Exception handling release: 7/3', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Mobile UX', size: 'M' },
        { text: 'Strategic design', size: 'S' },
      ],
      objectives: [
        {
          product: 'Inventorious',
          objectives: ['OBJ: Ship exception handling UI to reduce inventory variance resolution time'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-27T13:00:00.000Z',
    },
    {
      // Aaron Olson — efficiency dashboard in eng, next project scoping
      id: 'pulse66',
      memberId: 'm47',
      weekOf: '2026-06-29',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Efficiency dashboard: daily engineering support during build', size: 'L' },
        { text: 'FAST scheduling UX: discovery kickoff — interview guide',     size: 'L' },
        { text: 'FAST Q3 design brief: finalize and share with leadership',    size: 'M' },
      ],
      priorityTags: ['FAST'],
      upcoming: [
        { text: 'Scheduling UX discovery: 6/30 kickoff', size: 'M' },
        { text: 'Efficiency dashboard QA: 7/1', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Data visualization', size: 'M' },
        { text: 'Complex workflow design', size: 'M' },
      ],
      objectives: [
        {
          product: 'FAST',
          objectives: ['OBJ: Simplify labor forecast input to reduce manager time-on-task by 30%'],
          sideQuests: ['Scheduling UX discovery — set up Q3 initiative'],
        },
      ],
      updatedAt: '2026-06-27T14:30:00.000Z',
    },

    // ── Week of June 22 (next week) — forward-looking entries ──

    {
      // Taylor Rose — post-OOO return week
      id: 'pulse8',
      memberId: 'm23',
      weekOf: '2026-06-22',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Catch up on notifications research (post-OOO)', size: 'M'  },
        { text: 'AI Driver\'s License — sections 4 & 5',         size: 'XL' },
        { text: 'Hackathon prototype prep',                      size: 'L'  },
      ],
      priorityTags: ['AI', 'DSL'],
      upcoming: [
        { text: 'Return from OOO 6/26', size: 'S' },
        { text: 'Hackathon kick-off: 6/29', size: 'L' },
      ],
      developmentFocus: [
        { text: 'Designing w/ AI', size: 'M' },
        { text: 'IOT & Edge', size: 'M' },
      ],
      objectives: [
        {
          product: 'Digital Shelf Labels',
          objectives: [
            'OBJ: Deliver hackathon prototype for end-to-end execution',
            'OBJ: Begin shift from reactive to proactive DSL support',
          ],
          sideQuests: [],
        },
        {
          product: 'Notifications',
          objectives: ['TBD — can\'t access in Upraise'],
          sideQuests: ['Research Plan - HMW reduce lost sales due to out-of-stock?'],
        },
      ],
      updatedAt: '2026-06-20T16:30:00.000Z',
    },
    {
      // David Henson — extremely busy: post-usability crunch
      id: 'pulse9',
      memberId: 'm19',
      weekOf: '2026-06-22',
      workloadSentiment: 5,
      currentPriorities: [
        { text: 'Synthesize usability test findings (report due 6/25)', size: 'XL' },
        { text: 'IRIS Phase 2 handoff documentation',                   size: 'L'  },
        { text: 'Unblock engineering on 3 open design questions',       size: 'M'  },
        { text: 'Design system: merge PR for color token updates',      size: 'S'  },
      ],
      priorityTags: ['IRIS'],
      upcoming: [
        { text: 'Usability findings presentation: 6/24', size: 'L' },
        { text: 'Engineering handoff: 6/25', size: 'M' },
      ],
      developmentFocus: [
        { text: 'Design Systems', size: 'M' },
        { text: 'Accessibility', size: 'M' },
      ],
      objectives: [],
      updatedAt: '2026-06-20T15:00:00.000Z',
    },
    {
      // Sydney Baker — return to steady pace
      id: 'pulse10',
      memberId: 'm24',
      weekOf: '2026-06-22',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'HomeBase: synthesize pilot store feedback',   size: 'L'  },
        { text: 'V2 concept explorations based on findings',   size: 'XL' },
        { text: 'Update HomeBase journey map',                 size: 'M'  },
      ],
      priorityTags: ['HomeBase'],
      upcoming: [
        { text: 'Pilot feedback synthesis share-out: 6/24', size: 'M' },
      ],
      developmentFocus: [
        { text: 'User Research', size: 'M' },
        { text: 'Prototyping', size: 'M' },
      ],
      objectives: [
        {
          product: 'HomeBase',
          objectives: ['OBJ: Deliver v2 concept direction based on pilot learnings'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-20T14:00:00.000Z',
    },

    // ── Week of June 29 — upcoming sprint week ──

    {
      // Taylor Rose — post-hackathon follow-through
      id: 'pulse15',
      memberId: 'm23',
      weekOf: '2026-06-29',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'Hackathon prototype: document outcomes and next steps', size: 'L'  },
        { text: 'AI Driver\'s License — Sections 6 & 7',                size: 'XL' },
        { text: 'Notifications research synthesis',                      size: 'M'  },
        { text: 'DSL: reactive-to-proactive comms strategy draft',       size: 'M'  },
      ],
      priorityTags: ['AI', 'DSL'],
      upcoming: [
        { text: 'Hackathon readout: 7/1', size: 'M' },
        { text: 'Q3 planning preview: 7/2', size: 'L' },
      ],
      developmentFocus: [
        { text: 'Designing w/ AI', size: 'M' },
        { text: 'IOT & Edge', size: 'M' },
      ],
      objectives: [
        {
          product: 'Digital Shelf Labels',
          objectives: [
            'OBJ: Deliver hackathon prototype for end-to-end execution',
            'OBJ: Begin shift from reactive to proactive DSL support',
          ],
          sideQuests: [],
        },
        {
          product: 'Notifications',
          objectives: ['TBD — can\'t access in Upraise'],
          sideQuests: ['Research Plan - HMW reduce lost sales due to out-of-stock?'],
        },
      ],
      updatedAt: '2026-06-27T16:30:00.000Z',
    },
    {
      // David Henson — post-handoff, winding down intensity
      id: 'pulse16',
      memberId: 'm19',
      weekOf: '2026-06-29',
      workloadSentiment: 3,
      currentPriorities: [
        { text: 'Address engineering questions from IRIS handoff', size: 'M'  },
        { text: 'Design system: update motion token spec',          size: 'L'  },
        { text: 'Review QA feedback on IRIS Phase 2 builds',        size: 'M'  },
      ],
      priorityTags: ['IRIS'],
      upcoming: [
        { text: 'QA review session: 7/1', size: 'M' },
        { text: 'Design system v2.1 branch merge: 7/3 target', size: 'S' },
      ],
      developmentFocus: [
        { text: 'Design Systems', size: 'M' },
        { text: 'Accessibility', size: 'M' },
      ],
      objectives: [
        {
          product: 'IRIS Platform',
          objectives: [
            'OBJ: Validate information architecture through usability testing',
          ],
          sideQuests: ['Explore motion design patterns for transitions'],
        },
      ],
      updatedAt: '2026-06-27T14:00:00.000Z',
    },
    {
      // Sydney Baker — v2 concept deep dive
      id: 'pulse17',
      memberId: 'm24',
      weekOf: '2026-06-29',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'HomeBase v2 concept explorations — 3 directions', size: 'XL' },
        { text: 'Stakeholder review prep for v2 share-out',         size: 'L'  },
        { text: 'Update HomeBase journey map with pilot insights',   size: 'M'  },
      ],
      priorityTags: ['HomeBase'],
      upcoming: [
        { text: 'V2 share-out with leadership: 7/2', size: 'L' },
      ],
      developmentFocus: [
        { text: 'User Research', size: 'M' },
        { text: 'Prototyping', size: 'M' },
      ],
      objectives: [
        {
          product: 'HomeBase',
          objectives: ['OBJ: Deliver v2 concept direction based on pilot learnings'],
          sideQuests: [],
        },
      ],
      updatedAt: '2026-06-27T13:30:00.000Z',
    },
    {
      // Christopher Reed — Storybook documentation sprint
      id: 'pulse18',
      memberId: 'm42',
      weekOf: '2026-06-29',
      workloadSentiment: 4,
      currentPriorities: [
        { text: 'Storybook: finish docs for 5 remaining core components', size: 'XL' },
        { text: 'DEX component library v2 pre-release review',            size: 'L'  },
        { text: 'Contractor deliverable review: final batch',             size: 'M'  },
      ],
      priorityTags: ['DEX'],
      upcoming: [
        { text: 'Component library v2 release: 6/30', size: 'L' },
        { text: 'DEX post-release retro: 7/2', size: 'S' },
      ],
      developmentFocus: [
        { text: 'Design Engineering', size: 'M' },
        { text: 'Design Systems', size: 'M' },
      ],
      objectives: [
        {
          product: 'DEX (Developer + Designer Experience)',
          objectives: [
            'OBJ: Establish shared component library used across 3+ teams',
            'OBJ: Document all components in Storybook with usage guidelines',
          ],
          sideQuests: ['HMW better understand what work is active and upcoming'],
        },
      ],
      updatedAt: '2026-06-27T12:00:00.000Z',
    },
  ]

  return {
    domains, teams, members, projects: projectsWithBlockedBy,
    initiatives, intakeRequests, escalations: [], ptoBlocks,
    weeklyPulses,
    resourceRates,
    adminMemberIds: [],
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Call once at app startup. Checks localStorage and hydrates the store only
 * when no persisted state exists — so existing user data is never overwritten.
 */
/**
 * Returns the full seed state with every project guaranteed to have a phases
 * array. Used by seedIfEmpty on first launch and by the Settings "Load Sample
 * Data" reset button.
 */
export function buildSeedState(): PortfolioState {
  const state = buildState()
  return {
    ...state,
    projects: state.projects.map(p =>
      p.phases ? p : { ...p, phases: legacyToPhases(p) }
    ),
  }
}

/**
 * Return only the project layer from the seed data (projects, initiatives, intake requests).
 * Used by Settings → "Load Sample Projects" to overlay realistic demo work onto the live
 * roster without replacing domains, teams, or members.
 */
export function buildSampleProjectState() {
  const { projects, initiatives, intakeRequests } = buildSeedState()
  return { projects, initiatives, intakeRequests }
}

/**
 * Return only the pulse layer from the seed data.
 * Used by Settings → "Load Pulse Seed Data" to overlay realistic weekly pulse
 * entries onto the live store without touching any other data.
 * Covers 5 weeks: Jun 1, Jun 8, Jun 15, Jun 22, Jun 29 2026.
 */
export function buildPulseSeedData() {
  return buildSeedState().weeklyPulses
}

export function seedIfEmpty(hydrate: (state: PortfolioState) => void): void {
  if (loadState() !== null) return          // already seeded — do nothing
  hydrate(buildSeedState())
}
