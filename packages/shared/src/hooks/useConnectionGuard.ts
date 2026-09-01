import { useEffect, useState, useCallback, useRef } from 'react';

const PING_URL = 'https://www.gstatic.com/generate_204';
const PING_INTERVAL_MS = 15000;
const PING_TIMEOUT_MS = 5000;

export type ConnectionStatus = 'checking' | 'online' | 'offline';

/**
 * Surveille la connexion reseau reelle (pas seulement navigator.onLine).
 * Au retour de connexion, appelle onReconnect (revalidation de session)
 * avant de debloquer l'app -- empeche un acces revoque de continuer a
 * fonctionner offline puis de reprendre sans verification.
 */
export function useConnectionGuard(onReconnect?: () => Promise<boolean>): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const statusRef = useRef(status);
  statusRef.current = status;
  const verifyingRef = useRef(false);

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

      if (!reachable) {
        setStatus('offline');
        return;
      }

      if (statusRef.current !== 'online' && !verifyingRef.current) {
        verifyingRef.current = true;
        const sessionValid = onReconnect ? await onReconnect() : true;
        verifyingRef.current = false;
        if (!mounted) return;
        setStatus(sessionValid ? 'online' : 'offline');
      } else {
        setStatus('online');
      }
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
  }, [ping, onReconnect]);

  return status;
}
