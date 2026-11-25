import { SimulationBridge } from '../simulation/SimulationBridge'
import { SimulationPage } from '../pages/SimulationPage'
import { lazy, Suspense, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { PreferencesProvider } from './PreferencesProvider'
import { AppShell } from '../components/layout/AppShell'
import { HistoryPage } from '../pages/HistoryPage'
import { SettingsPage } from '../pages/SettingsPage'
import { AlertsPage } from '../pages/AlertsPage'
const FieldMapPage = lazy(() =>
  import('../pages/FieldMapPage').then((m) => ({ default: m.FieldMapPage })),
)
export function AppRoutes() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={client}>
      <PreferencesProvider>
        <SimulationBridge />
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/map" replace />} />
            <Route
              path="map"
              element={
                <Suspense fallback={<p>Đang tải bản đồ…</p>}>
                  <FieldMapPage />
                </Suspense>
              }
            />
            <Route path="field-map" element={<Navigate to="/map" replace />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            {import.meta.env.DEV && <Route path="dev/simulation" element={<SimulationPage />} />}
            <Route path="settings" element={<SettingsPage />} />
            <Route
              path="*"
              element={
                <section className="surface empty-state">
                  <h1>Không tìm thấy trang</h1>
                  <Link className="button" to="/">
                    Về bản đồ
                  </Link>
                </section>
              }
            />
          </Route>
        </Routes>
      </PreferencesProvider>
    </QueryClientProvider>
  )
}
