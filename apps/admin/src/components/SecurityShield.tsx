import { useEffect, useState, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

interface SecurityShieldProps {
  children: ReactNode;
}

/**
 * Protection anti-clickjacking légère : empêche l'intégration de l'Admin
 * dans une iframe tierce tout en laissant les opérateurs copier-coller
 * librement les numéros clients, références et rapports IA.
 */
export default function SecurityShield({ children }: SecurityShieldProps) {
  const [isFramed, setIsFramed] = useState(false);

  useEffect(() => {
    try {
      if (window.self !== window.top && window.top) {
        try {
          window.top.location.href = window.self.location.href;
        } catch {
          setIsFramed(true);
        }
      }
    } catch {
      setIsFramed(true);
    }
  }, []);

  if (isFramed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold">Affichage sécurisé requis</h1>
          <p className="text-sm text-slate-400">
            Pour votre sécurité, le cockpit WariTrack Admin doit être ouvert dans sa propre fenêtre.
          </p>
          <a
            href={typeof window !== "undefined" ? window.location.href : "/"}
            target="_top"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Ouvrir dans une fenêtre dédiée
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
