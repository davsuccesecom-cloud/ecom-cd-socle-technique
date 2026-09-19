import { useState, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { Team, MetaCapiConfig } from "@ecomcod/shared";

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

const FB_APP_ID = "27919549707704174";

interface MetaCapiConnectorProps {
  workspaceId: string;
  team: Team;
  onConfigSaved?: (newConfig: MetaCapiConfig) => void;
}

interface MetaPixel {
  id: string;
  name: string;
}

interface MetaAdAccount {
  id: string;
  accountId: string;
  name: string;
  currency?: string;
  business?: { id: string; name: string };
  pixels: MetaPixel[];
}

export default function MetaCapiConnector({ workspaceId, team, onConfigSaved }: MetaCapiConnectorProps) {
  const [fbSdkLoaded, setFbSdkLoaded] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [fbUser, setFbUser] = useState<{ id: string; name: string; picture?: string } | null>(null);
  const [adAccounts, setAdAccounts] = useState<MetaAdAccount[]>([]);
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);

  // Selection state
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string>("");
  const [selectedPixelId, setSelectedPixelId] = useState<string>("");
  const [currency, setCurrency] = useState(team.metaCapiConfig?.currency || "XOF");
  const [testCode, setTestCode] = useState(team.metaCapiConfig?.testEventCode || "");

  // Status
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  // Manual fallback state
  const [manualPixelId, setManualPixelId] = useState(team.metaCapiConfig?.pixelId || "");
  const [manualToken, setManualToken] = useState(team.metaCapiConfig?.accessToken || "");

  // Load Facebook JS SDK dynamically
  useEffect(() => {
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
  }, []);

  // Update pixels list when selected ad account changes
  const currentAdAccount = adAccounts.find((a) => a.id === selectedAdAccountId);
  const availablePixels = currentAdAccount?.pixels || [];

  const handleFbLogin = () => {
    setError(null);
    setSuccessMsg(null);
    if (!window.FB) {
      setError("Le module Facebook est en cours de chargement. Veuillez patienter 2 secondes et réessayer.");
      return;
    }

    setLoggingIn(true);
    try {
      window.FB.login(
        async (response: any) => {
          if (response.authResponse && response.authResponse.accessToken) {
            const token = response.authResponse.accessToken;
            setUserToken(token);
            try {
              const functions = getFunctions();
              const fetchFn = httpsCallable(functions, "getMetaAccountsAndPixels");
              const res = (await fetchFn({ userAccessToken: token })) as {
                data: {
                  user: { id: string; name: string; picture?: string };
                  businesses: { id: string; name: string }[];
                  adAccounts: MetaAdAccount[];
                };
              };

              const data = res.data;
              setFbUser(data.user);
              setBusinesses(data.businesses || []);
              setAdAccounts(data.adAccounts || []);

              // Auto-select first ad account & pixel if available
              if (data.adAccounts && data.adAccounts.length > 0) {
                const firstAcc = data.adAccounts[0];
                setSelectedAdAccountId(firstAcc.id);
                if (firstAcc.currency) setCurrency(firstAcc.currency);
                if (firstAcc.pixels && firstAcc.pixels.length > 0) {
                  setSelectedPixelId(firstAcc.pixels[0].id);
                }
              }
            } catch (err: any) {
              setError(err?.message || "Impossible de récupérer les comptes Meta.");
            } finally {
              setLoggingIn(false);
            }
          } else {
            setLoggingIn(false);
            if (response.status !== "unknown") {
              setError("Connexion Facebook annulée ou non autorisée.");
            }
          }
        },
        {
          scope: "ads_read,ads_management,business_management",
          return_scopes: true,
        }
      );
    } catch (err: any) {
      setLoggingIn(false);
      setError(err?.message || "Erreur ouverture popup Facebook.");
    }
  };

  const handleConnectSystemUser = async () => {
    if (!selectedAdAccountId || !selectedPixelId || !userToken) {
      setError("Veuillez sélectionner un compte publicitaire et un pixel.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const chosenAccount = adAccounts.find((a) => a.id === selectedAdAccountId);
    const chosenPixel = chosenAccount?.pixels.find((p) => p.id === selectedPixelId);
    const biz = chosenAccount?.business || (businesses.length > 0 ? businesses[0] : undefined);

    try {
      const functions = getFunctions();
      const connectFn = httpsCallable(functions, "connectMetaSystemUser");
      const res = (await connectFn({
        teamId: team.id,
        userAccessToken: userToken,
        businessId: biz?.id,
        businessName: biz?.name,
        adAccountId: selectedAdAccountId,
        adAccountName: chosenAccount?.name,
        pixelId: selectedPixelId,
        pixelName: chosenPixel?.name,
        currency,
        connectedUserName: fbUser?.name,
      })) as { data: { success: boolean; isSystemUser: boolean; message: string; metaCapiConfig: MetaCapiConfig } };

      setSuccessMsg(res.data.message || "✓ Pixel Meta connecté avec succès !");
      if (onConfigSaved && res.data.metaCapiConfig) {
        onConfigSaved(res.data.metaCapiConfig);
      }
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la configuration automatique Meta.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const pId = team.metaCapiConfig?.pixelId || manualPixelId;
    const token = team.metaCapiConfig?.accessToken || manualToken;
    if (!pId || !token) {
      setTestResult({ success: false, message: "Aucun pixel ou token configuré à tester." });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const functions = getFunctions();
      const testFn = httpsCallable(functions, "testMetaCapiConnection");
      await testFn({
        pixelId: pId.trim(),
        accessToken: token.trim(),
        testEventCode: testCode.trim() || undefined,
      });
      setTestResult({ success: true, message: "✓ Parfait ! Événement de test reçu par Meta avec succès." });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || "Échec test Meta CAPI. Vérifie que le Pixel et le Token sont valides.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Voulez-vous vraiment déconnecter le Pixel Meta pour cette équipe ?")) return;
    setSaving(true);
    try {
      const functions = getFunctions();
      const disconnFn = httpsCallable(functions, "disconnectMetaCapi");
      await disconnFn({ teamId: team.id });
      setUserToken(null);
      setFbUser(null);
      setSuccessMsg("Meta CAPI déconnecté.");
      if (onConfigSaved) {
        onConfigSaved({
          enabled: false,
          pixelId: "",
          accessToken: "",
        });
      }
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la déconnexion.");
    } finally {
      setSaving(false);
    }
  };

  const isAlreadyConfigured = Boolean(team.metaCapiConfig?.enabled && team.metaCapiConfig?.pixelId);

  return (
    <div className="space-y-4 rounded-xl border border-surface-border bg-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <h4 className="text-sm font-semibold text-slate-200">Meta Conversions API (CAPI) Automatique</h4>
            {isAlreadyConfigured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Actif
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Envoie automatiquement les événements d'achat (Purchase) à Meta lors de la livraison réelle pour optimiser vos pubs Facebook/Instagram.
          </p>
        </div>
      </div>

      {/* ÉTAT 1 : Déjà connecté et actif */}
      {isAlreadyConfigured && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-300">
                Pixel connecté : {team.metaCapiConfig?.pixelName || team.metaCapiConfig?.pixelId}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                ID : {team.metaCapiConfig?.pixelId} {team.metaCapiConfig?.adAccountName ? `• Compte : ${team.metaCapiConfig?.adAccountName}` : ""}
              </p>
            </div>
            <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-mono text-slate-300 border border-slate-700">
              {team.metaCapiConfig?.isSystemUser ? "Jeton permanent (Bot)" : "Jeton 60j"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={testing}
              onClick={handleTestConnection}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-600/30 disabled:opacity-50 transition-colors"
            >
              {testing ? "Test en cours..." : "🧪 Tester l'événement Meta"}
            </button>

            <button
              type="button"
              onClick={() => {
                setUserToken(null);
                setFbUser(null);
                handleFbLogin();
              }}
              className="rounded-lg border border-surface-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Changer de Pixel
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleDisconnect}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
            >
              Désactiver
            </button>
          </div>
        </div>
      )}

      {/* ÉTAT 2 : Formulaire de connexion automatique */}
      {!isAlreadyConfigured && !fbUser && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 text-center space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <div>
            <h5 className="text-sm font-medium text-slate-100">Connexion Meta en 1 clic</h5>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Connectez votre compte Facebook pour sélectionner votre compte publicitaire et votre Pixel. Le robot configurera un jeton permanent sans copier-coller.
            </p>
          </div>

          <button
            type="button"
            disabled={loggingIn}
            onClick={handleFbLogin}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            {loggingIn ? "Connexion Facebook en cours..." : "Se connecter avec Facebook"}
          </button>
        </div>
      )}

      {/* ÉTAT 3 : Connecté à Facebook, sélection du Compte et du Pixel */}
      {fbUser && (
        <div className="space-y-4 rounded-xl border border-surface-border bg-surface-raised p-4">
          <div className="flex items-center justify-between border-b border-surface-border pb-3">
            <div className="flex items-center gap-2.5">
              {fbUser.picture && (
                <img src={fbUser.picture} alt="" className="h-8 w-8 rounded-full border border-surface-border" />
              )}
              <div>
                <p className="text-xs font-semibold text-slate-100">{fbUser.name}</p>
                <p className="text-[10px] text-emerald-400">✓ Authentifié Facebook</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFbUser(null);
                setUserToken(null);
              }}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Changer de compte
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                1. Compte Publicitaire ({adAccounts.length} trouvé{adAccounts.length > 1 ? "s" : ""})
              </label>
              {adAccounts.length === 0 ? (
                <p className="text-xs text-amber-400">Aucun compte publicitaire trouvé avec ce profil Facebook.</p>
              ) : (
                <select
                  value={selectedAdAccountId}
                  onChange={(e) => {
                    const accId = e.target.value;
                    setSelectedAdAccountId(accId);
                    const acc = adAccounts.find((a) => a.id === accId);
                    if (acc?.currency) setCurrency(acc.currency);
                    if (acc?.pixels && acc.pixels.length > 0) {
                      setSelectedPixelId(acc.pixels[0].id);
                    } else {
                      setSelectedPixelId("");
                    }
                  }}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
                >
                  {adAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.accountId}) {acc.business ? `• ${acc.business.name}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                2. Pixel Meta ({availablePixels.length} disponible{availablePixels.length > 1 ? "s" : ""})
              </label>
              {availablePixels.length === 0 ? (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-300">
                  Aucun Pixel détecté directement sur ce compte pub. Vous pouvez saisir manuellement l'ID du Pixel ci-dessous.
                  <input
                    type="text"
                    placeholder="ex: 123456789012345"
                    value={selectedPixelId}
                    onChange={(e) => setSelectedPixelId(e.target.value)}
                    className="mt-2 w-full rounded-md border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-brand"
                  />
                </div>
              ) : (
                <select
                  value={selectedPixelId}
                  onChange={(e) => setSelectedPixelId(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
                >
                  {availablePixels.map((pix) => (
                    <option key={pix.id} value={pix.id}>
                      {pix.name} (ID: {pix.id})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Devise</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="XOF"
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 uppercase outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Code de test (optionnel)</label>
                <input
                  type="text"
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value)}
                  placeholder="ex: TEST12345"
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={saving || !selectedAdAccountId || !selectedPixelId}
              onClick={handleConnectSystemUser}
              className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/20 disabled:opacity-50 transition-all"
            >
              {saving ? "Création du jeton permanent en cours..." : "🚀 Activer et lier ce Pixel automatiquement"}
            </button>
          </div>
        </div>
      )}

      {/* Messages d'erreur et succès */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          ⚠️ {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
          {successMsg}
        </div>
      )}

      {testResult && (
        <div
          className={`rounded-lg border p-3 text-xs ${
            testResult.success
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {testResult.message}
        </div>
      )}

      {/* Accordéon Mode Manuel (Avancé) */}
      <div className="border-t border-surface-border pt-3">
        <button
          type="button"
          onClick={() => setShowManual(!showManual)}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
        >
          <span>{showManual ? "▾" : "▸"}</span>
          <span>Configuration manuelle (avancée)</span>
        </button>

        {showManual && (
          <div className="mt-3 space-y-3 rounded-lg border border-surface-border bg-surface p-3 text-xs">
            <div>
              <label className="mb-1 block text-slate-400">Meta Pixel ID</label>
              <input
                type="text"
                placeholder="123456789012345"
                value={manualPixelId}
                onChange={(e) => setManualPixelId(e.target.value)}
                className="w-full rounded-md border border-surface-border bg-surface-raised px-2.5 py-1.5 text-slate-100 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">Jeton d'accès (EAAG...)</label>
              <input
                type="password"
                placeholder="EAAG..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="w-full rounded-md border border-surface-border bg-surface-raised px-2.5 py-1.5 font-mono text-slate-100 outline-none"
              />
            </div>
            <button
              type="button"
              disabled={testing || !manualPixelId || !manualToken}
              onClick={handleTestConnection}
              className="w-full rounded-md border border-surface-border py-1.5 text-xs text-slate-200 hover:bg-surface-raised"
            >
              🧪 Tester la connexion manuelle
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
