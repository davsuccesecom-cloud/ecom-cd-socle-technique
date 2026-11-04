import { useCallback, useEffect, useState } from "react";
import { getFirebaseAuth, useAdminEmailAuth, ConnectionGuard } from "@ecomcod/shared";
import { getFunctions, httpsCallable } from "firebase/functions";
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

  const [claims, setClaims] = useState<SessionClaims | null>(() => {
    try {
      const cached = localStorage.getItem("waritrack_cached_workspace_claims");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.workspaceId) return parsed as SessionClaims;
      }
    } catch {}
    return null;
  });
  const [claimsLoading, setClaimsLoading] = useState(() => {
    try {
      return !localStorage.getItem("waritrack_cached_workspace_claims");
    } catch {
      return true;
    }
  });
  const [showSlowLoadingNotice, setShowSlowLoadingNotice] = useState(false);

  const handleLogout = useCallback(async () => {
    try {
      localStorage.removeItem("waritrack_cached_workspace_claims");
    } catch {}
    await logout();
  }, [logout]);

  useEffect(() => {
    let active = true;

    if (!firebaseUser) {
      setClaims(null);
      setClaimsLoading(false);
      try {
        localStorage.removeItem("waritrack_cached_workspace_claims");
      } catch {}
      return;
    }

    setClaimsLoading(true);

    async function resolveClaims() {
      try {
        // 1. Lecture directe depuis l'instance firebaseUser locale (quasi-instantané)
        let tokenResult = await firebaseUser!.getIdTokenResult();
        let wsId = tokenResult?.claims?.workspaceId as string | undefined;
        let role = tokenResult?.claims?.role as string | undefined;

        // 2. Si les claims sont encore absents, tentative rapide auprès du serveur Firebase Auth (max 2.5s)
        if (!wsId || !role) {
          try {
            tokenResult = await Promise.race([
              firebaseUser!.getIdTokenResult(true),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Timeout getIdTokenResult")), 2500)
              ),
            ]);
            wsId = tokenResult?.claims?.workspaceId as string | undefined;
            role = tokenResult?.claims?.role as string | undefined;
          } catch (refreshErr) {
            console.warn("Rafraîchissement forcé du token ignoré ou timeout :", refreshErr);
          }
        }

        // 3. Si toujours absents, appel direct de la Cloud Function authenticateAdmin pour récupérer le workspace lié
        if (!wsId || !role) {
          try {
            const functions = getFunctions();
            const authenticateAdmin = httpsCallable<{ workspaceName?: string }, { workspaceId: string; role?: string }>(
              functions,
              "authenticateAdmin"
            );
            const authRes = await Promise.race([
              authenticateAdmin({}),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Timeout authenticateAdmin")), 3500)
              ),
            ]);
            if (authRes.data?.workspaceId) {
              wsId = authRes.data.workspaceId;
              role = authRes.data.role || "admin";
              // Rafraîchissement en tâche de fond pour les prochaines requêtes
              firebaseUser!.getIdTokenResult(true).catch(() => {});
            }
          } catch (callErr) {
            console.warn("Tentative d'auto-rattachement authenticateAdmin :", callErr);
          }
        }

        // 4. Si le réseau est récalcitrant, repli sur le cache local sécurisé
        if (!wsId) {
          try {
            const cached = localStorage.getItem("waritrack_cached_workspace_claims");
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed?.workspaceId) {
                wsId = parsed.workspaceId;
                role = parsed.role || "admin";
              }
            }
          } catch {}
        }

        if (active) {
          if (wsId) {
            const resolvedClaims: SessionClaims = {
              workspaceId: wsId,
              role: role || "admin",
            };
            setClaims(resolvedClaims);
            try {
              localStorage.setItem("waritrack_cached_workspace_claims", JSON.stringify(resolvedClaims));
            } catch {}
          } else {
            setClaims(null);
            try {
              localStorage.removeItem("waritrack_cached_workspace_claims");
            } catch {}
          }
        }
      } catch (err) {
        console.error("Erreur lors de la résolution des droits admin :", err);
        if (active) {
          // Repli sur le cache avant d'abandonner
          try {
            const cached = localStorage.getItem("waritrack_cached_workspace_claims");
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed?.workspaceId) {
                setClaims(parsed as SessionClaims);
                return;
              }
            }
          } catch {}
          setClaims(null);
        }
      } finally {
        // Déblocage garanti de l'écran quoi qu'il arrive
        if (active) {
          setClaimsLoading(false);
        }
      }
    }

    resolveClaims();

    // Filet de sécurité absolu : empêche tout blocage infini du loader après 4 secondes
    const hardTimeout = setTimeout(() => {
      if (active) {
        setClaimsLoading(false);
      }
    }, 4000);

    return () => {
      active = false;
      clearTimeout(hardTimeout);
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

  // Si l'utilisateur est connecté et possède un espace de travail, on affiche le tableau de bord
  if (
    firebaseUser &&
    claims?.workspaceId &&
    (claims.role === "admin" || !claims.role || claims.role === "owner")
  ) {
    return (
      <ConnectionGuard appName="Admin">
        <Dashboard
          workspaceId={claims.workspaceId}
          onLogout={handleLogout}
          userEmail={firebaseUser.email}
          adminId={firebaseUser.uid}
        />
      </ConnectionGuard>
    );
  }

  // Si l'utilisateur a créé un compte et doit nommer son workspace (ou aucun workspace lié à cet email)
  if (firebaseUser && (needsWorkspaceName || !claims?.workspaceId) && !claimsLoading && !authLoading) {
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
