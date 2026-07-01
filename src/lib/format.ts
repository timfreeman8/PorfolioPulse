/**
 * format.ts — Centralised date-formatting helpers.
 *
 * Prevents the same `toLocaleDateString` config being reimplemented in every
 * page component.  Import these instead of writing inline date logic.
 *
 * Note: `src/lib/dates.ts` already exports `formatLocalDate` (long format) and
 * `relativeDate`.  This file covers the *short* / *compact* variants that are
 * used inside tables and filter chips where screen space is limited.
 *
 * All helpers append `T00:00:00` to ISO date strings before constructing a
 * `Date` so the value is parsed in **local time** rather than UTC — otherwise
 * a date like "2026-01-31" would display as "Jan 30" in negative-UTC timezones.
 */

/**
 * Format an ISO date string (YYYY-MM-DD) as "Jan 5, 2026".
 * Returns "—" for empty / null / undefined input.
 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  })
}

/**
 * Compact variant — "Jan 5, '26" — for space-constrained table cells.
 * Returns "—" for empty / null / undefined input.
 */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  '2-digit',
  })
}
