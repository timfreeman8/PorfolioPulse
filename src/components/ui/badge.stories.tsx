import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './badge'

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'ghost'],
    },
  },
}
export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = {
  args: { children: 'Badge' },
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
    </div>
  ),
}

export const ProjectStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 items-center">
      <Badge className="bg-emerald-100 text-emerald-700">In Progress</Badge>
      <Badge className="bg-slate-100 text-slate-600">Backlog</Badge>
      <Badge className="bg-red-100 text-red-700">Blocked</Badge>
      <Badge className="bg-blue-100 text-blue-700">Complete</Badge>
    </div>
  ),
}

export const ProjectPhases: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 items-center">
      <Badge className="bg-violet-100 text-violet-700">Research</Badge>
      <Badge className="bg-blue-100 text-blue-700">Discovery</Badge>
      <Badge className="bg-amber-100 text-amber-700">Development</Badge>
      <Badge className="bg-cyan-100 text-cyan-700">QA</Badge>
      <Badge className="bg-green-100 text-green-700">Deployed</Badge>
      <Badge className="bg-slate-100 text-slate-500">On Hold</Badge>
    </div>
  ),
}
