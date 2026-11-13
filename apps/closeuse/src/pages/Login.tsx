import { useState } from "react";
import { Lock, ArrowRight } from "lucide-react";
import { useAccessLinkAuth, useTheme } from "@ecomcod/shared";

interface LoginProps {
  accessLinkId: string;
}

export default function Login({ accessLinkId }: LoginProps) {
  useTheme("light");
  const { login, error } = useAccessLinkAuth();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await login(accessLinkId, password);
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-5 py-8 text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-surface-border bg-brand text-white">
            <img src="/icons/icon-192.png" alt="WariTrack" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">WariTrack</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Espace closeuse</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Mot de passe d'accès
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type="password"
                inputMode="text"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border border-surface-border bg-surface pl-10 pr-4 text-base text-slate-900 dark:text-slate-100 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="Reçu de votre responsable"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !password}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-base font-semibold text-white hover:opacity-95 disabled:opacity-50 transition-opacity"
          >
            <span>{submitting ? "Connexion en cours..." : "Se connecter"}</span>
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
