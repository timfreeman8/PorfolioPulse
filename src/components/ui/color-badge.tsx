import { cn } from '@/lib/utils'

/**
 * A lightweight colored badge for status, phase, and priority labels.
 * Uses Tailwind bg/text classes from colors.ts — not the shadcn Badge variants.
 */
export function ColorBadge({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
    >
      {children}
    </span>
  )
}
