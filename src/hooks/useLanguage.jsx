import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { translations } from '../data/translations';

const LanguageContext = createContext();

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', flag: '🇬🇧', locale: 'en-IN', voice: 'en-IN' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇧🇩', locale: 'bn-IN', voice: 'bn-IN' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳', locale: 'hi-IN', voice: 'hi-IN' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳', locale: 'te-IN', voice: 'te-IN' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳', locale: 'ta-IN', voice: 'ta-IN' },
];

/* Resolve a dotted key against a translation tree. Returns undefined when
 * the key (or any ancestor) is missing — the caller decides the fallback.
 * Values may be strings OR functions (dynamic sentences); callers invoke
 * function values with the interpolation params. */
function lookup(tree, key) {
  let value = tree;
  for (const k of key.split('.')) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }
  return typeof value === 'string' || typeof value === 'function'
    ? value
    : undefined;
}

/* Fill {name}-style placeholders: t("dashboard.greetingTime", { name })
 * → "Good morning, Anantā Maurya". Unknown placeholders are left intact. */
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, p) =>
    p in params ? String(params[p]) : m
  );
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('krisiveda-lang');
    return LANGUAGES.some((l) => l.code === saved) ? saved : 'en';
  });

  const active = useMemo(
    () => LANGUAGES.find((l) => l.code === language) || LANGUAGES[0],
    [language]
  );

  const changeLanguage = useCallback((code) => {
    setLanguage(code);
    localStorage.setItem('krisiveda-lang', code);
    document.documentElement.setAttribute('lang', code);
  }, []);

  /* Central translator. Resolution order (never leaks a raw key):
   *   1. selected language  2. English fallback  3. the key itself
   * Supports {placeholder} interpolation for dynamic sentences. */
  const t = useCallback(
    (key, params) => {
      let value =
        lookup(translations[language], key) ??
        lookup(translations.en, key) ??
        key;
      if (typeof value === 'function') value = value(params || {});
      return interpolate(value, params);
    },
    [language]
  );

  /* Locale-aware number formatting — the proper way to get ৭৮ / १६.१ /
   * ౭౮ etc. instead of manual digit swapping in components.
   *   formatNumber(78)                     → "৭৮"   (bn)
   *   formatNumber(8.6, {maximumFractionDigits: 1}) → "৮.৬"
   * Grouping follows the locale (12,345 → ১২,৩৪৫). */
  const formatNumber = useCallback(
    (value, options = {}) => {
      if (value === null || value === undefined || Number.isNaN(Number(value)))
        return String(value ?? '—');
      try {
        return new Intl.NumberFormat(active.locale, options).format(Number(value));
      } catch {
        return String(value);
      }
    },
    [active.locale]
  );

  /* Localize a free-text numeric label from the data files
   * ("8.6 Acres", "16.1 T", "78%", "29°C", "₹3,500–4,500+/Q", "0.6 g / L").
   * Digits are converted per locale; every non-digit character (units,
   * currency symbols, ranges, chemical notation) passes through untouched,
   * so currency/technical values are never corrupted. */
  const formatLabel = useCallback(
    (text) => {
      if (text === null || text === undefined) return text;
      const str = String(text);
      if (language === 'en') return str;
      return str.replace(/\d/g, (d) =>
        new Intl.NumberFormat(active.locale).format(Number(d))
      );
    },
    [language, active.locale]
  );

  const value = useMemo(
    () => ({
      language,
      locale: active.locale,
      voiceLocale: active.voice,
      languages: LANGUAGES,
      changeLanguage,
      t,
      formatNumber,
      formatLabel,
    }),
    [language, active, changeLanguage, t, formatNumber, formatLabel]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
