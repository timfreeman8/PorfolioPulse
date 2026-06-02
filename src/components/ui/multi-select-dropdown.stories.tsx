/**
 * MultiSelectDropdown stories — demonstrates the search-enabled multiselect
 * trigger used for Domain / Team / Member filters across the app.
 *
 * Each story wraps the component in local state so the checkbox interactions
 * work correctly within Storybook (the component is controlled).
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { MultiSelectDropdown } from './multi-select-dropdown'

const meta: Meta<typeof MultiSelectDropdown> = {
  title: 'UI/MultiSelectDropdown',
  component: MultiSelectDropdown,
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj<typeof MultiSelectDropdown>

const DOMAINS = [
  { id: 'd1', label: 'Store Experience' },
  { id: 'd2', label: 'Inventory & Supply Chain' },
  { id: 'd3', label: 'Platform & Infrastructure' },
]

const TEAMS = [
  { id: 't1', label: 'POS & Checkout' },
  { id: 't2', label: 'Self-Checkout' },
  { id: 't3', label: 'Loyalty & Offers' },
  { id: 't4', label: 'Forecasting' },
  { id: 't5', label: 'Cloud & SRE' },
  { id: 't6', label: 'Security & Identity' },
]

/** Empty selection — shows the inactive (white-bordered) trigger. */
export const NoSelection: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [selected, setSelected] = useState<string[]>([])
    return (
      <MultiSelectDropdown
        label="Domain"
        options={DOMAINS}
        selected={selected}
        onChange={setSelected}
      />
    )
  },
}

/** Pre-selected items — shows the active (dark) trigger with a count. */
export const WithSelection: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [selected, setSelected] = useState<string[]>(['d1', 'd3'])
    return (
      <MultiSelectDropdown
        label="Domain"
        options={DOMAINS}
        selected={selected}
        onChange={setSelected}
      />
    )
  },
}

/** Longer list demonstrating search filtering and scroll. */
export const LongList: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [selected, setSelected] = useState<string[]>([])
    return (
      <MultiSelectDropdown
        label="Team"
        options={TEAMS}
        selected={selected}
        onChange={setSelected}
      />
    )
  },
}

/** All three dropdowns side-by-side — mirrors the filter bar on Planning/Roster pages. */
export const FilterBar: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [domains, setDomains] = useState<string[]>([])
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [teams, setTeams]     = useState<string[]>([])
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [members, setMembers] = useState<string[]>([])
    const anyActive = domains.length + teams.length + members.length > 0
    return (
      <div className="flex items-center gap-2">
        <MultiSelectDropdown label="Domain" options={DOMAINS} selected={domains} onChange={setDomains} />
        <MultiSelectDropdown label="Team"   options={TEAMS}   selected={teams}   onChange={setTeams}   />
        <MultiSelectDropdown
          label="Member"
          options={[
            { id: 'm1', label: 'Alice Johnson' },
            { id: 'm2', label: 'Bob Smith' },
            { id: 'm3', label: 'Carol White' },
          ]}
          selected={members}
          onChange={setMembers}
        />
        {anyActive && (
          <button
            onClick={() => { setDomains([]); setTeams([]); setMembers([]) }}
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
    )
  },
}
