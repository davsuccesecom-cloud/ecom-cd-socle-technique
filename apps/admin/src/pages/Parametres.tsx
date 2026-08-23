import { useTheme } from "../hooks/useTheme";

export default function Parametres() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="max-w-lg space-y-4">
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-200">Apparence</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme("dark")}
            className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
              theme === "dark"
                ? "border-brand bg-brand-light text-brand"
                : "border-surface-border text-slate-400"
            }`}
          >
            🌙 Sombre
          </button>
          <button
            onClick={() => setTheme("light")}
            className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
              theme === "light"
                ? "border-brand bg-brand-light text-brand"
                : "border-surface-border text-slate-400"
            }`}
          >
            ☀️ Clair
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 opacity-60">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-sm font-medium text-slate-200">Notifications</h3>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-slate-500">bientôt</span>
        </div>
        <p className="text-xs text-slate-500">
          Activer/désactiver les notifications sonores (toi et tes employés) arrive dans une prochaine mise à jour.
        </p>
      </div>
    </div>
  );
}
