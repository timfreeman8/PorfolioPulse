/**
 * View mode store — controls whether the app is in Admin mode (full access)
 * or User mode (filtered to a specific member's data with read-only restrictions).
 *
 * Also owns the global command-palette open/close state (`searchOpen`).
 * Keeping it here avoids a separate store and lets any component (TopBar,
 * AppLayout, any page) open the palette without prop-drilling.
 *
 * Intentionally NOT persisted: refreshing the page always resets to Admin mode
 * so users don't accidentally get stuck in a restricted view.
 *
 * Any component that wants to know the current view mode imports this store
 * and reads `activeMemberId` (null = admin, otherwise a Member id).
 */
import { create } from 'zustand'

const THEME_KEY = 'sat-theme'

/** Toggle the `.dark` class on <html> and persist the preference. */
function applyDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
}

interface ViewState {
  /** null = Admin (full access). A Member id = User mode for that person. */
  activeMemberId: string | null
  setActiveMember: (id: string | null) => void

  /** Whether the global cmd+K command palette is currently open. */
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void

  /** Dark mode flag — shared here so all components re-render together. */
  isDark: boolean
  toggleDark: () => void
}

export const useViewStore = create<ViewState>((set, get) => {
  // Apply on store init so the class is set before first render.
  const initialDark = localStorage.getItem(THEME_KEY) === 'dark'
  applyDark(initialDark)

  return {
    activeMemberId: null,
    setActiveMember: (id) => set({ activeMemberId: id }),

    searchOpen: false,
    setSearchOpen: (open) => set({ searchOpen: open }),

    isDark: initialDark,
    toggleDark: () => {
      const next = !get().isDark
      applyDark(next)
      set({ isDark: next })
    },
  }
})
