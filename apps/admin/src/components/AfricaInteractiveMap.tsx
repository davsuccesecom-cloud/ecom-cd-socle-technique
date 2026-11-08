import { useState, useMemo, useEffect, useRef } from "react";
import type { Team } from "@ecomcod/shared";
import {
  AFRICA_GEO,
  COUNTRY_ISO2_TO_ISO3,
  getSvgPathBoundingBox,
} from "../data/africaGeo";
import {
  MessageCircle,
  ExternalLink,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  X,
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
  timestamp: number;
  regionIndex?: number;
}

interface AfricaInteractiveMapProps {
  teams: Team[];
  selectedTeam: Team | null;
  onSelectTeam: (teamId: string | null) => void;
  selectedRegionIndex: number | null;
  onSelectRegionIndex: (regionIndex: number | null) => void;
  orders: any[];
  activeRegions?: number[];
  onToggleRegion?: (regionIndex: number) => void;
}

const W = 1000;
const H = 700;

// Configuration des pays et capitales hubs
export const COUNTRY_META: Record<
  string,
  { iso3: string; name: string; flag: string; cur: string }
> = {
  TG: { iso3: "TGO", name: "Togo", flag: "🇹🇬", cur: "XOF" },
  BJ: { iso3: "BEN", name: "Bénin", flag: "🇧🇯", cur: "XOF" },
  BF: { iso3: "BFA", name: "Burkina Faso", flag: "🇧🇫", cur: "XOF" },
  CI: { iso3: "CIV", name: "Côte d’Ivoire", flag: "🇨🇮", cur: "XOF" },
  SN: { iso3: "SEN", name: "Sénégal", flag: "🇸🇳", cur: "XOF" },
  GH: { iso3: "GHA", name: "Ghana", flag: "🇬🇭", cur: "GHS" },
  NG: { iso3: "NGA", name: "Nigeria", flag: "🇳🇬", cur: "NGN" },
  CM: { iso3: "CMR", name: "Cameroun", flag: "🇨🇲", cur: "XAF" },
  ML: { iso3: "MLI", name: "Mali", flag: "🇲🇱", cur: "XOF" },
};

// Résolution de coordonnées ville par analyse textuelle
function resolveCityCoords(
  countryIso3: string,
  cityName: string | undefined,
  orderId: string
): { x: number; y: number; regionIndex?: number } | null {
  const cities = AFRICA_GEO.ct[countryIso3];
  if (!cities || cities.length === 0) return null;

  const raw = (cityName || "").toLowerCase().trim();

  // Pseudo hash pour décaler les points d'une même ville
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
      /adidogome|ago[eè]|b[eè]|hedzranawoe|tokoin|kodjoviakope|kegue|totsi|amoutive|baguida|cacaveli|avepozo|nyekonakpoe/.test(
        raw
      )
    ) {
      return { x: 364.2 + jitterX, y: 303.2 + jitterY, regionIndex: 4 };
    }
    // Alias béninois rattachés à Cotonou / Abomey-Calavi
    if (
      countryIso3 === "BEN" &&
      /akpakpa|cadjehoun|fidjrosse|menontin|kouhounou|agla|gbegamey|zogbo|calavi|godomey|tankpe/.test(
        raw
      )
    ) {
      return { x: 375.4 + jitterX, y: 301.0 + jitterY, regionIndex: 11 };
    }
    // Alias ivoiriens rattachés à Abidjan
    if (
      countryIso3 === "CIV" &&
      /cocody|yopougon|marcory|plateau|treichville|koumassi|abobo|adjame|port-bouet|bingerville/.test(
        raw
      )
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
  const [, hx, hy, hri] = cities[0];
  return { x: hx + jitterX * 1.5, y: hy + jitterY * 1.5, regionIndex: hri };
}

// Catégorisation standard COD
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
  return "in_progress";
}

export default function AfricaInteractiveMap({
  teams,
  selectedTeam,
  onSelectTeam,
  selectedRegionIndex,
  onSelectRegionIndex,
  orders,
  activeRegions,
  onToggleRegion,
}: AfricaInteractiveMapProps) {
  const [activeTooltipPoint, setActiveTooltipPoint] = useState<MappedOrderPoint | null>(null);
  const [ripples, setRipples] = useState<{ id: string; x: number; y: number }[]>([]);
  const lastProcessedOrderTimeRef = useRef<number>(Date.now());

  // Pays actif ISO-3
  const activeIso3 = useMemo(() => {
    if (!selectedTeam) return null;
    return COUNTRY_ISO2_TO_ISO3[selectedTeam.defaultCountry] || null;
  }, [selectedTeam]);

  // Bounding box des pays précalculée
  const countryBounds = useMemo(() => {
    const map: Record<string, { cx: number; cy: number; k: number }> = {};
    for (const [iso2, meta] of Object.entries(COUNTRY_META)) {
      const path = AFRICA_GEO.w[meta.iso3];
      if (path) {
        const [minX, minY, maxX, maxY] = getSvgPathBoundingBox(path);
        const spanX = Math.max(maxX - minX, 10);
        const spanY = Math.max(maxY - minY, 10);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        // Zoom optimal remplissant 80% du stage avec confort visuel
        const k = Math.min(12, (W * 0.78) / spanX, (H * 0.8) / spanY);
        map[meta.iso3] = { cx, cy, k };
      }
    }
    return map;
  }, []);

  // Calcul du Smart Zoom
  const V = useMemo(() => {
    if (!activeIso3 || !countryBounds[activeIso3]) {
      return { k: 1, tx: 0, ty: 0 };
    }
    const { cx, cy, k } = countryBounds[activeIso3];
    return {
      k,
      tx: W / 2 - k * cx,
      ty: H / 2 - k * cy,
    };
  }, [activeIso3, countryBounds]);

  // Points de commandes réels mappés
  const mappedPoints = useMemo<MappedOrderPoint[]>(() => {
    if (!orders || orders.length === 0) return [];
    const result: MappedOrderPoint[] = [];

    for (const ord of orders) {
      const orderTeam = teams.find((t) => t.id === ord.teamId);
      const iso2 = orderTeam?.defaultCountry || ord.customerCountry || "TG";
      const iso3 = COUNTRY_ISO2_TO_ISO3[iso2] || "TGO";

      // Filtre si une équipe est active
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

  // Animation ripple sur les nouveaux arrivages de commandes
  useEffect(() => {
    if (mappedPoints.length === 0) return;
    const latest = mappedPoints[0];
    if (latest && latest.timestamp > lastProcessedOrderTimeRef.current) {
      lastProcessedOrderTimeRef.current = latest.timestamp;
      const ripId = `rip-${Date.now()}`;
      setRipples((prev) => [...prev.slice(-4), { id: ripId, x: latest.x, y: latest.y }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== ripId));
      }, 1800);
    }
  }, [mappedPoints]);

  // Régions actives du pays
  const regionsList = useMemo(() => {
    if (!activeIso3 || !AFRICA_GEO.r[activeIso3]) return [];
    return AFRICA_GEO.r[activeIso3];
  }, [activeIso3]);

  // Villes du pays actif
  const citiesList = useMemo(() => {
    if (!activeIso3 || !AFRICA_GEO.ct[activeIso3]) return [];
    return AFRICA_GEO.ct[activeIso3];
  }, [activeIso3]);

  // Hub principal (première ville listée, ex: Lomé pour TGO, Cotonou pour BEN)
  const hubCity = useMemo(() => {
    return citiesList.length > 0 ? citiesList[0] : null;
  }, [citiesList]);

  // Calcul des flux d'acheminement vers le hub
  const flowCurves = useMemo(() => {
    if (!hubCity || !activeIso3) return [];
    const [, hx, hy, hri] = hubCity;

    // Regrouper les villes par région pour créer les courbes
    const curves: { id: string; d: string }[] = [];
    const seenRegions = new Set<number>();

    citiesList.forEach((c) => {
      const [, cx, cy, ri] = c;
      if (ri !== hri && !seenRegions.has(ri)) {
        seenRegions.add(ri);
        const dx = hx - cx;
        const dy = hy - cy;
        // Courbe de Bézier quadratique élégante
        const qx = (cx + hx) / 2 - dy * 0.22;
        const qy = (cy + hy) / 2 + dx * 0.22;
        curves.push({
          id: `fx-${ri}`,
          d: `M${cx} ${cy}Q${qx} ${qy} ${hx} ${hy}`,
        });
      }
    });

    return curves;
  }, [hubCity, activeIso3, citiesList]);

  // Ensemble des pays couverts par au moins une équipe
  const coveredIso3Set = useMemo(() => {
    const s = new Set<string>();
    teams.forEach((t) => {
      const iso3 = COUNTRY_ISO2_TO_ISO3[t.defaultCountry];
      if (iso3) s.add(iso3);
    });
    return s;
  }, [teams]);

  // Regroupement des équipes par pays pour le mode Toute l'Afrique
  const teamsByCountry = useMemo(() => {
    const map: Record<string, Team[]> = {};
    teams.forEach((t) => {
      const iso2 = t.defaultCountry;
      if (!map[iso2]) map[iso2] = [];
      map[iso2].push(t);
    });
    return map;
  }, [teams]);

  // Formule de projection SVG vers écran
  const pos = (x: number, y: number) => ({
    left: `${((V.tx + V.k * x) / W) * 100}%`,
    top: `${((V.ty + V.k * y) / H) * 100}%`,
  });

  return (
    <div className="stage" id="stage">
      {/* Canvas SVG de la carte */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-label="Carte de l’Afrique">
        <g id="g" style={{ transform: `translate(${V.tx}px, ${V.ty}px) scale(${V.k})` }}>
          {/* 1. Contours continentaux de tous les pays africains */}
          <g id="land">
            {Object.entries(AFRICA_GEO.w).map(([iso3, d]) => {
              const isSelectedCountry = activeIso3 === iso3;
              const hasTeam = coveredIso3Set.has(iso3);
              const isDimmed = activeIso3 !== null && !isSelectedCountry;

              let className = "ct";
              if (hasTeam && !activeIso3) className += " has";
              if (isSelectedCountry) className += " sel";
              if (isDimmed) className += " dim";

              return (
                <path
                  key={iso3}
                  className={className}
                  d={d}
                  onClick={() => {
                    if (!activeIso3 && hasTeam) {
                      const t = teams.find((x) => COUNTRY_ISO2_TO_ISO3[x.defaultCountry] === iso3);
                      if (t) onSelectTeam(t.id);
                    }
                  }}
                />
              );
            })}
          </g>

          {/* 2. Subdivisions régionales du pays sélectionné */}
          {activeIso3 && (
            <g id="reg">
              {regionsList.map((r, i) => {
                const isActive = activeRegions ? activeRegions.includes(i) : true;
                const isFocused = selectedRegionIndex === i;

                let cls = "rg";
                if (isActive) cls += " on";
                if (isFocused) cls += " z";

                return (
                  <path
                    key={i}
                    className={cls}
                    d={r.d}
                    style={isActive ? { fillOpacity: isFocused ? 0.45 : 0.22 } : undefined}
                    onClick={() => {
                      onSelectRegionIndex(selectedRegionIndex === i ? null : i);
                    }}
                  >
                    <title>{r.n}</title>
                  </path>
                );
              })}
            </g>
          )}

          {/* 3. Lignes de flux logistiques animées vers le hub */}
          {activeIso3 && (
            <g id="flux">
              {flowCurves.map((curve) => (
                <path key={curve.id} className="fx" d={curve.d} />
              ))}
            </g>
          )}
        </g>
      </svg>

      {/* Overlay HTML pour les pins, villes, badges et points réels */}
      <div id="ov2">
        {/* A. Mode Vue Toute l'Afrique : Pins pays */}
        {!selectedTeam &&
          Object.entries(teamsByCountry).map(([cc, teamGroup]) => {
            const meta = COUNTRY_META[cc];
            const bounds = meta ? countryBounds[meta.iso3] : null;
            if (!bounds) return null;
            const primaryTeam = teamGroup[0];

            return (
              <button
                key={cc}
                type="button"
                className="pin"
                style={pos(bounds.cx, bounds.cy)}
                onClick={() => onSelectTeam(primaryTeam.id)}
              >
                <span className="fl">{meta.flag}</span>
                <b>{meta.name}</b>
                {teamGroup.length > 1 && <i>{teamGroup.length}</i>}
              </button>
            );
          })}

        {/* B. Mode Pays Sélectionné : Villes & Badges du Hub */}
        {selectedTeam &&
          citiesList.map((city, idx) => {
            const [cityName, cx, cy, ri] = city;
            const isHub = idx === 0;
            const isFocusedRegion = selectedRegionIndex === ri;

            // Nombre de commandes pour cette ville
            const cityOrdersCount = mappedPoints.filter((p) =>
              p.city.toLowerCase().includes(cityName.toLowerCase())
            ).length;

            return (
              <button
                key={cityName}
                type="button"
                className={`cty ${isHub || isFocusedRegion ? "a" : ""}`}
                style={pos(cx, cy)}
                onClick={() => onSelectRegionIndex(selectedRegionIndex === ri ? null : ri)}
              >
                <s></s>
                <span>{cityName}</span>
                {cityOrdersCount > 0 && <i>{cityOrdersCount}</i>}
              </button>
            );
          })}

        {/* C. Points de Commandes COD réels en direct (🟠 En cours, 🟢 Livrées, 🔴 Annulées) */}
        {mappedPoints.map((pt) => (
          <button
            key={pt.id}
            type="button"
            className={`cod-dot ${pt.status}`}
            style={pos(pt.x, pt.y)}
            onClick={() => setActiveTooltipPoint(pt)}
            title={`${pt.orderNumber} · ${pt.clientName} (${pt.city})`}
          />
        ))}

        {/* D. Radar Pulse / Ripples lors d'activités récentes */}
        {ripples.map((rip) => (
          <span key={rip.id} className="rip" style={pos(rip.x, rip.y)} />
        ))}
      </div>

      {/* Chips de navigation supérieure gauche */}
      <div className="chip">
        {selectedTeam ? (
          <>
            <button type="button" onClick={() => onSelectTeam(null)}>
              ← Afrique
            </button>
            <span>
              {COUNTRY_META[selectedTeam.defaultCountry]?.flag || "📍"}{" "}
              {COUNTRY_META[selectedTeam.defaultCountry]?.name || selectedTeam.name}
            </span>
          </>
        ) : (
          <span>🌍 Afrique · {new Set(teams.map((t) => t.defaultCountry)).size} pays actifs</span>
        )}
      </div>

      {/* Mini-map Afrique en bas à droite pour repérage géographique et reset rapide */}
      {selectedTeam && (
        <div
          className="mi"
          style={{ display: "block" }}
          title="Retour à la vue panafricaine"
          onClick={() => onSelectTeam(null)}
        >
          <svg viewBox="160 0 680 700">
            {Object.entries(AFRICA_GEO.w).map(([iso3, d]) => (
              <path key={iso3} className={`ci ${activeIso3 === iso3 ? "on" : ""}`} d={d} />
            ))}
          </svg>
        </div>
      )}

      {/* Légende opérationnelle en bas à gauche */}
      <div className="leg">
        <u>Zone dans le flux</u>
        <u className="l">Acheminement hub</u>
        <span className="hidden sm:inline-flex items-center gap-2">
          <span>🟠 En cours</span>
          <span>🟢 Livrée</span>
          <span>🔴 Annulée</span>
        </span>
      </div>

      {/* Popover / Tooltip détaillé d'une commande COD sélectionnée */}
      {activeTooltipPoint && (
        <div
          className="absolute z-50 rounded-2xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-4 shadow-2xl backdrop-blur-md text-xs"
          style={{
            ...pos(activeTooltipPoint.x, activeTooltipPoint.y),
            transform: "translate(-50%, -115%)",
            width: "270px",
            color: "var(--ink)",
          }}
        >
          <div className="flex items-center justify-between border-b border-surface-border/60 pb-2 mb-2">
            <span className="font-bold text-sm text-brand">{activeTooltipPoint.orderNumber}</span>
            <button
              type="button"
              onClick={() => setActiveTooltipPoint(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <p className="font-semibold">{activeTooltipPoint.clientName}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>
                {activeTooltipPoint.city}
                {activeTooltipPoint.address ? ` · ${activeTooltipPoint.address}` : ""}
              </span>
            </p>
            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
              {activeTooltipPoint.quantity}x {activeTooltipPoint.product}
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="font-bold text-sm tabular-nums">
                {activeTooltipPoint.amount.toLocaleString("fr-FR")} {activeTooltipPoint.currency}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  activeTooltipPoint.status === "delivered"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : activeTooltipPoint.status === "rejected"
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                }`}
              >
                {activeTooltipPoint.status === "delivered"
                  ? "Livrée"
                  : activeTooltipPoint.status === "rejected"
                  ? "Annulée / Rejetée"
                  : "En cours"}
              </span>
            </div>

            {activeTooltipPoint.phone && (
              <a
                href={`https://wa.me/${activeTooltipPoint.phone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-1.5 font-bold text-white hover:bg-emerald-500 transition text-[11px]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>WhatsApp Direct</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
