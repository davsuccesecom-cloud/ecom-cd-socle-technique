import { dailyChart, employeesChart, funnelChart } from './charts';
import type { BilanReport, ChartImage, ChartSvg } from './types';

/** Les graphiques d'un bilan, dans l'ordre d'affichage. Un graphique sans données n'est pas créé. */
export function chartsFor(report: BilanReport): ChartSvg[] {
  const out: ChartSvg[] = [];
  if (report.days && report.days.length >= 2) out.push(dailyChart(report.days, report.currency));
  if (report.funnel.some((s) => s.value > 0)) out.push(funnelChart(report.funnel));
  const closeuses = report.employees.filter((e) => e.role === 'closeuse' && e.total > 0);
  const livreurs = report.employees.filter((e) => e.role === 'livreur' && e.total > 0);
  if (closeuses.length) out.push(employeesChart('Closeuses : taux de confirmation', 'Confirmées sur commandes traitées', closeuses));
  if (livreurs.length) out.push(employeesChart('Livreurs : taux de livraison', 'Livrées sur tentatives', livreurs));
  return out;
}

/** Navigateur : SVG -> PNG net (x2) via canvas. */
export async function svgToPng(c: ChartSvg, scale = 2): Promise<ChartImage> {
  const url = URL.createObjectURL(new Blob([c.svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Graphique illisible'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = c.width * scale;
    canvas.height = c.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponible');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG impossible'))), 'image/png'));
    return { title: c.title, png: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
