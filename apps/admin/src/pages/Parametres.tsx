import { useEffect, useState, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@ecomcod/shared";
import type { Team } from "@ecomcod/shared";
import {
  Palette,
  Sliders,
  Store,
  Printer,
  Share2,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Check,
  RotateCcw,
  Save,
  AlertTriangle,
} from "lucide-react";
import { useTheme, ACCENT_PRESETS } from "../hooks/useTheme";
import MetaCapiConnector from "../components/MetaCapiConnector";
import ShopifyFluxManager from "../components/ShopifyFluxManager";
import PrintReceiptConfig from "../components/PrintReceiptConfig";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface ParametresProps {
  workspaceId: string;
  team: Team | null;
  teams?: Team[];
}

type SettingsTab = "general" | "rules" | "shopify" | "print" | "metacapi";

const SOUND_KEY = "ecomcod-sound-notifications";

export default function Parametres({ workspaceId, team, teams = [] }: ParametresProps) {
  const { theme, setTheme, accent, setAccent } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>("shopify");
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

  const navItems: { id: SettingsTab; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      id: "shopify",
      label: "Boutiques Shopify",
      desc: "Webhooks, routage multi-pays & suivi",
      icon: Store,
    },
    {
      id: "rules",
      label: "Règles & Rémunérations",
      desc: "Commissions, devise & seuils d'alerte",
      icon: Sliders,
    },
    {
      id: "print",
      label: "Impression & Bon 3D",
      desc: "En-tête bordereau, mentions & format",
      icon: Printer,
    },
    {
      id: "metacapi",
      label: "Meta Conversions API",
      desc: "Pixel Facebook & événements serveur",
      icon: Share2,
    },
    {
      id: "general",
      label: "Apparence & Audio",
      desc: "Thème, couleur d'accent & alertes",
      icon: Palette,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {/* Top Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-raised px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Configuration de l'espace de travail</h2>
          <p className="text-xs text-slate-500">
            Les paramètres opérationnels s'appliquent au marché sélectionné dans la barre supérieure.
          </p>
        </div>
        {team && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand">
            <span className="h-2 w-2 rounded-full bg-brand" />
            <span>
              Marché actif : {team.name} ({team.defaultCountry})
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left Navigation Rail */}
        <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-surface-border bg-surface-raised p-2 lg:col-span-4 lg:flex-col">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition lg:w-full ${
                  active
                    ? "bg-brand/15 text-slate-100 ring-1 ring-brand/40"
                    : "text-slate-400 hover:bg-surface hover:text-slate-200"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                    active
                      ? "border-brand/40 bg-brand text-white"
                      : "border-surface-border bg-surface text-slate-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{item.label}</p>
                  <p className="hidden truncate text-[11px] text-slate-500 lg:block">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Right Content Area */}
        <div className="min-w-0 lg:col-span-8">
          {activeTab === "general" && (
            <div className="space-y-5">
              {/* Theme & Accent Card */}
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Mode d'affichage</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Basculez entre l'interface sombre haute densité et le mode clair. Également accessible à tout moment dans l'en-tête.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTheme("dark")}
                      className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition ${
                        theme === "dark"
                          ? "border-brand bg-brand/10 text-slate-100 ring-1 ring-brand/40"
                          : "border-surface-border bg-surface text-slate-400 hover:border-slate-600 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Moon className="h-4 w-4 text-brand" />
                        <div>
                          <p className="text-xs font-semibold">Mode Sombre</p>
                          <p className="text-[11px] text-slate-500">Contraste reposant</p>
                        </div>
                      </div>
                      {theme === "dark" && <Check className="h-4 w-4 text-brand" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme("light")}
                      className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition ${
                        theme === "light"
                          ? "border-brand bg-brand/10 text-slate-100 ring-1 ring-brand/40"
                          : "border-surface-border bg-surface text-slate-400 hover:border-slate-600 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Sun className="h-4 w-4 text-amber-400" />
                        <div>
                          <p className="text-xs font-semibold">Mode Clair</p>
                          <p className="text-[11px] text-slate-500">Lecture plein jour</p>
                        </div>
                      </div>
                      {theme === "light" && <Check className="h-4 w-4 text-brand" />}
                    </button>
                  </div>
                </div>

                <div className="border-t border-surface-border pt-5">
                  <h3 className="text-sm font-semibold text-slate-100">Couleur d'accentuation</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Personnalisez la teinte principale des boutons, graphiques et indicateurs actifs.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {ACCENT_PRESETS.map((preset) => {
                      const active = accent === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setAccent(preset.id)}
                          className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-medium transition ${
                            active
                              ? "border-brand bg-brand/10 text-slate-100"
                              : "border-surface-border bg-surface text-slate-400 hover:border-slate-600 hover:text-slate-200"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="h-3.5 w-3.5 rounded-full shadow-sm"
                              style={{ backgroundColor: preset.swatch }}
                            />
                            <span>{preset.label}</span>
                          </span>
                          {active && <Check className="h-3.5 w-3.5 text-brand" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-surface-border pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">Alertes sonores temps réel</h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Émet un signal discret à la réception d'une nouvelle commande sur cet appareil.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={soundEnabled}
                      onClick={toggleSound}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                        soundEnabled ? "bg-brand" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          soundEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={playTestSound}
                      className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
                    >
                      {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-brand" /> : <VolumeX className="h-3.5 w-3.5 text-slate-500" />}
                      <span>Tester la tonalité de notification</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "rules" && (
            team ? (
              <TeamSettingsForm key={team.id} workspaceId={workspaceId} team={team} />
            ) : (
              <EmptyTeamNotice />
            )
          )}

          {activeTab === "shopify" && (
            team ? (
              <ShopifyFluxManager workspaceId={workspaceId} team={team} allTeams={teams} />
            ) : (
              <EmptyTeamNotice />
            )
          )}

          {activeTab === "print" && (
            team ? (
              <PrintReceiptConfig workspaceId={workspaceId} team={team} />
            ) : (
              <EmptyTeamNotice />
            )
          )}

          {activeTab === "metacapi" && (
            team ? (
              <MetaCapiConnector workspaceId={workspaceId} team={team} />
            ) : (
              <EmptyTeamNotice />
            )
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyTeamNotice() {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-8 text-center">
      <p className="text-sm font-medium text-slate-300">Aucun marché sélectionné</p>
      <p className="mt-1 text-xs text-slate-500">
        Sélectionnez une équipe en haut de page pour configurer ses paramètres.
      </p>
    </div>
  );
}

function TeamSettingsForm({ workspaceId, team }: { workspaceId: string; team: Team }) {
  const initial = useMemo(
    () => ({
      reminderStart: team.reminderWindowStart || "07:00",
      reminderEnd: team.reminderWindowEnd || "22:00",
      overloadThreshold: String(team.overloadAlertThreshold ?? 20),
      digestInterval: String(team.digestIntervalMinutes ?? 120),
      remunCloseuse: String(team.remunerationCloseusePerOrder ?? 0),
      remunLivreur: String(team.remunerationLivreurPerOrder ?? 0),
      currency: team.currency || team.metaCapiConfig?.currency || "XOF",
    }),
    [team]
  );

  const [reminderStart, setReminderStart] = useState(initial.reminderStart);
  const [reminderEnd, setReminderEnd] = useState(initial.reminderEnd);
  const [overloadThreshold, setOverloadThreshold] = useState(initial.overloadThreshold);
  const [digestInterval, setDigestInterval] = useState(initial.digestInterval);
  const [remunCloseuse, setRemunCloseuse] = useState(initial.remunCloseuse);
  const [remunLivreur, setRemunLivreur] = useState(initial.remunLivreur);
  const [currency, setCurrency] = useState(initial.currency);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    reminderStart !== initial.reminderStart ||
    reminderEnd !== initial.reminderEnd ||
    overloadThreshold !== initial.overloadThreshold ||
    digestInterval !== initial.digestInterval ||
    remunCloseuse !== initial.remunCloseuse ||
    remunLivreur !== initial.remunLivreur ||
    currency !== initial.currency;

  const handleReset = () => {
    setReminderStart(initial.reminderStart);
    setReminderEnd(initial.reminderEnd);
    setOverloadThreshold(initial.overloadThreshold);
    setDigestInterval(initial.digestInterval);
    setRemunCloseuse(initial.remunCloseuse);
    setRemunLivreur(initial.remunLivreur);
    setCurrency(initial.currency);
    setError(null);
  };

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
        currency,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 space-y-5">
      <div className="border-b border-surface-border pb-4">
        <h3 className="text-sm font-semibold text-slate-100">Règles Opérationnelles & Commissions — {team.name}</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Définissez la devise locale, les commissions par livraison réussie et les seuils d'alerte de l'équipe.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-300">Devise comptable du marché</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs font-medium text-slate-100 outline-none focus:border-brand"
          >
            <option value="XOF">XOF — Franc CFA (UEMOA : TG, BJ, CI, SN, BF, ML, NE)</option>
            <option value="XAF">XAF — Franc CFA (CEMAC : CM, GA, CG, TD)</option>
            <option value="GNF">GNF — Franc Guinéen (GN)</option>
            <option value="MAD">MAD — Dirham Marocain (MA)</option>
            <option value="NGN">NGN — Naira Nigérian (NG)</option>
            <option value="GHS">GHS — Cédi Ghanéen (GH)</option>
            <option value="EUR">EUR — Euro (€)</option>
            <option value="USD">USD — Dollar US ($)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-surface-border bg-surface/50 p-3.5">
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Commission Closeuse / commande livrée
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                min="0"
                placeholder="ex: 500"
                value={remunCloseuse}
                onChange={(e) => setRemunCloseuse(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 pr-14 text-sm font-semibold tabular-nums text-slate-100 outline-none focus:border-brand"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500">
                {currency}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface/50 p-3.5">
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Commission Livreur / commande livrée
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                min="0"
                placeholder="ex: 1500"
                value={remunLivreur}
                onChange={(e) => setRemunLivreur(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 pr-14 text-sm font-semibold tabular-nums text-slate-100 outline-none focus:border-brand"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500">
                {currency}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Plage horaire des relances clients
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={reminderStart}
                onChange={(e) => setReminderStart(e.target.value)}
                className="flex-1 rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
              />
              <span className="text-xs text-slate-500">à</span>
              <input
                type="time"
                value={reminderEnd}
                onChange={(e) => setReminderEnd(e.target.value)}
                className="flex-1 rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Seuil d'alerte surcharge closeuse
            </label>
            <input
              type="number"
              min="1"
              value={overloadThreshold}
              onChange={(e) => setOverloadThreshold(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-300">Fréquence du rapport condensé</label>
          <select
            value={digestInterval}
            onChange={(e) => setDigestInterval(e.target.value)}
            className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-brand"
          >
            <option value="30">Toutes les 30 minutes</option>
            <option value="60">Toutes les heures</option>
            <option value="120">Toutes les 2 heures</option>
            <option value="240">Toutes les 4 heures</option>
          </select>
        </div>

        {/* Contextual Action Bar */}
        <div className="flex items-center justify-between gap-3 border-t border-surface-border pt-4">
          <div className="text-xs text-slate-500">
            {saved ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Modifications enregistrées
              </span>
            ) : isDirty ? (
              <span className="text-amber-400">Modifications non enregistrées</span>
            ) : (
              <span>À jour avec le serveur</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:text-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Annuler
              </button>
            )}
            <button
              type="button"
              disabled={saving || !isDirty}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
