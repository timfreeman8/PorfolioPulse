/**
 * DateRangePicker stories — demonstrates the fiscal calendar date range picker
 * used on the Analytics page.
 *
 * The component is portal-rendered into document.body during normal use, but
 * in Storybook it renders into the story canvas so the popover is visible
 * without needing a real scroll container.
 *
 * Stories are controlled via React state wrappers so the popover open/close
 * and value changes work correctly in the Storybook sandbox.
 *
 * Dark mode: toggle the Storybook theme toolbar — the popover background and
 * calendar cells should flip to dark slate.
 */
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { DateRangePicker } from './date-range-picker'

const meta: Meta<typeof DateRangePicker> = {
  title: 'UI/DateRangePicker',
  component: DateRangePicker,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Two-click fiscal-calendar date range picker. Left panel: quarterly/period hierarchy. Right panel: duration pills. Portal-rendered to escape overflow clipping.',
      },
    },
  },
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof DateRangePicker>

// ── No selection (initial state) ───────────────────────────────────────────

/** No dates selected — button shows placeholder text. */
export const Empty: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [from, setFrom] = useState('')
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [to, setTo]     = useState('')
    return (
      <DateRangePicker
        startDate={from} endDate={to}
        onChange={(s, e) => { setFrom(s); setTo(e) }}
      />
    )
  },
}

// ── With a pre-set date range ──────────────────────────────────────────────

/** Pre-loaded with Q1 FY2026 range (Feb 1 – May 3, 2026). */
export const WithRange: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [from, setFrom] = useState('2026-02-01')
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [to, setTo]     = useState('2026-05-02')
    return (
      <DateRangePicker
        startDate={from} endDate={to}
        onChange={(s, e) => { setFrom(s); setTo(e) }}
      />
    )
  },
}

// ── From-only (end date not yet chosen) ───────────────────────────────────

/** Only start date set — simulates mid-selection state. */
export const StartOnly: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [from, setFrom] = useState('2026-04-26')
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [to, setTo]     = useState('')
    return (
      <DateRangePicker
        startDate={from} endDate={to}
        onChange={(s, e) => { setFrom(s); setTo(e) }}
      />
    )
  },
}

// ── Clearable ──────────────────────────────────────────────────────────────

/** Full range shown — click the × to clear. */
export const Clearable: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [from, setFrom] = useState('2026-06-28')
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [to, setTo]     = useState('2026-10-31')
    return (
      <DateRangePicker
        startDate={from} endDate={to}
        onChange={(s, e) => { setFrom(s); setTo(e) }}
      />
    )
  },
}
