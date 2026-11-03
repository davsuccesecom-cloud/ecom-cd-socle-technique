import { useCallback, useEffect, useState } from "react";
import { getFirebaseAuth, useAdminEmailAuth, ConnectionGuard } from "@ecomcod/shared";
import { useTheme } from "./hooks/useTheme";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import MetaOAuthBridgePage from "./pages/MetaOAuthBridgePage";
import LegalPrivacyModal, { type LegalTab } from "./components/LegalPrivacyModal";
import WariTrackLogo from "./components/WariTrackLogo";

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
    signInWithGoogle,
    signInWithFacebook,
    createWorkspace,
    logout,
    error,
  } = useAdminEmailAuth();

  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [showSlowLoadingNotice, setShowSlowLoadingNotice] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    if (!firebaseUser) {
      setClaims(null);
      setClaimsLoading(false);
      return;
    }

    setClaimsLoading(true);

    async function resolveClaims() {
      try {
        // 1. Lecture directe depuis l'instance firebaseUser (garantie non-nulle)
        let tokenResult = await firebaseUser!.getIdTokenResult();
        let wsId = tokenResult?.claims?.workspaceId as string | undefined;
        let role = tokenResult?.claims?.role as string | undefined;

        // 2. Si les claims sont encore absents (ex: premier jet après provision ou reload immédiat),
        // on force un rafraîchissement auprès des serveurs Firebase Auth
        if (!wsId || !role) {
          try {
            tokenResult = await firebaseUser!.getIdTokenResult(true);
            wsId = tokenResult?.claims?.workspaceId as string | undefined;
            role = tokenResult?.claims?.role as string | undefined;
          } catch (refreshErr) {
            console.warn("Échec du rafraîchissement forcé du token Firebase :", refreshErr);
          }
        }

        if (isCancelled) return;

        if (wsId && role) {
          setClaims({
            workspaceId: wsId,
            role,
          });
        } else {
          setClaims(null);
        }
      } catch (err) {
        console.error("Erreur lors de la résolution des droits admin :", err);
        if (!isCancelled) {
          setClaims(null);
        }
      } finally {
        if (!isCancelled) {
          setClaimsLoading(false);
        }
      }
    }

    resolveClaims();

    return () => {
      isCancelled = true;
    };
  }, [firebaseUser, needsWorkspaceName, busy]);

  // Alerte douce si la synchronisation réseau met plus de 4 secondes
  useEffect(() => {
    if (!authLoading && !(firebaseUser && claimsLoading)) {
      setShowSlowLoadingNotice(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowSlowLoadingNotice(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [authLoading, firebaseUser, claimsLoading]);

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
        signInWithGoogle={signInWithGoogle}
        signInWithFacebook={signInWithFacebook}
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
        signInWithGoogle={signInWithGoogle}
        signInWithFacebook={signInWithFacebook}
        createWorkspace={createWorkspace}
        needsWorkspaceName={true}
        linkSent={linkSent}
        busy={busy}
        error={error}
      />
    );
  }

  // État de chargement initial fluide : évite tout flash de la landing page lors d'une actualisation F5
  if (authLoading || (firebaseUser && claimsLoading)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 select-none">
        <div className="relative flex flex-col items-center animate-in fade-in duration-300">
          <div className="relative mb-6 flex items-center justify-center">
            <div className="absolute -inset-4 rounded-3xl bg-brand/10 blur-xl animate-pulse" />
            <WariTrackLogo size="lg" variant="full" roundedBadge subtitle="LOGISTICS OS" />
          </div>

          <div className="flex items-center gap-2.5 rounded-full border border-surface-border bg-surface-raised px-4 py-2 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
            </span>
            <span className="text-xs font-semibold text-slate-300">
              Synchronisation du poste de pilotage…
            </span>
          </div>

          {showSlowLoadingNotice && (
            <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in duration-300">
              <p className="text-xs text-slate-400">La synchronisation réseau tarde un peu</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-surface-raised border border-surface-border px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white hover:border-slate-500 transition shadow"
              >
                Actualiser la connexion
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Par défaut pour tout visiteur non connecté : Affichage INSTANTANÉ de la Landing Page 3D
  // Zéro écran noir, zéro blocage "Chargement..."
  return (
    <LandingPage
      sendLoginLink={sendLoginLink}
      signInWithGoogle={signInWithGoogle}
      signInWithFacebook={signInWithFacebook}
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
