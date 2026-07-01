/**
 * CapacityBar — shared allocation bar used on OrgPage, TeamsPage, MemberDetailPage,
 * and any other view that shows a member's quarter allocation vs capacity ceiling.
 *
 * Encapsulates the isOver / isAtRisk thresholds and color logic that was previously
 * duplicated in OrgMemberCard, OrgMemberChip, and several page-level components.
 * Fixing the thresholds or tweaking colors now only requires changing this file.
 *
 * Props:
 *   alloc      — Allocated percentage for the current period (0–100+).
 *                Can exceed 100 when overallocated.
 *   cap        — Capacity ceiling (0–100, from member.capacity).
 *   showLabel  — When true, renders the alloc % next to the bar (default false).
 *   className  — Optional extra classes on the outer wrapper.
 */
import { cn } from '@/lib/utils'

interface CapacityBarProps {
  alloc: number
  cap: number
  showLabel?: boolean
  className?: string
}

export function CapacityBar({ alloc, cap, showLabel, className }: CapacityBarProps) {
  // Over capacity: alloc exceeds the ceiling entirely.
  // At risk: within capacity but above 80% of the ceiling.
  const isOver   = alloc > cap
  const isAtRisk = !isOver && cap > 0 && alloc / cap > 0.8

  // Bar fills to the full width when overallocated so the overflow is visually obvious.
  const barPct = cap > 0 ? Math.min((alloc / cap) * 100, 100) : Math.min(alloc, 100)

  const barColor  = isOver ? 'bg-red-500' : isAtRisk ? 'bg-amber-400' : 'bg-green-500'
  const textColor = isOver
    ? 'text-red-600 dark:text-red-400'
    : isAtRisk
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-green-600 dark:text-green-400'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${barPct}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn('text-[11px] font-bold tabular-nums shrink-0', textColor)}>
          {alloc}%
        </span>
      )}
    </div>
  )
}
