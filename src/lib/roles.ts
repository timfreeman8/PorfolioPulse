/**
 * Shared SDLC role definitions — single source of truth used by:
 *   - ProjectFormDialog  (Role chip picker)
 *   - CapacityPlannerPage (Gantt bar colors + By Project legend)
 *
 * Keeping both the ordered list and the color map here prevents the form
 * and the chart from drifting apart when roles are added or renamed.
 */

/** Canonical ordered list of approved roles. */
export const SDLC_ROLES = [
  'Product Management',
  'UI Design',
  'UX Research',
  'Frontend',
  'Backend',
  'API',
  'Engineering',
  'Architecture',
  'Data',
  'Analysis',
  'QA',
  'QA Lead',
  'Automation',
  'DevOps',
  'Infrastructure',
  'SRE',
  'Security',
  'Support',
] as const

export type SdlcRole = typeof SDLC_ROLES[number]

/**
 * Tailwind `bg-*` class for each role.
 * Used for Gantt bar backgrounds and legend color dots.
 */
export const ROLE_COLORS: Record<string, string> = {
  'Product Management': 'bg-violet-500',
  'UI Design':          'bg-pink-500',
  'UX Research':        'bg-rose-500',
  'Frontend':           'bg-blue-500',
  'Backend':            'bg-indigo-500',
  'API':                'bg-teal-500',
  'Engineering':        'bg-sky-500',
  'Architecture':       'bg-orange-500',
  'Data':               'bg-amber-500',
  'Analysis':           'bg-cyan-500',
  'QA':                 'bg-emerald-500',
  'QA Lead':            'bg-emerald-700',
  'Automation':         'bg-purple-500',
  'DevOps':             'bg-green-500',
  'Infrastructure':     'bg-lime-600',
  'SRE':                'bg-slate-500',
  'Security':           'bg-red-500',
  'Support':            'bg-slate-400',
}

/** Fallback color for any unrecognized role string. */
export const DEFAULT_ROLE_COLOR = 'bg-slate-400'

/**
 * Maps old/abbreviated role strings (from seed data and legacy localStorage)
 * to their canonical names. Applied as a one-time migration on store load.
 */
export const ROLE_ALIASES: Record<string, string> = {
  'PM':     'Product Management',
  'Design': 'UI Design',
}

/** Normalize a part string — splits on commas, maps aliases, rejoins. */
export function normalizeRoles(part: string | undefined): string | undefined {
  if (!part) return part
  return part
    .split(',')
    .map(r => {
      const trimmed = r.trim()
      return ROLE_ALIASES[trimmed] ?? trimmed
    })
    .join(', ')
}
