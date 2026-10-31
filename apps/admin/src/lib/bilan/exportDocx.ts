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
                new Paragraph({ children: [new TextRun({ text: report.title, bold: true, size: 40, color: 'FFFFFF', font: FONT })] }),
                new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: `${report.team}  ·  ${report.periodLabel}`, size: 24, color: 'CBD5E1', font: FONT })] }),
                new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: `Généré le ${dateFr(report.generatedAt)}`, size: 18, color: '94A3B8', font: FONT })] }),
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

  // KPI : grille 3 colonnes
  children.push(h2('Chiffres clés'));
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
                  new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: k.value, bold: true, size: 30, color, font: FONT })] }),
                  new Paragraph({ children: [new TextRun({ text: k.hint ?? ' ', size: 17, color: MUTED, font: FONT })] }),
                ]
              : [new Paragraph({ children: [] })],
          });
        }),
      }),
    );
  }
  children.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths3, rows: kRows }));

  // Graphiques
  if (charts.length) {
    children.push(h2('Graphiques'));
    for (const c of charts) {
      const w = 600;
      const h = Math.round((c.height / c.width) * w);
      children.push(
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, keepNext: false, children: [new ImageRun({ type: 'png', data: c.png, transformation: { width: w, height: h }, altText: { title: c.title, description: c.title, name: c.title } })] }),
      );
    }
  }

  const closeuses = report.employees.filter((e) => e.role === 'closeuse');
  const livreurs = report.employees.filter((e) => e.role === 'livreur');
  const pct = (e: (typeof report.employees)[number]) => { const r = rateOf(e); return r === null ? '–' : `${Math.round(r * 100)} %`; };
  if (closeuses.length) {
    children.push(h2('Closeuses'));
    children.push(simpleTable(['Nom', 'Confirmées', 'Traitées', 'Taux', 'Délai moyen'], closeuses.map((e) => [e.name, e.done, e.total, pct(e), e.avgDelayMin == null ? '–' : `${Math.round(e.avgDelayMin)} min`]), [3146, 1650, 1650, 1500, 1800]));
  }
  if (livreurs.length) {
    children.push(h2('Livreurs'));
    children.push(simpleTable(['Nom', 'Livrées', 'Tentatives', 'Taux'], livreurs.map((e) => [e.name, e.done, e.total, pct(e)]), [4046, 1900, 1900, 1900]));
  }
  if (report.products.length) {
    children.push(h2('Produits'));
    children.push(simpleTable(['Produit', 'Ventes'], report.products.map((p) => [p.name, nf(p.sales)]), [7746, 2000]));
  }

  // Analyse IA
  children.push(h2('Analyse de l’assistant IA'));
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
