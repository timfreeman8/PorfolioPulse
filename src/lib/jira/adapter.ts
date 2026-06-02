/**
 * Jira → SAT project adapter.
 *
 * This module is the single source of truth for how Jira Epic data maps to
 * our internal Project type. It is intentionally pure (no side-effects, no
 * store access) so it can be used by any data source:
 *
 *   • Paste JSON (current)  — call parseJiraJson() then mapEpicToProject()
 *   • Live REST API (future) — fetch /rest/api/3/search, then mapEpicToProject()
 *   • Webhook / sync (future) — same mapping, different trigger
 *
 * Adding a live connection = add a fetchJiraEpics() function here that calls
 * the API (via a proxy to avoid CORS). The rest of the pipeline is identical.
 */

import type { JiraEpic, JiraAdf, JiraAdfNode } from './types'
import type { Project, ProjectStatus, ProjectPhase, Priority } from '@/types'

// ─── Status mapping ────────────────────────────────────────────────────────
// Jira status names → our ProjectStatus enum.
// Matching is case-insensitive. Unmapped statuses fall back to 'Backlog'.

const STATUS_MAP: Record<string, ProjectStatus> = {
  'to do':       'Backlog',
  'backlog':     'Backlog',
  'open':        'Backlog',
  'selected for development': 'Backlog',
  'in progress': 'In Progress',
  'in review':   'In Progress',
  'in development': 'In Progress',
  'code review': 'In Progress',
  'testing':     'In Progress',
  'blocked':     'Blocked',
  'impediment':  'Blocked',
  'on hold':     'Blocked',
  'done':        'Complete',
  'complete':    'Complete',
  'completed':   'Complete',
  'closed':      'Complete',
  'resolved':    'Complete',
  'released':    'Complete',
}

/** Map a Jira status name to our ProjectStatus, defaulting to 'Backlog'. */
function mapStatus(jiraStatus: string): ProjectStatus {
  return STATUS_MAP[jiraStatus.toLowerCase()] ?? 'Backlog'
}

// ─── Phase mapping ─────────────────────────────────────────────────────────
// Derive a rough SDLC phase from the Jira status. Jira doesn't have phases,
// so this is a best-effort heuristic. Users can refine after import.

function mapPhase(jiraStatus: string): ProjectPhase {
  const s = jiraStatus.toLowerCase()
  if (['done', 'complete', 'completed', 'closed', 'resolved', 'released'].includes(s)) return 'Deployed'
  if (['in progress', 'in review', 'code review', 'in development'].includes(s)) return 'Development'
  if (['testing', 'qa'].includes(s)) return 'QA'
  if (['on hold'].includes(s)) return 'On Hold'
  return 'Discovery' // default for To Do / Backlog
}

// ─── Priority mapping ──────────────────────────────────────────────────────

const PRIORITY_MAP: Record<string, Priority> = {
  'highest':  'Critical',
  'critical': 'Critical',
  'high':     'High',
  'medium':   'Medium',
  'low':      'Low',
  'lowest':   'Low',
  'trivial':  'Low',
  'minor':    'Low',
  'major':    'High',
  'blocker':  'Critical',
}

function mapPriority(jiraPriority?: string): Priority {
  if (!jiraPriority) return 'Medium'
  return PRIORITY_MAP[jiraPriority.toLowerCase()] ?? 'Medium'
}

// ─── ADF plain-text extractor ──────────────────────────────────────────────
// Jira Cloud stores rich text as Atlassian Document Format (ADF) — a nested
// JSON structure. We walk the tree collecting text nodes into a flat string.

function extractAdfText(node: JiraAdfNode): string {
  if (node.text) return node.text
  if (node.content) return node.content.map(extractAdfText).join('')
  return ''
}

function extractDescription(raw: JiraEpic['fields']['description']): string {
  if (!raw) return ''
  if (typeof raw === 'string') return raw
  // ADF doc object
  const adf = raw as JiraAdf
  if (adf.content) return adf.content.map(extractAdfText).join('\n').trim()
  return ''
}

// ─── Main mapper ───────────────────────────────────────────────────────────

/**
 * Convert a single Jira Epic into a ProjectDraft ready to pass to addProject().
 *
 * This function is the stable contract between Jira and SAT. When we add a
 * live API connection, we still call this same function — only the source of
 * JiraEpic changes (fetch vs paste).
 *
 * @param epic   A JiraEpic from the REST API or pasted JSON
 * @returns      A project draft (no id or updatedAt — the store generates those)
 */
export function mapEpicToProject(epic: JiraEpic): Omit<Project, 'id' | 'updatedAt'> {
  const { fields } = epic
  const statusName = fields.status?.name ?? 'To Do'

  return {
    name:            fields.summary,
    description:     extractDescription(fields.description),
    status:          mapStatus(statusName),
    phase:           mapPhase(statusName),
    priority:        mapPriority(fields.priority?.name),
    startDate:       fields.created ? fields.created.slice(0, 10) : '',
    targetEndDate:   fields.duedate ?? '',
    percentComplete: mapStatus(statusName) === 'Complete' ? 100 : 0,
    initiativeId:    '',
    stakeholders:    '',
    notes:           `Imported from Jira · ${epic.key}`,
    assignments:     [],
  }
}

// ─── JSON parser ───────────────────────────────────────────────────────────

export interface ParseResult {
  epics: JiraEpic[]
  error?: string
}

/**
 * Parse raw JSON pasted by the user. Accepts three shapes:
 *   1. Full Jira API response:  { "issues": [...] }
 *   2. Array of issues:         [ { "id": ..., "fields": {...} }, ... ]
 *   3. Single issue object:     { "id": ..., "fields": {...} }
 *
 * Returns an array of JiraEpic objects plus an optional error string when
 * the JSON is valid but doesn't match any expected shape.
 */
export function parseJiraJson(raw: string): ParseResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return { epics: [], error: 'Invalid JSON — check for missing brackets or commas.' }
  }

  // Shape 1: { issues: [...] }  (standard Jira /search response)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    if (Array.isArray(obj.issues)) {
      const epics = obj.issues.filter(isJiraEpic)
      if (epics.length === 0) {
        return { epics: [], error: 'No valid Jira issues found in the "issues" array.' }
      }
      return { epics }
    }

    // Shape 3: single issue object
    if (isJiraEpic(parsed)) return { epics: [parsed] }
  }

  // Shape 2: array of issues
  if (Array.isArray(parsed)) {
    const epics = parsed.filter(isJiraEpic)
    if (epics.length === 0) {
      return { epics: [], error: 'None of the items look like Jira issues (missing "id" or "fields").' }
    }
    return { epics }
  }

  return { epics: [], error: 'Unrecognized format. Paste a Jira /search API response or an array of issues.' }
}

/** Type guard: does this object have the minimum fields of a JiraEpic? */
function isJiraEpic(x: unknown): x is JiraEpic {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.fields === 'object' && o.fields !== null
}

// ─── Future: live API connection ───────────────────────────────────────────
// When ready, add a function like:
//
//   export async function fetchJiraEpics(config: JiraConnectionConfig): Promise<ParseResult> {
//     const { domain, email, token, projectKey } = config
//     const url = `https://${domain}/rest/api/3/search?jql=project=${projectKey}+AND+issuetype=Epic&maxResults=100`
//     // Requests must go through a backend proxy — browsers block direct
//     // Jira API calls due to CORS. A lightweight Vite proxy or edge function
//     // (Vercel/Netlify function, Supabase Edge Function) is the right pattern.
//     const res = await fetch('/api/jira-proxy', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ url, email, token }),
//     })
//     const data: JiraSearchResponse = await res.json()
//     return { epics: data.issues ?? [] }
//   }
//
// Then in JiraImportDialog, replace parseJiraJson() with fetchJiraEpics().
// The mapEpicToProject() call is identical — the adapter doesn't change.
