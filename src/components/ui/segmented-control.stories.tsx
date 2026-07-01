/**
 * SegmentedControl stories — demonstrates the pill-style toggle used on the
 * Capacity Planner (Year/Quarter/Period zoom), Analytics (Charts/Financial tab),
 * and OrgPage (Cards/Compact mode).
 *
 * The component is generic over T extends string; stories use string literals.
 * All interactive stories use an `fn()` spy for onChange so the Actions panel
 * captures every selection.
 *
 * Dark mode: toggle the Storybook theme toolbar — the container should flip to
 * slate-800 and the active chip to slate-700.
 */
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { SegmentedControl } from './segmented-control'

const meta: Meta<typeof SegmentedControl> = {
  title: 'UI/SegmentedControl',
  component: SegmentedControl,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Pill-style tab / toggle bar. Renders inside a rounded slate-100 container; active segment gets a white chip with a subtle shadow.',
      },
    },
  },
  tags: ['autodocs'],
  args: { onChange: () => {} },
}
export default meta
type Story = StoryObj<typeof SegmentedControl>

// ── Interactive (controlled) ───────────────────────────────────────────────

/** Fully controlled — clicking a segment updates the selection. */
export const Interactive: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState<'year' | 'quarter' | 'period'>('year')
    return (
      <SegmentedControl
        options={[
          { value: 'year',    label: 'Year'   },
          { value: 'quarter', label: 'Quarter' },
          { value: 'period',  label: 'Period'  },
        ]}
        value={value}
        onChange={setValue}
      />
    )
  },
}

// ── Static variants ────────────────────────────────────────────────────────

/** Two-option toggle (Capacity Planner By Member / By Project). */
export const TwoOptions: Story = {
  args: {
    options: [
      { value: 'member',  label: 'By Member'  },
      { value: 'project', label: 'By Project' },
    ],
    value: 'member',
  },
}

/** Three-option zoom selector — Year active. */
export const ThreeOptionsYearActive: Story = {
  args: {
    options: [
      { value: 'year',    label: 'Year'   },
      { value: 'quarter', label: 'Quarter' },
      { value: 'period',  label: 'Period'  },
    ],
    value: 'year',
  },
}

/** Three-option zoom selector — Quarter active. */
export const ThreeOptionsQuarterActive: Story = {
  args: {
    options: [
      { value: 'year',    label: 'Year'   },
      { value: 'quarter', label: 'Quarter' },
      { value: 'period',  label: 'Period'  },
    ],
    value: 'quarter',
  },
}

/** Four-option selector — last item active. */
export const FourOptions: Story = {
  args: {
    options: [
      { value: 'q1', label: 'Q1' },
      { value: 'q2', label: 'Q2' },
      { value: 'q3', label: 'Q3' },
      { value: 'q4', label: 'Q4' },
    ],
    value: 'q4',
  },
}

/** Charts / Financial tab switcher (two options, Charts active). */
export const TabSwitcher: Story = {
  args: {
    options: [
      { value: 'charts',    label: 'Charts'    },
      { value: 'financial', label: 'Financial' },
    ],
    value: 'charts',
  },
}
