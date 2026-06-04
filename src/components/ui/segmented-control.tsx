/**
 * SegmentedControl — pill-style tab/toggle used across multiple pages.
 *
 * Renders a row of buttons inside a rounded slate-100 container. The active
 * segment gets a white background with a subtle shadow; inactive segments
 * are muted text that darkens on hover. Dark mode flips the container to
 * slate-800 and the active chip to slate-700.
 *
 * Usage:
 *   <SegmentedControl
 *     options={[{ value: 'year', label: 'Year' }, { value: 'q1', label: 'Q1' }]}
 *     value={zoom}
 *     onChange={setZoom}
 *   />
 */
import { cn } from '@/lib/utils'

export interface SegmentOption<T extends string = string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn(
      'flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5',
      className,
    )}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
