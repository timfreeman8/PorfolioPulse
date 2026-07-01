/**
 * StakeholderTagInput — select-or-create tag field for project stakeholders.
 *
 * Pulls all existing stakeholder names from every project in the store so the
 * dropdown shows a unified, deduplicated pool. Typing filters that pool;
 * if the typed text doesn't match any existing name a "Create …" option
 * appears at the bottom. This prevents the same person appearing under
 * slightly different spellings across different projects.
 *
 * Value format: comma-separated string ("Alice, Bob, Carol"), matching the
 * Project.stakeholders field in the data model.
 */

import { useMemo, useRef, useState } from 'react'
import { useClickOutside } from '@/lib/useClickOutside'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePortfolioStore } from '@/store/usePortfolioStore'

interface StakeholderTagInputProps {
  value: string
  onChange: (v: string) => void
}

export function StakeholderTagInput({ value, onChange }: StakeholderTagInputProps) {
  const projects = usePortfolioStore(s => s.projects)

  // Build a sorted, unique pool of every stakeholder name used across all projects.
  const allKnown = useMemo(() => {
    const set = new Set<string>()
    projects.forEach(p => {
      p.stakeholders.split(',').map(s => s.trim()).filter(Boolean).forEach(s => set.add(s))
    })
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [projects])

  const tags = useMemo(
    () => (value ? value.split(',').map(s => s.trim()).filter(Boolean) : []),
    [value],
  )

  const [input, setInput]   = useState('')
  const [open,  setOpen]    = useState(false)
  const containerRef        = useRef<HTMLDivElement>(null)
  const inputRef            = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click (mousedown so it fires before blur).
  useClickOutside(containerRef, () => setOpen(false), open)

  // Suggestions: existing names that match the current input and aren't already added.
  const suggestions = allKnown.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s),
  )

  // Show "Create …" when the exact typed text doesn't exist in the pool yet.
  const trimmed    = input.trim()
  const exactMatch = allKnown.some(s => s.toLowerCase() === trimmed.toLowerCase())
  const showCreate = trimmed.length > 0 && !exactMatch && !tags.includes(trimmed)

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag || tags.includes(tag)) { setInput(''); return }
    onChange([...tags, tag].join(', '))
    setInput('')
    setOpen(false)
  }

  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag).join(', '))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      // Prefer the top suggestion if it's a clear match; otherwise create new.
      if (suggestions.length > 0 && suggestions[0].toLowerCase().startsWith(trimmed.toLowerCase())) {
        addTag(suggestions[0])
      } else if (trimmed) {
        addTag(trimmed)
      }
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const dropdownVisible = open && (suggestions.length > 0 || showCreate)

  return (
    <div ref={containerRef} className="relative">
      {/* Tag bag + text input */}
      <div
        className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-10 bg-white cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map(tag => (
          <span
            key={tag}
            className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium shrink-0"
          >
            {tag}
            <button
              type="button"
              onMouseDown={e => e.stopPropagation()}
              onClick={() => removeTag(tag)}
              className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
            >
              <X size={9} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? 'Search or add stakeholder…' : ''}
          className="flex-1 min-w-[140px] text-sm outline-none bg-transparent placeholder:text-slate-400"
        />
      </div>

      {/* Dropdown — suggestions + optional create row */}
      {dropdownVisible && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {suggestions.map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={e => e.preventDefault()} // keep input focused
              onClick={() => addTag(s)}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {s}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => addTag(trimmed)}
              className={cn(
                'w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1.5',
                suggestions.length > 0 && 'border-t border-slate-100',
              )}
            >
              <Plus size={13} className="shrink-0" />
              Create &ldquo;{trimmed}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  )
}
