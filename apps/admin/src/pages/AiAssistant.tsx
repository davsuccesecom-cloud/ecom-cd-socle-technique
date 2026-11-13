import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy, where, addDoc, getDocs, limit } from "firebase/firestore";
import { getDb, ConfirmDialog, AutoResizeTextarea, useRemunerationTotals } from "@ecomcod/shared";
import type { Team, Order, CashSettlementEntry, CodCountryInsight } from "@ecomcod/shared";
import {
  BarChart3,
  Award,
  Send,
  Copy,
  Check,
  Trash2,
  ArrowDown,
  PanelRightOpen,
  PanelRightClose,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  Layers,
  Landmark,
  Clock,
  Globe2,
  GraduationCap,
  BookOpenCheck,
  Compass,
} from "lucide-react";
import {
  aiService,
  type BusinessMetricsContext,
  type AiChatMessage,
  type LivreurCashAiSummary,
  type LogisticsAlertsContext,
} from "../services/aiService";
import { splitMessage, type ChartSpec } from "../lib/aiChart";
import ProChart from "../components/ProChart";
import { fetchDailyStats } from "../lib/dailyStatsSeries";
import ExportMenu from "../components/ExportMenu";
import { makeKpis, type BilanReport, type BilanEmployee, type BilanProduct, type BilanDay } from "../lib/bilan/types";
import { formatFirebaseError } from "../lib/firebaseErrors";

const SUGGESTIONS = [
  {
    icon: Globe2,
    title: "Bilan Logistique Stratégique Pays",
    desc: "Courbe de refroidissement, villes rentables et plan d'action COD du pays.",
    prompt:
      "Produis le Bilan Logistique Stratégique Pays complet pour le marché actif : analyse les courbes de refroidissement (<6h vs >24h), les créneaux horaires gagnants, la rentabilité par ville, les principaux motifs de rejet/échec terrain et un plan d'exécution prioritaire pour augmenter le taux de livraison.",
  },
  {
    icon: GraduationCap,
    title: "Générer Formation Closeuses",
    desc: "Module complet basé sur les vrais motifs de rejet et notes terrain du pays.",
    prompt:
      "Génère un module complet de formation pour mes closeuses basé sur les vrais motifs de rejet, les taux horaires et les notes terrain libres collectées sur ce pays : 1) diagnostic des pertes actuelles, 2) scripts vocaux et WhatsApp adaptés aux objections locales, 3) routine SLA < 15 min, 4) exercices de jeu de rôle et grille d'évaluation.",
  },
  {
    icon: BookOpenCheck,
    title: "Générer Formation Livreurs",
    desc: "Coaching terrain, gestion cash-on-delivery et réduction des injoignables.",
    prompt:
      "Génère un module complet de formation pour mes livreurs terrain basé sur les échecs de livraison et notes terrain de ce marché : 1) gestion des clients injoignables ou absents sur place, 2) respect strict des créneaux confirmés et rapidité <6h, 3) protocole d'encaissement et zéro litige de caisse, 4) barème de suivi.",
  },
  {
    icon: Compass,
    title: "Hacks & Prévisions COD Afrique",
    desc: "Prévisions ROI, créneaux d'or et leviers COD à fort impact par marché.",
    prompt:
      "En t'appuyant sur les données codInsights et l'historique réel de l'équipe, donne-moi les meilleurs hacks & prévisions COD Afrique applicables immédiatement : gain estimé en passant les livraisons sous 6h, créneaux horaires à privilégier, villes ou sources à isoler et prévisions d'encaissement à 14 jours.",
  },
  {
    icon: Landmark,
    title: "Caisse & Versements Livreurs",
    desc: "Vérifier qui a versé, les imprévus retranchés et qui payer.",
    prompt:
      "Fais-moi le point complet de la page Caisse & Versements Livreurs : quel livreur a encaissé quoi, quels montants ont été retranchés avec leurs notes justificatives, qui n'a pas encore soldé sa caisse et quel est le net à payer en Rémunération ?",
  },
  {
    icon: Clock,
    title: "Oublis, Retards & Logistique",
    desc: "Commandes hors délai, rappels oubliés, colis sur le terrain.",
    prompt:
      "Agis comme ma Vigie Logistique : liste-moi tout ce que j'ai oublié ou ce qui dépasse les délais d'opération (commandes Nouveau > 15 min, rappels programmés en retard, colis confirmés sans livreur, colis sur le terrain et numéros doublons à vérifier).",
  },
];

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${n++}`;
    if (tok.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-slate-100">
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-brand">
          {tok.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  const isTableSep = (l: string) =>
    /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
  const splitRow = (l: string) =>
    l
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  const startsTable = (idx: number) =>
    lines[idx].includes("|") && idx + 1 < lines.length && isTableSep(lines[idx + 1]);
  const bulletRe = /^\s*[-*•]\s+/;
  const orderedRe = /^\s*\d+[.)]\s+/;

  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls =
        level === 1
          ? "text-base font-semibold text-slate-100"
          : level === 2
            ? "text-sm font-semibold text-slate-100"
            : "text-xs font-semibold uppercase tracking-wider text-slate-300";
      out.push(
        <p key={k++} className={`${cls} pt-1`}>
          {renderInline(h[2], `h${k}`)}
        </p>
      );
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push(<hr key={k++} className="border-t border-surface-border" />);
      i++;
      continue;
    }

    if (startsTable(i)) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const tk = k++;
      out.push(
        <div key={tk} className="overflow-x-auto rounded-xl border border-surface-border bg-surface/50">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-surface-border bg-surface text-slate-300">
              <tr>
                {head.map((c, ci) => (
                  <th key={ci} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {renderInline(c, `th${tk}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 align-top text-slate-300">
                      {renderInline(c, `td${tk}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (bulletRe.test(line)) {
      const items: string[] = [];
      while (i < lines.length && bulletRe.test(lines[i])) {
        items.push(lines[i].replace(bulletRe, ""));
        i++;
      }
      const lk = k++;
      out.push(
        <ul key={lk} className="list-disc space-y-1.5 pl-5 marker:text-brand">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `li${lk}-${ii}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (orderedRe.test(line)) {
      const items: string[] = [];
      while (i < lines.length && orderedRe.test(lines[i])) {
        items.push(lines[i].replace(orderedRe, ""));
        i++;
      }
      const lk = k++;
      out.push(
        <ol key={lk} className="list-decimal space-y-1.5 pl-5 marker:text-brand">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `ol${lk}-${ii}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !bulletRe.test(lines[i]) &&
      !orderedRe.test(lines[i]) &&
      !startsTable(i)
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length === 0) {
      para.push(line);
      i++;
    }
    const pk = k++;
    out.push(
      <p key={pk} className="whitespace-pre-line">
        {renderInline(para.join("\n"), `p${pk}`)}
      </p>
    );
  }

  return <div className="space-y-3">{out}</div>;
}

const formatTime = (ts: unknown) => {
  const d =
    typeof ts === "object" &&
    ts !== null &&
    "toDate" in ts &&
    typeof (ts as { toDate: unknown }).toDate === "function"
      ? (ts as { toDate: () => Date }).toDate()
      : new Date(ts as number | string);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

interface AiAssistantProps {
  workspaceId: string;
  team: Team | null;
  allTeams: Team[];
  orders: Order[];
  closeuses: { id: string; name: string }[];
  livreurs: { id: string; name: string }[];
  codInsights?: CodCountryInsight[];
  excludedTestOrdersCount?: number;
  onNavigate?: (page: string) => void;
}

export default function AiAssistant({
  workspaceId,
  team,
  orders,
  closeuses,
  livreurs,
  codInsights = [],
  excludedTestOrdersCount = 0,
}: AiAssistantProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [showArtifactsPanel, setShowArtifactsPanel] = useState(true);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearingBusy, setClearingBusy] = useState(false);
  const [cashEntries, setCashEntries] = useState<CashSettlementEntry[]>([]);
  const [watchdogScanning, setWatchdogScanning] = useState(false);
  const [watchdogFeedback, setWatchdogFeedback] = useState<string | null>(null);

  const { totals: closeuseRemunTotals } = useRemunerationTotals(workspaceId, "closeuse");
  const { totals: livreurRemunTotals } = useRemunerationTotals(workspaceId, "livreur");

  useEffect(() => {
    if (!workspaceId) return;
    const db = getDb();
    const baseRef = collection(db, `workspaces/${workspaceId}/cashSettlements`);
    const q = team?.id ? query(baseRef, where("teamId", "==", team.id)) : query(baseRef);
    const unsub = onSnapshot(q, (snap) => {
      const list: CashSettlementEntry[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CashSettlementEntry, "id">),
      }));
      setCashEntries(list);
    });
    return () => unsub();
  }, [workspaceId, team?.id]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const activeCountryInsight = useMemo(() => {
    if (!codInsights.length) return null;
    const target = (team?.defaultCountry || "").toUpperCase();
    return (
      codInsights.find((c) => c.countryCode.toUpperCase() === target) ||
      [...codInsights].sort((a, b) => (b.totalProcessed || 0) - (a.totalProcessed || 0))[0] ||
      null
    );
  }, [codInsights, team?.defaultCountry]);

  const context: BusinessMetricsContext = useMemo(() => {
    const now = Date.now();
    const closeuseMap = new Map(closeuses.map((c) => [c.id, c.name]));
    const livreurMap = new Map(livreurs.map((l) => [l.id, l.name]));
    const remunCloseuseRate = team?.remunerationCloseusePerOrder ?? 0;
    const remunLivreurRate = team?.remunerationLivreurPerOrder ?? 0;

    const isDeliveredOrder = (o: Order) => o.statutLivreur === "livre" || o.statutCloseuse === "livre";
    const isConfirmedOrder = (o: Order) =>
      o.statutCloseuse === "en_cours" || o.statutCloseuse === "programme" || isDeliveredOrder(o);

    const totalOrders = orders.length;
    const confirmedOrders = orders.filter(isConfirmedOrder).length;
    const deliveredOrders = orders.filter(isDeliveredOrder).length;
    const injoignableOrders = orders.filter(
      (o) => o.statutCloseuse === "injoignable" || o.statutLivreur === "injoignable"
    ).length;
    const rejectedOrders = orders.filter((o) => o.statutCloseuse === "rejete").length;
    const revenue = orders
      .filter(isDeliveredOrder)
      .reduce((acc, o) => acc + (o.amount || 0), 0);

    const confirmationRate = totalOrders > 0 ? Math.round((confirmedOrders / totalOrders) * 100) : 0;
    const deliveryRate =
      confirmedOrders > 0 ? Math.min(100, Math.round((deliveredOrders / confirmedOrders) * 100)) : 0;

    const topCloseuses = closeuses
      .map((c) => {
        const cOrders = orders.filter((o) => o.closeuseId === c.id);
        const conf = cOrders.filter(isConfirmedOrder).length;
        const deliv = cOrders.filter(isDeliveredOrder).length;
        const resteAPayer =
          closeuseRemunTotals[c.id]?.resteAPayer ?? deliv * remunCloseuseRate;
        return {
          name: c.name,
          confirmed: conf,
          total: cOrders.length,
          rate: cOrders.length > 0 ? Math.round((conf / cOrders.length) * 100) : 0,
          resteAPayer,
        };
      })
      .sort((a, b) => b.confirmed - a.confirmed);

    const livreurCashSummaries: LivreurCashAiSummary[] = livreurs.map((l) => {
      const lOrders = orders.filter((o) => o.livreurId === l.id);
      const delivOrders = lOrders.filter(
        (o) => o.statutLivreur === "livre" || o.statutCloseuse === "livre"
      );
      const expectedCash = delivOrders.reduce((s, o) => s + (o.amount || 0), 0);
      const myEntries = cashEntries.filter((e) => e.livreurId === l.id);
      const remittedCash = myEntries
        .filter((e) => e.type === "remittance")
        .reduce((s, e) => s + (e.amount || 0), 0);
      const deductionsCaisse = myEntries
        .filter((e) => e.type === "deduction" && e.impact === "caisse")
        .reduce((s, e) => s + (e.amount || 0), 0);
      const deductionsRemun = myEntries
        .filter((e) => e.type === "deduction" && e.impact === "remuneration")
        .reduce((s, e) => s + (e.amount || 0), 0);
      const unsettledCash = Math.max(0, expectedCash - deductionsCaisse - remittedCash);
      const notes = myEntries
        .filter((e) => e.note)
        .map(
          (e) =>
            `${e.type === "remittance" ? "Versement" : e.impact === "caisse" ? "Retranché caisse" : "Retenue prime"} ${e.amount.toLocaleString("fr-FR")} F : ${e.note}`
        );
      const baseRemun =
        livreurRemunTotals[l.id]?.resteAPayer ?? delivOrders.length * remunLivreurRate;
      const remunResteAPayer = Math.max(0, baseRemun - deductionsRemun);

      return {
        name: l.name,
        deliveredCount: delivOrders.length,
        expectedCash,
        remittedCash,
        deductionsCaisse,
        deductionsRemun,
        unsettledCash,
        notes,
        remunResteAPayer,
      };
    });

    const topLivreurs = livreurs
      .map((l) => {
        const lOrders = orders.filter((o) => o.livreurId === l.id);
        const del = lOrders.filter((o) => o.statutLivreur === "livre" || o.statutCloseuse === "livre").length;
        const cashSum = livreurCashSummaries.find((s) => s.name === l.name);
        return {
          name: l.name,
          delivered: del,
          total: lOrders.length,
          rate: lOrders.length > 0 ? Math.round((del / lOrders.length) * 100) : 0,
          resteAPayer: cashSum?.remunResteAPayer ?? 0,
        };
      })
      .sort((a, b) => b.delivered - a.delivered);

    const totalUnsettledCash = livreurCashSummaries.reduce((s, l) => s + l.unsettledCash, 0);
    const totalRemunResteAPayer =
      topCloseuses.reduce((s, c) => s + (c.resteAPayer || 0), 0) +
      topLivreurs.reduce((s, l) => s + (l.resteAPayer || 0), 0);

    // Logistics & SLA Alerts
    const staleNewOrders = orders
      .filter((o) => {
        const rec = o.timestamps?.received ?? 0;
        return o.statutCloseuse === "nouveau" && rec > 0 && now - rec >= 15 * 60 * 1000;
      })
      .map((o) => ({
        orderNumber: o.orderNumber ? `#${o.orderNumber}` : `#${o.id.slice(-5)}`,
        clientName: o.clientName,
        phone: o.clientPhoneFormatted,
        product: o.product,
        city: o.city || "Non précisée",
        closeuseName: (o.closeuseId && closeuseMap.get(o.closeuseId)) || "Non assignée",
        minutesWaiting: Math.round((now - (o.timestamps?.received ?? now)) / 60000),
      }))
      .sort((a, b) => b.minutesWaiting - a.minutesWaiting);

    const overdueReminders = orders
      .filter((o) => o.statutCloseuse === "programme" && o.reminderAt && o.reminderAt <= now)
      .map((o) => ({
        orderNumber: o.orderNumber ? `#${o.orderNumber}` : `#${o.id.slice(-5)}`,
        clientName: o.clientName,
        phone: o.clientPhoneFormatted,
        product: o.product,
        closeuseName: (o.closeuseId && closeuseMap.get(o.closeuseId)) || "Non assignée",
        minutesOverdue: Math.max(1, Math.round((now - (o.reminderAt ?? now)) / 60000)),
      }))
      .sort((a, b) => b.minutesOverdue - a.minutesOverdue);

    const unassignedConfirmed = orders
      .filter((o) => o.statutCloseuse === "en_cours" && !o.livreurId)
      .map((o) => {
        const refTs = o.timestamps?.closeuseDecidedAt ?? o.timestamps?.received ?? now;
        return {
          orderNumber: o.orderNumber ? `#${o.orderNumber}` : `#${o.id.slice(-5)}`,
          clientName: o.clientName,
          phone: o.clientPhoneFormatted,
          product: o.product,
          city: o.city || "Non précisée",
          closeuseName: (o.closeuseId && closeuseMap.get(o.closeuseId)) || "Non assignée",
          minutesSinceConfirmed: Math.max(1, Math.round((now - refTs) / 60000)),
        };
      })
      .sort((a, b) => b.minutesSinceConfirmed - a.minutesSinceConfirmed);

    const stuckInDelivery = orders
      .filter(
        (o) =>
          (o.statutLivreur === "recu" || o.statutLivreur === "en_route") &&
          o.statutCloseuse !== "livre" &&
          o.statutCloseuse !== "rejete"
      )
      .map((o) => {
        const refTs =
          o.timestamps?.livreurRespondedAt ??
          o.timestamps?.assignedToLivreur ??
          o.timestamps?.closeuseDecidedAt ??
          o.timestamps?.received ??
          now;
        return {
          orderNumber: o.orderNumber ? `#${o.orderNumber}` : `#${o.id.slice(-5)}`,
          clientName: o.clientName,
          phone: o.clientPhoneFormatted,
          product: o.product,
          city: o.city || "Non précisée",
          livreurName: (o.livreurId && livreurMap.get(o.livreurId)) || "Non assigné",
          status: o.statutLivreur === "en_route" ? "En route" : "Reçu (attente départ)",
          hoursInTransit: Math.max(0.5, Math.round(((now - refTs) / 3600000) * 10) / 10),
          amount: o.amount || 0,
        };
      })
      .sort((a, b) => b.hoursInTransit - a.hoursInTransit);

    const duplicateOrders = orders
      .filter((o) => o.isDuplicatePhone)
      .map((o) => ({
        orderNumber: o.orderNumber ? `#${o.orderNumber}` : `#${o.id.slice(-5)}`,
        clientName: o.clientName,
        phone: o.clientPhoneFormatted,
        product: o.product,
        status: `${o.statutCloseuse}${o.statutLivreur ? ` / ${o.statutLivreur}` : ""}`,
        previousOrdersCount: o.previousOrdersCount ?? 1,
        amount: o.amount || 0,
      }));

    const cityMap: Record<
      string,
      { total: number; delivered: number; inTransit: number; rejected: number; revenue: number }
    > = {};
    const rejectionMap: Record<string, number> = {};

    orders.forEach((o) => {
      const city = (o.city || "Ville non renseignée").trim();
      if (!cityMap[city]) {
        cityMap[city] = { total: 0, delivered: 0, inTransit: 0, rejected: 0, revenue: 0 };
      }
      cityMap[city].total += 1;
      if (o.statutLivreur === "livre" || o.statutCloseuse === "livre") {
        cityMap[city].delivered += 1;
        cityMap[city].revenue += o.amount || 0;
      } else if (o.statutLivreur === "en_route" || o.statutLivreur === "recu" || o.statutCloseuse === "en_cours") {
        cityMap[city].inTransit += 1;
      } else if (o.statutCloseuse === "rejete" || o.statutCloseuse === "injoignable" || o.statutLivreur === "injoignable") {
        cityMap[city].rejected += 1;
      }

      if (o.statutCloseuse === "rejete") {
        const reason = o.rejectionReason || "Rejeté sans motif précisé";
        rejectionMap[reason] = (rejectionMap[reason] || 0) + 1;
      }
    });

    const cityBreakdown = Object.entries(cityMap)
      .map(([city, d]) => ({ city, ...d }))
      .sort((a, b) => b.total - a.total);

    const rejectionReasons = Object.entries(rejectionMap)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    const recentActiveOrders = [...orders]
      .sort((a, b) => (b.timestamps?.received ?? 0) - (a.timestamps?.received ?? 0))
      .slice(0, 30)
      .map((o) => ({
        orderNumber: o.orderNumber ? `#${o.orderNumber}` : `#${o.id.slice(-5)}`,
        clientName: o.clientName,
        phone: o.clientPhoneFormatted,
        city: o.city || "Non précisée",
        product: o.product,
        quantity: o.quantity || 1,
        amount: o.amount || 0,
        statutCloseuse: o.statutCloseuse,
        statutLivreur: o.statutLivreur || "non_assigne",
        closeuseName: (o.closeuseId && closeuseMap.get(o.closeuseId)) || "Non assignée",
        livreurName: (o.livreurId && livreurMap.get(o.livreurId)) || "Non assigné",
        isDuplicate: !!o.isDuplicatePhone,
      }));

    const logisticsAlerts: LogisticsAlertsContext = {
      staleNewOrders,
      overdueReminders,
      unassignedConfirmed,
      stuckInDelivery,
      duplicateOrders,
      cityBreakdown,
      rejectionReasons,
      recentActiveOrders,
    };

    const productMap: Record<string, { count: number; revenue: number }> = {};
    orders.forEach((o) => {
      const p = o.product || "Produit standard";
      if (!productMap[p]) productMap[p] = { count: 0, revenue: 0 };
      productMap[p].count += 1;
      if (o.statutLivreur === "livre" || o.statutCloseuse === "livre") {
        productMap[p].revenue += o.amount || 0;
      }
    });

    const topProducts = Object.entries(productMap)
      .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
      .sort((a, b) => b.count - a.count);

    const trendsMap: Record<
      string,
      { date: string; confirmed: number; delivered: number; rejected: number; revenue: number }
    > = {};
    orders.forEach((o) => {
      const ts = o.timestamps?.received;
      if (!ts) return;
      const d = new Date(ts);
      const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate()
      ).padStart(2, "0")}`;
      if (!trendsMap[dateKey]) {
        trendsMap[dateKey] = { date: dateKey, confirmed: 0, delivered: 0, rejected: 0, revenue: 0 };
      }
      if (isConfirmedOrder(o)) {
        trendsMap[dateKey].confirmed += 1;
      }
      if (isDeliveredOrder(o)) {
        trendsMap[dateKey].delivered += 1;
        trendsMap[dateKey].revenue += o.amount || 0;
      }
      if (o.statutCloseuse === "rejete" || o.statutLivreur === "injoignable" || o.statutCloseuse === "injoignable") {
        trendsMap[dateKey].rejected += 1;
      }
    });
    const dailyTrends = Object.values(trendsMap).sort((a, b) => a.date.localeCompare(b.date));

    const timestamps = orders
      .map((o) => o.timestamps?.received)
      .filter((t): t is number => typeof t === "number" && t > 0);
    const periodLabel =
      timestamps.length > 0
        ? `Du ${new Date(Math.min(...timestamps)).toLocaleDateString("fr-FR")} au ${new Date(
            Math.max(...timestamps)
          ).toLocaleDateString("fr-FR")}`
        : "Période active";

    return {
      teamName: team?.name || "Toutes les équipes",
      country: team?.defaultCountry || "Général",
      currency: team?.currency || "XOF",
      periodLabel,
      totalOrders,
      confirmedOrders,
      deliveredOrders,
      injoignableOrders,
      rejectedOrders,
      revenue,
      confirmationRate,
      deliveryRate,
      topCloseuses,
      topLivreurs,
      topProducts,
      dailyTrends,
      livreurCashSummaries,
      logisticsAlerts,
      totalUnsettledCash,
      totalRemunResteAPayer,
      codInsights,
      excludedTestOrdersCount,
    };
  }, [orders, closeuses, livreurs, team, cashEntries, closeuseRemunTotals, livreurRemunTotals, codInsights, excludedTestOrdersCount]);

  // Extract all chart artifacts generated across the conversation
  const chartArtifacts = useMemo(() => {
    const list: { id: string; spec: ChartSpec; timestamp: number }[] = [];
    for (const m of messages) {
      if (m.sender !== "assistant") continue;
      const parts = splitMessage(m.content);
      parts.forEach((p, idx) => {
        if (p.kind === "chart") {
          list.push({
            id: `${m.id}_${idx}`,
            spec: p.spec,
            timestamp: m.timestamp,
          });
        }
      });
    }
    return list.reverse();
  }, [messages]);

  useEffect(() => {
    if (!workspaceId) return;
    setHistoryLoaded(false);
    const db = getDb();
    const chatCol = collection(db, "workspaces", workspaceId, "aiAssistantChats");
    const q = query(chatCol, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AiChatMessage[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as AiChatMessage);
        });
        setMessages(list);
        setHistoryLoaded(true);
      },
      (err) => {
        setHistoryLoaded(true);
        const formatted = formatFirebaseError(err);
        setErrorMsg(formatted.message);
      }
    );
    return () => unsub();
  }, [workspaceId]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = dist < 120;
    setShowJump(dist > 240);
  };

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    if (stickRef.current) scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string, skipSavingUserMsg = false) => {
    const prompt = (textToSend ?? inputPrompt).trim();
    if (!prompt || loading) return;

    setInputPrompt("");
    setErrorMsg("");
    setLastFailedPrompt(null);
    setLoading(true);
    stickRef.current = true;

    try {
      const db = getDb();
      if (!skipSavingUserMsg) {
        const userMsgId = `msg_${Date.now()}`;
        const userMsg: AiChatMessage = {
          id: userMsgId,
          sender: "user",
          content: prompt,
          timestamp: Date.now(),
        };
        await setDoc(doc(db, "workspaces", workspaceId, "aiAssistantChats", userMsgId), userMsg);
      }

      const history = messages.slice(-6).map((m) => ({
        role: m.sender as "user" | "assistant",
        content: m.content,
      }));

      const systemPrompt = aiService.buildSystemPrompt(context);

      let reply = "";
      try {
        reply = await aiService.sendRaw([
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: prompt },
        ]);
      } catch (e) {
        const formatted = formatFirebaseError(e);
        setLastFailedPrompt(prompt);
        setErrorMsg(formatted.message);
        return;
      }

      if (!reply) {
        setLastFailedPrompt(prompt);
        setErrorMsg("L'analyse n'a pas pu être finalisée. Cliquez sur Réessayer.");
        return;
      }

      const botMsgId = `bot_${Date.now()}`;
      const botMsg: AiChatMessage = {
        id: botMsgId,
        sender: "assistant",
        content: reply,
        timestamp: Date.now(),
      };
      await setDoc(doc(db, "workspaces", workspaceId, "aiAssistantChats", botMsgId), botMsg);
    } catch (err) {
      const formatted = formatFirebaseError(err);
      setLastFailedPrompt(prompt);
      setErrorMsg(formatted.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    setClearingBusy(true);
    try {
      const db = getDb();
      for (const m of messages) {
        await deleteDoc(doc(db, "workspaces", workspaceId, "aiAssistantChats", m.id));
      }
      setConfirmClearOpen(false);
    } finally {
      setClearingBusy(false);
    }
  };

  const handleCopy = async (m: AiChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1500);
    } catch {
      setErrorMsg("Copie impossible sur ce navigateur.");
    }
  };

  const runAiLogisticsWatchdog = async () => {
    if (!workspaceId || watchdogScanning) return;
    setWatchdogScanning(true);
    try {
      const db = getDb();
      const notifCol = collection(db, "workspaces", workspaceId, "notifications");
      const recentSnap = await getDocs(
        query(notifCol, orderBy("createdAt", "desc"), limit(25))
      );
      const cutoffDedupe = Date.now() - 60 * 60 * 1000;
      const recentTitles = new Set<string>();
      recentSnap.forEach((d) => {
        const data = d.data();
        if ((data.createdAt ?? 0) >= cutoffDedupe && typeof data.title === "string") {
          recentTitles.add(data.title);
        }
      });

      const alerts = context.logisticsAlerts;
      const toSend: { title: string; body: string }[] = [];
      const aiEditorLines: string[] = [];

      // 1. Caisse livreurs non versée
      const unsettledLivreurs = (context.livreurCashSummaries || []).filter((l) => l.unsettledCash > 0);
      if (unsettledLivreurs.length > 0) {
        const title = `Rappel IA · Caisse Livreur à récupérer`;
        const names = unsettledLivreurs
          .map((l) => `**${l.name}** (${l.unsettledCash.toLocaleString("fr-FR")} ${context.currency})`)
          .join(", ");
        const body = `${unsettledLivreurs.length} livreur(s) n'ont pas encore soldé leur caisse : ${unsettledLivreurs.map((l) => `${l.name} (${l.unsettledCash.toLocaleString("fr-FR")} ${context.currency})`).join(", ")}.`;
        if (!recentTitles.has(title)) {
          toSend.push({ title, body });
          aiEditorLines.push(
            `- **Caisse & Versements Livreurs** : ${unsettledLivreurs.length} livreur(s) n'ont pas encore versé leur encaissement du jour : ${names}. Pensez à pointer leur versement (ou retrancher leurs imprévus avec note justificative) avant de valider leur paie.`
          );
        }
      }

      // 2. Commandes Nouveau dépassant le délai (> 15 min)
      if (alerts && alerts.staleNewOrders.length > 0) {
        const title = `Rappel IA · ${alerts.staleNewOrders.length} commande(s) hors délai d'appel`;
        const sample = alerts.staleNewOrders
          .slice(0, 4)
          .map((o) => `${o.orderNumber} (${o.clientName}, ${o.minutesWaiting} min — ${o.closeuseName})`)
          .join(", ");
        const body = `Délai > 15 min dépassé sans action closeuse : ${sample}.`;
        if (!recentTitles.has(title)) {
          toSend.push({ title, body });
          aiEditorLines.push(
            `- **Délai d'appel dépassé (> 15 min)** : **${alerts.staleNewOrders.length}** commande(s) en statut *Nouveau* n'ont pas encore été traitées (${sample}).`
          );
        }
      }

      // 3. Rappels programmés oubliés
      if (alerts && alerts.overdueReminders.length > 0) {
        const title = `Rappel IA · ${alerts.overdueReminders.length} rappel(s) programmé(s) en retard`;
        const sample = alerts.overdueReminders
          .slice(0, 4)
          .map((o) => `${o.orderNumber} ${o.clientName} (${o.closeuseName}, +${o.minutesOverdue} min)`)
          .join(", ");
        const body = `Heure de rappel dépassée pour : ${sample}.`;
        if (!recentTitles.has(title)) {
          toSend.push({ title, body });
          aiEditorLines.push(
            `- **Rappels programmés oubliés** : **${alerts.overdueReminders.length}** client(s) attendent leur rappel téléphonique (${sample}).`
          );
        }
      }

      // 4. Commandes confirmées sans livreur assigné
      if (alerts && alerts.unassignedConfirmed.length > 0) {
        const title = `Rappel IA · ${alerts.unassignedConfirmed.length} colis confirmé(s) sans livreur`;
        const sample = alerts.unassignedConfirmed
          .slice(0, 4)
          .map((o) => `${o.orderNumber} (${o.clientName} — ${o.city})`)
          .join(", ");
        const body = `Confirmées mais aucun livreur assigné : ${sample}.`;
        if (!recentTitles.has(title)) {
          toSend.push({ title, body });
          aiEditorLines.push(
            `- **Colis confirmés sans livreur** : **${alerts.unassignedConfirmed.length}** commande(s) confirmée(s) n'ont pas encore de livreur attribué (${sample}).`
          );
        }
      }

      // 5. Colis sur le terrain depuis > 3h
      const longStuck = (alerts?.stuckInDelivery || []).filter((o) => o.hoursInTransit >= 3);
      if (longStuck.length > 0) {
        const title = `Rappel IA · ${longStuck.length} colis sur le terrain > 3h`;
        const sample = longStuck
          .slice(0, 4)
          .map((o) => `${o.orderNumber} (${o.livreurName}, ${o.hoursInTransit}h)`)
          .join(", ");
        const body = `Livraisons non clôturées sur le terrain : ${sample}.`;
        if (!recentTitles.has(title)) {
          toSend.push({ title, body });
          aiEditorLines.push(
            `- **Colis en attente sur le terrain (> 3h)** : **${longStuck.length}** livraison(s) non clôturée(s) (${sample}).`
          );
        }
      }

      // 6. Numéros doublons à vérifier (1 ou 2 produits)
      const pendingDuplicates = (alerts?.duplicateOrders || []).filter((o) =>
        o.status.startsWith("nouveau")
      );
      if (pendingDuplicates.length > 0) {
        const title = `Rappel IA · ${pendingDuplicates.length} numéro(s) doublon(s) à vérifier`;
        const sample = pendingDuplicates
          .slice(0, 3)
          .map((o) => `${o.orderNumber} (${o.clientName} · ${o.phone})`)
          .join(", ");
        const body = `Isolé(s) en Accès libre site (hors Meta CAPI). Vérifier à l'appel si 1 ou 2 produits : ${sample}.`;
        if (!recentTitles.has(title)) {
          toSend.push({ title, body });
          aiEditorLines.push(
            `- **Numéros doublons (Accès libre site)** : **${pendingDuplicates.length}** commande(s) isolée(s) de Meta CAPI à vérifier avec le client pour confirmer s'il souhaite **1 ou 2 produits** (${sample}).`
          );
        }
      }

      if (toSend.length > 0) {
        for (const n of toSend) {
          await addDoc(notifCol, {
            title: n.title,
            body: n.body,
            read: false,
            createdAt: Date.now(),
          });
        }

        // L'IA écrit toute seule directement dans son éditeur de conversation
        const autoMsgId = `bot_auto_${Date.now()}`;
        const autoContent = [
          `### Rappel Automatique — Vigie Logistique (${context.teamName})`,
          `Voici les opérations en attente ou qui dépassent actuellement leurs délais :`,
          ...aiEditorLines,
          `Vous pouvez me poser n'importe quelle question sur ces commandes, la caisse des livreurs ou la logistique terrain.`,
        ].join("\n\n");

        await setDoc(doc(db, "workspaces", workspaceId, "aiAssistantChats", autoMsgId), {
          id: autoMsgId,
          sender: "assistant",
          content: autoContent,
          timestamp: Date.now(),
        });
      }
    } catch {
      // Silencieux en arrière-plan
    } finally {
      setWatchdogScanning(false);
    }
  };

  useEffect(() => {
    if (!workspaceId || !historyLoaded || orders.length === 0) return;
    const timer = window.setTimeout(() => {
      void runAiLogisticsWatchdog();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [workspaceId, team?.id, historyLoaded, orders.length]);

  const buildBilanReport = async (): Promise<BilanReport> => {
    const lastAssistant = [...messages].reverse().find((m) => m.sender === "assistant");
    const analysisMarkdown = lastAssistant ? lastAssistant.content : "Bilan récapitulatif des performances.";

    const kpis = makeKpis({
      ca: context.revenue,
      recues: context.totalOrders,
      confirmees: context.confirmedOrders,
      livrees: context.deliveredOrders,
      injoignables: context.injoignableOrders,
      rejetees: context.rejectedOrders,
      currency: context.currency,
    });

    const funnel = [
      { label: "Commandes reçues", value: context.totalOrders },
      { label: "Confirmées", value: context.confirmedOrders },
      { label: "Livrées et payées", value: context.deliveredOrders },
    ];

    const employees: BilanEmployee[] = [
      ...context.topCloseuses.map((c) => ({
        name: c.name,
        role: "closeuse" as const,
        done: c.confirmed,
        total: c.total,
      })),
      ...context.topLivreurs.map((l) => ({
        name: l.name,
        role: "livreur" as const,
        done: l.delivered,
        total: l.total,
      })),
    ];

    const products: BilanProduct[] = context.topProducts.map((p) => ({
      name: p.name,
      sales: p.count,
    }));

    const days: BilanDay[] = (context.dailyTrends || []).map((d) => ({
      date: d.date,
      ca: d.revenue,
      livraisons: d.delivered,
      rejetees: d.rejected,
      injoignables: 0,
    }));

    return {
      title: `Bilan Opérationnel & Stratégique - ${context.teamName}`,
      team: context.teamName,
      periodLabel: context.periodLabel,
      generatedAt: new Date().toISOString(),
      currency: context.currency,
      kpis,
      funnel,
      employees,
      products,
      days,
      analysisMarkdown,
    };
  };

  const isEmpty = messages.length === 0;
  const canSend = inputPrompt.trim().length > 0 && !loading;

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
        {/* Left / Main Chat Column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Workspace Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border bg-surface/40 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/15 text-brand">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-100">
                    Analyste Direction — {context.teamName}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Temps réel
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {context.totalOrders} cmd · {context.confirmedOrders} confirmées ({context.confirmationRate}%) ·{" "}
                  {context.deliveredOrders} livrées ({context.deliveryRate}%)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ExportMenu getReport={buildBilanReport} />
              {!isEmpty && (
                <button
                  type="button"
                  onClick={() => setConfirmClearOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Réinitialiser</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowArtifactsPanel((v) => !v)}
                className={`hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition lg:inline-flex ${
                  showArtifactsPanel
                    ? "border-brand/40 bg-brand/15 text-brand"
                    : "border-surface-border bg-surface text-slate-400 hover:text-slate-200"
                }`}
                title="Afficher / masquer le panneau d'artefacts et courbes"
              >
                {showArtifactsPanel ? (
                  <PanelRightClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelRightOpen className="h-3.5 w-3.5" />
                )}
                <span>Artefacts ({chartArtifacts.length})</span>
              </button>
            </div>
          </div>

          {/* Conversation Scroll Area */}
          <div className="relative min-h-0 flex-1">
            <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain">
              <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
                {!historyLoaded ? (
                  <div className="my-auto py-10 text-center text-xs text-slate-500">
                    Chargement du dossier d'analyse…
                  </div>
                ) : isEmpty && !loading ? (
                  <div className="my-auto py-4">
                    <div className="mb-6 text-center">
                      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-100">
                        Diagnostic Opérationnel — {team?.name || "Direction"}
                      </h3>
                      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400">
                        Interrogez vos indicateurs de closing, livraison et encaissement Cash-On-Delivery ou générez un bilan exécutif complet.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {SUGGESTIONS.map((s) => {
                        const Icon = s.icon;
                        return (
                          <button
                            key={s.title}
                            type="button"
                            onClick={() => handleSendMessage(s.prompt)}
                            className="group flex items-start gap-3 rounded-xl border border-surface-border bg-surface/50 p-3.5 text-left transition hover:border-brand/50 hover:bg-surface"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised text-brand group-hover:border-brand/40">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="block text-xs font-semibold text-slate-100">{s.title}</span>
                              <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-400">
                                {s.desc}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((m) => {
                      const isUser = m.sender === "user";
                      return isUser ? (
                        <div key={m.id} className="flex flex-col items-end">
                          <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-xs leading-relaxed text-white shadow-sm sm:text-sm">
                            {m.content}
                          </div>
                          <span className="mt-1 text-[10px] text-slate-500">{formatTime(m.timestamp)}</span>
                        </div>
                      ) : (
                        <div key={m.id} className="flex gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/15 text-brand">
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1 text-xs leading-6 text-slate-200 sm:text-sm">
                            {splitMessage(m.content).map((part, pIdx) => {
                              if (part.kind === "text") {
                                return <Markdown key={pIdx} content={part.text} />;
                              }
                              return (
                                <div
                                  key={pIdx}
                                  className="my-3 overflow-hidden rounded-xl border border-surface-border bg-surface p-3.5"
                                >
                                  <ProChart
                                    spec={part.spec}
                                    load={(p) => fetchDailyStats(getDb(), workspaceId, team?.id || "", p)}
                                  />
                                </div>
                              );
                            })}
                            <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                              <span>{formatTime(m.timestamp)}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(m)}
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:text-slate-200"
                              >
                                {copiedId === m.id ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                                <span>{copiedId === m.id ? "Copié" : "Copier"}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {loading && (
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand-light text-brand">
                          <Sparkles className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-xs text-slate-400">Calcul et consolidation du bilan en cours…</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {showJump && (
              <button
                type="button"
                onClick={() => {
                  stickRef.current = true;
                  scrollToBottom();
                }}
                className="absolute bottom-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-surface-border bg-surface-raised text-slate-300 shadow-lg hover:text-white"
                aria-label="Aller au dernier message"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Bottom Composer fixe avec AutoResizeTextarea */}
          <div className="shrink-0 border-t border-surface-border bg-surface px-4 py-3">
            <div className="mx-auto w-full max-w-3xl">
              {!isEmpty && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.title}
                        type="button"
                        onClick={() => handleSendMessage(s.prompt)}
                        disabled={loading}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-brand/40 hover:text-slate-100 disabled:opacity-40"
                      >
                        <Icon className="h-3 w-3 text-brand" />
                        <span>{s.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{errorMsg}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {lastFailedPrompt && (
                      <button
                        type="button"
                        onClick={() => handleSendMessage(lastFailedPrompt, true)}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-2.5 py-1 font-semibold text-rose-200 hover:bg-rose-500/30"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Réessayer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setErrorMsg("")}
                      className="text-rose-300/70 hover:text-rose-200"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-end gap-2 rounded-xl border border-surface-border bg-surface-raised px-3 py-1.5 focus-within:border-brand"
              >
                <div className="min-w-0 flex-1">
                  <AutoResizeTextarea
                    rows={1}
                    value={inputPrompt}
                    onChange={setInputPrompt}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Demandez un bilan pays, une formation équipe ou des prévisions COD…"
                    className="!max-h-36 !min-h-[38px] !border-0 !bg-transparent !px-1 !py-1.5 !text-xs sm:!text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Envoyer"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition hover:bg-brand-hover disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Side Panel: Live Metrics & COD Country Insights */}
        {showArtifactsPanel && (
          <aside className="hidden w-80 shrink-0 flex-col border-l border-surface-border bg-surface/40 lg:flex xl:w-96">
            <div className="flex shrink-0 items-center justify-between border-b border-surface-border px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Layers className="h-3.5 w-3.5 text-brand" />
                <span>Indicateurs &amp; Data COD</span>
              </div>
              <span className="rounded bg-surface px-2 py-0.5 font-mono text-[10px] text-slate-400">
                {context.currency}
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3.5">
              {/* Live Executive Summary Card */}
              <div className="rounded-xl border border-surface-border bg-surface-raised p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Synthèse en direct
                  </span>
                  <span className="text-[11px] font-medium text-brand">{context.teamName}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-surface-border bg-surface/60 p-2">
                    <p className="text-[10px] text-slate-400">CA Encaissé</p>
                    <p className="mt-0.5 text-xs font-bold tabular-nums text-slate-100">
                      {context.revenue.toLocaleString("fr-FR")} {context.currency}
                    </p>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface/60 p-2">
                    <p className="text-[10px] text-slate-400">Livraisons</p>
                    <p className="mt-0.5 text-xs font-bold tabular-nums text-emerald-400">
                      {context.deliveredOrders} ({context.deliveryRate}%)
                    </p>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface/60 p-2">
                    <p className="text-[10px] text-slate-400">Closing</p>
                    <p className="mt-0.5 text-xs font-bold tabular-nums text-sky-400">
                      {context.confirmedOrders}/{context.totalOrders} ({context.confirmationRate}%)
                    </p>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface/60 p-2">
                    <p className="text-[10px] text-slate-400">Échecs / Rejets</p>
                    <p className="mt-0.5 text-xs font-bold tabular-nums text-rose-400">
                      {context.rejectedOrders + context.injoignableOrders}
                    </p>
                  </div>
                </div>
              </div>

              {activeCountryInsight && activeCountryInsight.totalProcessed > 0 && (
                <div className="rounded-xl border border-surface-border bg-surface-raised p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Base COD — {activeCountryInsight.countryCode}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-emerald-400">
                      {Math.round(
                        (activeCountryInsight.deliveredCount / Math.max(1, activeCountryInsight.totalProcessed)) * 100
                      )}
                      % succès
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] tabular-nums">
                    <div className="rounded-lg border border-surface-border bg-surface/50 px-2.5 py-1.5">
                      <span className="block text-[10px] text-slate-400">Refroidissement &lt;6h</span>
                      <span className="font-semibold text-slate-100">
                        {activeCountryInsight.coolingBuckets?.under6h?.total
                          ? `${Math.round(
                              (activeCountryInsight.coolingBuckets.under6h.delivered /
                                activeCountryInsight.coolingBuckets.under6h.total) *
                                100
                            )}%`
                          : "—"}
                      </span>
                    </div>
                    <div className="rounded-lg border border-surface-border bg-surface/50 px-2.5 py-1.5">
                      <span className="block text-[10px] text-slate-400">Retours terrain</span>
                      <span className="font-semibold text-slate-100">
                        {activeCountryInsight.recentFieldNotes?.length ?? 0} notes
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Generated Charts Deck */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Graphiques générés ({chartArtifacts.length})
                </p>
                {chartArtifacts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-surface-border bg-surface/30 p-5 text-center">
                    <BarChart3 className="mx-auto mb-2 h-5 w-5 text-slate-500" />
                    <p className="text-xs text-slate-400">
                      Demandez un bilan ou une courbe pour épingler automatiquement les graphiques ici.
                    </p>
                  </div>
                ) : (
                  chartArtifacts.map((item) => (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-xl border border-surface-border bg-surface-raised p-3"
                    >
                      <ProChart
                        spec={item.spec}
                        load={(p) => fetchDailyStats(getDb(), workspaceId, team?.id || "", p)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={confirmClearOpen}
        title="Réinitialiser la session d'analyse"
        message="Voulez-vous vraiment effacer l'historique de cette conversation avec l'Analyste Direction ?"
        confirmLabel="Effacer l'historique"
        danger
        loading={clearingBusy}
        onConfirm={handleClearHistory}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  );
}
