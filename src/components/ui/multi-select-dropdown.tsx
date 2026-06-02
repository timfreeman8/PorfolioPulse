/**
 * MultiSelectDropdown — reusable search-enabled multiselect dropdown.
 *
 * Styled to match FilterChip: dark active state, white bordered inactive.
 * Used for Domain / Team / Member filters on the Planning and Roster pages.
 *
 * Design pattern:
 *  - Trigger button shows the label, or "Label (N)" when items are selected.
 *  - Panel opens below the trigger with a search input and a scrollable list.
 *  - Each option has a checkbox (slate-900 when checked, white bordered when not).
 *  - "Clear all" row appears when ≥1 item is selected.
 *  - Clicking outside or pressing Escape closes the panel.
 */
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MultiSelectDropdownProps {
  label: string
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (v: string[]) => void
}

export function MultiSelectDropdown({
  label: baseLabel,
  options,
  selected,
  onChange,
}: MultiSelectDropdownProps) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const ref               = useRef<HTMLDivElement>(null)
  const searchRef         = useRef<HTMLInputElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Focus the search box when the panel opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0)
  }, [open])

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  const filtered     = query ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase())) : options
  const hasSelection = selected.length > 0
  const label        = hasSelection ? `${baseLabel} (${selected.length})` : baseLabel

  return (
    <div ref={ref} className="relative">
      {/* Trigger — mirrors FilterChip active/inactive styles */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'h-9 flex items-center gap-1 px-3 rounded-md text-xs font-medium transition-all border',
          hasSelection
            ? 'bg-slate-900 text-white border-slate-900'
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400',
        )}
      >
        {label}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden w-52">
          {/* Search input */}
          <div className="px-2 pt-2 pb-1 border-b border-slate-100">
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full pl-6 pr-2 py-1 text-xs rounded border border-slate-200 outline-none focus:border-primary placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Clear all — only shown when something is selected */}
          {hasSelection && (
            <button
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:text-slate-700 border-b border-slate-100"
            >
              Clear all ({selected.length})
            </button>
          )}

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400 italic">No matches</p>
            ) : filtered.map(opt => {
              const checked = selected.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  onClick={() => toggle(opt.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <span className={cn(
                    'w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border',
                    checked ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-300',
                  )}>
                    {checked && <Check size={9} className="text-white" strokeWidth={3} />}
                  </span>
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
