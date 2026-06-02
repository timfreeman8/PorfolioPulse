/**
 * ScrollArea stories — demonstrates the base-ui ScrollArea wrapper used for
 * scrollable content regions in the app (member project tables, long lists, etc.).
 *
 * The component renders a custom scrollbar overlay instead of the native one,
 * keeping the design consistent across platforms.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ScrollArea } from './scroll-area'

const meta: Meta<typeof ScrollArea> = {
  title: 'UI/ScrollArea',
  component: ScrollArea,
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj<typeof ScrollArea>

const ITEMS = Array.from({ length: 20 }, (_, i) => `Item ${i + 1} — some descriptive text here`)

/** Vertical scroll — fixed-height container with overflow content. */
export const Vertical: Story = {
  render: () => (
    <ScrollArea className="h-64 w-72 rounded-lg border border-slate-200">
      <div className="p-4 space-y-2">
        {ITEMS.map((item, i) => (
          <div key={i} className="text-sm text-slate-700 py-1 border-b border-slate-100 last:border-0">
            {item}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
}

/** Horizontal scroll — wide content in a narrow container. */
export const Horizontal: Story = {
  render: () => (
    <ScrollArea className="w-80 rounded-lg border border-slate-200">
      <div className="flex gap-3 p-4" style={{ width: 900 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="shrink-0 w-28 h-24 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-medium"
          >
            Column {i + 1}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
}

/** Realistic usage — member project list matching MemberDetailPage layout. */
export const ProjectList: Story = {
  render: () => {
    const projects = [
      { name: 'Loyalty Redesign',      phase: 'Development', status: 'In Progress' },
      { name: 'POS Upgrade',           phase: 'QA',          status: 'Blocked' },
      { name: 'Self-Checkout Refresh', phase: 'Research',    status: 'Backlog' },
      { name: 'Inventory Dashboard',   phase: 'Discovery',   status: 'In Progress' },
      { name: 'Auth Platform',         phase: 'Deployed',    status: 'Complete' },
      { name: 'Data Pipeline v2',      phase: 'Development', status: 'In Progress' },
      { name: 'Mobile Checkout',       phase: 'Research',    status: 'Backlog' },
    ]
    return (
      <ScrollArea className="max-h-64 w-96 rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Project</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Phase</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-2 text-slate-500">{p.phase}</td>
                <td className="px-4 py-2 text-slate-500">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    )
  },
}
