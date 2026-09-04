import { useEffect, useState, useCallback } from 'react';

const PING_URL = 'https://www.gstatic.com/generate_204';
const PING_INTERVAL_MS = 15000;
const PING_TIMEOUT_MS = 5000;

export type ConnectionStatus = 'online' | 'offline';

/**
 * Surveille la connexion reseau reelle (pas seulement navigator.onLine).
 * Purement visuel : bloque l'affichage pendant une coupure, le redonne
 * des que le reseau revient -- aucune revalidation de session, aucune
 * deconnexion forcee. Sert uniquement a empecher qu'une app reste
 * utilisable hors-ligne pendant un acces revoque, sans jamais perturber
 * une session valide.
 */
export function useConnectionGuard(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('online');

  const ping = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) return false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      await fetch(PING_URL, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
      clearTimeout(timeout);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const reachable = await ping();
      if (!mounted) return;
      setStatus(reachable ? 'online' : 'offline');
    };

    check();
    const interval = setInterval(check, PING_INTERVAL_MS);
    const handleOffline = () => mounted && setStatus('offline');
    window.addEventListener('online', check);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('online', check);
      window.removeEventListener('offline', handleOffline);
    };
  }, [ping]);

  return status;
}
