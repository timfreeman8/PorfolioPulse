/**
 * Persistence abstraction layer.
 *
 * All reads and writes go through this module — the Zustand store never
 * touches localStorage (or a future API) directly. When the app moves to a
 * real backend, only this file needs to change.
 *
 * Future swap: replace the localStorage calls below with fetch/axios calls
 * to your REST or GraphQL API, keeping the same function signatures.
 *
 * Write strategy — debounced via scheduleSave():
 *   Rapid mutations (typing in a filter, dragging a bar) call scheduleSave()
 *   which coalesces multiple writes into a single localStorage.setItem after
 *   500ms of inactivity. This prevents JSON.stringify blocking the main
 *   thread on every keystroke, which becomes critical at scale (thousands of
 *   projects + members → 5-10MB serialisation per write).
 *
 *   A beforeunload handler (registered in main.tsx) calls flushPendingSave()
 *   to guarantee the latest state is written before the tab closes.
 *
 *   Trade-off: a hard crash within the 500ms window loses the last mutation.
 *   This is acceptable for a portfolio planning tool — users are not entering
 *   financial transactions. Normal tab-close and navigation-away cases are
 *   covered by the beforeunload flush.
 *
 * Quota guard:
 *   saveState() warns in the console when the serialised payload approaches
 *   the practical 5MB localStorage limit and surfaces a QuotaExceededError
 *   to the console instead of silently swallowing it.
 *
 *   When the payload exceeds ~3MB, consider adding lz-string compression:
 *     npm install lz-string @types/lz-string
 *     // In saveState:  LZString.compress(JSON.stringify(state))
 *     // In loadState:  JSON.parse(LZString.decompress(raw) ?? '{}')
 *   This typically reduces payload size by 60-70%.
 *
 *   Long-term: move to Azure Cosmos DB / Azure SQL via Azure Functions.
 *   Only this file changes — the store shape is stable.
 */

import type { PortfolioState } from '@/types'

// Bumped to v2 when seed data was replaced with real SAT org data (June 2026).
// Old v1 data (fictitious) is ignored; new seed data loads automatically.
const STORAGE_KEY = 'sat_portfolio_v2'

// ─── Debounce scheduler ───────────────────────────────────────────────────────

/** The latest state waiting to be flushed. Null when nothing is pending. */
let pendingState: PortfolioState | null = null
/** Timeout handle for the debounce timer. */
let debounceTimer: ReturnType<typeof setTimeout> | null = null
/** How long to wait after the last mutation before writing to storage. */
const DEBOUNCE_MS = 500

/**
 * Schedule a state write, coalescing rapid consecutive calls into one.
 *
 * Call this from every Zustand store mutation instead of calling saveState()
 * directly. The actual write fires 500ms after the last scheduleSave() call.
 * This prevents a JSON.stringify + localStorage.setItem on every keystroke.
 */
export function scheduleSave(state: PortfolioState): void {
  pendingState = state
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (pendingState !== null) {
      saveState(pendingState)
      pendingState = null
    }
    debounceTimer = null
  }, DEBOUNCE_MS)
}

/**
 * Flush any pending scheduled write immediately.
 *
 * Register this as a beforeunload handler in main.tsx so in-flight changes
 * are not lost when the user closes the tab or navigates away:
 *   window.addEventListener('beforeunload', flushPendingSave)
 */
export function flushPendingSave(): void {
  if (pendingState !== null) {
    saveState(pendingState)
    pendingState = null
  }
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

// ─── Core read / write ───────────────────────────────────────────────────────

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
  if (!Array.isArray(raw?.escalations))    raw.escalations    = []
  if (!Array.isArray(raw?.ptoBlocks))      raw.ptoBlocks      = []
  // Backfill resourceRates for state saved before cost/value tracking was added.
  if (!Array.isArray(raw?.resourceRates))  raw.resourceRates  = []
  // Backfill adminMemberIds for state saved before role-based access was added.
  if (!Array.isArray(raw?.adminMemberIds)) raw.adminMemberIds = []
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

/**
 * Persist the full portfolio state to storage immediately (synchronous).
 *
 * Prefer scheduleSave() for normal mutations. Call this directly only for
 * bulk operations (hydrate / seed) where you need the write to complete
 * before a page reload.
 */
export function saveState(state: PortfolioState): void {
  try {
    const serialized = JSON.stringify(state)
    // Warn when approaching the practical 5MB localStorage ceiling.
    if (serialized.length > 4_000_000) {
      console.warn(
        `[persistence] State is ${(serialized.length / 1_000_000).toFixed(1)}MB ` +
        '— approaching localStorage limit. Consider enabling lz-string compression ' +
        'or migrating to a backend. See persistence.ts for details.'
      )
    }
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      // Surface quota errors instead of silently swallowing them — silent
      // failure means the user's changes are lost without any indication.
      console.error(
        '[persistence] localStorage quota exceeded — changes not saved. ' +
        'Export your data via Settings → Export before storage fills up.'
      )
    } else {
      console.error('[persistence] Failed to save state', e)
    }
  }
}

/** Wipe all persisted data (useful for dev/reset). */
export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY)
}
