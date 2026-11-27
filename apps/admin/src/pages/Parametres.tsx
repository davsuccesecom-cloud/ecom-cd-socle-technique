import { useState, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import {
  getDb,
  ConfirmDialog,
  buildWhatsAppLink,
  cleanAfricanPhone,
  cleanOrderNumber,
  cleanProductTitle,
  buildSavWhatsAppMessage,
} from "@ecomcod/shared";
import type { Team, Order } from "@ecomcod/shared";
import {
  Sliders,
  Store,
  Printer,
  Share2,
  Check,
  RotateCcw,
  Save,
  AlertTriangle,
  Download,
  Copy,
  PhoneCall,
  Smartphone,
  Zap,
  Fingerprint,
  Globe,
  Settings2,
  ShieldCheck,
  ChevronRight,
  Layers,
} from "lucide-react";
import { ShopifyLogo, AzifyLogo, MetaLogo } from "../components/ConnectorLogos";
import MetaCapiConnector from "../components/MetaCapiConnector";
import AzifyFluxManager from "../components/AzifyFluxManager";
import ShopifyFluxManager from "../components/ShopifyFluxManager";
import PrintReceiptConfig from "../components/PrintReceiptConfig";
import WhiteLabelSettings from "../components/WhiteLabelSettings";
import WhatsAppIcon from "../components/WhatsAppIcon";
import PasskeySecuritySettings from "../components/PasskeySecuritySettings";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface ParametresProps {
  workspaceId: string;
  team: Team | null;
  teams?: Team[];
  orders?: Order[];
}

type SettingsCategory = "integrations" | "operations" | "security_brand";
type SettingsTab = "azify" | "shopify" | "metacapi" | "rules" | "print" | "phone_export" | "security" | "white_label";

interface TabDefinition {
  id: SettingsTab;
  category: SettingsCategory;
  label: string;
  shortLabel: string;
  desc: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  isMarketSpecific: boolean;
}

const CATEGORIES: {
  id: SettingsCategory;
  label: string;
  shortLabel: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
}[] = [
  {
    id: "integrations",
    label: "Canaux de Vente & Intégrations",
    shortLabel: "Canaux & Vente",
    desc: "Boutiques Azify, Shopify & Meta Conversions API",
    icon: Globe,
    count: 3,
  },
  {
    id: "operations",
    label: "Opérations & Logistique Marché",
    shortLabel: "Opérations & Marché",
    desc: "Commissions, devises, bordereaux & export SAV",
    icon: Settings2,
    count: 3,
  },
  {
    id: "security_brand",
    label: "Sécurité & Personnalisation",
    shortLabel: "Sécurité & Marque",
    desc: "Passkeys biométriques WariTrack & marque blanche",
    icon: ShieldCheck,
    count: 2,
  },
];

const SETTINGS_TABS: TabDefinition[] = [
  // 1. Canaux & Intégrations
  {
    id: "azify",
    category: "integrations",
    label: "Boutiques Azify",
    shortLabel: "Azify Studio",
    desc: "Connexion 1-clic Azify PWA Studio, tunnels COD 1-page & routage",
    badge: "Recommandé COD",
    icon: AzifyLogo,
    isMarketSpecific: true,
  },
  {
    id: "shopify",
    category: "integrations",
    label: "Boutiques Shopify",
    shortLabel: "Shopify",
    desc: "Webhooks de commandes, routage multi-boutiques & suivi",
    icon: ShopifyLogo,
    isMarketSpecific: true,
  },
  {
    id: "metacapi",
    category: "integrations",
    label: "Meta Conversions API",
    shortLabel: "Meta CAPI",
    desc: "Pixel Facebook & Instagram avec tracking d'achat serveur en direct",
    badge: "Indispensable ADS",
    icon: MetaLogo,
    isMarketSpecific: true,
  },

  // 2. Opérations & Logistique
  {
    id: "rules",
    category: "operations",
    label: "Règles & Rémunérations",
    shortLabel: "Règles & Commissions",
    desc: "Commissions livreurs & closeuses, devises locales & alertes",
    icon: Sliders,
    isMarketSpecific: true,
  },
  {
    id: "print",
    category: "operations",
    label: "Impression & Bordereaux",
    shortLabel: "Bordereaux Thermiques",
    desc: "En-tête bordereau, logos, mentions légales & format A6/80mm",
    icon: Printer,
    isMarketSpecific: true,
  },
  {
    id: "phone_export",
    category: "operations",
    label: "Export Contacts & SAV",
    desc: "Extraction de numéros sur période, filtres doublons & relances WhatsApp",
    shortLabel: "Export SAV",
    icon: PhoneCall,
    isMarketSpecific: true,
  },

  // 3. Sécurité & Marque
  {
    id: "security",
    category: "security_brand",
    label: "Sécurité du Compte & Passkeys",
    shortLabel: "Sécurité & Passkeys",
    desc: "Biométrie FIDO2 (Touch ID, Face ID, Windows Hello) pour protéger l'accès au cockpit",
    badge: "Protection Forte",
    icon: Fingerprint,
    isMarketSpecific: false,
  },
  {
    id: "white_label",
    category: "security_brand",
    label: "Apps Employés & Marque Blanche",
    shortLabel: "Marque Blanche",
    desc: "Nom de marque, logos et couleurs pour les interfaces livreurs et closeuses",
    icon: Smartphone,
    isMarketSpecific: false,
  },
];

export default function Parametres({ workspaceId, team, teams = [], orders = [] }: ParametresProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("integrations");
  const [activeTab, setActiveTab] = useState<SettingsTab>("shopify");

  const currentCategoryTabs = useMemo(() => {
    return SETTINGS_TABS.filter((t) => t.category === activeCategory);
  }, [activeCategory]);

  const activeTabDef = useMemo(() => {
    return SETTINGS_TABS.find((t) => t.id === activeTab) || SETTINGS_TABS[0];
  }, [activeTab]);

  const handleSelectCategory = (catId: SettingsCategory) => {
    setActiveCategory(catId);
    const catTabs = SETTINGS_TABS.filter((t) => t.category === catId);
    if (!catTabs.some((t) => t.id === activeTab)) {
      setActiveTab(catTabs[0].id);
    }
  };

  const ActiveIcon = activeTabDef.icon;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      {/* 2. Barre de Catégories de Niveau 1 (Grille 3 volets équilibrée & nette) */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActiveCat = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleSelectCategory(cat.id)}
              className={`group relative flex min-h-[58px] items-center justify-between rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                isActiveCat
                  ? "border-brand bg-brand/10 shadow-sm ring-1 ring-brand/40"
                  : "border-surface-border bg-surface-raised hover:border-slate-600 hover:bg-surface"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                    isActiveCat
                      ? "border-brand/40 bg-brand text-white shadow-xs"
                      : "border-surface-border bg-surface text-slate-400 group-hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className={`text-xs font-bold ${isActiveCat ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
                    {cat.shortLabel}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    {cat.desc}
                  </p>
                </div>
              </div>

              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                  isActiveCat
                    ? "bg-brand/20 text-brand border border-brand/30"
                    : "bg-surface border border-surface-border text-slate-500 dark:text-slate-400"
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Barre des Sous-Onglets (Niveau 2 tactile) */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {currentCategoryTabs.map((tab) => {
            const Icon = tab.icon;
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[46px] flex-1 sm:flex-initial items-center justify-center sm:justify-start gap-2.5 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                  isTabActive
                    ? "bg-brand text-white shadow-xs ring-1 ring-brand/40"
                    : "text-slate-600 dark:text-slate-400 hover:bg-surface hover:text-slate-900 dark:hover:text-slate-200 border border-transparent"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isTabActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`hidden md:inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
                      isTabActive
                        ? "bg-white/20 text-white"
                        : "bg-brand/10 text-brand border border-brand/30"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Bandeau Contextuel de l'Onglet Actif */}
      <div className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface-raised px-5 py-3.5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-surface-border text-brand">
            <ActiveIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{activeTabDef.label}</span>
              {activeTabDef.badge && (
                <span className="rounded border border-brand/30 bg-brand/10 px-1.5 py-0.2 text-[9px] font-bold text-brand uppercase">
                  {activeTabDef.badge}
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {activeTabDef.desc}
            </p>
          </div>
        </div>

        <div>
          {activeTabDef.isMarketSpecific ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Paramétrage marché : {team?.name || "Actif"}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span>Portée Globale Espace de Travail</span>
            </span>
          )}
        </div>
      </div>

      {/* Zone de contenu principale (100% pleine largeur) */}
      <div className="min-w-0 w-full">
        {activeTab === "security" && <PasskeySecuritySettings workspaceId={workspaceId} />}

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

        {activeTab === "azify" && (
          team ? (
            <AzifyFluxManager workspaceId={workspaceId} team={team} allTeams={teams} />
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
            <MetaCapiConnector workspaceId={workspaceId} team={team} allTeams={teams} />
          ) : (
            <EmptyTeamNotice />
          )
        )}

        {activeTab === "phone_export" && <PhoneExportManager team={team} orders={orders} />}

        {activeTab === "white_label" && <WhiteLabelSettings workspaceId={workspaceId} />}
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
  const [confirmSensitiveSave, setConfirmSensitiveSave] = useState(false);

  const isDirty =
    reminderStart !== initial.reminderStart ||
    reminderEnd !== initial.reminderEnd ||
    overloadThreshold !== initial.overloadThreshold ||
    digestInterval !== initial.digestInterval ||
    remunCloseuse !== initial.remunCloseuse ||
    remunLivreur !== initial.remunLivreur ||
    currency !== initial.currency;

  const isFinancialChange =
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

  const executeSave = async () => {
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
      setConfirmSensitiveSave(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (isFinancialChange) {
      setConfirmSensitiveSave(true);
      return;
    }
    executeSave();
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

      <ConfirmDialog
        open={confirmSensitiveSave}
        title="Confirmer la modification des règles financières ?"
        message={`Vous modifiez la devise (${currency}) ou les barèmes de commissions (Closeuse : ${Number(remunCloseuse) || 0} ${currency}, Livreur : ${Number(remunLivreur) || 0} ${currency}) de l'équipe ${team.name}. Ce barème s'appliquera immédiatement au calcul de la paie.`}
        confirmLabel="Appliquer le barème"
        danger={false}
        loading={saving}
        onConfirm={executeSave}
        onCancel={() => setConfirmSensitiveSave(false)}
      />
    </div>
  );
}

type ExportRangePreset = "today" | "7d" | "30d" | "all" | "custom";
type ExportSegment = "all" | "livre" | "relance" | "duplicates";
type PhoneFormatOption = "international" | "international_no_plus" | "local";

function formatPhoneNumber(phoneE164: string, format: PhoneFormatOption, countryCode: string = "TG"): string {
  if (!phoneE164) return "";
  const cleaned = phoneE164.trim();
  if (format === "international") {
    return cleaned.startsWith("+") ? cleaned : "+" + cleaned;
  }
  if (format === "international_no_plus") {
    return cleaned.replace(/^\+/, "");
  }
  if (format === "local") {
    const noPlus = cleaned.replace(/^\+/, "");
    if (noPlus.startsWith("228")) return noPlus.slice(3);
    if (noPlus.startsWith("225")) return noPlus.slice(3);
    if (noPlus.startsWith("221")) return noPlus.slice(3);
    if (noPlus.startsWith("229")) return noPlus.slice(3);
    if (noPlus.startsWith("226")) return noPlus.slice(3);
    if (noPlus.startsWith("223")) return noPlus.slice(3);
    if (noPlus.startsWith("237")) return noPlus.slice(3);
    return noPlus;
  }
  return cleaned;
}

function PhoneExportManager({ team, orders }: { team: Team | null; orders: Order[] }) {
  const [rangePreset, setRangePreset] = useState<ExportRangePreset>("30d");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [segment, setSegment] = useState<ExportSegment>("all");
  const [deduplicate, setDeduplicate] = useState(true);
  const [phoneFormat, setPhoneFormat] = useState<PhoneFormatOption>("international");
  const [copied, setCopied] = useState(false);
  const [showAdvancedExports, setShowAdvancedExports] = useState(false);

  const currency = team?.currency || "XOF";
  const defaultCountry = team?.defaultCountry || "TG";

  const filteredEntries = useMemo(() => {
    const now = Date.now();
    let startMs = 0;
    let endMs = now + 86400000;

    if (rangePreset === "today") {
      const d = new Date();
      startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
    } else if (rangePreset === "7d") {
      startMs = now - 7 * 86400000;
    } else if (rangePreset === "30d") {
      startMs = now - 30 * 86400000;
    } else if (rangePreset === "custom") {
      startMs = startDate ? new Date(startDate + "T00:00:00").getTime() : 0;
      endMs = endDate ? new Date(endDate + "T23:59:59").getTime() : now + 86400000;
    }

    // Comptage global des numéros normalisés pour identifier les doublons
    const phoneCounts = new Map<string, number>();
    for (const o of orders) {
      const raw = (o.clientPhoneFormatted || o.clientPhoneRaw || "").trim();
      if (raw && raw !== "Non renseigné") {
        const cleanP = cleanAfricanPhone(raw, defaultCountry);
        if (cleanP) {
          phoneCounts.set(cleanP, (phoneCounts.get(cleanP) ?? 0) + 1);
        }
      }
    }

    const inRange = orders
      .filter((o) => o.timestamps.received >= startMs && o.timestamps.received <= endMs)
      .filter((o) => {
        const raw = (o.clientPhoneFormatted || o.clientPhoneRaw || "").trim();
        if (!raw || raw === "Non renseigné") return false;
        const cleanP = cleanAfricanPhone(raw, defaultCountry);
        if (!cleanP) return false;
        if (segment === "livre") return o.statutCloseuse === "livre";
        if (segment === "relance") return o.statutCloseuse === "injoignable" || o.statutCloseuse === "rejete";
        if (segment === "duplicates") {
          return Boolean(o.isDuplicatePhone || o.capiIsolated || (phoneCounts.get(cleanP) ?? 0) > 1);
        }
        return true;
      })
      .sort((a, b) => b.timestamps.received - a.timestamps.received);

    if (!deduplicate) {
      return inRange.map((o) => {
        const raw = (o.clientPhoneFormatted || o.clientPhoneRaw || "").trim();
        const cleanP = cleanAfricanPhone(raw, defaultCountry);
        const totalForPhone = phoneCounts.get(cleanP) ?? 1;
        return {
          order: o,
          phone: cleanP,
          ordersCount: totalForPhone,
          isDuplicate: Boolean(o.isDuplicatePhone || o.capiIsolated || totalForPhone > 1),
        };
      });
    }

    const seen = new Set<string>();
    const unique: { order: Order; phone: string; ordersCount: number; isDuplicate: boolean }[] = [];
    for (const o of inRange) {
      const raw = (o.clientPhoneFormatted || o.clientPhoneRaw || "").trim();
      const cleanP = cleanAfricanPhone(raw, defaultCountry);
      if (seen.has(cleanP)) continue;
      seen.add(cleanP);
      const totalForPhone = phoneCounts.get(cleanP) ?? 1;
      unique.push({
        order: o,
        phone: cleanP,
        ordersCount: totalForPhone,
        isDuplicate: Boolean(o.isDuplicatePhone || o.capiIsolated || totalForPhone > 1),
      });
    }
    return unique;
  }, [orders, rangePreset, startDate, endDate, segment, deduplicate, defaultCountry]);

  // 1. Export Numéros Seuls (.txt ou .csv - 1 ligne = 1 numéro)
  const handleExportNumbersOnly = (extension: "txt" | "csv") => {
    const numbers = filteredEntries.map((e) => formatPhoneNumber(e.phone, phoneFormat, defaultCountry));
    const content =
      extension === "csv"
        ? "\uFEFF" + ["Téléphone", ...numbers].join("\r\n")
        : numbers.join("\r\n");
    const mime = extension === "csv" ? "text/csv;charset=utf-8;" : "text/plain;charset=utf-8;";
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "numeros-seuls-" + segment + "-" + (team?.name.toLowerCase().replace(/\s+/g, "-") || "export") + "-" + new Date().toISOString().slice(0, 10) + "." + extension;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 2. Export Contacts SAV Express (3 colonnes propres pour l'équipe SAV)
  const handleExportSavExpress = () => {
    const headers = ["Téléphone", "Nom Client", "Ville / Quartier", "Statut Commande", "Produit"];
    const escapeCsv = (val: string | number) => '"' + String(val ?? "").replace(/"/g, '""') + '"';
    const rows = filteredEntries.map(({ order: o, phone }) => {
      const formattedP = formatPhoneNumber(phone, phoneFormat, defaultCountry);
      return [
        escapeCsv(formattedP),
        escapeCsv(o.clientName),
        escapeCsv(o.city || o.shopifyData?.locationHint || ""),
        escapeCsv(o.statutCloseuse),
        escapeCsv(cleanProductTitle(o.product)),
      ];
    });

    const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sav-express-" + segment + "-" + (team?.name.toLowerCase().replace(/\s+/g, "-") || "export") + "-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 3. Copier les numéros dans le presse-papier
  const handleCopyNumbers = () => {
    const text = filteredEntries
      .map((e) => formatPhoneNumber(e.phone, phoneFormat, defaultCountry))
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // 4. Export Campagne WhatsApp (avec message script)
  const handleExportBroadcastCsv = () => {
    const headers = ["Téléphone (E.164)", "Nom Client", "Ville", "Message WhatsApp SAV"];
    const escapeCsv = (val: string | number) => '"' + String(val ?? "").replace(/"/g, '""') + '"';
    const rows = filteredEntries.map(({ order: o, phone }) => [
      escapeCsv(formatPhoneNumber(phone, phoneFormat, defaultCountry)),
      escapeCsv(o.clientName),
      escapeCsv(o.city || o.shopifyData?.locationHint || ""),
      escapeCsv(buildSavWhatsAppMessage(o, team)),
    ]);

    const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "campagne-whatsapp-" + (team?.name.toLowerCase().replace(/\s+/g, "-") || "export") + "-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 5. Export Complet Technique (17 colonnes - options avancées)
  const handleExportCsv = () => {
    const headers = [
      "N° Commande",
      "Téléphone WhatsApp",
      "Téléphone Brut Saisi",
      "Nom Client",
      "Ville & Quartier",
      "Adresse / Repère",
      "Produit",
      "Quantité",
      "Montant (" + currency + ")",
      "Statut Commande",
      "Statut Livreur",
      "Livreur Assigné",
      "Nb Commandes Numéro",
      "Qualification Tracking",
      "Lien WhatsApp Direct",
      "Message SAV Auto",
      "Date Réception",
    ];
    const escapeCsv = (val: string | number) => '"' + String(val ?? "").replace(/"/g, '""') + '"';
    const rows = filteredEntries.map(({ order: o, phone, ordersCount, isDuplicate }) => {
      const orderRef = cleanOrderNumber(o.shopifyData?.orderNumber || o.orderNumber);
      const savMsg = buildSavWhatsAppMessage(o, team);
      const waLink = buildWhatsAppLink(phone, savMsg);
      return [
        escapeCsv(orderRef ? "#" + orderRef : ""),
        escapeCsv(formatPhoneNumber(phone, phoneFormat, defaultCountry)),
        escapeCsv(o.clientPhoneRaw || phone),
        escapeCsv(o.clientName),
        escapeCsv(o.city || o.shopifyData?.locationHint || ""),
        escapeCsv(o.addressNote || ""),
        escapeCsv(cleanProductTitle(o.product)),
        escapeCsv(o.quantity || 1),
        escapeCsv(o.amount),
        escapeCsv(o.statutCloseuse),
        escapeCsv(o.statutLivreur || "non_assigné"),
        escapeCsv(o.assignedLivreurName || ""),
        escapeCsv(ordersCount),
        escapeCsv(isDuplicate ? "Accès libre site (Isolé Meta)" : "Meta CAPI Standard"),
        escapeCsv(waLink),
        escapeCsv(savMsg),
        escapeCsv(new Date(o.timestamps.received).toLocaleString("fr-FR")),
      ];
    });

    const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "numeros-clients-complet-" + (team?.name.toLowerCase().replace(/\s+/g, "-") || "export") + "-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-border pb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Exportation Numéros & Contacts SAV {team ? "— " + team.name : ""}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Exportez uniquement les numéros propres pour vos outils d'envoi WhatsApp en masse (WATI, Bulk WhatsApp, Wasapi) ou campagnes SAV.
          </p>
        </div>
        <span className="rounded-xl border border-brand/30 bg-brand/10 px-3 py-1 font-mono text-xs font-bold text-brand">
          {filteredEntries.length} numéro{filteredEntries.length > 1 ? "s" : ""} nettoyé{filteredEntries.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Filtres de sélection : durée, segment et format */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Durée */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-300">Durée d'extraction</label>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-5">
            {(
              [
                { id: "today", label: "Auj." },
                { id: "7d", label: "7j" },
                { id: "30d", label: "30j" },
                { id: "all", label: "Tout" },
                { id: "custom", label: "Dates" },
              ] as { id: ExportRangePreset; label: string }[]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setRangePreset(p.id)}
                className={
                  "rounded-lg border px-2 py-1.5 text-xs font-medium transition cursor-pointer " +
                  (rangePreset === p.id
                    ? "border-brand bg-brand text-white"
                    : "border-surface-border bg-surface text-slate-400 hover:text-slate-200")
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          {rangePreset === "custom" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <span className="mb-1 block text-[10px] text-slate-500">Du</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1 text-xs text-slate-100 outline-none focus:border-brand"
                />
              </div>
              <div>
                <span className="mb-1 block text-[10px] text-slate-500">Au</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-surface px-2 py-1 text-xs text-slate-100 outline-none focus:border-brand"
                />
              </div>
            </div>
          )}
        </div>

        {/* Catégorie de clients */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-300">Cible & Segment</label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value as ExportSegment)}
            className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand cursor-pointer"
          >
            <option value="all">Tous les numéros reçus sur la période</option>
            <option value="livre">Clients Livrés uniquement (Fidélisation & SAV)</option>
            <option value="relance">Injoignables & Rejetés (Relance WhatsApp)</option>
            <option value="duplicates">Numéros Doublons uniquement</option>
          </select>

          <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={deduplicate}
              onChange={(e) => setDeduplicate(e.target.checked)}
              className="rounded border-surface-border text-brand focus:ring-brand"
            />
            <span>Dédupliquer (1 seule ligne par numéro unique)</span>
          </label>
        </div>

        {/* Format du numéro de téléphone */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-300">Format d'export des numéros</label>
          <select
            value={phoneFormat}
            onChange={(e) => setPhoneFormat(e.target.value as PhoneFormatOption)}
            className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand cursor-pointer"
          >
            <option value="international">Format International avec + (ex: +22890123456)</option>
            <option value="international_no_plus">Format WhatsApp API sans + (ex: 22890123456)</option>
            <option value="local">Format Local National (ex: 90123456)</option>
          </select>
          <p className="mt-1 text-[10px] text-slate-500">
            {phoneFormat === "international" && "Standard universel pour contacts et téléphones."}
            {phoneFormat === "international_no_plus" && "Recommandé pour les logiciels de diffusion WhatsApp en masse."}
            {phoneFormat === "local" && "Sans indicatif pays, utile pour les appels manuels locaux."}
          </p>
        </div>
      </div>

      {/* Cartes d'Actions Principales (Exports Épurés) */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-emerald-400">
              ⚡ Exports Épurés pour Outils WhatsApp & SAV
            </h4>
            <p className="text-[11px] text-slate-400">
              Fichiers allégés sans colonnes superflues, immédiatement compatibles avec vos logiciels de messagerie groupée.
            </p>
          </div>
          <span className="font-mono text-xs font-bold text-slate-300 tabular-nums">
            {filteredEntries.length} contact{filteredEntries.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Bouton Numéros Seuls (.txt) */}
          <button
            type="button"
            disabled={filteredEntries.length === 0}
            onClick={() => handleExportNumbersOnly("txt")}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-40 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Numéros Seuls (.txt)</span>
          </button>

          {/* Bouton Numéros Seuls (.csv) */}
          <button
            type="button"
            disabled={filteredEntries.length === 0}
            onClick={() => handleExportNumbersOnly("csv")}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-2.5 text-xs font-bold text-emerald-300 transition disabled:opacity-40 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Numéros Seuls (.csv)</span>
          </button>

          {/* Bouton Contacts SAV Express (3 colonnes) */}
          <button
            type="button"
            disabled={filteredEntries.length === 0}
            onClick={handleExportSavExpress}
            className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover px-4 py-2.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-40 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Contacts SAV Express (CSV)</span>
          </button>

          {/* Copier liste rapide */}
          <button
            type="button"
            disabled={filteredEntries.length === 0}
            onClick={handleCopyNumbers}
            className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-xs font-medium text-slate-200 transition hover:border-brand/50 disabled:opacity-40 cursor-pointer"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-400" />}
            <span>{copied ? "Numéros copiés !" : "Copier la liste"}</span>
          </button>
        </div>
      </div>

      {/* Accordéon : Options d'Exports Avancées & Techniques */}
      <div className="border-t border-surface-border pt-2">
        <button
          type="button"
          onClick={() => setShowAdvancedExports((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition cursor-pointer py-1"
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>{showAdvancedExports ? "Masquer les exports techniques" : "Afficher les exports complets / avancés"}</span>
        </button>

        {showAdvancedExports && (
          <div className="mt-3 flex flex-wrap items-center gap-2.5 p-3 rounded-xl border border-surface-border bg-surface/40">
            <button
              type="button"
              disabled={filteredEntries.length === 0}
              onClick={handleExportBroadcastCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs font-semibold text-slate-300 transition hover:text-white disabled:opacity-40 cursor-pointer"
            >
              <WhatsAppIcon size={16} />
              <span>Format Campagne avec Scripts SAV</span>
            </button>

            <button
              type="button"
              disabled={filteredEntries.length === 0}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs font-semibold text-slate-300 transition hover:text-white disabled:opacity-40 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Export Technique Complet (17 colonnes)</span>
            </button>
          </div>
        )}
      </div>

      {/* Aperçu rapide avec bouton WhatsApp SAV direct */}
      <div className="max-h-72 overflow-y-auto rounded-xl border border-surface-border bg-surface/50">
        {filteredEntries.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-500">Aucun numéro sur cette plage de dates.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 border-b border-surface-border bg-surface-raised text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3.5 py-2.5">Numéro ({phoneFormat === "international" ? "+E.164" : phoneFormat === "international_no_plus" ? "E.164 brut" : "Local"})</th>
                <th className="px-3.5 py-2.5">Client</th>
                <th className="px-3.5 py-2.5">Ville & Quartier</th>
                <th className="px-3.5 py-2.5">Produit</th>
                <th className="px-3.5 py-2.5">Statut</th>
                <th className="px-3.5 py-2.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filteredEntries.slice(0, 60).map(({ order: o, phone, ordersCount, isDuplicate }) => {
                const formattedP = formatPhoneNumber(phone, phoneFormat, defaultCountry);
                return (
                  <tr key={o.id} className="hover:bg-surface/80">
                    <td className="px-3.5 py-2 text-slate-200 tabular-nums">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{formattedP}</span>
                        <a
                          href={buildWhatsAppLink(phone, buildSavWhatsAppMessage(o, team))}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Écrire sur WhatsApp (Script SAV / Suivi personnalisé)"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110 cursor-pointer"
                        >
                          <WhatsAppIcon size={20} />
                        </a>
                      </div>
                    </td>
                    <td className="px-3.5 py-2 text-slate-300 font-medium">{o.clientName}</td>
                    <td className="px-3.5 py-2 text-slate-400">{o.city || o.shopifyData?.locationHint || "–"}</td>
                    <td className="max-w-[160px] truncate px-3.5 py-2 text-slate-400">{o.product}</td>
                    <td className="px-3.5 py-2">
                      <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-slate-300 font-medium border border-surface-border">
                        {o.statutCloseuse}
                      </span>
                    </td>
                    <td className="px-3.5 py-2 text-right tabular-nums text-slate-500">
                      {new Date(o.timestamps.received).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
