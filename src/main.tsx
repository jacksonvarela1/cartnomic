import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import './styles.css'
import { AppProvider } from './state/store'
import Shell from './components/Shell'
import ChunkBoundary from './components/ChunkBoundary'
import BasketPage from './routes/BasketPage'
import ComparePage from './routes/ComparePage'
import PreferencesPage from './routes/PreferencesPage'
// The charting library is the largest dependency, so the Trends route loads on demand.
const TrendsPage = lazy(() => import('./routes/TrendsPage'))
import PlanPage from './routes/PlanPage'
import SourcesPage from './routes/SourcesPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      {/* Hash routing keeps every route working on a refresh from any static host. */}
      <HashRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Navigate to="/basket" replace />} />
            <Route path="/basket" element={<BasketPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/preferences" element={<PreferencesPage />} />
            <Route path="/trends" element={<ChunkBoundary><Suspense fallback={<p className="muted">Loading the charts.</p>}><TrendsPage /></Suspense></ChunkBoundary>} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="*" element={<Navigate to="/basket" replace />} />
          </Routes>
        </Shell>
      </HashRouter>
    </AppProvider>
  </StrictMode>,
)
