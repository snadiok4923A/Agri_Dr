import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import { LanguageProvider } from './hooks/useLanguage';
import { VoiceModeProvider } from './hooks/useVoiceMode';
import Layout from './components/layout/Layout';
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
      <LanguageProvider>
        {/* VoiceModeProvider lives INSIDE the Router so voice commands can
            drive react-router navigation directly. */}
        <BrowserRouter basename="/Agri_Dr">
          <VoiceModeProvider>
            <Routes>
              <Route path="/" element={<Layout />}>
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
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}
