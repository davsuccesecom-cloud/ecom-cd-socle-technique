"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HIGH_TRUST_DELIVERY_RATE = exports.STALE_NEW_ORDER_THRESHOLD_MINUTES = exports.MAX_ACTIVE_DELIVERIES_LIVREUR = exports.MAX_ACTIVE_ORDERS_CLOSEUSE = void 0;
exports.getCloserGlobalActiveLoad = getCloserGlobalActiveLoad;
exports.getLivreurActiveDeliveries = getLivreurActiveDeliveries;
exports.getCloserPerformanceMetrics = getCloserPerformanceMetrics;
exports.getLivreurTrustRate = getLivreurTrustRate;
exports.findBestCloseuseCandidate = findBestCloseuseCandidate;
exports.rebalanceStaleNewOrders = rebalanceStaleNewOrders;
exports.rebalanceOverloadedLivreurs = rebalanceOverloadedLivreurs;
exports.liberateAndReassignEmployeeOrders = liberateAndReassignEmployeeOrders;
const admin = __importStar(require("firebase-admin"));
/**
 * Constantes et Seuils Opérationnels de Répartition des Commandes (Workload Balancing & Anti-Submersion)
 */
exports.MAX_ACTIVE_ORDERS_CLOSEUSE = 15; // Plafond anti-submersion pour closeuse
exports.MAX_ACTIVE_DELIVERIES_LIVREUR = 15; // Plafond de saturation pour livreur
exports.STALE_NEW_ORDER_THRESHOLD_MINUTES = 15; // Délai d'inactivité avant bascule d'une commande "nouveau"
exports.HIGH_TRUST_DELIVERY_RATE = 70; // Taux de livraison de confiance minimum (70%)
/**
 * 1. Charge globale d'une closeuse à l'échelle du workspace (Toutes équipes confondues)
 * Crucial lorsqu'une closeuse est prêtée/empruntée dans plusieurs équipes du même pays.
 */
async function getCloserGlobalActiveLoad(db, workspaceId, closerId) {
    try {
        const snap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("orders")
            .where("closeuseId", "==", closerId)
            .where("statutCloseuse", "in", ["nouveau", "programme", "en_cours"])
            .get();
        return snap.size;
    }
    catch (err) {
        console.warn(`[dispatching] Erreur getCloserGlobalActiveLoad pour ${closerId}:`, err);
        return 0;
    }
}
/**
 * 2. Charge active d'un livreur (Colis en cours de livraison ou en attente de tournée)
 */
async function getLivreurActiveDeliveries(db, workspaceId, livreurId) {
    try {
        const snap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("orders")
            .where("livreurId", "==", livreurId)
            .where("statutLivreur", "in", ["recu", "en_cours", "reprogramme"])
            .get();
        return snap.size;
    }
    catch (err) {
        console.warn(`[dispatching] Erreur getLivreurActiveDeliveries pour ${livreurId}:`, err);
        return 0;
    }
}
/**
 * 3. Mesure de la performance d'une closeuse (Taux de confirmation & Rapidité de traitement)
 * Basé sur les commandes clôturées des 30 derniers jours.
 */
async function getCloserPerformanceMetrics(db, workspaceId, closerId) {
    try {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const snap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("orders")
            .where("closeuseId", "==", closerId)
            .where("timestamps.received", ">=", thirtyDaysAgo)
            .get();
        if (snap.empty) {
            return { confirmationRate: 75, speedScore: 80 }; // Valeur de confiance initiale pour les nouveaux profils
        }
        let confirmedCount = 0;
        let failedCount = 0;
        let totalSpeedMinutes = 0;
        let timedOrdersCount = 0;
        for (const doc of snap.docs) {
            const o = doc.data();
            const statut = o.statutCloseuse;
            if (statut === "confirme" || statut === "en_cours") {
                confirmedCount++;
            }
            else if (statut === "rejete" || statut === "annule") {
                failedCount++;
            }
            const receivedAt = o.timestamps?.received;
            const firstActionAt = o.timestamps?.firstCall || o.timestamps?.closeuseDecidedAt;
            if (receivedAt && firstActionAt && firstActionAt > receivedAt) {
                const diffMinutes = (firstActionAt - receivedAt) / (60 * 1000);
                if (diffMinutes >= 0 && diffMinutes <= 24 * 60) {
                    totalSpeedMinutes += diffMinutes;
                    timedOrdersCount++;
                }
            }
        }
        const totalDecided = confirmedCount + failedCount;
        const confirmationRate = totalDecided >= 3
            ? Math.round((confirmedCount / totalDecided) * 100)
            : 75;
        // Score de rapidité : < 15min = 100, < 30min = 85, < 60min = 65, au-delà = 40
        let speedScore = 80;
        if (timedOrdersCount >= 2) {
            const avgMin = totalSpeedMinutes / timedOrdersCount;
            if (avgMin <= 15)
                speedScore = 100;
            else if (avgMin <= 30)
                speedScore = 85;
            else if (avgMin <= 60)
                speedScore = 65;
            else
                speedScore = 40;
        }
        return { confirmationRate, speedScore };
    }
    catch (err) {
        console.warn(`[dispatching] Erreur getCloserPerformanceMetrics pour ${closerId}:`, err);
        return { confirmationRate: 75, speedScore: 80 };
    }
}
/**
 * 4. Taux de livraison de confiance pour un livreur
 * Ratio : livrées / (livrées + échouées/retournées)
 */
async function getLivreurTrustRate(db, workspaceId, livreurId) {
    try {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const snap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("orders")
            .where("livreurId", "==", livreurId)
            .where("timestamps.received", ">=", thirtyDaysAgo)
            .get();
        if (snap.empty)
            return 75;
        let deliveredCount = 0;
        let failedCount = 0;
        for (const doc of snap.docs) {
            const o = doc.data();
            const statut = o.statutLivreur;
            if (statut === "livre" || statut === "encaisse") {
                deliveredCount++;
            }
            else if (statut === "retourne" || statut === "refuse" || statut === "annule") {
                failedCount++;
            }
        }
        const total = deliveredCount + failedCount;
        return total >= 3 ? Math.round((deliveredCount / total) * 100) : 75;
    }
    catch (err) {
        console.warn(`[dispatching] Erreur getLivreurTrustRate pour ${livreurId}:`, err);
        return 75;
    }
}
/**
 * 5. Recherche de la meilleure closeuse éligible (Anti-submersion, Taux de confirmation, Emprunt multi-équipes)
 */
async function findBestCloseuseCandidate(db, workspaceId, order, homeTeamId) {
    if (!homeTeamId)
        return null;
    // Récupérer à la fois les closeuses d'origine ET les closeuses allouées/prêtées à cette équipe
    const [homeCloseusesSnap, allocatedCloseusesSnap] = await Promise.all([
        db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("users")
            .where("teamId", "==", homeTeamId)
            .where("role", "==", "closeuse")
            .where("status", "==", "active")
            .get(),
        db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("users")
            .where("allocatedTeamIds", "array-contains", homeTeamId)
            .where("role", "==", "closeuse")
            .where("status", "==", "active")
            .get(),
    ]);
    const candidateMap = new Map();
    homeCloseusesSnap.docs.forEach((doc) => {
        const d = doc.data();
        // Sécurité stricte : ignorer tout employé désactivé ou supprimé
        if (d.status === "active" && !d.disabledAt && !d.deleted) {
            candidateMap.set(doc.id, { doc, isBorrowed: false });
        }
    });
    allocatedCloseusesSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.status === "active" && !d.disabledAt && !d.deleted && !candidateMap.has(doc.id)) {
            candidateMap.set(doc.id, { doc, isBorrowed: true });
        }
    });
    if (candidateMap.size === 0)
        return null;
    const orderLanguage = (order?.clientLanguage || "").trim().toLowerCase();
    // Évaluer la charge globale et les scores pour chaque candidate
    const evaluatedCandidates = await Promise.all(Array.from(candidateMap.values()).map(async ({ doc, isBorrowed }) => {
        const data = doc.data();
        const globalActiveCount = await getCloserGlobalActiveLoad(db, workspaceId, doc.id);
        const isSubmerged = globalActiveCount >= exports.MAX_ACTIVE_ORDERS_CLOSEUSE;
        const { confirmationRate, speedScore } = await getCloserPerformanceMetrics(db, workspaceId, doc.id);
        // Calcul des points de disponibilité restante (0 à 20 points)
        const availabilityPoints = Math.max(0, (exports.MAX_ACTIVE_ORDERS_CLOSEUSE - globalActiveCount) / exports.MAX_ACTIVE_ORDERS_CLOSEUSE) * 20;
        // Score composite pondéré :
        // - 60% Taux de confirmation
        // - 20% Rapidité de traitement
        // - 20% Disponibilité restante anti-submersion
        let compositeScore = (confirmationRate * 0.6) + (speedScore * 0.2) + availabilityPoints;
        // Malus sévère de 50 points si la closeuse est submergée (> 15 commandes en cours)
        if (isSubmerged) {
            compositeScore -= 50;
        }
        // Bonus si concordance linguistique (Skill-Based Routing)
        let languageMatched = false;
        if (orderLanguage) {
            const userLangs = Array.isArray(data.languages) ? data.languages : [];
            languageMatched = userLangs.some((l) => {
                const cleanL = l.toLowerCase();
                return cleanL === orderLanguage || cleanL.includes(orderLanguage) || orderLanguage.includes(cleanL);
            });
            if (languageMatched) {
                compositeScore += 15;
            }
        }
        return {
            id: doc.id,
            data,
            globalActiveCount,
            isSubmerged,
            confirmationRate,
            speedScore,
            compositeScore,
            isBorrowed,
            languageMatched,
        };
    }));
    // Filtrer en priorité les candidates NON submergées
    const nonSubmerged = evaluatedCandidates.filter((c) => !c.isSubmerged);
    const pool = nonSubmerged.length > 0 ? nonSubmerged : evaluatedCandidates;
    // Si une langue locale est requise, privilégier celles qui la parlent
    if (orderLanguage) {
        const langCandidates = pool.filter((c) => c.languageMatched);
        if (langCandidates.length > 0) {
            return langCandidates.reduce((best, curr) => (curr.compositeScore > best.compositeScore ? curr : best));
        }
    }
    // Sélectionner la closeuse avec le meilleur score composite
    return pool.reduce((best, curr) => (curr.compositeScore > best.compositeScore ? curr : best));
}
/**
 * 6. Bascule dynamique des commandes "nouveau" stagnantes (Watchdog IA)
 * S'assure que si une commande reste au statut "nouveau" sans appel pendant plus de 15 min,
 * elle bascule automatiquement vers une closeuse libérée et plus performante.
 * RÈGLE STRICTE : Ne touche JAMAIS aux commandes "programme", "en_cours" ou en cours d'appel !
 */
async function rebalanceStaleNewOrders(db, workspaceId, sendPushFn, maxOrders = 5) {
    const details = [];
    let rebalancedCount = 0;
    try {
        const cutoffTime = Date.now() - exports.STALE_NEW_ORDER_THRESHOLD_MINUTES * 60 * 1000;
        // Récupérer les commandes strictement "nouveau" et âgées de plus de 15 min
        const staleSnap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("orders")
            .where("statutCloseuse", "==", "nouveau")
            .where("timestamps.received", "<=", cutoffTime)
            .limit(maxOrders * 2)
            .get();
        if (staleSnap.empty) {
            return { rebalancedCount: 0, details };
        }
        for (const doc of staleSnap.docs) {
            if (rebalancedCount >= maxOrders)
                break;
            const order = doc.data();
            // RÈGLE ABSOLUE : Si un appel est actuellement en cours, interdiction formelle de basculer !
            if (order.callInProgress?.active) {
                continue;
            }
            const teamId = order.teamId;
            if (!teamId)
                continue;
            const currentCloserId = order.closeuseId;
            // Chercher la meilleure candidate disponible
            const bestCandidate = await findBestCloseuseCandidate(db, workspaceId, order, teamId);
            // Si une candidate non submergée et plus optimale est trouvée (différente de l'actuelle)
            if (bestCandidate && bestCandidate.id !== currentCloserId && !bestCandidate.isSubmerged) {
                await doc.ref.update({
                    closeuseId: bestCandidate.id,
                    "timestamps.reassignedToCloseuse": Date.now(),
                    reassignedReason: "stale_inactivity_watchdog",
                    fieldNote: `⚡ [Réattribution automatique] Basculée vers ${bestCandidate.data?.name || "Closeuse"} suite délai d'attente (> 15 min)`,
                });
                rebalancedCount++;
                const logMsg = `Commande ${order.orderNumber || doc.id} réattribuée de ${currentCloserId} -> ${bestCandidate.id} (Score: ${Math.round(bestCandidate.compositeScore)}, Charge: ${bestCandidate.globalActiveCount}/${exports.MAX_ACTIVE_ORDERS_CLOSEUSE})`;
                details.push(logMsg);
                console.log(`[dispatching] ${logMsg}`);
                if (sendPushFn) {
                    await sendPushFn(workspaceId, bestCandidate.id, "⚡ Commande prioritaire réattribuée", `${order.clientName || "Client"} - ${order.product || "Produit"} (Bascule pour traitement immédiat)`, doc.id).catch(() => { });
                }
            }
        }
    }
    catch (err) {
        console.error("[dispatching] Erreur rebalanceStaleNewOrders:", err);
    }
    return { rebalancedCount, details };
}
/**
 * 7. Rééquilibrage du surplus de colis chez les livreurs saturés
 * Si un livreur a plus de 15 colis actifs, réattribuer les colis non encore collectés (statutLivreur == "recu")
 * vers un livreur disponible ayant un taux de confiance >= 70%.
 */
async function rebalanceOverloadedLivreurs(db, workspaceId, sendPushFn, maxDeliveries = exports.MAX_ACTIVE_DELIVERIES_LIVREUR) {
    const details = [];
    let rebalancedCount = 0;
    try {
        // 1. Lister tous les livreurs actifs du workspace
        const livreursSnap = await db
            .collection("workspaces")
            .doc(workspaceId)
            .collection("users")
            .where("role", "==", "livreur")
            .where("status", "==", "active")
            .get();
        if (livreursSnap.size <= 1)
            return { rebalancedCount: 0, details };
        const livreurLoads = await Promise.all(livreursSnap.docs.map(async (doc) => {
            const d = doc.data();
            const activeCount = await getLivreurActiveDeliveries(db, workspaceId, doc.id);
            const trustRate = await getLivreurTrustRate(db, workspaceId, doc.id);
            return {
                id: doc.id,
                data: d,
                activeDeliveriesCount: activeCount,
                isSaturated: activeCount >= maxDeliveries,
                deliveryTrustRate: trustRate,
            };
        }));
        const overloaded = livreurLoads.filter((l) => l.isSaturated);
        const available = livreurLoads.filter((l) => !l.isSaturated && l.deliveryTrustRate >= exports.HIGH_TRUST_DELIVERY_RATE);
        if (overloaded.length === 0 || available.length === 0) {
            return { rebalancedCount: 0, details };
        }
        for (const ov of overloaded) {
            const surplusCount = ov.activeDeliveriesCount - maxDeliveries;
            if (surplusCount <= 0)
                continue;
            // Récupérer les colis en attente (statutLivreur === "recu", non encore partis en tournée "en_cours")
            const pendingPackagesSnap = await db
                .collection("workspaces")
                .doc(workspaceId)
                .collection("orders")
                .where("livreurId", "==", ov.id)
                .where("statutLivreur", "==", "recu")
                .limit(Math.min(5, surplusCount))
                .get();
            for (const pDoc of pendingPackagesSnap.docs) {
                // Trouver le livreur disponible le moins chargé parmi ceux de confiance
                available.sort((a, b) => a.activeDeliveriesCount - b.activeDeliveriesCount);
                const targetLivreur = available[0];
                if (!targetLivreur || targetLivreur.activeDeliveriesCount >= maxDeliveries) {
                    break;
                }
                await pDoc.ref.update({
                    livreurId: targetLivreur.id,
                    "timestamps.reassignedLivreur": Date.now(),
                    reassignedLivreurReason: "surplus_rebalancing",
                    fieldNote: `🚚 [Surplus rééquilibré] Transféré de ${ov.data.name || "Livreur"} (saturé) vers ${targetLivreur.data.name || "Livreur"} (Taux confiance: ${targetLivreur.deliveryTrustRate}%)`,
                });
                targetLivreur.activeDeliveriesCount++;
                rebalancedCount++;
                const logMsg = `Colis ${pDoc.id} rééquilibré de ${ov.data.name} (${ov.activeDeliveriesCount}) -> ${targetLivreur.data.name} (${targetLivreur.activeDeliveriesCount})`;
                details.push(logMsg);
                console.log(`[dispatching] ${logMsg}`);
                if (sendPushFn) {
                    await sendPushFn(workspaceId, targetLivreur.id, "📦 Nouveau colis attribué (Surplus rééquilibré)", `Colis transféré suite saturation logistique · Confiance élevée`, pDoc.id).catch(() => { });
                }
            }
        }
    }
    catch (err) {
        console.error("[dispatching] Erreur rebalanceOverloadedLivreurs:", err);
    }
    return { rebalancedCount, details };
}
/**
 * 8. Libération et réattribution automatique des commandes des employés révoqués ou supprimés
 * RÈGLE DE SÉCURITÉ ABSOLUE : Un employé désactivé ou supprimé ne doit JAMAIS garder de commandes en otage.
 */
async function liberateAndReassignEmployeeOrders(db, workspaceId, userId, role, sendPushFn) {
    let liberatedCount = 0;
    let reallocatedCount = 0;
    try {
        if (role === "closeuse") {
            const ordersSnap = await db
                .collection("workspaces")
                .doc(workspaceId)
                .collection("orders")
                .where("closeuseId", "==", userId)
                .where("statutCloseuse", "in", ["nouveau", "programme", "en_cours"])
                .get();
            liberatedCount = ordersSnap.size;
            for (const doc of ordersSnap.docs) {
                const order = doc.data();
                const teamId = order.teamId;
                // Chercher une nouvelle closeuse active
                let newCloserCandidate = null;
                if (teamId) {
                    newCloserCandidate = await findBestCloseuseCandidate(db, workspaceId, order, teamId);
                }
                const newCloserId = newCloserCandidate ? newCloserCandidate.id : null;
                await doc.ref.update({
                    closeuseId: newCloserId,
                    callInProgress: admin.firestore.FieldValue.delete(),
                    statutCloseuse: "nouveau", // Rebasculer en nouveau pour traitement immédiat
                    "timestamps.liberatedFromRevokedEmployee": Date.now(),
                    fieldNote: `⚠️ [Employé désactivé] Commande libérée et réattribuée automatiquement${newCloserCandidate ? ` à ${newCloserCandidate.data.name}` : " (En attente d'une closeuse active)"}`,
                });
                if (newCloserCandidate) {
                    reallocatedCount++;
                    if (sendPushFn) {
                        await sendPushFn(workspaceId, newCloserCandidate.id, "🔄 Commande réattribuée", `${order.clientName || "Client"} - ${order.product || "Produit"} (Prise de relais immédiate)`, doc.id).catch(() => { });
                    }
                }
            }
        }
        else if (role === "livreur") {
            const deliveriesSnap = await db
                .collection("workspaces")
                .doc(workspaceId)
                .collection("orders")
                .where("livreurId", "==", userId)
                .where("statutLivreur", "in", ["recu", "en_cours", "reprogramme"])
                .get();
            liberatedCount = deliveriesSnap.size;
            for (const doc of deliveriesSnap.docs) {
                await doc.ref.update({
                    livreurId: null,
                    statutLivreur: null, // Prêt à être redistribué
                    "timestamps.liberatedFromRevokedLivreur": Date.now(),
                    fieldNote: `⚠️ [Livreur désactivé] Colis libéré et remis en attente de dispatch`,
                });
                reallocatedCount++;
            }
        }
        console.log(`[dispatching] Employé ${userId} (${role}) : ${liberatedCount} commande(s) libérée(s), ${reallocatedCount} réattribuée(s)`);
    }
    catch (err) {
        console.error("[dispatching] Erreur liberateAndReassignEmployeeOrders:", err);
    }
    return { liberatedCount, reallocatedCount };
}
