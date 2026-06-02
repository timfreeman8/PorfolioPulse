/**
 * ColorBadge stories — demonstrates the lightweight colored pill badge used
 * for phase, status, priority, and capacity labels across the app.
 *
 * Colors come from the Tailwind bg-[color]/text-[color] utility classes defined in
 * src/lib/colors.ts (PHASE_COLORS, STATUS_COLORS, PRIORITY_COLORS).
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ColorBadge } from './color-badge'

const meta: Meta<typeof ColorBadge> = {
  title: 'UI/ColorBadge',
  component: ColorBadge,
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj<typeof ColorBadge>

/** Single badge with a custom color. */
export const Default: Story = {
  args: {
    className: 'bg-blue-100 text-blue-700',
    children: 'Development',
  },
}

/** All project phases — mirroring PHASE_COLORS from colors.ts. */
export const Phases: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ColorBadge className="bg-violet-100 text-violet-700">Research</ColorBadge>
      <ColorBadge className="bg-sky-100 text-sky-700">Discovery</ColorBadge>
      <ColorBadge className="bg-blue-100 text-blue-700">Development</ColorBadge>
      <ColorBadge className="bg-amber-100 text-amber-700">QA</ColorBadge>
      <ColorBadge className="bg-green-100 text-green-700">Deployed</ColorBadge>
      <ColorBadge className="bg-slate-100 text-slate-600">On Hold</ColorBadge>
    </div>
  ),
}

/** All project statuses — mirroring STATUS_COLORS from colors.ts. */
export const Statuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ColorBadge className="bg-slate-100 text-slate-600">Backlog</ColorBadge>
      <ColorBadge className="bg-blue-100 text-blue-700">In Progress</ColorBadge>
      <ColorBadge className="bg-red-100 text-red-700">Blocked</ColorBadge>
      <ColorBadge className="bg-green-100 text-green-700">Complete</ColorBadge>
    </div>
  ),
}

/** All priority levels — mirroring PRIORITY_COLORS from colors.ts. */
export const Priorities: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ColorBadge className="bg-slate-100 text-slate-600">Low</ColorBadge>
      <ColorBadge className="bg-blue-100 text-blue-700">Medium</ColorBadge>
      <ColorBadge className="bg-orange-100 text-orange-700">High</ColorBadge>
      <ColorBadge className="bg-red-100 text-red-700">Critical</ColorBadge>
    </div>
  ),
}

/** Capacity / allocation badges used in the Roster and Planning pages. */
export const Allocation: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ColorBadge className="bg-green-50 text-green-700">60% — healthy</ColorBadge>
      <ColorBadge className="bg-amber-50 text-amber-700">85% — at risk</ColorBadge>
      <ColorBadge className="bg-red-50 text-red-700">120% — over capacity</ColorBadge>
    </div>
  ),
}

/** Utility counts used on team/domain headers. */
export const Counts: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ColorBadge className="bg-violet-50 text-violet-700">3 teams</ColorBadge>
      <ColorBadge className="bg-slate-100 text-slate-600">5 members</ColorBadge>
      <ColorBadge className="bg-blue-50 text-blue-600">2 projects</ColorBadge>
    </div>
  ),
}
