/**
 * useTheme — manages the global dark/light mode setting.
 *
 * Persists the preference in localStorage under "sat-theme" and toggles
 * the `dark` class on <html> so Tailwind's dark-mode overrides activate.
 *
 * Usage:
 *   const { isDark, toggle } = useTheme()
 *
 * The initial state is derived from localStorage on first call. Components
 * that call useTheme() re-render when the setting changes because the hook
 * uses React state internally.
 *
 * Note: this is a simple module-level singleton rather than a React context.
 * The class toggle on <html> is global so multiple callers stay in sync via
 * the same localStorage key — no provider wrapper required.
 */
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'sat-theme'

function readPreference(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'dark'
}

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = readPreference()
    // Apply immediately (before first render) to avoid flash.
    applyTheme(stored)
    return stored
  })

  // Keep <html> in sync if isDark changes after first render.
  useEffect(() => { applyTheme(isDark) }, [isDark])

  function toggle() {
    setIsDark(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
      applyTheme(next)
      return next
    })
  }

  return { isDark, toggle }
}
