import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { seedIfEmpty } from '@/lib/seedData'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { flushPendingSave } from '@/lib/persistence'

// Seed on first launch (no-op if localStorage already has data)
seedIfEmpty(usePortfolioStore.getState().hydrate)

// Flush any debounced writes before the tab closes so no mutations are lost.
// scheduleSave() coalesces rapid writes into a single write after 500ms of
// inactivity; this handler ensures the last write completes on tab close.
window.addEventListener('beforeunload', flushPendingSave)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
