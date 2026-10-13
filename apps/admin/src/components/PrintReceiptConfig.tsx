import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@ecomcod/shared";
import type { Team } from "@ecomcod/shared";

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
    footerNote: "Merci pour votre confiance !",
    paperWidth: "58mm",
  };

  const [enabled, setEnabled] = useState(cfg.enabled);
  const [autoPrint, setAutoPrint] = useState(cfg.autoPrintOnDelivery);
  const [companyName, setCompanyName] = useState(cfg.companyName);
  const [companyPhone, setCompanyPhone] = useState(cfg.companyPhone);
  const [companyAddress, setCompanyAddress] = useState(cfg.companyAddress);
  const [footerNote, setFooterNote] = useState(cfg.footerNote);
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">(cfg.paperWidth);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  // Test d'impression immédiat
  const handleTestPrint = () => {
    const printWindow = window.open("", "_blank", "width=350,height=500");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Test Bon de Commande - ${companyName || team.name}</title>
          <style>
            @page { margin: 0; }
            body {
              font-family: monospace;
              width: ${paperWidth === "58mm" ? "58mm" : "80mm"};
              margin: 0 auto;
              padding: 10px;
              color: #000;
              font-size: 11px;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 14px;">${companyName || team.name}</div>
          <div class="center">${companyPhone || "Tel: +229 00 00 00 00"}</div>
          <div class="center">${companyAddress || "Cotonou, Bénin"}</div>
          <div class="line"></div>
          <div class="row"><span>Bon N° :</span><span class="bold">CMD-TEST-001</span></div>
          <div class="row"><span>Date :</span><span>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</span></div>
          <div class="row"><span>Livreur :</span><span>Agent Test</span></div>
          <div class="line"></div>
          <div class="row bold"><span>Client :</span><span>M. Client Test</span></div>
          <div class="row"><span>Téléphone :</span><span>+229 97 00 00 00</span></div>
          <div class="row"><span>Adresse :</span><span>Quartier Test</span></div>
          <div class="line"></div>
          <div class="row"><span>Montre Smartwatch x1</span><span>15 000 ${team.currency || "XOF"}</span></div>
          <div class="row"><span>Frais Livraison</span><span>1 500 ${team.currency || "XOF"}</span></div>
          <div class="line"></div>
          <div class="row bold" style="font-size: 13px;"><span>TOTAL ENCAISSÉ :</span><span>16 500 ${team.currency || "XOF"}</span></div>
          <div class="line"></div>
          <div class="center" style="margin-top: 8px;">${footerNote}</div>
          <div class="center" style="font-size: 9px; margin-top: 5px;">Reçu généré par Ecom COD</div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            🧾
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Bons de Commande & Reçus Thermiques</h3>
            <p className="text-xs text-slate-400">
              Impression Bluetooth & Wi-Fi pour les livreurs de l'équipe {team.name}.
            </p>
          </div>
        </div>

        {/* Indicateur visuel de flux en direct */}
        <div className="flex items-center gap-2">
          {enabled ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              Flux Prêt (Livreurs Actifs)
            </span>
          ) : (
            <span className="rounded-full bg-slate-500/15 px-2.5 py-1 text-[11px] font-medium text-slate-400 border border-slate-500/20">
              Désactivé
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Toggle Activation */}
        <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface p-3">
          <div>
            <span className="text-xs font-semibold text-slate-200">Activer le module d'impression des reçus</span>
            <p className="text-[11px] text-slate-400">
              Permet aux livreurs de cette équipe d'imprimer un bon physique ou thermique.
            </p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`h-6 w-11 rounded-full transition-colors relative ${enabled ? "bg-[#5E8E3E]" : "bg-slate-700"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {enabled && (
          <>
            {/* Auto Print on Delivery */}
            <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface p-3">
              <div>
                <span className="text-xs font-semibold text-slate-200">Impression automatique au clic "Livré"</span>
                <p className="text-[11px] text-slate-400">
                  Déclenche le dialogue d'impression dès que le livreur valide la livraison du colis.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
                className="rounded border-slate-700 text-[#5E8E3E] focus:ring-0"
              />
            </div>

            {/* Largeur papier */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Format Papier Thermique</label>
                <select
                  value={paperWidth}
                  onChange={(e) => setPaperWidth(e.target.value as any)}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-slate-200 outline-none"
                >
                  <option value="58mm">58mm (Imprimante de poche standard)</option>
                  <option value="80mm">80mm (Imprimante de comptoir)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Nom commercial sur le reçu</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="ex: Fast Delivery Store"
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-slate-200 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Téléphone Service Client</label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="ex: +229 97 00 00 00"
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Adresse / Ville</label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="ex: Cotonou, Akpakpa"
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-slate-200 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Message bas de ticket</label>
              <input
                type="text"
                value={footerNote}
                onChange={(e) => setFooterNote(e.target.value)}
                placeholder="ex: Les retours se font sous 48h sur présentation du reçu."
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-slate-200 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleTestPrint}
              className="w-full rounded-xl border border-surface-border py-2 text-xs font-medium text-slate-300 hover:bg-surface transition-colors"
            >
              🖨️ Tester l'impression thermique (Aperçu)
            </button>
          </>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          disabled={saving}
          onClick={handleSave}
          className="w-full rounded-xl bg-brand py-2.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Sauvegarde..." : saved ? "✓ Configuration enregistrée" : "Enregistrer les paramètres du bon"}
        </button>
      </div>
    </div>
  );
}
