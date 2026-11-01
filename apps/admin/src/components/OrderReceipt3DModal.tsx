import { useRef, useState } from "react";
import { Printer, Share2, X, MapPin, Phone, Package, ShieldCheck, RotateCcw } from "lucide-react";
import type { AppUser, Order, Team } from "@ecomcod/shared";

interface OrderReceipt3DModalProps {
  order: Order;
  team: Team | null;
  closeuseName?: string;
  livreurName?: string;
  closeuses?: AppUser[];
  livreurs?: AppUser[];
  onClose: () => void;
}

export default function OrderReceipt3DModal({
  order,
  team,
  closeuseName,
  livreurName,
  closeuses = [],
  livreurs = [],
  onClose,
}: OrderReceipt3DModalProps) {
  const resolvedCloseuse =
    closeuseName ||
    (order.closeuseId ? closeuses.find((c) => c.id === order.closeuseId)?.name : undefined) ||
    "Non assignée";
  const resolvedLivreur =
    livreurName ||
    (order.livreurId ? livreurs.find((l) => l.id === order.livreurId)?.name : undefined) ||
    "Non assigné";
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 4, ry: -6, gx: 50, gy: 30 });
  const [interactive3D, setInteractive3D] = useState(true);

  const currency = team?.currency || team?.metaCapiConfig?.currency || "FCFA";
  const orderCode = order.orderNumber || `#${order.id.slice(-6).toUpperCase()}`;
  const dateStr = new Date(order.timestamps?.received || Date.now()).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive3D || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const ry = (px - 0.5) * 18;
    const rx = (0.5 - py) * 16;
    setTilt({ rx, ry, gx: Math.round(px * 100), gy: Math.round(py * 100) });
  };

  const resetTilt = () => {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 30 });
  };

  const handleShareWhatsApp = () => {
    const lines = [
      `*BON DE LIVRAISON COD — ${team?.name || "Ecom COD"}*`,
      `Réf : ${orderCode}`,
      `Client : ${order.clientName}`,
      `Tél : ${order.clientPhoneFormatted}`,
      `Ville / Adresse : ${[order.city, order.addressNote].filter(Boolean).join(" — ") || "À préciser"}`,
      `Article : ${order.product} (Qté : ${order.quantity || 1})`,
      `*MONTANT À ENCAISSER : ${(order.amount || 0).toLocaleString("fr-FR")} ${currency}*`,
    ];
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
  };

  // Génère des barres pseudo-aléatoires déterministes à partir de l'ID de commande pour le code-barres
  const barcodeBars = Array.from({ length: 42 }, (_, idx) => {
    const ch = order.id.charCodeAt(idx % order.id.length) || 65;
    return ((ch + idx * 7) % 3) + 1;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94vh] w-full max-w-lg flex-col items-center overflow-y-auto"
      >
        {/* Barre d'actions supérieure */}
        <div className="mb-4 flex w-full items-center justify-between rounded-xl border border-surface-border bg-surface-raised px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-200">Bon de commande 3D</span>
            <button
              type="button"
              onClick={() => {
                setInteractive3D((v) => !v);
                resetTilt();
              }}
              className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-surface px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200"
            >
              <RotateCcw className="h-3 w-3" />
              {interactive3D ? "3D Actif" : "Vue 2D"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
            >
              <Share2 className="h-3.5 w-3.5" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-border p-1.5 text-slate-400 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scène 3D avec perspective matérielle */}
        <div
          style={{ perspective: "1200px" }}
          className=" flex w-full justify-center py-2"
          onPointerMove={handlePointerMove}
          onPointerLeave={resetTilt}
        >
          <div
            ref={cardRef}
            style={{
              transform: interactive3D
                ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`
                : "none",
              transformStyle: "preserve-3d",
              transition: "transform 140ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            className="printable-receipt relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-300/80 bg-[#FAF9F5] text-slate-900 shadow-[0_28px_60px_-15px_rgba(0,0,0,0.7)]"
          >
            {/* Reflet spéculaire dynamique au survol */}
            {interactive3D && (
              <div
                aria-hidden="true"
                style={{
                  background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 60%)`,
                }}
                className="pointer-events-none absolute inset-0 z-10 mix-blend-soft-light"
              />
            )}

            {/* Bandeau supérieur du bordereau logistique */}
            <div className="border-b-2 border-dashed border-slate-300 bg-slate-900 px-6 py-4 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    BORDEREAU D'EXPÉDITION COD
                  </p>
                  <h3 className="mt-0.5 text-lg font-bold tracking-tight text-white">
                    {team?.name || "Ecom COD Logistics"}
                  </h3>
                </div>
                <div className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-right">
                  <span className="block font-mono text-xs font-bold text-white">{orderCode}</span>
                  <span className="block text-[10px] text-slate-300">{team?.defaultCountry || "TG"}</span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>Émis le {dateStr}</span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Paiement à la livraison
                </span>
              </div>
            </div>

            {/* Encoches latérales effet ticket physique */}
            <div className="relative px-6 py-5 space-y-4">
              <div className="absolute -left-3 top-0 h-6 w-6 -translate-y-1/2 rounded-full bg-black/80" />
              <div className="absolute -right-3 top-0 h-6 w-6 -translate-y-1/2 rounded-full bg-black/80" />

              {/* Bloc Destinataire */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Destinataire
                </p>
                <p className="mt-0.5 text-base font-bold text-slate-900">{order.clientName}</p>
                <div className="mt-2 space-y-1 text-xs text-slate-700">
                  <div className="flex items-center gap-2 font-mono font-semibold text-slate-900">
                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                    <span>{order.clientPhoneFormatted}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span>
                      {[order.city, order.addressNote].filter(Boolean).join(" — ") || "Adresse à confirmer au téléphone"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Détail Article */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Désignation article</span>
                  <span>Qté</span>
                </div>
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                    <span className="text-xs font-semibold text-slate-900 leading-snug">{order.product}</span>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-900">
                    x{order.quantity || 1}
                  </span>
                </div>
              </div>

              {/* Montant à encaisser (Mis en valeur) */}
              <div className="flex items-center justify-between rounded-xl border-2 border-slate-900 bg-slate-900 px-4 py-3 text-white">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Net à encaisser (Espèces / Mobile Money)
                  </span>
                  <span className="text-[11px] text-slate-300">Vérifier le colis avec le client</span>
                </div>
                <div className="text-right font-mono text-xl font-black tracking-tight tabular-nums text-white">
                  {(order.amount || 0).toLocaleString("fr-FR")} <span className="text-xs font-bold">{currency}</span>
                </div>
              </div>

              {/* Traçabilité Agents */}
              <div className="grid grid-cols-2 gap-2 border-t border-dashed border-slate-300 pt-3 text-[11px] text-slate-600">
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">Confirmé par</span>
                  <span className="font-semibold text-slate-800">{resolvedCloseuse}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase text-slate-400">Livreur assigné</span>
                  <span className="font-semibold text-slate-800">{resolvedLivreur}</span>
                </div>
              </div>

              {/* Code-barres vectoriel */}
              <div className="border-t border-dashed border-slate-300 pt-3 text-center">
                <div className="mx-auto flex h-10 max-w-[260px] items-stretch justify-center gap-[2px]">
                  {barcodeBars.map((w, i) => (
                    <span
                      key={i}
                      style={{ width: `${w * 2}px` }}
                      className={i % 2 === 0 ? "bg-slate-900" : "bg-transparent"}
                    />
                  ))}
                </div>
                <p className="mt-1 font-mono text-[10px] tracking-[0.25em] text-slate-500">
                  {order.id.toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
