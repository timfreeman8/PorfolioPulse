/**
 * useTheme — thin wrapper around the Zustand view store's dark-mode state.
 *
 * Keeping the theme in the Zustand store means every component that calls
 * useTheme() is subscribed to the same reactive value, so toggling dark mode
 * in any one component (e.g. Sidebar) immediately re-renders all others
 * (e.g. TopBar) without any extra wiring.
 *
 * Usage:
 *   const { isDark, toggle } = useTheme()
 */
import { useViewStore } from '@/store/useViewStore'

export function useTheme() {
  return useViewStore(s => ({ isDark: s.isDark, toggle: s.toggleDark }))
}
