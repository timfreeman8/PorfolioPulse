/**
 * Seed data — real SAT organization data.
 *
 * Source: SAT-Seed-Data.csv (imported June 2026).
 * Previous fictitious dataset is archived in: seedData.archive.ts.
 *
 * Structure:
 *   - 16 domains derived from the "SAT Domain" column in the CSV
 *   - 37 teams derived from the "Product Team" column, grouped by domain
 *   - 129 real members (OPEN/placeholder rows from the CSV are excluded)
 *   - 29 representative projects — use Jira import or add via UI for real project data
 *   - 5 strategic initiatives covering the main SAT program areas
 *   - 5 sample intake requests representative of real SAT work requests
 *
 * Manager hierarchy (L5 owners):
 *   Samer Sarrouh   → Core Services
 *   Mike Silverman  → Seamless AX, KPF, Store Ops Technology, Labor & Shrink Technology
 *   Bridget Klare   → Price Execution, Inventory, Production, Ordering
 *   Akila Sethuraman → QAOps
 *   Stephen Lay     → DevSecOps, L3 Support
 *   Benjamin Cook   → AP, Compliance, Labor & Productivity, Architecture
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
// One domain per unique "SAT Domain" value from the CSV, plus an Architecture
// domain for the Solutions Architects whose manager position was listed as OPEN.

const domains: Domain[] = [
  {
    id: 'd1',
    name: 'Core Services',
    description: 'Platform engineering, data engineering, and foundational services for the SAT ecosystem.',
    owner: 'Samer Sarrouh',
  },
  {
    id: 'd2',
    name: 'Seamless AX',
    description: 'Associate experience products: IRIS, Cookie Monster, Little Bird, Blade Runners, HomeBase, and shared platform services.',
    owner: 'Mike Silverman',
  },
  {
    id: 'd3',
    name: 'KPF',
    description: 'Kroger Personal Finance technology: credit card, gift cards, and money services.',
    owner: 'Mike Silverman',
  },
  {
    id: 'd4',
    name: 'Store Ops Technology',
    description: 'Store operations technology products including Codebusters and cross-team initiatives.',
    owner: 'Mike Silverman',
  },
  {
    id: 'd5',
    name: 'Labor & Shrink Technology',
    description: 'Technology for labor management and shrink reduction: Inventorious and FAST platforms.',
    owner: 'Mike Silverman',
  },
  {
    id: 'd6',
    name: 'Price Execution',
    description: 'In-store price execution systems and the ISA (Intelligent Shelf Availability) platform.',
    owner: 'Bridget Klare',
  },
  {
    id: 'd7',
    name: 'Inventory',
    description: 'Inventory management systems: Inventorious cycle-count platform and DSD receiving.',
    owner: 'Bridget Klare',
  },
  {
    id: 'd8',
    name: 'Production',
    description: 'Production technology for deli, bakery, and prepared foods: Warrior Squad, FAST, Freddy Kroger, and Boat.',
    owner: 'Bridget Klare',
  },
  {
    id: 'd9',
    name: 'Ordering',
    description: 'Store ordering systems: demand-driven replenishment, vendor interfaces, and order management.',
    owner: 'Bridget Klare',
  },
  {
    id: 'd10',
    name: 'QAOps',
    description: 'Quality engineering and test operations across all SAT product teams.',
    owner: 'Akila Sethuraman',
  },
  {
    id: 'd11',
    name: 'DevSecOps',
    description: 'Security-first developer operations: CI/CD pipelines, security tooling, and platform DevOps.',
    owner: 'Stephen Lay',
  },
  {
    id: 'd12',
    name: 'L3 Support',
    description: 'Level 3 technical support for all SAT applications and production systems.',
    owner: 'Stephen Lay',
  },
  {
    id: 'd13',
    name: 'AP',
    description: 'Accounts payable technology and financial systems engineering.',
    owner: 'Benjamin Cook',
  },
  {
    id: 'd14',
    name: 'Compliance',
    description: 'Regulatory compliance technology, audit systems, and reporting.',
    owner: 'Benjamin Cook',
  },
  {
    id: 'd15',
    name: 'Labor & Productivity',
    description: 'Labor scheduling, productivity tracking, and workforce management technology.',
    owner: 'Benjamin Cook',
  },
  {
    id: 'd16',
    name: 'Architecture',
    description: 'Enterprise and solutions architecture across the full SAT portfolio.',
    owner: 'Benjamin Cook',
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
]

// ─── Teams ────────────────────────────────────────────────────────────────
// One team per unique "Product Team" value, grouped under its domain.
// memberIds are computed below from the members list.

const rawTeams: Omit<Team, 'memberIds'>[] = [
  // ── Core Services (d1) ─────────────────────────────────────────────
  { id: 't1',  domainId: 'd1', name: 'SpaceForce',       description: 'Core platform engineering team building foundational SAT services.',                          techLead: 'Charles Kirkendall' },
  { id: 't2',  domainId: 'd1', name: 'RedBull',           description: 'Core services integration and advanced engineering.',                                         techLead: 'Manoj Suman' },
  { id: 't3',  domainId: 'd1', name: 'SAT-Data',          description: 'Data engineering and product management for SAT data platforms.',                             techLead: 'David Russell' },
  // ── Seamless AX (d2) ───────────────────────────────────────────────
  { id: 't4',  domainId: 'd2', name: 'IRIS',              description: 'Associate-facing IRIS platform for real-time store data and task management.',                techLead: 'Saigayathri Depuru' },
  { id: 't5',  domainId: 'd2', name: 'Cookie Monster',    description: 'Associate checkout and transaction experience products.',                                      techLead: 'Peter Schreck' },
  { id: 't6',  domainId: 'd2', name: 'Little Bird',       description: 'Digital shelf label and Little Bird platform engineering.',                                    techLead: 'Drake Woodring' },
  { id: 't7',  domainId: 'd2', name: 'Blade Runners',     description: 'Backend API and middleware engineering for Seamless AX services.',                            techLead: 'Veerendra Madinedi' },
  { id: 't8',  domainId: 'd2', name: 'HomeBase',          description: 'HomeBase associate scheduling and management platform.',                                       techLead: 'Samuel Powell' },
  { id: 't9',  domainId: 'd2', name: 'Data Goblins',      description: 'Data analytics and reporting for the Seamless AX product suite.',                             techLead: 'Dakota Kuczenski' },
  { id: 't10', domainId: 'd2', name: 'QuickSales',        description: 'Quick sales and accelerated checkout experience engineering.',                                 techLead: 'Ramya Priya Gajulavarthy' },
  { id: 't11', domainId: 'd2', name: 'KPF Product',       description: 'Product management for KPF financial products within the Seamless AX portfolio.',             techLead: 'Elizabeth Garrick' },
  { id: 't12', domainId: 'd2', name: 'Seamless AX Platform', description: 'Engineering leadership, SRE, and platform services for the Seamless AX portfolio.',       techLead: 'Mark Valentine' },
  // ── KPF (d3) ───────────────────────────────────────────────────────
  { id: 't13', domainId: 'd3', name: 'Credit Card',       description: 'Kroger Personal Finance credit card technology and associate-facing experiences.',            techLead: 'Azyadeth Francois' },
  { id: 't14', domainId: 'd3', name: 'Gift Cards',        description: 'Gift card program technology and system integrations.',                                        techLead: 'Christopher Rabineau' },
  { id: 't15', domainId: 'd3', name: 'Money Services',    description: 'Money services and financial products technology.',                                            techLead: 'Ronan Rooney' },
  // ── Store Ops Technology (d4) ──────────────────────────────────────
  { id: 't16', domainId: 'd4', name: 'Codebusters',       description: 'Store operations coding and configuration tooling.',                                           techLead: 'Dana Perry' },
  { id: 't17', domainId: 'd4', name: 'Store Ops Projects', description: 'Cross-team store operations UX design and multi-product initiatives.',                       techLead: 'Makayla Long' },
  // ── Labor & Shrink Technology (d5) ─────────────────────────────────
  { id: 't18', domainId: 'd5', name: 'Inventorious',      description: 'Inventorious labor and shrink technology design.',                                             techLead: 'Taral Kulkarni' },
  { id: 't19', domainId: 'd5', name: 'FAST',              description: 'FAST labor optimization and scheduling technology design.',                                    techLead: 'Erik Olsen' },
  // ── Price Execution (d6) ───────────────────────────────────────────
  { id: 't20', domainId: 'd6', name: 'ISA',               description: 'Intelligent Shelf Availability — in-store price execution and compliance systems.',           techLead: 'Brandon Bischof' },
  // ── Inventory (d7) ─────────────────────────────────────────────────
  { id: 't21', domainId: 'd7', name: 'Inventorious',      description: 'Inventorious inventory cycle-count and accuracy platform.',                                    techLead: 'Chris Johnson' },
  { id: 't22', domainId: 'd7', name: 'DSD',               description: 'Direct Store Delivery receiving and vendor management systems.',                               techLead: 'Rajkiran Mooga' },
  // ── Production (d8) ────────────────────────────────────────────────
  { id: 't23', domainId: 'd8', name: 'Warrior Squad',     description: 'Production planning and deli/bakery operational technology.',                                  techLead: 'Sireesha Yarlagadda' },
  { id: 't24', domainId: 'd8', name: 'FAST',              description: 'FAST production efficiency and labor forecasting systems.',                                    techLead: 'Andrew Hughes' },
  { id: 't25', domainId: 'd8', name: 'Freddy Kroger',     description: 'Freddy Kroger production management and store operations platform.',                          techLead: 'Ryan Ware' },
  { id: 't26', domainId: 'd8', name: 'Boat',              description: 'Boat production platform engineering.',                                                        techLead: 'Nicholas Meese' },
  // ── Ordering (d9) ──────────────────────────────────────────────────
  { id: 't27', domainId: 'd9', name: 'Little Einsteins',  description: 'Intelligent demand-driven ordering and automated replenishment.',                              techLead: 'Thomas Pessler' },
  { id: 't28', domainId: 'd9', name: 'Interface',         description: 'Vendor interface and ordering system integrations.',                                           techLead: 'Rajiv Nair' },
  { id: 't29', domainId: 'd9', name: 'Code Busters',      description: 'Order management, code compliance, and ordering workflow systems.',                            techLead: 'Prajay Shakya' },
  // ── QAOps (d10) ────────────────────────────────────────────────────
  { id: 't30', domainId: 'd10', name: 'DEX SWAT',         description: 'Digital experience SWAT team for rapid quality response across SAT products.',                techLead: 'Muhammad Irfan' },
  { id: 't31', domainId: 'd10', name: 'DEX QAOps Mavericks', description: 'DEX quality operations and test automation excellence.',                                   techLead: 'Binoy Baby Kaliyadan' },
  // ── DevSecOps (d11) ────────────────────────────────────────────────
  { id: 't32', domainId: 'd11', name: 'SAT DevSecOps',    description: 'Security-first DevOps: CI/CD pipelines, vulnerability scanning, and platform security.',     techLead: 'Justin Palmer' },
  // ── L3 Support (d12) ───────────────────────────────────────────────
  { id: 't33', domainId: 'd12', name: 'SAT Support',      description: 'Level 3 technical support for all SAT production systems.',                                   techLead: 'Troy Cooper' },
  // ── AP (d13) ───────────────────────────────────────────────────────
  { id: 't34', domainId: 'd13', name: 'AP',               description: 'Accounts payable automation and financial systems.',                                           techLead: 'Aaron Crawford' },
  // ── Compliance (d14) ───────────────────────────────────────────────
  { id: 't35', domainId: 'd14', name: 'Compliance',       description: 'Regulatory compliance technology, audit systems, and reporting.',                              techLead: 'Sandeep Singh' },
  // ── Labor & Productivity (d15) ─────────────────────────────────────
  { id: 't36', domainId: 'd15', name: 'Labor & Productivity', description: 'Labor scheduling, productivity tracking, and workforce management.',                      techLead: 'Kirk Benson' },
  // ── Architecture (d16) ─────────────────────────────────────────────
  { id: 't37', domainId: 'd16', name: 'Architecture',     description: 'Enterprise solutions architecture and technical strategy across the SAT portfolio.',           techLead: 'Jonathan Franz' },
]

// ─── Members ──────────────────────────────────────────────────────────────
// Source: SAT-Seed-Data.csv. All non-OPEN rows included.
// capacity defaults to 80 (no capacity data in the CSV; managers are set lower).
// projectIds are computed below from the projects list.

const rawMembers: Omit<Member, 'projectIds'>[] = [
  // ── Core Services — SpaceForce (t1) ────────────────────────────────
  { id: 'm1',  teamIds: ['t1'],  name: 'Swathi Chintalapudi',           role: 'Senior Software Engineer',              reportsTo: 'Samer Sarrouh',           capacity: 80, avatarInitials: 'SC' },
  { id: 'm2',  teamIds: ['t1'],  name: 'Mrinalini Ganesh Kumar',         role: 'Senior Software Engineer',              reportsTo: 'Samer Sarrouh',           capacity: 80, avatarInitials: 'MG' },
  { id: 'm3',  teamIds: ['t1'],  name: 'Charles Kirkendall',             role: 'Senior Advanced Software Engineer',     reportsTo: 'Samer Sarrouh',           capacity: 85, avatarInitials: 'CK' },
  { id: 'm4',  teamIds: ['t1'],  name: 'Venkata Sai Mada',              role: 'Adv. SRE/DevOps Engineer',             reportsTo: 'Samer Sarrouh',           capacity: 80, avatarInitials: 'VM' },
  { id: 'm5',  teamIds: ['t1'],  name: 'Rio Mascarenhas',               role: 'Senior Software Engineer',              reportsTo: 'Samer Sarrouh',           capacity: 80, avatarInitials: 'RM' },
  // ── Core Services — RedBull (t2) ───────────────────────────────────
  { id: 'm6',  teamIds: ['t2'],  name: 'Vijaykumar Goudi',              role: 'Senior Software Engineer',              reportsTo: 'Samer Sarrouh',           capacity: 80, avatarInitials: 'VG' },
  { id: 'm7',  teamIds: ['t2'],  name: 'Rohith Katakam',                role: 'Senior Software Engineer',              reportsTo: 'Samer Sarrouh',           capacity: 80, avatarInitials: 'RK' },
  { id: 'm8',  teamIds: ['t2'],  name: 'Manoj Suman',                   role: 'Advanced Software Engineer',            reportsTo: 'Samer Sarrouh',           capacity: 80, avatarInitials: 'MS' },
  // ── Core Services — SAT-Data (t3) ──────────────────────────────────
  { id: 'm9',  teamIds: ['t3'],  name: 'Nathaniel Montgomery',           role: 'Data Engineer',                         reportsTo: 'Samer Sarrouh',           capacity: 80, avatarInitials: 'NM' },
  { id: 'm10', teamIds: ['t3'],  name: 'Jean Olasov',                   role: 'Senior Product Manager',                reportsTo: 'Samer Sarrouh',           capacity: 75, avatarInitials: 'JO' },
  { id: 'm11', teamIds: ['t3'],  name: 'David Russell',                  role: 'Advanced Data Engineer',                reportsTo: 'Samer Sarrouh',           capacity: 85, avatarInitials: 'DR' },
  // ── Seamless AX — IRIS (t4) ────────────────────────────────────────
  { id: 'm12', teamIds: ['t4'],  name: 'Saigayathri Depuru',            role: 'Senior Software Engineer',              reportsTo: 'Venkata Sanjay Penmetsa', capacity: 80, avatarInitials: 'SD' },
  { id: 'm13', teamIds: ['t4'],  name: 'John McElroy',                  role: 'Senior SRE/DevOps Engineer',            reportsTo: 'Venkata Sanjay Penmetsa', capacity: 80, avatarInitials: 'JM' },
  { id: 'm14', teamIds: ['t4'],  name: 'Rajasekhar Mummaneni',          role: 'Senior Software Engineer',              reportsTo: 'Venkata Sanjay Penmetsa', capacity: 80, avatarInitials: 'RM' },
  { id: 'm15', teamIds: ['t4'],  name: 'Avinash Prakash',               role: 'Senior Software Engineer',              reportsTo: 'Venkata Sanjay Penmetsa', capacity: 80, avatarInitials: 'AP' },
  { id: 'm16', teamIds: ['t4'],  name: 'Bhargavi Tammina',              role: 'Senior Quality Engineer',               reportsTo: 'Venkata Sanjay Penmetsa', capacity: 80, avatarInitials: 'BT' },
  { id: 'm17', teamIds: ['t4'],  name: 'Mary Kathryn Strang',           role: 'Senior Product Manager',                reportsTo: 'Mike Silverman',          capacity: 75, avatarInitials: 'MKS' },
  { id: 'm18', teamIds: ['t4'],  name: 'Chris Uhl',                     role: 'Senior Product Manager',                reportsTo: 'Mike Silverman',          capacity: 75, avatarInitials: 'CU' },
  { id: 'm19', teamIds: ['t4'],  name: 'Daniel Henning',                role: 'Product Designer',                      reportsTo: 'Timothy Freeman',         capacity: 80, avatarInitials: 'DH' },
  // ── Seamless AX — Cookie Monster (t5) ──────────────────────────────
  { id: 'm20', teamIds: ['t5'],  name: 'Samuel Bryant',                 role: 'Senior Product Manager',                reportsTo: 'Mike Silverman',          capacity: 75, avatarInitials: 'SBr' },
  { id: 'm21', teamIds: ['t5'],  name: 'Ethan Dunham',                  role: 'Software Engineer',                     reportsTo: 'Mark Valentine',          capacity: 80, avatarInitials: 'ED' },
  { id: 'm22', teamIds: ['t5'],  name: 'Peter Schreck',                 role: 'Advanced Software Engineer',            reportsTo: 'Mark Valentine',          capacity: 85, avatarInitials: 'PS' },
  { id: 'm23', teamIds: ['t5'],  name: 'Taylor Rose',                   role: 'Senior Product Designer',               reportsTo: 'Timothy Freeman',         capacity: 80, avatarInitials: 'TR' },
  { id: 'm24', teamIds: ['t5'],  name: 'Sydney Baker-Kuethe',           role: 'Product Designer',                      reportsTo: 'Timothy Freeman',         capacity: 80, avatarInitials: 'SBK' },
  // ── Seamless AX — Little Bird (t6) ─────────────────────────────────
  { id: 'm25', teamIds: ['t6'],  name: 'Jalen Bracey',                  role: 'Senior Software Engineer',              reportsTo: 'Mark Valentine',          capacity: 80, avatarInitials: 'JB' },
  { id: 'm26', teamIds: ['t6'],  name: 'Drake Woodring',                role: 'Advanced Software Engineer',            reportsTo: 'Mark Valentine',          capacity: 85, avatarInitials: 'DW' },
  { id: 'm27', teamIds: ['t6'],  name: 'Brian Schummer',                role: 'Product Designer',                      reportsTo: 'Timothy Freeman',         capacity: 80, avatarInitials: 'BS' },
  // ── Seamless AX — Blade Runners (t7) ───────────────────────────────
  { id: 'm28', teamIds: ['t7'],  name: 'Veerendra Madinedi',            role: 'Senior Software Engineer',              reportsTo: 'Mark Valentine',          capacity: 80, avatarInitials: 'VM' },
  { id: 'm29', teamIds: ['t7'],  name: 'Michael Ortega',                role: 'Software Engineer',                     reportsTo: 'Mark Valentine',          capacity: 80, avatarInitials: 'MO' },
  // ── Seamless AX — HomeBase (t8) ────────────────────────────────────
  { id: 'm30', teamIds: ['t8'],  name: 'Samuel Powell',                 role: 'Senior Product Manager',                reportsTo: 'Mike Silverman',          capacity: 75, avatarInitials: 'SPo' },
  // ── Seamless AX — Data Goblins (t9) ────────────────────────────────
  { id: 'm31', teamIds: ['t9'],  name: 'Dakota Kuczenski',              role: 'Software Engineer',                     reportsTo: 'Venkata Sanjay Penmetsa', capacity: 80, avatarInitials: 'DK' },
  // ── Seamless AX — QuickSales (t10) ─────────────────────────────────
  { id: 'm32', teamIds: ['t10'], name: 'Ramya Priya Gajulavarthy',      role: 'Senior Software Engineer',              reportsTo: 'Venkata Sanjay Penmetsa', capacity: 80, avatarInitials: 'RG' },
  // ── Seamless AX — KPF Product (t11) — PMs supporting KPF products ─
  { id: 'm33', teamIds: ['t11'], name: 'Dina Daniels-Purtee',           role: 'Product Manager',                       reportsTo: 'Michael Holcak',          capacity: 75, avatarInitials: 'DD' },
  { id: 'm34', teamIds: ['t11'], name: 'Elizabeth Garrick',             role: 'Senior Product Manager',                reportsTo: 'Michael Holcak',          capacity: 75, avatarInitials: 'EG' },
  { id: 'm35', teamIds: ['t11'], name: 'Cheryl Smith',                  role: 'Senior Product Manager',                reportsTo: 'Michael Holcak',          capacity: 75, avatarInitials: 'CS' },
  // ── Seamless AX — Platform / Managers (t12) ────────────────────────
  { id: 'm36', teamIds: ['t12'], name: 'Grayson Murphy',                role: 'SRE/DevOps Engineer',                   reportsTo: 'Mark Valentine',          capacity: 80, avatarInitials: 'GM' },
  { id: 'm37', teamIds: ['t12'], name: 'Timothy Freeman',               role: 'Senior Product Designer Manager',       reportsTo: 'Mike Silverman',          capacity: 70, avatarInitials: 'TF' },
  { id: 'm38', teamIds: ['t12'], name: 'Michael Holcak',                role: 'Product Management Group Manager',      reportsTo: 'Mike Silverman',          capacity: 70, avatarInitials: 'MH' },
  { id: 'm39', teamIds: ['t12'], name: 'Venkata Sanjay Penmetsa',       role: 'Adv. Software Engineering Manager',     reportsTo: 'Mike Silverman',          capacity: 70, avatarInitials: 'VP' },
  { id: 'm40', teamIds: ['t12'], name: 'Mark Valentine',                role: 'Senior Adv. Software Engineering Manager', reportsTo: 'Mike Silverman',       capacity: 65, avatarInitials: 'MV' },
  // ── KPF — Credit Card (t13) ────────────────────────────────────────
  { id: 'm41', teamIds: ['t13'], name: 'Azyadeth Francois',             role: 'Associate Product Designer',            reportsTo: 'Timothy Freeman',         capacity: 80, avatarInitials: 'AF' },
  // ── KPF — Gift Cards (t14) ─────────────────────────────────────────
  { id: 'm42', teamIds: ['t14'], name: 'Christopher Rabineau',          role: 'Product Designer',                      reportsTo: 'Timothy Freeman',         capacity: 80, avatarInitials: 'CR' },
  // ── KPF — Money Services (t15) ─────────────────────────────────────
  { id: 'm43', teamIds: ['t15'], name: 'Ronan Rooney',                  role: 'Product Designer',                      reportsTo: 'Timothy Freeman',         capacity: 80, avatarInitials: 'RRo' },
  // ── Store Ops Technology — Codebusters (t16) ───────────────────────
  { id: 'm44', teamIds: ['t16'], name: 'Dana Perry',                    role: 'Product Designer',                      reportsTo: 'Timothy Freeman',         capacity: 80, avatarInitials: 'DP' },
  // ── Store Ops Technology — Store Ops Projects (t17) ────────────────
  { id: 'm45', teamIds: ['t17'], name: 'Makayla Long',                  role: 'Senior Product Designer',               reportsTo: 'Timothy Freeman',         capacity: 80, avatarInitials: 'ML' },
  // ── Labor & Shrink Technology — Inventorious (t18) ─────────────────
  { id: 'm46', teamIds: ['t18'], name: 'Taral Kulkarni',                role: 'Senior Product Designer',               reportsTo: 'Timothy Freeman',         capacity: 80, avatarInitials: 'TK' },
  // ── Labor & Shrink Technology — FAST (t19) ─────────────────────────
  { id: 'm47', teamIds: ['t19'], name: 'Erik Olsen',                    role: 'Senior Product Designer',               reportsTo: 'Timothy Freeman',         capacity: 80, avatarInitials: 'EO' },
  // ── Price Execution — ISA (t20) ────────────────────────────────────
  { id: 'm48', teamIds: ['t20'], name: 'Kenneth Lahm',                  role: 'Associate Application Systems Analyst', reportsTo: 'Brandon Bischof',         capacity: 80, avatarInitials: 'KL' },
  { id: 'm49', teamIds: ['t20'], name: 'Michael Provancher',            role: 'Senior Application Systems Analyst',    reportsTo: 'Brandon Bischof',         capacity: 80, avatarInitials: 'MP' },
  { id: 'm50', teamIds: ['t20'], name: 'Jeffrey Sanders',               role: 'Senior Application Systems Analyst',    reportsTo: 'Brandon Bischof',         capacity: 80, avatarInitials: 'JS' },
  { id: 'm51', teamIds: ['t20'], name: 'Jonathan Sims',                 role: 'Senior Application Systems Analyst',    reportsTo: 'Brandon Bischof',         capacity: 80, avatarInitials: 'JSi' },
  { id: 'm52', teamIds: ['t20'], name: 'Jacob Wolfe',                   role: 'Software Engineer',                     reportsTo: 'Brandon Bischof',         capacity: 80, avatarInitials: 'JW' },
  { id: 'm53', teamIds: ['t20'], name: 'Amy Hardesty',                  role: 'Senior Product Manager',                reportsTo: 'Bridget Klare',           capacity: 75, avatarInitials: 'AH' },
  { id: 'm54', teamIds: ['t20'], name: 'Brandon Bischof',               role: 'Senior Software Engineering Manager',   reportsTo: 'Bridget Klare',           capacity: 70, avatarInitials: 'BB' },
  // ── Inventory — Inventorious (t21) ─────────────────────────────────
  { id: 'm55', teamIds: ['t21'], name: 'Chris Johnson',                 role: 'Advanced Software Engineer',            reportsTo: 'Robert Carlson',          capacity: 85, avatarInitials: 'CJ' },
  { id: 'm56', teamIds: ['t21'], name: 'Sai Sunnyhith Nandamuri',       role: 'Advanced Software Engineer',            reportsTo: 'Robert Carlson',          capacity: 85, avatarInitials: 'SN' },
  { id: 'm57', teamIds: ['t21'], name: 'Trevor Osborne',                role: 'Software Engineer',                     reportsTo: 'Robert Carlson',          capacity: 80, avatarInitials: 'TO' },
  { id: 'm58', teamIds: ['t21'], name: 'Paula Thornton',                role: 'Advanced Software Engineer',            reportsTo: 'Robert Carlson',          capacity: 85, avatarInitials: 'PT' },
  { id: 'm59', teamIds: ['t21'], name: 'Robert Carlson',                role: 'Adv. Software Engineering Manager',     reportsTo: 'Bridget Klare',           capacity: 70, avatarInitials: 'RC' },
  { id: 'm60', teamIds: ['t21'], name: 'Saravanan Jayavelu',            role: 'Senior Product Manager',                reportsTo: 'Benjamin Cook',           capacity: 75, avatarInitials: 'SJ' },
  // ── Inventory — DSD (t22) ──────────────────────────────────────────
  { id: 'm61', teamIds: ['t22'], name: 'Sascha Diotte',                 role: 'Application Systems Analyst',           reportsTo: 'Robert Carlson',          capacity: 80, avatarInitials: 'SDi' },
  { id: 'm62', teamIds: ['t22'], name: 'Rajkiran Mooga',                role: 'Advanced Software Engineer',            reportsTo: 'Robert Carlson',          capacity: 85, avatarInitials: 'RMo' },
  { id: 'm63', teamIds: ['t22'], name: 'Andrew Przyborowski',           role: 'Senior SRE/DevOps Engineer',            reportsTo: 'Robert Carlson',          capacity: 80, avatarInitials: 'APr' },
  { id: 'm64', teamIds: ['t22'], name: 'Erich Rogers',                  role: 'Application Systems Analyst',           reportsTo: 'Robert Carlson',          capacity: 80, avatarInitials: 'ER' },
  // ── Production — Warrior Squad (t23) ───────────────────────────────
  { id: 'm65', teamIds: ['t23'], name: 'Jason Cruz',                    role: 'Software Engineer',                     reportsTo: 'Rene Garcia',             capacity: 80, avatarInitials: 'JC' },
  { id: 'm66', teamIds: ['t23'], name: 'Sireesha Yarlagadda',           role: 'Senior Software Engineer',              reportsTo: 'Rene Garcia',             capacity: 80, avatarInitials: 'SY' },
  { id: 'm67', teamIds: ['t23'], name: 'Rene Garcia',                   role: 'Adv. Software Engineering Manager',     reportsTo: 'Bridget Klare',           capacity: 70, avatarInitials: 'RG' },
  // ── Production — FAST (t24) ────────────────────────────────────────
  { id: 'm68', teamIds: ['t24'], name: 'Ashanti Holmes',                role: 'Developer II',                          reportsTo: 'Rene Garcia',             capacity: 80, avatarInitials: 'AHo' },
  { id: 'm69', teamIds: ['t24'], name: 'Andrew Hughes',                 role: 'Advanced Software Engineer',            reportsTo: 'Rene Garcia',             capacity: 85, avatarInitials: 'AHu' },
  { id: 'm70', teamIds: ['t24'], name: 'Kalyani Satyavolu',             role: 'Advanced Quality Engineer',             reportsTo: 'Rene Garcia',             capacity: 80, avatarInitials: 'KS' },
  // ── Production — Freddy Kroger (t25) ───────────────────────────────
  { id: 'm71', teamIds: ['t25'], name: 'Rohith Kaveri',                 role: 'Senior Software Engineer',              reportsTo: 'Rene Garcia',             capacity: 80, avatarInitials: 'RKa' },
  { id: 'm72', teamIds: ['t25'], name: 'Ryan Ware',                     role: 'Advanced Software Engineer',            reportsTo: 'Rene Garcia',             capacity: 85, avatarInitials: 'RW' },
  { id: 'm73', teamIds: ['t25'], name: 'Sarah Proscia',                 role: 'Senior Product Manager',                reportsTo: 'Bridget Klare',           capacity: 75, avatarInitials: 'SPr' },
  // ── Production — Boat (t26) ────────────────────────────────────────
  { id: 'm74', teamIds: ['t26'], name: 'Nicholas Meese',                role: 'Senior Software Engineer',              reportsTo: 'Rene Garcia',             capacity: 80, avatarInitials: 'NMe' },
  // ── Ordering — Little Einsteins (t27) ──────────────────────────────
  { id: 'm75', teamIds: ['t27'], name: 'Douglas Montgomery',            role: 'Software Engineer',                     reportsTo: 'Michele Trammell',        capacity: 80, avatarInitials: 'DM' },
  { id: 'm76', teamIds: ['t27'], name: 'Thomas Pessler',                role: 'Advanced Software Engineer',            reportsTo: 'Michele Trammell',        capacity: 85, avatarInitials: 'TP' },
  { id: 'm77', teamIds: ['t27'], name: 'Thomas Thole',                  role: 'Software Engineer',                     reportsTo: 'Michele Trammell',        capacity: 80, avatarInitials: 'TT' },
  { id: 'm78', teamIds: ['t27'], name: 'Michele Trammell',              role: 'Adv. Software Engineering Manager',     reportsTo: 'Bridget Klare',           capacity: 70, avatarInitials: 'MT' },
  // ── Ordering — Interface (t28) ─────────────────────────────────────
  { id: 'm79', teamIds: ['t28'], name: 'Rajiv Nair',                    role: 'Senior Software Engineer',              reportsTo: 'Michele Trammell',        capacity: 80, avatarInitials: 'RN' },
  { id: 'm80', teamIds: ['t28'], name: 'Sarah Sizemore',                role: 'Senior Software Engineer',              reportsTo: 'Michele Trammell',        capacity: 80, avatarInitials: 'SS' },
  { id: 'm81', teamIds: ['t28'], name: 'Michael Parthenakis',           role: 'Senior Product Manager',                reportsTo: 'Bridget Klare',           capacity: 75, avatarInitials: 'MPa' },
  // ── Ordering — Code Busters (t29) ──────────────────────────────────
  { id: 'm82', teamIds: ['t29'], name: 'Conrad Payne',                  role: 'Senior Application Systems Analyst',    reportsTo: 'Michele Trammell',        capacity: 80, avatarInitials: 'CP' },
  { id: 'm83', teamIds: ['t29'], name: 'David Satterfield',             role: 'SRE/DevOps Engineer',                   reportsTo: 'Michele Trammell',        capacity: 80, avatarInitials: 'DS' },
  { id: 'm84', teamIds: ['t29'], name: 'Prajay Shakya',                 role: 'Senior Software Engineer',              reportsTo: 'Michele Trammell',        capacity: 80, avatarInitials: 'PS' },
  { id: 'm85', teamIds: ['t29'], name: 'Mary Kania',                    role: 'Product Manager',                       reportsTo: 'Bridget Klare',           capacity: 75, avatarInitials: 'MK' },
  // ── QAOps — DEX SWAT (t30) ─────────────────────────────────────────
  { id: 'm86', teamIds: ['t30'], name: 'Rajesh Kumar Bellam Govindarajulu', role: 'Senior Quality Engineer',           reportsTo: 'Akila Sethuraman',        capacity: 80, avatarInitials: 'RB' },
  { id: 'm87', teamIds: ['t30'], name: 'Muhammad Irfan',                role: 'Senior Software Engineer',              reportsTo: 'Akila Sethuraman',        capacity: 80, avatarInitials: 'MI' },
  // ── QAOps — DEX QAOps Mavericks (t31) ─────────────────────────────
  { id: 'm88', teamIds: ['t31'], name: 'Sonjoy Ghosh',                  role: 'Senior Quality Engineer',               reportsTo: 'Akila Sethuraman',        capacity: 80, avatarInitials: 'SG' },
  { id: 'm89', teamIds: ['t31'], name: 'Pradeep Reddy Kondareddy',       role: 'Senior Quality Engineer',               reportsTo: 'Akila Sethuraman',        capacity: 80, avatarInitials: 'PK' },
  { id: 'm90', teamIds: ['t31'], name: 'Chaitanya Krishna Maddipatla',   role: 'Senior Quality Engineer',               reportsTo: 'Akila Sethuraman',        capacity: 80, avatarInitials: 'CM' },
  { id: 'm91', teamIds: ['t31'], name: 'Subha Narayana Prabhu',          role: 'Senior Quality Engineer',               reportsTo: 'Akila Sethuraman',        capacity: 80, avatarInitials: 'SN' },
  { id: 'm92', teamIds: ['t31'], name: 'Joseph Stephens',               role: 'Quality Engineer',                      reportsTo: 'Akila Sethuraman',        capacity: 80, avatarInitials: 'JSt' },
  { id: 'm93', teamIds: ['t31'], name: 'Kinnari Suresh Surve',           role: 'Senior Quality Engineer',               reportsTo: 'Akila Sethuraman',        capacity: 80, avatarInitials: 'KSu' },
  { id: 'm94', teamIds: ['t31'], name: 'Harshini Yemreddy',             role: 'Senior Quality Engineer',               reportsTo: 'Akila Sethuraman',        capacity: 80, avatarInitials: 'HY' },
  { id: 'm95', teamIds: ['t31'], name: 'Binoy Baby Kaliyadan',           role: 'Advanced Quality Engineer',             reportsTo: 'Akila Sethuraman',        capacity: 85, avatarInitials: 'BK' },
  // ── DevSecOps — SAT DevSecOps (t32) ────────────────────────────────
  { id: 'm96', teamIds: ['t32'], name: 'Nikhil Aggarwal',               role: 'Senior Product Manager',                reportsTo: 'Stephen Lay',             capacity: 75, avatarInitials: 'NA' },
  { id: 'm97', teamIds: ['t32'], name: 'Thaddeus Fark',                 role: 'Senior SRE/DevOps Engineer',            reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'TFa' },
  { id: 'm98', teamIds: ['t32'], name: 'Justin Palmer',                 role: 'Adv. SRE/DevOps Engineer',             reportsTo: 'Stephen Lay',             capacity: 85, avatarInitials: 'JP' },
  { id: 'm99', teamIds: ['t32'], name: 'Zhengchao Zhu',                 role: 'Senior SRE/DevOps Engineer',            reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'ZZ' },
  // ── L3 Support — SAT Support (t33) ─────────────────────────────────
  { id: 'm100', teamIds: ['t33'], name: 'Troy Cooper',                  role: 'Senior Application Systems Analyst',    reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'TC' },
  { id: 'm101', teamIds: ['t33'], name: 'Alexander Dick',               role: 'Senior Application Systems Analyst',    reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'AD' },
  { id: 'm102', teamIds: ['t33'], name: 'Brandon Mason',                role: 'Software Engineer',                     reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'BM' },
  { id: 'm103', teamIds: ['t33'], name: 'Christofer Price',             role: 'Associate Application Systems Analyst', reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'CPr' },
  { id: 'm104', teamIds: ['t33'], name: 'Caitlyn Spears',               role: 'Application Systems Analyst',           reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'CSp' },
  { id: 'm105', teamIds: ['t33'], name: 'William Brinkley',             role: 'Associate Application Systems Analyst', reportsTo: 'Stephen Lay',             capacity: 80, avatarInitials: 'WB' },
  // ── AP — AP (t34) ──────────────────────────────────────────────────
  { id: 'm106', teamIds: ['t34'], name: 'Aaron Crawford',               role: 'Senior Software Engineering Manager',   reportsTo: 'Benjamin Cook',           capacity: 70, avatarInitials: 'AC' },
  { id: 'm107', teamIds: ['t34'], name: 'Nickolas Carter',              role: 'Application Systems Analyst',           reportsTo: 'Aaron Crawford',          capacity: 80, avatarInitials: 'NC' },
  { id: 'm108', teamIds: ['t34'], name: 'Quentin Center',               role: 'Associate Application Systems Analyst', reportsTo: 'Aaron Crawford',          capacity: 80, avatarInitials: 'QC' },
  { id: 'm109', teamIds: ['t34'], name: 'Karen Grimme-Reedy',           role: 'Associate Application Systems Analyst', reportsTo: 'Aaron Crawford',          capacity: 80, avatarInitials: 'KG' },
  { id: 'm110', teamIds: ['t34'], name: 'Terrence Lewis',               role: 'Application Systems Analyst',           reportsTo: 'Aaron Crawford',          capacity: 80, avatarInitials: 'TL' },
  { id: 'm111', teamIds: ['t34'], name: 'Richard Soller',               role: 'Application Systems Analyst',           reportsTo: 'Aaron Crawford',          capacity: 80, avatarInitials: 'RS' },
  // ── Compliance — Compliance (t35) ──────────────────────────────────
  { id: 'm112', teamIds: ['t35'], name: 'Sandeep Singh',                role: 'Senior Adv. Software Engineering Manager', reportsTo: 'Benjamin Cook',        capacity: 65, avatarInitials: 'SSi' },
  { id: 'm113', teamIds: ['t35'], name: 'Sai Cholitha Anne',            role: 'Senior Quality Engineer',               reportsTo: 'Sandeep Singh',           capacity: 80, avatarInitials: 'SA' },
  { id: 'm114', teamIds: ['t35'], name: 'Jake Filut',                   role: 'Software Engineer',                     reportsTo: 'Sandeep Singh',           capacity: 80, avatarInitials: 'JF' },
  { id: 'm115', teamIds: ['t35'], name: 'Dennis Frey',                  role: 'Software Engineer',                     reportsTo: 'Sandeep Singh',           capacity: 80, avatarInitials: 'DFr' },
  { id: 'm116', teamIds: ['t35'], name: 'Krishna Kiran Kumar Gurram',   role: 'Advanced Software Engineer',            reportsTo: 'Sandeep Singh',           capacity: 85, avatarInitials: 'KKG' },
  { id: 'm117', teamIds: ['t35'], name: 'Divya Poreddy',                role: 'Senior Software Engineer',              reportsTo: 'Sandeep Singh',           capacity: 80, avatarInitials: 'DPo' },
  { id: 'm118', teamIds: ['t35'], name: 'Erik Tschopp',                 role: 'Senior SRE/DevOps Engineer',            reportsTo: 'Sandeep Singh',           capacity: 80, avatarInitials: 'ET' },
  { id: 'm119', teamIds: ['t35'], name: 'Jill Gilbert',                 role: 'Senior Product Manager',                reportsTo: 'Benjamin Cook',           capacity: 75, avatarInitials: 'JGi' },
  // ── Labor & Productivity — Labor & Productivity (t36) ──────────────
  { id: 'm120', teamIds: ['t36'], name: 'Kirk Benson',                  role: 'Advanced Software Engineer',            reportsTo: 'Benjamin Cook',           capacity: 85, avatarInitials: 'KB' },
  { id: 'm121', teamIds: ['t36'], name: 'Jyothi Ritti',                 role: 'Senior Product Manager',                reportsTo: 'Benjamin Cook',           capacity: 75, avatarInitials: 'JR' },
  { id: 'm122', teamIds: ['t36'], name: 'Laura Redden',                 role: 'Senior Product Manager',                reportsTo: 'Benjamin Cook',           capacity: 75, avatarInitials: 'LR' },
  { id: 'm123', teamIds: ['t36'], name: 'Bidisha Roy',                  role: 'Product Manager',                       reportsTo: 'Benjamin Cook',           capacity: 75, avatarInitials: 'BR' },
  // ── Architecture — Architecture (t37) ──────────────────────────────
  // Note: CSV listed manager as OPEN (vacant position); reportsTo omitted.
  { id: 'm124', teamIds: ['t37'], name: 'Bilal Asghar',                 role: 'Advanced Solutions Architect',          capacity: 80, avatarInitials: 'BA' },
  { id: 'm125', teamIds: ['t37'], name: 'Greg Bolanos',                 role: 'Advanced Solutions Architect',          capacity: 80, avatarInitials: 'GB' },
  { id: 'm126', teamIds: ['t37'], name: 'Jonathan Franz',               role: 'Senior Advanced Solutions Architect',   capacity: 80, avatarInitials: 'JFr' },
  { id: 'm127', teamIds: ['t37'], name: 'Madhu Manoharan',              role: 'Advanced Solutions Architect',          capacity: 80, avatarInitials: 'MM' },
  { id: 'm128', teamIds: ['t37'], name: 'Angie Piper',                  role: 'Advanced Solutions Architect',          capacity: 80, avatarInitials: 'APi' },
  { id: 'm129', teamIds: ['t37'], name: 'Eric Roth',                    role: 'Advanced Solutions Architect',          capacity: 80, avatarInitials: 'ERo' },
]

// ─── Projects ─────────────────────────────────────────────────────────────
// Representative projects only — the real project inventory lives in Jira.
// Use "Import from Jira" or "Add Project" to populate with real work.
// Allocations reflect realistic team workloads; dates span FY 2025–2027.

const projects: Project[] = [
  // ── Seamless AX — IRIS (i1) ───────────────────────────────────────────
  {
    id: 'p1',
    assignments: [
      { memberId: 'm12', part: 'Backend',      allocation: 50, startDate: '2025-10-01', endDate: '2026-09-30' },
      { memberId: 'm14', part: 'Backend',      allocation: 40, startDate: '2025-10-01', endDate: '2026-09-30' },
      { memberId: 'm15', part: 'Backend',      allocation: 40, startDate: '2025-10-01', endDate: '2026-09-30' },
      { memberId: 'm19', part: 'UI Design',       allocation: 30, startDate: '2025-10-01', endDate: '2026-06-30' },
    ],
    name: 'IRIS Platform v2',
    description: 'Major version upgrade to the IRIS associate platform with improved real-time data sync and offline support.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i1', priority: 'Critical',
    startDate: '2025-10-01', targetEndDate: '2026-09-30', percentComplete: 55,
    stakeholders: 'Store Ops, Merchandising',
    notes: 'Core data sync rebuilt. Offline mode in development.',
    updatedAt: '2026-05-28T10:00:00Z',
  },
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
  {
    id: 'p3',
    assignments: [
      { memberId: 'm20', part: 'Product Management',       allocation: 50, startDate: '2026-02-01', endDate: '2026-10-31' },
      { memberId: 'm21', part: 'Frontend', allocation: 60, startDate: '2026-02-01', endDate: '2026-10-31' },
      { memberId: 'm22', part: 'Backend',  allocation: 70, startDate: '2026-02-01', endDate: '2026-10-31' },
      { memberId: 'm23', part: 'UI Design',   allocation: 50, startDate: '2026-02-01', endDate: '2026-07-31' },
      { memberId: 'm24', part: 'UI Design',   allocation: 40, startDate: '2026-02-01', endDate: '2026-07-31' },
    ],
    name: 'Cookie Monster Associate Checkout',
    description: 'New associate-facing checkout experience replacing legacy POS integration with a modern API-driven flow.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i1', priority: 'High',
    startDate: '2026-02-01', targetEndDate: '2026-10-31', percentComplete: 35,
    stakeholders: 'Store Ops, Finance',
    notes: 'API integration complete. UI in development.',
    updatedAt: '2026-05-27T11:00:00Z',
  },
  // ── Seamless AX — Little Bird (i1) ───────────────────────────────────
  {
    id: 'p4',
    assignments: [
      { memberId: 'm25', part: 'Backend', allocation: 70, startDate: '2025-11-01', endDate: '2026-07-31' },
      { memberId: 'm26', part: 'Backend', allocation: 80, startDate: '2025-11-01', endDate: '2026-07-31' },
      { memberId: 'm27', part: 'UI Design',  allocation: 50, startDate: '2025-11-01', endDate: '2026-05-31' },
    ],
    name: 'Digital Shelf Label Rollout',
    description: 'Enterprise rollout of digital shelf labels across 200 pilot stores with firmware and CMS integration.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i1', priority: 'High',
    startDate: '2025-11-01', targetEndDate: '2026-07-31', percentComplete: 70,
    stakeholders: 'Merchandising, Store Ops',
    notes: '150 stores complete. Final 50 stores in QA.',
    updatedAt: '2026-05-26T10:00:00Z',
  },
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
  {
    id: 'p6',
    assignments: [
      { memberId: 'm1', part: 'Backend',      allocation: 60, startDate: '2025-09-01', endDate: '2026-08-31' },
      { memberId: 'm3', part: 'Architecture', allocation: 40, startDate: '2025-09-01', endDate: '2026-08-31' },
      { memberId: 'm4', part: 'SRE',          allocation: 50, startDate: '2025-09-01', endDate: '2026-08-31' },
    ],
    name: 'SAT Core Platform Services',
    description: 'Build and maintain foundational shared services: auth tokens, event bus, and config management for SAT products.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i5', priority: 'Critical',
    startDate: '2025-09-01', targetEndDate: '2026-08-31', percentComplete: 65,
    stakeholders: 'All engineering teams',
    notes: 'Auth token service live. Event bus in QA.',
    updatedAt: '2026-05-27T10:00:00Z',
  },
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
  {
    id: 'p9',
    assignments: [
      { memberId: 'm9',  part: 'Data', allocation: 70, startDate: '2025-10-01', endDate: '2026-08-31' },
      { memberId: 'm11', part: 'Data', allocation: 80, startDate: '2025-10-01', endDate: '2026-08-31' },
    ],
    name: 'SAT Data Pipeline Modernization',
    description: 'Replace batch ETL with streaming data pipelines for real-time analytics across all SAT domains.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i5', priority: 'Critical',
    startDate: '2025-10-01', targetEndDate: '2026-08-31', percentComplete: 60,
    stakeholders: 'Analytics, All domains',
    notes: 'Kafka cluster live. Domain onboarding at 40%.',
    updatedAt: '2026-05-26T09:00:00Z',
  },
  // ── Price Execution — ISA (i2) ────────────────────────────────────────
  {
    id: 'p10',
    assignments: [
      { memberId: 'm49', part: 'Analysis', allocation: 70, startDate: '2025-11-01', endDate: '2026-08-31' },
      { memberId: 'm50', part: 'Analysis', allocation: 60, startDate: '2025-11-01', endDate: '2026-08-31' },
      { memberId: 'm52', part: 'Backend',  allocation: 60, startDate: '2025-11-01', endDate: '2026-08-31' },
      { memberId: 'm48', part: 'QA',       allocation: 50, startDate: '2026-03-01', endDate: '2026-08-31' },
    ],
    name: 'ISA Price Engine v3',
    description: 'Next-generation price execution engine for real-time shelf compliance and automated correction workflows.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i2', priority: 'High',
    startDate: '2025-11-01', targetEndDate: '2026-08-31', percentComplete: 55,
    stakeholders: 'Merchandising, Store Ops',
    notes: 'Rule engine rebuilt. Store sync integration in development.',
    updatedAt: '2026-05-25T11:00:00Z',
  },
  {
    id: 'p11',
    assignments: [
      { memberId: 'm51', part: 'Analysis',   allocation: 80, startDate: '2026-02-01', endDate: '2026-09-30' },
      { memberId: 'm54', part: 'Engineering', allocation: 30, startDate: '2026-02-01', endDate: '2026-09-30' },
    ],
    name: 'ISA Compliance Reporting',
    description: 'Automated price compliance reporting across all stores with drill-down by department and item.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i2', priority: 'Medium',
    startDate: '2026-02-01', targetEndDate: '2026-09-30', percentComplete: 75,
    stakeholders: 'Compliance, Finance',
    notes: 'Reports functional. Performance tuning in QA.',
    updatedAt: '2026-05-20T10:00:00Z',
  },
  // ── Inventory — Inventorious (i2) ─────────────────────────────────────
  {
    id: 'p12',
    assignments: [
      { memberId: 'm55', part: 'Backend',  allocation: 80, startDate: '2025-12-01', endDate: '2026-09-30' },
      { memberId: 'm56', part: 'Backend',  allocation: 75, startDate: '2025-12-01', endDate: '2026-09-30' },
      { memberId: 'm57', part: 'Frontend', allocation: 60, startDate: '2026-01-01', endDate: '2026-09-30' },
      { memberId: 'm58', part: 'Backend',  allocation: 70, startDate: '2025-12-01', endDate: '2026-09-30' },
    ],
    name: 'Inventorious Cycle Count Platform',
    description: 'Mobile-first cycle count platform replacing paper-based counting with real-time variance tracking.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i2', priority: 'High',
    startDate: '2025-12-01', targetEndDate: '2026-09-30', percentComplete: 50,
    stakeholders: 'Store Ops, Merchandising',
    notes: 'Mobile app MVP complete. Variance reporting integration in development.',
    updatedAt: '2026-05-24T12:00:00Z',
  },
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
  {
    id: 'p15',
    assignments: [
      { memberId: 'm68', part: 'Backend',      allocation: 70, startDate: '2025-10-15', endDate: '2026-07-31' },
      { memberId: 'm69', part: 'Architecture', allocation: 60, startDate: '2025-10-15', endDate: '2026-07-31' },
      { memberId: 'm70', part: 'QA',           allocation: 70, startDate: '2026-02-01', endDate: '2026-07-31' },
    ],
    name: 'FAST Labor Optimization Engine',
    description: 'AI-driven labor optimization for production departments reducing overstaffing and scheduling waste.',
    status: 'In Progress', phase: 'QA', initiativeId: 'i2', priority: 'High',
    startDate: '2025-10-15', targetEndDate: '2026-07-31', percentComplete: 72,
    stakeholders: 'HR, Store Ops',
    notes: 'Model trained and validated. QA underway with pilot stores.',
    updatedAt: '2026-05-25T10:00:00Z',
  },
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
  {
    id: 'p17',
    assignments: [
      { memberId: 'm75', part: 'Backend',  allocation: 70, startDate: '2025-11-01', endDate: '2026-08-31' },
      { memberId: 'm76', part: 'Backend',  allocation: 80, startDate: '2025-11-01', endDate: '2026-08-31' },
      { memberId: 'm77', part: 'Frontend', allocation: 60, startDate: '2026-01-01', endDate: '2026-08-31' },
    ],
    name: 'Intelligent Ordering System',
    description: 'Demand-driven automated ordering with ML-based reorder point calculations and exception management.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i2', priority: 'Critical',
    startDate: '2025-11-01', targetEndDate: '2026-08-31', percentComplete: 60,
    stakeholders: 'Merchandising, Supply Chain',
    notes: 'ML model deployed. Exception workflow in development.',
    updatedAt: '2026-05-26T13:00:00Z',
  },
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
  {
    id: 'p19',
    assignments: [
      { memberId: 'm86', part: 'QA',         allocation: 80, startDate: '2026-01-01', endDate: '2026-09-30' },
      { memberId: 'm87', part: 'Automation', allocation: 80, startDate: '2026-01-01', endDate: '2026-09-30' },
    ],
    name: 'DEX SWAT Test Automation Platform',
    description: 'Cross-product test automation framework for rapid quality validation across all SAT DEX products.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i3', priority: 'High',
    startDate: '2026-01-01', targetEndDate: '2026-09-30', percentComplete: 50,
    stakeholders: 'All engineering teams',
    notes: 'Framework core built. Integrating with IRIS and Cookie Monster.',
    updatedAt: '2026-05-24T10:00:00Z',
  },
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
  {
    id: 'p21',
    assignments: [
      { memberId: 'm97', part: 'DevOps',   allocation: 80, startDate: '2025-10-01', endDate: '2026-09-30' },
      { memberId: 'm98', part: 'Security', allocation: 80, startDate: '2025-10-01', endDate: '2026-09-30' },
      { memberId: 'm99', part: 'DevOps',   allocation: 70, startDate: '2025-10-01', endDate: '2026-09-30' },
    ],
    name: 'SAT DevSecOps CI/CD Pipeline',
    description: 'Secure, standardized CI/CD pipeline with automated SAST/DAST scanning, SBOM generation, and policy gates.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i3', priority: 'Critical',
    startDate: '2025-10-01', targetEndDate: '2026-09-30', percentComplete: 60,
    stakeholders: 'All engineering teams, Security',
    notes: 'GitHub Actions standard in place. Security gates being rolled out to all teams.',
    updatedAt: '2026-05-26T11:00:00Z',
  },
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
  },
  // ── Compliance (i4) ───────────────────────────────────────────────────
  {
    id: 'p23',
    assignments: [
      { memberId: 'm114', part: 'Backend', allocation: 70, startDate: '2026-02-01', endDate: '2026-10-31' },
      { memberId: 'm115', part: 'Backend', allocation: 70, startDate: '2026-02-01', endDate: '2026-10-31' },
      { memberId: 'm116', part: 'Backend', allocation: 80, startDate: '2026-02-01', endDate: '2026-10-31' },
      { memberId: 'm113', part: 'QA',      allocation: 60, startDate: '2026-04-01', endDate: '2026-10-31' },
    ],
    name: 'Regulatory Compliance Platform',
    description: 'Automated compliance monitoring and reporting for food safety, labor, and financial regulations.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i4', priority: 'Critical',
    startDate: '2026-02-01', targetEndDate: '2026-10-31', percentComplete: 40,
    stakeholders: 'Legal, Compliance, Finance',
    notes: 'Food safety module complete. Labor compliance in development.',
    updatedAt: '2026-05-25T13:00:00Z',
  },
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
  {
    id: 'p25',
    assignments: [
      { memberId: 'm124', part: 'Architecture', allocation: 60, startDate: '2025-10-01', endDate: '2026-12-31' },
      { memberId: 'm125', part: 'Architecture', allocation: 60, startDate: '2025-10-01', endDate: '2026-12-31' },
      { memberId: 'm126', part: 'Architecture', allocation: 70, startDate: '2025-10-01', endDate: '2026-12-31' },
    ],
    name: 'SAT Reference Architecture',
    description: 'Define and document SAT reference architecture: API design standards, event-driven patterns, and security baselines.',
    status: 'In Progress', phase: 'Development', initiativeId: 'i5', priority: 'High',
    startDate: '2025-10-01', targetEndDate: '2026-12-31', percentComplete: 50,
    stakeholders: 'All engineering teams',
    notes: 'API standards v1 published. Event-driven patterns in review.',
    updatedAt: '2026-05-24T11:00:00Z',
  },
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
    businessOwner: 'Samer Sarrouh',
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
    requesterName: 'Amy Hardesty',
    teamOrDomain: 'Price Execution',
    description: 'Automated nightly price audit tool that scans all shelf tags and flags discrepancies between the POS price and the shelf label.',
    capabilityType: 'New',
    hasFunding: 'Yes',
    businessJustification: 'Price discrepancies result in customer complaints and potential FTC violations. Automated auditing would catch issues before store open.',
    measurementPlan: 'Track discrepancies caught pre-open vs. reported by customers. Target: 90% caught before store open.',
    estimatedEffort: 'L',
    priority: 'High',
    businessOwner: 'Bridget Klare',
    requestedByDate: '2026-08-01',
    status: 'Pending Review',
    submittedAt: '2026-05-20T09:00:00Z',
  },
  {
    id: 'r4',
    requesterName: 'Mary Kania',
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
    requesterName: 'Nikhil Aggarwal',
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

  return { domains, teams, members, projects: projectsWithBlockedBy, initiatives, intakeRequests, escalations: [], ptoBlocks: [] }
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Call once at app startup. Checks localStorage and hydrates the store only
 * when no persisted state exists — so existing user data is never overwritten.
 */
export function seedIfEmpty(hydrate: (state: PortfolioState) => void): void {
  if (loadState() !== null) return          // already seeded — do nothing
  hydrate(buildState())
}
