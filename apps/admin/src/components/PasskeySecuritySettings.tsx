import { useEffect, useState } from "react";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";
import { isPasskeySupported, registerPasskey, type PasskeyCredential } from "@ecomcod/shared";
import {
  Fingerprint,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  CreditCard,
  RefreshCw,
  Lock,
  Smartphone,
  Laptop,
} from "lucide-react";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface PasskeySecuritySettingsProps {
  workspaceId: string;
}

export default function PasskeySecuritySettings({ workspaceId }: PasskeySecuritySettingsProps) {
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const auth = getAuth(getApp());
  const currentUser = auth.currentUser;
  const supported = isPasskeySupported();

  const loadPasskeys = async () => {
    try {
      const functions = getFunctions(getApp());
      const callList = httpsCallable(functions, "listUserPasskeys");
      const res = await callList();
      const list = (res.data as { passkeys: PasskeyCredential[] }).passkeys || [];
      setPasskeys(list);
    } catch (err) {
      console.warn("Erreur chargement passkeys:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPasskeys();
  }, [workspaceId]);

  const handleRegisterPasskey = async () => {
    if (!currentUser || !currentUser.email) {
      setError("Vous devez être authentifié pour enregistrer une Passkey.");
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const functions = getFunctions(getApp());
      const callChallenge = httpsCallable(functions, "createPasskeyChallenge");
      const challengeRes = await callChallenge();
      const { challenge, rpId } = challengeRes.data as { challenge: string; rpId: string };

      // Nom d'appareil par défaut
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
      const defaultLabel = isMobile
        ? "Passkey Mobile (Biométrie)"
        : isMac
        ? "MacBook (Touch ID)"
        : "Poste de travail (Windows Hello / FIDO2)";

      const credential = await registerPasskey({
        challenge,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || currentUser.email.split("@")[0],
        rpId: rpId || window.location.hostname,
      });

      const callSave = httpsCallable(functions, "savePasskeyCredential");
      await callSave({
        credentialId: credential.id,
        rawId: credential.rawId,
        type: credential.type,
        label: defaultLabel,
      });

      setSuccess("Passkey biométrique enregistrée avec succès !");
      await loadPasskeys();
    } catch (err: any) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePasskey = async (credentialId: string) => {
    setDeletingId(credentialId);
    setError(null);
    try {
      const functions = getFunctions(getApp());
      const callDelete = httpsCallable(functions, "deletePasskeyCredential");
      await callDelete({ credentialId });
      setPasskeys((prev) => prev.filter((p) => p.id !== credentialId));
      setSuccess("Passkey révoquée.");
    } catch (err: any) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Carte d'introduction Passkeys & CinetPay Ready */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 md:p-6 shadow-xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <Fingerprint className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Passkeys Biométriques FIDO2 & Sécurité Forte
                </h3>
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                  CinetPay Ready
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400 max-w-2xl">
                Associez votre empreinte digitale (Touch ID, Windows Hello), reconnaissance faciale (Face ID) ou clé physique FIDO2. Votre compte sera immunisé contre le vol d'identifiants et prêt pour la validation des paiements CinetPay.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={creating || !supported}
            onClick={handleRegisterPasskey}
            className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
          >
            {creating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Validation biométrique…</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>Ajouter une Passkey</span>
              </>
            )}
          </button>
        </div>

        {!supported && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Votre navigateur ou environnement actuel ne prend pas en charge l&apos;API WebAuthn / Passkeys. Utilisez Safari, Chrome ou Edge récent.</span>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}
      </div>

      {/* 2. Liste des Passkeys enregistrées */}
      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
        <div className="border-b border-surface-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-slate-400" />
            <h4 className="text-sm font-bold text-slate-100">
              Passkeys actives sur votre profil ({passkeys.length})
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            {currentUser?.email || "Compte Admin"}
          </span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Chargement des clés de sécurité…
          </div>
        ) : passkeys.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Aucune Passkey configurée pour l&apos;instant. Cliquez sur « Ajouter une Passkey » ci-dessus pour sécuriser votre compte.
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {passkeys.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface border border-surface-border text-slate-300">
                    <Fingerprint className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-100">{p.label}</p>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      Enregistrée le {new Date(p.createdAt).toLocaleDateString("fr-FR")} · Identifiant: {p.id.slice(0, 16)}…
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={deletingId === p.id}
                  onClick={() => handleDeletePasskey(p.id)}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Révoquer</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Encadré Préparation CinetPay & Décaissements */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 md:p-6 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-100">
              Protection des Passerelles de Paiement CinetPay
            </h4>
            <p className="text-xs leading-relaxed text-slate-400">
              Dès l&apos;activation des clés d&apos;API CinetPay (Mobile Money Wave, Orange, MTN, Moov et cartes bancaires), chaque modification des coordonnées de reversement ou demande de décaissement exigera une confirmation par Passkey biométrique (Step-Up Authentication). Cela garantit qu&apos;aucun tiers ne pourra détourner vos fonds même en cas de compromission d&apos;email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
