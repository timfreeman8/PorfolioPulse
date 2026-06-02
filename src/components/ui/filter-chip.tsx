/**
 * FilterChip — a small toggle button used to filter lists.
 *
 * Consistent across all pages: Roster, Projects, Initiatives, Pipeline.
 * Active state uses a dark slate fill; inactive uses a white bordered style.
 * An optional `count` badge appears after the label when provided.
 */
import { cn } from '@/lib/utils'

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
  count?: number
  className?: string
}

export function FilterChip({ label, active, onClick, count, className }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-9 px-3 rounded-md text-xs font-medium transition-all flex items-center',
        active
          ? 'bg-slate-900 text-white border border-slate-900'
          : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400',
        className,
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn('ml-1.5 text-[10px]', active ? 'opacity-70' : 'text-slate-400')}>
          {count}
        </span>
      )}
    </button>
  )
}
