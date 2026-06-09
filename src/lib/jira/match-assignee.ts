/**
 * Jira assignee → SAT member fuzzy matcher.
 *
 * Jira display names often differ from the roster in format and completeness.
 * Kroger Jira commonly uses "Lastname, Firstname MiddleInitial" (e.g. "Palmer, Justin E")
 * while the SAT roster stores "Firstname Lastname" (e.g. "Justin Palmer").
 *
 * The matcher tries several normalisation strategies in order of confidence,
 * returning the first member whose normalised name overlaps sufficiently.
 *
 * This module is intentionally pure — it takes members as a parameter so it
 * can be called from the import dialog without importing the store directly.
 */

import type { Member } from '@/types'

// ─── Normalisation helpers ────────────────────────────────────────────────

/**
 * Lowercase, remove punctuation, collapse whitespace, and split into tokens.
 * "Palmer, Justin E." → ["palmer", "justin", "e"]
 */
function tokenise(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[.,]/g, '')   // strip commas and dots (initials, "Lastname, First")
    .split(/\s+/)
    .filter(t => t.length > 0)
}

/**
 * If the Jira name looks like "Lastname, Firstname ..." (contains a comma),
 * rearrange to "Firstname Lastname ..." so it matches the roster format.
 * "Palmer, Justin E" → "Justin E Palmer"
 */
function normaliseJiraName(jiraName: string): string {
  const commaIdx = jiraName.indexOf(',')
  if (commaIdx === -1) return jiraName

  const last  = jiraName.slice(0, commaIdx).trim()
  const rest  = jiraName.slice(commaIdx + 1).trim()
  return `${rest} ${last}` // "Justin E Palmer"
}

// ─── Match confidence scoring ─────────────────────────────────────────────

/**
 * Score a single candidate member against a Jira display name.
 * Returns a number 0–1; higher = more confident match.
 *
 * Strategy (in priority order):
 *   1. Exact match after normalisation → 1.0
 *   2. First + last token match (ignores middle initials) → 0.9
 *   3. Last name + at least one other token match → 0.7
 *   4. First name token match only → 0 (too ambiguous — skip)
 */
function score(jiraName: string, member: Member): number {
  const rearranged   = normaliseJiraName(jiraName)
  const jiraTokens   = tokenise(rearranged)
  const memberTokens = tokenise(member.name)

  if (jiraTokens.length === 0 || memberTokens.length === 0) return 0

  // Exact normalised match
  if (jiraTokens.join(' ') === memberTokens.join(' ')) return 1.0

  // Tokens from the member name that appear in the Jira tokens
  const memberFirst = memberTokens[0]
  const memberLast  = memberTokens[memberTokens.length - 1]

  const hasFirst = jiraTokens.includes(memberFirst)
  const hasLast  = jiraTokens.includes(memberLast)

  // First + last present (most reliable, handles middle initials in either direction)
  if (hasFirst && hasLast) return 0.9

  // Last name + at least one other token (catches "Lastname, F" abbreviations)
  if (hasLast && jiraTokens.length >= 2) {
    const otherJiraTokens = jiraTokens.filter(t => t !== memberLast)
    const memberOthers    = memberTokens.filter(t => t !== memberLast)
    const hasOther = memberOthers.some(t => otherJiraTokens.some(j => j.startsWith(t[0])))
    if (hasOther) return 0.7
  }

  return 0
}

// ─── Public API ───────────────────────────────────────────────────────────

/** Minimum confidence score to accept a match. */
const MATCH_THRESHOLD = 0.7

export interface MatchResult {
  member: Member
  confidence: 'exact' | 'high' | 'probable'
}

/**
 * Find the best-matching SAT member for a Jira display name.
 *
 * Returns null when no member scores above the threshold, which is treated
 * as "no match found" and left for the user to wire up manually.
 *
 * @param jiraName  The Assignee string from the Jira CSV (e.g. "Palmer, Justin E")
 * @param members   The full roster from the Zustand store
 */
export function matchAssignee(jiraName: string, members: Member[]): MatchResult | null {
  if (!jiraName || jiraName.toLowerCase() === 'unassigned') return null

  let bestScore  = 0
  let bestMember: Member | null = null

  for (const member of members) {
    const s = score(jiraName, member)
    if (s > bestScore) {
      bestScore  = s
      bestMember = member
    }
  }

  if (!bestMember || bestScore < MATCH_THRESHOLD) return null

  return {
    member:     bestMember,
    confidence: bestScore === 1.0 ? 'exact' : bestScore >= 0.9 ? 'high' : 'probable',
  }
}

/**
 * Bulk-match a list of Jira assignee names against the roster.
 * Returns a Map from Jira name → MatchResult (or null if no match).
 * Skips duplicates so each name is only scored once.
 */
export function matchAssignees(
  jiraNames: string[],
  members: Member[],
): Map<string, MatchResult | null> {
  const results = new Map<string, MatchResult | null>()
  for (const name of jiraNames) {
    if (!results.has(name)) {
      results.set(name, matchAssignee(name, members))
    }
  }
  return results
}
