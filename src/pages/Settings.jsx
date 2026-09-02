import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { Settings as SettingsIcon, Globe, Palette } from 'lucide-react';
import './Settings.css';

export default function Settings() {
  const { language, changeLanguage, languages, t } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <div className="page-container settings-page">
      <section className="settings-page__header section">
        <h1 className="settings-page__title">{t('nav.settings')}</h1>
      </section>

      <div className="settings-page__content">
        {/* Profile */}
        <section className="settings-page__section">
          <div className="settings-page__section-header">
            <div className="settings-page__section-icon">
              <SettingsIcon size={18} />
            </div>
            <div>
              <h2 className="settings-page__section-title">{t('settings.profile')}</h2>
              <p className="settings-page__section-subtitle">Manage your account</p>
            </div>
          </div>
          <div className="settings-page__section-content">
            <div className="settings-page__field">
              <label className="settings-page__label">Name</label>
              <input className="settings-page__input" defaultValue="Rajesh Kumar" />
            </div>
            <div className="settings-page__field">
              <label className="settings-page__label">Farm Name</label>
              <input className="settings-page__input" defaultValue="Green Valley Farm" />
            </div>
            <div className="settings-page__field">
              <label className="settings-page__label">Location</label>
              <input className="settings-page__input" defaultValue="West Bengal, India" />
            </div>
          </div>
        </section>

        {/* Language */}
        <section className="settings-page__section">
          <div className="settings-page__section-header">
            <div className="settings-page__section-icon">
              <Globe size={18} />
            </div>
            <div>
              <h2 className="settings-page__section-title">{t('settings.language')}</h2>
              <p className="settings-page__section-subtitle">Choose your preferred language</p>
            </div>
          </div>
          <div className="settings-page__section-content">
            <div className="settings-page__language-grid">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  className={`settings-page__lang-option ${lang.code === language ? 'settings-page__lang-option--active' : ''}`}
                  onClick={() => changeLanguage(lang.code)}
                >
                  <span className="settings-page__lang-flag">{lang.flag}</span>
                  <span className="settings-page__lang-native">{lang.native}</span>
                  <span className="settings-page__lang-name">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="settings-page__section">
          <div className="settings-page__section-header">
            <div className="settings-page__section-icon">
              <Palette size={18} />
            </div>
            <div>
              <h2 className="settings-page__section-title">{t('settings.appearance')}</h2>
              <p className="settings-page__section-subtitle">Choose your theme</p>
            </div>
          </div>
          <div className="settings-page__section-content">
            <div className="settings-page__theme-grid">
              <button
                className={`settings-page__theme-option ${theme === 'dark' ? 'settings-page__theme-option--active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                <span className="settings-page__theme-preview settings-page__theme-preview--dark">
                  <span className="settings-page__theme-preview-bar" />
                  <span className="settings-page__theme-preview-content" />
                </span>
                <span className="settings-page__theme-label">☾ {t('settings.dark')}</span>
              </button>
              <button
                className={`settings-page__theme-option ${theme === 'light' ? 'settings-page__theme-option--active' : ''}`}
                onClick={() => setTheme('light')}
              >
                <span className="settings-page__theme-preview settings-page__theme-preview--light">
                  <span className="settings-page__theme-preview-bar" />
                  <span className="settings-page__theme-preview-content" />
                </span>
                <span className="settings-page__theme-label">☀ {t('settings.light')}</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
