import { useState, useMemo, useRef } from "react";
import { ShieldCheck, Truck, PhoneCall, Globe2, Share2, CheckCircle2, Activity, Zap } from "lucide-react";

export interface AfricanHub {
  code: string;
  name: string;
  capital: string;
  flag: string;
  currency: string;
  zone: string;
  dialCode: string;
  x: number;
  y: number;
  confirmRate: string;
  deliveryTime: string;
  capiStatus: string;
  activeCouriers: number;
  avgBasket: string;
}

export const AFRICAN_COD_HUBS: AfricanHub[] = [
  {
    code: "TG",
    name: "Togo",
    capital: "Lomé",
    flag: "🇹🇬",
    currency: "XOF",
    zone: "UEMOA",
    dialCode: "+228",
    x: 238,
    y: 284,
    confirmRate: "92%",
    deliveryTime: "3h 15m",
    capiStatus: "Purchase Server-Side Actif",
    activeCouriers: 18,
    avgBasket: "18 500 F",
  },
  {
    code: "BJ",
    name: "Bénin",
    capital: "Cotonou",
    flag: "🇧🇯",
    currency: "XOF",
    zone: "UEMOA",
    dialCode: "+229",
    x: 254,
    y: 282,
    confirmRate: "90%",
    deliveryTime: "3h 45m",
    capiStatus: "Purchase Server-Side Actif",
    activeCouriers: 24,
    avgBasket: "19 200 F",
  },
  {
    code: "CI",
    name: "Côte d'Ivoire",
    capital: "Abidjan",
    flag: "🇨🇮",
    currency: "XOF",
    zone: "UEMOA",
    dialCode: "+225",
    x: 198,
    y: 290,
    confirmRate: "89%",
    deliveryTime: "4h 10m",
    capiStatus: "Purchase Server-Side Actif",
    activeCouriers: 36,
    avgBasket: "22 000 F",
  },
  {
    code: "SN",
    name: "Sénégal",
    capital: "Dakar",
    flag: "🇸🇳",
    currency: "XOF",
    zone: "UEMOA",
    dialCode: "+221",
    x: 130,
    y: 226,
    confirmRate: "91%",
    deliveryTime: "3h 30m",
    capiStatus: "Purchase Server-Side Actif",
    activeCouriers: 28,
    avgBasket: "21 500 F",
  },
  {
    code: "BF",
    name: "Burkina Faso",
    capital: "Ouagadougou",
    flag: "🇧🇫",
    currency: "XOF",
    zone: "UEMOA",
    dialCode: "+226",
    x: 222,
    y: 248,
    confirmRate: "87%",
    deliveryTime: "4h 20m",
    capiStatus: "Purchase Server-Side Actif",
    activeCouriers: 16,
    avgBasket: "16 800 F",
  },
  {
    code: "ML",
    name: "Mali",
    capital: "Bamako",
    flag: "🇲🇱",
    currency: "XOF",
    zone: "UEMOA",
    dialCode: "+223",
    x: 180,
    y: 240,
    confirmRate: "86%",
    deliveryTime: "4h 35m",
    capiStatus: "Purchase Server-Side Actif",
    activeCouriers: 14,
    avgBasket: "17 000 F",
  },
  {
    code: "GN",
    name: "Guinée",
    capital: "Conakry",
    flag: "🇬🇳",
    currency: "GNF",
    zone: "CEDEAO",
    dialCode: "+224",
    x: 150,
    y: 264,
    confirmRate: "85%",
    deliveryTime: "4h 50m",
    capiStatus: "Purchase Server-Side Actif",
    activeCouriers: 15,
    avgBasket: "285 000 GNF",
  },
  {
    code: "NE",
    name: "Niger",
    capital: "Niamey",
    flag: "🇳🇪",
    currency: "XOF",
    zone: "UEMOA",
    dialCode: "+227",
    x: 260,
    y: 232,
    confirmRate: "86%",
    deliveryTime: "4h 40m",
    capiStatus: "Purchase Server-Side Actif",
    activeCouriers: 12,
    avgBasket: "17 500 F",
  },
  {
    code: "CM",
    name: "Cameroun",
    capital: "Douala / Yaoundé",
    flag: "🇨🇲",
    currency: "XAF",
    zone: "CEMAC",
    dialCode: "+237",
    x: 308,
    y: 306,
    confirmRate: "88%",
    deliveryTime: "4h 00m",
    capiStatus: "Purchase Server-Side Actif",
    activeCouriers: 26,
    avgBasket: "20 500 F",
  },
  {
    code: "GA",
    name: "Gabon",
    capital: "Libreville",
    flag: "🇬🇦",
    currency: "XAF",
    zone: "CEMAC",
    dialCode: "+241",
    x: 304,
    y: 346,
    confirmRate: "90%",
    deliveryTime: "3h 40m",
    capiStatus: "Purchase Server-Side Actif",
    activeCouriers: 12,
    avgBasket: "24 000 F",
  },
];

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
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 6, ry: -6 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const dots = useMemo(() => {
    const pts: { x: number; y: number; tier: "hub" | "west" | "africa" }[] = [];
    const step = 11;
    for (let y = 54; y <= 585; y += step) {
      for (let x = 124; x <= 545; x += step) {
        const offsetX = (Math.floor(y / step) % 2) * (step / 2);
        const px = x + offsetX;
        if (pointInPolygon(px, y, AFRICA_POLYGON) || pointInPolygon(px, y, MADAGASCAR_POLYGON)) {
          const distToHub = Math.hypot(px - selectedHub.x, y - selectedHub.y);
          if (distToHub < 45) {
            pts.push({ x: px, y, tier: "hub" });
          } else if (px >= 125 && px <= 335 && y >= 195 && y <= 365) {
            pts.push({ x: px, y, tier: "west" });
          } else {
            pts.push({ x: px, y, tier: "africa" });
          }
        }
      }
    }
    return pts;
  }, [selectedHub]);

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
      rx: Math.max(-10, Math.min(10, -ny * 16)),
      ry: Math.max(-10, Math.min(10, nx * 16)),
    });
  };

  const connectionArcs = useMemo(() => {
    return AFRICAN_COD_HUBS.filter((h) => h.code !== selectedHub.code).map((target) => {
      const mx = (selectedHub.x + target.x) / 2;
      const my = Math.min(selectedHub.y, target.y) - 34;
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
      onMouseLeave={() => setTilt({ rx: 6, ry: -6 })}
      className="relative select-none"
      style={{ perspective: "1400px" }}
    >
      <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-gradient-to-tr from-indigo-500/15 via-emerald-500/10 to-amber-500/10 blur-3xl opacity-80" />

      <div
        className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#0c1324]/95 via-[#090e1c]/95 to-[#060a14]/95 p-4 sm:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-transform duration-200 ease-out"
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide text-white uppercase flex items-center gap-2">
                <span>Réseau Logistique Pan-Africain</span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300 font-semibold border border-emerald-500/30">
                  TEMPS RÉEL
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Synchronisation native des devises XOF, XAF & GNF par indicatif de téléphone
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <Activity className="h-3 w-3 text-emerald-400" />
              <span>10 Hubs Nationaux Actifs</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 items-center gap-8 pt-6 lg:grid-cols-12">
          <div className="relative flex items-center justify-center lg:col-span-7">
            <div className="relative w-full max-w-[480px]">
              <svg
                viewBox="110 40 450 560"
                className="h-[380px] w-full drop-shadow-[0_0_35px_rgba(99,102,241,0.35)] sm:h-[440px]"
                aria-label="Carte interactive de l'Afrique en pointillés COD"
              >
                <defs>
                  <radialGradient id="hubHalo" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                    <stop offset="50%" stopColor="#6366f1" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#090d16" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="arcLaser" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.95" />
                    <stop offset="60%" stopColor="#6366f1" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.4" />
                  </linearGradient>
                </defs>

                <circle cx={selectedHub.x} cy={selectedHub.y} r="110" fill="url(#hubHalo)" />

                <circle
                  cx={selectedHub.x}
                  cy={selectedHub.y}
                  r="50"
                  fill="none"
                  stroke="#10b981"
                  strokeOpacity="0.3"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
                <circle
                  cx={selectedHub.x}
                  cy={selectedHub.y}
                  r="105"
                  fill="none"
                  stroke="#6366f1"
                  strokeOpacity="0.2"
                  strokeWidth="1"
                  strokeDasharray="3 7"
                />

                <path
                  d={outlinePath}
                  fill="rgba(15, 23, 42, 0.45)"
                  stroke="rgba(99, 102, 241, 0.35)"
                  strokeWidth="1.6"
                  strokeDasharray="4 4"
                  strokeLinejoin="round"
                />

                {dots.map((pt, i) => {
                  let r = 1.9;
                  let fill = "#475569";
                  let opacity = 0.35;

                  if (pt.tier === "hub") {
                    r = 3.2;
                    fill = "#34d399";
                    opacity = 0.95;
                  } else if (pt.tier === "west") {
                    r = 2.4;
                    fill = "#818cf8";
                    opacity = 0.7;
                  }

                  return (
                    <circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r={r}
                      fill={fill}
                      fillOpacity={opacity}
                    />
                  );
                })}

                {connectionArcs.map((arc) => (
                  <path
                    key={arc.id}
                    d={arc.d}
                    fill="none"
                    stroke="url(#arcLaser)"
                    strokeWidth="1.8"
                    strokeDasharray="5 5"
                  />
                ))}

                {AFRICAN_COD_HUBS.map((hub) => {
                  const isSelected = hub.code === selectedHub.code;
                  return (
                    <g
                      key={hub.code}
                      className="cursor-pointer transition-transform duration-150"
                      onClick={() => setSelectedHub(hub)}
                      onMouseEnter={() => setSelectedHub(hub)}
                    >
                      {isSelected && (
                        <>
                          <circle
                            cx={hub.x}
                            cy={hub.y}
                            r="20"
                            fill="#10b981"
                            fillOpacity="0.2"
                          />
                          <circle
                            cx={hub.x}
                            cy={hub.y}
                            r="12"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2"
                          />
                        </>
                      )}
                      <circle
                        cx={hub.x}
                        cy={hub.y}
                        r={isSelected ? 6.5 : 4.5}
                        fill={isSelected ? "#10b981" : "#f59e0b"}
                        stroke="#090e1c"
                        strokeWidth="2"
                      />
                      {isSelected ? (
                        <g transform={`translate(${hub.x + 12}, ${hub.y - 14})`}>
                          <rect
                            x="0"
                            y="-14"
                            width="116"
                            height="26"
                            rx="8"
                            fill="#0b1324"
                            stroke="#10b981"
                            strokeWidth="1.5"
                          />
                          <text
                            x="10"
                            y="3"
                            fill="#ffffff"
                            fontSize="11"
                            fontWeight="800"
                            fontFamily="system-ui, sans-serif"
                          >
                            {hub.flag} {hub.name} ({hub.code})
                          </text>
                        </g>
                      ) : (
                        <text
                          x={hub.x + 8}
                          y={hub.y + 4}
                          fill="#94a3b8"
                          fontSize="9"
                          fontWeight="600"
                          fontFamily="system-ui, sans-serif"
                        >
                          {hub.code}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 shadow-inner">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl drop-shadow-md">{selectedHub.flag}</span>
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{selectedHub.name}</span>
                      <span className="text-xs font-mono text-emerald-400 font-semibold">
                        ({selectedHub.capital})
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400 font-mono">
                      Zone {selectedHub.zone} • Indicatif {selectedHub.dialCode}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-[#070b14]/80 p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <PhoneCall className="h-3 w-3 text-indigo-400" />
                      <span>Confirmation</span>
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {selectedHub.confirmRate}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400"
                      style={{ width: selectedHub.confirmRate }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#070b14]/80 p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Truck className="h-3 w-3 text-emerald-400" />
                      <span>Délai Moyen</span>
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-base font-bold text-white">
                    {selectedHub.deliveryTime}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#070b14]/80 p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-400" />
                      <span>Flotte Livreurs</span>
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-base font-bold text-amber-300">
                    {selectedHub.activeCouriers} livreurs connectés
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#070b14]/80 p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Panier Moyen</span>
                  </div>
                  <p className="mt-1 font-mono text-base font-bold text-emerald-400">
                    {selectedHub.avgBasket}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs">
                <span className="flex items-center gap-2 text-slate-200">
                  <Share2 className="h-4 w-4 text-indigo-400" />
                  <span>Meta CAPI Server-Side</span>
                </span>
                <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  {selectedHub.capiStatus}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5 text-brand" />
                <span>Sélectionnez un marché pour inspecter sa configuration :</span>
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {AFRICAN_COD_HUBS.map((hub) => {
                  const active = hub.code === selectedHub.code;
                  return (
                    <button
                      key={hub.code}
                      type="button"
                      onClick={() => setSelectedHub(hub)}
                      className={`flex flex-col items-center justify-center rounded-xl border py-2 px-1 text-center transition-all ${
                        active
                          ? "border-emerald-400/80 bg-emerald-500/25 text-white shadow-md shadow-emerald-500/20 scale-105"
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <span className="text-lg">{hub.flag}</span>
                      <span className="mt-0.5 text-[10px] font-bold tracking-tight">
                        {hub.code}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                <strong>Cloisonnement Multi-Équipes</strong> : Vos équipes Togo, Bénin, Côte d'Ivoire ou Cameroun
                possèdent leurs propres livreurs, leur propre caisse et leur Pixel Meta dédié sans aucun mélange.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
