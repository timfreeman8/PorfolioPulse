/**
 * AppLayout — root shell that wraps every authenticated page.
 *
 * On desktop (≥ md) the sidebar sits permanently in the layout flow and the
 * TopBar has no hamburger; the sidebar manages its own collapsed/expanded state.
 *
 * On mobile (< md) the sidebar is an off-canvas overlay:
 *   - Hidden by default; `mobileOpen` lifts the open/close state up here so
 *     both TopBar (hamburger) and Sidebar (close button / backdrop tap) can
 *     coordinate without prop-drilling through a third layer.
 *   - TopBar receives `onMobileMenuToggle` to open it.
 *   - Sidebar receives `mobileOpen` + `onMobileClose` to close itself.
 *
 * <SearchModal /> is mounted here (outside the page tree) so it overlays any
 * page without being unmounted on route changes. Its open/close state lives in
 * useViewStore so TopBar can trigger it independently.
 */
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { SearchModal } from './SearchModal'

export function AppLayout() {
  // Controls the mobile overlay sidebar. Desktop ignores this state entirely.
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      <TopBar onMobileMenuToggle={() => setMobileOpen(o => !o)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        {/* overscroll-y-none prevents the page from rubberbanding / showing blank
            space when the user scrolls past the end of a page's content.        */}
        <main className="flex-1 overflow-y-auto overscroll-y-none">
          <Outlet />
        </main>
      </div>
      {/* Command palette — rendered at this level so it overlays all pages
          without being torn down on route changes. */}
      <SearchModal />

    </div>
  )
}
