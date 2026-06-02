import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderTree,
  Users,
  BookUser,
  Target,
  ClipboardList,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Layers,
  Settings,
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
  { to: '/portfolio',   label: 'Portfolio',   icon: FolderTree },
  { to: '/initiatives', label: 'Initiatives', icon: Target },
  { to: '/projects',    label: 'Projects',    icon: Layers },
  { to: '/roster',      label: 'Roster',      icon: BookUser },
  { to: '/teams',       label: 'Teams',       icon: Users },
  { to: '/planning',    label: 'Planning',    icon: Calendar },
  { to: '/analytics',   label: 'Analytics',   icon: BarChart3 },
  { to: '/pipeline',    label: 'Pipeline',    icon: ClipboardList },
  { to: '/escalations', label: 'Escalations', icon: ShieldAlert },
  { to: '/settings',    label: 'Settings',    icon: Settings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { escalations } = usePortfolioStore()
  const openCount = escalations.filter(e => e.status === 'Open').length
  const { isDark, toggle: toggleTheme } = useTheme()

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full text-slate-700 transition-all duration-300 shrink-0 border-r border-slate-200',
        collapsed ? 'w-16' : 'w-56',
      )}
      style={{ background: SIDEBAR_BG }}
    >
      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                collapsed && 'justify-center px-0',
              )
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span className="flex-1">{label}</span>}
            {!collapsed && label === 'Escalations' && openCount > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white rounded-full leading-none size-[18px] flex items-center justify-center shrink-0">
                {openCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom controls: dark mode toggle + collapse/expand */}
      <div className="border-t border-slate-200">
        {collapsed ? (
          // When collapsed: stack dark toggle above expand button
          <div className="flex flex-col">
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
          // When expanded: dark toggle on left, collapse on right
          <div className="flex items-center">
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-10 py-3 border-r border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={() => setCollapsed(true)}
              className="flex-1 flex items-center justify-center gap-1 py-3 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors text-xs"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={16} />
              <span>Collapse</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
