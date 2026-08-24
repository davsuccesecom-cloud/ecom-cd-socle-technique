import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@ecomcod/shared";
import type { Team } from "@ecomcod/shared";
import { useTheme } from "../hooks/useTheme";

interface ParametresProps {
  workspaceId: string;
  team: Team | null;
}

const SOUND_KEY = "ecomcod-sound-notifications";

export default function Parametres({ workspaceId, team }: ParametresProps) {
  const { theme, setTheme } = useTheme();
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    setSoundEnabled(localStorage.getItem(SOUND_KEY) !== "off");
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(SOUND_KEY, next ? "on" : "off");
  };

  const playTestSound = () => {
    const audio = new Audio("/notification-ping.mp3");
    audio.play().catch(() => {});
  };

  return (
    <div className="max-w-lg space-y-4">
      {/* Apparence */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-200">Apparence</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme("dark")}
            className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
              theme === "dark" ? "border-brand bg-brand-light text-brand" : "border-surface-border text-slate-400"
            }`}
          >
            🌙 Sombre
          </button>
          <button
            onClick={() => setTheme("light")}
            className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
              theme === "light" ? "border-brand bg-brand-light text-brand" : "border-surface-border text-slate-400"
            }`}
          >
            ☀️ Clair
          </button>
        </div>
      </div>

      {/* Notifications sonores — préférence locale à cet appareil pour
         l'instant (pas encore synchronisée entre appareils, ni séparée
         par employé côté serveur — évolution possible plus tard). */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
        <h3 className="mb-1 text-sm font-medium text-slate-200">Notifications sonores</h3>
        <p className="mb-3 text-xs text-slate-500">
          Joue un son quand une notification arrive pendant que l'app est ouverte, sur cet appareil.
        </p>
        <div className="flex items-center justify-between rounded-xl border border-surface-border px-4 py-3">
          <span className="text-sm text-slate-300">Activer le son</span>
          <button
            onClick={toggleSound}
            className={`relative h-6 w-11 rounded-full transition-colors ${soundEnabled ? "bg-brand" : "bg-surface"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                soundEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        <button
          onClick={playTestSound}
          className="mt-3 w-full rounded-xl border border-surface-border py-2 text-sm text-slate-300 hover:bg-surface"
        >
          🔊 Tester le son
        </button>
      </div>

      {/* Réglages équipe — champs réels du modèle de données */}
      {team && <TeamSettingsForm workspaceId={workspaceId} team={team} />}
    </div>
  );
}

function TeamSettingsForm({ workspaceId, team }: { workspaceId: string; team: Team }) {
  const [reminderStart, setReminderStart] = useState(team.reminderWindowStart);
  const [reminderEnd, setReminderEnd] = useState(team.reminderWindowEnd);
  const [overloadThreshold, setOverloadThreshold] = useState(String(team.overloadAlertThreshold));
  const [digestInterval, setDigestInterval] = useState(String(team.digestIntervalMinutes));
  const [remunCloseuse, setRemunCloseuse] = useState(String(team.remunerationCloseusePerOrder ?? ""));
  const [remunLivreur, setRemunLivreur] = useState(String(team.remunerationLivreurPerOrder ?? ""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const db = getDb();
      await updateDoc(doc(db, "workspaces", workspaceId, "teams", team.id), {
        reminderWindowStart: reminderStart,
        reminderWindowEnd: reminderEnd,
        overloadAlertThreshold: Number(overloadThreshold) || 0,
        digestIntervalMinutes: Number(digestInterval) || 0,
        remunerationCloseusePerOrder: Number(remunCloseuse) || 0,
        remunerationLivreurPerOrder: Number(remunLivreur) || 0,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
      <h3 className="mb-1 text-sm font-medium text-slate-200">Réglages — {team.name}</h3>
      <p className="mb-4 text-xs text-slate-500">Rappels, seuils d'alerte et rémunération par commande.</p>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Plage horaire des rappels</label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={reminderStart}
              onChange={(e) => setReminderStart(e.target.value)}
              className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            />
            <span className="text-slate-500">→</span>
            <input
              type="time"
              value={reminderEnd}
              onChange={(e) => setReminderEnd(e.target.value)}
              className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-500">Seuil de surcharge closeuse (commandes actives)</label>
          <input
            type="number"
            min="1"
            value={overloadThreshold}
            onChange={(e) => setOverloadThreshold(e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-500">Fréquence du résumé admin (minutes)</label>
          <select
            value={digestInterval}
            onChange={(e) => setDigestInterval(e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
          >
            <option value="30">Toutes les 30 min</option>
            <option value="60">Toutes les heures</option>
            <option value="120">Toutes les 2 heures</option>
            <option value="240">Toutes les 4 heures</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Rémunération closeuse / commande (F)</label>
            <input
              type="number"
              min="0"
              value={remunCloseuse}
              onChange={(e) => setRemunCloseuse(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Rémunération livreur / commande (F)</label>
            <input
              type="number"
              min="0"
              value={remunLivreur}
              onChange={(e) => setRemunLivreur(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          disabled={saving}
          onClick={handleSave}
          className="w-full rounded-xl bg-brand py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : saved ? "✓ Enregistré" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
