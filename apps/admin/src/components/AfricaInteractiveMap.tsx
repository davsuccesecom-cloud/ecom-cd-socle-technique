import { useState, useMemo } from "react";
import type { Team } from "@ecomcod/shared";
import {
  AFRICA_GEO,
  COUNTRY_ISO2_TO_ISO3,
  COUNTRY_ISO3_TO_ISO2,
  getSvgPathBoundingBox,
} from "../data/africaGeo";
import {
  ArrowLeft,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  MessageCircle,
  Eye,
  Layers,
  MapPin,
  TrendingUp,
} from "lucide-react";

export type OrderPointStatus = "in_progress" | "delivered" | "rejected";

export interface MappedOrderPoint {
  id: string;
  orderNumber: string;
  clientName: string;
  phone: string;
  city: string;
  address?: string;
  product: string;
  quantity: number;
  amount: number;
  currency: string;
  status: OrderPointStatus;
  rawStatus: string;
  x: number;
  y: number;
  timestamp?: number;
  regionIndex?: number;
}

interface AfricaInteractiveMapProps {
  teams: Team[];
  selectedTeam: Team | null;
  onSelectTeam: (teamId: string | null) => void;
  selectedRegionIndex: number | null;
  onSelectRegionIndex: (regionIndex: number | null) => void;
  orders: any[];
}

const W = 1000;
const H = 700;
const MAX_ZOOM_LIMIT = 7.5; // Plafond maximal de zoom pour éviter toute distorsion excessive

// Résolution de coordonnées ville par analyse textuelle
function resolveCityCoords(
  countryIso3: string,
  cityName: string | undefined,
  orderId: string
): { x: number; y: number; regionIndex?: number } | null {
  const cities = AFRICA_GEO.ct[countryIso3];
  if (!cities || cities.length === 0) return null;

  const raw = (cityName || "").toLowerCase().trim();

  // Pseudo hash pour décaler légèrement les points d'une même ville
  const hash = [...orderId].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) % 1000, 0);
  const jitterX = ((hash % 100) / 50 - 1) * 0.9;
  const jitterY = (((Math.floor(hash / 100)) % 100) / 50 - 1) * 0.9;

  if (raw) {
    for (const [name, cx, cy, ri] of cities) {
      const n = name.toLowerCase();
      if (raw.includes(n) || n.includes(raw)) {
        return { x: cx + jitterX, y: cy + jitterY, regionIndex: ri };
      }
    }
    // Alias togolais fréquents rattachés au grand Lomé
    if (
      countryIso3 === "TGO" &&
      /adidogome|ago[eè]|b[eè]|hedzranawoe|tokoin|kodjoviakope|kegue|totsi|amoutive|baguida|cacaveli|avepozo|nyekonakpoe/.test(raw)
    ) {
      return { x: 364.2 + jitterX, y: 303.2 + jitterY, regionIndex: 4 };
    }
    // Alias béninois rattachés à Cotonou / Abomey-Calavi
    if (
      countryIso3 === "BEN" &&
      /akpakpa|cadjehoun|fidjrosse|menontin|kouhounou|agla|gbegamey|zogbo|calavi|godomey|tankpe/.test(raw)
    ) {
      return { x: 375.4 + jitterX, y: 301.0 + jitterY, regionIndex: 11 };
    }
    // Alias ivoiriens rattachés à Abidjan
    if (
      countryIso3 === "CIV" &&
      /cocody|yopougon|marcory|plateau|treichville|koumassi|abobo|adjame|port-bouet|bingerville/.test(raw)
    ) {
      return { x: 316.1 + jitterX, y: 310.3 + jitterY, regionIndex: 10 };
    }
    // Alias sénégalais rattachés à Dakar
    if (
      countryIso3 === "SEN" &&
      /almadies|mermoz|ouakam|pikine|guediawaye|rufisque|parcelles|yoff|point e/.test(raw)
    ) {
      return { x: 192.3 + jitterX, y: 224.2 + jitterY, regionIndex: 13 };
    }
    // Alias burkinabé rattachés à Ouaga
    if (
      countryIso3 === "BFA" &&
      /karpala|ouaga 2000|saaba|tampouy|somgande|dassasgho|pissy|gounghin/.test(raw)
    ) {
      return { x: 339.0 + jitterX, y: 245.8 + jitterY, regionIndex: 33 };
    }
  }

  // Par défaut, centre sur la première ville (capitale / hub) avec jitter
  const [hubName, hx, hy, hri] = cities[0];
  return { x: hx + jitterX * 1.5, y: hy + jitterY * 1.5, regionIndex: hri };
}

// Catégorisation standard COD des statuts
function categorizeStatus(status: string | undefined): OrderPointStatus {
  const s = (status || "").toLowerCase().trim();
  if (["livre", "livree", "encaisse", "remis_au_client", "solde"].includes(s)) {
    return "delivered";
  }
  if (
    [
      "annule",
      "annulee",
      "refuse",
      "refusee",
      "injoignable",
      "retourne",
      "retournee",
      "echec",
      "perdu",
    ].includes(s)
  ) {
    return "rejected";
  }
  return "in_progress"; // nouveau, assigne, en_cours, relance, confirme, reprogramme, reporte
}

export default function AfricaInteractiveMap({
  teams,
  selectedTeam,
  onSelectTeam,
  selectedRegionIndex,
  onSelectRegionIndex,
  orders,
}: AfricaInteractiveMapProps) {
  const [hoveredPoint, setHoveredPoint] = useState<MappedOrderPoint | null>(null);
  const [activeTooltipPoint, setActiveTooltipPoint] = useState<MappedOrderPoint | null>(null);

  // Pays actif ISO-3
  const activeIso3 = useMemo(() => {
    if (!selectedTeam) return null;
    return COUNTRY_ISO2_TO_ISO3[selectedTeam.defaultCountry] || null;
  }, [selectedTeam]);

  // Ensemble des pays couverts par au moins une équipe
  const coveredIso3Set = useMemo(() => {
    const s = new Set<string>();
    teams.forEach((t) => {
      const iso3 = COUNTRY_ISO2_TO_ISO3[t.defaultCountry];
      if (iso3) s.add(iso3);
    });
    return s;
  }, [teams]);

  // Points de commandes mappés
  const mappedPoints = useMemo<MappedOrderPoint[]>(() => {
    if (!orders || orders.length === 0) return [];
    const result: MappedOrderPoint[] = [];

    for (const ord of orders) {
      // Détermination du pays de la commande
      const orderTeam = teams.find((t) => t.id === ord.teamId);
      const iso2 = orderTeam?.defaultCountry || ord.customerCountry || "TG";
      const iso3 = COUNTRY_ISO2_TO_ISO3[iso2] || "TGO";

      // Si une équipe est sélectionnée et que la commande n'appartient pas à cette équipe, on la filtre
      if (selectedTeam && ord.teamId && ord.teamId !== selectedTeam.id) {
        continue;
      }

      const cityStr = ord.customerCity || ord.villeQuartier || ord.city || "";
      const coords = resolveCityCoords(iso3, cityStr, ord.id);
      if (!coords) continue;

      const cat = categorizeStatus(ord.status);
      const cur = orderTeam?.currency || ord.currency || "XOF";

      result.push({
        id: ord.id,
        orderNumber: ord.orderNumber ? `#${ord.orderNumber}` : `#${ord.id.slice(0, 6)}`,
        clientName: ord.customerName || ord.nomClient || "Client",
        phone: ord.customerPhone || ord.telephone || "",
        city: cityStr || "Zone Urbaine",
        address: ord.customerAddress || ord.adresseRepere || "",
        product: ord.productName || ord.produit || "Produit",
        quantity: ord.quantity || ord.quantite || 1,
        amount: ord.totalAmount || ord.montant || 0,
        currency: cur,
        status: cat,
        rawStatus: ord.status || "nouveau",
        x: coords.x,
        y: coords.y,
        timestamp: ord.timestamps?.received || ord.createdAt || Date.now(),
        regionIndex: coords.regionIndex,
      });
    }

    return result;
  }, [orders, teams, selectedTeam]);

  // Calcul du Smart Zoom & Bounding Box avec limitation stricte (Anti-Slop & Confort visuel)
  const viewTransform = useMemo(() => {
    if (!activeIso3 || !AFRICA_GEO.w[activeIso3]) {
      return { k: 1, tx: 0, ty: 0 };
    }

    const countryPath = AFRICA_GEO.w[activeIso3];
    const [cMinX, cMinY, cMaxX, cMaxY] = getSvgPathBoundingBox(countryPath);

    // Si une région spécifique est sélectionnée, on ajuste le cadrage vers cette zone
    let targetMinX = cMinX;
    let targetMinY = cMinY;
    let targetMaxX = cMaxX;
    let targetMaxY = cMaxY;

    if (
      selectedRegionIndex !== null &&
      AFRICA_GEO.r[activeIso3] &&
      AFRICA_GEO.r[activeIso3][selectedRegionIndex]
    ) {
      const regPath = AFRICA_GEO.r[activeIso3][selectedRegionIndex].d;
      const [rMinX, rMinY, rMaxX, rMaxY] = getSvgPathBoundingBox(regPath);
      // Élargit le cadre de la région pour conserver le contexte
      const padX = (rMaxX - rMinX) * 0.4;
      const padY = (rMaxY - rMinY) * 0.4;
      targetMinX = Math.max(cMinX, rMinX - padX);
      targetMinY = Math.max(cMinY, rMinY - padY);
      targetMaxX = Math.min(cMaxX, rMaxX + padX);
      targetMaxY = Math.min(cMaxY, rMaxY + padY);
    }

    const spanX = Math.max(targetMaxX - targetMinX, 15);
    const spanY = Math.max(targetMaxY - targetMinY, 15);

    // Application du facteur de zoom plafonné à MAX_ZOOM_LIMIT (ex. 7.5x max)
    const rawK = Math.min((W * 0.72) / spanX, (H * 0.75) / spanY);
    const k = Math.min(MAX_ZOOM_LIMIT, Math.max(1.8, rawK));

    const cx = (targetMinX + targetMaxX) / 2;
    const cy = (targetMinY + targetMaxY) / 2;

    const tx = W / 2 - k * cx;
    const ty = H / 2 - k * cy;

    return { k, tx, ty };
  }, [activeIso3, selectedRegionIndex]);

  // Calcul du flux logistique vers la capitale / hub
  const activeHubCity = useMemo(() => {
    if (!activeIso3) return null;
    const cities = AFRICA_GEO.ct[activeIso3];
    return cities && cities.length > 0 ? cities[0] : null;
  }, [activeIso3]);

  // Statistiques en direct des points
  const pointsStats = useMemo(() => {
    let inProgress = 0;
    let delivered = 0;
    let rejected = 0;
    mappedPoints.forEach((p) => {
      if (p.status === "in_progress") inProgress++;
      else if (p.status === "delivered") delivered++;
      else if (p.status === "rejected") rejected++;
    });
    return { inProgress, delivered, rejected, total: mappedPoints.length };
  }, [mappedPoints]);

  return (
    <div className="relative aspect-[1000/680] w-full overflow-hidden rounded-3xl border border-surface-border bg-[#0b0e1d] shadow-2xl select-none">
      {/* Grille cartographique subtile d'arrière-plan */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* SVG Canvas Carte */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          {/* Ligne animée pour les flux logistiques */}
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        <g
          id="africa-group"
          style={{
            transform: `translate(${viewTransform.tx}px, ${viewTransform.ty}px) scale(${viewTransform.k})`,
            transformOrigin: "0 0",
            transition: "transform 0.9s cubic-bezier(0.65, 0, 0.25, 1)",
          }}
        >
          {/* 1. Tous les pays africains (Contours continentaux) */}
          <g id="african-countries">
            {Object.entries(AFRICA_GEO.w).map(([iso3, pathD]) => {
              const isSelected = activeIso3 === iso3;
              const hasTeam = coveredIso3Set.has(iso3);
              const isDimmed = activeIso3 && !isSelected;

              return (
                <path
                  key={iso3}
                  d={pathD}
                  onClick={() => {
                    if (isSelected) {
                      onSelectTeam(null);
                      onSelectRegionIndex(null);
                    } else if (hasTeam) {
                      const iso2 = COUNTRY_ISO3_TO_ISO2[iso3];
                      const team = teams.find((t) => t.defaultCountry === iso2);
                      if (team) {
                        onSelectTeam(team.id);
                        onSelectRegionIndex(null);
                      }
                    }
                  }}
                  className={`transition-colors duration-500 vector-effect-non-scaling-stroke ${
                    isSelected
                      ? "fill-[#191d3e] stroke-brand stroke-[1.2]"
                      : hasTeam
                      ? "cursor-pointer fill-[#1e2348] stroke-[#333a6b] stroke-[0.8] hover:fill-[#2d346b]"
                      : isDimmed
                      ? "fill-[#111428] stroke-[#1b203d] stroke-[0.5] opacity-35"
                      : "fill-[#151933] stroke-[#242b52] stroke-[0.6]"
                  }`}
                />
              );
            })}
          </g>

          {/* 2. Subdivisions régionales du pays actif */}
          {activeIso3 && AFRICA_GEO.r[activeIso3] && (
            <g id="active-country-regions">
              {AFRICA_GEO.r[activeIso3].map((reg, ri) => {
                const isRegionSelected = selectedRegionIndex === ri;
                const regPointsCount = mappedPoints.filter((p) => p.regionIndex === ri).length;
                const opacity = isRegionSelected
                  ? 0.45
                  : regPointsCount > 0
                  ? Math.min(0.35, 0.12 + regPointsCount * 0.04)
                  : 0.06;

                return (
                  <path
                    key={ri}
                    d={reg.d}
                    onClick={() => {
                      onSelectRegionIndex(isRegionSelected ? null : ri);
                    }}
                    style={{ fillOpacity: opacity }}
                    className={`cursor-pointer transition-all duration-300 vector-effect-non-scaling-stroke ${
                      isRegionSelected
                        ? "fill-brand stroke-brand stroke-[1.6]"
                        : "fill-indigo-500 stroke-[#3c457c] stroke-[0.75] hover:fill-indigo-400 hover:fill-opacity-40"
                    }`}
                  >
                    <title>{reg.n}</title>
                  </path>
                );
              })}
            </g>
          )}

          {/* 3. Lignes de flux logistiques vers le Hub / Capitale */}
          {activeIso3 && activeHubCity && (
            <g id="operational-flux">
              {AFRICA_GEO.ct[activeIso3]?.map(([cityName, cx, cy], idx) => {
                if (idx === 0) return null; // Hub lui-même
                const hx = activeHubCity[1];
                const hy = activeHubCity[2];
                const dx = hx - cx;
                const dy = hy - cy;
                const midX = (cx + hx) / 2 - dy * 0.18;
                const midY = (cy + hy) / 2 + dx * 0.18;

                return (
                  <path
                    key={cityName}
                    d={`M ${cx} ${cy} Q ${midX} ${midY} ${hx} ${hy}`}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="1.2"
                    strokeDasharray="3 6"
                    className="animate-[dash_1.5s_linear_infinite] opacity-60 pointer-events-none vector-effect-non-scaling-stroke"
                  />
                );
              })}
            </g>
          )}

          {/* 4. Points de commandes réelles (Color-coding COD standard) */}
          <g id="order-markers">
            {mappedPoints.map((pt) => {
              const isHovered = hoveredPoint?.id === pt.id;
              const isSelectedPt = activeTooltipPoint?.id === pt.id;

              // 🟠 Orange: En cours / 🟢 Vert: Livré / 🔴 Rouge: Annulé
              const colorHex =
                pt.status === "delivered"
                  ? "#10b981"
                  : pt.status === "rejected"
                  ? "#ef4444"
                  : "#f97316";

              return (
                <g
                  key={pt.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTooltipPoint(isSelectedPt ? null : pt);
                  }}
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  {/* Halo d'expansion pulsant pour les commandes en cours */}
                  {pt.status === "in_progress" && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="3.5"
                      fill="none"
                      stroke={colorHex}
                      strokeWidth="0.8"
                      className="animate-ping opacity-60"
                    />
                  )}

                  {/* Anneau de sélection */}
                  {(isHovered || isSelectedPt) && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="0.9"
                    />
                  )}

                  {/* Point principal solide */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 2.5 : 2}
                    fill={colorHex}
                    stroke="#0b0e1d"
                    strokeWidth="0.5"
                    className="transition-transform duration-200"
                  />
                </g>
              );
            })}
          </g>

          {/* 5. Villes principales et indicateurs de hub */}
          {activeIso3 && AFRICA_GEO.ct[activeIso3] && (
            <g id="cities-anchors" className="pointer-events-none">
              {AFRICA_GEO.ct[activeIso3].map(([cityName, cx, cy], idx) => {
                const isHub = idx === 0;
                return (
                  <g key={cityName}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHub ? 1.4 : 0.9}
                      fill={isHub ? "#ffffff" : "#94a3b8"}
                      stroke="#0b0e1d"
                      strokeWidth="0.3"
                    />
                  </g>
                );
              })}
            </g>
          )}
        </g>
      </svg>

      {/* Overlays HTML interactifs positionnés */}
      {/* 1. Pastilles villes avec badges de commandes (quand zoomé) */}
      {activeIso3 && AFRICA_GEO.ct[activeIso3] && (
        <div className="pointer-events-none absolute inset-0">
          {AFRICA_GEO.ct[activeIso3].map(([cityName, cx, cy, ri]) => {
            const screenX = ((viewTransform.tx + viewTransform.k * cx) / W) * 100;
            const screenY = ((viewTransform.ty + viewTransform.k * cy) / H) * 100;

            // N'affiche que si visible à l'écran
            if (screenX < 3 || screenX > 97 || screenY < 3 || screenY > 97) return null;

            const cityPoints = mappedPoints.filter((p) => p.regionIndex === ri);
            const isRegionSelected = selectedRegionIndex === ri;

            return (
              <div
                key={cityName}
                style={{ left: `${screenX}%`, top: `${screenY}%` }}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 transition-transform hover:scale-105"
              >
                <button
                  type="button"
                  onClick={() => onSelectRegionIndex(isRegionSelected ? null : ri)}
                  className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md shadow-md transition ${
                    isRegionSelected
                      ? "border-brand bg-brand/30 text-white ring-2 ring-brand/40"
                      : "border-slate-700/80 bg-slate-900/85 text-slate-300 hover:border-slate-500 hover:text-white"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      cityPoints.length > 0 ? "bg-emerald-400" : "bg-slate-500"
                    }`}
                  />
                  <span>{cityName}</span>
                  {cityPoints.length > 0 && (
                    <span className="ml-0.5 rounded-full bg-brand px-1.5 py-0.2 text-[9.5px] font-bold text-white">
                      {cityPoints.length}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Pins continentaux quand dézoomé (Toute l'Afrique) */}
      {!activeIso3 && (
        <div className="pointer-events-none absolute inset-0">
          {teams.map((team) => {
            const iso3 = COUNTRY_ISO2_TO_ISO3[team.defaultCountry];
            if (!iso3 || !AFRICA_GEO.ct[iso3]) return null;

            const [capName, cx, cy] = AFRICA_GEO.ct[iso3][0];
            const screenX = (cx / W) * 100;
            const screenY = (cy / H) * 100;
            const teamPoints = mappedPoints.filter((p) => p.rawStatus);

            return (
              <button
                key={team.id}
                type="button"
                onClick={() => onSelectTeam(team.id)}
                style={{ left: `${screenX}%`, top: `${screenY}%` }}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/90 py-1 pl-1 pr-3 text-xs font-bold text-slate-100 shadow-xl backdrop-blur-md transition hover:scale-105 hover:border-brand hover:bg-slate-800"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-sm">
                  {team.defaultCountry === "TG"
                    ? "🇹🇬"
                    : team.defaultCountry === "BJ"
                    ? "🇧🇯"
                    : team.defaultCountry === "BF"
                    ? "🇧🇫"
                    : team.defaultCountry === "CI"
                    ? "🇨🇮"
                    : team.defaultCountry === "SN"
                    ? "🇸🇳"
                    : "📍"}
                </span>
                <span>{team.name}</span>
                <span className="rounded-full bg-indigo-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                  {teamPoints.length > 0 ? teamPoints.length : team.sheetIds.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Chip flottant Supérieur Gauche (Navigation & Contexte) */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        {selectedTeam ? (
          <>
            <button
              type="button"
              onClick={() => {
                onSelectTeam(null);
                onSelectRegionIndex(null);
                setActiveTooltipPoint(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/90 px-3.5 py-1.5 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur-md transition hover:border-brand hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Vue Afrique</span>
            </button>
            <span className="rounded-full border border-surface-border bg-slate-900/80 px-3 py-1.5 text-xs font-bold text-slate-100 shadow-lg backdrop-blur-md">
              {selectedTeam.defaultCountry === "TG"
                ? "🇹🇬 Togo"
                : selectedTeam.defaultCountry === "BJ"
                ? "🇧🇯 Bénin"
                : selectedTeam.defaultCountry === "BF"
                ? "🇧🇫 Burkina Faso"
                : selectedTeam.defaultCountry === "CI"
                ? "🇨🇮 Côte d'Ivoire"
                : selectedTeam.defaultCountry === "SN"
                ? "🇸🇳 Sénégal"
                : selectedTeam.name}
              {selectedRegionIndex !== null &&
                activeIso3 &&
                AFRICA_GEO.r[activeIso3] &&
                ` · ${AFRICA_GEO.r[activeIso3][selectedRegionIndex].n}`}
            </span>
          </>
        ) : (
          <span className="rounded-full border border-surface-border bg-slate-900/85 px-3.5 py-1.5 text-xs font-bold text-slate-200 shadow-lg backdrop-blur-md">
            🌍 Cartographie des Marchés COD · {teams.length} équipes
          </span>
        )}
      </div>

      {/* 4. Mini-Carte Flottante Inférieure Droite (Retour Afrique en 1 clic) */}
      {selectedTeam && (
        <button
          type="button"
          onClick={() => {
            onSelectTeam(null);
            onSelectRegionIndex(null);
            setActiveTooltipPoint(null);
          }}
          title="Revenir à la vue complète Afrique"
          className="group absolute bottom-4 right-4 z-20 h-24 w-24 rounded-2xl border border-slate-700/80 bg-slate-950/85 p-1.5 shadow-2xl backdrop-blur-md transition hover:scale-105 hover:border-brand"
        >
          <svg viewBox="160 0 680 700" className="h-full w-full">
            {Object.entries(AFRICA_GEO.w).map(([iso3, pathD]) => (
              <path
                key={iso3}
                d={pathD}
                className={
                  iso3 === activeIso3
                    ? "fill-brand"
                    : coveredIso3Set.has(iso3)
                    ? "fill-indigo-400/40"
                    : "fill-slate-700/40"
                }
              />
            ))}
          </svg>
          <span className="absolute bottom-1 inset-x-0 text-center text-[9px] font-bold text-slate-400 group-hover:text-slate-200">
            Vue Afrique
          </span>
        </button>
      )}

      {/* 5. Légende Inférieure Gauche (Anti-Slop, net et explicite) */}
      <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-surface-border bg-slate-950/80 px-3.5 py-2 text-[11px] font-semibold text-slate-300 shadow-xl backdrop-blur-md">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" />
          <span>En cours ({pointsStats.inProgress})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          <span>Livrées ({pointsStats.delivered})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
          <span>Rejets / Annulées ({pointsStats.rejected})</span>
        </span>
        {selectedTeam && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-400 border-l border-slate-700 pl-3">
            <span className="h-0 w-3 border-t border-dashed border-indigo-400" />
            <span>Flux d'acheminement</span>
          </span>
        )}
      </div>

      {/* 6. Popover Commande active / sélectionnée */}
      {activeTooltipPoint && (
        <div className="absolute top-16 right-4 z-30 w-72 rounded-2xl border border-surface-border bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-2 border-b border-surface-border pb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-brand">
                  {activeTooltipPoint.orderNumber}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                    activeTooltipPoint.status === "delivered"
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : activeTooltipPoint.status === "rejected"
                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      : "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                  }`}
                >
                  {activeTooltipPoint.rawStatus}
                </span>
              </div>
              <h4 className="mt-1 text-sm font-bold text-white">
                {activeTooltipPoint.clientName}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setActiveTooltipPoint(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="mt-2.5 space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Ville / Quartier :</span>
              <span className="font-semibold text-slate-200">{activeTooltipPoint.city}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Produit :</span>
              <span className="font-semibold text-slate-200 truncate max-w-[150px]">
                {activeTooltipPoint.quantity}x {activeTooltipPoint.product}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Montant :</span>
              <span className="font-bold text-emerald-400 tabular-nums">
                {activeTooltipPoint.amount.toLocaleString("fr-FR")} {activeTooltipPoint.currency}
              </span>
            </div>
          </div>

          {activeTooltipPoint.phone && (
            <div className="mt-3 pt-2.5 border-t border-surface-border">
              <a
                href={`https://wa.me/${activeTooltipPoint.phone.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Ouvrir WhatsApp ({activeTooltipPoint.phone})</span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
