import { useEffect, useState } from "react";
import { getFirebaseAuth, useAdminEmailAuth } from "@ecomcod/shared";
import { useTheme } from "./hooks/useTheme";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

interface SessionClaims {
  workspaceId: string;
  role: string;
}

export default function App() {
  // Appliqué le plus tôt possible dans le cycle de vie de l'app, avant
  // même de savoir sur quelle page on atterrit — évite un flash visible du
  // mauvais thème au chargement si "clair" était déjà choisi.
  useTheme();

  const {
    firebaseUser,
    authLoading,
    busy,
    linkSent,
    needsWorkspaceName,
    sendLoginLink,
    createWorkspace,
    logout,
    error,
  } = useAdminEmailAuth();
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [claimsLoading, setClaimsLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) {
      setClaims(null);
      setClaimsLoading(false);
      return;
    }
    setClaimsLoading(true);
    getFirebaseAuth()
      .currentUser?.getIdTokenResult()
      .then((result) => {
        setClaims({
          workspaceId: result.claims.workspaceId as string,
          role: result.claims.role as string,
        });
        setClaimsLoading(false);
      });
  }, [firebaseUser, needsWorkspaceName]);

  if (authLoading || (firebaseUser && claimsLoading && !needsWorkspaceName)) {
    return <div className="flex min-h-screen items-center justify-center bg-surface text-slate-500">Chargement…</div>;
  }

  if (!firebaseUser || !claims?.workspaceId) {
    return (
      <Login
        sendLoginLink={sendLoginLink}
        createWorkspace={createWorkspace}
        needsWorkspaceName={needsWorkspaceName}
        linkSent={linkSent}
        busy={busy}
        error={error}
      />
    );
  }

  if (claims.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6 text-center text-slate-500">
        Ce compte n'est pas un accès admin.
      </div>
    );
  }

  return <Dashboard workspaceId={claims.workspaceId} onLogout={logout} userEmail={firebaseUser.email} />;
}
