import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb, openPrintDialog, buildWhatsAppReceiptMessage } from "@ecomcod/shared";
import type { Team, Order } from "@ecomcod/shared";
import { Printer, Smartphone, FileText, Check, ShieldCheck, Eye } from "lucide-react";
import { formatFirebaseError } from "../lib/firebaseErrors";

interface PrintReceiptConfigProps {
  workspaceId: string;
  team: Team;
}

export default function PrintReceiptConfig({ workspaceId, team }: PrintReceiptConfigProps) {
  const cfg = team.printReceiptConfig || {
    enabled: false,
    autoPrintOnDelivery: true,
    companyName: team.name,
    companyPhone: "",
    companyAddress: "",
    footerNote: "Colis vérifié et remis en main propre. Retours acceptés sous 48h avec ce bon.",
    paperWidth: "58mm",
    receiptTitle: "BON DE LIVRAISON & REÇU COD",
    showLivreurInfo: true,
    enableWhatsAppShare: true,
  };

  const [enabled, setEnabled] = useState(cfg.enabled);
  const [autoPrint, setAutoPrint] = useState(cfg.autoPrintOnDelivery);
  const [companyName, setCompanyName] = useState(cfg.companyName || team.name);
  const [companyPhone, setCompanyPhone] = useState(cfg.companyPhone || "");
  const [companyAddress, setCompanyAddress] = useState(cfg.companyAddress || "");
  const [footerNote, setFooterNote] = useState(
    cfg.footerNote || "Colis vérifié et remis en main propre. Retours acceptés sous 48h avec ce bon."
  );
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">(cfg.paperWidth || "58mm");
  const [receiptTitle, setReceiptTitle] = useState(cfg.receiptTitle || "BON DE LIVRAISON & REÇU COD");
  const [showLivreurInfo, setShowLivreurInfo] = useState(cfg.showLivreurInfo !== false);
  const [enableWhatsAppShare, setEnableWhatsAppShare] = useState(cfg.enableWhatsAppShare !== false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = team.currency || team.metaCapiConfig?.currency || "XOF";

  // Commande fictive pour la prévisualisation et le test
  const demoOrder: Order = {
    id: "demo-ord-7842",
    orderNumber: "1042",
    workspaceId,
    teamId: team.id,
    sheetId: "demo-sheet",
    sourceRowId: "2",
    clientName: "Awa KONE",
    clientPhoneRaw: "+228 90 12 34 56",
    clientPhoneFormatted: "+228 90 12 34 56",
    city: "Lomé, Tokoin",
    addressNote: "Face pharmacie du point",
    product: "Pack Montre Connectée Pro + Écouteurs",
    quantity: 1,
    amount: 19500,
    closeuseId: "closeuse-1",
    livreurId: "livreur-1",
    assignedLivreurName: "Mike (Livreur Zone 1)",
    statutCloseuse: "livre",
    statutLivreur: "livre",
    statutAdminOverride: null,
    callInProgress: null,
    timestamps: {
      received: Date.now() - 3600000 * 4,
      assignedToCloseuse: Date.now() - 3600000 * 3,
      assignedToLivreur: Date.now() - 3600000 * 2,
      closeuseDecidedAt: Date.now() - 3600000 * 2.8,
      livreurRespondedAt: Date.now() - 3600000 * 1.5,
      delivered: Date.now(),
    },
    capiSent: true,
    purgeAt: null,
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const db = getDb();
      await updateDoc(doc(db, "workspaces", workspaceId, "teams", team.id), {
        printReceiptConfig: {
          enabled,
          autoPrintOnDelivery: autoPrint,
          companyName: companyName.trim(),
          companyPhone: companyPhone.trim(),
          companyAddress: companyAddress.trim(),
          footerNote: footerNote.trim(),
          paperWidth,
          receiptTitle: receiptTitle.trim(),
          showLivreurInfo,
          enableWhatsAppShare,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const f = formatFirebaseError(err);
      setError(`${f.title} : ${f.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = () => {
    const previewTeam: Team = {
      ...team,
      printReceiptConfig: {
        enabled,
        autoPrintOnDelivery: autoPrint,
        companyName: companyName.trim(),
        companyPhone: companyPhone.trim(),
        companyAddress: companyAddress.trim(),
        footerNote: footerNote.trim(),
        paperWidth,
        receiptTitle: receiptTitle.trim(),
        showLivreurInfo,
        enableWhatsAppShare,
      },
    };
    openPrintDialog(demoOrder, previewTeam, { livreurName: "Mike (Livreur Démo)" });
  };

  const handleTestWhatsApp = () => {
    const previewTeam: Team = {
      ...team,
      printReceiptConfig: {
        enabled,
        autoPrintOnDelivery: autoPrint,
        companyName: companyName.trim(),
        companyPhone: companyPhone.trim(),
        companyAddress: companyAddress.trim(),
        footerNote: footerNote.trim(),
        paperWidth,
        receiptTitle: receiptTitle.trim(),
        showLivreurInfo,
        enableWhatsAppShare,
      },
    };
    const msg = buildWhatsAppReceiptMessage(demoOrder, previewTeam, { livreurName: "Mike (Livreur Démo)" });
    navigator.clipboard.writeText(msg);
    alert("Message de reçu WhatsApp copié dans votre presse-papiers !\n\n" + msg);
  };

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 space-y-6">
      {/* En-tête de section */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 border border-brand/30 text-brand">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Bons de Livraison & Reçus d'Encaissement Terrain</h3>
            <p className="text-xs text-slate-400">
              Chaque livreur génère son bon distinct avec traçabilité comptable pour l'équipe {team.name}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {enabled ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Module Actif sur le Terrain
            </span>
          ) : (
            <span className="rounded-full bg-slate-500/15 px-3 py-1 text-xs font-medium text-slate-400 border border-slate-500/20">
              Désactivé
            </span>
          )}
        </div>
      </div>

      {/* Interrupteur principal d'activation */}
      <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface p-4">
        <div>
          <span className="text-xs font-bold text-slate-100">Activer les Bons de Livraison pour cette équipe</span>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Permet aux livreurs de générer un bon officiel physique (imprimante de poche) et/ou digital (WhatsApp) dès l'encaissement.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`h-6 w-11 rounded-full transition-colors relative cursor-pointer ${
            enabled ? "bg-brand" : "bg-slate-700"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-xs ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Colonne Gauche : Formulaire de paramétrage (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Titre en-tête du document</label>
                <input
                  type="text"
                  value={receiptTitle}
                  onChange={(e) => setReceiptTitle(e.target.value)}
                  placeholder="ex: BON DE LIVRAISON & REÇU COD"
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Nom commercial / Boutique</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="ex: WariStore Express"
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Téléphone Service Client / SAV</label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="ex: +228 90 00 00 00"
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Adresse / Ville du dépôt</label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="ex: Lomé, Tokoin"
                  className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Format d'impression thermique (Largeur papier)
              </label>
              <select
                value={paperWidth}
                onChange={(e) => setPaperWidth(e.target.value as any)}
                className="w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-brand"
              >
                <option value="58mm">58 mm — Imprimante thermique de poche Bluetooth (Idéal livreurs en moto)</option>
                <option value="80mm">80 mm — Imprimante thermique de comptoir / grand format</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Mention de garantie & politique de retour (Bas du bon)
              </label>
              <textarea
                rows={2}
                value={footerNote}
                onChange={(e) => setFooterNote(e.target.value)}
                placeholder="ex: Colis vérifié et remis en main propre. Retours acceptés sous 48h avec ce bon."
                className="w-full rounded-xl border border-surface-border bg-surface p-2.5 text-xs text-slate-100 outline-none focus:border-brand resize-none"
              />
            </div>

            {/* Options opérationnelles */}
            <div className="rounded-xl border border-surface-border bg-surface p-3.5 space-y-3">
              <span className="text-xs font-bold text-slate-200 block mb-1">Règles Terrain & Traçabilité</span>

              <label className="flex items-center justify-between cursor-pointer text-xs text-slate-300">
                <div>
                  <span className="font-semibold block">Afficher l'identité du livreur sur le bon</span>
                  <span className="text-[11px] text-slate-500 block">
                    Mentionne « Remis par : [Nom du livreur] » pour certifier qui a encaissé le colis.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={showLivreurInfo}
                  onChange={(e) => setShowLivreurInfo(e.target.checked)}
                  className="rounded border-surface-border text-brand focus:ring-brand h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer text-xs text-slate-300 border-t border-surface-border pt-2.5">
                <div>
                  <span className="font-semibold block">Impression automatique au clic « Livré »</span>
                  <span className="text-[11px] text-slate-500 block">
                    Ouvre immédiatement la boîte d'impression dès que le livreur valide la livraison.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => setAutoPrint(e.target.checked)}
                  className="rounded border-surface-border text-brand focus:ring-brand h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer text-xs text-slate-300 border-t border-surface-border pt-2.5">
                <div>
                  <span className="font-semibold block">Activer le reçu digital par WhatsApp</span>
                  <span className="text-[11px] text-slate-500 block">
                    Permet au livreur d'envoyer le bon en 1 clic au client sur WhatsApp si pas d'imprimante.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={enableWhatsAppShare}
                  onChange={(e) => setEnableWhatsAppShare(e.target.checked)}
                  className="rounded border-surface-border text-brand focus:ring-brand h-4 w-4"
                />
              </label>
            </div>
          </div>

          {/* Colonne Droite : Aperçu Visuel Réaliste (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-brand" />
                Aperçu du Bon Terrain ({paperWidth})
              </span>
              <span className="text-[11px] text-slate-500 font-mono">BL-#1042</span>
            </div>

            {/* Ticket de caisse thermique avec texture et découpe */}
            <div className="relative mx-auto w-full max-w-[320px] rounded-lg bg-white p-5 text-slate-900 shadow-xl border border-slate-200 font-mono text-[11px] select-none leading-relaxed">
              <div className="text-center font-black text-sm uppercase tracking-wide">
                {companyName || team.name || "VOTRE BOUTIQUE"}
              </div>
              {companyPhone && <div className="text-center text-[10px] text-slate-700">{companyPhone}</div>}
              {companyAddress && <div className="text-center text-[10px] text-slate-600">{companyAddress}</div>}

              <div className="border-t border-dashed border-slate-400 my-2.5" />

              <div className="text-center font-bold text-[11px] uppercase tracking-wider text-slate-800">
                {receiptTitle || "BON DE LIVRAISON & REÇU"}
              </div>

              <div className="flex justify-between text-[10px] mt-1">
                <span className="text-slate-600">N° Bon :</span>
                <span className="font-bold">BL-#1042</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-600">Date :</span>
                <span>{new Date().toLocaleDateString("fr-FR")} {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>

              {showLivreurInfo && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-600">Livreur :</span>
                  <span className="font-bold text-slate-900">Mike (Zone 1)</span>
                </div>
              )}

              <div className="border-t border-dashed border-slate-400 my-2" />

              <div className="flex justify-between text-[10px]">
                <span className="text-slate-600">Client :</span>
                <span className="font-bold">Awa KONE</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-600">Tél :</span>
                <span>+228 90 12 34 56</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-600">Ville :</span>
                <span>Lomé, Tokoin</span>
              </div>

              <div className="border-t border-dashed border-slate-400 my-2" />

              <div className="flex justify-between text-[10px] font-bold">
                <span>Article</span>
                <span>Prix</span>
              </div>
              <div className="flex justify-between text-[10px] my-0.5">
                <span className="truncate max-w-[170px]">1x Pack Montre + Écouteurs</span>
                <span className="font-bold">19 500 {currency}</span>
              </div>

              <div className="border-2 border-slate-900 rounded p-1.5 my-2.5 text-center">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-700">Total Encaissé (Espèces)</div>
                <div className="text-sm font-black text-slate-900">19 500 {currency}</div>
                <div className="text-[9px] text-emerald-700 font-bold">Payé à la livraison ✓</div>
              </div>

              <div className="text-[9px] text-center text-slate-700 leading-tight">
                {footerNote || "Colis vérifié et remis en main propre. Retours acceptés sous 48h avec ce bon."}
              </div>

              <div className="border-t border-dotted border-slate-300 mt-2.5 pt-1.5 text-center text-[8px] text-slate-500 tracking-wider">
                Certification WariTrack • Trace # DEMO7842
              </div>
            </div>

            {/* Boutons d'essais interactifs */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestPrint}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-surface-border bg-surface py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-surface-raised transition"
              >
                <Printer className="h-3.5 w-3.5 text-brand" />
                <span>Tester Impression</span>
              </button>

              <button
                type="button"
                onClick={handleTestWhatsApp}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-surface-border bg-surface py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-surface-raised transition"
              >
                <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                <span>Copier Reçu WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Barre d'action d'enregistrement */}
      <div className="flex items-center justify-between gap-3 border-t border-surface-border pt-4">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Les livreurs reçoivent ces paramètres instantanément sur leur mobile.</span>
        </div>

        <button
          disabled={saving}
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50 transition"
        >
          {saved ? <Check className="h-4 w-4" /> : <Printer className="h-4 w-4" />}
          <span>{saving ? "Enregistrement…" : saved ? "Configuration enregistrée ✓" : "Enregistrer le modèle de bon"}</span>
        </button>
      </div>
    </div>
  );
}
