import type { Meta, StoryObj } from '@storybook/react-vite'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator } from './select'
import { Label } from './label'

const meta: Meta = {
  title: 'UI/Select',
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="backlog">Backlog</SelectItem>
        <SelectItem value="in-progress">In Progress</SelectItem>
        <SelectItem value="blocked">Blocked</SelectItem>
        <SelectItem value="complete">Complete</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const WithLabel: Story = {
  render: () => (
    <div className="grid gap-2 w-56">
      <Label>Project Phase</Label>
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select phase" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="research">Research</SelectItem>
          <SelectItem value="discovery">Discovery</SelectItem>
          <SelectItem value="development">Development</SelectItem>
          <SelectItem value="qa">QA</SelectItem>
          <SelectItem value="deployed">Deployed</SelectItem>
          <SelectItem value="on-hold">On Hold</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
}

export const WithGroups: Story = {
  render: () => (
    <div className="grid gap-2 w-64">
      <Label>Assign to Team</Label>
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select a team" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Store Experience</SelectLabel>
            <SelectItem value="se-checkout">Checkout Experience</SelectItem>
            <SelectItem value="se-loyalty">Loyalty & Rewards</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Inventory & Supply Chain</SelectLabel>
            <SelectItem value="inv-warehouse">Warehouse Systems</SelectItem>
            <SelectItem value="inv-demand">Demand Planning</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Platform & Infrastructure</SelectLabel>
            <SelectItem value="plat-cloud">Cloud Operations</SelectItem>
            <SelectItem value="plat-security">Security</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
}

export const SmallSize: Story = {
  render: () => (
    <div className="flex gap-3 items-end">
      <div className="grid gap-1.5">
        <Label className="text-xs">Priority</Label>
        <Select>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  ),
}
