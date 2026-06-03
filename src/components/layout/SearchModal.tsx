/**
 * SearchModal — global command palette, opened via cmd+K (Mac) or ctrl+K (Windows).
 *
 * The modal is mounted once inside AppLayout and its open/close state lives in
 * useViewStore so any component (e.g. the TopBar hint button) can trigger it
 * without prop-drilling.
 *
 * Search strategy:
 *   - Normalises the query to lowercase and matches against each entity's key
 *     text fields (name, role, description, etc.).
 *   - Results are grouped into four categories: Members, Projects, Initiatives,
 *     and Intake Requests. Each group shows at most MAX_PER_GROUP results.
 *   - The full result list is flat-indexed for keyboard navigation (arrow keys
 *     move a single cursor across all groups; Enter navigates to the result).
 *
 * Navigation targets:
 *   - Member   → /members/:id
 *   - Project  → /projects/:id  (direct project builder)
 *   - Initiative → /initiatives
 *   - Intake   → /pipeline
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, Layers, Target, ClipboardList, SearchX, ArrowRight } from 'lucide-react'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useViewStore } from '@/store/useViewStore'
import { cn } from '@/lib/utils'

const MAX_PER_GROUP = 5

interface SearchResult {
  key: string
  group: 'Members' | 'Projects' | 'Initiatives' | 'Intake'
  label: string
  sub?: string
  href: string
}

function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.toLowerCase()
  return fields.some(f => f?.toLowerCase().includes(q))
}

const GROUP_META: Record<SearchResult['group'], { icon: React.ElementType; label: string }> = {
  Members:     { icon: Users,         label: 'Members' },
  Projects:    { icon: Layers,        label: 'Projects' },
  Initiatives: { icon: Target,        label: 'Initiatives' },
  Intake:      { icon: ClipboardList, label: 'Intake Requests' },
}

export function SearchModal() {
  const { searchOpen, setSearchOpen } = useViewStore()
  const { members, projects, initiatives, intakeRequests } = usePortfolioStore()
  const navigate = useNavigate()

  const [query, setQuery]   = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset and focus when opening
  useEffect(() => {
    if (searchOpen) {
      setQuery('')
      setCursor(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [searchOpen])

  // Global cmd+K / ctrl+K shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setSearchOpen])

  // Build result list on every query/data change
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return []
    const q = query.trim()
    const out: SearchResult[] = []

    members
      .filter(m => matches(q, m.name, m.role))
      .slice(0, MAX_PER_GROUP)
      .forEach(m => out.push({ key: `member-${m.id}`, group: 'Members', label: m.name, sub: m.role, href: `/members/${m.id}` }))

    projects
      .filter(p => matches(q, p.name, p.description))
      .slice(0, MAX_PER_GROUP)
      .forEach(p => out.push({ key: `project-${p.id}`, group: 'Projects', label: p.name, sub: `${p.phase} · ${p.status}`, href: `/projects/${p.id}` }))

    initiatives
      .filter(i => matches(q, i.name, i.description))
      .slice(0, MAX_PER_GROUP)
      .forEach(i => out.push({ key: `initiative-${i.id}`, group: 'Initiatives', label: i.name, sub: i.status, href: '/initiatives' }))

    intakeRequests
      .filter(r => matches(q, r.description, r.requesterName, r.teamOrDomain))
      .slice(0, MAX_PER_GROUP)
      .forEach(r => out.push({
        key:   `intake-${r.id}`,
        group: 'Intake',
        label: r.description.length > 60 ? r.description.slice(0, 60) + '…' : r.description,
        sub:   `${r.requesterName} · ${r.status}`,
        href:  '/pipeline',
      }))

    return out
  }, [query, members, projects, initiatives, intakeRequests])

  // Clamp cursor when results shrink
  useEffect(() => {
    setCursor(c => Math.min(c, Math.max(0, results.length - 1)))
  }, [results.length])

  const select = useCallback((result: SearchResult) => {
    setSearchOpen(false)
    navigate(result.href)
  }, [navigate, setSearchOpen])

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[cursor]) select(results[cursor])
    } else if (e.key === 'Escape') {
      setSearchOpen(false)
    }
  }

  const groupOrder: SearchResult['group'][] = ['Members', 'Projects', 'Initiatives', 'Intake']
  const grouped = groupOrder
    .map(g => ({ group: g, items: results.filter(r => r.group === g) }))
    .filter(g => g.items.length > 0)

  const flatIndex = useMemo(() => {
    const m = new Map<string, number>()
    results.forEach((r, i) => m.set(r.key, i))
    return m
  }, [results])

  if (!searchOpen) return null

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onMouseDown={e => { if (e.target === e.currentTarget) setSearchOpen(false) }}
      role="presentation"
    >
      {/* Panel — white, bordered, rounded, same shadow as other modals */}
      <div
        className="w-full max-w-lg mx-4 bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search size={16} className="shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search members, projects, initiatives…"
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0) }}
            onKeyDown={onInputKeyDown}
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
            aria-autocomplete="list"
            aria-controls="search-results"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-400 border border-slate-200">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div id="search-results" role="listbox" className="overflow-y-auto max-h-[55vh]">

          {/* Empty query hint */}
          {!query.trim() && (
            <p className="py-8 text-center text-sm text-slate-400">
              Start typing to search across the portfolio…
            </p>
          )}

          {/* No matches */}
          {query.trim() && results.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <SearchX size={24} className="text-slate-300" />
              <p className="text-sm text-slate-500">
                No results for <span className="font-medium text-slate-700">"{query}"</span>
              </p>
            </div>
          )}

          {/* Grouped results */}
          {grouped.map(({ group, items }) => {
            const { icon: Icon, label } = GROUP_META[group]
            return (
              <div key={group} className="pt-2 last:pb-2">
                {/* Group header */}
                <div className="flex items-center gap-1.5 px-4 py-1">
                  <Icon size={11} className="text-slate-400 shrink-0" aria-hidden />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    {label}
                  </span>
                </div>

                {/* Result rows */}
                {items.map(result => {
                  const idx = flatIndex.get(result.key)!
                  const isActive = idx === cursor
                  return (
                    <button
                      key={result.key}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setCursor(idx)}
                      onClick={() => select(result)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                        isActive ? 'bg-blue-50' : 'hover:bg-slate-50',
                      )}
                    >
                      {/* Active accent bar */}
                      <div className={cn('w-0.5 h-4 rounded-full shrink-0 transition-colors', isActive ? 'bg-blue-500' : 'bg-transparent')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium truncate', isActive ? 'text-blue-900' : 'text-slate-800')}>
                          {result.label}
                        </p>
                        {result.sub && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{result.sub}</p>
                        )}
                      </div>
                      {isActive && (
                        <ArrowRight size={14} className="shrink-0 text-blue-400" />
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
