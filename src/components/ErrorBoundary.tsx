/**
 * ErrorBoundary — top-level React class component that catches any unhandled
 * render error in its subtree and replaces the blank white screen with a
 * friendly recovery UI.
 *
 * React error boundaries MUST be class components (there is no hook equivalent
 * because getDerivedStateFromError / componentDidCatch have no function analogue).
 *
 * Wraps the entire <BrowserRouter> in App.tsx so any page that throws during
 * render shows this fallback instead of a blank screen.
 *
 * Recovery strategy: the "Reload page" button calls window.location.reload()
 * which clears the React tree entirely and lets the app re-initialise from
 * localStorage. This is safe because all state is persisted.
 */
import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  /** The caught error, or null when no error has occurred. */
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  /** Called during render when a descendant throws — return new state. */
  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  /** Called after the error is committed — good place for logging. */
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error)
    console.error('[ErrorBoundary] Component stack:', info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
          <div className="max-w-md w-full text-center space-y-5">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle size={28} className="text-red-500 dark:text-red-400" />
              </div>
            </div>

            {/* Heading */}
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Something went wrong
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                An unexpected error occurred. Your data is safe — it's persisted in
                localStorage and will be restored when you reload.
              </p>
            </div>

            {/* Error detail — collapsed by default so it doesn't overwhelm */}
            <details className="text-left bg-slate-100 dark:bg-slate-800 rounded-lg px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
              <summary className="cursor-pointer font-medium">Error details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-all">
                {this.state.error.message}
              </pre>
            </details>

            {/* Reload button — clears the React tree, re-initialises from localStorage */}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw size={14} />
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
