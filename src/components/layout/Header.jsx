import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';
import { Search, Bell, Sun, Moon, ChevronDown, Globe, Menu } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import './Header.css';

export default function Header({ onMenuToggle }) {
  const { language, changeLanguage, languages, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [langOpen, setLangOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
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
        <div className="header__farm-selector">
          <span className="header__farm-name">Green Valley Farm</span>
          <ChevronDown size={14} />
        </div>
      </div>

      <div className="header__center">
        <div className={`header__search ${searchFocused ? 'header__search--focused' : ''}`}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Search..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>
      </div>

      <div className="header__right">
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

        <div className="header__avatar">
          <span>RK</span>
        </div>
      </div>
    </header>
  );
}
