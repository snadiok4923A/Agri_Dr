import { createContext, useContext, useState, useCallback } from 'react';

const InfoLevelContext = createContext();

export const INFO_LEVELS = {
  simple: 'simple',
  standard: 'standard',
  advanced: 'advanced',
};

export function InfoLevelProvider({ children }) {
  const [level, setLevel] = useState(() => {
    return localStorage.getItem('krisiveda-info-level') || 'standard';
  });

  const changeLevel = useCallback((newLevel) => {
    setLevel(newLevel);
    localStorage.setItem('krisiveda-info-level', newLevel);
  }, []);

  const isSimple = level === 'simple';
  const isStandard = level === 'standard';
  const isAdvanced = level === 'advanced';

  return (
    <InfoLevelContext.Provider value={{ level, changeLevel, isSimple, isStandard, isAdvanced }}>
      {children}
    </InfoLevelContext.Provider>
  );
}

export const useInfoLevel = () => useContext(InfoLevelContext);
