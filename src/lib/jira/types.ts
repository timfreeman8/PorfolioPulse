/**
 * Jira REST API type definitions.
 *
 * These mirror the shape returned by Jira Cloud's /rest/api/3/search endpoint
 * when querying for Epics (issuetype = Epic).
 *
 * Only the fields we actually use are typed here. The real response contains
 * dozens more customfields — anything not listed is ignored during mapping.
 *
 * When we add a live API connection, the same types are used: the adapter
 * (adapter.ts) consumes JiraEpic regardless of how the data was fetched.
 */

/** Top-level response from /rest/api/3/search */
export interface JiraSearchResponse {
  issues: JiraEpic[]
  total: number
  maxResults: number
  startAt: number
}

/** A single Jira issue (Epic) */
export interface JiraEpic {
  id: string
  key: string        // e.g. "PROJ-42"
  fields: JiraFields
}

/** Fields object inside a Jira issue */
export interface JiraFields {
  summary: string
  description?: JiraAdf | string | null

  status: {
    name: string     // e.g. "In Progress", "To Do", "Done"
  }

  priority?: {
    name: string     // e.g. "High", "Medium", "Low", "Highest", "Critical"
  }

  /** ISO date string, e.g. "2026-06-30" */
  duedate?: string | null

  /** ISO datetime string */
  created?: string

  assignee?: {
    displayName: string
    emailAddress?: string
  } | null

  labels?: string[]

  /** Story points — varies by Jira configuration (customfield_10016 or 10028) */
  story_points?: number | null

  /** Epic name (older Jira Server field) */
  customfield_10011?: string | null

  /** Sprint name — customfield varies but commonly 10020 */
  customfield_10020?: Array<{ name: string; state: string }> | null
}

/**
 * Atlassian Document Format (ADF) — used for rich-text fields in Jira Cloud.
 * We only extract plain text from it; the full spec is ignored.
 */
export interface JiraAdf {
  type: 'doc'
  version: number
  content?: JiraAdfNode[]
}

export interface JiraAdfNode {
  type: string
  text?: string
  content?: JiraAdfNode[]
}
