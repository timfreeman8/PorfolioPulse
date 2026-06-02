import type { Meta, StoryObj } from '@storybook/react-vite'
import { Textarea } from './textarea'
import { Label } from './label'

const meta: Meta<typeof Textarea> = {
  title: 'UI/Textarea',
  component: Textarea,
  parameters: { layout: 'centered' },
  argTypes: {
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
    rows: { control: 'number' },
  },
}
export default meta
type Story = StoryObj<typeof Textarea>

export const Default: Story = {
  args: { placeholder: 'Enter description...' },
  render: (args) => <Textarea {...args} className="w-80" />,
}

export const WithLabel: Story = {
  render: () => (
    <div className="grid gap-2 w-80">
      <Label htmlFor="notes">Project Notes</Label>
      <Textarea id="notes" placeholder="Add any relevant context or blockers..." rows={4} />
    </div>
  ),
}

export const WithContent: Story = {
  render: () => (
    <div className="grid gap-2 w-80">
      <Label>Blocker Description</Label>
      <Textarea
        rows={3}
        defaultValue="Waiting on security review from the Platform team before we can proceed with the API integration. Escalated to Jennifer last Thursday."
      />
    </div>
  ),
}

export const Disabled: Story = {
  render: () => (
    <div className="grid gap-2 w-80">
      <Label>Resolution Note</Label>
      <Textarea
        disabled
        rows={3}
        value="Security review completed on 2025-11-14. Approved for production deployment."
      />
    </div>
  ),
}
