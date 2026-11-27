import { createContext, useContext, useEffect, useState } from 'react';

const FactoryContext = createContext(null);
const STORAGE_KEY = 'factorypulse-shift-planner';

export function FactoryProvider({ initialValue, children }) {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return initialValue;
      const parsed = JSON.parse(saved);
      const mergeById = (seed, current) => seed.map((item) => ({ ...item, ...(current || []).find((entry) => entry.id === item.id) }));
      const oldAlerts = (parsed.alerts || []).map((alert) => ({
        ...alert,
        code: alert.code || (alert.message?.includes('No eligible worker') ? 'workerShortage' : alert.message?.includes('service') ? 'upcomingMaintenance' : 'workerShortage'),
        severity: alert.severity || alert.type || 'warning',
        createdAt: alert.createdAt || new Date().toISOString(),
        read: Boolean(alert.read),
      }));
      return {
        ...initialValue,
        ...parsed,
        workers: mergeById(initialValue.workers, parsed.workers),
        machines: mergeById(initialValue.machines, parsed.machines),
        production: mergeById(initialValue.production || [], parsed.production).map((item) => ({ ...item, unitsMade: item.unitsMade ?? item.produced ?? 0 })),
        simulation: { ...initialValue.simulation, ...(parsed.simulation || {}) },
        incidents: parsed.incidents || initialValue.incidents || [],
        alerts: oldAlerts,
        allocations: { ...initialValue.allocations, ...(parsed.allocations || {}) },
      };
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

