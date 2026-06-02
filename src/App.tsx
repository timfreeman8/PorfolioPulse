/**
 * App.tsx — Root router for the SAT application.
 *
 * All page-level components are loaded via React.lazy() so Vite code-splits
 * each page into its own chunk. This keeps the initial bundle small; a page's
 * JS is only fetched when the user first navigates to that route.
 *
 * The entire route tree is wrapped in a single <Suspense> boundary. While a
 * lazy chunk is being fetched the fallback spinner is shown. The AppLayout
 * shell (sidebar, nav) is NOT lazy — it is tiny and must be present
 * immediately so the chrome doesn't flash in after the spinner clears.
 */

import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'

// ---------------------------------------------------------------------------
// Lazy page imports — each becomes a separate Vite chunk.
// Named re-exports from page files are accessed via the `.then` transform
// pattern: lazy(() => import(...).then(m => ({ default: m.NamedExport }))).
// ---------------------------------------------------------------------------

const DashboardPage  = lazy(() => import('@/pages/DashboardPage').then(m  => ({ default: m.DashboardPage  })))
const PortfolioPage  = lazy(() => import('@/pages/PortfolioPage').then(m  => ({ default: m.PortfolioPage  })))
const RosterPage     = lazy(() => import('@/pages/RosterPage').then(m     => ({ default: m.RosterPage     })))
const TeamsPage      = lazy(() => import('@/pages/TeamsDetailPage').then(m => ({ default: m.TeamsPage      })))
const InitiativesPage = lazy(() => import('@/pages/InitiativesPage').then(m => ({ default: m.InitiativesPage })))
const PipelinePage   = lazy(() => import('@/pages/IntakePage').then(m     => ({ default: m.PipelinePage   })))
const AnalyticsPage  = lazy(() => import('@/pages/AnalyticsPage').then(m  => ({ default: m.AnalyticsPage  })))
const PlanningPage   = lazy(() => import('@/pages/CapacityPlannerPage').then(m => ({ default: m.PlanningPage })))
const ProjectsPage   = lazy(() => import('@/pages/ProjectsPage').then(m   => ({ default: m.ProjectsPage   })))
const EscalationsPage = lazy(() => import('@/pages/EscalationsPage').then(m => ({ default: m.EscalationsPage })))
const MemberDetailPage = lazy(() => import('@/pages/MemberDetailPage').then(m => ({ default: m.MemberDetailPage })))
const SettingsPage   = lazy(() => import('@/pages/SettingsPage').then(m   => ({ default: m.SettingsPage   })))

// PrintPage renders outside AppLayout and is also lazy-loaded so it doesn't
// bloat the initial bundle even though it lives on a separate route.
const PrintPage      = lazy(() => import('@/pages/PrintPage').then(m      => ({ default: m.PrintPage      })))

// ---------------------------------------------------------------------------
// Fallback UI shown while a lazy chunk is loading.
// Kept intentionally minimal: a centered spinner using only Tailwind classes
// so it works before any page-specific CSS is available.
// ---------------------------------------------------------------------------
function PageLoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Single Suspense boundary covers the entire route tree.
          Any lazy chunk — whether inside AppLayout or on the print route —
          will show PageLoadingFallback while it loads. */}
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          {/* Print report — standalone full-page view, no sidebar/layout wrapper */}
          <Route path="print" element={<PrintPage />} />

          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="portfolio"   element={<PortfolioPage />} />
            <Route path="projects"    element={<ProjectsPage />} />
            <Route path="roster"      element={<RosterPage />} />
            <Route path="members/:id" element={<MemberDetailPage />} />
            <Route path="initiatives" element={<InitiativesPage />} />
            <Route path="pipeline"    element={<PipelinePage />} />
            <Route path="analytics"   element={<AnalyticsPage />} />
            <Route path="planning"    element={<PlanningPage />} />
            <Route path="escalations" element={<EscalationsPage />} />
            <Route path="teams"       element={<TeamsPage />} />
            <Route path="settings"    element={<SettingsPage />} />
            {/* Legacy redirects so old bookmarks still work */}
            <Route path="capacity"    element={<Navigate to="/planning" replace />} />
            <Route path="intake"      element={<Navigate to="/pipeline" replace />} />
            <Route path="*"           element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
