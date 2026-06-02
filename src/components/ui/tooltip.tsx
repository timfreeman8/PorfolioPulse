/**
 * useTooltip — lightweight custom tooltip hook.
 *
 * Accepts ReactNode so callers can pass structured content (e.g. a large title
 * line and smaller detail lines) instead of a flat string.
 *
 * Renders via a React portal to document.body so it is never clipped by
 * parent overflow:hidden containers (common in Gantt chart rows).
 *
 * The tooltip follows the mouse cursor position (updated on mousemove) and
 * appears after `delay` ms (default 150). It offsets 12px above the cursor
 * and nudges horizontally so it doesn't go off screen edges.
 */
import type { ReactNode } from 'react'
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

export function useTooltip(content: ReactNode, delay = 150) {
  // pos tracks the current mouse coordinates (or null when hidden)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Show the tooltip at the current mouse position after the delay
  function onMouseEnter(e: React.MouseEvent) {
    const { clientX, clientY } = e
    clearTimeout(timer.current)
    timer.current = setTimeout(
      () => setPos({ x: clientX, y: clientY }),
      delay,
    )
  }

  // Keep the tooltip anchored to the moving cursor so it always stays nearby
  function onMouseMove(e: React.MouseEvent) {
    if (pos) setPos({ x: e.clientX, y: e.clientY })
  }

  function onMouseLeave() {
    clearTimeout(timer.current)
    setPos(null)
  }

  const tip = pos
    ? createPortal(
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            // 16px above cursor so the tooltip doesn't sit on top of the pointer
            top: pos.y - 16,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
          className="px-3 py-2 rounded-lg bg-slate-800 text-white shadow-xl max-w-64"
        >
          {content}
        </div>,
        document.body,
      )
    : null

  return { onMouseEnter, onMouseMove, onMouseLeave, tip }
}
