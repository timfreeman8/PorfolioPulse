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
 *   - Project  → /projects?search=<name>  (Projects page with pre-filled filter)
 *   - Initiative → /initiatives (no deep-link; page is list-only)
 *   - Intake   → /pipeline (intake/pipeline page)
 *
 * Dark mode: all colours use Tailwind's `dark:` variants so the modal adapts
 * to the sidebar's dark-mode CSS variable automatically.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, Layers, Target, ClipboardList, SearchX } from 'lucide-react'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useViewStore } from '@/store/useViewStore'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of results shown per group so the list stays scannable. */
const MAX_PER_GROUP = 5

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single entry shown in the results list. */
interface SearchResult {
  /** Unique key for React list rendering. */
  key: string
  /** Result group this entry belongs to. */
  group: 'Members' | 'Projects' | 'Initiatives' | 'Intake'
  /** Primary display label. */
  label: string
  /** Secondary hint shown in muted text (role, status, etc.). */
  sub?: string
  /** Where to navigate when the user selects this result. */
  href: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Case-insensitive substring match — the query must appear in at least one field. */
function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.toLowerCase()
  return fields.some(f => f?.toLowerCase().includes(q))
}

// ─── Group header metadata ────────────────────────────────────────────────────

/** Icon and label for each result group. Keeps the render logic below tidy. */
const GROUP_META: Record<SearchResult['group'], { icon: React.ElementType; label: string }> = {
  Members:     { icon: Users,         label: 'Members' },
  Projects:    { icon: Layers,        label: 'Projects' },
  Initiatives: { icon: Target,        label: 'Initiatives' },
  Intake:      { icon: ClipboardList, label: 'Intake Requests' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchModal() {
  const { searchOpen, setSearchOpen } = useViewStore()
  const { members, projects, initiatives, intakeRequests } = usePortfolioStore()
  const navigate = useNavigate()

  // The text the user has typed in the search input.
  const [query, setQuery] = useState('')

  // Index of the currently keyboard-highlighted result (across all groups).
  const [cursor, setCursor] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)

  // ── Reset state whenever the modal opens ────────────────────────────────────
  useEffect(() => {
    if (searchOpen) {
      setQuery('')
      setCursor(0)
      // Defer focus one tick so the DOM is settled after the Dialog animation.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [searchOpen])

  // ── Global keyboard shortcut: cmd+K / ctrl+K ────────────────────────────────
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

  // ── Build result list whenever query or data changes ────────────────────────
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return []

    const q = query.trim()
    const out: SearchResult[] = []

    // Members — match on name and role
    members
      .filter(m => matches(q, m.name, m.role))
      .slice(0, MAX_PER_GROUP)
      .forEach(m => out.push({
        key:   `member-${m.id}`,
        group: 'Members',
        label: m.name,
        sub:   m.role,
        href:  `/members/${m.id}`,
      }))

    // Projects — match on name and description
    projects
      .filter(p => matches(q, p.name, p.description))
      .slice(0, MAX_PER_GROUP)
      .forEach(p => out.push({
        key:   `project-${p.id}`,
        group: 'Projects',
        label: p.name,
        sub:   p.status,
        // Navigate to the Projects page with a pre-filled search filter so
        // the user lands directly on the matching project row.
        href:  `/projects?search=${encodeURIComponent(p.name)}`,
      }))

    // Initiatives — match on name and description
    initiatives
      .filter(i => matches(q, i.name, i.description))
      .slice(0, MAX_PER_GROUP)
      .forEach(i => out.push({
        key:   `initiative-${i.id}`,
        group: 'Initiatives',
        label: i.name,
        sub:   i.status,
        href:  '/initiatives',
      }))

    // Intake Requests — match on description and requester name
    intakeRequests
      .filter(r => matches(q, r.description, r.requesterName, r.teamOrDomain))
      .slice(0, MAX_PER_GROUP)
      .forEach(r => out.push({
        key:   `intake-${r.id}`,
        group: 'Intake',
        label: r.description.length > 60
          ? r.description.slice(0, 60) + '…'
          : r.description,
        sub:   `${r.requesterName} · ${r.status}`,
        href:  '/pipeline',
      }))

    return out
  }, [query, members, projects, initiatives, intakeRequests])

  // Keep cursor clamped when results shrink (e.g. user deletes text).
  useEffect(() => {
    setCursor(c => Math.min(c, Math.max(0, results.length - 1)))
  }, [results.length])

  // ── Navigate to a result and close the modal ────────────────────────────────
  const select = useCallback((result: SearchResult) => {
    setSearchOpen(false)
    navigate(result.href)
  }, [navigate, setSearchOpen])

  // ── Keyboard navigation inside the modal ────────────────────────────────────
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
      // Let the Dialog handle Escape for consistent close behaviour.
    }
  }

  // ── Group results for rendering ─────────────────────────────────────────────
  // Build an ordered list of groups that have at least one result so we can
  // render the group header once before its items.
  const groupOrder: SearchResult['group'][] = ['Members', 'Projects', 'Initiatives', 'Intake']
  const grouped = groupOrder
    .map(g => ({ group: g, items: results.filter(r => r.group === g) }))
    .filter(g => g.items.length > 0)

  // We need a flat index per result so the cursor tracks across groups.
  // Build a map: result.key → flat index once.
  const flatIndex = useMemo(() => {
    const m = new Map<string, number>()
    results.forEach((r, i) => m.set(r.key, i))
    return m
  }, [results])

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!searchOpen) return null

  return (
    // Backdrop — clicking it closes the modal.
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onMouseDown={(e) => {
        // Only close when clicking the backdrop itself, not the modal panel.
        if (e.target === e.currentTarget) setSearchOpen(false)
      }}
      role="presentation"
    >
      {/* Modal panel */}
      <div
        className={cn(
          'w-full max-w-xl mx-4 rounded-xl shadow-2xl',
          'bg-white dark:bg-slate-900',
          'border border-slate-200 dark:border-slate-700',
          'flex flex-col overflow-hidden',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* ── Search input row ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Search
            size={18}
            className="shrink-0 text-slate-400 dark:text-slate-500"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search members, projects, initiatives, intake…"
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0) }}
            onKeyDown={onInputKeyDown}
            className={cn(
              'flex-1 bg-transparent outline-none text-sm',
              'text-slate-900 dark:text-slate-100',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            )}
            aria-autocomplete="list"
            aria-controls="search-results"
          />
          {/* Escape hint */}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Esc
          </kbd>
        </div>

        {/* ── Results list ─────────────────────────────────────────────────── */}
        <div
          id="search-results"
          role="listbox"
          className="overflow-y-auto max-h-[60vh]"
        >
          {/* Empty state — query entered but no matches */}
          {query.trim() && results.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <SearchX size={28} className="text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No results for <span className="font-medium text-slate-700 dark:text-slate-300">"{query}"</span>
              </p>
            </div>
          )}

          {/* Hint when the input is still empty */}
          {!query.trim() && (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              Start typing to search across the portfolio…
            </p>
          )}

          {/* Grouped results */}
          {grouped.map(({ group, items }) => {
            const { icon: Icon, label } = GROUP_META[group]
            return (
              <div key={group}>
                {/* Group header */}
                <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                  <Icon
                    size={13}
                    className="text-slate-400 dark:text-slate-500 shrink-0"
                    aria-hidden
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
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
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                      )}
                    >
                      {/* Active indicator strip */}
                      <div
                        className={cn(
                          'w-0.5 h-5 rounded-full shrink-0 transition-colors',
                          isActive ? 'bg-blue-500' : 'bg-transparent',
                        )}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium truncate',
                          'text-slate-800 dark:text-slate-100',
                        )}>
                          {result.label}
                        </p>
                        {result.sub && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            {result.sub}
                          </p>
                        )}
                      </div>
                      {/* Enter hint shown only on the active row */}
                      {isActive && (
                        <kbd className="shrink-0 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          ↵
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}

          {/* Bottom padding so last item isn't flush with the modal edge */}
          {results.length > 0 && <div className="h-2" />}
        </div>
      </div>
    </div>
  )
}
