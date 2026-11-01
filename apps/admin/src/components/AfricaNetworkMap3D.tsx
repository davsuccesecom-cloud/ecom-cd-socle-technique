import { useState, useMemo, useRef } from "react";
import { ShieldCheck, Truck, PhoneCall, Globe2, Share2 } from "lucide-react";

export interface AfricanHub {
  code: string;
  name: string;
  capital: string;
  flag: string;
  currency: string;
  dialCode: string;
  x: number;
  y: number;
  confirmRate: string;
  deliveryTime: string;
  capiStatus: string;
}

export const AFRICAN_COD_HUBS: AfricanHub[] = [
  {
    code: "TG",
    name: "Togo",
    capital: "Lomé",
    flag: "🇹🇬",
    currency: "XOF",
    dialCode: "+228",
    x: 244,
    y: 282,
    confirmRate: "91%",
    deliveryTime: "3h 40m",
    capiStatus: "Purchase Livré Actif",
  },
  {
    code: "BJ",
    name: "Bénin",
    capital: "Cotonou",
    flag: "🇧🇯",
    currency: "XOF",
    dialCode: "+229",
    x: 256,
    y: 280,
    confirmRate: "89%",
    deliveryTime: "4h 10m",
    capiStatus: "Purchase Livré Actif",
  },
  {
    code: "CI",
    name: "Côte d'Ivoire",
    capital: "Abidjan",
    flag: "🇨🇮",
    currency: "XOF",
    dialCode: "+225",
    x: 204,
    y: 288,
    confirmRate: "88%",
    deliveryTime: "4h 25m",
    capiStatus: "Purchase Livré Actif",
  },
  {
    code: "SN",
    name: "Sénégal",
    capital: "Dakar",
    flag: "🇸🇳",
    currency: "XOF",
    dialCode: "+221",
    x: 132,
    y: 226,
    confirmRate: "90%",
    deliveryTime: "3h 55m",
    capiStatus: "Purchase Livré Actif",
  },
  {
    code: "BF",
    name: "Burkina Faso",
    capital: "Ouagadougou",
    flag: "🇧🇫",
    currency: "XOF",
    dialCode: "+226",
    x: 226,
    y: 246,
    confirmRate: "87%",
    deliveryTime: "4h 30m",
    capiStatus: "Purchase Livré Actif",
  },
  {
    code: "ML",
    name: "Mali",
    capital: "Bamako",
    flag: "🇲🇱",
    currency: "XOF",
    dialCode: "+223",
    x: 184,
    y: 238,
    confirmRate: "86%",
    deliveryTime: "4h 45m",
    capiStatus: "Purchase Livré Actif",
  },
  {
    code: "GN",
    name: "Guinée",
    capital: "Conakry",
    flag: "🇬🇳",
    currency: "GNF",
    dialCode: "+224",
    x: 154,
    y: 262,
    confirmRate: "85%",
    deliveryTime: "5h 00m",
    capiStatus: "Purchase Livré Actif",
  },
  {
    code: "NE",
    name: "Niger",
    capital: "Niamey",
    flag: "🇳🇪",
    currency: "XOF",
    dialCode: "+227",
    x: 258,
    y: 232,
    confirmRate: "86%",
    deliveryTime: "4h 50m",
    capiStatus: "Purchase Livré Actif",
  },
  {
    code: "CM",
    name: "Cameroun",
    capital: "Douala / Yaoundé",
    flag: "🇨🇲",
    currency: "XAF",
    dialCode: "+237",
    x: 306,
    y: 304,
    confirmRate: "88%",
    deliveryTime: "4h 15m",
    capiStatus: "Purchase Livré Actif",
  },
  {
    code: "GA",
    name: "Gabon",
    capital: "Libreville",
    flag: "🇬🇦",
    currency: "XAF",
    dialCode: "+241",
    x: 302,
    y: 344,
    confirmRate: "89%",
    deliveryTime: "3h 50m",
    capiStatus: "Purchase Livré Actif",
  },
];

// Polygone géographique précis du continent Africain (viewBox 0 0 600 640)
const AFRICA_POLYGON: [number, number][] = [
  [215, 58],
  [268, 52],
  [310, 62],
  [325, 78],
  [372, 74],
  [428, 86],
  [448, 130],
  [468, 178],
  [490, 218],
  [544, 232],
  [524, 282],
  [485, 326],
  [480, 368],
  [456, 405],
  [460, 444],
  [425, 488],
  [408, 538],
  [372, 578],
  [334, 582],
  [316, 540],
  [304, 488],
  [294, 435],
  [312, 392],
  [294, 344],
  [298, 308],
  [268, 294],
  [234, 294],
  [192, 298],
  [156, 276],
  [128, 240],
  [126, 204],
  [142, 162],
  [168, 118],
  [188, 76],
];

// Madagascar polygon
const MADAGASCAR_POLYGON: [number, number][] = [
  [506, 438],
  [522, 448],
  [514, 502],
  [496, 534],
  [484, 520],
  [492, 472],
];

function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export default function AfricaNetworkMap3D() {
  const [selectedHub, setSelectedHub] = useState<AfricanHub>(AFRICAN_COD_HUBS[0]);
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 8, ry: -8 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Génère la matrice de points (symbole de l'Afrique en pointillés haute précision)
  const dots = useMemo(() => {
    const pts: { x: number; y: number; isWestCentralZone: boolean }[] = [];
    const step = 12;
    for (let y = 50; y <= 590; y += step) {
      for (let x = 120; x <= 550; x += step) {
        // Léger décalage hexagonal une ligne sur deux
        const offsetX = (Math.floor(y / step) % 2) * (step / 2);
        const px = x + offsetX;
        if (pointInPolygon(px, y, AFRICA_POLYGON) || pointInPolygon(px, y, MADAGASCAR_POLYGON)) {
          const isWestCentralZone = px >= 125 && px <= 335 && y >= 195 && y <= 365;
          pts.push({ x: px, y, isWestCentralZone });
        }
      }
    }
    return pts;
  }, []);

  const outlinePath = useMemo(() => {
    return (
      AFRICA_POLYGON.map((pt, idx) => `${idx === 0 ? "M" : "L"}${pt[0]} ${pt[1]}`).join(" ") +
      " Z " +
      MADAGASCAR_POLYGON.map((pt, idx) => `${idx === 0 ? "M" : "L"}${pt[0]} ${pt[1]}`).join(" ") +
      " Z"
    );
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Math.max(-14, Math.min(14, -ny * 20)),
      ry: Math.max(-14, Math.min(14, nx * 20)),
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 8, ry: -8 });
  };

  // Arcs de connexion depuis le hub actif vers les autres capitales
  const connectionArcs = useMemo(() => {
    return AFRICAN_COD_HUBS.filter((h) => h.code !== selectedHub.code).map((target) => {
      const mx = (selectedHub.x + target.x) / 2;
      const my = Math.min(selectedHub.y, target.y) - 38;
      return {
        id: `${selectedHub.code}-${target.code}`,
        d: `M ${selectedHub.x} ${selectedHub.y} Q ${mx} ${my} ${target.x} ${target.y}`,
        target,
      };
    });
  }, [selectedHub]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative select-none"
      style={{ perspective: "1200px" }}
    >
      {/* Halo lumineux 3D d'arrière-plan */}
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand/25 via-emerald-500/10 to-amber-500/15 blur-2xl opacity-75" />

      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b101d]/90 p-5 shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out"
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Barre supérieure du radar Afrique */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-slate-100 uppercase">
              Réseau Pan-Africain Ecom COD • Temps Réel
            </span>
          </div>
          <span className="rounded-full border border-brand/40 bg-brand/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-brand">
            10 Hubs COD Connectés
          </span>
        </div>

        <div className="grid grid-cols-1 items-center gap-4 pt-3 lg:grid-cols-12">
          {/* Carte de l'Afrique en Pointillés 3D */}
          <div className="relative flex items-center justify-center lg:col-span-7">
            <svg
              viewBox="95 35 470 565"
              className="h-[340px] w-full max-w-[400px] drop-shadow-[0_0_25px_rgba(99,102,241,0.28)] sm:h-[380px]"
              aria-label="Carte de l'Afrique en pointillés avec hubs logistiques COD"
            >
              <defs>
                <radialGradient id="africaGlow" cx="42%" cy="46%" r="55%">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.32" />
                  <stop offset="60%" stopColor="#10b981" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#090d16" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.95" />
                  <stop offset="50%" stopColor="var(--brand)" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.35" />
                </linearGradient>
              </defs>

              {/* Aura énergétique sous l'Afrique de l'Ouest & Centrale */}
              <circle cx="245" cy="275" r="175" fill="url(#africaGlow)" />

              {/* Anneaux radar concentriques */}
              <circle
                cx={selectedHub.x}
                cy={selectedHub.y}
                r="65"
                fill="none"
                stroke="var(--brand)"
                strokeOpacity="0.18"
                strokeDasharray="3 5"
              />
              <circle
                cx={selectedHub.x}
                cy={selectedHub.y}
                r="125"
                fill="none"
                stroke="#10b981"
                strokeOpacity="0.12"
                strokeDasharray="2 6"
              />

              {/* Contour subtil en pointillés fins du continent Africain */}
              <path
                d={outlinePath}
                fill="rgba(99, 102, 241, 0.04)"
                stroke="rgba(148, 163, 184, 0.28)"
                strokeWidth="1.4"
                strokeDasharray="3 4"
                strokeLinejoin="round"
              />

              {/* Matrice complète de l'Afrique en pointillés lumineux */}
              {dots.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r={pt.isWestCentralZone ? 2.3 : 1.7}
                  fill={pt.isWestCentralZone ? "#818cf8" : "#64748b"}
                  fillOpacity={pt.isWestCentralZone ? 0.65 : 0.32}
                />
              ))}

              {/* Arcs laser de synchronisation entre le Hub actif et les autres marchés */}
              {connectionArcs.map((arc) => (
                <g key={arc.id}>
                  <path
                    d={arc.d}
                    fill="none"
                    stroke="url(#arcGrad)"
                    strokeWidth="1.6"
                    strokeDasharray="4 4"
                  />
                </g>
              ))}

              {/* Points des 10 Hubs COD interactifs */}
              {AFRICAN_COD_HUBS.map((hub) => {
                const isSelected = hub.code === selectedHub.code;
                return (
                  <g
                    key={hub.code}
                    className="cursor-pointer"
                    onClick={() => setSelectedHub(hub)}
                    onMouseEnter={() => setSelectedHub(hub)}
                  >
                    {isSelected && (
                      <>
                        <circle
                          cx={hub.x}
                          cy={hub.y}
                          r="16"
                          fill="#10b981"
                          fillOpacity="0.2"
                        />
                        <circle
                          cx={hub.x}
                          cy={hub.y}
                          r="10"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="1.5"
                          strokeOpacity="0.8"
                        />
                      </>
                    )}
                    <circle
                      cx={hub.x}
                      cy={hub.y}
                      r={isSelected ? 5.5 : 3.8}
                      fill={isSelected ? "#10b981" : "#f59e0b"}
                      stroke="#090d16"
                      strokeWidth="1.5"
                    />
                    {isSelected && (
                      <g transform={`translate(${hub.x + 10}, ${hub.y - 12})`}>
                        <rect
                          x="0"
                          y="-12"
                          width="96"
                          height="22"
                          rx="6"
                          fill="#0f172a"
                          stroke="#10b981"
                          strokeWidth="1"
                          strokeOpacity="0.6"
                        />
                        <text
                          x="8"
                          y="3"
                          fill="#f8fafc"
                          fontSize="10"
                          fontWeight="700"
                          fontFamily="sans-serif"
                        >
                          {hub.code} • {hub.capital}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Panneau Holographique 3D du Marché Sélectionné */}
          <div className="space-y-3 lg:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{selectedHub.flag}</span>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Hub {selectedHub.name} ({selectedHub.capital})
                    </h4>
                    <p className="font-mono text-[11px] text-slate-400">
                      Indicatif {selectedHub.dialCode} • Devise {selectedHub.currency}
                    </p>
                  </div>
                </div>
                <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-300">
                  LIVE
                </span>
              </div>

              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-white/10 bg-[#090d16]/70 p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <PhoneCall className="h-3 w-3 text-brand" />
                    <span>Closing Moyen</span>
                  </div>
                  <p className="mt-1 font-mono text-base font-bold text-white">
                    {selectedHub.confirmRate}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#090d16]/70 p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Truck className="h-3 w-3 text-emerald-400" />
                    <span>Délai Livraison</span>
                  </div>
                  <p className="mt-1 font-mono text-base font-bold text-emerald-400">
                    {selectedHub.deliveryTime}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-[11px]">
                <span className="flex items-center gap-1.5 text-slate-200">
                  <Share2 className="h-3.5 w-3.5 text-brand" />
                  <span>Meta CAPI Server-Side</span>
                </span>
                <span className="font-mono font-semibold text-emerald-300">
                  {selectedHub.capiStatus}
                </span>
              </div>
            </div>

            {/* Sélecteur rapide de pays */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <Globe2 className="h-3.5 w-3.5 text-brand" />
                <span>Cliquez sur un marché africain pour inspecter le flux :</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {AFRICAN_COD_HUBS.map((hub) => {
                  const active = hub.code === selectedHub.code;
                  return (
                    <button
                      key={hub.code}
                      type="button"
                      onClick={() => setSelectedHub(hub)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                        active
                          ? "border-emerald-400/60 bg-emerald-500/20 text-white shadow-sm"
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-200"
                      }`}
                    >
                      <span>{hub.flag}</span>
                      <span>{hub.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                Isolation multi-équipes native : chaque pays possède sa propre caisse, ses closeuses et son Pixel Meta dédié.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
