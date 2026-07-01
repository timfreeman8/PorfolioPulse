/**
 * CapacityBar stories — exercises every state of the allocation bar:
 *   normal (green), at-risk (amber ≥80% of ceiling), and over (red >100%).
 *
 * The `showLabel` prop variant is included so reviewers can see both the
 * compact form (used in chip mode on OrgPage) and the labelled form used
 * on member profile pages.
 *
 * Dark mode: toggle the Storybook toolbar theme to verify that the rail
 * flips from slate-100 to slate-700 and that text colors stay accessible.
 */
import type { Meta, StoryObj } from '@storybook/react'
import { CapacityBar } from './capacity-bar'

const meta: Meta<typeof CapacityBar> = {
  title: 'UI/CapacityBar',
  component: CapacityBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Shared allocation bar. Green when healthy, amber when ≥80% of ceiling, red when over ceiling.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    alloc: {
      control: { type: 'range', min: 0, max: 130, step: 5 },
      description: 'Allocated % for the current period (may exceed 100).',
    },
    cap: {
      control: { type: 'range', min: 0, max: 100, step: 5 },
      description: 'Capacity ceiling (member.capacity, 0–100).',
    },
    showLabel: { control: 'boolean' },
  },
}
export default meta
type Story = StoryObj<typeof CapacityBar>

// ── Interactive playground ─────────────────────────────────────────────────

export const Playground: Story = {
  args: { alloc: 60, cap: 80, showLabel: true },
}

// ── Named states ───────────────────────────────────────────────────────────

/** alloc / cap well below 80% of ceiling — green bar. */
export const Healthy: Story = {
  args: { alloc: 40, cap: 100, showLabel: true },
}

/** alloc / cap is above 80% but still within ceiling — amber bar. */
export const AtRisk: Story = {
  args: { alloc: 85, cap: 100, showLabel: true },
}

/** alloc exceeds cap — red bar, label shows the over-allocated %. */
export const OverCapacity: Story = {
  args: { alloc: 110, cap: 100, showLabel: true },
}

/** showLabel=false (compact chip form used in Org building mode). */
export const NoLabel: Story = {
  args: { alloc: 75, cap: 100, showLabel: false },
  parameters: { layout: 'centered' },
}

/** Zero allocation — bar renders as empty rail. */
export const Empty: Story = {
  args: { alloc: 0, cap: 80, showLabel: true },
}

/** Zero capacity ceiling edge case — renders using alloc directly, clamped at 100%. */
export const ZeroCap: Story = {
  args: { alloc: 50, cap: 0, showLabel: true },
}

// ── Comparison row ─────────────────────────────────────────────────────────

/** All three states side-by-side with labels for quick visual comparison. */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-64">
      <div>
        <p className="text-xs text-slate-500 mb-1">Healthy (40 / 100)</p>
        <CapacityBar alloc={40} cap={100} showLabel />
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1">At Risk (85 / 100)</p>
        <CapacityBar alloc={85} cap={100} showLabel />
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1">Over Capacity (110 / 100)</p>
        <CapacityBar alloc={110} cap={100} showLabel />
      </div>
    </div>
  ),
}
