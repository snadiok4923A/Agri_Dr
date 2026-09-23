import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import { LanguageProvider } from './hooks/useLanguage';
import { TextSizeProvider } from './hooks/useTextSize';
import { VoiceModeProvider } from './hooks/useVoiceMode';
import { WeatherProvider } from './hooks/useWeather';
import { AuthProvider, useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import Dashboard from './pages/Dashboard';
import MyFarm from './pages/MyFarm';
import Crops from './pages/Crops';
import CropDetails from './pages/CropDetails';
import AIDoctor from './pages/AIDoctor';
import Soil from './pages/Soil';
import Disease from './pages/Disease';
import Fertilizer from './pages/Fertilizer';
import Finance from './pages/Finance';
import Market from './pages/Market';
import Insights from './pages/Insights';
import Improve from './pages/Improve';
import Settings from './pages/Settings';

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
