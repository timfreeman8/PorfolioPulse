# SAT — Store Technology Portfolio Planning & Visibility Tool

## Project Status (as of July 2026)

- **App title:** "SAT Portfolio Pulse" (`index.html`)
- **Build:** Clean — `npm run build` passes with zero TypeScript errors
- **Dev server:** `http://localhost:5174/` (`npm run dev -- --port 5174`)
- **Deployment target:** Internal Azure (service TBD — Azure Static Web Apps preferred for SPA routing)

---

## Project Purpose

A React web application for a Store Technology organization to plan, track, and
visualize their technology portfolio. Provides visibility into domains, teams,
member capacity, projects, strategic initiatives, and intake requests.
---

## Code Style & Commenting Rules

- **All new code must include comments.** Every file, component, helper function,
  and non-obvious block of logic should have a comment explaining *why* it exists
  and *how* it works — not just what it does literally.
- **File-level docstrings** — every new file gets a top-level comment summarizing
  its purpose and any important patterns or decisions inside it.
- **Component comments** — explain what a component renders and any non-obvious
  behavior (e.g. why it was built custom instead of using a library primitive).
- **Function/helper comments** — explain inputs, outputs, and the algorithm,
  especially for anything involving math, date logic, or state manipulation.
- **Keep comments up to date.** When making large changes to existing code —
  renamed behavior, changed logic, new patterns — update the relevant comments
  at the same time. Stale comments are worse than no comments.
- Comments should explain *intent and reasoning*, not just restate the code.
  "Clamp to FY range so bars don't overflow" is useful. "Set clampedLeft to max
  of 0 and leftPx" is not.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Build tool | Vite |
| UI framework | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Component library | shadcn/ui |
| State management | Zustand |
| Routing | React Router v6 |
| Charts | recharts |
| Persistence | localStorage (no backend) |

---

## Core Data Model

Hierarchy: **Portfolio → Domains → Teams → Members → Projects**

### Domain
A business or technology domain within the Store Tech portfolio (e.g., "Point of
Sale", "Inventory", "Fulfillment").
- `id`: string
- `name`: string
- `description`: string
- `owner`: string

### Team
Belongs to a Domain.
- `id`: string
- `domainId`: string
- `name`: string
- `description`: string
- `techLead`: string
- `memberIds`: string[]

### Member
Belongs to a Team.
- `id`: string
- `teamId`: string
- `name`: string
- `role`: string (title)
- `capacity`: number (0–100, percentage)
- `avatarInitials`: string
- `projectIds`: string[]

### Project
Belongs to one or more Members.
- `id`: string
- `memberIds`: string[]
- `name`: string
- `description`: string
- `status`: `"Backlog" | "In Progress" | "Blocked" | "Complete"`
- `phase`: `"Research" | "Discovery" | "Development" | "QA" | "Deployed" | "On Hold"`
- `initiativeId`: string (references Initiative)
- `priority`: `"Low" | "Medium" | "High" | "Critical"`
- `startDate`: string (ISO date)
- `targetEndDate`: string (ISO date)
- `percentComplete`: number (0–100)
- `stakeholders`: string
- `notes`: string
- `updatedAt`: string (ISO datetime)

### Initiative
A top-level strategic initiative that projects roll up to.
- `id`: string
- `name`: string
- `description`: string
- `targetQuarter`: string (e.g., "Q3 2025")
- `status`: `"Planning" | "Active" | "Complete" | "On Hold"`

### IntakeRequest
A new project/capability request.
- `id`: string
- `requesterName`: string
- `teamOrDomain`: string
- `description`: string
- `businessJustification`: string
- `estimatedEffort`: `"S" | "M" | "L" | "XL"`
- `priority`: `"Low" | "Medium" | "High" | "Critical"`
- `requestedByDate`: string (ISO date)
- `status`: `"Pending Review" | "Approved" | "Rejected" | "Deferred"`
- `submittedAt`: string (ISO datetime)

---

## Pages & Views

### 1. Dashboard (Home) — `/`
- Summary cards: total domains, teams, members, active projects, open intake requests
- Portfolio health charts (recharts): projects by Phase (donut) and by Status (bar)
- Capacity overview: members over 80% highlighted amber, over 100% highlighted red
- Initiative progress: list with progress bar (% of associated projects Complete)
- Recent activity feed: last 5 projects updated

### 2. Portfolio Structure — `/portfolio`
- Tree/card view of all Domains → Teams → Members
- Member cards show active project count
- Add/edit/delete Domains, Teams, Members via modal

### 3. Team View — `/teams`
- Select domain → select team
- Member cards: name, role, capacity bar, project count by phase
- Click member → side panel/modal with full project table

### 4. Member Detail — `/members/:memberId`
- Full profile: name, role, team, editable capacity slider
- Project list table: Name | Phase | Status | Priority | Initiative | % Complete | Target Date
- Add/edit/remove projects inline
- Visual capacity indicator

### 5. Project Detail Modal (reusable component)
- Full project form with all data model fields
- Status/phase dropdowns, progress slider, date pickers
- Initiative selector, notes textarea

### 6. Initiatives — `/initiatives`
- List all strategic initiatives
- Per-initiative: name, quarter, status, associated projects list, aggregate progress bar
- Add/edit/delete initiatives

### 7. Intake — `/intake`
- Form to submit a new intake request (all fields)
- Table of all requests with status badges
- Approve / Reject / Defer actions
- Convert approved request into a project and assign to a member

### 8. Portfolio Analytics — `/analytics`
- Filters: Domain, Team, Initiative, Phase, Status, Date Range
- Charts:
  - Projects by Phase (donut)
  - Projects by Status (bar)
  - Capacity by Team (grouped bar)
  - Initiative progress (horizontal bar)
- Flat, sortable, filterable table of all projects across the portfolio

---

## shadcn/ui Setup Instructions

- During **Step 1**, run `npx shadcn@latest init` to initialize shadcn/ui
- **Do NOT install all components upfront**
- Add components incrementally as each page is built:
  ```
  npx shadcn@latest add <component>
  ```
- Only add components required for the current step before writing that page's code

### Known shadcn alias issue
After running `npx shadcn@latest add`, generated component files use literal `"src/lib/utils"` and
`"src/components/ui/..."` imports instead of `"@/..."`. Fix them immediately after adding a component:
```bash
sed -i '' 's|from "src/lib/utils"|from "@/lib/utils"|g' src/components/ui/<new-component>.tsx
sed -i '' 's|from "src/components/|from "@/components/|g' src/components/ui/<new-component>.tsx
```
Root cause: `components.json` aliases use `src/` paths (required to prevent shadcn writing to a literal
`@/` directory), but the generated code emits the alias value literally instead of resolving it.

---

## Implementation Order

Work through steps fully and in order. Do not begin the next step until the
current one is complete and working. Update the checklist below when each step
is finished.

1. Set up Vite + TypeScript + Tailwind + shadcn/ui + Zustand + React Router
2. Define TypeScript interfaces for all data models
3. Build the Zustand store with full CRUD actions and localStorage persistence
4. Build the seed data utility and verify it loads correctly on first launch
5. Build the app layout shell: persistent sidebar navigation + main content area
6. Dashboard page
7. Portfolio Structure page
8. Team View page + Member Detail
9. Project Detail modal (reusable component, used across multiple pages)
10. Initiatives page
11. Intake page (form + table + approve/reject/convert to project flow)
12. Portfolio Analytics page (charts + filterable project table)

---

## Progress Checklist

- [x] Step 1 — Project setup (Vite, TypeScript, Tailwind, shadcn/ui, Zustand, React Router)
- [x] Step 2 — TypeScript interfaces / data models
- [x] Step 3 — Zustand store with CRUD + localStorage persistence
- [x] Step 4 — Seed data utility
- [x] Step 5 — App layout shell (sidebar + routing)
- [x] Step 6 — Dashboard page
- [x] Step 7 — Portfolio Structure page
- [x] Step 8 — Team View + Member Detail
- [x] Step 9 — Project Detail modal (built as ProjectFormDialog in Step 8; reused across pages)
- [x] Step 10 — Initiatives page
- [x] Step 11 — Intake page
- [x] Step 12 — Portfolio Analytics page

## Pages Beyond Original Scope

The following pages and features were built after the original 12-step plan:

- **Capacity Planner** (`/planning`) — Gantt-style chart of member workload across FY2026.
  - Two views: By Member (stacked project bars + PTO) and By Project (per-member assignment bars).
  - Zoom modes: Year / Quarter / Period (Kroger 4-5-4 NRF fiscal calendar).
  - Bars are drag-to-resize and drag-to-move. Clicking an existing project bar navigates to `/projects/:id`.
  - `+PTO` inline PTO block creation per member.
  - Fiscal calendar built from `PERIOD_WEEKS = [4,5,4,  4,5,4,  4,5,4,  4,5,4]` (FY2026: Feb 1 – Jan 31).

- **Project Detail Page** (`/projects/:id`, `/projects/new`) — Full-page project builder replacing the modal
  for create/edit flows. Uses a phase-based model (`ProjectPhaseStep[]`) where each phase has its own
  team, dates, status, and % complete. `deriveProjectFields()` computes root-level flat fields from phases.
  Back navigation is context-aware: clicking a project from Planning sends `{ state: { from: '/planning' } }`
  so the back button returns to Planning rather than the Projects list.

- **PTO Page** (`/pto`) — Calendar-style PTO management page with FY Gantt view per member.

- **Org Page** (`/org`) — Combined org chart + roster with drag-and-drop reorder, CSV import/export,
  domain/team/member CRUD, and a stats bar.

- **Roster Page** (`/roster`) — Read-only member roster with capacity stats, search, and filters.

- **Escalations Page** (`/escalations`) — Blocked/at-risk project tracking.

- **Settings Page** (`/settings`) — App configuration including resource rates for cost analytics.

## Shared UI Components (built beyond shadcn/ui)

| Component | Path | Purpose |
|---|---|---|
| `SegmentedControl` | `src/components/ui/segmented-control.tsx` | Pill-style toggle used on Planning, PTO, Analytics pages |
| `MultiSelectDropdown` | `src/components/ui/multi-select-dropdown.tsx` | Search + checkbox multi-select for filter bars |
| `FilterChip` | `src/components/ui/filter-chip.tsx` | Quick-filter toggle chip |
| `StatCard` | `src/components/ui/stat-card.tsx` | Icon + value + label summary card (OrgPage, RosterPage, AnalyticsPage) |
| `ColorBadge` | `src/components/ui/color-badge.tsx` | Status/phase/priority badge |
| `DateRangePicker` | `src/components/ui/date-range-picker.tsx` | Custom date range picker |
| `StakeholderTagInput` | `src/components/ui/stakeholder-tag-input.tsx` | Free-text tag input for stakeholder names |

## Data Model Extensions

Beyond the base schema in CLAUDE.md, the following fields have been added:

**Project** additions:
- `phases?: ProjectPhaseStep[]` — ordered phase plan; when present, root fields are derived from this
- `estimatedValue?: number` — dollar value estimate for financial analytics
- `valueType?: 'Revenue Impact' | 'Cost Savings'`
- `blockedBy?: string[]` — project IDs blocking this one

**ProjectPhaseStep** (new type):
- `id: string`, `phase: ProjectPhase`, `startDate: string`, `endDate: string`
- `status: 'Not Started' | 'In Progress' | 'Complete'`
- `percentComplete: number`, `notes: string`
- `assignments: ProjectMemberAssignment[]`

**Member** additions:
- `teamIds: string[]` (replaces single `teamId`) — members can span multiple teams
- `reportsTo?: string`

**ResourceRate** (new type):
- `role: string`, `annualRate: number` — used in Financial analytics tab

## Seed Data

- **9 domains**, **35 teams**, **136+ members** sourced from real org roster (June 2026).
- **30 projects**: 15 are multi-phase (use IIFE pattern to derive root fields from `ProjectPhaseStep[]`);
  15 are legacy single-phase (auto-converted by `legacyToPhases()` on load).
- To reload seed data: open browser console and run `localStorage.clear(); location.reload()`

## Key Library Patterns

- **`deriveProjectFields(phases)`** (`src/lib/projectBuilder.ts`) — computes root Project fields from phases array
- **`legacyToPhases(project)`** — auto-wraps a flat project into a single-phase plan for backwards compat
- **`buildFiscalCalendar()`** — generates FY2026 weeks/periods/quarters from the 4-5-4 NRF pattern
- **`memberQuarterAllocation(memberId, projects, rates?)`** (`src/lib/fiscal.ts`) — total capacity % this quarter
- **`GanttCtx`** context in CapacityPlannerPage — distributes `weekPx`, `chartWidth`, `dateToX`, `xToDate`
  to all Gantt child components so they don't need prop drilling

## Analytics Page Filter State

Filters persist to localStorage under `sat-analytics-filters`. State uses 9 separate `string[]` arrays
(one per dimension). `loadFilters()` migrates old single-string sentinel values (`'--all--'`, `'__all__'`)
to empty arrays. Each `useState` uses a lazy initializer so localStorage is only read on mount.

---

## Seed Data Requirements

Load on first launch (when localStorage is empty):
- **3 Domains**: "Store Experience", "Inventory & Supply Chain", "Platform & Infrastructure"
- **2–3 Teams per domain** (6–9 total)
- **3–5 Members per team** (~20–35 total)
- **3–6 Projects per member** across varying phases and statuses
- **4–5 Strategic Initiatives**
- **3–5 Sample Intake Requests**

---

## Sidebar Navigation

```
Dashboard
Portfolio Structure
Teams
Initiatives
Intake
Analytics
```

---

## Design Notes

- Clean, professional color scheme
- Status badges: color-coded by status and phase
- Capacity bars: green → amber (>80%) → red (>100%)
- Fully responsive layout
- Persistent left sidebar on desktop; collapsible on mobile

---

## Future Enhancements (Do Not Build Now)

- Bulk-assign multiple projects to an initiative at once
- Export portfolio data to CSV or PDF
- Notifications / flags for members approaching or exceeding capacity
- `useClickOutside` shared hook — 8+ components use identical `useRef + useEffect + addEventListener('mousedown')` patterns; extract to `src/lib/useClickOutside.ts`
- Real Jira import — `buildSampleProjectState()` in seedData.ts is the intended hook point

---

## Planned Architecture Evolution: localStorage → Backend + Auth

The app currently persists all data via localStorage (no backend). This is
intentional for Phase 1. The store is designed with a thin persistence
abstraction (`src/lib/persistence.ts`) so the swap is contained.

### Phase 2 — Database + Auth
When ready to add a real backend:

**Persistence layer** (`src/lib/persistence.ts`)
- Replace `getItem` / `setItem` calls with REST or GraphQL API calls
- The Zustand store itself does not change — only the persistence module

**Authentication**
- Deployment target is **internal Azure** — Azure AD (Entra ID) is the natural auth provider
- Add a login page and auth context using MSAL (Microsoft Authentication Library)
- Protect all routes with an `<AuthGuard>` wrapper

**Role-based access control (RBAC)**
Suggested roles:
- `viewer` — read-only access to all pages
- `member` — can edit their own projects and capacity
- `team_lead` — can manage their team's members and projects
- `domain_owner` — full CRUD within their domain
- `admin` — full access including intake approval and analytics

**Recommended backend stack (Azure-aligned)**
- Azure Static Web Apps + Azure AD authentication (built-in auth, no code needed for basic protection)
- Azure Cosmos DB or Azure SQL for persistence
- Azure Functions for API layer

**Migration path**
1. Deploy to Azure Static Web Apps (handles SPA routing automatically)
2. Enable Azure AD auth in the Static Web App config
3. Export current localStorage data to seed the database
4. Swap `src/lib/persistence.ts` to call the API
5. Add role checks in the store actions and UI (hide/disable controls by role)
