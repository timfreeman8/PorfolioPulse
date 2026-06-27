/**
 * Shared date/time formatting utilities.
 *
 * Centralises relative-time formatting so DashboardPage, EscalationsPage,
 * and IntakePage all produce consistent labels from the same function rather
 * than each carrying a slightly different local copy.
 */

/**
 * Converts an ISO datetime string into a short human-readable relative label.
 * Provides minute/hour precision for recent events, then falls back to
 * day/month granularity for older ones.
 *
 *   < 1 min  → "Just now"
 *   1–59 min → "Xm ago"
 *   1–23 h   → "Xh ago"
 *   1 day    → "Yesterday"
 *   2–29 d   → "Xd ago"
 *   30+ d    → "Xmo ago"
 */
export function relativeDate(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days  = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30)  return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

/**
 * Formats an ISO date string (YYYY-MM-DD) as a long locale date.
 * Appends T00:00:00 so the Date is parsed in local time rather than UTC.
 *
 *   "2025-06-15" → "June 15, 2025"
 */
export function formatLocalDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' },
): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', opts)
}
