import { parseMarkdown, type Block, type Run } from './markdown';
import type { BilanReport, ChartImage } from './types';
import { NOTE, b64, dateFr, nf, rateOf } from './util';

const INK = '#1e293b';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const CONTENT_W = 515; // A4 (595 pt) - marges 40 + 40

const runs = (rs: Run[]) => rs.map((r) => ({ text: r.text, bold: r.bold, italics: r.italic }));

const tableLayout = {
  hLineWidth: (i: number) => (i === 0 ? 0 : 0.6),
  vLineWidth: () => 0,
  hLineColor: () => LINE,
  paddingTop: () => 5,
  paddingBottom: () => 5,
  paddingLeft: () => 6,
  paddingRight: () => 6,
};

function widthsFor(header: Run[][], rows: Run[][][]): number[] {
  const n = header.length;
  const weight = Array.from({ length: n }, (_, c) => {
    const lens = [header[c], ...rows.map((r) => r[c])].map((cell) =>
      Math.max(...cell.map((x) => x.text).join('').split('\n').map((l) => l.length), 1),
    );
    return Math.min(Math.max(Math.max(...lens), 8), 60);
  });
  const sum = weight.reduce((a, b) => a + b, 0);
  return weight.map((w) => Math.round((CONTENT_W * w) / sum));
}

function dataTable(head: string[], body: (string | number)[][], widths?: (number | string)[], align?: ('left' | 'right')[]) {
  return {
    table: {
      headerRows: 1,
      widths: widths ?? head.map(() => '*'),
      body: [
        head.map((h, i) => ({ text: h, bold: true, fontSize: 9, fillColor: '#eef2f7', alignment: align?.[i] ?? 'left' })),
        ...body.map((r) => r.map((c, i) => ({ text: String(c), fontSize: 9.5, alignment: align?.[i] ?? 'left' }))),
      ],
    },
    layout: tableLayout,
    margin: [0, 2, 0, 12],
  };
}

function blockToPdf(b: Block): unknown {
  switch (b.t) {
    case 'h':
      return { text: runs(b.runs), style: b.level === 1 ? 'h2' : b.level === 2 ? 'h2' : 'h3', margin: [0, 10, 0, 4] };
    case 'p':
      return { text: runs(b.runs), margin: [0, 0, 0, 6] };
    case 'ul':
      return { ul: b.items.map((it) => ({ text: runs(it) })), margin: [8, 0, 0, 8] };
    case 'ol':
      return { ol: b.items.map((it) => ({ text: runs(it) })), margin: [8, 0, 0, 8] };
    case 'hr':
      return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_W, y2: 0, lineWidth: 0.6, lineColor: LINE }], margin: [0, 6, 0, 6] };
    case 'table': {
      const widths = widthsFor(b.header, b.rows);
      return {
        table: {
          headerRows: 1,
          widths,
          body: [
            b.header.map((h) => ({ text: runs(h.map((r) => ({ ...r, bold: true }))), fontSize: 9, fillColor: '#eef2f7' })),
            ...b.rows.map((r) => r.map((c) => ({ text: runs(c), fontSize: 9 }))),
          ],
        },
        layout: tableLayout,
        margin: [0, 2, 0, 12],
      };
    }
  }
}

const section = (text: string) => ({ text, style: 'h2', margin: [0, 14, 0, 6] });

export function buildPdfDefinition(report: BilanReport, charts: ChartImage[]) {
  const content: unknown[] = [];

  content.push({
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              { text: report.title, fontSize: 20, bold: true, color: '#ffffff' },
              { text: `${report.team}  ·  ${report.periodLabel}`, fontSize: 12, color: '#cbd5e1', margin: [0, 4, 0, 0] },
              { text: `Généré le ${dateFr(report.generatedAt)}`, fontSize: 9, color: '#94a3b8', margin: [0, 6, 0, 0] },
            ],
            fillColor: '#0f172a',
            margin: [18, 16, 18, 16],
          },
        ],
      ],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 12],
  });

  if (report.question) {
    content.push({
      table: { widths: ['*'], body: [[{ text: [{ text: 'Question posée : ', bold: true }, { text: report.question, italics: true }], fontSize: 9.5, fillColor: '#f1f5f9', margin: [10, 7, 10, 7] }]] },
      layout: { hLineWidth: () => 0, vLineWidth: (i: number) => (i === 0 ? 3 : 0), vLineColor: () => '#6366f1' },
      margin: [0, 0, 0, 4],
    });
  }

  // Chiffres clés : grille de 3 colonnes
  content.push(section('Chiffres clés'));
  const cells: any[] = report.kpis.map((k) => ({
    stack: [
      { text: k.label, fontSize: 8.5, color: MUTED },
      { text: k.value, fontSize: 15, bold: true, color: k.tone === 'bad' ? '#b91c1c' : k.tone === 'warn' ? '#b45309' : k.tone === 'good' ? '#047857' : INK, margin: [0, 3, 0, 1] },
      { text: k.hint ?? ' ', fontSize: 8.5, color: MUTED },
    ],
    fillColor: '#f8fafc',
    margin: [8, 7, 8, 7],
  }));
  while (cells.length % 3 !== 0) cells.push({ stack: [{ text: ' ' }], fillColor: '#ffffff', margin: [8, 7, 8, 7] });
  const kpiRows: unknown[][] = [];
  for (let i = 0; i < cells.length; i += 3) kpiRows.push(cells.slice(i, i + 3));
  content.push({
    table: { widths: ['*', '*', '*'], body: kpiRows },
    layout: { hLineWidth: () => 4, vLineWidth: () => 4, hLineColor: () => '#ffffff', vLineColor: () => '#ffffff' },
    margin: [-4, 0, -4, 6],
  });

  if (charts.length) {
    content.push(section('Graphiques'));
    for (const c of charts) {
      content.push({
        unbreakable: true,
        stack: [{ image: `data:image/png;base64,${b64(c.png)}`, width: CONTENT_W, alignment: 'center' }],
        margin: [0, 0, 0, 10],
      });
    }
  }

  const closeuses = report.employees.filter((e) => e.role === 'closeuse');
  const livreurs = report.employees.filter((e) => e.role === 'livreur');
  const pct = (e: (typeof report.employees)[number]) => {
    const r = rateOf(e);
    return r === null ? '–' : `${Math.round(r * 100)} %`;
  };
  if (closeuses.length) {
    content.push(section('Closeuses'));
    content.push(
      dataTable(['Nom', 'Confirmées', 'Traitées', 'Taux', 'Délai moyen'], closeuses.map((e) => [e.name, e.done, e.total, pct(e), e.avgDelayMin == null ? '–' : `${Math.round(e.avgDelayMin)} min`]), ['*', 70, 70, 60, 80], ['left', 'right', 'right', 'right', 'right']),
    );
  }
  if (livreurs.length) {
    content.push(section('Livreurs'));
    content.push(dataTable(['Nom', 'Livrées', 'Tentatives', 'Taux'], livreurs.map((e) => [e.name, e.done, e.total, pct(e)]), ['*', 80, 80, 70], ['left', 'right', 'right', 'right']));
  }
  if (report.products.length) {
    content.push(section('Produits'));
    content.push(dataTable(['Produit', 'Ventes'], report.products.map((p) => [p.name, nf(p.sales)]), ['*', 90], ['left', 'right']));
  }

  content.push(section('Analyse de l’assistant IA'));
  content.push(...parseMarkdown(report.analysisMarkdown).map(blockToPdf));
  content.push({ text: NOTE, fontSize: 8, color: MUTED, italics: true, margin: [0, 16, 0, 0] });

  return {
    pageSize: 'A4',
    pageMargins: [40, 44, 40, 52],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: INK, lineHeight: 1.25 },
    styles: {
      h2: { fontSize: 13, bold: true, color: '#0f172a' },
      h3: { fontSize: 11, bold: true, color: '#334155' },
    },
    footer: (current: number, total: number) => ({
      columns: [
        { text: `Ecom COD  ·  ${report.team}  ·  ${report.periodLabel}`, fontSize: 8, color: MUTED },
        { text: `${current} / ${total}`, fontSize: 8, color: MUTED, alignment: 'right' },
      ],
      margin: [40, 18, 40, 0],
    }),
    content,
    info: { title: `${report.title} - ${report.team} - ${report.periodLabel}`, author: 'Ecom COD' },
  };
}

/** Navigateur : charge pdfmake à la demande (≈ 1 Mo) uniquement au clic sur « Exporter ». */
export async function exportPdf(report: BilanReport, charts: ChartImage[]): Promise<Blob> {
  const pm: any = await import('pdfmake/build/pdfmake');
  const fonts: any = await import('pdfmake/build/vfs_fonts');
  const pdfMake = pm.default ?? pm;
  const vfs = fonts.default?.pdfMake?.vfs ?? fonts.pdfMake?.vfs ?? fonts.default ?? fonts;
  if (typeof pdfMake.addVirtualFileSystem === 'function') pdfMake.addVirtualFileSystem(vfs);
  else pdfMake.vfs = vfs;
  const def = buildPdfDefinition(report, charts);
  const doc = pdfMake.createPdf(def);
  return new Promise((resolve) => doc.getBlob((b: Blob) => resolve(b)));
}
