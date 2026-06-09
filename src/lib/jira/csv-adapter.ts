/**
 * Jira CSV export → SAT project adapter.
 *
 * Jira's "CSV - all fields" export produces a standard RFC 4180 CSV with a
 * header row. Column names vary slightly between Jira Cloud versions, so we
 * match them case-insensitively and accept common aliases (e.g. "Due Date"
 * and "Due date" are both handled).
 *
 * The mapping mirrors mapEpicToProject() in adapter.ts — reusing the same
 * STATUS_MAP, PRIORITY_MAP, and phase/status helper functions so behaviour is
 * identical regardless of whether data came from JSON or CSV.
 *
 * Usage:
 *   const result = parseJiraCsv(fileText)
 *   result.rows.forEach(row => addProject(row))
 */

import type { Project, ProjectStatus, ProjectPhase, Priority } from '@/types'

// ─── Status / Phase / Priority maps (kept in sync with adapter.ts) ──────────

const STATUS_MAP: Record<string, ProjectStatus> = {
  'to do':                    'Backlog',
  'backlog':                  'Backlog',
  'open':                     'Backlog',
  'selected for development': 'Backlog',
  'in progress':              'In Progress',
  'in review':                'In Progress',
  'in development':           'In Progress',
  'code review':              'In Progress',
  'testing':                  'In Progress',
  'blocked':                  'Blocked',
  'impediment':               'Blocked',
  'on hold':                  'Blocked',
  'done':                     'Complete',
  'complete':                 'Complete',
  'completed':                'Complete',
  'closed':                   'Complete',
  'resolved':                 'Complete',
  'released':                 'Complete',
}

function mapStatus(raw: string): ProjectStatus {
  return STATUS_MAP[raw.trim().toLowerCase()] ?? 'Backlog'
}

function mapPhase(raw: string): ProjectPhase {
  const s = raw.trim().toLowerCase()
  if (['done', 'complete', 'completed', 'closed', 'resolved', 'released'].includes(s)) return 'Deployed'
  if (['in progress', 'in review', 'code review', 'in development'].includes(s)) return 'Development'
  if (['testing', 'qa'].includes(s)) return 'QA'
  if (['on hold'].includes(s)) return 'On Hold'
  return 'Discovery'
}

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

function mapPriority(raw?: string): Priority {
  if (!raw) return 'Medium'
  return PRIORITY_MAP[raw.trim().toLowerCase()] ?? 'Medium'
}

// ─── RFC 4180 CSV parser ─────────────────────────────────────────────────────

/**
 * Parse a full CSV string into an array of rows, where each row is a string[].
 * Handles quoted fields, embedded commas, and escaped double-quotes ("").
 * Returns the header row as row[0] and data rows after it.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  // Normalise line endings
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  let i = 0

  while (i < normalized.length) {
    const row: string[] = []

    // Parse cells until we hit a newline that's outside a quoted field
    while (i < normalized.length && normalized[i] !== '\n') {
      if (normalized[i] === '"') {
        // Quoted field: consume until closing unescaped quote
        i++ // skip opening quote
        let cell = ''
        while (i < normalized.length) {
          if (normalized[i] === '"' && normalized[i + 1] === '"') {
            // Escaped quote inside field
            cell += '"'
            i += 2
          } else if (normalized[i] === '"') {
            i++ // skip closing quote
            break
          } else {
            cell += normalized[i]
            i++
          }
        }
        row.push(cell)
        // Consume trailing comma (or leave newline for outer loop)
        if (normalized[i] === ',') i++
      } else {
        // Unquoted field: read until comma or newline
        let cell = ''
        while (i < normalized.length && normalized[i] !== ',' && normalized[i] !== '\n') {
          cell += normalized[i]
          i++
        }
        row.push(cell)
        if (normalized[i] === ',') i++
      }
    }

    // Skip the newline character
    if (normalized[i] === '\n') i++

    // Skip completely empty trailing rows
    if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
      rows.push(row)
    }
  }

  return rows
}

// ─── Column resolver ─────────────────────────────────────────────────────────

/**
 * Build a case-insensitive column lookup from the header row.
 * Returns a function that finds a column index by any of the given aliases.
 *
 * Jira column names differ between Cloud and Server, and between "my defaults"
 * and "all fields" exports. We accept multiple aliases per field.
 */
function makeColFinder(headers: string[]) {
  const lower = headers.map(h => h.trim().toLowerCase())
  return function find(...aliases: string[]): number {
    for (const alias of aliases) {
      const idx = lower.indexOf(alias.toLowerCase())
      if (idx !== -1) return idx
    }
    return -1
  }
}

// ─── Public types ─────────────────────────────────────────────────────────────

/** A parsed CSV row ready to be committed as a project. Carries the Jira key
 *  as an identifier so the preview table can show it and detect duplicates.
 *  assigneeName is the raw Jira display name used for roster matching in the dialog. */
export interface CsvProjectDraft extends Omit<Project, 'id' | 'updatedAt'> {
  jiraKey: string
  assigneeName: string
}

export interface CsvParseResult {
  drafts: CsvProjectDraft[]
  /** Human-readable error, set when parsing fails entirely. */
  error?: string
  /** Rows that were skipped (e.g. wrong issue type), with a reason. */
  skipped: Array<{ row: number; key: string; reason: string }>
  /**
   * Unique assignee names found in the CSV. These are collected for the
   * post-import report so the user knows which people were not linked.
   * Always a subset of the rows that were NOT skipped.
   */
  assigneesFound: string[]
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse the text content of a Jira CSV export file and return project drafts.
 *
 * @param text  Raw UTF-8 content of the .csv file
 * @param filterEpicsOnly  When true (default), skip rows whose Issue Type is
 *   not "Epic". Set to false to import all issue types.
 */
export function parseJiraCsv(text: string, filterEpicsOnly = true): CsvParseResult {
  const rows = parseCsv(text.trim())

  if (rows.length < 2) {
    return { drafts: [], skipped: [], error: 'CSV appears empty — make sure you exported a non-empty issue list.' }
  }

  const [headerRow, ...dataRows] = rows
  const col = makeColFinder(headerRow)

  // Locate the columns we care about. Aliases cover Cloud vs Server differences.
  const iKey        = col('Issue key', 'Key', 'Issue Key')
  const iSummary    = col('Summary')
  const iStatus     = col('Status')
  const iPriority   = col('Priority')
  const iDueDate    = col('Due Date', 'Due date', 'Due')
  const iCreated    = col('Created')
  const iDescription= col('Description')
  const iIssueType  = col('Issue Type', 'Issue type', 'Type', 'Issuetype')
  const iAssignee   = col('Assignee', 'Assignee Name', 'assignee')

  // Summary is the bare minimum — if we can't find it the CSV is unrecognisable
  if (iSummary === -1) {
    return {
      drafts: [],
      skipped: [],
      error: 'Could not find a "Summary" column. Make sure this is a Jira issue export (not a board export or custom report).',
    }
  }

  const drafts: CsvProjectDraft[] = []
  const skipped: CsvParseResult['skipped'] = []
  const assigneeSet = new Set<string>()

  dataRows.forEach((row, idx) => {
    const rowNum = idx + 2 // 1-indexed, +1 for header

    const get = (colIdx: number) => (colIdx >= 0 && colIdx < row.length ? row[colIdx].trim() : '')

    const issueType = get(iIssueType)
    const key       = iKey >= 0 ? get(iKey) : `ROW-${rowNum}`
    const summary   = get(iSummary)

    if (!summary) {
      skipped.push({ row: rowNum, key, reason: 'Empty summary — skipped' })
      return
    }

    // Optionally filter to Epics only
    if (filterEpicsOnly && issueType && issueType.toLowerCase() !== 'epic') {
      skipped.push({ row: rowNum, key, reason: `Issue type "${issueType}" (not Epic)` })
      return
    }

    const statusRaw   = get(iStatus)
    const priorityRaw = get(iPriority)
    const dueDate     = get(iDueDate)
    const created     = get(iCreated)
    const description = get(iDescription)
    const assignee    = get(iAssignee)

    // Collect assignee names for the post-import report (we don't import them,
    // but the user needs to know who needs to be linked manually afterwards)
    if (assignee && assignee.toLowerCase() !== 'unassigned') {
      assigneeSet.add(assignee)
    }

    // Jira created datetime is often "05/Jun/26 9:45 AM" or ISO "2026-06-05T09:45:00.000+0000"
    // We normalise to YYYY-MM-DD
    const startDate = normaliseDate(created)

    drafts.push({
      jiraKey:         key,
      assigneeName:    assignee,
      name:            summary,
      description:     description,
      status:          mapStatus(statusRaw),
      phase:           mapPhase(statusRaw),
      priority:        mapPriority(priorityRaw),
      startDate:       startDate,
      targetEndDate:   normaliseDate(dueDate),
      percentComplete: mapStatus(statusRaw) === 'Complete' ? 100 : 0,
      initiativeId:    '',
      stakeholders:    '',
      notes:           key ? `Imported from Jira · ${key}` : 'Imported from Jira CSV',
      assignments:     [],
    })
  })

  const assigneesFound = Array.from(assigneeSet).sort()

  if (drafts.length === 0 && skipped.length > 0) {
    return {
      drafts: [],
      skipped,
      assigneesFound,
      error: filterEpicsOnly
        ? `No Epics found. The CSV contains ${skipped.length} rows but none have Issue Type = Epic. Try unchecking "Epics only" or export with all fields included.`
        : 'No importable rows found.',
    }
  }

  return { drafts, skipped, assigneesFound }
}

// ─── Date normaliser ──────────────────────────────────────────────────────────

/**
 * Try to extract a YYYY-MM-DD string from whatever date format Jira used.
 * Returns '' when the input is blank or unrecognisable.
 *
 * Handles:
 *   - ISO datetime:  "2026-06-05T09:45:00.000+0000"  → "2026-06-05"
 *   - ISO date:      "2026-06-05"                     → "2026-06-05"
 *   - Jira compact: "05/Jun/26 9:45 AM"              → "2026-06-05"
 *   - US short:     "6/5/2026"                        → "2026-06-05"
 */
function normaliseDate(raw: string): string {
  if (!raw) return ''

  // Already ISO datetime — just take the date part
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) return isoMatch[1]

  // Jira compact: DD/Mon/YY or DD/Mon/YYYY
  const jiraMatch = raw.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})/)
  if (jiraMatch) {
    const day   = jiraMatch[1].padStart(2, '0')
    const month = MONTH_ABBR[jiraMatch[2].toLowerCase()] ?? '01'
    const yr    = jiraMatch[3].length === 2 ? `20${jiraMatch[3]}` : jiraMatch[3]
    return `${yr}-${month}-${day}`
  }

  // US short: M/D/YYYY
  const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (usMatch) {
    const month = usMatch[1].padStart(2, '0')
    const day   = usMatch[2].padStart(2, '0')
    return `${usMatch[3]}-${month}-${day}`
  }

  return ''
}

const MONTH_ABBR: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}
