import { createContext, useContext, useState, useCallback } from 'react';
import { translations } from '../data/translations';

const LanguageContext = createContext();

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇧🇩' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
];

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('krisiveda-lang') || 'en';
  });

  const changeLanguage = useCallback((code) => {
    setLanguage(code);
    localStorage.setItem('krisiveda-lang', code);
    document.documentElement.setAttribute('lang', code);
  }, []);

  const t = useCallback((key) => {
    const keys = key.split('.');
    let value = translations[language];
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key;
      }
    }
    if (!value && language !== 'en') {
      let fallback = translations['en'];
      for (const k of keys) {
        if (fallback && typeof fallback === 'object') {
          fallback = fallback[k];
        } else {
          return key;
        }
      }
      return fallback || key;
    }
    return value || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
