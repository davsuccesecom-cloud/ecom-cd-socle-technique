import { useState } from "react";
import { CheckCircle2, ArrowRight, RefreshCw, ShieldCheck, UserCheck } from "lucide-react";
import WariTrackLogo from "./WariTrackLogo";

interface GoogleAccountConfirmationProps {
  userEmail: string | null;
  userName?: string | null;
  userPhoto?: string | null;
  workspaceId: string;
  role: string;
  onConfirm: () => void;
  onSwitchAccount: () => void;
}

export default function GoogleAccountConfirmation({
  userEmail,
  userName,
  userPhoto,
  workspaceId,
  role,
  onConfirm,
  onSwitchAccount,
}: GoogleAccountConfirmationProps) {
  const [switching, setSwitching] = useState(false);

  const handleSwitch = async () => {
    setSwitching(true);
    await onSwitchAccount();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-8 select-none">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        {/* Header Logo */}
        <div className="mb-6 flex flex-col items-center text-center">
          <WariTrackLogo size="lg" variant="full" roundedBadge subtitle="LOGISTICS OS" />
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Compte Google vérifié avec succès</span>
          </div>
        </div>

        {/* Identity Verification Card */}
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-brand" />
            <span>Confirmation d'accès au Cockpit</span>
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            WariTrack a vérifié votre identité Google. Validez cette session pour lancer le routage des commandes.
          </p>

          {/* Profile Identity Block */}
          <div className="flex items-center gap-3.5 rounded-xl border border-surface-border bg-surface p-3.5 mb-5">
            {userPhoto ? (
              <img
                src={userPhoto}
                alt={userName || "Profil"}
                className="h-12 w-12 rounded-xl object-cover border border-white/10 shadow-sm"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/20 border border-brand/30 text-brand">
                <UserCheck className="h-6 w-6" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-100">{userName || "Administrateur"}</p>
              <p className="truncate text-xs font-mono text-slate-400">{userEmail}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-light">
                  {role === "admin" || role === "owner" ? "Administrateur" : role}
                </span>
                <span className="truncate text-[10px] text-slate-500 font-mono">
                  ID: {workspaceId.slice(0, 10)}…
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:opacity-95 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-[0.99] cursor-pointer"
            >
              <span>Confirmer et Accéder à mon espace</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              disabled={switching}
              onClick={handleSwitch}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface hover:bg-surface/80 px-4 py-2.5 text-xs font-medium text-slate-300 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${switching ? "animate-spin" : ""}`} />
              <span>Changer de compte Google</span>
            </button>
          </div>
        </div>

        {/* Security Reassurance */}
        <p className="mt-4 text-center text-[11px] text-slate-500">
          Chiffrement de bout en bout · Routage étanche par pays et par boutique
        </p>
      </div>
    </div>
  );
}
