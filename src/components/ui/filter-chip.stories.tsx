/**
 * FilterChip stories — demonstrates the toggleable pill button used to filter
 * project lists by status, phase, or allocation bucket.
 *
 * Active chips use a filled dark background; inactive chips use a white/border
 * style with a hover state. An optional count badge renders to the right of the
 * label to show how many items match that filter category.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { FilterChip } from './filter-chip'

const meta: Meta<typeof FilterChip> = {
  title: 'UI/FilterChip',
  component: FilterChip,
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj<typeof FilterChip>

/** Inactive chip — the default resting state with no count. */
export const Default: Story = {
  args: { label: 'Backlog', active: false, onClick: () => {} },
}

/** Active chip — filled dark background indicating the selected filter. */
export const Active: Story = {
  args: { label: 'In Progress', active: true, onClick: () => {} },
}

/** Inactive chip with a count badge showing how many items match. */
export const WithCount: Story = {
  args: { label: 'Backlog', active: false, onClick: () => {}, count: 12 },
}

/** Active chip with a count badge — the count renders at reduced opacity. */
export const ActiveWithCount: Story = {
  args: { label: 'In Progress', active: true, onClick: () => {}, count: 5 },
}

/**
 * FilterBar — a realistic status filter row as seen on the Analytics and
 * Portfolio pages. Uses useState to track the selected chip so the active
 * style toggles correctly between clicks.
 */
export const FilterBar: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [active, setActive] = useState<string>('All')
    const filters = [
      { key: 'All',         count: 24 },
      { key: 'In Progress', count: 9  },
      { key: 'Blocked',     count: 3  },
      { key: 'Backlog',     count: 8  },
      { key: 'Complete',    count: 4  },
    ]
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {filters.map(({ key, count }) => (
          <FilterChip
            key={key}
            label={key}
            active={active === key}
            onClick={() => setActive(key)}
            count={count}
          />
        ))}
      </div>
    )
  },
}
