import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta = {
  title: 'UI/Typography',
  parameters: { layout: 'padded' },
}
export default meta
type Story = StoryObj

export const FontFamily: Story = {
  render: () => (
    <div className="space-y-8 max-w-xl">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-3">Geist Variable — font-sans / font-heading</p>
        <div className="space-y-2">
          {['Thin', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black'].map((weight, i) => {
            const weights = [100, 200, 300, 400, 500, 600, 700, 800, 900]
            return (
              <div key={weight} className="flex items-baseline gap-4">
                <span className="text-xs text-slate-400 w-20 shrink-0">{weight}</span>
                <span style={{ fontWeight: weights[i] }} className="text-2xl text-slate-900">
                  Store Technology
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  ),
}

export const TypeScale: Story = {
  render: () => (
    <div className="space-y-4 max-w-xl">
      {[
        { label: 'text-4xl', size: 'text-4xl', text: 'Portfolio Dashboard' },
        { label: 'text-3xl', size: 'text-3xl', text: 'Portfolio Dashboard' },
        { label: 'text-2xl', size: 'text-2xl', text: 'Portfolio Dashboard' },
        { label: 'text-xl',  size: 'text-xl',  text: 'Portfolio Dashboard' },
        { label: 'text-lg',  size: 'text-lg',  text: 'Store and Associate Technology' },
        { label: 'text-base',size: 'text-base',text: 'Store and Associate Technology' },
        { label: 'text-sm',  size: 'text-sm',  text: 'Active escalations requiring help — 3 open, 12 resolved' },
        { label: 'text-xs',  size: 'text-xs',  text: 'Active escalations requiring help — 3 open, 12 resolved' },
      ].map(({ label, size, text }) => (
        <div key={label} className="flex items-baseline gap-4">
          <span className="text-xs text-slate-400 w-20 shrink-0 font-mono">{label}</span>
          <span className={`${size} text-slate-900 leading-tight`}>{text}</span>
        </div>
      ))}
    </div>
  ),
}

export const Weights: Story = {
  render: () => (
    <div className="space-y-3 max-w-xl">
      {[
        { label: 'font-normal',    cls: 'font-normal',    text: 'The quick brown fox jumps over the lazy dog' },
        { label: 'font-medium',    cls: 'font-medium',    text: 'The quick brown fox jumps over the lazy dog' },
        { label: 'font-semibold',  cls: 'font-semibold',  text: 'The quick brown fox jumps over the lazy dog' },
        { label: 'font-bold',      cls: 'font-bold',      text: 'The quick brown fox jumps over the lazy dog' },
      ].map(({ label, cls, text }) => (
        <div key={label} className="flex items-baseline gap-4">
          <span className="text-xs text-slate-400 w-24 shrink-0 font-mono">{label}</span>
          <span className={`text-base text-slate-900 ${cls}`}>{text}</span>
        </div>
      ))}
    </div>
  ),
}

export const InContext: Story = {
  render: () => (
    <div className="max-w-lg space-y-1">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="text-slate-500 text-sm">Store Technology Portfolio Overview</p>
      <div className="pt-4 space-y-1">
        <h2 className="text-base font-semibold text-slate-800">Capacity Overview</h2>
        <p className="text-xs text-slate-400">Committed vs available · current quarter</p>
      </div>
      <div className="pt-2">
        <p className="text-sm text-slate-700">
          Track and manage all projects across domains, teams, and members.
          Use the <span className="font-medium text-slate-900">Portfolio</span> view to see the full hierarchy,
          or <span className="font-medium text-slate-900">Teams</span> to drill into capacity by team.
        </p>
      </div>
      <div className="pt-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Blocked on</span>
        <p className="text-sm text-slate-800 mt-0.5">Waiting on security review from Platform team.</p>
      </div>
    </div>
  ),
}
