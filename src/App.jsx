import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import { LanguageProvider } from './hooks/useLanguage';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import MyFarm from './pages/MyFarm';
import Crops from './pages/Crops';
import CropDetails from './pages/CropDetails';
import Health from './pages/Health';
import AIDoctor from './pages/AIDoctor';
import Weather from './pages/Weather';
import Soil from './pages/Soil';
import Irrigation from './pages/Irrigation';
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
          <BrowserRouter basename="/Agri_de">
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="farm" element={<MyFarm />} />
                <Route path="crops" element={<Crops />} />
                <Route path="crops/:id" element={<CropDetails />} />
                <Route path="health" element={<Health />} />
                <Route path="ai-doctor" element={<AIDoctor />} />
                <Route path="weather" element={<Weather />} />
                <Route path="soil" element={<Soil />} />
                <Route path="irrigation" element={<Irrigation />} />
                <Route path="disease" element={<Disease />} />
                <Route path="fertilizer" element={<Fertilizer />} />
                <Route path="finance" element={<Finance />} />
                <Route path="market" element={<Market />} />
                <Route path="insights" element={<Insights />} />
                <Route path="improve" element={<Improve />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}
