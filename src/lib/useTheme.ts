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
  // Two separate selectors instead of one returning a new object — React 18's
  // useSyncExternalStore requires the snapshot to be a stable (===) reference.
  // Returning `{ isDark, toggle }` from a single selector creates a new object
  // every call, which React 18 treats as a constant change → infinite loop.
  // Selecting primitives/stable-function-refs separately avoids that.
  const isDark  = useViewStore(s => s.isDark)
  const toggle  = useViewStore(s => s.toggleDark)
  return { isDark, toggle }
}
