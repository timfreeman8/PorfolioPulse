/**
 * Persistence abstraction layer.
 *
 * All reads and writes go through this module — the Zustand store never
 * touches localStorage (or a future API) directly. When the app moves to a
 * real backend, only this file needs to change.
 *
 * Future swap: replace the localStorage calls below with fetch/axios calls
 * to your REST or GraphQL API, keeping the same function signatures.
 */

import type { PortfolioState } from '@/types'

// Bumped to v2 when seed data was replaced with real SAT org data (June 2026).
// Old v1 data (fictitious) is ignored; new seed data loads automatically.
const STORAGE_KEY = 'sat_portfolio_v2'

/**
 * Bring persisted data up to the current schema without losing user changes.
 * Add a new block here whenever a breaking field change is made.
 */
function migrateState(raw: any): PortfolioState {
  // v1 → v2: Member.teamId (string) → Member.teamIds (string[])
  if (Array.isArray(raw?.members)) {
    raw.members = raw.members.map((m: any) => {
      if (!m.teamIds && typeof m.teamId === 'string') {
        const { teamId, ...rest } = m
        return { ...rest, teamIds: [teamId] }
      }
      return m
    })
  }
  if (!Array.isArray(raw?.escalations)) raw.escalations = []
  if (!Array.isArray(raw?.ptoBlocks))   raw.ptoBlocks   = []
  return raw as PortfolioState
}

/** Load the full portfolio state from storage. Returns null on first launch. */
export function loadState(): PortfolioState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return migrateState(JSON.parse(raw))
  } catch {
    console.error('[persistence] Failed to load state')
    return null
  }
}

/** Persist the full portfolio state to storage. */
export function saveState(state: PortfolioState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    console.error('[persistence] Failed to save state')
  }
}

/** Wipe all persisted data (useful for dev/reset). */
export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY)
}
