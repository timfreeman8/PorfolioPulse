/**
 * TopBar — the persistent blue header across the top of every page.
 *
 * Contains:
 *   - Brand logo + wordmark (aligned to match sidebar width)
 *   - Flat sub-navigation tabs (decorative for now)
 *   - Search hint button — clicking it (or pressing cmd+K / ctrl+K anywhere)
 *     opens the global command palette (SearchModal). The button shows the
 *     keyboard shortcut so users discover the shortcut without hunting for it.
 *   - Right-side controls: notifications, settings, and the user/mode picker
 *
 * The user/mode picker is the primary way to switch between Admin mode (full
 * access, all data) and User mode (filtered to one member's projects, read-only
 * restrictions). Selecting a name from the dropdown calls `setActiveMember` in
 * the view store, which propagates to all pages that consume it.
 */
import { useState, useRef, useEffect } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Settings, Bell, ChevronDown, Shield, Search, Menu } from 'lucide-react'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useViewStore } from '@/store/useViewStore'
import { useTheme } from '@/lib/useTheme'
import { avatarColor } from '@/lib/colors'
import { cn } from '@/lib/utils'

// Light mode: Kroger brand blue. Dark mode: dark navy that reads well against
// the dark page background while keeping the header visually distinct.
const TOPBAR_BG_LIGHT = 'rgb(15, 82, 162)'
const TOPBAR_BG_DARK  = '#0a1628'          // Very dark navy — keeps blue brand, near-black

// Top nav links — map label to route. Evenly spaced via consistent px-5 padding.
const NAV_ITEMS: { label: string; to: string; end?: boolean }[] = [
  { label: 'Dashboard',   to: '/',           end: true },
  { label: 'Epics',       to: '/epics' },
  { label: 'Planning',    to: '/planning' },
  { label: 'People',      to: '/roster' },
  { label: 'Analytics',   to: '/analytics' },
]

export function TopBar({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) {
  const { members } = usePortfolioStore()
  const { activeMemberId, setActiveMember, setSearchOpen } = useViewStore()
  // isDark drives the header background and nav link colors below.
  const { isDark } = useTheme()
  const [open, setOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // Close the dropdown when the user clicks anywhere outside it.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const activeMember = members.find(m => m.id === activeMemberId) ?? null
  // Sort alphabetically so the list is easy to scan.
  const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <header
      className="flex items-center shrink-0 h-14 px-4 border-b z-30"
      style={{
        background: isDark ? TOPBAR_BG_DARK : TOPBAR_BG_LIGHT,
        // Keep border subtle in both modes: dark blue in light, near-black in dark.
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgb(30,58,138)',
      }}
    >
      {/* ── Hamburger (mobile only) ────────────────────────────────────────
          Tapping this fires onMobileMenuToggle (lifted up to AppLayout) which
          sets mobileOpen=true on the Sidebar overlay.  Hidden on desktop (md+)
          where the sidebar is always in the layout flow.                    */}
      <button
        onClick={onMobileMenuToggle}
        className="md:hidden flex items-center justify-center w-9 h-9 -ml-1 mr-2 text-blue-200 hover:text-white transition-colors shrink-0"
        aria-label="Open navigation menu"
      >
        <Menu size={22} />
      </button>

      {/* Brand — fixed width on desktop matches sidebar (224px) minus header
          px-4 (16px) = 208px so the sub-nav aligns with page body content.
          On mobile we omit the fixed width so it flows naturally beside the
          hamburger without overflowing.                                      */}
      <div className="flex items-center gap-3 shrink-0 md:w-[208px]">
        {/* Inlined SVG renders as true vector — avoids the pixelation that
            occurs when an <img> tag rasterizes an SVG at small display sizes */}
        <svg className="h-8 w-auto shrink-0" viewBox="0 0 180 181" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Kroger">
          <path d="M68.781 148.605C68.7498 150.922 68.0341 153.178 66.724 155.089C65.414 157 63.568 158.481 61.4184 159.345C59.2688 160.21 56.9115 160.419 54.6431 159.948C52.3747 159.476 50.2965 158.344 48.6699 156.694C47.0434 155.044 45.9411 152.949 45.5017 150.675C45.0624 148.4 45.3056 146.046 46.2007 143.909C47.0959 141.772 48.603 139.947 50.5326 138.664C52.4621 137.382 54.7279 136.698 57.0448 136.7C58.6 136.701 60.1394 137.011 61.5738 137.612C63.0082 138.213 64.309 139.093 65.4007 140.2C66.4925 141.308 67.3535 142.621 67.9337 144.064C68.514 145.507 68.802 147.05 68.781 148.605Z" fill="white"/>
          <path d="M154.209 160.5C160.697 160.5 165.956 155.175 165.956 148.606C165.956 142.036 160.697 136.711 154.209 136.711C147.722 136.711 142.463 142.036 142.463 148.606C142.463 155.175 147.722 160.5 154.209 160.5Z" fill="white"/>
          <path d="M56.3373 70.5086C56.2921 70.1302 56.327 69.7466 56.4399 69.3825C56.5527 69.0185 56.7409 68.6824 56.9923 68.3959C57.2416 68.1081 57.5498 67.8771 57.8961 67.7185C58.2423 67.56 58.6185 67.4776 58.9994 67.4769H90.8487C91.3223 67.4768 91.7873 67.603 92.1958 67.8425C92.6044 68.0821 92.9416 68.4262 93.1727 68.8396C93.406 69.254 93.5285 69.7215 93.5285 70.197C93.5285 70.6725 93.406 71.14 93.1727 71.5544L76.7674 100.351C76.5985 100.661 76.37 100.934 76.095 101.155C75.82 101.376 75.504 101.54 75.1652 101.638C74.8264 101.736 74.4715 101.766 74.121 101.727C73.7705 101.687 73.4313 101.579 73.1229 101.407C72.9732 101.322 72.8318 101.223 72.7004 101.111C63.9852 93.6087 58.238 83.2385 56.4958 71.8713C56.4535 71.5122 56.4007 71.0368 56.3373 70.5086ZM107.867 112.351C100.045 113.092 92.1629 111.842 84.9542 108.717C84.6025 108.566 84.287 108.342 84.0284 108.06C83.7698 107.777 83.5741 107.443 83.4542 107.08C83.3347 106.715 83.2927 106.329 83.3309 105.947C83.3691 105.565 83.4866 105.196 83.676 104.862L102.691 71.5544C102.922 71.1409 103.259 70.7965 103.667 70.5568C104.076 70.317 104.541 70.1906 105.015 70.1906C105.488 70.1906 105.953 70.317 106.362 70.5568C106.77 70.7965 107.108 71.1409 107.339 71.5544L125.709 103.795C125.893 104.113 126.01 104.466 126.053 104.831C126.096 105.197 126.063 105.567 125.957 105.92C125.851 106.272 125.674 106.599 125.437 106.88C125.2 107.161 124.908 107.391 124.578 107.555C119.353 110.176 113.686 111.803 107.867 112.351ZM140.096 95.1536C138.931 96.5722 137.686 97.923 136.367 99.1995C136.082 99.487 135.735 99.7052 135.352 99.837C134.969 99.9689 134.561 100.011 134.16 99.9601C133.755 99.9014 133.37 99.751 133.033 99.5203C132.696 99.2895 132.417 98.9846 132.216 98.629L116.782 71.5439C116.544 71.1312 116.419 70.663 116.419 70.1864C116.419 69.7099 116.544 69.2417 116.782 68.829C117.014 68.4157 117.351 68.0715 117.759 67.832C118.168 67.5924 118.633 67.4662 119.106 67.4663H148.04C148.423 67.4669 148.8 67.5492 149.148 67.7077C149.496 67.8662 149.806 68.0972 150.058 68.3853C150.305 68.6745 150.49 69.011 150.603 69.3743C150.716 69.7375 150.753 70.1199 150.713 70.4981C149.574 79.5545 145.893 88.1031 140.096 95.1536Z" fill="white"/>
          <path d="M160.187 67.4659C158.307 94.9314 136.947 117.833 109.049 120.443C78.0654 123.337 50.4943 100.129 47.6421 68.6808C45.0541 40.2857 26.7895 21.7888 0.00012207 20.5V40.2857C16.5745 41.5005 26.6099 52.1698 28.279 70.4977C31.9023 110.354 65.0827 140.387 103.851 140.387C106.168 140.387 108.51 140.278 110.876 140.059C148.905 136.51 177.828 104.988 179.73 67.4343L160.187 67.4659Z" fill="white"/>
        </svg>
        {/* Wordmark — hidden on very small screens to save header space */}
        <span className="hidden sm:block font-semibold text-base text-white leading-tight">
          Portfolio Pulse
        </span>
      </div>

      {/* Sub-nav — hidden on mobile; sidebar nav handles navigation there.
          Active route gets a white bottom border underline to show current location.
          In dark mode inactive links shift to slate-400 so they read well against
          the dark navy header background. */}
      <nav className="hidden md:flex items-center h-full pl-2">
        {NAV_ITEMS.map(({ label, to, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn(
              'px-5 h-full text-sm transition-colors whitespace-nowrap outline-none flex items-center border-b-2',
              isActive
                ? 'text-white border-white'
                : isDark
                  ? 'text-slate-400 hover:text-white border-transparent'
                  : 'text-blue-200 hover:text-white border-transparent',
            )}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Search hint button ─────────────────────────────────────────────────
          White background makes the input visually pop from the header.
          In dark mode we use a semi-transparent white so it reads against the
          dark navy, with text adjusted to match. Width is fixed so the button
          always looks like an input field rather than an icon-only trigger.   */}
      <button
        onClick={() => setSearchOpen(true)}
        className="hidden sm:flex items-center gap-2 mr-3 px-3 py-1.5 rounded-md w-56 transition-colors text-sm"
        style={{
          background: isDark ? 'rgba(255,255,255,0.08)' : 'white',
        }}
        title="Search (⌘K)"
        aria-label="Open search"
      >
        <Search size={14} className="shrink-0 text-slate-400" aria-hidden />
        <span className="text-xs flex-1 text-left text-slate-400">
          Search…
        </span>
        <kbd
          className="hidden md:inline-flex items-center px-1 py-0.5 rounded text-[10px] font-mono font-medium"
          style={{
            background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
            color:      isDark ? '#94a3b8' : '#64748b',
            border:     `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}`,
          }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Right side: action buttons + user/mode picker */}
      <div className="flex items-center gap-1">
        <button
          className="p-2 text-blue-200 hover:text-white transition-colors"
          title="Notifications"
        >
          <Bell size={18} />
        </button>
        {/* Settings link — styled to match the Admin mode picker button */}
        <Link
          to="/settings"
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-blue-100 hover:text-white transition-colors"
          title="Settings"
        >
          <Settings size={18} />
          <span className="hidden sm:block text-sm font-medium">Settings</span>
        </Link>

        {/* ── User / Admin mode picker ──────────────────────────────────────
            Clicking opens a dropdown listing all members plus an Admin option.
            Selecting a member switches to User mode — pages will filter to that
            person's projects and hide admin-only actions.
            Selecting Admin restores full access.                               */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-1.5 text-blue-100 hover:text-white transition-colors"
          >
            {activeMember ? (
              <>
                {/* Show the selected member's colored avatar */}
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    avatarColor(activeMember.name).bg,
                    avatarColor(activeMember.name).text,
                  )}
                >
                  {activeMember.avatarInitials.slice(0, 2)}
                </div>
                {/* First name — hidden on very small screens to keep the header compact */}
                <span className="hidden sm:block text-sm font-medium">{activeMember.name.split(' ')[0]}</span>
              </>
            ) : (
              <>
                <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
                  A
                </div>
                <span className="hidden sm:block text-sm font-medium">Admin</span>
              </>
            )}
            <ChevronDown size={14} className="text-blue-300" />
          </button>

          {/* Dropdown panel — appears below the trigger button */}
          {open && (
            <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-[100]">
              {/* Admin option — restores full-access mode */}
              <button
                onClick={() => { setActiveMember(null); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  !activeMemberId
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Shield size={13} className="text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Admin</div>
                  <div className="text-xs text-slate-500">Full access · all data</div>
                </div>
                {!activeMemberId && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                )}
              </button>

              <div className="border-t border-slate-100" />

              {/* Scrollable member list */}
              <div className="max-h-72 overflow-y-auto py-1">
                {sortedMembers.length === 0 ? (
                  <p className="text-xs text-slate-400 px-4 py-3 text-center">No members yet</p>
                ) : (
                  sortedMembers.map(m => {
                    const { bg, text } = avatarColor(m.name)
                    const isActive = m.id === activeMemberId
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setActiveMember(m.id); setOpen(false) }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-700 hover:bg-slate-50',
                        )}
                      >
                        <div
                          className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                            bg, text,
                          )}
                        >
                          {m.avatarInitials.slice(0, 2)}
                        </div>
                        <div className="text-left min-w-0">
                          <div className="font-medium truncate">{m.name}</div>
                          <div className="text-xs text-slate-500 truncate">{m.role}</div>
                        </div>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
