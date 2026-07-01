/**
 * StatCard stories — demonstrates every prop variant of the icon + value + label
 * summary card used on OrgPage, RosterPage, and AnalyticsPage.
 *
 * `iconColor` accepts Tailwind classes for background + text (e.g. "bg-blue-100
 * text-blue-600").  `cardTint` is an optional extra class on the outer card for
 * warning states (amber/red).
 *
 * Dark mode: toggle the Storybook theme toolbar — the card should flip to
 * dark slate, the icon container keeps its hue, and value/label text stay
 * readable against the dark background.
 */
import type { Meta, StoryObj } from '@storybook/react'
import { Users, Zap, AlertTriangle, TrendingUp, CheckCircle2 } from 'lucide-react'
import { StatCard } from './stat-card'

const meta: Meta<typeof StatCard> = {
  title: 'UI/StatCard',
  component: StatCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Summary card with a coloured icon, a large numeric value, and a muted label. Used in the Org and Analytics stats bars.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    iconColor: { control: 'text', description: 'Tailwind bg + text classes for the icon container.' },
    cardTint:  { control: 'text', description: 'Optional extra class on the card for warning states.' },
  },
}
export default meta
type Story = StoryObj<typeof StatCard>

// ── Interactive playground ─────────────────────────────────────────────────

export const Playground: Story = {
  args: {
    label:     'Total Members',
    value:     136,
    icon:      <Users size={20} />,
    iconColor: 'bg-blue-100 text-blue-600',
  },
}

// ── Colour variants ────────────────────────────────────────────────────────

/** Blue — default for neutral counts (members, teams, domains). */
export const Blue: Story = {
  args: {
    label:     'Total Members',
    value:     136,
    icon:      <Users size={20} />,
    iconColor: 'bg-blue-100 text-blue-600',
  },
}

/** Green — progress / completion metric. */
export const Green: Story = {
  args: {
    label:     'Projects Complete',
    value:     12,
    icon:      <CheckCircle2 size={20} />,
    iconColor: 'bg-green-100 text-green-600',
  },
}

/** Amber — at-risk members / items approaching a threshold. */
export const AmberWarning: Story = {
  args: {
    label:     'At Risk (>80%)',
    value:     7,
    icon:      <Zap size={20} />,
    iconColor: 'bg-amber-100 text-amber-600',
    cardTint:  'bg-amber-50 dark:bg-amber-950/20',
  },
}

/** Red — over-capacity or blocked items. */
export const RedAlert: Story = {
  args: {
    label:     'Over Capacity',
    value:     3,
    icon:      <AlertTriangle size={20} />,
    iconColor: 'bg-red-100 text-red-600',
    cardTint:  'bg-red-50 dark:bg-red-950/20',
  },
}

/** Purple — initiative / strategic metric. */
export const Purple: Story = {
  args: {
    label:     'Initiatives Active',
    value:     5,
    icon:      <TrendingUp size={20} />,
    iconColor: 'bg-purple-100 text-purple-600',
  },
}

// ── Comparison grid ────────────────────────────────────────────────────────

/** All four tones side-by-side — mirrors the stats bar on OrgPage. */
export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-3 max-w-xl">
      <StatCard label="Total Members"  value={136} icon={<Users size={20} />}         iconColor="bg-blue-100 text-blue-600" />
      <StatCard label="Projects Active" value={24}  icon={<CheckCircle2 size={20} />}  iconColor="bg-green-100 text-green-600" />
      <StatCard label="At Risk (>80%)"  value={7}   icon={<Zap size={20} />}           iconColor="bg-amber-100 text-amber-600" cardTint="bg-amber-50 dark:bg-amber-950/20" />
      <StatCard label="Over Capacity"   value={3}   icon={<AlertTriangle size={20} />} iconColor="bg-red-100 text-red-600"    cardTint="bg-red-50 dark:bg-red-950/20" />
    </div>
  ),
}
