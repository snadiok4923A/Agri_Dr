import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Text Size accessibility — 50% / 75% / 100% / 125% / 150% / 200%.
 * 100% is the default. The chosen level is persisted to localStorage and
 * applied as `data-textsize` on <html>; the actual smart typography
 * (per-tier scaling factors, px floors/caps) lives in styles/index.css.
 */
const TextSizeContext = createContext();

export const TEXT_SIZES = [50, 75, 100, 125, 150, 200];
const STORAGE_KEY = 'krisiveda-textsize';

function readInitial() {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (TEXT_SIZES.includes(saved)) return saved;
  } catch {
    /* localStorage unavailable — fall through to default */
  }
  return 100;
}

export function TextSizeProvider({ children }) {
  const [textSize, setTextSize] = useState(readInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-textsize', String(textSize));
    try {
      localStorage.setItem(STORAGE_KEY, String(textSize));
    } catch {
      /* ignore persistence failures (private mode etc.) */
    }
  }, [textSize]);

  const value = useMemo(
    () => ({ textSize, setTextSize, textSizes: TEXT_SIZES }),
    [textSize],
  );

  return (
    <TextSizeContext.Provider value={value}>
      {children}
    </TextSizeContext.Provider>
  );
}

export const useTextSize = () => useContext(TextSizeContext);
