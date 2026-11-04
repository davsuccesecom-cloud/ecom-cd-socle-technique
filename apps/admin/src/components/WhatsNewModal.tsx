import React from "react";
import { Sparkles, Check, ArrowRight } from "lucide-react";

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatsNewModal({ isOpen, onClose }: WhatsNewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-surface-border bg-surface-raised p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
      >
        {/* En-tête avec badge de version type WhatsApp / PWA */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-brand">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100">Quoi de neuf</h3>
              <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-bold text-brand">
                v3.2
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Les améliorations récentes apportées à votre espace de travail.
            </p>
          </div>
        </div>

        {/* Liste courte et claire des améliorations */}
        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-3 rounded-2xl border border-surface-border bg-surface p-3.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Check className="h-3 w-3" />
            </div>
            <div>
              <p className="font-semibold text-slate-100">Navigation & Espaces fluides</p>
              <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">
                Suppression des barres latérales superposées. La configuration est désormais plein écran avec des onglets horizontaux.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-surface-border bg-surface p-3.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Check className="h-3 w-3" />
            </div>
            <div>
              <p className="font-semibold text-slate-100">Caisse & Rémunérations épurées</p>
              <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">
                Pointage des versements terrain, déductions et calculs de paie clarifiés avec une typographie financière sobre et sans code.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-surface-border bg-surface p-3.5">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Check className="h-3 w-3" />
            </div>
            <div>
              <p className="font-semibold text-slate-100">Ambiance visuelle & Thèmes nets</p>
              <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">
                Sélection du thème et des couleurs parfaitement isolée, sans débordement ni superposition sur vos graphiques.
              </p>
            </div>
          </div>
        </div>

        {/* Bouton de confirmation unique "Compris" */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-xs font-bold text-white shadow-md shadow-brand/20 hover:bg-brand-hover transition active:scale-[0.99]"
          >
            <span>Compris</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
