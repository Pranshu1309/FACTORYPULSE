import { createContext, useContext, useEffect, useState } from 'react';

const FactoryContext = createContext(null);
const STORAGE_KEY = 'factorypulse-shift-planner';

export function FactoryProvider({ initialValue, children }) {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...initialValue, ...JSON.parse(saved) } : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  return <FactoryContext.Provider value={{ data, setData }}>{children}</FactoryContext.Provider>;
}

export function useFactoryData() {
  const context = useContext(FactoryContext);
  if (!context) throw new Error('useFactoryData must be used within FactoryProvider');
  return context;
}
