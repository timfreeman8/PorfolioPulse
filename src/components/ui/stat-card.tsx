/**
 * StatCard — icon + value + label summary card used across OrgPage,
 * RosterPage, and AnalyticsPage. Extracted from three identical inline
 * copies to a single shared component.
 *
 * The icon container gets a colored background via `iconColor` (e.g.
 * "bg-blue-100 text-blue-600"). `cardTint` is an optional extra class
 * applied to the outer card — used for amber/red warning states.
 */
import { cn } from '@/lib/utils'

export interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  /** Tailwind classes for the icon container background + text color */
  iconColor: string
  /** Optional soft tint applied to the card itself for warning states */
  cardTint?: string
}

export function StatCard({ label, value, icon, iconColor, cardTint }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-4',
      'dark:bg-slate-800 dark:border-slate-700',
      cardTint,
    )}>
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', iconColor)}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
      </div>
    </div>
  )
}
