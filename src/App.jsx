import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import { LanguageProvider } from './hooks/useLanguage';
import { TextSizeProvider } from './hooks/useTextSize';
import { VoiceModeProvider } from './hooks/useVoiceMode';
import { WeatherProvider } from './hooks/useWeather';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
/* First screen stays eager (Dashboard is the landing route, Login/Signup
   are tiny) — everything else is split per route. This keeps the initial
   JS to the shell + dashboard instead of parsing all 13 pages (and the
   charting library only two of them use) before the first paint.
   Each page chunk is fetched on first visit and cached by the browser. */
import Dashboard from './pages/Dashboard';
const MyFarm = lazy(() => import('./pages/MyFarm'));
const Crops = lazy(() => import('./pages/Crops'));
const CropDetails = lazy(() => import('./pages/CropDetails'));
const AIDoctor = lazy(() => import('./pages/AIDoctor'));
const Soil = lazy(() => import('./pages/Soil'));
const Disease = lazy(() => import('./pages/Disease'));
const Fertilizer = lazy(() => import('./pages/Fertilizer'));
const Finance = lazy(() => import('./pages/Finance'));
const Market = lazy(() => import('./pages/Market'));
const Insights = lazy(() => import('./pages/Insights'));
const Improve = lazy(() => import('./pages/Improve'));
const Settings = lazy(() => import('./pages/Settings'));

export default function App() {
  return (
    <ThemeProvider>
      <TextSizeProvider>
      <LanguageProvider>
        {/* AuthProvider wraps everything (incl. the router) so session
            state is available app-wide — Header, pages, and the auth
            pages themselves. Auth logic (useAuth/authService) is fully
            separate from the Login/Signup UI (spec §14). */}
        <AuthProvider>
        {/* VoiceModeProvider lives INSIDE the Router so voice commands can
            drive react-router navigation directly. */}
        <BrowserRouter basename="/Agri_Dr">
          <WeatherProvider>
          <VoiceModeProvider>
            <Routes>
              {/* Public auth routes — replaceable UI, logic stays in
                  AuthProvider/authService (spec §14). */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Protected app shell — all dashboard pages require a
                  session; unauthenticated visitors land on /login. */}
              {/* Lazy page chunks suspend inside the Layout shell (see
                  Layout.jsx) — the header/sidebar never unmount, so
                  switching pages keeps the app frame perfectly still
                  (spec §22: lazy-load heavy features, never the
                  above-the-fold shell). */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="farm" element={<MyFarm />} />
                <Route path="crops" element={<Crops />} />
                <Route path="crops/:id" element={<CropDetails />} />
                <Route path="ai-doctor" element={<AIDoctor />} />
                <Route path="soil" element={<Soil />} />
                <Route path="disease" element={<Disease />} />
                <Route path="fertilizer" element={<Fertilizer />} />
                <Route path="finance" element={<Finance />} />
                <Route path="market" element={<Market />} />
                <Route path="insights" element={<Insights />} />
                <Route path="improve" element={<Improve />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              {/* Removed pages (e.g. /health) and unknown paths land on the dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </VoiceModeProvider>
          </WeatherProvider>
        </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
      </TextSizeProvider>
    </ThemeProvider>
  );
}
