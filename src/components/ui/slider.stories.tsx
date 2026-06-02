import type { Meta, StoryObj } from '@storybook/react-vite'
import { Slider } from './slider'
import { Label } from './label'
import { useState } from 'react'

const meta: Meta<typeof Slider> = {
  title: 'UI/Slider',
  component: Slider,
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj<typeof Slider>

export const Default: Story = {
  render: () => <Slider defaultValue={[50]} className="w-72" />,
}

export const WithLabel: Story = {
  render: () => {
    const [value, setValue] = useState([75])
    return (
      <div className="grid gap-3 w-72">
        <div className="flex items-center justify-between">
          <Label>Capacity</Label>
          <span className="text-sm font-medium tabular-nums">{value[0]}%</span>
        </div>
        <Slider
          value={value}
          onValueChange={v => setValue(Array.isArray(v) ? [...v] : [v])}
          min={0}
          max={100}
          step={5}
        />
      </div>
    )
  },
}

export const AllocationSlider: Story = {
  render: () => {
    const [allocation, setAllocation] = useState([50])
    const color = allocation[0] > 80 ? 'text-red-600' : allocation[0] > 60 ? 'text-amber-600' : 'text-slate-700'
    return (
      <div className="grid gap-3 w-80">
        <div className="flex items-center justify-between">
          <Label>Project Allocation</Label>
          <span className={`text-sm font-semibold tabular-nums ${color}`}>{allocation[0]}%</span>
        </div>
        <Slider
          value={allocation}
          onValueChange={v => setAllocation(Array.isArray(v) ? [...v] : [v])}
          min={0}
          max={100}
          step={5}
        />
        <p className="text-xs text-muted-foreground">Percentage of this member's time allocated to the project</p>
      </div>
    )
  },
}

export const Disabled: Story = {
  render: () => (
    <div className="grid gap-2 w-72">
      <Label>Allocation (read-only)</Label>
      <Slider defaultValue={[60]} disabled />
    </div>
  ),
}
