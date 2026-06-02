/**
 * Input stories — demonstrates the base-ui Input primitive wrapper used
 * throughout the app for text entry fields, search bars, and form controls.
 *
 * The component applies a consistent border, focus ring, and height so all
 * text inputs look uniform regardless of where they appear (modals, filters,
 * inline forms). It forwards all native <input> props so standard HTML
 * attributes like disabled, readOnly, type, and placeholder work as expected.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Search } from 'lucide-react'
import { Input } from './input'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj<typeof Input>

/** Default empty input with a placeholder. */
export const Default: Story = {
  render: () => <Input placeholder="Type something..." className="w-72" />,
}

/** Input pre-filled with a value in readOnly mode. */
export const WithValue: Story = {
  render: () => <Input value="Hello world" readOnly className="w-72" />,
}

/** Disabled state — muted appearance, not interactive. */
export const Disabled: Story = {
  render: () => <Input disabled value="Disabled input" className="w-72" />,
}

/** Smaller height variant used in dense filter toolbars. */
export const Small: Story = {
  render: () => (
    <Input className="h-9 text-sm w-64" placeholder="Small input" />
  ),
}

/**
 * WithSearch — a realistic project search bar with a Search icon inset at
 * the left edge via absolute positioning. The input uses pl-8 so the text
 * doesn't overlap the icon. This pattern is used on the Analytics and
 * Portfolio pages.
 */
export const WithSearch: Story = {
  render: () => (
    <div className="relative w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      <Input className="pl-8" placeholder="Search projects…" />
    </div>
  ),
}
