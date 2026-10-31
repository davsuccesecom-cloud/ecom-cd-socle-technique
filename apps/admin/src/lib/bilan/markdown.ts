/** Mini-parseur Markdown → blocs, pour rendre la réponse de l'IA proprement dans PDF, Word et Excel. */
export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
}
export type Block =
  | { t: 'h'; level: 1 | 2 | 3; runs: Run[] }
  | { t: 'p'; runs: Run[] }
  | { t: 'ul'; items: Run[][] }
  | { t: 'ol'; items: Run[][] }
  | { t: 'table'; header: Run[][]; rows: Run[][][] }
  | { t: 'hr' };

/** Nettoie les entités, les <br> et les caractères que les polices PDF ne savent pas afficher. */
export function clean(s: string): string {
  return s
    .replace(/&lt;br\s*\/?&gt;/gi, '\u0001')
    .replace(/<br\s*\/?>/gi, '\u0001')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[\u202f\u00a0\u2009]/g, ' ')
    .replace(/[\u2010\u2011\u2012]/g, '-')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/`/g, '');
}

export function inline(src: string): Run[] {
  src = src.replace(/\u0001/g, '\n');
  const out: Run[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ text: src.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ text: tok.slice(2, -2), bold: true });
    else out.push({ text: tok.slice(1, -1), italic: true });
    last = m.index + tok.length;
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out.length ? out : [{ text: '' }];
}

const cellRuns = (raw: string): Run[] =>
  inline(raw.trim().replace(/\u0001/g, '\n').replace(/(^|\n)\s*[-*•]\s+/g, '$1• ').replace(/\*\*\s*\*\*/g, ''));

const isSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
const splitRow = (l: string) => {
  const parts = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
  return parts.map((p) => p.trim());
};

export function parseMarkdown(input: string): Block[] {
  const lines = clean(input).replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ t: 'p', runs: inline(para.join('')) });
      para = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (/^-{3,}$|^\*{3,}$/.test(trimmed)) {
      flush();
      blocks.push({ t: 'hr' });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) {
      flush();
      blocks.push({ t: 'h', level: Math.min(h[1].length, 3) as 1 | 2 | 3, runs: inline(h[2].replace(/\*\*/g, '')) });
      continue;
    }
    if (trimmed.startsWith('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      flush();
      const header = splitRow(trimmed).map(cellRuns);
      const rows: Run[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = splitRow(lines[i]).map(cellRuns);
        while (cells.length < header.length) cells.push([{ text: '' }]);
        rows.push(cells.slice(0, header.length));
        i++;
      }
      i--;
      blocks.push({ t: 'table', header, rows });
      continue;
    }
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flush();
      const kind = ul ? 'ul' : 'ol';
      const items: Run[][] = [];
      while (i < lines.length) {
        const m = (kind === 'ul' ? /^\s*[-*•]\s+(.*)$/ : /^\s*\d+[.)]\s+(.*)$/).exec(lines[i]);
        if (!m) break;
        items.push(inline(m[1]));
        i++;
      }
      i--;
      blocks.push({ t: kind, items } as Block);
      continue;
    }
    para.push(line.endsWith('  ') ? trimmed + '\n' : trimmed + ' ');
  }
  flush();
  // retire les espaces de fin dans les paragraphes
  blocks.forEach((b) => {
    if (b.t === 'p' && b.runs.length) {
      const last = b.runs[b.runs.length - 1];
      last.text = last.text.replace(/\s+$/, '');
    }
  });
  return blocks;
}

export const plain = (runs: Run[]) => runs.map((r) => r.text).join('');
