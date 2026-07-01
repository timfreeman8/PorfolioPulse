# PortfolioPulse

Portfolio planning and capacity visibility tool for Store Technology teams.

Built for engineering managers and team leads who need real-time visibility into who is working on what, how much capacity is available, and what's coming through the pipeline.

---

## Features

### Core Pages
- **Dashboard** — Summary stats, blocked project alerts, phase donut chart, capacity heat map, initiative progress, and recent activity feed
- **Epics** — Full project tracking with status, phase, priority, assignments, and initiative links; grid and list views; Jira CSV import
- **Initiatives** — Strategic themes that projects roll up to, with aggregate progress bars
- **Intake** — Submit, review, approve, and convert incoming requests into projects
- **Analytics** — Two-tab view: Charts (recharts dashboards + sortable project table) and Financial (cost, ROI, value by initiative); all filters persist between sessions

### People & Org
- **Org** — Combined org chart and roster: Domain → Team → Member hierarchy with drag-and-drop reorder, CSV import/export, full CRUD, capacity bars, search, and filters
- **Capacity Planner** — Gantt-style timeline of all members and projects across FY2026; drag-to-move/resize bars, PTO blocks, zoom by Year / Quarter / Period

### Ops & Monitoring
- **Escalations** — Track active blockers that need leadership attention
- **Pulse** — Real-time portfolio health snapshot for leadership review
- **Print Report** — Print-optimized quarter capacity report at `/print`

### Platform
- **AI Chat** — Floating AI assistant (bottom-right) powered by the Claude API; supply an Anthropic key in Settings to enable
- **Dark mode** — Full dark mode toggle in the sidebar
- **Data Management** — Export/import via CSV (roster, projects, assignments, initiatives, intake) or full JSON snapshot
- **No backend required** — All data persisted in localStorage

---

## Tech Stack

| Layer | Technology |
|---|---|
| Build tool | Vite |
| UI framework | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| State | Zustand |
| Routing | React Router v6 |
| Charts | Recharts |
| Drag & Drop | dnd-kit |
| Persistence | localStorage |

---

## Getting Started

```bash
npm install
npm run dev -- --port 5174
```

Open `http://localhost:5174/` — the app loads with seed data on first launch (9 domains, 35 teams, 136+ members, 30 projects, initiatives, and intake requests).

To start fresh, open the browser console and run:
```js
localStorage.clear(); location.reload()
```

---

## Storybook

Component stories for every shared UI component (shadcn primitives + custom components):

```bash
npm run storybook
```

Open `http://localhost:6006/`. Toggle dark mode from the Storybook toolbar to preview both themes.

---

## Data Model

```
Portfolio
└── Domain (e.g. "Store Experience")
    └── Team (e.g. "POS Engineering")
        └── Member → Projects → Initiative
```

---

## CSV Import/Export

Go to **Settings → Data Management** to export any entity as CSV or download a full JSON snapshot. The recommended import order:

1. `roster.csv` — domains + teams + members in one file
2. `initiatives.csv`
3. `assignments.csv` — upload before projects so assignments attach correctly
4. `projects.csv`
5. `intake.csv`

Or use **Export Full Snapshot → JSON** for a lossless backup that restores everything in one step.

---

## Build

```bash
npm run build
```

---

## Deployment (Azure Static Web Apps)

This is a single-page app (Vite + React Router). Azure Static Web Apps handles SPA routing automatically via its built-in fallback config.

1. **Create an Azure Static Web App** in the Azure Portal (or via CLI):
   ```bash
   az staticwebapp create --name PortfolioPulse --resource-group <rg> --source . --branch main --app-location "/" --output-location "dist"
   ```

2. **GitHub Actions CI** is scaffolded automatically — every push to `main` builds and deploys.

3. **SPA routing fallback** — create `public/staticwebapp.config.json` if not present:
   ```json
   {
     "navigationFallback": {
       "rewrite": "/index.html",
       "exclude": ["/assets/*"]
     }
   }
   ```

4. **Environment variables** — the Claude API key is entered by users at runtime via the Settings page and stored in their browser's localStorage. No server-side secrets are needed for the current feature set.

---

## Architecture Notes

localStorage holds all data today (~200–400 KB with seed data). The persistence layer is isolated in `src/lib/persistence.ts` — swapping to an Azure Cosmos DB / Azure Functions backend only requires changing that one file; the Zustand store shape is stable.

**Performance**: long lists are virtualized with `@tanstack/react-virtual`. Store mutations are debounced (500 ms) before hitting localStorage. O(1) lookup Maps replace O(n) `.find()` per render.
