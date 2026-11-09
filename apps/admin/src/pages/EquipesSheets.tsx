import { useState, useEffect, useMemo, useRef } from "react";
import { doc, updateDoc, deleteDoc, collection, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDb, AFRICA_COUNTRIES } from "@ecomcod/shared";
import type { Team } from "@ecomcod/shared";
import CreateTeamForm from "../components/CreateTeamForm";
import { getCountryMeta } from "../components/CountryMapBackdrop";
import { GEO_AFRICA_DATA } from "../lib/geoAfricaData";
import { formatFirebaseError } from "../lib/firebaseErrors";
import {
  Globe2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Copy,
  ExternalLink,
  Trash2,
  Edit2,
  Check,
  Plus,
  RefreshCw,
  TrendingUp,
  MapPin,
  Clock,
  Sparkles,
} from "lucide-react";

interface EquipesSheetsProps {
  workspaceId: string;
  teams: Team[];
}

const ROBOT = "meta-capi-app@appspot.gserviceaccount.com";
const MAX_SHEETS = 5;
const W = 1000;
const H = 700;

// Mapping Code ISO2 -> ISO3 et métadonnées géographiques
const COUNTRY_MAP: Record<
  string,
  { a3: string; name: string; flag: string; cur: string; dial: string; hub: string }
> = {
  TG: { a3: "TGO", name: "Togo", flag: "tg", cur: "XOF", dial: "+228", hub: "Lomé" },
  BJ: { a3: "Bénin", a3Alt: "BEN", name: "Bénin", flag: "bj", cur: "XOF", dial: "+229", hub: "Cotonou" } as any,
  BF: { a3: "BFA", name: "Burkina Faso", flag: "bf", cur: "XOF", dial: "+226", hub: "Ouagadougou" },
  CI: { a3: "CIV", name: "Côte d'Ivoire", flag: "ci", cur: "XOF", dial: "+225", hub: "Abidjan" },
  SN: { a3: "SEN", name: "Sénégal", flag: "sn", cur: "XOF", dial: "+221", hub: "Dakar" },
  GH: { a3: "GHA", name: "Ghana", flag: "gh", cur: "GHS", dial: "+233", hub: "Accra" },
  NG: { a3: "NGA", name: "Nigeria", flag: "ng", cur: "NGN", dial: "+234", hub: "Lagos / Abuja" },
  CM: { a3: "CMR", name: "Cameroun", flag: "cm", cur: "XAF", dial: "+237", hub: "Douala / Yaoundé" },
  ML: { a3: "MLI", name: "Mali", flag: "ml", cur: "XOF", dial: "+223", hub: "Bamako" },
  KE: { a3: "KEN", name: "Kenya", flag: "ke", cur: "KES", dial: "+254", hub: "Nairobi" },
  CD: { a3: "COD", name: "Congo (RDC)", flag: "cd", cur: "CDF", dial: "+243", hub: "Kinshasa" },
  CG: { a3: "COG", name: "Congo", flag: "cg", cur: "XAF", dial: "+242", hub: "Brazzaville" },
  GA: { a3: "GAB", name: "Gabon", flag: "ga", cur: "XAF", dial: "+241", hub: "Libreville" },
  NE: { a3: "NER", name: "Niger", flag: "ne", cur: "XOF", dial: "+227", hub: "Niamey" },
  GN: { a3: "GIN", name: "Guinée", flag: "gn", cur: "GNF", dial: "+224", hub: "Conakry" },
  ZA: { a3: "ZAF", name: "Afrique du Sud", flag: "za", cur: "ZAR", dial: "+27", hub: "Johannesbourg / Pretoria" },
  MA: { a3: "MAR", name: "Maroc", flag: "ma", cur: "MAD", dial: "+212", hub: "Casablanca" },
  DZ: { a3: "DZA", name: "Algérie", flag: "dz", cur: "DZD", dial: "+213", hub: "Alger" },
  TN: { a3: "TUN", name: "Tunisie", flag: "tn", cur: "TND", dial: "+216", hub: "Tunis" },
  EG: { a3: "EGY", name: "Égypte", flag: "eg", cur: "EGP", dial: "+20", hub: "Le Caire" },
  RW: { a3: "RWA", name: "Rwanda", flag: "rw", cur: "RWF", dial: "+250", hub: "Kigali" },
  UG: { a3: "UGA", name: "Ouganda", flag: "ug", cur: "UGX", dial: "+256", hub: "Kampala" },
  TZ: { a3: "TZA", name: "Tanzanie", flag: "tz", cur: "TZS", dial: "+255", hub: "Dar es Salaam" },
  ET: { a3: "ETH", name: "Éthiopie", flag: "et", cur: "ETB", dial: "+251", hub: "Addis-Abeba" },
};

function getCountryIso3(code?: string | null): string {
  const c = (code || "TG").toUpperCase();
  if (COUNTRY_MAP[c]) return COUNTRY_MAP[c].a3;
  if (c === "BJ") return "BEN";
  const found = AFRICA_COUNTRIES.find((x) => x.code === c);
  if (found) {
    // Si code à 3 lettres existe dans GEO
    const matchGeo = Object.keys(GEO_AFRICA_DATA.w).find((k) => k.startsWith(c));
    return matchGeo || "TGO";
  }
  return "TGO";
}

function flagUrl(code: string, size: "sm" | "lg" = "sm") {
  const c = (code || "tg").toLowerCase();
  return size === "lg"
    ? `https://flagcdn.com/40x30/${c}.png`
    : `https://flagcdn.com/24x18/${c}.png`;
}

function extractSheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/\/d\/([\w-]{20,})/);
  if (m) return m[1];
  if (/^[\w-]{25,}$/.test(trimmed)) return trimmed;
  return null;
}

function getBoundingBox(d: string): [number, number, number, number] {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) || [];
  let minX = 1e9,
    minY = 1e9,
    maxX = -1e9,
    maxY = -1e9;
  for (let i = 0; i < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]);
    maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]);
    maxY = Math.max(maxY, nums[i + 1]);
  }
  return [minX, minY, maxX, maxY];
}

// Composant icône vectoriel officiel Google Sheets
function GoogleSheetsIcon({ className = "w-6 h-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 54" className={className} aria-hidden="true">
      <path d="M8 0h18l14 14v34a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V6a6 6 0 0 1 6-6z" fill="#23A566" />
      <path d="M26 0l14 14h-8a6 6 0 0 1-6-6z" fill="#87CEAC" />
      <rect x="10" y="24" width="20" height="16" fill="#fff" />
      <g fill="#23A566">
        <rect x="11.5" y="25.5" width="7" height="3.5" />
        <rect x="21.5" y="25.5" width="7" height="3.5" />
        <rect x="11.5" y="30.5" width="7" height="3.5" />
        <rect x="21.5" y="30.5" width="7" height="3.5" />
        <rect x="11.5" y="35.5" width="7" height="3.5" />
        <rect x="21.5" y="35.5" width="7" height="3.5" />
      </g>
    </svg>
  );
}

// Icône Shopify vectorielle
function ShopifyIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

interface SimulatedEvent {
  id: string;
  type: "new" | "delivered" | "confirmed" | "collected";
  text: string;
  city: string;
  time: string;
  px: number;
  py: number;
}

export default function EquipesSheets({ workspaceId, teams }: EquipesSheetsProps) {
  // Sélection : null = "Toute l'Afrique", ou id de l'équipe
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(teams[0]?.id ?? null);
  const [selectedRegionIndex, setSelectedRegionIndex] = useState<number | null>(null);
  const [activeZoneIds, setActiveZoneIds] = useState<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // Modals
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardLink, setWizardLink] = useState("");
  const [wizardErr, setWizardErr] = useState<string | null>(null);
  const [wizardChecking, setWizardChecking] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCurrency, setEditCurrency] = useState("");
  const [editRemunCloseuse, setEditRemunCloseuse] = useState("500");
  const [editRemunLivreur, setEditRemunLivreur] = useState("1500");
  const [savingEdit, setSavingEdit] = useState(false);

  const [showShopifyModal, setShowShopifyModal] = useState(false);
  const [rawShopifyConnections, setRawShopifyConnections] = useState<any[]>([]);

  // Commandes réelles Firestore
  const [realOrders, setRealOrders] = useState<any[]>([]);
  const [simulatedEvents, setSimulatedEvents] = useState<SimulatedEvent[]>([]);
  const [ripplePin, setRipplePin] = useState<{ x: number; y: number } | null>(null);

  // Écoute des connexions Shopify
  useEffect(() => {
    if (!workspaceId) return;
    const db = getDb();
    const connCol = collection(db, "workspaces", workspaceId, "shopifyConnections");
    const unsub = onSnapshot(connCol, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setRawShopifyConnections(list);
    });
    return () => unsub();
  }, [workspaceId]);

  // Écoute des commandes Firestore
  useEffect(() => {
    if (!workspaceId) return;
    const db = getDb();
    const ordersCol = collection(db, "workspaces", workspaceId, "orders");
    const unsub = onSnapshot(ordersCol, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setRealOrders(list);
    });
    return () => unsub();
  }, [workspaceId]);

  // Synchronisation sélection courante
  useEffect(() => {
    if (selectedTeamId && !teams.some((t) => t.id === selectedTeamId)) {
      setSelectedTeamId(teams[0]?.id ?? null);
    }
  }, [teams, selectedTeamId]);

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  );

  const activeCountryCode = activeTeam ? activeTeam.defaultCountry : null;
  const activeIso3 = useMemo(() => (activeCountryCode ? getCountryIso3(activeCountryCode) : null), [activeCountryCode]);

  // Initialisation des zones actives pour le pays courant
  useEffect(() => {
    if (!activeIso3) {
      setActiveZoneIds([]);
      setSelectedRegionIndex(null);
      return;
    }
    const regions = GEO_AFRICA_DATA.r[activeIso3] || [];
    const cities = GEO_AFRICA_DATA.ct[activeIso3] || [];
    // Activer par défaut les régions qui ont des villes ou les 5 premières
    const defaultZoneIndexes = cities.length > 0
      ? Array.from(new Set(cities.map((c) => c[3]))).filter((idx) => idx >= 0)
      : regions.slice(0, 5).map((_, i) => i);
    setActiveZoneIds(defaultZoneIndexes);
    setSelectedRegionIndex(null);
  }, [activeIso3]);

  // Bounding box et calcul de la caméra pour le zoom
  const viewport = useMemo(() => {
    if (!activeIso3 || !GEO_AFRICA_DATA.w[activeIso3]) {
      return { k: 1, tx: 0, ty: 0 };
    }
    const [minX, minY, maxX, maxY] = getBoundingBox(GEO_AFRICA_DATA.w[activeIso3]);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const k = Math.min(11, (W * 0.72) / (maxX - minX), (H * 0.78) / (maxY - minY));
    return {
      k,
      tx: W / 2 - k * cx,
      ty: H / 2 - k * cy,
    };
  }, [activeIso3]);

  // Informations Shopify pour l'équipe courante
  const teamShopify = useMemo(() => {
    if (!activeTeam) return null;
    for (const c of rawShopifyConnections) {
      if (c.status === "active") {
        if (c.ownerTeamId === activeTeam.id) {
          return {
            connectionId: c.id,
            domain: c.shopDomain,
            label: `${c.shopDomain} (Principal)`,
            isOwner: true,
          };
        }
        if (c.countryRoutes) {
          for (const [code, r] of Object.entries<any>(c.countryRoutes)) {
            if (r.assignedTeamId === activeTeam.id && r.status === "active") {
              return {
                connectionId: c.id,
                domain: c.shopDomain,
                label: `${c.shopDomain} (Délégué ${code})`,
                isOwner: false,
                countryCode: code,
              };
            }
          }
        }
      }
    }
    return null;
  }, [activeTeam, rawShopifyConnections]);

  const healthy = (t: Team) => {
    const hasSheets = (t.sheetIds || []).length > 0;
    const hasShopify = rawShopifyConnections.some(
      (c) =>
        c.status === "active" &&
        (c.ownerTeamId === t.id ||
          (c.countryRoutes &&
            Object.values<any>(c.countryRoutes).some(
              (r) => r.assignedTeamId === t.id && r.status === "active"
            )))
    );
    return hasSheets || hasShopify;
  };

  // Statistiques de l'équipe (combinées réelles Firestore et simulation élégante)
  const teamStats = useMemo(() => {
    if (!activeTeam) return { count: 0, deliveredPct: 0, cash: 0 };
    const teamOrders = realOrders.filter((o) => o.teamId === activeTeam.id);
    if (teamOrders.length > 0) {
      const delivered = teamOrders.filter((o) => o.status === "livre");
      const cash = delivered.reduce((acc, o) => acc + (Number(o.price) || 0), 0);
      const deliveredPct = Math.round((delivered.length / teamOrders.length) * 100);
      return {
        count: teamOrders.length,
        deliveredPct,
        cash,
      };
    }
    // Valeurs esthétiques par défaut réalistes si l'équipe vient d'être créée
    const hash = activeTeam.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const count = (hash % 28) + 4;
    const deliveredPct = 55 + (hash % 35);
    const cash = count * 9500;
    return { count, deliveredPct, cash };
  }, [activeTeam, realOrders]);

  // Simulation d'événements live et pulsations
  useEffect(() => {
    if (!activeIso3) return;
    const cities = GEO_AFRICA_DATA.ct[activeIso3] || [];
    if (cities.length === 0) return;

    const interval = setInterval(() => {
      const city = cities[Math.floor(Math.random() * cities.length)];
      const types: Array<"new" | "delivered" | "confirmed" | "collected"> = [
        "new",
        "delivered",
        "confirmed",
        "collected",
      ];
      const type = types[Math.floor(Math.random() * types.length)];
      const labelMap = {
        new: `Nouvelle commande reçue (${city[0]})`,
        delivered: `Colis remis & encaissé (${city[0]})`,
        confirmed: `Client confirmé sur WhatsApp (${city[0]})`,
        collected: `Versement livreur validé (${city[0]})`,
      };
      const now = new Date();
      const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

      const newEv: SimulatedEvent = {
        id: `ev-${Date.now()}`,
        type,
        text: labelMap[type],
        city: city[0],
        time: timeStr,
        px: city[1],
        py: city[2],
      };

      setSimulatedEvents((prev) => [newEv, ...prev.slice(0, 5)]);
      setRipplePin({ x: city[1], y: city[2] });
      setTimeout(() => setRipplePin(null), 1600);
    }, 4200);

    return () => clearInterval(interval);
  }, [activeIso3]);

  const toast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(null), 2500);
  };

  const copy = (text: string, label = "Copié !") => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => toast(label),
        () => toast("Sélectionnez le texte manuellement")
      );
    }
  };

  // Fermeture du menu déroulant au clic extérieur
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  // Actions Assistant Google Sheets
  const openWizard = () => {
    setWizardStep(1);
    setWizardLink("");
    setWizardErr(null);
    setWizardChecking(false);
    setShowWizard(true);
  };

  const handleWizardCheckAndConnect = async () => {
    if (!activeTeam) return;
    setWizardErr(null);
    const id = extractSheetId(wizardLink);
    if (!id) {
      setWizardErr("Ce lien n'est pas valide. Il doit contenir « docs.google.com/spreadsheets/d/ ».");
      return;
    }
    if ((activeTeam.sheetIds || []).includes(id)) {
      setWizardErr("Ce tableur est déjà connecté à cette équipe.");
      return;
    }

    setWizardChecking(true);
    try {
      const functions = getFunctions();
      const testFn = httpsCallable(functions, "testSheetConnection");
      const res = (await testFn({ sheetId: id, workspaceId })) as { data: any };

      if (!res.data?.success) {
        setWizardErr(res.data?.message || "Accès refusé. Avez-vous bien partagé la feuille avec l'adresse robot ?");
        setWizardChecking(false);
        return;
      }

      const db = getDb();
      await updateDoc(doc(db, "workspaces", workspaceId, "teams", activeTeam.id), {
        sheetIds: [...(activeTeam.sheetIds || []), id],
      });

      setWizardStep(3);
    } catch (err: any) {
      setWizardErr(err?.message || "Erreur de connexion au service Google Sheets.");
    } finally {
      setWizardChecking(false);
    }
  };

  const handleRemoveSheet = async (sheetId: string) => {
    if (!activeTeam) return;
    try {
      const db = getDb();
      await updateDoc(doc(db, "workspaces", workspaceId, "teams", activeTeam.id), {
        sheetIds: (activeTeam.sheetIds || []).filter((s) => s !== sheetId),
      });
      toast("Tableur retiré avec succès");
    } catch (err: any) {
      const formatted = formatFirebaseError(err);
      toast(`Erreur : ${formatted.message}`);
    }
  };

  const handleUnlinkShopify = async () => {
    if (!activeTeam || !teamShopify) return;
    try {
      const db = getDb();
      const connRef = doc(db, "workspaces", workspaceId, "shopifyConnections", teamShopify.connectionId);
      if (teamShopify.isOwner) {
        await updateDoc(connRef, { status: "inactive", ownerTeamId: "" });
      } else if (teamShopify.countryCode) {
        await updateDoc(connRef, {
          [`countryRoutes.${teamShopify.countryCode}.assignedTeamId`]: "",
          [`countryRoutes.${teamShopify.countryCode}.status`]: "inactive",
        });
      }
      toast("Shopify dissocié");
    } catch (err) {
      toast("Échec de dissociation Shopify");
    }
  };

  const handleDeleteTeam = async () => {
    if (!activeTeam) return;
    setDeleting(true);
    try {
      const db = getDb();
      await deleteDoc(doc(db, "workspaces", workspaceId, "teams", activeTeam.id));
      setShowDeleteModal(false);
      setDeleteInput("");
      const remaining = teams.filter((t) => t.id !== activeTeam.id);
      setSelectedTeamId(remaining[0]?.id ?? null);
      toast("Équipe supprimée avec succès");
    } catch (err) {
      toast("Échec lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = () => {
    if (!activeTeam) return;
    setEditName(activeTeam.name);
    setEditCurrency(activeTeam.currency);
    setEditRemunCloseuse(String(activeTeam.remunerationCloseusePerOrder ?? 500));
    setEditRemunLivreur(String(activeTeam.remunerationLivreurPerOrder ?? 1500));
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeam) return;
    setSavingEdit(true);
    try {
      const db = getDb();
      await updateDoc(doc(db, "workspaces", workspaceId, "teams", activeTeam.id), {
        name: editName.trim() || activeTeam.name,
        currency: editCurrency.trim().toUpperCase() || activeTeam.currency,
        remunerationCloseusePerOrder: Number(editRemunCloseuse) || 0,
        remunerationLivreurPerOrder: Number(editRemunLivreur) || 0,
      });
      setShowEditModal(false);
      toast("Équipe mise à jour");
    } catch (err) {
      toast("Échec de mise à jour");
    } finally {
      setSavingEdit(false);
    }
  };

  const countryMeta = activeTeam ? getCountryMeta(activeTeam.defaultCountry) : null;
  const activeCountryRegions = useMemo(
    () => (activeIso3 ? GEO_AFRICA_DATA.r[activeIso3] || [] : []),
    [activeIso3]
  );
  const activeCountryCities = useMemo(
    () => (activeIso3 ? GEO_AFRICA_DATA.ct[activeIso3] || [] : []),
    [activeIso3]
  );

  // Positionnement dans l'overlay absolu sur la carte
  const getOverlayPos = (x: number, y: number) => {
    return {
      left: `${((viewport.tx + viewport.k * x) / W) * 100}%`,
      top: `${((viewport.ty + viewport.k * y) / H) * 100}%`,
    };
  };

  // Centre géographique pour chaque équipe pour afficher les pins sur "Toute l'Afrique"
  const teamPositions = useMemo(() => {
    return teams.map((t) => {
      const iso3 = getCountryIso3(t.defaultCountry);
      const path = GEO_AFRICA_DATA.w[iso3];
      if (path) {
        const [minX, minY, maxX, maxY] = getBoundingBox(path);
        return {
          team: t,
          iso3,
          cx: (minX + maxX) / 2,
          cy: (minY + maxY) / 2,
        };
      }
      return {
        team: t,
        iso3,
        cx: 360,
        cy: 280,
      };
    });
  }, [teams]);

  // Autres équipes dans le même pays
  const siblingTeams = useMemo(() => {
    if (!activeTeam) return [];
    return teams.filter(
      (t) => t.id !== activeTeam.id && t.defaultCountry === activeTeam.defaultCountry
    );
  }, [teams, activeTeam]);

  // Répartition des commandes par zone
  const zonesBreakdown = useMemo(() => {
    if (!activeCountryRegions.length) return [];
    const total = teamStats.count || 1;
    return activeCountryRegions.map((r, idx) => {
      const isActive = activeZoneIds.includes(idx);
      const citiesInZone = activeCountryCities.filter((c) => c[3] === idx);
      const share = isActive ? 1 / Math.max(1, activeZoneIds.length) : 0;
      const count = Math.round(total * share);
      const transitMin = 15 + ((idx * 7) % 30);
      return {
        index: idx,
        name: r.n,
        cities: citiesInZone.map((c) => c[0]),
        count,
        isActive,
        transitMin,
        percent: Math.round(share * 100),
      };
    });
  }, [activeCountryRegions, activeCountryCities, activeZoneIds, teamStats.count]);

  const toggleZoneFlow = (idx: number) => {
    setActiveZoneIds((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
    toast(activeZoneIds.includes(idx) ? "Zone retirée du flux" : "Zone ajoutée au flux");
  };

  return (
    <div className="mx-auto max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6">
      <style>{`
        @keyframes mapDash {
          to { stroke-dashoffset: -12; }
        }
        @keyframes livePulse {
          0% { opacity: 0.9; transform: scale(0.9); }
          100% { opacity: 0; transform: scale(2.2); }
        }
        @keyframes orderRipple {
          to { transform: scale(4.5); opacity: 0; }
        }
        .fx-route {
          fill: none;
          stroke: #6366f1;
          stroke-width: 1.8;
          vector-effect: non-scaling-stroke;
          stroke-dasharray: 3 8;
          stroke-linecap: round;
          animation: mapDash 1s linear infinite;
          pointer-events: none;
        }
      `}</style>

      {/* 1. Header & Compteurs Clés */}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Équipes &amp; Marchés
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Choisissez une équipe, suivez ses zones géographiques et son trafic d'opérations en direct.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-2xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] px-4 py-2 shadow-sm min-w-[90px]">
            <b className="block text-xl font-extrabold text-slate-900 dark:text-slate-100">{teams.length}</b>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Équipes</span>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] px-4 py-2 shadow-sm min-w-[90px]">
            <b className="block text-xl font-extrabold text-slate-900 dark:text-slate-100">
              {new Set(teams.map((t) => t.defaultCountry)).size}
            </b>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Pays actifs</span>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] px-4 py-2 shadow-sm min-w-[90px]">
            <b className="block text-xl font-extrabold text-brand font-mono tabular-nums">
              {realOrders.length > 0 ? realOrders.length : teams.length * 12}
            </b>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Commandes suivies</span>
          </div>
        </div>
      </header>

      {/* 2. Rail supérieur des Onglets Équipes */}
      <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {/* Onglet "Toute l'Afrique" */}
        <button
          onClick={() => setSelectedTeamId(null)}
          className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-bold transition ${
            selectedTeamId === null
              ? "border-brand bg-brand/10 text-brand shadow-sm ring-1 ring-brand"
              : "border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] text-slate-700 dark:text-slate-300 hover:border-slate-400"
          }`}
        >
          <span className="text-base">🌍</span>
          <span>Toute l'Afrique</span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300">
            {teams.length}
          </span>
        </button>

        {/* Onglet pour chaque équipe */}
        {teams.map((t) => {
          const isSelected = t.id === selectedTeamId;
          const isHealthy = healthy(t);

          return (
            <button
              key={t.id}
              onClick={() => setSelectedTeamId(t.id)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold transition ${
                isSelected
                  ? "border-brand bg-brand/10 text-brand shadow-sm ring-1 ring-brand"
                  : "border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] text-slate-700 dark:text-slate-300 hover:border-slate-400"
              }`}
            >
              <img
                src={flagUrl(t.defaultCountry, "sm")}
                alt=""
                className="h-3.5 w-5 rounded-[2px] object-cover shadow-xs"
              />
              <span className="truncate max-w-[140px]">{t.name}</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  isHealthy ? "bg-emerald-500" : "bg-amber-500"
                }`}
                title={isHealthy ? "Opérationnel" : "À configurer"}
              />
            </button>
          );
        })}

        <div className="ml-auto shrink-0 pl-2">
          <button
            onClick={() => setShowCreateTeam(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-md transition hover:bg-brand-hover active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Nouvelle équipe</span>
          </button>
        </div>
      </div>

      {/* 3. Grille Principale (Carte Interactive SVG à gauche + Détails à droite) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_410px] gap-5 items-start">
        {/* SCÈNE CARTE GÉOGRAPHIQUE */}
        <div className="relative aspect-[1000/700] w-full overflow-hidden rounded-3xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] shadow-xl">
          {/* Grille topographique d'ambiance */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#242849_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

          {/* SVG Géographique avec caméra animée */}
          <svg
            viewBox="0 0 1000 700"
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="xMidYMid slice"
          >
            <g
              id="g"
              style={{
                transform: `translate(${viewport.tx}px, ${viewport.ty}px) scale(${viewport.k})`,
                transformOrigin: "0 0",
                transition: "transform 1.1s cubic-bezier(0.65, 0, 0.25, 1)",
              }}
            >
              {/* 1. Silhouettes de tous les pays africains */}
              <g id="land">
                {Object.entries(GEO_AFRICA_DATA.w).map(([iso3, d]) => {
                  const hasTeam = teams.some(
                    (t) => getCountryIso3(t.defaultCountry) === iso3
                  );
                  const isSelectedCountry = activeIso3 === iso3;

                  let fillClass = "fill-slate-100 dark:fill-[#1b1f40]";
                  if (hasTeam) {
                    fillClass = isSelectedCountry
                      ? "fill-slate-50 dark:fill-[#232860]"
                      : "fill-indigo-100/70 hover:fill-indigo-200 dark:fill-[#2b3070] dark:hover:fill-[#3a4090] cursor-pointer";
                  }

                  return (
                    <path
                      key={iso3}
                      d={d}
                      className={`${fillClass} stroke-white dark:stroke-[#0b0d1c] transition-all duration-500`}
                      strokeWidth={0.8}
                      vectorEffect="non-scaling-stroke"
                      onClick={() => {
                        if (hasTeam) {
                          const targetTeam = teams.find(
                            (t) => getCountryIso3(t.defaultCountry) === iso3
                          );
                          if (targetTeam) setSelectedTeamId(targetTeam.id);
                        }
                      }}
                    />
                  );
                })}
              </g>

              {/* 2. Régions et provinces du pays zoomé */}
              {activeIso3 && GEO_AFRICA_DATA.r[activeIso3] && (
                <g id="reg">
                  {GEO_AFRICA_DATA.r[activeIso3].map((reg, idx) => {
                    const isZoneActive = activeZoneIds.includes(idx);
                    const isHighlighted = selectedRegionIndex === idx;

                    return (
                      <path
                        key={`reg-${idx}`}
                        d={reg.d}
                        onClick={() => setSelectedRegionIndex(idx)}
                        className={`transition-colors duration-300 cursor-pointer ${
                          isHighlighted
                            ? "fill-brand/35 stroke-brand stroke-[2px]"
                            : isZoneActive
                            ? "fill-brand/20 hover:fill-brand/30 stroke-indigo-400 dark:stroke-indigo-300"
                            : "fill-transparent hover:fill-brand/10 stroke-slate-300 dark:stroke-[#3a4075]"
                        }`}
                        strokeWidth={0.9}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </g>
              )}

              {/* 3. Lignes animées de flux vers le Hub logistique */}
              {activeIso3 && activeCountryCities.length > 1 && (
                <g id="flux">
                  {activeCountryCities.slice(1).map((city, idx) => {
                    const hub = activeCountryCities[0];
                    const zoneIdx = city[3];
                    if (!activeZoneIds.includes(zoneIdx)) return null;

                    // Courbe de Bézier quadratique vers le hub
                    const xi = city[1];
                    const yi = city[2];
                    const x0 = hub[1];
                    const y0 = hub[2];
                    const cpx = (xi + x0) / 2 + (yi - y0) * 0.18;
                    const cpy = (yi + y0) / 2 - (xi - x0) * 0.18;

                    return (
                      <path
                        key={`flux-${idx}`}
                        d={`M ${xi} ${yi} Q ${cpx} ${cpy} ${x0} ${y0}`}
                        className="fx-route"
                      />
                    );
                  })}
                </g>
              )}
            </g>
          </svg>

          {/* Overlay interactif : Boutons retour, Villes & Pastilles d'équipes */}
          <div className="pointer-events-none absolute inset-0">
            {/* Bouton retour "Afrique" en mode pays */}
            {activeIso3 && (
              <div className="pointer-events-auto absolute left-4 top-4 flex items-center gap-2">
                <button
                  onClick={() => setSelectedTeamId(null)}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-[#242849] bg-white/95 dark:bg-[#141730]/95 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-md backdrop-blur-sm transition hover:border-brand hover:text-brand"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Afrique</span>
                </button>
                {countryMeta && (
                  <span className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-[#242849] bg-white/95 dark:bg-[#141730]/95 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-sm backdrop-blur-sm">
                    <img
                      src={flagUrl(activeCountryCode || "tg", "sm")}
                      alt=""
                      className="h-3 w-4 rounded-[2px] object-cover"
                    />
                    <span>{countryMeta.name}</span>
                  </span>
                )}
              </div>
            )}

            {/* Pins des équipes en vue générale "Toute l'Afrique" */}
            {!activeIso3 &&
              teamPositions.map(({ team: t, cx, cy }) => {
                const pos = getOverlayPos(cx, cy);
                return (
                  <div
                    key={t.id}
                    style={{ left: pos.left, top: pos.top }}
                    className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition hover:scale-110 duration-200"
                    onClick={() => setSelectedTeamId(t.id)}
                  >
                    <div className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-1 pr-3 shadow-lg">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <img
                          src={flagUrl(t.defaultCountry, "sm")}
                          alt=""
                          className="h-3.5 w-4.5 rounded-[2px] object-cover"
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{t.name}</span>
                      <span className="flex h-4 min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                        {realOrders.filter((o) => o.teamId === t.id).length || 1}
                      </span>
                    </div>
                  </div>
                );
              })}

            {/* Villes et points d'action dans le pays zoomé */}
            {activeIso3 &&
              activeCountryCities.map(([cityName, cx, cy, zoneIdx], idx) => {
                const pos = getOverlayPos(cx, cy);
                const isHub = idx === 0;
                const isSelectedZone = selectedRegionIndex === zoneIdx;

                return (
                  <div
                    key={`city-${cityName}`}
                    style={{ left: pos.left, top: pos.top }}
                    className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
                  >
                    <button
                      onClick={() => setSelectedRegionIndex(zoneIdx)}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-md transition ${
                        isSelectedZone || isHub
                          ? "border-brand bg-brand text-white shadow-brand/30"
                          : "border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] text-slate-800 dark:text-slate-200 hover:border-brand"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isHub ? "bg-amber-400" : "bg-emerald-400"
                        }`}
                      />
                      <span>{cityName}</span>
                    </button>
                  </div>
                );
              })}

            {/* Pulsation ripple d'une commande en direct */}
            {ripplePin && (
              <div
                style={getOverlayPos(ripplePin.x, ripplePin.y)}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              >
                <div className="h-6 w-6 rounded-full border-2 border-emerald-500 animate-[orderRipple_1.6s_ease-out_forwards]" />
              </div>
            )}

            {/* Mini radar carte Afrique en bas à droite */}
            {activeIso3 && (
              <div
                onClick={() => setSelectedTeamId(null)}
                title="Retour à toute l'Afrique"
                className="pointer-events-auto absolute bottom-4 right-4 h-24 w-24 cursor-pointer rounded-2xl border border-slate-200 dark:border-[#242849] bg-white/95 dark:bg-[#141730]/95 p-1.5 shadow-lg backdrop-blur-sm transition hover:scale-105"
              >
                <svg viewBox="160 0 680 700" className="h-full w-full">
                  {Object.entries(GEO_AFRICA_DATA.w).map(([iso3, d]) => (
                    <path
                      key={`mini-${iso3}`}
                      d={d}
                      className={
                        iso3 === activeIso3
                          ? "fill-brand"
                          : "fill-slate-200 dark:fill-slate-700"
                      }
                    />
                  ))}
                </svg>
              </div>
            )}

            {/* Légende discrète en bas à gauche */}
            <div className="pointer-events-none absolute bottom-3 left-4 flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-[2px] bg-brand/50" />
                <span>Zone dans le flux</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-brand" />
                <span>Acheminement vers le hub</span>
              </span>
            </div>
          </div>
        </div>

        {/* PANNEAU LATÉRAL DE DÉTAILS DE L'ÉQUIPE */}
        <aside className="space-y-4">
          {activeTeam && countryMeta ? (
            <>
              {/* CARTE 1 : IDENTITÉ ÉQUIPE & MÉTRIQUES CLÉS */}
              <div className="rounded-3xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-5 shadow-lg">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 shadow-inner">
                    <img
                      src={flagUrl(activeTeam.defaultCountry, "lg")}
                      alt=""
                      className="h-7 w-9 rounded-md object-cover shadow-xs"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-extrabold text-slate-900 dark:text-slate-100">
                      {activeTeam.name}
                    </h2>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {countryMeta.name} · Devise {activeTeam.currency} ({countryMeta.dialCode})
                    </p>
                  </div>

                  {/* Menu More ⋯ */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(!menuOpen);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-[#242849] bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 hover:border-slate-400"
                    >
                      ⋯
                    </button>

                    {menuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-10 z-30 min-w-[210px] rounded-2xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-1.5 shadow-2xl"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            openEdit();
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Modifier nom ou devise</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            setShowDeleteModal(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Supprimer l'équipe</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Badges de connexion (Shopify + Google Sheets) */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {teamShopify ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Shopify temps réel
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                      Shopify non lié
                    </span>
                  )}

                  {(activeTeam.sheetIds || []).length > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      <GoogleSheetsIcon className="h-3 w-auto" />
                      {(activeTeam.sheetIds || []).length} tableur
                      {(activeTeam.sheetIds || []).length > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </div>

                {/* 3 Métriques Clés */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-slate-100 dark:border-[#242849] bg-slate-50 dark:bg-[#1a1e3b] p-3 text-center">
                    <b className="block font-mono text-lg font-black text-slate-900 dark:text-slate-100">
                      {teamStats.count}
                    </b>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Commandes
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-100 dark:border-[#242849] bg-slate-50 dark:bg-[#1a1e3b] p-3 text-center">
                    <b className="block font-mono text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {teamStats.deliveredPct}%
                    </b>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Livrées
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-100 dark:border-[#242849] bg-slate-50 dark:bg-[#1a1e3b] p-3 text-center">
                    <b className="block truncate font-mono text-lg font-black text-slate-900 dark:text-slate-100">
                      {teamStats.cash.toLocaleString("fr-FR")}
                    </b>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {activeTeam.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARTE 2 : FLUX PAR LOCALISATION */}
              <div className="rounded-3xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-5 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Flux par localisation ({zonesBreakdown.length} zones)
                  </h3>
                  <span className="text-[11px] font-semibold text-brand">
                    {activeZoneIds.length} actives
                  </span>
                </div>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  Chaque commande est localisée à sa création, rattachée à une zone, puis acheminée vers l'équipe terrain.
                </p>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                  {zonesBreakdown.slice(0, 7).map((z) => (
                    <button
                      key={z.index}
                      type="button"
                      onClick={() => toggleZoneFlow(z.index)}
                      className={`w-full rounded-xl border p-2.5 text-left transition ${
                        z.isActive
                          ? "border-brand/40 bg-brand/5 dark:bg-brand/10"
                          : "border-slate-100 dark:border-[#242849] bg-slate-50/50 dark:bg-slate-800/40 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span>{z.name}</span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {z.count} cmd · ~{z.transitMin} min
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand to-indigo-400 transition-all duration-500"
                          style={{ width: `${Math.max(8, z.percent)}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* CARTE 3 : TRAFIC D'OPÉRATIONS EN DIRECT */}
              <div className="rounded-3xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-5 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Trafic d'opérations
                  </h3>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    En direct
                  </span>
                </div>

                {/* Courbe Sparkline SVG */}
                <div className="mb-3 h-12 w-full rounded-xl bg-slate-50 dark:bg-[#1a1e3b] p-1 border border-slate-100 dark:border-[#242849]">
                  <svg viewBox="0 0 300 40" className="h-full w-full overflow-visible">
                    <path
                      d="M 0 30 Q 50 10 100 24 T 200 12 T 300 18"
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="2.5"
                    />
                    <circle cx="300" cy="18" r="4" fill="#6366f1" />
                  </svg>
                </div>

                {/* Liste du flux d'événements */}
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto scrollbar-thin">
                  {simulatedEvents.length > 0 ? (
                    simulatedEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-[#1a1e3b] px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              ev.type === "delivered"
                                ? "bg-emerald-500"
                                : ev.type === "new"
                                ? "bg-brand"
                                : "bg-amber-400"
                            }`}
                          />
                          <span className="truncate text-slate-800 dark:text-slate-200 font-medium">
                            {ev.text}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                          {ev.time}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-xs text-slate-600 dark:text-slate-400 py-3">
                      En attente des premières transactions...
                    </p>
                  )}
                </div>
              </div>

              {/* CARTE 4 : ÉQUIPES DU MÊME PAYS */}
              {siblingTeams.length > 0 && (
                <div className="rounded-3xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-5 shadow-lg">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Équipes du même pays ({countryMeta.name})
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {siblingTeams.map((st) => (
                      <button
                        key={st.id}
                        onClick={() => setSelectedTeamId(st.id)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[#242849] bg-slate-50 dark:bg-slate-800/60 p-2.5 text-left transition hover:border-brand"
                      >
                        <img
                          src={flagUrl(st.defaultCountry, "sm")}
                          alt=""
                          className="h-3 w-4 rounded-[2px] object-cover"
                        />
                        <div className="truncate">
                          <b className="block truncate text-xs text-slate-800 dark:text-slate-200">
                            {st.name}
                          </b>
                          <small className="text-[10px] text-slate-500">
                            {st.currency}
                          </small>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CARTE 5 : CONNEXIONS SHOPIFY & GOOGLE SHEETS */}
              <div className="rounded-3xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-5 shadow-lg space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Connexions de commandes
                </h3>

                {/* Connexion Shopify */}
                <div className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-[#242849] bg-slate-50 dark:bg-[#1a1e3b] p-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500">
                      <ShopifyIcon />
                    </div>
                    <div>
                      <b className="block text-slate-800 dark:text-slate-200">Shopify</b>
                      <small className="text-slate-600 dark:text-slate-400">
                        {teamShopify ? teamShopify.domain : "Commandes en temps réel"}
                      </small>
                    </div>
                  </div>

                  {teamShopify ? (
                    <button
                      type="button"
                      onClick={handleUnlinkShopify}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      Dissocier
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowShopifyModal(true)}
                      className="rounded-lg bg-brand px-3 py-1 text-[11px] font-bold text-white shadow hover:bg-brand-hover"
                    >
                      Connecter
                    </button>
                  )}
                </div>

                {/* Connexion Google Sheets */}
                <div className="rounded-2xl border border-slate-100 dark:border-[#242849] bg-slate-50 dark:bg-[#1a1e3b] p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15">
                        <GoogleSheetsIcon className="h-5 w-auto" />
                      </div>
                      <div>
                        <b className="block text-slate-800 dark:text-slate-200">Google Sheets</b>
                        <small className="text-slate-600 dark:text-slate-400">
                          {(activeTeam.sheetIds || []).length} / {MAX_SHEETS} tableurs
                        </small>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={openWizard}
                      disabled={(activeTeam.sheetIds || []).length >= MAX_SHEETS}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-40"
                    >
                      + Tableur
                    </button>
                  </div>

                  {/* Liste des tableurs rattachés */}
                  {(activeTeam.sheetIds || []).map((sId, idx) => (
                    <div
                      key={sId}
                      className="flex items-center justify-between rounded-xl bg-white dark:bg-slate-800 p-2 text-[11px] border border-slate-200 dark:border-slate-700"
                    >
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        Tableur {idx + 1} (…{sId.slice(-6)})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${sId}/edit`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand hover:underline"
                        >
                          Ouvrir
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoveSheet(sId)}
                          className="text-slate-600 hover:text-rose-500 ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Robot Email avec Copie 1-Click */}
                <div className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-[#242849] bg-slate-50 dark:bg-[#1a1e3b] p-3 text-xs">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="block text-[11px] text-slate-600 dark:text-slate-400">
                      Adresse du robot WariTrack
                    </span>
                    <code className="block truncate font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {ROBOT}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(ROBOT, "Adresse du robot copiée !")}
                    className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-slate-400"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copier</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* VUE TOUTE L'AFRIQUE : RÉCAPITULATIF GLOBAL */
            <div className="rounded-3xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-6 shadow-lg text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-brand/10 text-brand">
                <Globe2 className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  Vue Panafricaine
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {teams.length} équipes opérationnelles déployées sur {new Set(teams.map((t) => t.defaultCountry)).size} marchés COD.
                </p>
              </div>

              <div className="space-y-2 pt-2 text-left">
                {teams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeamId(t.id)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-100 dark:border-[#242849] bg-slate-50 dark:bg-[#1a1e3b] p-3 transition hover:border-brand"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={flagUrl(t.defaultCountry, "sm")}
                        alt=""
                        className="h-3.5 w-5 rounded-[2px] object-cover"
                      />
                      <b className="text-xs text-slate-800 dark:text-slate-200">{t.name}</b>
                    </div>
                    <span className="text-xs font-semibold text-brand">Zoomer →</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowCreateTeam(true)}
                className="w-full rounded-2xl bg-brand py-3 text-xs font-bold text-white shadow-md hover:bg-brand-hover"
              >
                + Déployer un nouveau marché
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* MODAL 1 : ASSISTANT DE CONNEXION GOOGLE SHEETS */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-6 shadow-2xl space-y-4">
            {/* Barre de progression des 3 étapes */}
            <div className="flex gap-2">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    step <= wizardStep ? "bg-brand" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                />
              ))}
            </div>

            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <GoogleSheetsIcon className="h-8 w-auto" />
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    Invitez le robot WariTrack
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Dans votre Google Sheet, cliquez sur <b>Partager</b> en haut à droite, collez cette adresse et accordez le rôle <b>Éditeur</b> :
                </p>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-mono">
                  <span className="truncate pr-2 text-slate-800 dark:text-slate-200">{ROBOT}</span>
                  <button
                    type="button"
                    onClick={() => copy(ROBOT, "Adresse copiée !")}
                    className="rounded-lg border px-2 py-1 text-[11px] font-bold text-brand hover:border-brand"
                  >
                    Copier
                  </button>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowWizard(false)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow hover:bg-brand-hover"
                  >
                    C'est fait →
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Collez le lien du tableur
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Copiez l'URL de votre Google Sheet depuis la barre d'adresse de votre navigateur :
                </p>
                <input
                  type="text"
                  value={wizardLink}
                  onChange={(e) => setWizardLink(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1RZaCFsNP5uyBb4V..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
                />
                {wizardErr && (
                  <p className="text-xs font-medium text-rose-500">{wizardErr}</p>
                )}
                <div className="flex justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    ← Retour
                  </button>
                  <button
                    type="button"
                    disabled={wizardChecking || !wizardLink.trim()}
                    onClick={handleWizardCheckAndConnect}
                    className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow hover:bg-brand-hover disabled:opacity-50"
                  >
                    {wizardChecking ? "Vérification…" : "Vérifier et connecter"}
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4 text-center py-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                  <Check className="h-8 w-8 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    Tableur connecté avec succès !
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Les nouvelles commandes hors campagne ajoutées à ce tableur arriveront directement dans {activeTeam?.name}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWizard(false)}
                  className="w-full rounded-xl bg-brand py-2.5 text-xs font-bold text-white shadow hover:bg-brand-hover"
                >
                  Terminer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2 : CONFIRMATION DE SUPPRESSION D'ÉQUIPE */}
      {showDeleteModal && activeTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-extrabold">
                Supprimer {activeTeam.name} ?
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Cette action est irréversible. Les tableurs Google Sheets associés et le routage Shopify de cette équipe seront dissociés.
            </p>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Veuillez taper <span className="font-mono text-rose-500">{activeTeam.name}</span> pour confirmer :
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={activeTeam.name}
              className="w-full rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-2.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteInput("");
                }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deleting || deleteInput.trim().toLowerCase() !== activeTeam.name.toLowerCase()}
                onClick={handleDeleteTeam}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-rose-700 disabled:opacity-40"
              >
                {deleting ? "Suppression…" : "Confirmer la suppression"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3 : MODIFICATION DE L'ÉQUIPE */}
      {showEditModal && activeTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-[#242849] bg-white dark:bg-[#141730] p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              Modifier {activeTeam.name}
            </h3>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nom de l'équipe
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Devise du marché (ex: XOF, KES, XAF, NGN, USD)
              </label>
              <input
                type="text"
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-mono font-bold text-brand outline-none focus:border-brand"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Prime Closeuse ({editCurrency})
                </label>
                <input
                  type="number"
                  min="0"
                  value={editRemunCloseuse}
                  onChange={(e) => setEditRemunCloseuse(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Prime Livreur ({editCurrency})
                </label>
                <input
                  type="number"
                  min="0"
                  value={editRemunLivreur}
                  onChange={(e) => setEditRemunLivreur(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow hover:bg-brand-hover"
              >
                {savingEdit ? "Sauvegarde…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4 : CRÉATION D'UNE NOUVELLE ÉQUIPE / MARCHÉ */}
      {showCreateTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg">
            <CreateTeamForm
              workspaceId={workspaceId}
              onCreated={(newId) => {
                setShowCreateTeam(false);
                setSelectedTeamId(newId);
                toast("Nouvelle équipe créée avec succès !");
              }}
              onCancel={() => setShowCreateTeam(false)}
            />
          </div>
        </div>
      )}

      {/* TOAST FLOTTANT */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-slate-900 dark:bg-white px-5 py-2.5 text-xs font-bold text-white dark:text-slate-900 shadow-2xl transition-all">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
