# PortfolioPulse

Portfolio planning and capacity visibility tool for Store Technology teams.

Built for engineering managers and team leads who need real-time visibility into who is working on what, how much capacity is available, and what's coming through the pipeline.

---

## Features

- **Roster** — Domain → Team → Member hierarchy with capacity bars and over-capacity highlighting
- **Capacity Planner** — Gantt-style timeline view of all projects across the current fiscal year
- **Projects** — Full project tracking with status, phase, priority, assignments, and initiative links
- **Initiatives** — Strategic themes that projects roll up to, with aggregate progress bars
- **Intake** — Submit, review, approve, and convert incoming requests into projects
- **Analytics** — Charts and filterable table across the full portfolio (filters persist between sessions)
- **Escalations** — Track active blockers that need leadership attention
- **Print Report** — Print-optimized quarter capacity report at `/print`
- **Data Management** — Export/import via CSV (roster, projects, assignments, initiatives, intake) or full JSON snapshot
- **Dark mode** — Full dark mode toggle in the sidebar
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
| Persistence | localStorage |

---

## Getting Started

```bash
npm install
npm run dev
```

The app loads with seed data on first launch (3 domains, ~8 teams, ~30 members, projects, initiatives, and intake requests).

To start fresh, open the browser console and run:
```js
localStorage.clear(); location.reload()
```

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
