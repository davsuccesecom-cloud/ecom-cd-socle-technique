import React from "react";
import {
  Sparkles,
  Smartphone,
  ShieldCheck,
  Zap,
  TrendingUp,
  X,
  CheckCircle2,
  RefreshCw,
  Rocket,
} from "lucide-react";
import WariTrackLogo from "./WariTrackLogo";

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatsNewModal({ isOpen, onClose }: WhatsNewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-[3px] animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-surface-border bg-surface-raised p-6 sm:p-8 shadow-2xl my-auto">
        
        {/* En-tête avec Logo et Bouton Fermer */}
        <div className="flex items-start justify-between border-b border-surface-border pb-5 mb-5">
          <div className="flex items-center gap-3">
            <WariTrackLogo size="md" variant="full" roundedBadge subtitle="Notes de Version v3.2" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-surface border border-surface-border transition"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Badge Nouveautés */}
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-400 mb-4">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Mise à Jour Majeure Déployée</span>
          <span className="rounded-full bg-sky-500/20 px-2 py-0.2 text-[10px] text-sky-200">v3.2</span>
        </div>

        {/* Liste des Nouveautés Clés */}
        <div className="space-y-4">
          
          <div className="flex items-start gap-3.5 rounded-2xl border border-surface-border bg-surface p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                Nouveau Monogramme WariTrack « W » Multi-Couleurs
              </h4>
              <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                Le W emblématique symbolise la polyvalence de vos 4 pôles : Cockpit (Violet), Livraisons (Cyan), Cash COD (Or) et Ventes WhatsApp (Orange). Finie la rigidité, place à une identité lumineuse, saine et pro.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl border border-surface-border bg-surface p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                Vraies Icônes Natives &amp; Marque Propre Employés
              </h4>
              <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                Vos employés (Closeuse et Livreur) conservent par défaut leurs vraies icônes natives originales. Vous pouvez également uploader le véritable logo carré HD de votre entreprise (512×512 px) pour vos équipes.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl border border-surface-border bg-surface p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                Adaptation Automatique en Cas de Chute de Seuil
              </h4>
              <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                Gestion positive et constructive : si votre taux de livraison faiblit ou si les appels prennent du retard, WariTrack réajuste intelligemment la distribution sans bloquer vos opérations.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl border border-surface-border bg-surface p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                Détection PWA &amp; Cache Transparent
              </h4>
              <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                Les icônes PWA s'affichent désormais avec transparence pure sur Windows et Android, éliminant tout rectangle blanc.
              </p>
            </div>
          </div>

        </div>

        {/* Bouton de confirmation */}
        <div className="mt-6 flex items-center justify-between border-t border-surface-border pt-4">
          <span className="text-[11px] text-slate-500">
            WariTrack OS • Version de Production Validée
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-brand/20 hover:opacity-95 transition"
          >
            <CheckCircle2 className="h-4 w-4" />
            C'est Compris !
          </button>
        </div>

      </div>
    </div>
  );
}
