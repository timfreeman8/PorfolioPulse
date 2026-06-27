/**
 * Sidebar — left-side navigation panel.
 *
 * Desktop (≥ md breakpoint):
 *   - Always visible in layout flow.
 *   - Supports collapsed (icon-only, w-16) / expanded (w-56) toggle via the
 *     bottom chevron button.  The `mobileOpen` prop is irrelevant at this size.
 *
 * Mobile (< md breakpoint):
 *   - Rendered as a fixed off-canvas overlay; hidden by default (translated
 *     fully off-screen to the left).
 *   - Slides in when `mobileOpen` is true via CSS translate transition.
 *   - A semi-transparent backdrop covers the page behind it; tapping the
 *     backdrop calls `onMobileClose` to dismiss.
 *   - Clicking any nav link also calls `onMobileClose` so navigation feels
 *     instant without leaving an open overlay.
 *   - On mobile the sidebar is always expanded (collapsed mode makes little
 *     sense on a narrow screen), so the collapse button is hidden on mobile.
 */
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Target,
  ClipboardList,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Layers,
  Network,
  Activity,
  Sun,
  Moon,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useTheme } from '@/lib/useTheme'

// Use CSS variable so dark mode flips it automatically (--sidebar is
// defined in index.css for both :root and .dark).
const SIDEBAR_BG = 'var(--sidebar)'

const NAV_ITEMS = [
  { to: '/',            label: 'Dashboard',   icon: LayoutDashboard, end: true },
  { to: '/people',      label: 'People',      icon: Network },
  { to: '/initiatives', label: 'Initiatives', icon: Target },
  { to: '/epics',    label: 'Epics',       icon: Layers },
  { to: '/planning',    label: 'Planning',    icon: Calendar },
  { to: '/analytics',   label: 'Analytics',   icon: BarChart3 },
  { to: '/pipeline',    label: 'Pipeline',    icon: ClipboardList },
  { to: '/escalations', label: 'Escalations', icon: ShieldAlert },
  { to: '/pulse',       label: 'Pulse',       icon: Activity },
]

interface SidebarProps {
  /** Whether the mobile overlay is open. Ignored on desktop (≥ md). */
  mobileOpen: boolean
  /** Called when the overlay should be dismissed (backdrop tap, nav click). */
  onMobileClose: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  // Desktop-only collapsed state; mobile sidebar is always expanded.
  const [collapsed, setCollapsed] = useState(false)
  const { escalations } = usePortfolioStore()
  const openCount = escalations.filter(e => e.status === 'Open').length
  const { isDark, toggle: toggleTheme } = useTheme()

  // The <aside> is used in two different layout contexts:
  //   Desktop: a shrink-0 flex child in the row, width driven by `collapsed`.
  //   Mobile:  a fixed overlay panel; z-40 sits above page content but below
  //            the TopBar (z-30 is fine since TopBar uses z-30 and is above in DOM).
  const asideClasses = cn(
    // ── Mobile: fixed overlay, slides in from the left ──────────────────
    // Always full height; width fixed at 224px (w-56) since we never collapse
    // on mobile.  `translate-x-full` would slide right; `-translate-x-full`
    // slides left (off-screen).  We want it off to the LEFT when closed.
    'fixed inset-y-0 left-0 z-40 flex flex-col h-full text-slate-700',
    'transition-transform duration-300 ease-in-out w-56',
    mobileOpen ? 'translate-x-0' : '-translate-x-full',
    // ── Desktop (md+): restore to layout-flow position, remove translate ─
    // `md:relative` pulls it out of the fixed overlay stack back into the flex
    // row.  `md:translate-x-0` neutralises any leftover mobile translate so the
    // sidebar always shows.  Width is driven by the collapsed state.
    'md:relative md:translate-x-0 md:shrink-0',
    collapsed ? 'md:w-16' : 'md:w-56',
    'border-r border-slate-200',
  )

  return (
    <>
      {/* ── Mobile backdrop ─────────────────────────────────────────────────
          Covers the page behind the overlay.  Only rendered when the sidebar
          is open so there is no invisible click-interceptor when it's closed. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={onMobileClose}
        />
      )}

      <aside className={asideClasses} style={{ background: SIDEBAR_BG }}>
        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              // Close the mobile overlay on any navigation so the page appears
              // immediately without requiring a manual backdrop tap.
              onClick={onMobileClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-200 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  // On desktop, when collapsed, centre icons and remove text padding.
                  // On mobile the sidebar is always expanded so `collapsed` never
                  // applies — the md: prefix gates it.
                  collapsed && 'md:justify-center md:px-0',
                )
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {/* Label: always rendered (mobile is always expanded); hidden via
                  md:hidden on desktop when the sidebar is in collapsed mode. */}
              <span className={cn('flex-1', collapsed && 'md:hidden')}>
                {label}
              </span>
              {/* Escalation badge — hidden on desktop when collapsed */}
              {label === 'Escalations' && openCount > 0 && (
                <span className={cn(
                  'text-[10px] font-bold bg-red-500 text-white rounded-full leading-none size-[18px] flex items-center justify-center shrink-0',
                  collapsed && 'md:hidden',
                )}>
                  {openCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom controls: dark mode toggle + desktop collapse/expand.
            The collapse button is hidden on mobile (md:flex) because the mobile
            sidebar is always expanded and closing is done via backdrop/nav click. */}
        <div className="border-t border-slate-200">
          {collapsed ? (
            // Desktop collapsed: stack dark toggle above expand button
            <div className="hidden md:flex flex-col">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center py-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button
                onClick={() => setCollapsed(false)}
                className="flex items-center justify-center py-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                aria-label="Expand sidebar"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            // Desktop expanded: dark toggle on left, collapse on right.
            // On mobile: show only the dark toggle (no collapse button).
            <div className="flex items-center">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-10 py-3 border-r border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              {/* Collapse button — desktop only */}
              <button
                onClick={() => setCollapsed(true)}
                className="hidden md:flex flex-1 items-center justify-center gap-1 py-3 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors text-xs"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft size={16} />
                <span>Collapse</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
