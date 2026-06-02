import type { Meta, StoryObj } from '@storybook/react-vite'
import { Progress, ProgressLabel, ProgressValue } from './progress'

const meta: Meta<typeof Progress> = {
  title: 'UI/Progress',
  component: Progress,
  parameters: { layout: 'centered' },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
  },
}
export default meta
type Story = StoryObj<typeof Progress>

export const Default: Story = {
  args: { value: 65 },
  render: (args) => <Progress {...args} className="w-72" />,
}

export const WithLabels: Story = {
  render: () => (
    <div className="grid gap-2 w-80">
      <Progress value={72}>
        <ProgressLabel>Initiative Progress</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  ),
}

export const States: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      {[
        { label: 'Store Modernization', value: 100 },
        { label: 'Inventory Overhaul', value: 75 },
        { label: 'API Platform', value: 40 },
        { label: 'Mobile Checkout', value: 10 },
        { label: 'Not started', value: 0 },
      ].map(({ label, value }) => (
        <div key={label}>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-medium text-slate-700">{label}</span>
            <span className="text-slate-400">{value}%</span>
          </div>
          <Progress value={value} />
        </div>
      ))}
    </div>
  ),
}

export const InitiativeProgress: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      {[
        { name: 'Store Experience 2026', quarter: 'Q2 FY26', complete: 3, total: 8 },
        { name: 'Platform Modernization', quarter: 'Q3 FY26', complete: 5, total: 6 },
        { name: 'Supply Chain AI', quarter: 'Q4 FY26', complete: 1, total: 5 },
      ].map(({ name, quarter, complete, total }) => {
        const pct = Math.round((complete / total) * 100)
        return (
          <div key={name}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{name}</span>
                <span className="text-xs text-slate-400 shrink-0">{quarter}</span>
              </div>
              <span className="text-xs text-slate-500 ml-3 shrink-0">{complete}/{total} complete</span>
            </div>
            <Progress value={pct} />
          </div>
        )
      })}
    </div>
  ),
}
