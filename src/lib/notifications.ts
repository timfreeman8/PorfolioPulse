/**
 * Notifications — Microsoft Teams webhook integration.
 *
 * Sends an Adaptive Card message to a Teams channel via an incoming webhook URL
 * configured in Settings → Notifications. The webhook URL is stored in
 * localStorage under `sat_teams_webhook` (separate from the portfolio state so
 * it doesn't bloat snapshots or get overwritten by data imports).
 *
 * Teams incoming webhooks accept the legacy MessageCard JSON format. The
 * Adaptive Card format requires a separate connector — MessageCard is simpler
 * and works with any Teams incoming webhook created from the Connections UI.
 *
 * Usage:
 *   import { sendTeamsAlert } from '@/lib/notifications'
 *   sendTeamsAlert('Project X is now Blocked', 'Assigned to Alice · Created by Bob')
 *
 * The function is fire-and-forget (non-blocking, errors only go to console)
 * so a failed notification never blocks a user action.
 */

/** localStorage key for the Teams webhook URL. */
export const TEAMS_WEBHOOK_KEY = 'sat_teams_webhook'

/**
 * Read the configured Teams webhook URL from localStorage.
 * Returns an empty string when none is configured.
 */
export function getTeamsWebhookUrl(): string {
  try {
    return localStorage.getItem(TEAMS_WEBHOOK_KEY) ?? ''
  } catch {
    return ''
  }
}

/**
 * Save the Teams webhook URL to localStorage.
 * Pass an empty string to clear it.
 */
export function setTeamsWebhookUrl(url: string): void {
  try {
    if (url.trim()) {
      localStorage.setItem(TEAMS_WEBHOOK_KEY, url.trim())
    } else {
      localStorage.removeItem(TEAMS_WEBHOOK_KEY)
    }
  } catch {
    console.error('[notifications] Failed to save webhook URL')
  }
}

/**
 * Fire-and-forget Teams notification.
 *
 * Sends a MessageCard to the configured webhook URL. Does nothing if no URL
 * is configured. Errors are logged to the console and never re-thrown so
 * a failed notification never blocks the user action that triggered it.
 *
 * @param title   Bold heading line (e.g. "🚨 Project Blocked")
 * @param message Supporting detail (e.g. "Portal Upgrade is now Blocked")
 */
export function sendTeamsAlert(title: string, message: string): void {
  const url = getTeamsWebhookUrl()
  if (!url) return

  // MessageCard format — supported by all Teams incoming webhooks.
  const payload = {
    '@type':      'MessageCard',
    '@context':   'https://schema.org/extensions',
    summary:      title,
    themeColor:   'E53E3E', // Red — used for blocked/over-capacity alerts
    title,
    text:         message,
    potentialAction: [{
      '@type':  'OpenUri',
      name:     'Open Portfolio Pulse',
      targets:  [{ os: 'default', uri: window.location.origin }],
    }],
  }

  // Fire-and-forget — use .catch() so errors don't surface as unhandled rejections.
  fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }).catch(err => {
    console.error('[notifications] Teams webhook failed:', err)
  })
}
