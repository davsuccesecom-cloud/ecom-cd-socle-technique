import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, LevelFormat, Packer, PageNumber,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import { parseMarkdown, type Block, type Run } from './markdown';
import type { BilanReport, ChartImage } from './types';
import { NOTE, dateFr, nf, rateOf } from './util';

const FONT = 'Arial';
const CONTENT_W = 9746; // A4 = 11906 DXA, marges 1080 x 2
const MUTED = '64748B';
const LINE = 'E2E8F0';

/** Découpe sur \n pour créer de vrais retours à la ligne Word (jamais de \n dans un TextRun). */
function textRuns(rs: Run[], base: { size?: number; color?: string; bold?: boolean } = {}): TextRun[] {
  const out: TextRun[] = [];
  rs.forEach((r) => {
    r.text.split('\n').forEach((part, i) => {
      out.push(new TextRun({ text: part, bold: r.bold || base.bold, italics: r.italic, size: base.size, color: base.color, font: FONT, break: i > 0 ? 1 : undefined }));
    });
  });
  return out;
}

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const cellBorders = { top: border, bottom: border, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } };

function cell(children: Paragraph[], width: number, fill?: string) {
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
  });
}

function table(head: Run[][], rows: Run[][][], widths: number[]) {
  const sum = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: sum, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: head.map((h, i) => cell([new Paragraph({ children: textRuns(h, { size: 18, bold: true }) })], widths[i], 'EEF2F7')) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell([new Paragraph({ children: textRuns(c, { size: 18 }) })], widths[i])) })),
    ],
  });
}

function simpleTable(head: string[], body: (string | number)[][], widths: number[], _right: number[] = []) {
  const toRuns = (s: string | number): Run[] => [{ text: String(s) }];
  const t = table(head.map(toRuns), body.map((r) => r.map(toRuns)), widths);
  return t;
}

function colWidths(header: Run[][], rows: Run[][][]): number[] {
  const n = header.length;
  const weight = Array.from({ length: n }, (_, c) => {
    const lens = [header[c], ...rows.map((r) => r[c])].map((cl) => Math.max(...cl.map((x) => x.text).join('').split('\n').map((l) => l.length), 1));
    return Math.min(Math.max(Math.max(...lens), 8), 60);
  });
  const sum = weight.reduce((a, b) => a + b, 0);
  const w = weight.map((x) => Math.round((CONTENT_W * x) / sum));
  w[w.length - 1] += CONTENT_W - w.reduce((a, b) => a + b, 0);
  return w;
}

export function buildDocument(report: BilanReport, charts: ChartImage[]): Document {
  let olInstance = 0;
  const children: (Paragraph | Table)[] = [];
  const spacer = (after = 120) => new Paragraph({ spacing: { after }, children: [] });
  const h2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 280, after: 120 }, children: [new TextRun({ text: t, font: FONT })] });

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

  // Bandeau titre
  children.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: CONTENT_W, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: '0F172A', color: 'auto' },
              margins: { top: 260, bottom: 260, left: 300, right: 300 },
              borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
              children: [
                new Paragraph({ children: [new TextRun({ text: report.title, bold: true, size: 36, color: 'FFFFFF', font: FONT })] }),
                new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: `${report.team}  ·  ${report.periodLabel}`, size: 22, color: 'CBD5E1', font: FONT })] }),
                new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: `Généré le ${dateFr(report.generatedAt)}  ·  Devise : ${report.currency}`, size: 17, color: '94A3B8', font: FONT })] }),
              ],
            }),
          ],
        }),
      ],
    }),
    spacer(160),
  );

  if (report.question) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        indent: { left: 200 },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: '6366F1', space: 8 } },
        shading: { type: ShadingType.CLEAR, fill: 'F1F5F9', color: 'auto' },
        children: [new TextRun({ text: 'Question posée : ', bold: true, size: 19, font: FONT }), new TextRun({ text: report.question, italics: true, size: 19, font: FONT })],
      }),
    );
  }

  // 1. KPI : grille 3 colonnes
  if (cfg.showKpis && report.kpis.length > 0) {
    children.push(h2('1. Chiffres Clés'));
    const colW = Math.floor(CONTENT_W / 3);
    const widths3 = [colW, colW, CONTENT_W - 2 * colW];
    const kRows: TableRow[] = [];
    for (let i = 0; i < report.kpis.length; i += 3) {
      const slice = report.kpis.slice(i, i + 3);
      kRows.push(
        new TableRow({
          cantSplit: true,
          children: [0, 1, 2].map((j) => {
            const k = slice[j];
            const color = !k ? '0F172A' : k.tone === 'bad' ? 'B91C1C' : k.tone === 'warn' ? 'B45309' : k.tone === 'good' ? '047857' : '0F172A';
            return new TableCell({
              width: { size: widths3[j], type: WidthType.DXA },
              shading: k ? { type: ShadingType.CLEAR, fill: 'F8FAFC', color: 'auto' } : undefined,
              borders: { top: { style: BorderStyle.SINGLE, size: 24, color: 'FFFFFF' }, bottom: { style: BorderStyle.SINGLE, size: 24, color: 'FFFFFF' }, left: { style: BorderStyle.SINGLE, size: 24, color: 'FFFFFF' }, right: { style: BorderStyle.SINGLE, size: 24, color: 'FFFFFF' } },
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: k
                ? [
                    new Paragraph({ children: [new TextRun({ text: k.label, size: 17, color: MUTED, font: FONT })] }),
                    new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: k.value, bold: true, size: 28, color, font: FONT })] }),
                    new Paragraph({ children: [new TextRun({ text: k.hint ?? ' ', size: 16, color: MUTED, font: FONT })] }),
                  ]
                : [new Paragraph({ children: [] })],
            });
          }),
        }),
      );
    }
    children.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths3, rows: kRows }));
  }

  // 2. Ventilation de Trésorerie (Règle 65% / 35%)
  if (cfg.showTreasurySplit && report.treasurySplit) {
    const ts = report.treasurySplit;
    children.push(h2('2. Trésorerie Stratégique COD (Règle 65% / 35%)'));
    const halfW = Math.floor(CONTENT_W / 2);
    children.push(
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [halfW, CONTENT_W - halfW],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: halfW, type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: 'EFF6FF', color: 'auto' },
                margins: { top: 120, bottom: 120, left: 160, right: 160 },
                borders: cellBorders,
                children: [
                  new Paragraph({ children: [new TextRun({ text: `RÉINVESTISSEMENT STRATÉGIQUE (${ts.reinvestmentRate} %)`, bold: true, size: 17, color: '1E40AF', font: FONT })] }),
                  new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: `${nf(ts.reinvestmentAmount)} ${report.currency}`, bold: true, size: 28, color: '1E3A8A', font: FONT })] }),
                  new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: ts.reinvestmentLabel || 'Stock usine, pub Meta/TikTok & BFR.', size: 16, color: '3B82F6', font: FONT })] }),
                ],
              }),
              new TableCell({
                width: { size: CONTENT_W - halfW, type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: 'F0FDF4', color: 'auto' },
                margins: { top: 120, bottom: 120, left: 160, right: 160 },
                borders: cellBorders,
                children: [
                  new Paragraph({ children: [new TextRun({ text: `DIVIDENDES SÉCURISÉS (${ts.dividendRate} %)`, bold: true, size: 17, color: '065F46', font: FONT })] }),
                  new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: `${nf(ts.dividendAmount)} ${report.currency}`, bold: true, size: 28, color: '064E3B', font: FONT })] }),
                  new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: ts.dividendLabel || 'Bénéfice net distribuable sans risque de trésorerie.', size: 16, color: '10B981', font: FONT })] }),
                ],
              }),
            ],
          }),
        ],
      }),
    );
  }

  // 3. Bilan Comptable & Marges par Produit
  if (cfg.showProductProfitability && report.products.length > 0) {
    children.push(h2('3. Bilan Comptable & Marges par Produit'));
    const hasDetailedMetrics = report.products.some((p) => p.netMargin !== undefined || p.landedCost !== undefined);
    if (hasDetailedMetrics) {
      children.push(
        simpleTable(
          ['Produit', 'Ventes', 'PV Moyen', 'Coût Rendu', 'CA Total', 'Marge Nette', 'Taux Marge'],
          report.products.map((p) => {
            const marginStr = p.netMargin !== undefined ? `${p.netMargin > 0 ? '+' : ''}${nf(p.netMargin)} ${report.currency}` : '–';
            const rateStr = p.marginRate !== undefined ? `${p.marginRate} %` : p.revenue && p.netMargin ? `${Math.round((p.netMargin / p.revenue) * 100)} %` : '–';
            return [
              p.name,
              nf(p.sales),
              p.sellingPriceAvg ? `${nf(p.sellingPriceAvg)} ${report.currency}` : '–',
              p.landedCost ? `${nf(p.landedCost)} ${report.currency}` : '–',
              p.revenue ? `${nf(p.revenue)} ${report.currency}` : '–',
              marginStr,
              rateStr,
            ];
          }),
          [2800, 950, 1200, 1200, 1300, 1300, 996]
        )
      );
    } else {
      children.push(simpleTable(['Produit', 'Ventes'], report.products.map((p) => [p.name, nf(p.sales)]), [7746, 2000]));
    }
  }

  // 4. Stocks à Prévenir & Alertes Rupture
  if (cfg.showStockAlerts) {
    const alerts = report.stockAlerts ?? report.products
      .filter((p) => p.currentStock !== undefined)
      .map((p) => {
        const stock = p.currentStock ?? 0;
        const vel = p.dailyVelocity ?? 0;
        const days = p.daysOfStock ?? (vel > 0 ? Math.round(stock / vel) : stock > 0 ? 999 : 0);
        const status = stock <= 0 ? 'rupture' : days < 7 ? 'urgent' : days <= 14 ? 'warning' : 'optimal';
        const reorder = p.reorderQuantity30d ?? Math.max(0, Math.ceil(vel * 30 - stock));
        return {
          productName: p.name,
          currentStock: stock,
          dailyVelocity: vel,
          daysOfStock: days,
          status,
          reorderQuantity30d: reorder,
        };
      });

    if (alerts.length > 0) {
      children.push(h2('4. Stocks à Prévenir & Alertes Rupture'));
      children.push(
        simpleTable(
          ['Produit', 'Stock Dispo', 'Vente/Jour', 'Autonomie', 'Statut Alerte', 'Besoin 30j'],
          alerts.map((a) => {
            const statusLabel =
              a.status === 'rupture'
                ? '🔴 RUPTURE'
                : a.status === 'urgent'
                ? '⚠️ Moins de 7j'
                : a.status === 'warning'
                ? '🟡 Réappro 14j'
                : '🟢 Stock sain';
            return [
              a.productName,
              `${nf(a.currentStock)} pcs`,
              `${a.dailyVelocity.toFixed(1)} /j`,
              a.daysOfStock >= 999 ? '> 90 j' : `${a.daysOfStock} j`,
              statusLabel,
              a.reorderQuantity30d > 0 ? `+${nf(a.reorderQuantity30d)} pcs` : '0 (couvert)',
            ];
          }),
          [3200, 1300, 1100, 1100, 1500, 1546]
        )
      );
    }
  }

  // 5. Graphiques
  if (cfg.showCharts && charts.length) {
    children.push(h2('5. Graphiques & Courbes'));
    for (const c of charts) {
      const w = 600;
      const h = Math.round((c.height / c.width) * w);
      children.push(
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, keepNext: false, children: [new ImageRun({ type: 'png', data: c.png, transformation: { width: w, height: h }, altText: { title: c.title, description: c.title, name: c.title } })] }),
      );
    }
  }

  // 6. Employés
  if (cfg.showEmployees && report.employees.length) {
    const closeuses = report.employees.filter((e) => e.role === 'closeuse');
    const livreurs = report.employees.filter((e) => e.role === 'livreur');
    const pct = (e: (typeof report.employees)[number]) => { const r = rateOf(e); return r === null ? '–' : `${Math.round(r * 100)} %`; };
    if (closeuses.length || livreurs.length) {
      children.push(h2('6. Performance Équipe Terrain'));
    }
    if (closeuses.length) {
      children.push(simpleTable(['Nom (Closeuse)', 'Confirmées', 'Traitées', 'Taux', 'Délai moyen'], closeuses.map((e) => [e.name, e.done, e.total, pct(e), e.avgDelayMin == null ? '–' : `${Math.round(e.avgDelayMin)} min`]), [3146, 1650, 1650, 1500, 1800]));
    }
    if (livreurs.length) {
      children.push(simpleTable(['Nom (Livreur)', 'Livrées', 'Tentatives', 'Taux'], livreurs.map((e) => [e.name, e.done, e.total, pct(e)]), [4046, 1900, 1900, 1900]));
    }
  }

  // 7. Évolution Journalière
  if (cfg.showDailyTrends && report.days?.length) {
    children.push(h2('7. Évolution Chronologique Journalière'));
    children.push(
      simpleTable(
        ['Date', 'CA Livré', 'Livrées', 'Rejetées', 'Injoignables'],
        report.days.map((d) => [
          d.dayLabel || d.date,
          `${nf(d.ca)} ${report.currency}`,
          nf(d.livraisons),
          nf(d.rejetees),
          nf(d.injoignables),
        ]),
        [2800, 2200, 1500, 1500, 1746]
      )
    );
  }

  // 8. Analyse IA
  if (cfg.showAiAnalysis && report.analysisMarkdown) {
    children.push(h2('8. Analyse de Direction & Audit IA'));
    const blockToDocx = (b: Block): (Paragraph | Table)[] => {
      switch (b.t) {
        case 'h':
          return [new Paragraph({ heading: b.level >= 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2, spacing: { before: 220, after: 90 }, children: [new TextRun({ text: b.runs.map((r) => r.text).join(''), font: FONT })] })];
        case 'p':
          return [new Paragraph({ spacing: { after: 120, line: 276 }, children: textRuns(b.runs, { size: 20 }) })];
        case 'ul':
          return b.items.map((it) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60 }, children: textRuns(it, { size: 20 }) }));
        case 'ol': {
          olInstance++;
          const inst = olInstance;
          return b.items.map((it) => new Paragraph({ numbering: { reference: 'num', level: 0, instance: inst }, spacing: { after: 60 }, children: textRuns(it, { size: 20 }) }));
        }
        case 'hr':
          return [new Paragraph({ spacing: { before: 80, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 1 } }, children: [] })];
        case 'table':
          return [table(b.header.map((h) => h.map((r) => ({ ...r, bold: true }))), b.rows, colWidths(b.header, b.rows)), spacer(160)];
      }
    };
    parseMarkdown(report.analysisMarkdown).forEach((b) => children.push(...blockToDocx(b)));
  }

  children.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: NOTE, italics: true, size: 16, color: MUTED, font: FONT })] }));

  const doc = new Document({
    creator: 'Ecom COD',
    title: `${report.title} - ${report.team} - ${report.periodLabel}`,
    styles: {
      default: { document: { run: { font: FONT, size: 20 } } },
      paragraphStyles: [
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: '0F172A', font: FONT }, paragraph: { outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, color: '334155', font: FONT }, paragraph: { outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
        { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `Ecom COD  ·  ${report.team}  ·  ${report.periodLabel}   |   Page `, size: 16, color: MUTED, font: FONT }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED, font: FONT }),
                  new TextRun({ text: ' / ', size: 16, color: MUTED, font: FONT }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MUTED, font: FONT }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return doc;
}

/** Navigateur : Packer.toBlob. (Node : Packer.toBuffer(buildDocument(...)).) */
export async function exportDocx(report: BilanReport, charts: ChartImage[]): Promise<Blob> {
  return Packer.toBlob(buildDocument(report, charts));
}
