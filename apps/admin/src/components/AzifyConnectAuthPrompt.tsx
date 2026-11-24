import { Store, ShieldCheck, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import WariTrackLogo from "./WariTrackLogo";

interface AzifyConnectAuthPromptProps {
  searchParams: URLSearchParams;
  signInWithGoogle: () => Promise<void>;
  busy?: boolean;
  error?: string | null;
}

export default function AzifyConnectAuthPrompt({
  searchParams,
  signInWithGoogle,
  busy = false,
  error = null,
}: AzifyConnectAuthPromptProps) {
  const storeName =
    searchParams.get("storeName") ||
    searchParams.get("name") ||
    searchParams.get("store") ||
    "Boutique Azify";
  const shopDomain =
    searchParams.get("shopDomain") ||
    searchParams.get("domain") ||
    searchParams.get("slug") ||
    "";
  const logoUrl = searchParams.get("logoUrl") || searchParams.get("logo") || "";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-8 select-none text-slate-100">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        {/* Header WariTrack */}
        <div className="mb-6 flex flex-col items-center text-center">
          <WariTrackLogo size="lg" variant="full" roundedBadge subtitle="LOGISTICS OS" />
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-light">
            <ShieldCheck className="h-3.5 w-3.5 text-brand" />
            <span>Passerelle d&apos;Authentification Azify Studio</span>
          </div>
        </div>

        {/* Fiche Centrale */}
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-xl space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-black text-slate-100">
              Connexion WariTrack OS
            </h2>
            <p className="text-xs text-slate-400">
              Associez votre compte WariTrack à votre boutique en 1 clic
            </p>
          </div>

          {/* Fiche Boutique Azify ciblée */}
          <div className="rounded-xl border border-surface-border bg-surface p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={storeName}
                  className="h-10 w-10 rounded-lg object-contain border border-surface-border bg-white/5 p-1 shrink-0"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/20 border border-brand/30 text-brand font-black text-sm shrink-0">
                  <Store className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="truncate text-xs font-bold text-slate-100">
                  {storeName}
                </h3>
                <p className="truncate font-mono text-[11px] text-slate-400">
                  {shopDomain || "Domaine boutique"}
                </p>
              </div>
            </div>

            <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              Azify Studio
            </span>
          </div>

          {/* Explication */}
          <div className="rounded-xl border border-slate-800 bg-surface/80 p-3 text-xs text-slate-300 leading-relaxed">
            <p>
              Connectez-vous avec votre compte Google administrateur WariTrack pour accéder directement à <strong>toutes vos équipes existantes</strong> et sélectionner celle qui prendra en charge les commandes de cette boutique.
            </p>
          </div>

          {/* Erreur éventuelle */}
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Bouton Google Auth min-h-[48px] */}
          <button
            type="button"
            disabled={busy}
            onClick={() => signInWithGoogle()}
            className="w-full min-h-[48px] inline-flex items-center justify-center gap-3 rounded-xl bg-white hover:bg-slate-100 active:scale-[0.99] text-slate-900 font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>
              {busy ? "Ouverture de la session Google..." : "Continuer avec Google"}
            </span>
          </button>

          {/* Note de réassurance */}
          <div className="pt-1 text-center">
            <span className="text-[11px] text-slate-500 font-mono">
              Sécurisé par Firebase Auth · meta-capi-app.firebaseapp.com
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
