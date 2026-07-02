# SAT Portfolio Pulse — Implementation Handover

This document describes what the implementation team needs to change when moving
from the current localStorage-only prototype to a production Azure deployment.

## What the Implementation Team Needs to Do

### 1. Deploy to Azure Static Web Apps

The app is a Vite + React SPA with client-side routing. Azure Static Web Apps
handles SPA routing automatically via `staticwebapp.config.json` (add this file
at the repo root):

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*"]
  }
}
```

Build command: `npm run build`
Output directory: `dist`

---

### 2. Wire Up Authentication (Azure AD / Entra ID)

**What exists today:**
`src/pages/LoginPage.tsx` — a placeholder login screen that lets users pick their
name from a dropdown. This entire page is replaced by MSAL.

**What to swap:**
Replace the `login()` call in `LoginPage.tsx` with an MSAL redirect flow using
`@azure/msal-react`. The auth store (`src/store/useAuthStore.ts`) is already
designed for this — its `login(userId, role)` action just needs to be called with
values derived from the AAD token:

```ts
// After MSAL acquires a token:
const userId = mapAadObjectIdToMemberId(account.localAccountId) // look up in your DB
const role   = account.idTokenClaims?.groups?.includes('SAT-Admins') ? 'admin' : 'viewer'
useAuthStore.getState().login(userId, role)
```

**Role mapping:**
| AAD Group | App Role | Access |
|---|---|---|
| `SAT-Admins` | `admin` | Full CRUD, all data |
| Everyone else | `viewer` | Read-only, own projects |

See `src/store/useAuthStore.ts` for full inline documentation.

---

### 3. Replace localStorage Persistence with a Real Database

**What exists today:**
`src/lib/persistence.ts` — a thin abstraction over `localStorage`. All reads and
writes go through `loadState()` and `saveState()`. The Zustand store never
touches localStorage directly.

**What to swap:**
Replace only `loadState()` and `saveState()` in `src/lib/persistence.ts` with
`fetch` calls to your Azure Functions API. The function signatures stay the same —
nothing else in the codebase changes.

```ts
// Future saveState:
export async function saveState(state: PortfolioState): Promise<void> {
  await fetch(`${import.meta.env.VITE_API_BASE_URL}/portfolio`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(state),
  })
}

// Future loadState:
export async function loadState(): Promise<PortfolioState | null> {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/portfolio`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) return null
  return migrateState(await res.json())
}
```

**Recommended backend stack:**
- Azure Functions (API layer)
- Azure Cosmos DB or Azure SQL (persistence)
- Azure Blob Storage (file exports/imports if needed)

**Data model:**
The full TypeScript type definitions live in `src/types/index.ts`. Use these as
the schema for your database tables/collections.

---

### 4. Seed the Database

The app currently seeds itself from `src/lib/seedData.ts` on first launch
(when localStorage is empty). For production:

1. Export the current state from **Settings → Export** — this produces a JSON
   snapshot of the full portfolio state.
2. Use that JSON to seed your database on first deploy.
3. From that point forward, the database is the source of truth and `seedData.ts`
   is no longer called.

The member roster in `seedData.ts` uses **anonymized placeholder names**.
Replace these with the real org roster pulled from your HR/directory system
(Azure AD user list or People API).

---

### 5. Microsoft Teams Webhook (Optional)

The app can send alerts to a Teams channel when projects are blocked or members
go over capacity. The webhook URL is currently stored in localStorage via
**Settings → Notifications**.

For production, store the webhook URL in Azure App Configuration or Key Vault
and inject it as an environment variable (`VITE_TEAMS_WEBHOOK_URL`) rather than
letting each user configure it individually.

See `src/lib/notifications.ts` for the payload format.

---

## Key Files Reference

| File | Purpose |
|---|---|
| `src/lib/persistence.ts` | **Swap point #1** — localStorage → API |
| `src/store/useAuthStore.ts` | **Swap point #2** — placeholder login → MSAL |
| `src/pages/LoginPage.tsx` | **Replace entirely** with MSAL redirect |
| `src/lib/notifications.ts` | Teams webhook integration |
| `src/types/index.ts` | All TypeScript types — use as DB schema |
| `src/lib/seedData.ts` | First-launch seed data (anonymized) |
| `.env.example` | Environment variable template |

## What Does NOT Change

- All page components, charts, and UI — production-ready as-is
- The Zustand store shape (`src/store/usePortfolioStore.ts`) — stable
- The Kroger 4-5-4 fiscal calendar logic (`src/lib/fiscal.ts`)
- Routing, virtualization, and state management
