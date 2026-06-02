/**
 * Table stories — demonstrates the full Table component family used across the
 * app for project lists, member rosters, intake request queues, and analytics.
 *
 * The component family wraps native HTML table elements with consistent
 * Tailwind styling: striped-hover rows, bordered header, muted caption, and
 * a scrollable container so wide tables don't break layout on narrow viewports.
 *
 * Components: Table, TableHeader, TableBody, TableFooter, TableHead,
 *             TableRow, TableCell, TableCaption.
 */
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChevronUp } from 'lucide-react'
import { ColorBadge } from '@/components/ui/color-badge'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'

const meta: Meta<typeof Table> = {
  title: 'UI/Table',
  component: Table,
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj<typeof Table>

// ---------------------------------------------------------------------------
// Shared badge color maps — mirrors STATUS_COLORS / PHASE_COLORS / PRIORITY_COLORS
// from src/lib/colors.ts so the story is self-contained.
// ---------------------------------------------------------------------------

const STATUS_CLASS: Record<string, string> = {
  Backlog:      'bg-slate-100 text-slate-600',
  'In Progress':'bg-blue-100 text-blue-700',
  Blocked:      'bg-red-100 text-red-700',
  Complete:     'bg-green-100 text-green-700',
}

const PHASE_CLASS: Record<string, string> = {
  Research:    'bg-purple-100 text-purple-700',
  Development: 'bg-indigo-100 text-indigo-700',
  QA:          'bg-amber-100 text-amber-700',
  Deployed:    'bg-green-100 text-green-700',
}

const PRIORITY_CLASS: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700',
  High:     'bg-orange-100 text-orange-700',
  Medium:   'bg-yellow-100 text-yellow-700',
  Low:      'bg-slate-100 text-slate-600',
}

// ---------------------------------------------------------------------------
// Seed data for the realistic project table story.
// ---------------------------------------------------------------------------

const PROJECTS = [
  {
    name:      'Loyalty Redesign',
    status:    'In Progress',
    phase:     'Development',
    priority:  'High',
    progress:  62,
    dueDate:   '2025-09-30',
  },
  {
    name:      'POS Upgrade',
    status:    'Blocked',
    phase:     'QA',
    priority:  'Critical',
    progress:  45,
    dueDate:   '2025-08-15',
  },
  {
    name:      'Self-Checkout Refresh',
    status:    'Backlog',
    phase:     'Research',
    priority:  'Medium',
    progress:  10,
    dueDate:   '2025-12-01',
  },
  {
    name:      'Inventory Dashboard',
    status:    'In Progress',
    phase:     'Development',
    priority:  'High',
    progress:  78,
    dueDate:   '2025-10-31',
  },
  {
    name:      'Auth Platform v2',
    status:    'Complete',
    phase:     'Deployed',
    priority:  'Low',
    progress:  100,
    dueDate:   '2025-07-01',
  },
]

/**
 * ProjectTable — a realistic 5-row portfolio project table matching the layout
 * used on the Analytics and Member Detail pages. ColorBadge components
 * display status, phase, and priority with their standard color schemes.
 */
export const ProjectTable: Story = {
  render: () => (
    <div className="w-[780px] rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Phase</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Due Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PROJECTS.map((p) => (
            <TableRow key={p.name}>
              <TableCell className="font-medium text-slate-800">{p.name}</TableCell>
              <TableCell>
                <ColorBadge className={STATUS_CLASS[p.status]}>{p.status}</ColorBadge>
              </TableCell>
              <TableCell>
                <ColorBadge className={PHASE_CLASS[p.phase]}>{p.phase}</ColorBadge>
              </TableCell>
              <TableCell>
                <ColorBadge className={PRIORITY_CLASS[p.priority]}>{p.priority}</ColorBadge>
              </TableCell>
              <TableCell>
                {/* Progress bar — same pattern as Member Detail progress column */}
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{p.progress}%</span>
                </div>
              </TableCell>
              <TableCell className="text-slate-500">{p.dueDate}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
}

/** Minimal — a plain 3-column, 3-row table with no extra decoration. */
export const Minimal: Story = {
  render: () => (
    <div className="w-96 rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Team</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Priya Sharma</TableCell>
            <TableCell>Engineer</TableCell>
            <TableCell>Platform Core</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Marcus Lee</TableCell>
            <TableCell>Designer</TableCell>
            <TableCell>Store Experience</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Dana Kim</TableCell>
            <TableCell>PM</TableCell>
            <TableCell>Inventory</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  ),
}

/**
 * WithCaption — identical to Minimal but with a TableCaption beneath the body
 * providing context about the data source or last-updated timestamp.
 */
export const WithCaption: Story = {
  render: () => (
    <div className="w-96 rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Team</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Priya Sharma</TableCell>
            <TableCell>Engineer</TableCell>
            <TableCell>Platform Core</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Marcus Lee</TableCell>
            <TableCell>Designer</TableCell>
            <TableCell>Store Experience</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Dana Kim</TableCell>
            <TableCell>PM</TableCell>
            <TableCell>Inventory</TableCell>
          </TableRow>
        </TableBody>
        <TableCaption>Showing 3 of 28 members · Last updated June 2, 2026</TableCaption>
      </Table>
    </div>
  ),
}

/**
 * Sortable — demonstrates a table header with a sort indicator icon on the
 * active sort column. This is a purely visual story; clicking does nothing.
 * The ChevronUp icon signals the current ascending sort direction.
 */
export const Sortable: Story = {
  render: () => (
    <div className="w-[500px] rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {/* Active sort column — icon indicates ascending order */}
            <TableHead>
              <button className="flex items-center gap-1 text-slate-700 font-semibold">
                Project <ChevronUp className="h-3 w-3" />
              </button>
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Due Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">Auth Platform v2</TableCell>
            <TableCell>
              <ColorBadge className={STATUS_CLASS['Complete']}>Complete</ColorBadge>
            </TableCell>
            <TableCell>
              <ColorBadge className={PRIORITY_CLASS['Low']}>Low</ColorBadge>
            </TableCell>
            <TableCell className="text-slate-500">2025-07-01</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Inventory Dashboard</TableCell>
            <TableCell>
              <ColorBadge className={STATUS_CLASS['In Progress']}>In Progress</ColorBadge>
            </TableCell>
            <TableCell>
              <ColorBadge className={PRIORITY_CLASS['High']}>High</ColorBadge>
            </TableCell>
            <TableCell className="text-slate-500">2025-10-31</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Loyalty Redesign</TableCell>
            <TableCell>
              <ColorBadge className={STATUS_CLASS['In Progress']}>In Progress</ColorBadge>
            </TableCell>
            <TableCell>
              <ColorBadge className={PRIORITY_CLASS['High']}>High</ColorBadge>
            </TableCell>
            <TableCell className="text-slate-500">2025-09-30</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">POS Upgrade</TableCell>
            <TableCell>
              <ColorBadge className={STATUS_CLASS['Blocked']}>Blocked</ColorBadge>
            </TableCell>
            <TableCell>
              <ColorBadge className={PRIORITY_CLASS['Critical']}>Critical</ColorBadge>
            </TableCell>
            <TableCell className="text-slate-500">2025-08-15</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  ),
}
