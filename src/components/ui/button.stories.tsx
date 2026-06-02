import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'
import { Mail, Trash2, Plus } from 'lucide-react'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'default', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'],
    },
    disabled: { control: 'boolean' },
  },
}
export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {
  args: { children: 'Button' },
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Button variant="default">Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Button size="xs">Extra Small</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
}

export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Button><Mail /> Send Email</Button>
      <Button variant="outline"><Plus /> Add Item</Button>
      <Button variant="destructive"><Trash2 /> Delete</Button>
    </div>
  ),
}

export const IconOnly: Story = {
  render: () => (
    <div className="flex gap-3 items-center">
      <Button size="icon-xs" variant="ghost"><Trash2 /></Button>
      <Button size="icon-sm" variant="outline"><Mail /></Button>
      <Button size="icon"><Plus /></Button>
      <Button size="icon-lg"><Mail /></Button>
    </div>
  ),
}

export const Disabled: Story = {
  render: () => (
    <div className="flex gap-3 items-center">
      <Button disabled>Default</Button>
      <Button disabled variant="outline">Outline</Button>
      <Button disabled variant="destructive">Destructive</Button>
    </div>
  ),
}
