/**
 * Tooltip stories — demonstrates the useTooltip hook that renders a cursor-
 * tracking tooltip via a React portal.
 *
 * Note: useTooltip is a hook, not a standalone component, so stories wrap it
 * in a small render helper. The tooltip appears after 150 ms on hover and
 * follows the mouse cursor throughout the hover.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useTooltip } from './tooltip'

const meta: Meta = {
  title: 'UI/Tooltip',
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj

/** Plain text tooltip — hover over the target to see it appear. */
export const PlainText: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { onMouseEnter, onMouseMove, onMouseLeave, tip } = useTooltip('This is a tooltip')
    return (
      <>
        <button
          onMouseEnter={onMouseEnter}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg"
        >
          Hover me
        </button>
        {tip}
      </>
    )
  },
}

/** Rich content tooltip — multi-line with a title + detail, matching Gantt bar tooltips. */
export const RichContent: Story = {
  render: () => {
    const content = (
      <div>
        <p className="font-semibold text-sm leading-tight">Loyalty Redesign</p>
        <p className="text-xs text-slate-300 mt-0.5">Alice Johnson · 80%</p>
        <p className="text-xs text-slate-400 mt-1">Apr 1 → Jun 28</p>
      </div>
    )
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { onMouseEnter, onMouseMove, onMouseLeave, tip } = useTooltip(content)
    return (
      <>
        <div
          onMouseEnter={onMouseEnter}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          className="w-40 h-6 bg-blue-500 rounded cursor-default flex items-center px-2"
        >
          <span className="text-white text-xs truncate">Loyalty Redesign</span>
        </div>
        {tip}
      </>
    )
  },
}

/** Short delay (0 ms) — tooltip appears immediately on hover. */
export const NoDelay: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { onMouseEnter, onMouseMove, onMouseLeave, tip } = useTooltip('Instant tooltip', 0)
    return (
      <>
        <button
          onMouseEnter={onMouseEnter}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg"
        >
          Hover me (no delay)
        </button>
        {tip}
      </>
    )
  },
}
