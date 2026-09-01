import { useEffect, useState } from "react";
import { getFirebaseAuth, useAccessLinkAuth, ConnectionGuard } from "@ecomcod/shared";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

interface SessionClaims {
  workspaceId: string;
  teamId: string;
  role: string;
}

// L'URL attendue est du type /c/{accessLinkId} — le lien unique généré
// par l'admin (architecture section 11), rien d'autre à configurer.
function getAccessLinkIdFromUrl(): string | null {
  const match = window.location.pathname.match(/\/c\/([^/]+)/);
  return match ? match[1] : null;
}

export default function App() {
  const { firebaseUser, authLoading, verifySession } = useAccessLinkAuth();
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const accessLinkId = getAccessLinkIdFromUrl();

  useEffect(() => {
    if (!firebaseUser) {
      setClaims(null);
      return;
    }
    getFirebaseAuth()
      .currentUser?.getIdTokenResult()
      .then((result) => {
        setClaims({
          workspaceId: result.claims.workspaceId as string,
          teamId: result.claims.teamId as string,
          role: result.claims.role as string,
        });
      });
  }, [firebaseUser]);

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Chargement…</div>;
  }

  if (!accessLinkId && !firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-slate-500">
        Lien d'accès manquant ou invalide. Demande un nouveau lien à ton admin.
      </div>
    );
  }

  if (!firebaseUser || !claims) {
    return <Login accessLinkId={accessLinkId!} />;
  }

  if (claims.role !== "closeuse") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-slate-500">
        Ce lien n'est pas un accès closeuse.
      </div>
    );
  }

  return (
    <ConnectionGuard onReconnect={verifySession} appName="Closeuse">
      <Dashboard workspaceId={claims.workspaceId} teamId={claims.teamId} closeuseId={firebaseUser.uid} />
    </ConnectionGuard>
  );
}
