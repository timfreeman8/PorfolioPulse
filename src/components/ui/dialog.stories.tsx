/**
 * Dialog stories — demonstrates the base-ui Dialog wrapper used for all
 * modals in the app (domain/team/member forms, project detail, etc.).
 *
 * Stories use DialogTrigger so the open/close animation is visible in
 * Storybook's canvas without requiring external state management.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from './dialog'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'

const meta: Meta = {
  title: 'UI/Dialog',
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj

/** Basic confirmation dialog — title + description + action buttons. */
export const Confirmation: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Open dialog</Button>} />
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The project will be permanently removed
            from the portfolio.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2">
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

/** Form dialog — mirrors the domain/team/member edit modals. */
export const FormDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button>Add Domain</Button>} />
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Add Domain</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Domain Name *</Label>
            <Input placeholder="e.g. Store Experience" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Owner</Label>
            <Input placeholder="Owner name" />
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline">Cancel</Button>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

/** Dialog without the default close button — used for full-screen flows. */
export const NoCloseButton: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost">Open (no X button)</Button>} />
      <DialogContent className="sm:max-w-md p-6" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Import from Jira</DialogTitle>
          <DialogDescription>
            Paste your Jira export JSON below to import projects.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2" showCloseButton>
          <Button>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
