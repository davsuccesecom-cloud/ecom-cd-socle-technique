import { useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

const FB_APP_ID = "27919549707704174";

interface MetaOAuthBridgePageProps {
  bridgeParam: string;
}

export default function MetaOAuthBridgePage({ bridgeParam }: MetaOAuthBridgePageProps) {
  const parts = bridgeParam.split(":");
  const workspaceId = parts[0] || "";
  const sessionId = parts[1] || "";
  const secret = parts[2] || "";

  const [fbSdkLoaded, setFbSdkLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneData, setDoneData] = useState<{
    teamName: string;
    fbUserName: string;
    adAccountsCount: number;
  } | null>(null);

  useEffect(() => {
    if (!workspaceId || !sessionId || !secret) {
      setError("Lien de connexion incomplet ou invalide.");
      return;
    }

    if (window.FB) {
      setFbSdkLoaded(true);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: FB_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v19.0",
      });
      setFbSdkLoaded(true);
    };

    const id = "facebook-jssdk";
    if (!document.getElementById(id)) {
      const js = document.createElement("script");
      js.id = id;
      js.src = "https://connect.facebook.net/fr_FR/sdk.js";
      js.async = true;
      js.defer = true;
      document.body.appendChild(js);
    }
  }, [workspaceId, sessionId, secret]);

  const startFacebookAuth = (forceReauth = false) => {
    setError(null);
    if (!window.FB) {
      setError("Le module Facebook charge encore. Patientez 2 secondes puis réessayez.");
      return;
    }

    setBusy(true);
    try {
      const onLoginResponse = (response: any) => {
        void (async () => {
          if (response?.authResponse?.accessToken) {
            try {
              const fn = httpsCallable(getFunctions(), "completeMetaOAuthBridgeSession");
              const res = (await fn({
                workspaceId,
                sessionId,
                secret,
                userAccessToken: response.authResponse.accessToken,
              })) as {
                data: {
                  success: boolean;
                  teamName: string;
                  fbUserName: string;
                  adAccountsCount: number;
                };
              };
              setDoneData(res.data);
            } catch (err: any) {
              setError(
                err?.message ||
                  "Ce lien a expiré ou a déjà été utilisé. Générez un nouveau lien depuis votre application."
              );
            } finally {
              setBusy(false);
            }
          } else {
            setBusy(false);
            if (response?.status !== "unknown") {
              setError("Autorisation Facebook annulée.");
            }
          }
        })();
      };

      const options: Record<string, any> = {
        scope: "ads_read,ads_management,business_management",
        return_scopes: true,
      };
      if (forceReauth) {
        options.auth_type = "reauthenticate";
      }

      window.FB.login(onLoginResponse, options);
    } catch (err: any) {
      setBusy(false);
      setError(err?.message || "Impossible d'ouvrir la fenêtre Facebook.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3 border-b border-surface-border pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand/15 text-brand">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100">
              Passerelle Sécurisée Meta CAPI
            </h1>
            <p className="text-xs text-slate-400">
              Connexion externe (Incognito / Autre navigateur) vers votre PWA Ecom COD
            </p>
          </div>
        </div>

        {doneData ? (
          <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-emerald-300">
                Accès Facebook transmis avec succès !
              </h2>
              <p className="text-xs text-slate-200">
                Profil : <strong>{doneData.fbUserName}</strong> ({doneData.adAccountsCount} compte
                {doneData.adAccountsCount > 1 ? "s" : ""} publicitaire
                {doneData.adAccountsCount > 1 ? "s" : ""} détecté
                {doneData.adAccountsCount > 1 ? "s" : ""})
              </p>
            </div>
            <p className="rounded-lg border border-surface-border bg-surface p-3 text-xs leading-relaxed text-slate-300">
              Retournez maintenant sur votre application principale <strong>Ecom COD (PWA)</strong> :
              le sélecteur de <strong>Compte Publicitaire & Pixel</strong> s'y est ouvert automatiquement.
              Vous pouvez fermer cet onglet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-slate-300">
              Connectez le compte Facebook présent dans ce navigateur. Seule la liste de vos comptes
              publicitaires et Pixels sera renvoyée de manière chiffrée vers votre PWA principale
              pour que vous puissiez choisir votre Pixel.
            </p>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                disabled={busy || !fbSdkLoaded}
                onClick={() => startFacebookAuth(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 disabled:opacity-50"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                {busy ? "Connexion à Facebook en cours…" : "Continuer avec Facebook"}
              </button>

              <button
                type="button"
                disabled={busy || !fbSdkLoaded}
                onClick={() => startFacebookAuth(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-xs font-medium text-slate-300 transition hover:border-brand/40 hover:text-slate-100 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Forcer la saisie d'un autre compte Facebook
              </button>
            </div>

            <p className="text-center text-[11px] text-slate-500">
              Lien à usage unique • Expire automatiquement après 15 minutes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
