import React from 'react';
import { useConnectionGuard } from '../hooks/useConnectionGuard';

interface ConnectionGuardProps {
  children: React.ReactNode;
  onReconnect?: () => Promise<boolean>;
  appName?: string;
}

export function ConnectionGuard({ children, onReconnect, appName }: ConnectionGuardProps) {
  const status = useConnectionGuard(onReconnect);

  if (status !== 'online') {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/95 text-center p-6">
        <div className="h-9 w-9 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin" />
        <p className="mt-4 font-semibold text-gray-800">
          {status === 'checking' ? 'Verification de la connexion...' : 'Connexion en cours...'}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {appName ? `${appName} sera disponible des que la connexion sera retablie.` : 'En attente du reseau.'}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}