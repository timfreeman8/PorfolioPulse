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
 *
 * Security notes:
 *   - setTeamsWebhookUrl validates that the URL is HTTPS and belongs to a
 *     Microsoft domain before persisting it.  This prevents an attacker who
 *     gains Settings access from using the webhook to exfiltrate data to an
 *     arbitrary endpoint (SSRF).
 *   - sendTeamsAlert uses an AbortController timeout so a slow or unresponsive
 *     webhook never hangs the browser tab.
 */

/** localStorage key for the Teams webhook URL. */
export const TEAMS_WEBHOOK_KEY = 'sat_teams_webhook'

/**
 * Allowed hostnames for Teams incoming webhooks.
 * Both outlook.office.com and webhooks.microsoft.com are used depending on
 * tenant configuration.  Only HTTPS is accepted.
 */
const ALLOWED_WEBHOOK_HOSTS = [
  'outlook.office.com',
  'outlook.office365.com',
  'webhooks.microsoft.com',
  'prod-15.westus.logic.azure.com',  // Azure Logic Apps webhook relay
]

/**
 * Validate a Teams webhook URL.
 * Returns a normalized URL string on success, or an error message string on failure.
 * Using a discriminated return instead of throwing so the Settings form can
 * surface the message inline without a try/catch.
 */
export function validateWebhookUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'URL is required.' }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'Not a valid URL.' }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only HTTPS webhook URLs are accepted.' }
  }

  const allowed = ALLOWED_WEBHOOK_HOSTS.some(
    h => parsed.hostname === h || parsed.hostname.endsWith('.' + h),
  )
  if (!allowed) {
    return {
      ok: false,
      reason: 'URL must be a Microsoft Teams or Azure webhook endpoint (outlook.office.com or webhooks.microsoft.com).',
    }
  }

  return { ok: true, url: trimmed }
}

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
 * Save the Teams webhook URL to localStorage after validation.
 * Pass an empty string to clear it.
 * Returns true on success, false if the URL failed validation (non-empty input).
 */
export function setTeamsWebhookUrl(url: string): boolean {
  try {
    if (!url.trim()) {
      localStorage.removeItem(TEAMS_WEBHOOK_KEY)
      return true
    }
    const result = validateWebhookUrl(url)
    if (!result.ok) {
      console.warn('[notifications] Rejected webhook URL:', result.reason)
      return false
    }
    localStorage.setItem(TEAMS_WEBHOOK_KEY, result.url)
    return true
  } catch {
    console.error('[notifications] Failed to save webhook URL')
    return false
  }
}

/** How long (ms) to wait for the Teams webhook before aborting the request. */
const WEBHOOK_TIMEOUT_MS = 8_000

/**
 * Fire-and-forget Teams notification.
 *
 * Sends a MessageCard to the configured webhook URL. Does nothing if no URL
 * is configured. Errors are logged to the console and never re-thrown so
 * a failed notification never blocks the user action that triggered it.
 *
 * Includes an AbortController timeout so a slow endpoint doesn't hang the tab.
 *
 * @param title   Bold heading line (e.g. "Project Blocked")
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

  // Serialize first so a circular-reference error is caught here, not inside
  // the promise chain where it would produce an unhandled rejection.
  let body: string
  try {
    body = JSON.stringify(payload)
  } catch (err) {
    console.error('[notifications] Failed to serialize Teams payload:', err)
    return
  }

  // AbortController gives us a hard timeout without needing a library.
  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

  // Fire-and-forget — .catch() ensures errors never become unhandled rejections.
  fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal:  controller.signal,
  })
    .then(res => {
      clearTimeout(timeoutId)
      if (!res.ok) {
        console.warn(`[notifications] Teams webhook returned HTTP ${res.status}`)
      }
    })
    .catch(err => {
      clearTimeout(timeoutId)
      if ((err as Error).name === 'AbortError') {
        console.warn('[notifications] Teams webhook timed out after', WEBHOOK_TIMEOUT_MS, 'ms')
      } else {
        console.error('[notifications] Teams webhook failed:', err)
      }
    })
}
