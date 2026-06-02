/**
 * Centralized color maps for every status/phase/priority enum value.
 *
 * All badge colors across the app come from here — change one entry and every
 * badge that uses it updates automatically. Values are Tailwind utility classes
 * in "bg-X text-X" format, ready to pass directly into `className`.
 *
 * Each entry includes a `dark:` variant so badges render correctly in dark
 * mode across every page that consumes these maps. Dark variants use the
 * -950/30 pattern (very dark tinted bg) with a lighter -300 text so the
 * hue stays recognizable without washing out on dark surfaces.
 *
 * CHART_COLORS uses hex values instead because recharts doesn't understand
 * Tailwind class names.
 */
import type { ProjectStatus, ProjectPhase, Priority, InitiativeStatus, IntakeStatus } from '@/types'

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  'Backlog':     'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
  'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  'Blocked':     'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  'Complete':    'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
}

export const PHASE_COLORS: Record<ProjectPhase, string> = {
  'Research':    'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  'Discovery':   'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  'Development': 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  'QA':          'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  'Deployed':    'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  'On Hold':     'bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400',
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  'Low':      'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
  'Medium':   'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  'High':     'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  'Critical': 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
}

export const INITIATIVE_STATUS_COLORS: Record<InitiativeStatus, string> = {
  'Planning': 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
  'Active':   'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  'Complete': 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  'On Hold':  'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
}

export const INTAKE_STATUS_COLORS: Record<IntakeStatus, string> = {
  'Pending Review': 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  'Approved':       'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  'Rejected':       'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  'Deferred':       'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
}

// ─── Avatar colors ────────────────────────────────────────────────────────

// 12-slot palette of light-bg + dark-text pairs for member avatars.
// Stays within shadcn/Tailwind's color system so they feel native.
const AVATAR_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: 'bg-violet-100',  text: 'text-violet-700' },
  { bg: 'bg-purple-100',  text: 'text-purple-700' },
  { bg: 'bg-pink-100',    text: 'text-pink-700' },
  { bg: 'bg-rose-100',    text: 'text-rose-700' },
  { bg: 'bg-blue-100',    text: 'text-blue-700' },
  { bg: 'bg-sky-100',     text: 'text-sky-700' },
  { bg: 'bg-teal-100',    text: 'text-teal-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-green-100',   text: 'text-green-700' },
  { bg: 'bg-amber-100',   text: 'text-amber-700' },
  { bg: 'bg-orange-100',  text: 'text-orange-700' },
  { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
]

/**
 * Derive a stable avatar color from a member's name.
 * The same name always maps to the same palette slot (polynomial hash),
 * so colors are consistent across page loads and re-renders.
 */
export function avatarColor(name: string): { bg: string; text: string } {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

// recharts palette — consistent across all charts
export const CHART_COLORS = {
  phase: {
    Research:    '#a78bfa',
    Discovery:   '#818cf8',
    Development: '#60a5fa',
    QA:          '#fb923c',
    Deployed:    '#34d399',
    'On Hold':   '#94a3b8',
  },
  status: {
    Backlog:      '#94a3b8',
    'In Progress':'#60a5fa',
    Blocked:      '#f87171',
    Complete:     '#34d399',
  },
}
