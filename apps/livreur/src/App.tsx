import { useEffect, useState } from "react";
import { getFirebaseAuth, useAccessLinkAuth, ConnectionGuard } from "@ecomcod/shared";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

interface SessionClaims {
  workspaceId: string;
  teamId: string;
  role: string;
}

function getAccessLinkId(): string | null {
  const match = window.location.pathname.match(/\/l\/([^/]+)/);
  if (match) {
    localStorage.setItem("ecomcod_last_access_link", match[1]);
    return match[1];
  }
  return localStorage.getItem("ecomcod_last_access_link");
}

function getStoredClaims(): SessionClaims | null {
  try {
    const raw = localStorage.getItem("ecomcod_session_claims");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const { firebaseUser, authLoading, verifySession } = useAccessLinkAuth();
  const [claims, setClaims] = useState<SessionClaims | null>(() => getStoredClaims());
  const accessLinkId = getAccessLinkId();

  useEffect(() => {
    if (!firebaseUser) {
      setClaims(null);
      localStorage.removeItem("ecomcod_session_claims");
      return;
    }
    // forceRefresh: false pour ne pas bloquer si la connexion mobile est coupée
    getFirebaseAuth()
      .currentUser?.getIdTokenResult(false)
      .then((result) => {
        if (result.claims.workspaceId && result.claims.role) {
          const newClaims = {
            workspaceId: result.claims.workspaceId as string,
            teamId: result.claims.teamId as string,
            role: result.claims.role as string,
          };
          setClaims(newClaims);
          localStorage.setItem("ecomcod_session_claims", JSON.stringify(newClaims));
        }
      })
      .catch((err) => {
        console.warn("getIdTokenResult hors-ligne ou erreur, repli sur le cache local :", err);
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

  if (claims.role !== "livreur") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-slate-500">
        Ce lien n'est pas un accès livreur.
      </div>
    );
  }

  return (
    <ConnectionGuard appName="Livreur">
      <Dashboard workspaceId={claims.workspaceId} teamId={claims.teamId} livreurId={firebaseUser.uid} />
    </ConnectionGuard>
  );
}
