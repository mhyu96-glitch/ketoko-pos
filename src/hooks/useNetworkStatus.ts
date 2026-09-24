import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export function useNetworkStatus() {
  const [navigatorOnline, setNavigatorOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulatedOffline, setSimulatedOffline] = useState(api.isSimulatedOffline);

  useEffect(() => {
    const handleOnline = () => setNavigatorOnline(true);
    const handleOffline = () => setNavigatorOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleSimulatedOffline = useCallback((forceOffline?: boolean) => {
    setSimulatedOffline((prev) => {
      const next = typeof forceOffline === 'boolean' ? forceOffline : !prev;
      api.isSimulatedOffline = next;
      return next;
    });
  }, []);

  const isOnline = navigatorOnline && !simulatedOffline;

  return {
    isOnline,
    navigatorOnline,
    simulatedOffline,
    toggleSimulatedOffline
  };
}

