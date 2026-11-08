import { useState, useEffect, useMemo } from "react";
import {
  doc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDb, AFRICA_COUNTRIES, ConfirmDialog } from "@ecomcod/shared";
import type { Team } from "@ecomcod/shared";
import {
  Plus,
  Store,
  FileSpreadsheet,
  ExternalLink,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  MapPin,
  TrendingUp,
  X,
  Radio,
  Globe2,
} from "lucide-react";
import CreateTeamForm from "../components/CreateTeamForm";
import AfricaInteractiveMap from "../components/AfricaInteractiveMap";
import { AFRICA_GEO, COUNTRY_ISO2_TO_ISO3 } from "../data/africaGeo";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface EquipesSheetsProps {
  workspaceId: string;
  teams: Team[];
}

const MAX_SHEETS_PER_TEAM = 5;
const SERVICE_ACCOUNT_EMAIL = "meta-capi-app@appspot.gserviceaccount.com";

function countryFor(code: string) {
  return AFRICA_COUNTRIES.find((c) => c.code === code) ?? null;
}

function flagFor(code: string) {
  const flags: Record<string, string> = {
    TG: "🇹🇬",
    BJ: "🇧🇯",
    BF: "🇧🇫",
    CI: "🇨🇮",
    SN: "🇸🇳",
    GH: "🇬🇭",
    NG: "🇳🇬",
    CM: "🇨🇲",
    ML: "🇲🇱",
  };
  return flags[code] || "📍";
}

function extractSheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export interface TeamShopifyConnectionInfo {
  connectionId: string;
  shopDomain: string;
  isOwner: boolean;
  countryCode?: string;
  label: string;
}

interface TestResult {
  success: boolean;
  serviceEmail: string;
  title?: string;
  sheetName?: string;
  columnsCount?: number;
  totalRows?: number;
  statusColCreated?: boolean;
  statusColLetter?: string;
  detectedColumns?: {
    phone: boolean;
    clientName: boolean;
    city: boolean;
    product: boolean;
    amount: boolean;
    quantity: boolean;
    status: boolean;
    livreur: boolean;
    updatedAt: boolean;
  };
  message: string;
  errorCode?: string;
}

function getCitiesForRegion(countryCode: string, regionIndex: number): string {
  const iso3 = COUNTRY_ISO2_TO_ISO3[countryCode] || "TGO";
  const cities = AFRICA_GEO.ct[iso3];
  if (!cities) return "Aucune ville repérée";
  const matching = cities.filter(([, , , ri]) => ri === regionIndex).map(([n]) => n);
  return matching.length > 0 ? matching.join(", ") : "Localisation automatique par adresse de commande";
}

export default function EquipesSheets({ workspaceId, teams }: EquipesSheetsProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(teams[0]?.id ?? null);
  const [selectedRegionIndex, setSelectedRegionIndex] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [shopifyByTeam, setShopifyByTeam] = useState<Record<string, string>>({});
  const [shopifyDetailsByTeam, setShopifyDetailsByTeam] = useState<Record<string, TeamShopifyConnectionInfo>>({});
  const [realOrders, setRealOrders] = useState<any[]>([]);

  // Écoute des connexions Shopify
  useEffect(() => {
    if (!workspaceId) return;
    const db = getDb();
    const connCol = collection(db, "workspaces", workspaceId, "shopifyConnections");
    const unsub = onSnapshot(connCol, (snap) => {
      const map: Record<string, string> = {};
      const details: Record<string, TeamShopifyConnectionInfo> = {};
      snap.forEach((d) => {
        const c = d.data();
        if (c.status === "active") {
          if (c.ownerTeamId) {
            map[c.ownerTeamId] = `${c.shopDomain} (Propriétaire)`;
            details[c.ownerTeamId] = {
              connectionId: d.id,
              shopDomain: c.shopDomain,
              isOwner: true,
              label: `${c.shopDomain} (Propriétaire)`,
            };
          }
          if (c.countryRoutes) {
            Object.entries(c.countryRoutes).forEach(([code, r]: any) => {
              if (r.assignedTeamId && r.status === "active") {
                map[r.assignedTeamId] = `${c.shopDomain} (Flux délégué ${code})`;
                details[r.assignedTeamId] = {
                  connectionId: d.id,
                  shopDomain: c.shopDomain,
                  isOwner: false,
                  countryCode: code,
                  label: `${c.shopDomain} (Flux délégué ${code})`,
                };
              }
            });
          }
        }
      });
      setShopifyByTeam(map);
      setShopifyDetailsByTeam(details);
    });
    return () => unsub();
  }, [workspaceId]);

  // Chargement en temps réel des commandes
  useEffect(() => {
    if (!workspaceId) return;
    const q = query(
      collection(getDb(), "workspaces", workspaceId, "orders"),
      orderBy("timestamps.received", "desc"),
      limit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setRealOrders(list);
      },
      (err) => {
        console.warn("Équipes & Marchés: Erreur de lecture des commandes réelles:", err);
      }
    );
    return () => unsub();
  }, [workspaceId]);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  );

  // Métriques de l'équipe sélectionnée
  const teamMetrics = useMemo(() => {
    if (!selectedTeam) {
      return {
        ordersCount: realOrders.length,
        deliveredCount: realOrders.filter((o) =>
          ["livre", "livree", "encaisse", "solde"].includes((o.status || "").toLowerCase())
        ).length,
        deliveryRate: realOrders.length
          ? Math.round(
              (realOrders.filter((o) =>
                ["livre", "livree", "encaisse", "solde"].includes((o.status || "").toLowerCase())
              ).length /
                realOrders.length) *
                100
            )
          : 0,
        cashTotal: realOrders
          .filter((o) =>
            ["livre", "livree", "encaisse", "solde"].includes((o.status || "").toLowerCase())
          )
          .reduce((sum, o) => sum + (o.montant || o.totalPrice || 0), 0),
      };
    }

    const teamOrders = realOrders.filter((o) => o.teamId === selectedTeam.id);
    const delivered = teamOrders.filter((o) =>
      ["livre", "livree", "encaisse", "solde"].includes((o.status || "").toLowerCase())
    );
    const rate = teamOrders.length ? Math.round((delivered.length / teamOrders.length) * 100) : 0;
    const cash = delivered.reduce((sum, o) => sum + (o.montant || o.totalPrice || 0), 0);

    return {
      ordersCount: teamOrders.length,
      deliveredCount: delivered.length,
      deliveryRate: rate,
      cashTotal: cash,
    };
  }, [realOrders, selectedTeam]);

  // Distribution par région administrative
  const regionalDistribution = useMemo(() => {
    if (!selectedTeam) return [];
    const iso3 = COUNTRY_ISO2_TO_ISO3[selectedTeam.defaultCountry] || "TGO";
    const regions = AFRICA_GEO.r[iso3] || [];
    const teamOrders = realOrders.filter((o) => o.teamId === selectedTeam.id);

    return regions.map((r, idx) => {
      const ordersInRegion = teamOrders.filter((ord) => {
        const city = (ord.ville || ord.quartier || "").toLowerCase();
        const cities = AFRICA_GEO.ct[iso3] || [];
        return cities.some(
          ([cityName, , , rIdx]) => rIdx === idx && (city.includes(cityName.toLowerCase()) || cityName.toLowerCase().includes(city))
        );
      }).length;

      const share = teamOrders.length > 0 ? ordersInRegion / teamOrders.length : 0.15;
      const estimatedDeliveryTime = Math.min(90, Math.max(20, Math.round(25 + idx * 8 + (1 - share) * 35)));

      return {
        index: idx,
        name: r.n,
        ordersCount: ordersInRegion,
        share,
        estimatedDeliveryTime,
      };
    });
  }, [selectedTeam, realOrders]);

  // Événements récents
  const recentEvents = useMemo(() => {
    const list = selectedTeam
      ? realOrders.filter((o) => o.teamId === selectedTeam.id).slice(0, 5)
      : realOrders.slice(0, 5);

    return list.map((o) => {
      const isDelivered = ["livre", "livree", "encaisse", "solde"].includes(
        (o.status || "").toLowerCase()
      );
      const isRejected = ["annule", "refuse", "injoignable", "retourne"].includes(
        (o.status || "").toLowerCase()
      );
      const color = isDelivered ? "#10b981" : isRejected ? "#f43f5e" : "#f59e0b";
      const statusLabel = isDelivered ? "Livrée & Encaissée" : isRejected ? "Annulée / Rejet" : "En cours";
      const cityName = o.ville || o.quartier || "Lomé";
      const timeStr = o.timestamps?.received
        ? new Date(o.timestamps.received).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        : "12:45";

      return {
        id: o.id,
        text: `${o.trackingNumber || `#${o.id.slice(-4)}`} · ${cityName} (${statusLabel})`,
        time: timeStr,
        color,
      };
    });
  }, [realOrders, selectedTeam]);

  // Équipes du même pays
  const peerTeams = useMemo(() => {
    if (!selectedTeam) return [];
    return teams.filter(
      (t) => t.defaultCountry === selectedTeam.defaultCountry && t.id !== selectedTeam.id
    );
  }, [selectedTeam, teams]);

  return (
    <div className="space-y-6">
      {/* 1. En-tête Principal Dé-dupliqué */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Équipes &amp; Marchés COD
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Supervision panafricaine, dispatch des flux par localisation et synchronisation des tableurs Google Sheets.
          </p>
        </div>

        {/* KPIs Panafricains & Action Créer */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-surface-border bg-surface-raised px-3 py-1.5 text-center">
              <span className="block text-base font-bold tabular-nums text-slate-900 dark:text-white">
                {teams.length}
              </span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Équipes</span>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface-raised px-3 py-1.5 text-center">
              <span className="block text-base font-bold tabular-nums text-slate-900 dark:text-white">
                {new Set(teams.map((t) => t.defaultCountry)).size}
              </span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Pays actifs</span>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface-raised px-3 py-1.5 text-center">
              <span className="block text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {realOrders.length}
              </span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Commandes</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-hover transition"
          >
            <Plus className="h-4 w-4" />
            <span>Nouveau marché</span>
          </button>
        </div>
      </div>

      {/* 2. Rail Horizontal de Navigation des Équipes */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => {
            setSelectedTeamId(null);
            setSelectedRegionIndex(null);
          }}
          className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all ${
            selectedTeamId === null
              ? "border-brand bg-brand/10 text-brand shadow-sm ring-1 ring-brand"
              : "border-surface-border bg-surface-raised text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500"
          }`}
        >
          <span className="text-base">🌍</span>
          <span>Toute l’Afrique</span>
        </button>

        {teams.map((t) => {
          const isSel = selectedTeamId === t.id;
          const orderCount = realOrders.filter((o) => o.teamId === t.id).length;
          const hasLiveFeed = !!shopifyByTeam[t.id] || t.sheetIds.length > 0;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSelectedTeamId(t.id);
                setSelectedRegionIndex(null);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all ${
                isSel
                  ? "border-brand bg-brand/10 text-brand shadow-sm ring-1 ring-brand"
                  : "border-surface-border bg-surface-raised text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500"
              }`}
            >
              <span className="text-base">{flagFor(t.defaultCountry)}</span>
              <span>{t.name}</span>
              <span className="rounded-full bg-slate-200 dark:bg-slate-700/60 px-1.5 py-0.2 text-[10px] tabular-nums font-bold text-slate-600 dark:text-slate-300">
                {orderCount}
              </span>
              <span
                className={`h-2 w-2 rounded-full ${hasLiveFeed ? "bg-emerald-500" : "bg-amber-500"}`}
                title={hasLiveFeed ? "Flux de données connecté" : "À connecter"}
              />
            </button>
          );
        })}
      </div>

      {/* 3. Cockpit Supérieur Interactif (Carte Afrique & Volet Télémétrique) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Colonne Gauche : Carte Interactive */}
        <div className="lg:col-span-7 xl:col-span-8">
          <AfricaInteractiveMap
            teams={teams}
            selectedTeam={selectedTeam}
            onSelectTeam={(tId) => setSelectedTeamId(tId)}
            selectedRegionIndex={selectedRegionIndex}
            onSelectRegionIndex={(rIdx) => setSelectedRegionIndex(rIdx)}
            orders={realOrders}
          />
        </div>

        {/* Colonne Droite : Télémétrie Opérationnelle */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {selectedTeam ? (
            <>
              {/* Carte 1 : Identité & Métriques Terrain */}
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-sm space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-2xl">
                      {flagFor(selectedTeam.defaultCountry)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {selectedTeam.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {countryFor(selectedTeam.defaultCountry)?.name} · Devise{" "}
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedTeam.currency}
                        </span>
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/30">
                    Opérationnel
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {shopifyByTeam[selectedTeam.id] ? (
                    <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-300 border border-sky-500/20">
                      ● Shopify temps réel
                    </span>
                  ) : (
                    <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      ● Shopify en veille
                    </span>
                  )}
                  {selectedTeam.sheetIds.length > 0 && (
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
                      {selectedTeam.sheetIds.length} tableur{selectedTeam.sheetIds.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* 3 Ratios Financiers & Volume */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="rounded-xl border border-surface-border bg-surface px-2.5 py-2 text-center">
                    <span className="block text-base font-bold tabular-nums text-slate-900 dark:text-white">
                      {teamMetrics.ordersCount}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Commandes</span>
                  </div>
                  <div className="rounded-xl border border-surface-border bg-surface px-2.5 py-2 text-center">
                    <span className="block text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {teamMetrics.deliveryRate}%
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Livrées</span>
                  </div>
                  <div className="rounded-xl border border-surface-border bg-surface px-2.5 py-2 text-center">
                    <span className="block text-base font-bold tabular-nums text-slate-900 dark:text-white">
                      {teamMetrics.cashTotal.toLocaleString("fr-FR")}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Encaissé ({selectedTeam.currency})</span>
                  </div>
                </div>

                {/* Équipes similaires du même pays */}
                {peerTeams.length > 0 && (
                  <div className="pt-2 border-t border-surface-border/60">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                      Autres équipes en {countryFor(selectedTeam.defaultCountry)?.name} :
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {peerTeams.map((pt) => (
                        <button
                          key={pt.id}
                          type="button"
                          onClick={() => {
                            setSelectedTeamId(pt.id);
                            setSelectedRegionIndex(null);
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-brand transition"
                        >
                          <span>{flagFor(pt.defaultCountry)}</span>
                          <span>{pt.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Carte 2 : Flux par Localisation */}
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Flux par localisation
                  </h4>
                  <span className="text-[11px] font-bold text-slate-500">
                    {regionalDistribution.length} zones
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Touchez une zone sur la carte pour zoomer sur sa zone d'action et filtrer son activité terrain.
                </p>

                <div className="space-y-1.5">
                  {regionalDistribution.slice(0, 5).map((z) => (
                    <button
                      key={z.index}
                      type="button"
                      onClick={() =>
                        setSelectedRegionIndex(selectedRegionIndex === z.index ? null : z.index)
                      }
                      className={`w-full rounded-xl border p-2 text-left transition-all ${
                        selectedRegionIndex === z.index
                          ? "border-brand bg-brand/10 ring-1 ring-brand"
                          : "border-surface-border bg-surface hover:border-slate-400 dark:hover:border-slate-500"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-900 dark:text-white">{z.name}</span>
                        <span className="text-[11px] tabular-nums text-slate-500">
                          {z.ordersCount} cmd · ~{z.estimatedDeliveryTime} min
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand transition-all duration-500"
                          style={{ width: `${Math.max(8, Math.round(z.share * 100))}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>

                {selectedRegionIndex !== null && (
                  <div className="rounded-xl border border-dashed border-brand/40 bg-brand/5 p-3 text-xs space-y-1">
                    <p className="font-bold text-brand">
                      {regionalDistribution[selectedRegionIndex]?.name}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                      {getCitiesForRegion(selectedTeam.defaultCountry, selectedRegionIndex)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedRegionIndex(null)}
                      className="mt-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
                    >
                      Voir toutes les zones
                    </button>
                  </div>
                )}
              </div>

              {/* Carte 3 : Trafic d'Opérations en Direct */}
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Trafic d’opérations
                  </h4>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    En direct
                  </span>
                </div>

                <div className="space-y-1.5">
                  {recentEvents.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
                        <span className="truncate text-slate-800 dark:text-slate-200">{e.text}</span>
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{e.time}</span>
                    </div>
                  ))}
                  {recentEvents.length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-3">
                      En attente des premières commandes synchronisées
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Mode Toute l'Afrique : Carte d'orientation globale */
            <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-sm space-y-4">
              <div className="text-center space-y-2 py-4">
                <div className="text-3xl">🌍</div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Vue Panafricaine WariTrack
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Sélectionnez une équipe dans la barre supérieure ou cliquez sur un pays pour zoomer sur sa zone d'action et gérer ses tableurs.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-surface-border">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Marchés actifs</p>
                {teams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTeamId(t.id);
                      setSelectedRegionIndex(null);
                    }}
                    className="w-full flex items-center justify-between rounded-xl border border-surface-border bg-surface p-2.5 text-xs font-semibold hover:border-brand transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{flagFor(t.defaultCountry)}</span>
                      <span className="text-slate-800 dark:text-slate-200">{t.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {countryFor(t.defaultCountry)?.name} · {t.sheetIds.length} tableurs
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Section Inférieure : Gestionnaire Réel des Tableurs Google Sheets & Connecteurs */}
      {selectedTeam && (
        <TeamDetail
          key={selectedTeam.id}
          workspaceId={workspaceId}
          team={selectedTeam}
          shopifyActiveInfo={shopifyByTeam[selectedTeam.id] ?? null}
          shopifyDetail={shopifyDetailsByTeam[selectedTeam.id] ?? null}
        />
      )}

      {/* Modal Création Marché */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
            <CreateTeamForm
              workspaceId={workspaceId}
              onCreated={(newTeamId) => {
                setSelectedTeamId(newTeamId);
                setShowCreate(false);
              }}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Composant de Gestion Réelle des Tableurs Google Sheets pour l'équipe
function TeamDetail({
  workspaceId,
  team,
  shopifyActiveInfo,
  shopifyDetail,
}: {
  workspaceId: string;
  team: Team;
  shopifyActiveInfo: string | null;
  shopifyDetail: TeamShopifyConnectionInfo | null;
}) {
  const [sheetInput, setSheetInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemoveSheetId, setConfirmRemoveSheetId] = useState<string | null>(null);
  const [confirmDisconnectShopify, setConfirmDisconnectShopify] = useState(false);

  const teamRef = () => doc(getDb(), "workspaces", workspaceId, "teams", team.id);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SERVICE_ACCOUNT_EMAIL);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleTestConnection = async () => {
    setError(null);
    setTestResult(null);
    const id = extractSheetId(sheetInput);
    if (!id) {
      setError("ID ou URL Google Sheets invalide. Collez le lien complet de votre tableur.");
      return;
    }

    setTesting(true);
    try {
      const functions = getFunctions();
      const testFn = httpsCallable(functions, "testSheetConnection");
      const res = await testFn({ sheetId: id, workspaceId });
      setTestResult(res.data as TestResult);
    } catch (err: any) {
      console.error("Erreur test sheet:", err);
      setTestResult({
        success: false,
        serviceEmail: SERVICE_ACCOUNT_EMAIL,
        errorCode: "CALL_ERROR",
        message: err?.message || "Impossible de joindre le service de test.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleAddSheetWithId = async (id: string) => {
    if (shopifyActiveInfo) {
      setError("La source Shopify est active pour cette équipe. La synchronisation Google Sheet est désactivée.");
      return;
    }
    if (team.sheetIds.includes(id)) {
      setError("Ce tableur Google Sheets est déjà rattaché à cette équipe.");
      return;
    }
    if (team.sheetIds.length >= MAX_SHEETS_PER_TEAM) {
      setError(`Limite atteinte (${MAX_SHEETS_PER_TEAM} tableurs maximum par équipe).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateDoc(teamRef(), { sheetIds: [...team.sheetIds, id] });
      setSheetInput("");
      setTestResult(null);
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleAddSheet = async () => {
    const id = extractSheetId(sheetInput);
    if (!id) {
      setError("ID ou lien Google Sheets invalide. Collez l'URL complète de votre tableur.");
      return;
    }
    await handleAddSheetWithId(id);
  };

  const handleRemoveSheet = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await updateDoc(teamRef(), { sheetIds: team.sheetIds.filter((s) => s !== id) });
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnectShopify = async () => {
    if (!shopifyDetail) return;
    setBusy(true);
    setError(null);
    try {
      const db = getDb();
      const connRef = doc(db, "workspaces", workspaceId, "shopifyConnections", shopifyDetail.connectionId);
      if (shopifyDetail.isOwner) {
        await updateDoc(connRef, {
          status: "inactive",
          ownerTeamId: "",
        });
      } else if (shopifyDetail.countryCode) {
        await updateDoc(connRef, {
          [`countryRoutes.${shopifyDetail.countryCode}.assignedTeamId`]: "",
          [`countryRoutes.${shopifyDetail.countryCode}.status`]: "inactive",
        });
      }
      setConfirmDisconnectShopify(false);
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setError(`${formatted.title} : ${formatted.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2 border-b border-surface-border pb-2.5">
        <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Gestionnaire Google Sheets &amp; Shopify — {team.name}
        </h3>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button type="button" onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 1. Carte Compte de Service Robot WariTrack */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Synchronisation Google Sheets 24h/24 via Compte de Service
                </h4>
                <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/30">
                  Actif 24/7
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Donnez l'accès « Éditeur » à notre robot pour synchroniser vos commandes automatiquement.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2">
            <code className="text-xs font-mono text-slate-700 dark:text-slate-300 select-all">
              {SERVICE_ACCOUNT_EMAIL}
            </code>
            <button
              type="button"
              onClick={handleCopyEmail}
              className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-hover"
            >
              {copiedEmail ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedEmail ? "Copié !" : "Copier"}</span>
            </button>
          </div>
        </div>

        {/* 4 Étapes Visuelles de Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="rounded-xl border border-surface-border bg-surface p-3 text-xs space-y-1">
            <span className="inline-block rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold">Étape 1</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">Ouvrez votre tableur</p>
            <p className="text-[11px] text-slate-500">Accédez à votre fichier Google Sheets.</p>
          </div>
          <div className="rounded-xl border border-surface-border bg-surface p-3 text-xs space-y-1">
            <span className="inline-block rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold">Étape 2</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">Cliquez sur « Partager »</p>
            <p className="text-[11px] text-slate-500">Le bouton bleu en haut à droite de Sheets.</p>
          </div>
          <div className="rounded-xl border border-surface-border bg-surface p-3 text-xs space-y-1">
            <span className="inline-block rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold">Étape 3</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">Ajoutez le robot</p>
            <p className="text-[11px] text-slate-500">Collez l'email ci-dessus avec le rôle Éditeur.</p>
          </div>
          <div className="rounded-xl border border-surface-border bg-surface p-3 text-xs space-y-1">
            <span className="inline-block rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold">Étape 4</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">Collez le lien ci-dessous</p>
            <p className="text-[11px] text-slate-500">Testez puis validez la synchronisation.</p>
          </div>
        </div>
      </div>

      {/* 2. Formulaire d'Ajout & Test de Tableur */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-3.5">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
          Rattacher un nouveau Google Sheets à {team.name}
        </h4>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={sheetInput}
            onChange={(e) => setSheetInput(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
            className="flex-1 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none placeholder:text-slate-400 focus:border-brand"
            disabled={busy || testing}
          />
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || !sheetInput.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-brand transition disabled:opacity-40"
          >
            {testing ? <RefreshCw className="h-4 w-4 animate-spin text-brand" /> : <Clock className="h-4 w-4 text-slate-400" />}
            <span>{testing ? "Test en cours..." : "Tester l'accès"}</span>
          </button>
          <button
            type="button"
            onClick={handleAddSheet}
            disabled={busy || !sheetInput.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-hover transition disabled:opacity-40"
          >
            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>Rattacher le tableur</span>
          </button>
        </div>

        {/* Aperçu du test de connexion avec détection de colonnes */}
        {testResult && (
          <div
            className={`rounded-xl border p-4 text-xs space-y-2.5 ${
              testResult.success
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                )}
                <span>
                  {testResult.success
                    ? `Accès validé : « ${testResult.title || "Tableur Google"} »`
                    : "Échec de connexion au tableur"}
                </span>
              </div>
              {testResult.totalRows !== undefined && (
                <span className="font-mono text-[11px]">
                  {testResult.totalRows} lignes détectées
                </span>
              )}
            </div>

            <p className="text-[11px] opacity-90">{testResult.message}</p>

            {testResult.detectedColumns && (
              <div className="pt-2 border-t border-emerald-500/20 space-y-1.5">
                <p className="font-semibold text-[11px]">Colonnes analysées par WariTrack :</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(testResult.detectedColumns).map(([col, detected]) => (
                    <span
                      key={col}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        detected
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                          : "bg-slate-200 dark:bg-slate-700/60 text-slate-500"
                      }`}
                    >
                      {detected ? "✓" : "—"} {col}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Liste des Tableurs Connectés à cette Équipe */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Tableurs actifs rattachés ({team.sheetIds.length}/{MAX_SHEETS_PER_TEAM})
          </h4>
          <span className="text-xs text-slate-500">Dispatch automatique des commandes entrantes</span>
        </div>

        {team.sheetIds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border p-6 text-center text-xs text-slate-500">
            Aucun tableur Google Sheets rattaché à {team.name} pour le moment. Collez un lien ci-dessus pour démarrer.
          </div>
        ) : (
          <div className="space-y-2">
            {team.sheetIds.map((id, index) => (
              <div
                key={id}
                className="flex items-center justify-between rounded-xl border border-surface-border bg-surface p-3 text-xs"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="truncate">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Tableur #{index + 1}</span>
                    <span className="ml-2 font-mono text-[11px] text-slate-400 truncate">{id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-brand transition"
                  >
                    <span>Ouvrir</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveSheetId(id)}
                    className="rounded-lg border border-surface-border bg-surface-raised p-1.5 text-slate-400 hover:border-rose-500 hover:text-rose-500 transition"
                    title="Dissocier ce tableur"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Statut Shopify du Marché */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Store className="h-4 w-4 text-sky-500" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Liaison Boutique Shopify
            </h4>
          </div>
          {shopifyActiveInfo ? (
            <span className="rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-300 px-2.5 py-0.5 text-xs font-semibold border border-sky-500/30">
              ● Connecté
            </span>
          ) : (
            <span className="rounded-full bg-slate-200 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 px-2.5 py-0.5 text-xs font-medium">
              Non configuré pour ce marché
            </span>
          )}
        </div>

        {shopifyActiveInfo ? (
          <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface p-3 text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{shopifyActiveInfo}</span>
            <button
              type="button"
              onClick={() => setConfirmDisconnectShopify(true)}
              className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition"
            >
              Dissocier
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pour connecter une boutique Shopify à cette équipe ou router des flux pays, rendez-vous dans l'onglet{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">Paramètres &amp; Flux</span>.
          </p>
        )}
      </div>

      {/* Boîtes de Dialogue de Confirmation */}
      <ConfirmDialog
        open={confirmRemoveSheetId !== null}
        title="Dissocier ce tableur Google Sheets"
        message="Êtes-vous sûr de vouloir retirer ce tableur ? Les commandes déjà enregistrées resteront dans WariTrack, mais les nouvelles lignes ne seront plus synchronisées."
        confirmLabel="Dissocier le tableur"
        danger={true}
        onConfirm={() => {
          if (confirmRemoveSheetId) {
            handleRemoveSheet(confirmRemoveSheetId);
            setConfirmRemoveSheetId(null);
          }
        }}
        onCancel={() => setConfirmRemoveSheetId(null)}
      />

      <ConfirmDialog
        open={confirmDisconnectShopify}
        title="Dissocier le flux Shopify de ce marché"
        message="Voulez-vous vraiment désactiver le flux Shopify pour cette équipe ? Les commandes Shopify vers ce pays ne seront plus routées vers ce marché."
        confirmLabel="Dissocier Shopify"
        danger={true}
        onConfirm={handleDisconnectShopify}
        onCancel={() => setConfirmDisconnectShopify(false)}
      />
    </div>
  );
}
