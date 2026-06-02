import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { seedIfEmpty } from '@/lib/seedData'
import { usePortfolioStore } from '@/store/usePortfolioStore'

// Seed on first launch (no-op if localStorage already has data)
seedIfEmpty(usePortfolioStore.getState().hydrate)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
