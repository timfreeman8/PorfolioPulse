/**
 * useClickOutside — fires a callback when the user clicks outside a referenced element.
 *
 * Replaces the 8+ identical `useRef + useEffect + addEventListener('mousedown')`
 * patterns that were scattered across components.  Centralising here means a
 * single fix propagates everywhere if the behaviour ever needs to change.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null)
 *   useClickOutside(ref, () => setOpen(false), open)
 *
 * The `enabled` flag (defaults to true) lets callers avoid attaching the
 * document-level listener when the panel is closed — no point paying the cost
 * of a global event listener when nothing is visible.
 */
import { useEffect, type RefObject } from 'react'

/**
 * @param ref      Ref to the container element — clicks inside are ignored.
 * @param onClose  Called when a mousedown fires outside `ref.current`.
 * @param enabled  When false the listener is not attached.  Pass `open` state
 *                 here so the listener is only active while the panel is open.
 */
export function useClickOutside(
  ref: RefObject<Element | null>,
  onClose: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [ref, onClose, enabled])
}
