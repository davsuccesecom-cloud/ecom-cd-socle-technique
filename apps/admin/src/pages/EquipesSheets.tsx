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
  ExternalLink,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import CreateTeamForm from "../components/CreateTeamForm";
import AfricaInteractiveMap from "../components/AfricaInteractiveMap";
import { AFRICA_GEO, COUNTRY_ISO2_TO_ISO3 } from "../data/africaGeo";
import { formatFirebaseError } from "../lib/firebaseErrors";
import "./EquipesSheets.css";

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

function getCitiesForRegion(countryCode: string, regionIndex: number): string {
  const iso3 = COUNTRY_ISO2_TO_ISO3[countryCode] || "TGO";
  const cities = AFRICA_GEO.ct[iso3];
  if (!cities || cities.length === 0) {
    return "Aucune ville spécifique répertoriée — la localisation des commandes décidera de l'acheminement.";
  }
  const matching = cities.filter((c) => c[3] === regionIndex).map((c) => c[0]);
  if (matching.length === 0) {
    return "Aucune ville spécifique répertoriée pour cette zone — acheminement automatique selon l'adresse saisie.";
  }
  return `Villes principales : ${matching.join(", ")}`;
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
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 2400);
  };

  const handleCopyServiceEmail = () => {
    try {
      navigator.clipboard.writeText(SERVICE_ACCOUNT_EMAIL);
      setCopiedEmail(true);
      showToast("Adresse du robot WariTrack copiée !");
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch {
      showToast("Erreur lors de la copie");
    }
  };

  // Écoute des connexions Shopify par équipe
  const [shopifyByTeam, setShopifyByTeam] = useState<Record<string, string>>({});

  useEffect(() => {
    const db = getDb();
    const connCol = collection(db, "workspaces", workspaceId, "shopifyConnections");
    const unsub = onSnapshot(connCol, (snap) => {
      const map: Record<string, string> = {};
      snap.forEach((d) => {
        const c = d.data();
        if (c.status === "active") {
          if (c.ownerTeamId) {
            map[c.ownerTeamId] = `${c.shopDomain} (Propriétaire)`;
          }
          if (c.countryRoutes) {
            Object.entries(c.countryRoutes).forEach(([code, r]: any) => {
              if (r.assignedTeamId && r.status === "active") {
                map[r.assignedTeamId] = `${c.shopDomain} (Flux délégué ${code})`;
              }
            });
          }
        }
      });
      setShopifyByTeam(map);
    });
    return () => unsub();
  }, [workspaceId]);

  // Écoute des commandes récentes de la boutique
  const [realOrders, setRealOrders] = useState<any[]>([]);

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
      const count = teamOrders.filter((o) => {
        const cityStr = (o.customerCity || o.villeQuartier || "").toLowerCase();
        const cityObj = cities.find(
          ([cn]) => cityStr.includes(cn.toLowerCase()) || cn.toLowerCase().includes(cityStr)
        );
        if (cityObj) return cityObj[3] === idx;
        return idx === 0;
      }).length;

      const share = teamOrders.length > 0 ? count / teamOrders.length : 0;
      return {
        index: idx,
        name: r.n,
        ordersCount: count,
        share,
        estimatedDeliveryTime: 25 + ((idx * 13) % 40),
      };
    });
  }, [selectedTeam, realOrders]);

  // Données de Sparkline fluide
  const sparklineData = useMemo(() => {
    const points: number[] = [];
    const ordersCount = selectedTeam ? teamMetrics.ordersCount : realOrders.length;
    const seed = selectedTeam ? (selectedTeam.name.charCodeAt(0) || 7) : 11;

    for (let i = 0; i < 12; i++) {
      if (ordersCount === 0) {
        points.push(0.4);
      } else {
        const val = Math.max(1, (ordersCount / 10) * (1 + 0.45 * Math.sin(i * 0.9 + seed)));
        points.push(val);
      }
    }
    const maxVal = Math.max(...points, 1);
    const line = points
      .map((y, i) => `${i === 0 ? "M" : "L"}${((i * 100) / 11).toFixed(1)} ${(30 - (y / maxVal) * 26).toFixed(1)}`)
      .join(" ");

    return {
      line,
      area: `${line} L100 32 L0 32 Z`,
    };
  }, [selectedTeam, teamMetrics, realOrders]);

  // Événements récents en direct (ticker)
  const recentEvents = useMemo(() => {
    const filtered = realOrders.filter(
      (o) => !selectedTeam || o.teamId === selectedTeam.id
    );

    return filtered.slice(0, 5).map((ord) => {
      const status = (ord.status || "").toLowerCase();
      const isDelivered = ["livre", "livree", "encaisse"].includes(status);
      const isRejected = ["annule", "annulee", "refuse", "injoignable", "retourne"].includes(status);
      const color = isDelivered ? "var(--ok)" : isRejected ? "#ef4444" : "var(--wn)";

      const statusLabel = isDelivered
        ? "Livrée"
        : isRejected
        ? "Annulée"
        : "En cours";

      const num = ord.orderNumber ? `#${ord.orderNumber}` : `#${ord.id.slice(0, 5)}`;
      const city = ord.customerCity || ord.villeQuartier || "Lomé";
      const text = `${num} · ${city} (${statusLabel})`;

      let timeStr = "Récemment";
      if (ord.timestamps?.received) {
        const d = new Date(ord.timestamps.received);
        timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }

      return {
        id: ord.id,
        color,
        text,
        time: timeStr,
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
    <div className="equipes-wrap">
      {/* 1. En-tête avec KPIs Panafricains */}
      <header>
        <div>
          <h1>Équipes &amp; Marchés</h1>
          <div className="sub">
            Choisissez une équipe, suivez ses zones et son trafic d’opérations en direct.
          </div>
        </div>
        <div className="kp">
          <div>
            <b>{teams.length}</b>
            <span>Équipes</span>
          </div>
          <div>
            <b>{new Set(teams.map((t) => t.defaultCountry)).size}</b>
            <span>Pays</span>
          </div>
          <div>
            <b style={{ color: "var(--ok)" }}>{realOrders.length}</b>
            <span>Commandes suivies</span>
          </div>
        </div>
      </header>

      {/* 2. Rail horizontal de navigation des équipes */}
      <div className="rail">
        <button
          type="button"
          className={`tab ${selectedTeamId === null ? "on" : ""}`}
          onClick={() => {
            setSelectedTeamId(null);
            setSelectedRegionIndex(null);
          }}
        >
          <span className="f">🌍</span>
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
              className={`tab ${isSel ? "on" : ""}`}
              onClick={() => {
                setSelectedTeamId(t.id);
                setSelectedRegionIndex(null);
              }}
            >
              <span className="f">{flagFor(t.defaultCountry)}</span>
              <span>{t.name}</span>
              <small>{orderCount}</small>
              <s
                className={hasLiveFeed ? "" : "w"}
                title={hasLiveFeed ? "Flux de données actif" : "À configurer"}
              />
            </button>
          );
        })}

        <span className="sep" />
        <button
          type="button"
          className="pri"
          onClick={() => setShowCreate(true)}
        >
          ＋ Nouvelle équipe
        </button>
      </div>

      {/* 3. Grille Principale (Carte Interactive & Panneau d'Opérations) */}
      <div className="grid">
        <AfricaInteractiveMap
          teams={teams}
          selectedTeam={selectedTeam}
          onSelectTeam={(tId) => setSelectedTeamId(tId)}
          selectedRegionIndex={selectedRegionIndex}
          onSelectRegionIndex={(rIdx) => setSelectedRegionIndex(rIdx)}
          orders={realOrders}
        />

        <aside id="side">
          {selectedTeam ? (
            <>
              {/* Carte 1 : Identité & Métriques Terrain */}
              <div className="card">
                <div className="th">
                  <div className="big">{flagFor(selectedTeam.defaultCountry)}</div>
                  <div>
                    <h2>{selectedTeam.name}</h2>
                    <p>
                      {countryFor(selectedTeam.defaultCountry)?.name} · Devise{" "}
                      <span style={{ fontWeight: 700, color: "var(--ink)" }}>
                        {selectedTeam.currency}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="row">
                  {shopifyByTeam[selectedTeam.id] ? (
                    <span className="bd">● Shopify temps réel</span>
                  ) : (
                    <span className="bd w">● Shopify en veille</span>
                  )}
                  {selectedTeam.sheetIds.length > 0 && (
                    <span className="bd b">
                      {selectedTeam.sheetIds.length} tableur
                      {selectedTeam.sheetIds.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="k3">
                  <div>
                    <b>{teamMetrics.ordersCount}</b>
                    <span>Commandes</span>
                  </div>
                  <div>
                    <b style={{ color: "var(--ok)" }}>{teamMetrics.deliveryRate}%</b>
                    <span>Livrées</span>
                  </div>
                  <div>
                    <b>{teamMetrics.cashTotal.toLocaleString("fr-FR")}</b>
                    <span>{selectedTeam.currency} encaissés</span>
                  </div>
                </div>
              </div>

              {/* Carte 2 : Flux par Localisation */}
              <div className="card">
                <h3>
                  <span>Flux par localisation</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--mut)" }}>
                    {regionalDistribution.length} zone{regionalDistribution.length > 1 ? "s" : ""}
                  </span>
                </h3>
                <p className="note">
                  Chaque commande est localisée à sa création, rattachée à une zone, puis acheminée
                  vers l’équipe terrain de cette zone.
                </p>

                {regionalDistribution.slice(0, 6).map((z) => (
                  <button
                    key={z.index}
                    type="button"
                    className={`zr ${selectedRegionIndex === z.index ? "on" : ""}`}
                    onClick={() =>
                      setSelectedRegionIndex(selectedRegionIndex === z.index ? null : z.index)
                    }
                  >
                    <div>
                      <span>{z.name}</span>
                      <small>
                        {z.ordersCount} cmd · ~{z.estimatedDeliveryTime} min
                      </small>
                    </div>
                    <div className="bar">
                      <u style={{ width: `${Math.max(6, Math.round(z.share * 100))}%` }} />
                    </div>
                  </button>
                ))}

                {regionalDistribution.length > 6 && (
                  <p className="note" style={{ marginTop: "8px" }}>
                    + {regionalDistribution.length - 6} autres zones
                  </p>
                )}

                {selectedRegionIndex !== null && (
                  <div className="zd">
                    <b>{regionalDistribution[selectedRegionIndex]?.name}</b>
                    <p>{getCitiesForRegion(selectedTeam.defaultCountry, selectedRegionIndex)}</p>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setSelectedRegionIndex(null)}
                    >
                      Toutes les zones
                    </button>
                  </div>
                )}
              </div>

              {/* Carte 3 : Trafic d'Opérations */}
              <div className="card">
                <h3>
                  <span>Trafic d’opérations</span>
                  <span className="live">En direct</span>
                </h3>

                <svg className="sp" viewBox="0 0 100 32" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="spg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--br)" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="var(--br)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={sparklineData.area} fill="url(#spg)" />
                  <path
                    d={sparklineData.line}
                    fill="none"
                    stroke="var(--br)"
                    strokeWidth="1.6"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                <ul className="ev">
                  {recentEvents.map((e) => (
                    <li key={e.id}>
                      <s style={{ background: e.color }} />
                      <span>{e.text}</span>
                      <em>{e.time}</em>
                    </li>
                  ))}
                  {recentEvents.length === 0 && (
                    <li style={{ opacity: 0.7 }}>
                      <s style={{ background: "var(--mut)" }} />
                      <span>En attente des premières commandes synchronisées</span>
                      <em>--:--</em>
                    </li>
                  )}
                </ul>
              </div>

              {/* Carte 4 : Connecteurs & Tableurs */}
              <div className="card">
                <h3>Connexions &amp; Tableurs</h3>

                {/* Google Sheets */}
                <div className="cn">
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <img
                      src="/icons/google-sheets.png"
                      alt="Google Sheets"
                      style={{
                        width: "24px",
                        height: "24px",
                        objectFit: "contain",
                        borderRadius: "5px",
                      }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "13px" }}>Google Sheets</div>
                      <div style={{ fontSize: "11px", color: "var(--mut)" }}>
                        {selectedTeam.sheetIds.length} tableur
                        {selectedTeam.sheetIds.length > 1 ? "s" : ""} rattaché
                        {selectedTeam.sheetIds.length > 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {selectedTeam.sheetIds.length > 0 && (
                      <span className="bd b">
                        {selectedTeam.sheetIds.length} actif
                        {selectedTeam.sheetIds.length > 1 ? "s" : ""}
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setShowSheetsModal(true)}
                    >
                      {selectedTeam.sheetIds.length > 0 ? "Gérer" : "Connecter"}
                    </button>
                  </div>
                </div>

                {/* Shopify */}
                <div className="cn">
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <Store style={{ width: "20px", height: "20px", color: "var(--mut)" }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "13px" }}>Boutique Shopify</div>
                      <div style={{ fontSize: "11px", color: "var(--mut)" }}>
                        {shopifyByTeam[selectedTeam.id] || "Aucun flux rattaché"}
                      </div>
                    </div>
                  </div>

                  {shopifyByTeam[selectedTeam.id] ? (
                    <span className="bd">Actif</span>
                  ) : (
                    <span className="bd w">Non configuré</span>
                  )}
                </div>

                {/* Compte Robot WariTrack */}
                <div className="cn">
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: "2px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--mut)" }}>
                      Robot de synchronisation 24h/24 :
                    </span>
                    <code title={SERVICE_ACCOUNT_EMAIL}>{SERVICE_ACCOUNT_EMAIL}</code>
                  </div>

                  <button
                    type="button"
                    className="btn"
                    onClick={handleCopyServiceEmail}
                  >
                    {copiedEmail ? <Check style={{ width: "13px", height: "13px", color: "var(--ok)" }} /> : <Copy style={{ width: "13px", height: "13px" }} />}
                    <span>{copiedEmail ? "Copié" : "Copier"}</span>
                  </button>
                </div>
              </div>

              {/* Carte 5 : Équipes du même pays */}
              <div className="card">
                <h3>Équipes du même pays</h3>
                {peerTeams.length > 0 ? (
                  <div className="mini">
                    {peerTeams.map((pt) => {
                      const pOrders = realOrders.filter((o) => o.teamId === pt.id).length;
                      return (
                        <button
                          key={pt.id}
                          type="button"
                          className="mc"
                          onClick={() => {
                            setSelectedTeamId(pt.id);
                            setSelectedRegionIndex(null);
                          }}
                        >
                          <span className="f">{flagFor(pt.defaultCountry)}</span>
                          <div>
                            <b>{pt.name}</b>
                            <span>{pOrders} cmd</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="note">
                    Aucune autre équipe active en {countryFor(selectedTeam.defaultCountry)?.name}.
                  </p>
                )}
              </div>
            </>
          ) : (
            /* Mode Supervision Panafricaine */
            <>
              <div className="card">
                <div className="ph">
                  <div className="big">🌍</div>
                  <h2
                    style={{
                      margin: "6px 0",
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "var(--ink)",
                    }}
                  >
                    Supervision Panafricaine
                  </h2>
                  <p className="note">
                    Sélectionnez une équipe dans la barre supérieure ou touchez un pays sur la
                    carte pour zoomer sur sa zone d'action et piloter ses flux logistiques.
                  </p>
                </div>
              </div>

              <div className="card">
                <h3>Marchés actifs ({teams.length})</h3>
                {teams.map((tm) => {
                  const cnt = realOrders.filter((o) => o.teamId === tm.id).length;
                  return (
                    <button
                      key={tm.id}
                      type="button"
                      className="zr"
                      onClick={() => setSelectedTeamId(tm.id)}
                    >
                      <div>
                        <span>
                          {flagFor(tm.defaultCountry)} {tm.name}
                        </span>
                        <small>
                          {cnt} commande{cnt > 1 ? "s" : ""}
                        </small>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Toast Flottant de Confirmation */}
      <div className={`eq-toast ${toastMsg ? "s" : ""}`}>
        <CheckCircle2 style={{ width: "16px", height: "16px", color: "var(--ok)" }} />
        <span>{toastMsg}</span>
      </div>

      {/* Modal Connecteur Google Sheets */}
      {showSheetsModal && selectedTeam && (
        <GoogleSheetsManagerModal
          workspaceId={workspaceId}
          team={selectedTeam}
          shopifyActiveInfo={shopifyByTeam[selectedTeam.id] ?? null}
          onClose={() => setShowSheetsModal(false)}
        />
      )}

      {/* Modal Création Nouveau Marché */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-6 shadow-2xl">
            <CreateTeamForm
              workspaceId={workspaceId}
              onCreated={(newTeamId) => {
                setSelectedTeamId(newTeamId);
                setShowCreate(false);
                showToast("Nouvelle équipe créée avec succès");
              }}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Modal spécialisé de configuration & diagnostic Google Sheets (Light & Dark Compliant)
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
    try {
      navigator.clipboard.writeText(SERVICE_ACCOUNT_EMAIL);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch {
      // Ignored
    }
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
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-6 shadow-2xl space-y-5 my-8 text-slate-900 dark:text-[#eef0ff]">
        {/* En-tête avec Logo Google Sheets */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-[#242849] pb-4">
          <div className="flex items-center gap-3">
            <img
              src="/icons/google-sheets.png"
              alt="Google Sheets"
              className="h-10 w-10 object-contain rounded-xl shadow-md"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Assistant de Connexion Google Sheets — {team.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Synchronisation automatique continue et numérisation des commandes terrain.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-[#0b0d1c] border border-slate-200 dark:border-[#242849] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 1. Compte de Service & Adresse Robot 24h/24 */}
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/25 bg-indigo-50/70 dark:bg-indigo-500/10 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-200">
                Adresse Robot WariTrack (Compte de Service 24h/24)
              </span>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-[#0b0d1c] border border-slate-200 dark:border-[#242849] rounded-xl p-1.5 shrink-0">
              <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 px-2 truncate max-w-[220px] sm:max-w-none">
                {SERVICE_ACCOUNT_EMAIL}
              </span>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition"
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
            <div className="rounded-xl border border-slate-200 dark:border-[#2a3060] bg-white/80 dark:bg-[#1a1e3f] p-2">
              <span className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                Étape 1
              </span>
              <p className="text-[11px] text-slate-800 dark:text-slate-300 font-medium">Ouvrez le Sheet</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-[#2a3060] bg-white/80 dark:bg-[#1a1e3f] p-2">
              <span className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                Étape 2
              </span>
              <p className="text-[11px] text-slate-800 dark:text-slate-300 font-medium">Cliquez Partager</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-[#2a3060] bg-white/80 dark:bg-[#1a1e3f] p-2">
              <span className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                Étape 3
              </span>
              <p className="text-[11px] text-slate-800 dark:text-slate-300 font-medium">
                Ajoutez en <strong className="text-emerald-600 dark:text-emerald-300">Éditeur</strong>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-[#2a3060] bg-white/80 dark:bg-[#1a1e3f] p-2">
              <span className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                Étape 4
              </span>
              <p className="text-[11px] text-slate-800 dark:text-slate-300 font-medium">Collez le lien &amp; Testez</p>
            </div>
          </div>
        </div>

        {/* 2. Liste des Tableurs Actuellement Rattachés */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>
              Tableurs Connectés ({team.sheetIds.length} / {MAX_SHEETS_PER_TEAM})
            </span>
          </div>

          {team.sheetIds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-[#282d5a] bg-slate-50 dark:bg-[#10132b] p-4 text-center text-xs text-slate-500 dark:text-slate-400">
              Aucun tableur rattaché à {team.name}. Collez l'URL d'un tableur pour démarrer.
            </div>
          ) : (
            <ul className="space-y-2">
              {team.sheetIds.map((id, idx) => (
                <li
                  key={id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-[#282d5a] bg-slate-50 dark:bg-[#1b1f40] px-3.5 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-500/15 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      #{idx + 1}
                    </span>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${id}/edit`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 font-mono text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate"
                    >
                      <span className="truncate">{id}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                    </a>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => setConfirmRemoveSheetId(id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition disabled:opacity-50"
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
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-[#242849]">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Coller le lien de votre feuille Google Sheets :
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={sheetInput}
                disabled={busy || !!shopifyActiveInfo || testing}
                onChange={(e) => setSheetInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit"
                className="flex-1 rounded-xl border border-slate-300 dark:border-[#242849] bg-white dark:bg-[#0b0d1c] px-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none placeholder:text-slate-400 focus:border-indigo-500 disabled:opacity-50"
              />

              <button
                disabled={busy || !sheetInput.trim() || !!shopifyActiveInfo || testing}
                onClick={handleTestConnection}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/15 px-4 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
                <span>{testing ? "Analyse…" : "Tester"}</span>
              </button>

              <button
                disabled={busy || !sheetInput.trim() || !!shopifyActiveInfo || testing}
                onClick={handleAddSheet}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40"
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
                    ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-slate-900 dark:text-slate-200"
                    : "border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {testResult.success
                          ? `Feuille validée : "${testResult.title}"`
                          : "Échec de connexion au Google Sheet"}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        {testResult.message}
                      </p>
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
                  <div className="rounded-xl border border-slate-200 dark:border-[#242849] bg-white/90 dark:bg-[#0b0d1c] p-3 space-y-2">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Colonnes détectées sur la feuille :
                    </span>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span
                        className={`rounded-lg px-2 py-0.5 font-semibold ${
                          testResult.detectedColumns.phone
                            ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.phone ? "✓ Téléphone" : "— Téléphone"}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-0.5 font-semibold ${
                          testResult.detectedColumns.clientName
                            ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.clientName ? "✓ Nom Client" : "— Nom"}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-0.5 font-semibold ${
                          testResult.detectedColumns.city
                            ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.city ? "✓ Ville" : "— Ville"}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-0.5 font-semibold ${
                          testResult.detectedColumns.amount
                            ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.amount ? "✓ Montant COD" : "— Montant"}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-0.5 font-semibold ${
                          testResult.detectedColumns.product
                            ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}
                      >
                        {testResult.detectedColumns.product ? "✓ Produit" : "— Produit"}
                      </span>
                      <span className="rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/40 px-2 py-0.5 font-semibold">
                        ✓ Statut WariTrack ({testResult.statusColLetter || "Col Statut"})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-800 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
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
