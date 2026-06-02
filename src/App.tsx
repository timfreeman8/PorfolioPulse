import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { PortfolioPage } from '@/pages/PortfolioPage'
import { RosterPage } from '@/pages/RosterPage'
import { TeamsPage } from '@/pages/TeamsDetailPage'
import { InitiativesPage } from '@/pages/InitiativesPage'
import { PipelinePage } from '@/pages/IntakePage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { PlanningPage } from '@/pages/CapacityPlannerPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { EscalationsPage } from '@/pages/EscalationsPage'
import { MemberDetailPage } from '@/pages/MemberDetailPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PrintPage } from '@/pages/PrintPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Print report — standalone full-page view, no sidebar/layout wrapper */}
        <Route path="print" element={<PrintPage />} />

        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="roster" element={<RosterPage />} />
          <Route path="members/:id" element={<MemberDetailPage />} />
          <Route path="initiatives" element={<InitiativesPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="planning" element={<PlanningPage />} />
          <Route path="escalations" element={<EscalationsPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {/* Legacy redirects so old bookmarks still work */}
          <Route path="capacity" element={<Navigate to="/planning" replace />} />
          <Route path="intake" element={<Navigate to="/pipeline" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
