import ExcelJS from 'exceljs';
import { parseMarkdown, plain } from './markdown';
import type { BilanReport, ChartImage } from './types';
import { NOTE, dateFr } from './util';

const FONT = 'Arial';
const HEAD_FILL = 'FF0F172A';
const SOFT = 'FFEEF2F7';

const styleHeader = (row: ExcelJS.Row) => {
  row.eachCell((c) => {
    c.font = { name: FONT, bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } };
    c.alignment = { vertical: 'middle', wrapText: true };
  });
  row.height = 22;
};
const base = (ws: ExcelJS.Worksheet) => {
  ws.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
};

export async function buildXlsx(report: BilanReport, charts: ChartImage[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ecom COD';
  wb.created = new Date(report.generatedAt);
  const cfg = report.sectionsConfig ?? {
    showKpis: true,
    showProductProfitability: true,
    showStockAlerts: true,
    showTreasurySplit: true,
    showEmployees: true,
    showCharts: true,
    showDailyTrends: true,
    showAiAnalysis: true,
  };

  // ---- Résumé
  if (cfg.showKpis) {
    const ws = wb.addWorksheet('Résumé');
    ws.columns = [{ width: 34 }, { width: 24 }, { width: 40 }];
    ws.getCell('A1').value = report.title;
    ws.getCell('A1').font = { name: FONT, bold: true, size: 16 };
    ws.getCell('A2').value = `${report.team}  ·  ${report.periodLabel}`;
    ws.getCell('A2').font = { name: FONT, size: 11, color: { argb: 'FF475569' } };
    ws.getCell('A3').value = `Généré le ${dateFr(report.generatedAt)}  ·  Devise : ${report.currency}`;
    ws.getCell('A3').font = { name: FONT, size: 9, color: { argb: 'FF64748B' } };
    if (report.question) {
      ws.getCell('A4').value = `Question posée : ${report.question}`;
      ws.getCell('A4').font = { name: FONT, italic: true, size: 9 };
    }
    const h = ws.getRow(6);
    h.values = ['Indicateur', 'Valeur', 'Précision'];
    styleHeader(h);
    report.kpis.forEach((k, i) => {
      const r = ws.getRow(7 + i);
      r.values = [k.label, k.num ?? k.value, k.hint ?? ''];
      if (k.num !== undefined) r.getCell(2).numFmt = k.unit ? `#,##0 "${k.unit}"` : '#,##0';
      r.eachCell((c) => (c.font = { name: FONT, size: 10 }));
      r.getCell(2).font = { name: FONT, size: 10, bold: true };
      r.getCell(2).alignment = { horizontal: 'right' };
      r.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    });

    let curRow = 7 + report.kpis.length + 1;
    if (cfg.showTreasurySplit && report.treasurySplit) {
      const ts = report.treasurySplit;
      const th = ws.getRow(curRow);
      th.values = ['Trésorerie COD Stratégique', 'Montant', 'Règle d’Or'];
      styleHeader(th);
      curRow++;

      const r1 = ws.getRow(curRow);
      r1.values = [`Réinvestissement (${ts.reinvestmentRate} %)`, ts.reinvestmentAmount, ts.reinvestmentLabel || 'Stock usine, pub Meta/TikTok & BFR'];
      r1.getCell(2).numFmt = `#,##0 "${report.currency}"`;
      r1.getCell(2).font = { name: FONT, size: 10, bold: true, color: { argb: 'FF1E40AF' } };
      r1.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      curRow++;

      const r2 = ws.getRow(curRow);
      r2.values = [`Dividendes Sécurisés (${ts.dividendRate} %)`, ts.dividendAmount, ts.dividendLabel || 'Bénéfice net distribuable sans risque'];
      r2.getCell(2).numFmt = `#,##0 "${report.currency}"`;
      r2.getCell(2).font = { name: FONT, size: 10, bold: true, color: { argb: 'FF065F46' } };
      r2.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      curRow += 2;
    }

    if (report.funnel.length) {
      const fh = ws.getRow(curRow);
      fh.values = ['Entonnoir', 'Nombre', '% de l’étape précédente'];
      styleHeader(fh);
      report.funnel.forEach((s, i) => {
        const r = ws.getRow(curRow + 1 + i);
        const prev = i > 0 && report.funnel[i - 1].value > 0 ? s.value / report.funnel[i - 1].value : null;
        r.getCell(1).value = s.label;
        r.getCell(2).value = s.value;
        if (i > 0) r.getCell(3).value = { formula: `IF(B${r.number - 1}=0,"",B${r.number}/B${r.number - 1})`, result: prev ?? '' } as ExcelJS.CellFormulaValue;
        r.getCell(3).numFmt = '0%';
        r.eachCell((c) => (c.font = { name: FONT, size: 10 }));
        r.getCell(2).numFmt = '#,##0';
        r.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      });
      curRow += report.funnel.length + 2;
    }

    ws.getCell(`A${curRow}`).value = NOTE;
    ws.getCell(`A${curRow}`).font = { name: FONT, italic: true, size: 8, color: { argb: 'FF64748B' } };
    ws.views = [{ showGridLines: false }];
  }

  // ---- Comptabilité Produits (Détaillée & Marges Nettes)
  if (cfg.showProductProfitability && report.products.length) {
    const wp = wb.addWorksheet('Comptabilité Produits');
    wp.columns = [
      { header: 'Produit', width: 36 },
      { header: 'Ventes (pcs)', width: 14 },
      { header: `PV Moyen (${report.currency})`, width: 18 },
      { header: `Coût Rendu (${report.currency})`, width: 18 },
      { header: `Commissions (${report.currency})`, width: 18 },
      { header: `Chiffre d’Affaires (${report.currency})`, width: 22 },
      { header: `Marge Nette Unit. (${report.currency})`, width: 20 },
      { header: `Marge Nette Totale (${report.currency})`, width: 22 },
      { header: 'Taux Marge', width: 14 },
      { header: 'Stock Restant', width: 14 },
      { header: 'Autonomie (Jours)', width: 16 },
      { header: 'Réappro 30j (pcs)', width: 18 },
    ];
    styleHeader(wp.getRow(1));

    report.products.forEach((p, i) => {
      const r = wp.getRow(i + 2);
      r.getCell(1).value = p.name;
      r.getCell(2).value = p.sales;
      r.getCell(2).numFmt = '#,##0';

      r.getCell(3).value = p.sellingPriceAvg ?? 0;
      r.getCell(3).numFmt = '#,##0';

      r.getCell(4).value = p.landedCost ?? 0;
      r.getCell(4).numFmt = '#,##0';

      r.getCell(5).value = p.commissionsPerUnit ?? 0;
      r.getCell(5).numFmt = '#,##0';

      r.getCell(6).value = p.revenue ?? p.sales * (p.sellingPriceAvg ?? 0);
      r.getCell(6).numFmt = '#,##0';

      r.getCell(7).value = p.netMarginUnit ?? ((p.sellingPriceAvg ?? 0) - (p.landedCost ?? 0) - (p.commissionsPerUnit ?? 0));
      r.getCell(7).numFmt = '#,##0';

      r.getCell(8).value = p.netMargin ?? p.sales * (p.netMarginUnit ?? 0);
      r.getCell(8).numFmt = '#,##0';

      const rate = p.marginRate !== undefined ? p.marginRate / 100 : (p.revenue && p.netMargin ? p.netMargin / p.revenue : 0);
      r.getCell(9).value = rate;
      r.getCell(9).numFmt = '0.0%';

      r.getCell(10).value = p.currentStock !== undefined ? p.currentStock : '–';
      if (typeof p.currentStock === 'number') r.getCell(10).numFmt = '#,##0';

      r.getCell(11).value = p.daysOfStock !== undefined ? (p.daysOfStock >= 999 ? '> 90 j' : p.daysOfStock) : '–';
      r.getCell(12).value = p.reorderQuantity30d ?? 0;
      if (typeof p.reorderQuantity30d === 'number') r.getCell(12).numFmt = '#,##0';

      r.eachCell((c) => (c.font = { name: FONT, size: 10 }));
      r.getCell(8).font = { name: FONT, size: 10, bold: true };
      r.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    });

    wp.autoFilter = { from: 'A1', to: 'L1' };
    base(wp);
  }

  // ---- Stocks & Alertes Rupture
  if (cfg.showStockAlerts) {
    const alerts = report.stockAlerts ?? report.products
      .filter((p) => p.currentStock !== undefined)
      .map((p) => {
        const stock = p.currentStock ?? 0;
        const vel = p.dailyVelocity ?? 0;
        const days = p.daysOfStock ?? (vel > 0 ? Math.round(stock / vel) : stock > 0 ? 999 : 0);
        const status: 'rupture' | 'urgent' | 'warning' | 'optimal' =
          stock <= 0 ? 'rupture' : days < 7 ? 'urgent' : days <= 14 ? 'warning' : 'optimal';
        const reorder = p.reorderQuantity30d ?? Math.max(0, Math.ceil(vel * 30 - stock));
        return {
          productName: p.name,
          currentStock: stock,
          dailyVelocity: vel,
          daysOfStock: days,
          status,
          reorderQuantity30d: reorder,
          recommendation: stock <= 0 ? 'Rupture immédiate' : days < 7 ? 'Commander d’urgence' : days <= 14 ? 'Surveiller réassort' : 'Stock optimal',
        };
      });

    if (alerts.length > 0) {
      const wsStock = wb.addWorksheet('Vigilance Stocks');
      wsStock.columns = [
        { header: 'Produit', width: 36 },
        { header: 'Stock Actuel (pcs)', width: 18 },
        { header: 'Vélocité (pcs/j)', width: 16 },
        { header: 'Autonomie (Jours)', width: 18 },
        { header: 'Statut Alerte', width: 20 },
        { header: 'Besoin Réappro 30j (pcs)', width: 24 },
        { header: 'Recommandation Terrain', width: 30 },
      ];
      styleHeader(wsStock.getRow(1));

      alerts.forEach((a, i) => {
        const r = wsStock.getRow(i + 2);
        r.getCell(1).value = a.productName;
        r.getCell(2).value = a.currentStock;
        r.getCell(2).numFmt = '#,##0';
        r.getCell(3).value = a.dailyVelocity;
        r.getCell(3).numFmt = '0.0';
        r.getCell(4).value = a.daysOfStock >= 999 ? '> 90 j' : a.daysOfStock;
        r.getCell(5).value =
          a.status === 'rupture' ? '🔴 RUPTURE' : a.status === 'urgent' ? '⚠️ Moins de 7j' : a.status === 'warning' ? '🟡 Réappro 14j' : '🟢 Optimal';
        r.getCell(6).value = a.reorderQuantity30d;
        r.getCell(6).numFmt = '#,##0';
        r.getCell(7).value = a.recommendation;

        r.eachCell((c) => (c.font = { name: FONT, size: 10 }));
        r.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      });

      wsStock.autoFilter = { from: 'A1', to: 'G1' };
      base(wsStock);
    }
  }

  // ---- Employés
  if (cfg.showEmployees && report.employees.length) {
    const we = wb.addWorksheet('Employés');
    we.columns = [{ header: 'Nom', width: 22 }, { header: 'Rôle', width: 12 }, { header: 'Réussies', width: 12 }, { header: 'Traitées', width: 12 }, { header: 'Taux', width: 10 }, { header: 'Délai moyen (min)', width: 18 }, { header: 'Échantillon', width: 22 }];
    styleHeader(we.getRow(1));
    report.employees.forEach((e, i) => {
      const r = we.getRow(i + 2);
      r.getCell(1).value = e.name;
      r.getCell(2).value = e.role === 'closeuse' ? 'Closeuse' : 'Livreur';
      r.getCell(3).value = e.done;
      r.getCell(4).value = e.total;
      r.getCell(5).value = { formula: `IF(D${i + 2}=0,"",C${i + 2}/D${i + 2})`, result: e.total > 0 ? e.done / e.total : '' } as ExcelJS.CellFormulaValue;
      r.getCell(5).numFmt = '0%';
      if (e.avgDelayMin != null) r.getCell(6).value = Math.round(e.avgDelayMin);
      r.getCell(7).value = { formula: `IF(D${i + 2}<5,"faible, à interpréter avec prudence","")`, result: e.total < 5 ? 'faible, à interpréter avec prudence' : '' } as ExcelJS.CellFormulaValue;
      r.eachCell((c) => (c.font = { name: FONT, size: 10 }));
      r.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    });
    we.autoFilter = { from: 'A1', to: 'G1' };
    base(we);
  }

  // ---- Journalier
  if (cfg.showDailyTrends && report.days?.length) {
    const wd = wb.addWorksheet('Journalier');
    wd.columns = [{ header: 'Date', width: 14 }, { header: `CA (${report.currency})`, width: 16 }, { header: 'Livraisons', width: 12 }, { header: 'Rejetées', width: 12 }, { header: 'Injoignables', width: 14 }, { header: 'Taux de livraison', width: 18 }, { header: 'CA moyenne 7 jours', width: 20 }];
    styleHeader(wd.getRow(1));
    const d = report.days;
    d.forEach((x, i) => {
      const n = i + 2;
      const r = wd.getRow(n);
      r.getCell(1).value = new Date(`${x.date}T00:00:00Z`);
      r.getCell(1).numFmt = 'dd/mm/yyyy';
      r.getCell(2).value = x.ca;
      r.getCell(2).numFmt = '#,##0';
      r.getCell(3).value = x.livraisons;
      r.getCell(4).value = x.rejetees;
      r.getCell(5).value = x.injoignables;
      const tot = x.livraisons + x.rejetees + x.injoignables;
      r.getCell(6).value = { formula: `IF(SUM(C${n}:E${n})=0,"",C${n}/SUM(C${n}:E${n}))`, result: tot ? x.livraisons / tot : '' } as ExcelJS.CellFormulaValue;
      r.getCell(6).numFmt = '0%';
      if (i >= 6) {
        const avg = d.slice(i - 6, i + 1).reduce((a, y) => a + y.ca, 0) / 7;
        r.getCell(7).value = { formula: `AVERAGE(B${n - 6}:B${n})`, result: avg } as ExcelJS.CellFormulaValue;
        r.getCell(7).numFmt = '#,##0';
      }
      r.eachCell((c) => (c.font = { name: FONT, size: 10 }));
    });
    const tr = wd.getRow(d.length + 2);
    tr.getCell(1).value = 'Total';
    (['B', 'C', 'D', 'E'] as const).forEach((col, k) => {
      const key = (['ca', 'livraisons', 'rejetees', 'injoignables'] as const)[k];
      tr.getCell(col).value = { formula: `SUM(${col}2:${col}${d.length + 1})`, result: d.reduce((a, y) => a + y[key], 0) } as ExcelJS.CellFormulaValue;
    });
    tr.getCell(2).numFmt = '#,##0';
    tr.eachCell((c) => { c.font = { name: FONT, size: 10, bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } }; });
    wd.autoFilter = { from: 'A1', to: 'G1' };
    base(wd);
  }

  // ---- Analyse
  if (cfg.showAiAnalysis && report.analysisMarkdown) {
    const wa = wb.addWorksheet('Analyse');
    wa.columns = [{ width: 30 }, { width: 30 }, { width: 30 }, { width: 30 }];
    wa.views = [{ showGridLines: false }];
    let row = 1;
    const addText = (text: string, opts: { bold?: boolean; size?: number; italic?: boolean; color?: string } = {}) => {
      wa.mergeCells(row, 1, row, 4);
      const c = wa.getCell(row, 1);
      c.value = text;
      c.font = { name: FONT, size: opts.size ?? 10, bold: opts.bold, italic: opts.italic, color: opts.color ? { argb: opts.color } : undefined };
      c.alignment = { wrapText: true, vertical: 'top' };
      wa.getRow(row).height = Math.max(16, Math.ceil(text.length / 105) * 14 + (text.split('\n').length - 1) * 14);
      row++;
    };
    addText('Analyse de l’assistant IA', { bold: true, size: 14 });
    row++;
    for (const b of parseMarkdown(report.analysisMarkdown)) {
      if (b.t === 'h') addText(plain(b.runs), { bold: true, size: 12 });
      else if (b.t === 'p') addText(plain(b.runs));
      else if (b.t === 'ul') b.items.forEach((it) => addText(`•  ${plain(it)}`));
      else if (b.t === 'ol') b.items.forEach((it, i) => addText(`${i + 1}.  ${plain(it)}`));
      else if (b.t === 'table') {
        const cols = Math.min(b.header.length, 4);
        const hr = wa.getRow(row);
        for (let c = 0; c < cols; c++) hr.getCell(c + 1).value = plain(b.header[c]);
        styleHeader(hr);
        row++;
        for (const r of b.rows) {
          const rr = wa.getRow(row);
          let maxLines = 1;
          for (let c = 0; c < cols; c++) {
            const t = plain(r[c] ?? []);
            rr.getCell(c + 1).value = t;
            rr.getCell(c + 1).font = { name: FONT, size: 9 };
            rr.getCell(c + 1).alignment = { wrapText: true, vertical: 'top' };
            rr.getCell(c + 1).border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
            maxLines = Math.max(maxLines, t.split('\n').reduce((a, l) => a + Math.ceil(l.length / 34), 0));
          }
          rr.height = Math.max(16, maxLines * 12.5);
          row++;
        }
        row++;
      } else row++;
    }
    addText(NOTE, { italic: true, size: 8, color: 'FF64748B' });
  }

  // ---- Graphiques
  if (cfg.showCharts && charts.length) {
    const wg = wb.addWorksheet('Graphiques');
    wg.views = [{ showGridLines: false }];
    let top = 1;
    for (const c of charts) {
      const w = 700;
      const h = Math.round((c.height / c.width) * w);
      const id = wb.addImage({ buffer: c.png as unknown as ExcelJS.Buffer, extension: 'png' });
      wg.addImage(id, { tl: { col: 0.2, row: top }, ext: { width: w, height: h } });
      top += Math.ceil(h / 20) + 2;
    }
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function exportXlsx(report: BilanReport, charts: ChartImage[]): Promise<Blob> {
  const buf = await buildXlsx(report, charts);
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
