import { useCallback, useEffect, useState } from "react";
import { getFirebaseAuth, useAdminEmailAuth, ConnectionGuard } from "@ecomcod/shared";
import { useTheme } from "./hooks/useTheme";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import MetaOAuthBridgePage from "./pages/MetaOAuthBridgePage";
import LegalPrivacyModal, { type LegalTab } from "./components/LegalPrivacyModal";

interface SessionClaims {
  workspaceId: string;
  role: string;
}

export default function App() {
  // Applique le plus tôt possible dans le cycle de vie de l'app, avant
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
        console.log("DEBUG claims recus :", result.claims, "busy:", busy);
        setClaims({
          workspaceId: result.claims.workspaceId as string,
          role: result.claims.role as string,
        });
        setClaimsLoading(false);
      });
  }, [firebaseUser, needsWorkspaceName, busy]);

  // Revalidation au retour de connexion reseau : force le rafraichissement
  // du token Firebase. Si le compte a ete desactive/supprime entre-temps
  // (par exemple depuis un autre appareil), Firebase renvoie une erreur
  // et on deconnecte immediatement plutot que de laisser une session admin
  // hors-ligne reprendre la main sans verification.
  const verifyAdminSession = useCallback(async (): Promise<boolean> => {
    const user = getFirebaseAuth().currentUser;
    if (!user) return true;
    try {
      await user.getIdTokenResult(true);
      return true;
    } catch (err: any) {
      console.warn("Revalidation session admin echouee :", err);
      if (
        err?.code === "auth/user-disabled" ||
        err?.code === "auth/user-token-expired" ||
        err?.code === "auth/invalid-user-token"
      ) {
        await logout();
        return false;
      }
      // Erreur technique/reseau : non concluant mais pas bloquant.
      return true;
    }
  }, [logout]);

  const searchParams = new URLSearchParams(window.location.search);
  const metaBridgeParam = searchParams.get("metaBridge");
  if (metaBridgeParam) {
    return <MetaOAuthBridgePage bridgeParam={metaBridgeParam} />;
  }

  const legalParam = searchParams.get("legal") as LegalTab | null;
  const pathname = window.location.pathname.toLowerCase();
  if (
    legalParam ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/data-deletion"
  ) {
    const initialTab: LegalTab =
      legalParam === "terms" || pathname === "/terms"
        ? "terms"
        : legalParam === "deletion" || pathname === "/data-deletion"
        ? "deletion"
        : legalParam === "security"
        ? "security"
        : "privacy";
    return (
      <LegalPrivacyModal
        standalone
        initialTab={initialTab}
        onClose={() => {
          window.location.href = "/";
        }}
      />
    );
  }

  const isLandingRequested =
    searchParams.get("landing") === "1" ||
    pathname === "/landing" ||
    pathname === "/vitrine" ||
    pathname === "/home";

  if (isLandingRequested) {
    return (
      <LandingPage
        sendLoginLink={sendLoginLink}
        createWorkspace={createWorkspace}
        needsWorkspaceName={needsWorkspaceName}
        linkSent={linkSent}
        busy={busy}
        error={error}
        isAuthenticatedPreview={Boolean(firebaseUser && claims?.workspaceId)}
        onBackToDashboard={() => {
          window.location.href = "/";
        }}
      />
    );
  }

  // Si l'utilisateur est connecté et ses droits admin sont validés, on affiche le tableau de bord
  if (firebaseUser && claims?.workspaceId && claims.role === "admin") {
    return (
      <ConnectionGuard appName="Admin">
        <Dashboard
          workspaceId={claims.workspaceId}
          onLogout={logout}
          userEmail={firebaseUser.email}
          adminId={firebaseUser.uid}
        />
      </ConnectionGuard>
    );
  }

  // Si l'utilisateur a créé un compte et doit nommer son workspace
  if (firebaseUser && needsWorkspaceName) {
    return (
      <LandingPage
        sendLoginLink={sendLoginLink}
        createWorkspace={createWorkspace}
        needsWorkspaceName={true}
        linkSent={linkSent}
        busy={busy}
        error={error}
      />
    );
  }

  // Si l'utilisateur est connecté mais ses claims sont en cours de chargement
  if (firebaseUser && claimsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-slate-500">
        Chargement de l'espace...
      </div>
    );
  }

  // Par défaut pour tout visiteur non connecté : Affichage INSTANTANÉ de la Landing Page 3D
  // Zéro écran noir, zéro blocage "Chargement..."
  return (
    <LandingPage
      sendLoginLink={sendLoginLink}
      createWorkspace={createWorkspace}
      needsWorkspaceName={needsWorkspaceName}
      linkSent={linkSent}
      busy={busy}
      error={error}
      isAuthenticatedPreview={Boolean(firebaseUser && claims?.workspaceId)}
      onBackToDashboard={() => {
        window.location.href = "/";
      }}
    />
  );
}
