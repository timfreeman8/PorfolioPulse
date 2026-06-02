/**
 * View mode store — controls whether the app is in Admin mode (full access)
 * or User mode (filtered to a specific member's data with read-only restrictions).
 *
 * Intentionally NOT persisted: refreshing the page always resets to Admin mode
 * so users don't accidentally get stuck in a restricted view.
 *
 * Any component that wants to know the current view mode imports this store
 * and reads `activeMemberId` (null = admin, otherwise a Member id).
 */
import { create } from 'zustand'

interface ViewState {
  /** null = Admin (full access). A Member id = User mode for that person. */
  activeMemberId: string | null
  setActiveMember: (id: string | null) => void
}

export const useViewStore = create<ViewState>((set) => ({
  activeMemberId: null,
  setActiveMember: (id) => set({ activeMemberId: id }),
}))
