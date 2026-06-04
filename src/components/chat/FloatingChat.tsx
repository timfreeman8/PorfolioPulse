/**
 * FloatingChat — always-on-screen AI Assistant widget.
 *
 * Renders as a small floating button in the bottom-right corner that expands
 * into a chat panel when clicked. The panel can be minimized back to the button.
 * Mounted once in AppLayout so it persists across page navigations.
 *
 * Chat flow:
 *  1. User types a question and hits Enter (or the send button).
 *  2. Current Zustand store state is serialized via buildPortfolioContext.
 *  3. Claude API is called via streamChatResponse — text chunks arrive and
 *     render incrementally so the user sees output as it streams.
 *  4. The model is instructed to only answer from portfolio data, so responses
 *     are grounded in actual project/team/member state — not hallucinated.
 *
 * Message history is session-scoped (local state only, not persisted).
 * The conversation resets when the browser tab is closed/refreshed.
 */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot,
  MessageSquare,
  Minus,
  RotateCcw,
  SendHorizonal,
  AlertCircle,
  User,
  Loader2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import {
  ANTHROPIC_KEY_STORAGE,
  buildPortfolioContext,
  streamChatResponse,
  parseSuggestions,
  type ChatMessage,
} from '@/lib/chat'

// ─── Suggestion chips ─────────────────────────────────────────────────────

/** Example prompts shown on the empty chat to give users a starting point. */
const SUGGESTIONS = [
  'How many projects are blocked?',
  'Who is over 80% capacity?',
  'List all active initiatives.',
  'Show Development-phase projects.',
]

// ─── FloatingChat component ───────────────────────────────────────────────

export function FloatingChat() {
  // Whether the chat panel is expanded (vs. minimized to the button).
  const [isOpen, setIsOpen] = useState(false)

  // Conversation — array of alternating user/assistant messages.
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // Current value of the text input.
  const [input, setInput] = useState('')

  // True while a streaming response is in progress — disables sending.
  const [streaming, setStreaming] = useState(false)

  // Inline error shown when an API call fails.
  const [error, setError] = useState<string | null>(null)

  // Read the API key from localStorage on mount and whenever the window refocuses
  // (the user may have saved a new key in Settings without reloading).
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem(ANTHROPIC_KEY_STORAGE) ?? '',
  )

  useEffect(() => {
    function onFocus() {
      setApiKey(localStorage.getItem(ANTHROPIC_KEY_STORAGE) ?? '')
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Portfolio store — serialized on each message submit (always reflects
  // latest state, including any edits made since the tab was opened).
  const portfolioState = usePortfolioStore()

  // Ref for auto-scrolling to the bottom after each new message / chunk.
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  // Auto-resize textarea ref.
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  // ── Submit handler ─────────────────────────────────────────────────────

  async function handleSubmit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming || !apiKey) return

    setError(null)

    // Build the history to send (keep last 20 messages = 10 turns for context).
    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const history = [...messages, userMsg].slice(-20)

    setMessages(history)
    setInput('')
    setStreaming(true)

    // Append an empty assistant placeholder — we'll fill it as chunks arrive.
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const context = buildPortfolioContext(portfolioState)

      for await (const chunk of streamChatResponse(history, context, apiKey)) {
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') {
            // Accumulate the raw content (may include partial <suggestions> tag).
            // PanelMessage will hide everything from <suggestions onwards during
            // streaming so the user never sees the raw tag.
            next[next.length - 1] = { ...last, content: last.content + chunk }
          }
          return next
        })
      }

      // Streaming complete — parse the suggestions block out of the final
      // content and store them as a structured array on the message.
      setMessages(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.role === 'assistant') {
          const { content, suggestions } = parseSuggestions(last.content)
          next[next.length - 1] = { ...last, content, suggestions }
        }
        return next
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      // Drop the empty placeholder if the call failed before any text arrived.
      setMessages(prev => {
        const next = [...prev]
        if (next[next.length - 1]?.role === 'assistant' && !next[next.length - 1].content) {
          next.pop()
        }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(input)
    }
  }

  const hasApiKey = apiKey.length > 0
  const isEmpty = messages.length === 0

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Expanded chat panel ──────────────────────────────────────────
          Fixed to the bottom-right; positioned above the toggle button.
          Uses a drop shadow + border for visual separation from page content.
          Only mounted/visible when isOpen is true; slide-up animation via
          Tailwind transition on transform + opacity. */}
      <div
        className={[
          'fixed bottom-[72px] right-4 z-50',
          'w-[380px] h-[520px]',
          'flex flex-col',
          'bg-white border border-slate-200 rounded-2xl shadow-2xl',
          'transition-all duration-200 origin-bottom-right',
          isOpen
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none',
        ].join(' ')}
      >
        {/* Panel header — title + clear + minimize buttons */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="size-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Bot size={14} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 leading-none">Portfolio Assistant</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-none">Answers from your data only</p>
          </div>
          {/* Clear — only shown when there are messages to clear */}
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setError(null) }}
              disabled={streaming}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md p-1 transition-colors disabled:opacity-40"
              aria-label="Clear chat"
              title="Clear chat"
            >
              <RotateCcw size={13} />
            </button>
          )}
          {/* Minimize collapses back to the floating button */}
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md p-1 transition-colors"
            aria-label="Minimize chat"
          >
            <Minus size={14} />
          </button>
        </div>

        {/* API key warning — shown inside the panel when no key is set */}
        {!hasApiKey && (
          <div className="flex items-start gap-1.5 px-3 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800 shrink-0">
            <AlertCircle size={12} className="mt-0.5 shrink-0 text-amber-500" />
            <span>
              No API key.{' '}
              <Link to="/settings" onClick={() => setIsOpen(false)} className="underline font-medium">
                Settings
              </Link>
              {' '}→ AI Assistant.
            </span>
          </div>
        )}

        {/* Message list — grows to fill available panel height */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">

          {/* Empty state with suggestion chips */}
          {isEmpty ? (
            <div className="flex flex-col items-center text-center pt-4">
              <p className="text-xs text-slate-500 mb-3 max-w-[260px]">
                Ask anything about your projects, teams, capacity, or initiatives.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSubmit(s)}
                    disabled={!hasApiKey || streaming}
                    className="px-2.5 py-1 text-[11px] rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed leading-snug"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <PanelMessage
                key={i}
                message={msg}
                isStreaming={streaming && i === messages.length - 1}
                onSuggest={handleSubmit}
              />
            ))
          )}

          {/* Error display */}
          {error && (
            <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <X size={12} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Auto-scroll anchor */}
          <div ref={bottomRef} />
        </div>

        {/* Input row — pinned to panel bottom */}
        <div className="shrink-0 border-t border-slate-100 px-3 py-2">
          <div className="flex items-end gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:border-slate-400 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming || !hasApiKey}
              placeholder={hasApiKey ? 'Ask about your portfolio…' : 'Add API key in Settings'}
              rows={1}
              className="flex-1 resize-none bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none leading-relaxed min-h-[1.25rem] max-h-[120px] disabled:opacity-50"
            />
            <Button
              size="sm"
              onClick={() => handleSubmit(input)}
              disabled={!input.trim() || streaming || !hasApiKey}
              className="shrink-0 size-6 p-0 rounded-lg"
            >
              {streaming
                ? <Loader2 size={11} className="animate-spin" />
                : <SendHorizonal size={11} />
              }
            </Button>
          </div>
        </div>
      </div>

      {/* ── Toggle button ─────────────────────────────────────────────────
          Floating action button; opens the panel when chat is minimized.
          Shows an unread indicator dot while chat is closed and there are
          unanswered assistant messages (i.e., the user hasn't seen the reply). */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-4 right-4 z-50 size-12 rounded-full bg-slate-800 text-white shadow-lg hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center"
        aria-label={isOpen ? 'Close assistant' : 'Open assistant'}
        title="Portfolio Assistant"
      >
        {isOpen
          ? <X size={20} />
          : <MessageSquare size={20} />
        }
      </button>
    </>
  )
}

// ─── PanelMessage component ───────────────────────────────────────────────

/**
 * PanelMessage — a single message bubble inside the floating chat panel.
 *
 * User messages appear right-aligned. Assistant messages appear left-aligned
 * with a bot icon avatar. A bouncing-dot loader is shown while the first
 * chunk hasn't arrived; a pulsing cursor dot is appended while chunks stream.
 *
 * Completed assistant messages show follow-up suggestion chips below the text.
 * During streaming, any partial `<suggestions>` block is hidden from the user
 * by truncating the displayed content at the first `<suggestions` character.
 *
 * The `onSuggest` callback fires when a chip is clicked so FloatingChat can
 * submit the suggestion text as the next user message.
 */
function PanelMessage({
  message,
  isStreaming,
  onSuggest,
}: {
  message: ChatMessage
  isStreaming: boolean
  onSuggest: (text: string) => void
}) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-start gap-1.5 max-w-[85%]">
          <div className="bg-slate-800 text-white text-xs rounded-2xl rounded-tr-sm px-3 py-2 leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
          <div className="shrink-0 size-5 rounded-full bg-slate-200 flex items-center justify-center mt-0.5">
            <User size={10} className="text-slate-600" />
          </div>
        </div>
      </div>
    )
  }

  // During streaming, hide everything from the first `<suggestions` character
  // onward so the raw XML tag never appears in the chat bubble.
  const displayContent = isStreaming
    ? message.content.replace(/<suggestions[\s\S]*$/, '').trimEnd()
    : message.content

  return (
    <div className="flex items-start gap-1.5">
      <div className="shrink-0 size-5 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
        <Bot size={10} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-800 leading-relaxed">
          {/* Bouncing dots while waiting for first chunk */}
          {!displayContent && isStreaming ? (
            <span className="inline-flex gap-0.5 items-center py-1">
              <span className="size-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
              <span className="size-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
              <span className="size-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
            </span>
          ) : (
            <div className="whitespace-pre-wrap">
              {displayContent}
              {/* Pulsing dot while streaming */}
              {isStreaming && (
                <span className="inline-block ml-0.5 size-[3px] rounded-full bg-slate-400 animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Follow-up suggestion chips — only shown on completed assistant messages */}
        {!isStreaming && message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.suggestions.map(s => (
              <button
                key={s}
                onClick={() => onSuggest(s)}
                className="px-2 py-1 text-[10px] leading-tight rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700 transition-colors text-left"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
