/**
 * StakeholderTagInput stories — demonstrates the select-or-create tag field
 * used in the project form for stakeholder names.
 *
 * The component reads existing stakeholder names from the Zustand store so the
 * dropdown pool is populated from real project data. In Storybook the store
 * is fully functional (same zustand instance), so any seed data loaded in the
 * browser will populate the suggestions automatically.
 *
 * When running in a fresh Storybook session (no localStorage), the store will
 * be empty and the "Create …" path is exercised — which is also useful to test.
 *
 * Dark mode: toggle the Storybook theme toolbar — the tag chips, dropdown, and
 * input border should all flip to dark slate variants.
 */
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { StakeholderTagInput } from './stakeholder-tag-input'

const meta: Meta<typeof StakeholderTagInput> = {
  title: 'UI/StakeholderTagInput',
  component: StakeholderTagInput,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Tag-style input for project stakeholder names. Pulls existing names from the portfolio store to offer suggestions; typing a new name shows a "Create …" option.',
      },
    },
  },
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof StakeholderTagInput>

// ── Empty (no stakeholders yet) ────────────────────────────────────────────

/** No tags — input is ready to receive the first stakeholder. */
export const Empty: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState('')
    return <StakeholderTagInput value={value} onChange={setValue} />
  },
}

// ── With pre-existing tags ─────────────────────────────────────────────────

/** Pre-loaded with three stakeholder names. */
export const WithTags: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState('Jane Doe, John Smith, Priya Patel')
    return <StakeholderTagInput value={value} onChange={setValue} />
  },
}

// ── Single tag ────────────────────────────────────────────────────────────

/** One stakeholder — shows the remove (×) affordance clearly. */
export const SingleTag: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState('Sarah Mitchell')
    return <StakeholderTagInput value={value} onChange={setValue} />
  },
}

// ── Many tags (wrapping) ──────────────────────────────────────────────────

/** Many tags — the input wraps to show the overflow behaviour. */
export const ManyTags: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState(
      'Alice Johnson, Bob Chen, Carol White, David Kim, Evelyn Torres, Frank Nguyen',
    )
    return (
      <div className="w-96">
        <StakeholderTagInput value={value} onChange={setValue} />
      </div>
    )
  },
}
