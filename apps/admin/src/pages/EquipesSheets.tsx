import { useState, useEffect, useMemo } from "react";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDb, AFRICA_COUNTRIES, ConfirmDialog } from "@ecomcod/shared";
import type { Team, Order } from "@ecomcod/shared";
import {
  Plus,
  Store,
  FileSpreadsheet,
  ExternalLink,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  Info,
  Unlink,
  Globe,
  Layers,
  Activity,
  ArrowRight,
  X,
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

export default function EquipesSheets({ workspaceId, teams }: EquipesSheetsProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(teams[0]?.id ?? null);
  const [selectedRegionIndex, setSelectedRegionIndex] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSheetsModal, setShowSheetsModal] = useState(false);

  // Écoute des connexions Shopify par équipe
  const [shopifyByTeam, setShopifyByTeam] = useState<Record<string, string>>({});
  const [shopifyDetailsByTeam, setShopifyDetailsByTeam] = useState<
    Record<string, TeamShopifyConnectionInfo>
  >({});

  // Écoute des commandes réelles pour la carte & le flux en direct
  const [realOrders, setRealOrders] = useState<any[]>([]);

  useEffect(() => {
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

  // Écoute des commandes récentes de la boutique
  useEffect(() => {
    const db = getDb();
    const ordersCol = collection(db, "workspaces", workspaceId, "orders");
    const q = query(ordersCol, orderBy("timestamps.received", "desc"), limit(120));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRealOrders(list);
      },
      (err) => {
        console.warn("Erreur écoute commandes EquipesSheets:", err);
      }
    );
    return () => unsub();
  }, [workspaceId]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;

  // Calcul des métriques pour l'équipe sélectionnée
  const teamMetrics = useMemo(() => {
    if (!selectedTeam) {
      // Métriques globales Afrique
      const totalCash = realOrders
        .filter((o) => ["livre", "livree", "encaisse"].includes((o.status || "").toLowerCase()))
        .reduce((sum, o) => sum + (o.totalAmount || o.montant || 0), 0);
      return {
        ordersCount: realOrders.length,
        deliveredCount: realOrders.filter((o) =>
          ["livre", "livree", "encaisse"].includes((o.status || "").toLowerCase())
        ).length,
        cashTotal: totalCash,
        deliveryRate: realOrders.length
          ? Math.round(
              (realOrders.filter((o) =>
                ["livre", "livree", "encaisse"].includes((o.status || "").toLowerCase())
              ).length /
                realOrders.length) *
                100
            )
          : 0,
      };
    }

    const teamOrders = realOrders.filter((o) => o.teamId === selectedTeam.id);
    const delivered = teamOrders.filter((o) =>
      ["livre", "livree", "encaisse"].includes((o.status || "").toLowerCase())
    );
    const cash = delivered.reduce((sum, o) => sum + (o.totalAmount || o.montant || 0), 0);
    const rate = teamOrders.length ? Math.round((delivered.length / teamOrders.length) * 100) : 0;

    return {
      ordersCount: teamOrders.length,
      deliveredCount: delivered.length,
      cashTotal: cash,
      deliveryRate: rate,
    };
  }, [selectedTeam, realOrders]);

  // Calcul de la répartition par région pour l'équipe active
  const regionalDistribution = useMemo(() => {
    if (!selectedTeam) return [];
    const iso3 = COUNTRY_ISO2_TO_ISO3[selectedTeam.defaultCountry] || "TGO";
    const regions = AFRICA_GEO.r[iso3] || [];
    const cities = AFRICA_GEO.ct[iso3] || [];
    const teamOrders = realOrders.filter((o) => o.teamId === selectedTeam.id);

    return regions.map((r, idx) => {
      // Compte les commandes attribuées à cette région
      const count = teamOrders.filter((o) => {
        const cityStr = (o.customerCity || o.villeQuartier || "").toLowerCase();
        const cityObj = cities.find(
          ([cn]) => cityStr.includes(cn.toLowerCase()) || cn.toLowerCase().includes(cityStr)
        );
        if (cityObj) return cityObj[3] === idx;
        return idx === 0; // Par défaut sur la capitale
      }).length;

      const share = teamOrders.length > 0 ? count / teamOrders.length : 0;
      return {
        index: idx,
        name: r.n,
        ordersCount: count,
        share,
        estimatedDeliveryTime: 25 + (idx * 15) % 45,
      };
    });
  }, [selectedTeam, realOrders]);

  // Équipes du même pays
  const peerTeams = useMemo(() => {
    if (!selectedTeam) return [];
    return teams.filter(
      (t) => t.defaultCountry === selectedTeam.defaultCountry && t.id !== selectedTeam.id
    );
  }, [selectedTeam, teams]);

  return (
    <div className="space-y-5">
      {/* 1. Header & KPIs Panafricains */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
            Équipes &amp; Marchés COD
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Supervisez les zones opérationnelles, les flux de commandes en direct et la synchronisation des données.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-surface-border bg-surface-raised px-3.5 py-2">
            <div>
              <span className="block text-base font-bold text-slate-100 tabular-nums">
                {teams.length}
              </span>
              <span className="text-[10.5px] text-slate-400">Équipes</span>
            </div>
            <div className="h-6 w-px bg-surface-border" />
            <div>
              <span className="block text-base font-bold text-slate-100 tabular-nums">
                {new Set(teams.map((t) => t.defaultCountry)).size}
              </span>
              <span className="text-[10.5px] text-slate-400">Pays actifs</span>
            </div>
            <div className="h-6 w-px bg-surface-border" />
            <div>
              <span className="block text-base font-bold text-emerald-400 tabular-nums">
                {realOrders.length}
              </span>
              <span className="text-[10.5px] text-slate-400">Commandes suivies</span>
            </div>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-hover"
          >
            <Plus className="h-4 w-4" />
            <span>Nouveau marché</span>
          </button>
        </div>
      </div>

      {/* 2. Rail Horizontal de Navigation des Équipes */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          type="button"
          onClick={() => {
            setSelectedTeamId(null);
            setSelectedRegionIndex(null);
          }}
          className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
            selectedTeamId === null
              ? "border-brand bg-brand/15 text-brand ring-1 ring-brand"
              : "border-surface-border bg-surface-raised text-slate-300 hover:border-slate-500 hover:text-white"
          }`}
        >
          <Globe className="h-4 w-4" />
          <span>Toute l'Afrique</span>
          <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
            {teams.length}
          </span>
        </button>

        {teams.map((team) => {
          const isSelected = selectedTeamId === team.id;
          const shopifyActive = !!shopifyByTeam[team.id];
          const teamOrderCount = realOrders.filter((o) => o.teamId === team.id).length;

          return (
            <button
              key={team.id}
              type="button"
              onClick={() => {
                setSelectedTeamId(team.id);
                setSelectedRegionIndex(null);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                isSelected
                  ? "border-brand bg-brand/15 text-brand ring-1 ring-brand"
                  : "border-surface-border bg-surface-raised text-slate-300 hover:border-slate-500 hover:text-white"
              }`}
            >
              <span className="text-sm">{flagFor(team.defaultCountry)}</span>
              <span>{team.name}</span>
              <span className="rounded-full bg-slate-800/80 px-1.5 py-0.2 text-[10.5px] font-mono text-slate-400">
                {teamOrderCount}
              </span>
              <span
                className={`h-2 w-2 rounded-full ${
                  shopifyActive
                    ? "bg-sky-400"
                    : team.sheetIds.length > 0
                    ? "bg-emerald-400"
                    : "bg-amber-400"
                }`}
                title={
                  shopifyActive
                    ? "Flux Shopify actif"
                    : team.sheetIds.length > 0
                    ? "Google Sheet connecté"
                    : "À configurer"
                }
              />
            </button>
          );
        })}
      </div>

      {/* 3. Grille Principale (Carte Interactive & Panneau d'Opérations) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_390px] items-start">
        {/* Scène Cartographique Africaine & Bounding Box Dynamique */}
        <div className="space-y-3">
          <AfricaInteractiveMap
            teams={teams}
            selectedTeam={selectedTeam}
            onSelectTeam={(tId) => setSelectedTeamId(tId)}
            selectedRegionIndex={selectedRegionIndex}
            onSelectRegionIndex={(rIdx) => setSelectedRegionIndex(rIdx)}
            orders={realOrders}
          />
        </div>

        {/* Panneau Latéral Contextuel */}
        <div className="space-y-4">
          {selectedTeam ? (
            <>
              {/* Carte Métier de l'Équipe */}
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface border border-surface-border text-2xl">
                      {flagFor(selectedTeam.defaultCountry)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{selectedTeam.name}</h3>
                      <p className="text-xs text-slate-400">
                        {countryFor(selectedTeam.defaultCountry)?.name} · Devise :{" "}
                        <span className="font-semibold text-slate-200">
                          {selectedTeam.currency}
                        </span>
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-brand/15 border border-brand/30 px-2.5 py-1 text-[10.5px] font-bold text-brand">
                    Opérationnel
                  </span>
                </div>

                {/* 3 KPIs Terrain */}
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-surface-border/70 pt-3">
                  <div className="rounded-xl bg-surface/70 border border-surface-border/50 p-2.5">
                    <span className="block text-base font-bold text-white tabular-nums">
                      {teamMetrics.ordersCount}
                    </span>
                    <span className="text-[10px] text-slate-400">Commandes</span>
                  </div>
                  <div className="rounded-xl bg-surface/70 border border-surface-border/50 p-2.5">
                    <span className="block text-base font-bold text-emerald-400 tabular-nums">
                      {teamMetrics.deliveryRate}%
                    </span>
                    <span className="text-[10px] text-slate-400">Livrées</span>
                  </div>
                  <div className="rounded-xl bg-surface/70 border border-surface-border/50 p-2.5">
                    <span className="block text-sm font-bold text-white tabular-nums truncate">
                      {teamMetrics.cashTotal.toLocaleString("fr-FR")}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {selectedTeam.currency} encaissés
                    </span>
                  </div>
                </div>
              </div>

              {/* Flux par Localisation & Régions */}
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Flux par Localisation ({regionalDistribution.length} zones)
                  </h4>
                  {selectedRegionIndex !== null && (
                    <button
                      type="button"
                      onClick={() => setSelectedRegionIndex(null)}
                      className="text-[11px] font-medium text-brand hover:underline"
                    >
                      Toutes les zones
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Touchez une région sur la carte ou ci-dessous pour zoomer sur sa zone d'action.
                </p>

                <div className="mt-3 space-y-2">
                  {regionalDistribution.slice(0, 6).map((reg) => {
                    const isSelectedReg = selectedRegionIndex === reg.index;
                    return (
                      <button
                        key={reg.index}
                        type="button"
                        onClick={() =>
                          setSelectedRegionIndex(isSelectedReg ? null : reg.index)
                        }
                        className={`w-full rounded-xl border p-2.5 text-left transition ${
                          isSelectedReg
                            ? "border-brand bg-brand/10 ring-1 ring-brand"
                            : "border-surface-border bg-surface/60 hover:border-slate-600 hover:bg-surface"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className={isSelectedReg ? "text-brand" : "text-slate-200"}>
                            {reg.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {reg.ordersCount} cmd · ~{reg.estimatedDeliveryTime} min
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-brand transition-all duration-500"
                            style={{ width: `${Math.max(8, Math.round(reg.share * 100))}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Trafic d'Opérations en Direct */}
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span>Trafic d'Opérations</span>
                  </h4>
                  <span className="text-[10px] font-semibold text-emerald-400">Temps réel</span>
                </div>

                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                  {realOrders
                    .filter((o) => o.teamId === selectedTeam.id)
                    .slice(0, 6)
                    .map((ord) => {
                      const isDelivered = ["livre", "livree", "encaisse"].includes(
                        (ord.status || "").toLowerCase()
                      );
                      const isRejected = [
                        "annule",
                        "refuse",
                        "injoignable",
                        "retourne",
                      ].includes((ord.status || "").toLowerCase());

                      const dotColor = isDelivered
                        ? "bg-emerald-400"
                        : isRejected
                        ? "bg-rose-400"
                        : "bg-orange-400";

                      return (
                        <div
                          key={ord.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface/50 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                            <span className="font-semibold text-slate-200 truncate">
                              {ord.orderNumber ? `#${ord.orderNumber}` : `#${ord.id.slice(0, 6)}`}{" "}
                              · {ord.customerCity || "Lomé"}
                            </span>
                          </div>
                          <span className="font-bold text-slate-300 tabular-nums shrink-0">
                            {(ord.totalAmount || ord.montant || 0).toLocaleString("fr-FR")}{" "}
                            {selectedTeam.currency}
                          </span>
                        </div>
                      );
                    })}

                  {realOrders.filter((o) => o.teamId === selectedTeam.id).length === 0 && (
                    <p className="py-4 text-center text-xs text-slate-400">
                      En attente des premières commandes synchronisées pour ce marché.
                    </p>
                  )}
                </div>
              </div>

              {/* Connecteurs : Google Sheets & Shopify */}
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Connecteurs &amp; Flux
                </h4>

                {/* Bloc Google Sheets avec Logo Officiel */}
                <div className="rounded-xl border border-surface-border bg-surface/70 p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src="/icons/google-sheets.png"
                      alt="Google Sheets"
                      className="h-8 w-8 object-contain rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div>
                      <h5 className="text-xs font-bold text-white">Google Sheets</h5>
                      <p className="text-[11px] text-slate-400">
                        {selectedTeam.sheetIds.length} tableur
                        {selectedTeam.sheetIds.length > 1 ? "s" : ""} rattaché
                        {selectedTeam.sheetIds.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSheetsModal(true)}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
                  >
                    <span>Gérer</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Bloc Shopify */}
                <div className="rounded-xl border border-surface-border bg-surface/70 p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/25">
                      <Store className="h-4 w-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">Boutique Shopify</h5>
                      <p className="text-[11px] text-slate-400">
                        {shopifyByTeam[selectedTeam.id] || "Aucun flux Shopify actif"}
                      </p>
                    </div>
                  </div>

                  {shopifyByTeam[selectedTeam.id] ? (
                    <span className="rounded-full bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                      Actif
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">Non configuré</span>
                  )}
                </div>
              </div>

              {/* Équipes du même pays */}
              {peerTeams.length > 0 && (
                <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Autres équipes en {countryFor(selectedTeam.defaultCountry)?.name}
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {peerTeams.map((pt) => (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => {
                          setSelectedTeamId(pt.id);
                          setSelectedRegionIndex(null);
                        }}
                        className="flex items-center justify-between rounded-xl border border-surface-border bg-surface/50 p-2.5 text-left text-xs font-semibold text-slate-200 hover:border-brand hover:text-white transition"
                      >
                        <span className="flex items-center gap-2">
                          <span>{flagFor(pt.defaultCountry)}</span>
                          <span>{pt.name}</span>
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Vue d'ensemble continentale (quand aucune équipe n'est sélectionnée) */
            <div className="space-y-4">
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand border border-brand/30 text-2xl">
                  🌍
                </div>
                <h3 className="mt-3 text-sm font-bold text-white">Supervision Panafricaine</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Sélectionnez une équipe dans la liste ou touchez un pays sur la carte pour zoomer
                  sur ses zones et piloter ses flux logistiques.
                </p>
              </div>

              <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                  Marchés Actifs ({teams.length})
                </h4>
                <div className="space-y-2">
                  {teams.map((tm) => {
                    const cnt = realOrders.filter((o) => o.teamId === tm.id).length;
                    return (
                      <button
                        key={tm.id}
                        type="button"
                        onClick={() => setSelectedTeamId(tm.id)}
                        className="flex w-full items-center justify-between rounded-xl border border-surface-border bg-surface/60 p-2.5 text-left text-xs font-semibold text-slate-200 hover:border-brand hover:text-white transition"
                      >
                        <div className="flex items-center gap-2">
                          <span>{flagFor(tm.defaultCountry)}</span>
                          <span>{tm.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="font-mono text-[11px]">{cnt} cmd</span>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Modal Connecteur Google Sheets Complet & Assistant 4 Étapes */}
      {showSheetsModal && selectedTeam && (
        <GoogleSheetsManagerModal
          workspaceId={workspaceId}
          team={selectedTeam}
          shopifyActiveInfo={shopifyByTeam[selectedTeam.id] ?? null}
          onClose={() => setShowSheetsModal(false)}
        />
      )}

      {/* 5. Modal Création Nouveau Marché */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
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

// Modal spécialisé de configuration & test Google Sheets
function GoogleSheetsManagerModal({
  workspaceId,
  team,
  shopifyActiveInfo,
  onClose,
}: {
  workspaceId: string;
  team: Team;
  shopifyActiveInfo: string | null;
  onClose: () => void;
}) {
  const [sheetInput, setSheetInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemoveSheetId, setConfirmRemoveSheetId] = useState<string | null>(null);

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
      setError(
        "La source Shopify est active pour cette équipe. La synchronisation Google Sheet est en veille."
      );
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-5 my-8">
        {/* En-tête avec Logo Google Sheets */}
        <div className="flex items-start justify-between gap-3 border-b border-surface-border pb-4">
          <div className="flex items-center gap-3">
            <img
              src="/icons/google-sheets.png"
              alt="Google Sheets"
              className="h-10 w-10 object-contain rounded-xl shadow-md"
            />
            <div>
              <h3 className="text-base font-bold text-white">
                Assistant de Connexion Google Sheets — {team.name}
              </h3>
              <p className="text-xs text-slate-400">
                Synchronisation automatique bidirectionnelle et numérisation continue des commandes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface border border-surface-border text-slate-400 hover:text-white hover:bg-surface-subtle transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 1. Compte de Service & Adresse Robot 24h/24 */}
        <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-slate-200">
                Adresse Robot WariTrack (Compte de Service 24h/24)
              </span>
            </div>
            <div className="flex items-center gap-2 bg-surface/90 border border-surface-border rounded-xl p-1.5 shrink-0">
              <span className="font-mono text-[11px] text-slate-200 px-2 truncate max-w-[220px] sm:max-w-none">
                {SERVICE_ACCOUNT_EMAIL}
              </span>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white shadow hover:opacity-95 transition"
              >
                {copiedEmail ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-300" />
                    <span>Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copier</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4 Étapes Visuelles Rapides */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="rounded-xl border border-surface-border bg-surface/50 p-2">
              <span className="text-[9.5px] font-bold text-indigo-400 uppercase tracking-wider block">
                Étape 1
              </span>
              <p className="text-[11px] text-slate-300 font-medium">Ouvrez le Sheet</p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface/50 p-2">
              <span className="text-[9.5px] font-bold text-indigo-400 uppercase tracking-wider block">
                Étape 2
              </span>
              <p className="text-[11px] text-slate-300 font-medium">Cliquez Partager</p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface/50 p-2">
              <span className="text-[9.5px] font-bold text-indigo-400 uppercase tracking-wider block">
                Étape 3
              </span>
              <p className="text-[11px] text-slate-300 font-medium">
                Ajoutez en <strong className="text-emerald-300">Éditeur</strong>
              </p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface/50 p-2">
              <span className="text-[9.5px] font-bold text-indigo-400 uppercase tracking-wider block">
                Étape 4
              </span>
              <p className="text-[11px] text-slate-300 font-medium">Collez le lien &amp; Testez</p>
            </div>
          </div>
        </div>

        {/* 2. Liste des Tableurs Actuellement Rattachés */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>Tableurs Connectés ({team.sheetIds.length} / {MAX_SHEETS_PER_TEAM})</span>
          </div>

          {team.sheetIds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-border bg-surface/30 p-4 text-center text-xs text-slate-400">
              Aucun tableur rattaché à {team.name}. Collez l'URL d'un tableur pour démarrer.
            </div>
          ) : (
            <ul className="space-y-2">
              {team.sheetIds.map((id, idx) => (
                <li
                  key={id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface/60 px-3.5 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-500/15 font-mono text-[10px] font-bold text-emerald-400">
                      #{idx + 1}
                    </span>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${id}/edit`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 font-mono text-slate-200 hover:text-brand truncate"
                    >
                      <span className="truncate">{id}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-slate-500" />
                    </a>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => setConfirmRemoveSheetId(id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Retirer</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 3. Formulaire d'Ajout & Diagnostic des Colonnes */}
        {team.sheetIds.length < MAX_SHEETS_PER_TEAM && (
          <div className="space-y-3 pt-2 border-t border-surface-border">
            <label className="block text-xs font-semibold text-slate-300">
              Coller le lien de votre feuille Google Sheets :
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={sheetInput}
                disabled={busy || !!shopifyActiveInfo || testing}
                onChange={(e) => setSheetInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit"
                className="flex-1 rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand disabled:opacity-50"
              />

              <button
                disabled={busy || !sheetInput.trim() || !!shopifyActiveInfo || testing}
                onClick={handleTestConnection}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20 transition disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
                <span>{testing ? "Analyse…" : "Tester"}</span>
              </button>

              <button
                disabled={busy || !sheetInput.trim() || !!shopifyActiveInfo || testing}
                onClick={handleAddSheet}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-hover disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Connecter</span>
              </button>
            </div>

            {/* Diagnostic Test Résultat */}
            {testResult && (
              <div
                className={`rounded-2xl border p-4 text-xs space-y-3 ${
                  testResult.success
                    ? "border-emerald-500/30 bg-emerald-500/10 text-slate-200"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">
                        {testResult.success
                          ? `Feuille validée : "${testResult.title}"`
                          : "Échec de connexion au Google Sheet"}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{testResult.message}</p>
                    </div>
                  </div>

                  {testResult.success && sheetInput.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        const id = extractSheetId(sheetInput);
                        if (id) handleAddSheetWithId(id);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 transition shrink-0"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Valider &amp; Rattacher</span>
                    </button>
                  )}
                </div>

                {testResult.success && testResult.detectedColumns && (
                  <div className="rounded-xl border border-surface-border bg-surface/70 p-3 space-y-2">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
                      Colonnes détectées sur la feuille :
                    </span>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span
                        className={`rounded-lg px-2 py-0.5 font-semibold ${
                          testResult.detectedColumns.phone
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.phone ? "✓ Téléphone" : "— Téléphone"}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-0.5 font-semibold ${
                          testResult.detectedColumns.clientName
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.clientName ? "✓ Nom Client" : "— Nom"}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-0.5 font-semibold ${
                          testResult.detectedColumns.city
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.city ? "✓ Ville" : "— Ville"}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-0.5 font-semibold ${
                          testResult.detectedColumns.amount
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.amount ? "✓ Montant COD" : "— Montant"}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-0.5 font-semibold ${
                          testResult.detectedColumns.product
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.product ? "✓ Produit" : "— Produit"}
                      </span>
                      <span className="rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 font-semibold">
                        ✓ Statut WariTrack ({testResult.statusColLetter || "Col Statut"})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        <ConfirmDialog
          open={!!confirmRemoveSheetId}
          title="Retirer ce tableur Google Sheets ?"
          message={`Le tableur ne sera plus synchronisé avec l'équipe ${team.name}.`}
          confirmLabel="Retirer le tableur"
          danger={true}
          loading={busy}
          onConfirm={async () => {
            if (!confirmRemoveSheetId) return;
            const target = confirmRemoveSheetId;
            setConfirmRemoveSheetId(null);
            await handleRemoveSheet(target);
          }}
          onCancel={() => setConfirmRemoveSheetId(null)}
        />
      </div>
    </div>
  );
}
