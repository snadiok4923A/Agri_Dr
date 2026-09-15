import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';
import { Bell, Sun, Moon, ChevronDown, Globe, Menu, Mic } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useVoiceMode } from '../../hooks/useVoiceMode';
import { demoUser } from '../../data/mockData';
import './Header.css';

export default function Header({ onMenuToggle }) {
  const { language, changeLanguage, languages, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { active: voiceActive, stop: stopVoiceMode } = useVoiceMode();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);

  const currentLang = languages.find(l => l.code === language);

  useEffect(() => {
    const handleClick = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="header">
      <div className="header__left">
        <button className="header__menu-btn" onClick={onMenuToggle} aria-label="Toggle menu">
          <Menu size={20} />
        </button>
      </div>

      <div className="header__right">
        {/* Persistent Voice Mode indicator — click to stop */}
        {voiceActive && (
          <button
            className="header__voice-btn"
            onClick={stopVoiceMode}
            aria-label="Stop Voice Mode"
            title="Voice Mode active — click to stop"
          >
            <Mic size={15} />
            <span className="header__voice-dot" />
          </button>
        )}
        <div className="header__lang" ref={langRef}>
          <button
            className="header__lang-btn"
            onClick={() => setLangOpen(!langOpen)}
          >
            <Globe size={16} />
            <span>{currentLang?.native}</span>
            <ChevronDown size={12} />
          </button>
          {langOpen && (
            <div className="header__lang-dropdown">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  className={`header__lang-option ${lang.code === language ? 'header__lang-option--active' : ''}`}
                  onClick={() => { changeLanguage(lang.code); setLangOpen(false); }}
                >
                  <span className="header__lang-flag">{lang.flag}</span>
                  <span>{lang.native}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="header__icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button className="header__icon-btn header__notification" aria-label="Notifications">
          <Bell size={18} />
          <span className="header__notification-dot" />
        </button>

        <div className="header__avatar" title={demoUser.name}>
          <span>{demoUser.initials}</span>
        </div>
      </div>
    </header>
  );
}
