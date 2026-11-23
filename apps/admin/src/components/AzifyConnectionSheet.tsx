import { useState, useMemo, useEffect } from "react";
import {
  Store,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  RefreshCw,
  Globe2,
  Check,
  Plus,
  ArrowLeft,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { getDb, useTeams, type Team, type ShopifyConnection, type ShopifyCountryRoute } from "@ecomcod/shared";
import WariTrackLogo from "./WariTrackLogo";
import { formatFirebaseError } from "../lib/firebaseErrors";

export interface AzifyConnectPayload {
  storeId?: string;
  storeName?: string;
  slug?: string;
  shopDomain: string;
  customDomain?: string;
  myshopifyDomain?: string;
  domains?: string[];
  logoUrl?: string;
  verifyToken: string;
  accountEmail?: string;
  defaultCurrency?: string;
  allowedCountries?: string[];
  defaultCountry?: string;
  functionsBaseUrl?: string;
  callbackUrl?: string;
}

const COUNTRY_FLAGS: Record<string, string> = {
  TG: "🇹🇬 Togo",
  CI: "🇨🇮 Côte d'Ivoire",
  BJ: "🇧🇯 Bénin",
  SN: "🇸🇳 Sénégal",
  GN: "🇬🇳 Guinée",
  ML: "🇲🇱 Mali",
  CM: "🇨🇲 Cameroun",
  BF: "🇧🇫 Burkina Faso",
  NE: "🇳🇪 Niger",
  GA: "🇬🇦 Gabon",
  CD: "🇨🇩 RDC",
  CG: "🇨🇬 Congo",
};

function decodeAzifyPairingCode(raw: string): AzifyConnectPayload | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("AZIFY1:")) return null;
  try {
    const b64url = trimmed.slice("AZIFY1:".length);
    const pad = b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      bytes[i] = bin.charCodeAt(i);
    }
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as AzifyConnectPayload;
    if (!parsed || typeof parsed.shopDomain !== "string" || !parsed.verifyToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface AzifyConnectionSheetProps {
  workspaceId: string;
  userEmail: string | null;
  userName?: string | null;
  userPhoto?: string | null;
  initialPayload?: AzifyConnectPayload | null;
  onCompleted?: (assignedTeam: Team) => void;
  onCancel?: () => void;
  onSwitchAccount?: () => void;
  standalone?: boolean;
}

export default function AzifyConnectionSheet({
  workspaceId,
  userEmail,
  userName,
  userPhoto,
  initialPayload,
  onCompleted,
  onCancel,
  onSwitchAccount,
  standalone = false,
}: AzifyConnectionSheetProps) {
  const { teams, loading: loadingTeams } = useTeams(workspaceId);

  // Extraction du payload depuis l'URL si non fourni directement
  const detectedPayload = useMemo<AzifyConnectPayload | null>(() => {
    if (initialPayload) return initialPayload;

    try {
      const sp = new URLSearchParams(window.location.search);
      const rawCode = sp.get("code") || sp.get("pairingCode") || sp.get("azify");
      if (rawCode && rawCode.startsWith("AZIFY1:")) {
        const decoded = decodeAzifyPairingCode(rawCode);
        if (decoded) return decoded;
      }

      const domain = sp.get("shopDomain") || sp.get("shop_domain") || sp.get("domain") || sp.get("slug") || sp.get("store");
      if (domain) {
        return {
          storeName: sp.get("storeName") || sp.get("name") || domain,
          slug: sp.get("slug") || domain,
          shopDomain: domain,
          storeId: sp.get("storeId") || sp.get("id") || `azify_${Date.now()}`,
          defaultCurrency: sp.get("currency") || "XOF",
          defaultCountry: sp.get("country")?.toUpperCase() || "TG",
          logoUrl: sp.get("logoUrl") || sp.get("logo") || undefined,
          verifyToken: sp.get("token") || sp.get("verifyToken") || "azify_verify_auto",
          callbackUrl: sp.get("callbackUrl") || sp.get("origin") || undefined,
        };
      }
    } catch {}

    return null;
  }, [initialPayload]);

  // Formulaire d'édition manuelle si aucun paramètre dans l'URL
  const [storeNameInput, setStoreNameInput] = useState(detectedPayload?.storeName || "");
  const [shopDomainInput, setShopDomainInput] = useState(detectedPayload?.shopDomain || "");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTeam, setSuccessTeam] = useState<Team | null>(null);

  // Pré-sélection de l'équipe la plus pertinente (même pays que la boutique ou première équipe)
  useEffect(() => {
    if (teams.length === 0 || selectedTeamId) return;

    const detectedCountry = (detectedPayload?.defaultCountry || "TG").toUpperCase();
    const matchingTeam = teams.find((t) => (t.defaultCountry || "TG").toUpperCase() === detectedCountry);

    if (matchingTeam) {
      setSelectedTeamId(matchingTeam.id);
    } else if (teams.length > 0) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, detectedPayload, selectedTeamId]);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) || null,
    [teams, selectedTeamId]
  );

  const cleanDomain = useMemo(() => {
    const raw = (detectedPayload?.shopDomain || shopDomainInput || "").trim().toLowerCase();
    return raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }, [detectedPayload, shopDomainInput]);

  const effectiveStoreName = detectedPayload?.storeName || storeNameInput || cleanDomain || "Boutique Azify";

  const handleConnect = async () => {
    if (!cleanDomain) {
      setError("Veuillez renseigner le domaine ou le slug de votre boutique Azify.");
      return;
    }
    if (!selectedTeam) {
      setError("Veuillez sélectionner l'équipe WariTrack à laquelle rattacher cette boutique.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const db = getDb();
      const connId = cleanDomain.replace(/[^a-z0-9]/gi, "_");
      const ref = doc(db, "workspaces", workspaceId, "shopifyConnections", connId);
      const now = Date.now();

      const countryCode = (selectedTeam.defaultCountry || detectedPayload?.defaultCountry || "TG").toUpperCase();
      const routes: Record<string, ShopifyCountryRoute> = {
        [countryCode]: {
          countryCode,
          assignedTeamId: selectedTeam.id,
          assignedTeamName: selectedTeam.name,
          assignedAt: now,
          status: "active",
        },
      };

      const aliasDomains = Array.from(
        new Set(
          [
            cleanDomain,
            cleanDomain.replace(/^www\./, ""),
            detectedPayload?.customDomain || "",
            detectedPayload?.myshopifyDomain || "",
            ...(detectedPayload?.domains || []),
          ]
            .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
            .filter(Boolean)
        )
      );

      const docPayload: Partial<ShopifyConnection> = {
        id: connId,
        workspaceId,
        ownerTeamId: selectedTeam.id,
        ownerTeamName: selectedTeam.name,
        requestedTeamId: selectedTeam.id,
        requestedTeamName: selectedTeam.name,
        shopDomain: cleanDomain,
        shopName: effectiveStoreName,
        logoUrl: detectedPayload?.logoUrl || "",
        myshopifyDomain: detectedPayload?.myshopifyDomain || "",
        customDomain: detectedPayload?.customDomain || "",
        domains: aliasDomains,
        status: "pending_approval",
        connectedAt: now,
        requestedAt: now,
        countryRoutes: routes,
        verifyToken: detectedPayload?.verifyToken || "azify_verify_auto",
        sourcePlatform: "azify" as any,
        azifyStoreId: detectedPayload?.storeId || "",
        azifyStoreSlug: detectedPayload?.slug || cleanDomain,
        azifyAccountEmail: detectedPayload?.accountEmail || userEmail || "",
        azifyDefaultCurrency: selectedTeam.currency || detectedPayload?.defaultCurrency || "XOF",
        callbackUrl: detectedPayload?.callbackUrl || undefined,
      } as any;

      await setDoc(ref, docPayload, { merge: true });

      // Signal postMessage si ouvert via popup ou callback Azify
      if (window.opener) {
        try {
          window.opener.postMessage(
            {
              type: "AZIFY_WARITRACK_PENDING_APPROVAL",
              success: true,
              status: "pending_approval",
              teamId: selectedTeam.id,
              teamName: selectedTeam.name,
              countryCode,
              storeId: detectedPayload?.storeId,
              shopDomain: cleanDomain,
              workspaceId,
            },
            "*"
          );
        } catch {}
      }

      setSuccessTeam(selectedTeam);
      if (onCompleted) {
        onCompleted(selectedTeam);
      }
    } catch (err) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-8 select-none">
      <div className="w-full max-w-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header Logo & Titre */}
        <div className="mb-6 flex flex-col items-center text-center">
          <WariTrackLogo size="lg" variant="full" roundedBadge subtitle="LOGISTICS OS" />
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1 text-xs font-semibold text-brand-light">
            <Store className="h-3.5 w-3.5 text-brand" />
            <span>Passerelle Boutiques Azify & Routage Équipe</span>
          </div>
        </div>

        {/* Fiche de Connexion Principale */}
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 sm:p-7 shadow-2xl">
          {successTeam ? (
            /* ÉCRAN DE VALIDATION EN COURS */
            <div className="text-center py-4 animate-in fade-in duration-300">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <RefreshCw className="h-7 w-7 animate-spin text-amber-400" />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300 mb-2">
                <span>⏳ En cours de validation WariTrack</span>
              </span>
              <h2 className="text-xl font-bold text-slate-100">Demande envoyée avec succès !</h2>
              <p className="mt-2 text-sm text-slate-300">
                La boutique <span className="font-semibold text-white">« {effectiveStoreName} »</span> a demandé son rattachement à l&apos;équipe <span className="font-semibold text-brand-light">{successTeam.name}</span>.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Un popup de confirmation va automatiquement vous demander de valider la liaison dès votre entrée sur le poste de pilotage WariTrack.
              </p>

              <div className="mt-5 rounded-xl border border-surface-border bg-surface p-4 text-left space-y-2 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Équipe demandée :</span>
                  <span className="font-semibold text-slate-200">
                    {successTeam.name} ({COUNTRY_FLAGS[successTeam.defaultCountry] || successTeam.defaultCountry})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Devise locale :</span>
                  <span className="font-semibold text-slate-200 font-mono">{successTeam.currency || "XOF"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Statut :</span>
                  <span className="font-bold text-amber-400">En attente de confirmation admin</span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (standalone) {
                      window.location.href = "/";
                    } else if (onCancel) {
                      onCancel();
                    }
                  }}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:opacity-95 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-[0.99] cursor-pointer"
                >
                  <span>Accéder à WariTrack (Confirmer la boutique)</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                {window.opener && (
                  <button
                    type="button"
                    onClick={() => window.close()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-surface/80 transition-all cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                    <span>Fermer le popup (Retourner sur Azify Studio)</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* FICHE DE CONNEXION AVEC CHOIX D'ÉQUIPE */
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-brand" />
                  <span>Fiche de Connexion & Association d'Équipe</span>
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Validez la boutique Azify et désignez l'équipe WariTrack terrain qui recevra et traitera ses commandes.
                </p>
              </div>

              {/* 1. Identité Administrateur Google */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface p-3">
                <div className="flex items-center gap-3 min-w-0">
                  {userPhoto ? (
                    <img
                      src={userPhoto}
                      alt={userName || "Profil"}
                      className="h-10 w-10 rounded-xl object-cover border border-white/10"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20 border border-brand/30 text-brand">
                      <UserCheck className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-100">{userName || "Administrateur WariTrack"}</p>
                    <p className="truncate text-[11px] font-mono text-slate-400">{userEmail}</p>
                  </div>
                </div>

                {onSwitchAccount && (
                  <button
                    type="button"
                    onClick={onSwitchAccount}
                    className="shrink-0 text-[11px] text-sky-400 hover:text-sky-300 underline cursor-pointer"
                  >
                    Changer
                  </button>
                )}
              </div>

              {/* 2. Fiche Descriptive de la Boutique Azify */}
              <div className="rounded-xl border border-surface-border bg-surface p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                      <Store className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{effectiveStoreName}</h3>
                      <p className="text-[11px] font-mono text-slate-400">{cleanDomain || "Domaine à préciser"}</p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                    <Check className="h-3 w-3" />
                    <span>Azify Studio</span>
                  </span>
                </div>

                {!detectedPayload && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-surface-border">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Nom de la boutique</label>
                      <input
                        type="text"
                        value={storeNameInput}
                        onChange={(e) => setStoreNameInput(e.target.value)}
                        placeholder="Ex: Azishop Togo"
                        className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Domaine / Slug</label>
                      <input
                        type="text"
                        value={shopDomainInput}
                        onChange={(e) => setShopDomainInput(e.target.value)}
                        placeholder="Ex: azishop-togo.vercel.app"
                        className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. SÉLECTION DE L'ÉQUIPE EXISTANTE (Cœur de la demande utilisateur) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Globe2 className="h-3.5 w-3.5 text-brand" />
                    <span>Sélectionnez l'Équipe WariTrack à connecter :</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {teams.length} équipe(s) disponible(s)
                  </span>
                </div>

                {loadingTeams ? (
                  <div className="rounded-xl border border-surface-border bg-surface p-4 text-center text-xs text-slate-400">
                    Chargement des équipes existantes…
                  </div>
                ) : teams.length === 0 ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
                    <p className="font-semibold mb-1">Aucune équipe trouvée dans cet espace de travail.</p>
                    <p className="text-[11px] text-amber-200/80 mb-3">
                      Créez d'abord une équipe terrain (ex: Togo, Côte d'Ivoire) pour y router les commandes de cette boutique.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = "/?page=teams";
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Créer une Équipe</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {teams.map((t) => {
                      const isSelected = t.id === selectedTeamId;
                      const isRecommended =
                        detectedPayload?.defaultCountry &&
                        t.defaultCountry?.toUpperCase() === detectedPayload.defaultCountry.toUpperCase();

                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTeamId(t.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "border-brand bg-brand/10 shadow-sm"
                              : "border-surface-border bg-surface hover:bg-surface-raised"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-2xl select-none">
                              {t.defaultCountry === "TG"
                                ? "🇹🇬"
                                : t.defaultCountry === "CI"
                                ? "🇨🇮"
                                : t.defaultCountry === "BJ"
                                ? "🇧🇯"
                                : t.defaultCountry === "SN"
                                ? "🇸🇳"
                                : "🌍"}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-bold text-slate-100">{t.name}</p>
                                {isRecommended && (
                                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-indigo-300 border border-indigo-500/30">
                                    Recommandé
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400">
                                Pays : {t.defaultCountry} · Devise : {t.currency || "XOF"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                                isSelected
                                  ? "border-brand bg-brand text-white"
                                  : "border-slate-600 bg-transparent"
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. Règles & Réassurance COD Anti-Slop */}
              <div className="rounded-xl border border-surface-border bg-surface p-3.5 space-y-2 text-xs text-slate-400">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <p>
                    <span className="font-semibold text-slate-300">Étanchéité CAPI garantie :</span> Les conversions de cette
                    boutique seront isolées dans le pixel du marché {selectedTeam?.defaultCountry || "choisi"}.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <p>
                    <span className="font-semibold text-slate-300">Skill-Based Routing :</span> Les commandes en dialectes
                    locaux seront distribuées aux closeuses parlant ces langues au sein de cette équipe.
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 5. Bouton d'Action COD Large (>= 48px) */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={busy || !selectedTeam || !cleanDomain}
                  onClick={handleConnect}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:opacity-95 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {busy ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Rattachement et activation du routage…</span>
                    </>
                  ) : (
                    <>
                      <span>
                        Valider l'association à {selectedTeam ? `« ${selectedTeam.name} »` : "l'équipe"}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    Annuler et retourner au poste de pilotage
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
