/**
 * Auth store — tracks the currently signed-in user and their role.
 *
 * Intentionally NOT persisted to localStorage. The browser session is the
 * lifetime of authentication: refreshing the page returns the user to the
 * login screen. This mirrors the session-token model that Azure AD (MSAL)
 * will enforce once real authentication is added.
 *
 * Role mapping:
 *   'admin'  — full CRUD access, all data visible
 *   'viewer' — read-only, data filtered to the user's own projects
 *
 * When Azure AD is added, replace the login() call site (LoginPage) with an
 * MSAL redirect flow. The `userId` will be mapped from the AAD user's object
 * ID or email to a Member ID in the roster. The `role` will be derived from
 * AAD group membership (e.g., "SAT-Admins" → 'admin', everyone else → 'viewer').
 *
 * Integration with useViewStore:
 *   login() syncs activeMemberId so all existing role-gating and data-filtering
 *   logic in the pages continues to work without change:
 *     admin  → activeMemberId = null   → isAdmin = true, all data visible
 *     viewer → activeMemberId = userId → isAdmin = false, filtered to user
 */
import { create } from 'zustand'
import { useViewStore } from './useViewStore'

export type UserRole = 'admin' | 'viewer'

interface AuthState {
  /** Member ID of the signed-in user. Always a real member ID, even for admins. */
  userId: string | null
  /** Role of the signed-in user. null = not authenticated → redirect to /login. */
  role: UserRole | null

  /**
   * Sign in a user with a determined role.
   * Syncs the view store so all existing role-gated pages work without change.
   */
  login: (userId: string, role: UserRole) => void

  /**
   * Sign out. The caller is responsible for navigating to /login.
   * Resets the view store's activeMemberId so no stale member filter lingers.
   */
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  role:   null,

  login(userId, role) {
    // Admin → activeMemberId = null so isAdmin checks in pages evaluate true.
    // Viewer → activeMemberId = userId so data filters apply automatically.
    useViewStore.getState().setActiveMember(role === 'admin' ? null : userId)
    set({ userId, role })
  },

  logout() {
    // Clear the member filter so no stale data leaks into the next session.
    useViewStore.getState().setActiveMember(null)
    set({ userId: null, role: null })
  },
}))
