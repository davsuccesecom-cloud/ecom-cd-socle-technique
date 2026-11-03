"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServiceAccountEmail = getServiceAccountEmail;
exports.getSheetsClient = getSheetsClient;
exports.colIndexToLetter = colIndexToLetter;
exports.detectAndEnsureSheetColumns = detectAndEnsureSheetColumns;
exports.writeOrderStatusToSheet = writeOrderStatusToSheet;
const googleapis_1 = require("googleapis");
// ============================================================================
// SERVICE ACCOUNT & GOOGLE SHEETS API CLIENT
// ============================================================================
let sheetsClientPromise = null;
function getServiceAccountEmail() {
    if (process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL) {
        return process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
    }
    const rawKey = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY;
    if (rawKey) {
        try {
            const parsed = JSON.parse(rawKey);
            if (parsed.client_email)
                return parsed.client_email;
        }
        catch { }
    }
    // Compte de service officiel du projet Firebase / Google Cloud
    return "meta-capi-app@appspot.gserviceaccount.com";
}
function getSheetsClient() {
    if (!sheetsClientPromise) {
        const rawKey = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY;
        if (rawKey) {
            try {
                const credentials = JSON.parse(rawKey);
                const auth = new googleapis_1.google.auth.JWT({
                    email: credentials.client_email,
                    key: credentials.private_key,
                    scopes: [
                        "https://www.googleapis.com/auth/spreadsheets",
                        "https://www.googleapis.com/auth/drive.file",
                    ],
                });
                sheetsClientPromise = googleapis_1.google.sheets({ version: "v4", auth });
                return sheetsClientPromise;
            }
            catch (err) {
                console.warn("getSheetsClient: échec parsing GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY, repli sur GoogleAuth", err);
            }
        }
        // Repli natif : Identifiants par défaut Cloud Functions (Application Default Credentials)
        const auth = new googleapis_1.google.auth.GoogleAuth({
            scopes: [
                "https://www.googleapis.com/auth/spreadsheets",
                "https://www.googleapis.com/auth/drive.file",
            ],
        });
        sheetsClientPromise = googleapis_1.google.sheets({ version: "v4", auth });
    }
    return sheetsClientPromise;
}
// Convertit un indice 0-based en lettre de colonne Excel/Google Sheet (0 -> A, 1 -> B, 26 -> AA, etc.)
function colIndexToLetter(idx) {
    let letter = "";
    let temp = idx;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
}
function cleanHeader(h) {
    if (!h)
        return "";
    return String(h)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // supprime accents
        .replace(/[^a-z0-9]/g, ""); // garde alphanumérique
}
// Cache mémoire en cours d'exécution pour éviter de re-scanner la ligne 1 à chaque mise à jour
const STRUCTURE_CACHE = new Map();
async function detectAndEnsureSheetColumns(sheets, spreadsheetId, forceRefresh = false) {
    const cached = STRUCTURE_CACHE.get(spreadsheetId);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
        return cached.structure;
    }
    // 1. Récupère les métadonnées du tableur (titre et premier onglet)
    const meta = await sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: false,
    });
    const spreadsheetTitle = meta.data.properties?.title || "Tableau Google Sheets";
    const firstSheet = meta.data.sheets?.[0];
    const sheetName = firstSheet?.properties?.title || "Feuille 1";
    const sheetIdNum = firstSheet?.properties?.sheetId || 0;
    const gridProperties = firstSheet?.properties?.gridProperties;
    const totalRowsInSheet = gridProperties?.rowCount || 1000;
    // 2. Lit les en-têtes (Ligne 1 complète de A1 à ZZ1)
    const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!1:1`,
    });
    const rawHeaders = (headerRes.data.values?.[0] || []);
    let totalCols = Math.max(rawHeaders.length, 1);
    const headers = [...rawHeaders];
    let clientCol = null;
    let phoneCol = null;
    let cityCol = null;
    let productCol = null;
    let amountCol = null;
    let quantityCol = null;
    let statusCol = null;
    let livreurCol = null;
    let updatedAtCol = null;
    let reminderCol = null;
    let uidCol = null;
    for (let i = 0; i < headers.length; i++) {
        const c = cleanHeader(headers[i]);
        if (!c)
            continue;
        // Téléphone
        if (phoneCol === null &&
            (c.includes("tel") ||
                c.includes("phone") ||
                c.includes("numero") ||
                c.includes("whatsapp") ||
                c.includes("contact") ||
                c.includes("mobile"))) {
            phoneCol = i;
            continue;
        }
        // Nom client
        if (clientCol === null &&
            (c.includes("client") ||
                c.includes("destinataire") ||
                c.includes("customer") ||
                c.includes("fullname") ||
                c.includes("prenom") ||
                (c.includes("nom") && !c.includes("produit") && !c.includes("article")))) {
            clientCol = i;
            continue;
        }
        // Ville / Adresse
        if (cityCol === null &&
            (c.includes("ville") ||
                c.includes("city") ||
                c.includes("adresse") ||
                c.includes("commune") ||
                c.includes("quartier") ||
                c.includes("zone") ||
                c.includes("destination") ||
                c.includes("lieu") ||
                c.includes("region"))) {
            cityCol = i;
            continue;
        }
        // Produit
        if (productCol === null &&
            (c.includes("produit") ||
                c.includes("product") ||
                c.includes("article") ||
                c.includes("item") ||
                c.includes("designation") ||
                c.includes("pack") ||
                c.includes("modele"))) {
            productCol = i;
            continue;
        }
        // Montant / Prix
        if (amountCol === null &&
            (c.includes("montant") ||
                c.includes("prix") ||
                c.includes("total") ||
                c.includes("amount") ||
                c.includes("cod") ||
                c.includes("valeur") ||
                c.includes("somme") ||
                c.includes("tarif"))) {
            amountCol = i;
            continue;
        }
        // Quantité
        if (quantityCol === null &&
            (c.includes("quantite") ||
                c.includes("qty") ||
                c.includes("qte") ||
                c.includes("nombre") ||
                c.includes("pieces"))) {
            quantityCol = i;
            continue;
        }
        // Statut
        if (statusCol === null &&
            (c.includes("statut") ||
                c.includes("status") ||
                c.includes("etat") ||
                c.includes("decision") ||
                c.includes("tracking"))) {
            statusCol = i;
            continue;
        }
        // Livreur
        if (livreurCol === null &&
            (c.includes("livreur") ||
                c.includes("driver") ||
                c.includes("coursier") ||
                c.includes("dispatch"))) {
            livreurCol = i;
            continue;
        }
        // Date modification
        if (updatedAtCol === null &&
            (c.includes("miseajour") ||
                c.includes("maj") ||
                c.includes("updated") ||
                c.includes("datemodif") ||
                c.includes("heuremodif"))) {
            updatedAtCol = i;
            continue;
        }
        // Rappel
        if (reminderCol === null &&
            (c.includes("rappel") || c.includes("reminder"))) {
            reminderCol = i;
            continue;
        }
        // UID / Ref
        if (uidCol === null &&
            (c.includes("uid") ||
                (c.includes("id") && !c.includes("ville")) ||
                c.includes("reference") ||
                c.includes("code"))) {
            uidCol = i;
            continue;
        }
    }
    // 3. AUTO-CRÉATION DES COLONNES SI ABSENTES (Rétro-synchronisation bidirectionnelle)
    let statusColumnCreated = false;
    if (statusCol === null) {
        statusCol = totalCols;
        livreurCol = totalCols + 1;
        updatedAtCol = totalCols + 2;
        const startLetter = colIndexToLetter(statusCol);
        const endLetter = colIndexToLetter(updatedAtCol);
        const newRange = `'${sheetName}'!${startLetter}1:${endLetter}1`;
        try {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: newRange,
                valueInputOption: "USER_ENTERED",
                requestBody: {
                    values: [["Statut WariTrack", "Livreur Assigné", "Dernière Mise à Jour"]],
                },
            });
            headers.push("Statut WariTrack", "Livreur Assigné", "Dernière Mise à Jour");
            totalCols += 3;
            statusColumnCreated = true;
            console.log(`detectAndEnsureSheetColumns: colonnes créées automatiquement sur ${spreadsheetId} (${newRange})`);
        }
        catch (err) {
            console.error(`detectAndEnsureSheetColumns: échec création colonnes sur ${spreadsheetId}`, err?.message || err);
        }
    }
    const structure = {
        spreadsheetTitle,
        sheetName,
        sheetId: sheetIdNum,
        totalColumns: totalCols,
        totalRows: totalRowsInSheet,
        clientColIndex: clientCol,
        phoneColIndex: phoneCol,
        cityColIndex: cityCol,
        productColIndex: productCol,
        amountColIndex: amountCol,
        quantityColIndex: quantityCol,
        statusColIndex: statusCol,
        livreurColIndex: livreurCol,
        updatedAtColIndex: updatedAtCol,
        reminderColIndex: reminderCol,
        uidColIndex: uidCol,
        statusColumnCreated,
        statusColLetter: colIndexToLetter(statusCol),
        headers,
    };
    // Met en cache pour 10 minutes
    STRUCTURE_CACHE.set(spreadsheetId, {
        structure,
        expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return structure;
}
// ============================================================================
// ÉCRITURE EN TEMPS RÉEL DU STATUT ET DU LIVREUR (RÉSOLUTION DYNAMIQUE)
// ============================================================================
const STATUS_TO_SHEET_LABEL = {
    nouveau: "À appeler",
    programme: "⏰ B - Programmé (Rappel)",
    en_cours: "🛵 B - Confirmé (En livraison)",
    livre: "💰 A - Livré & Encaissé",
    rejete: "✕ E - Rejeté / Annulé",
    injoignable: "⚠️ D - Injoignable",
    indisponible: "⏳ C - Je vous rappelle",
};
async function resolveRowNumberDynamic(sheets, spreadsheetId, sourceRowId, structure) {
    // Cas 1 : numéro de ligne direct "row:14"
    if (sourceRowId.startsWith("row:")) {
        const n = Number(sourceRowId.slice(4));
        return Number.isFinite(n) && n > 1 ? n : null;
    }
    // Cas 2 : identifiant unique stable "uid:XYZ"
    if (sourceRowId.startsWith("uid:")) {
        const uid = sourceRowId.slice(4).trim();
        if (!uid)
            return null;
        // Colonne UID détectée ou fallback colonne N (indice 13)
        const targetColIdx = structure.uidColIndex !== null ? structure.uidColIndex : 13;
        const colLetter = colIndexToLetter(targetColIdx);
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${structure.sheetName}'!${colLetter}:${colLetter}`,
            });
            const values = res.data.values ?? [];
            const idx = values.findIndex((r) => r[0] && String(r[0]).trim() === uid);
            if (idx !== -1)
                return idx + 1; // 1-based row index
        }
        catch (err) {
            console.warn(`resolveRowNumberDynamic: échec recherche uid sur col ${colLetter}`, err);
        }
        // Repli de secours : scan colonne A si non trouvé
        try {
            const resA = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${structure.sheetName}'!A:A`,
            });
            const valuesA = resA.data.values ?? [];
            const idxA = valuesA.findIndex((r) => r[0] && String(r[0]).trim() === uid);
            if (idxA !== -1)
                return idxA + 1;
        }
        catch { }
    }
    return null;
}
async function writeOrderStatusToSheet(sheetId, sourceRowId, statutCloseuse, reminderAt, livreurName) {
    try {
        const sheets = getSheetsClient();
        const structure = await detectAndEnsureSheetColumns(sheets, sheetId);
        if (structure.statusColIndex === null) {
            console.error(`writeOrderStatusToSheet: colonne de statut introuvable pour ${sheetId}`);
            return;
        }
        const row = await resolveRowNumberDynamic(sheets, sheetId, sourceRowId, structure);
        if (row === null) {
            console.error(`writeOrderStatusToSheet: ligne introuvable pour sourceRowId=${sourceRowId} sur ${sheetId}`);
            return;
        }
        const label = STATUS_TO_SHEET_LABEL[statutCloseuse] || String(statutCloseuse);
        const statusLetter = colIndexToLetter(structure.statusColIndex);
        const updateData = [
            {
                range: `'${structure.sheetName}'!${statusLetter}${row}`,
                values: [[label]],
            },
        ];
        // Mise à jour du nom du livreur si colonne existante ou créée
        if (structure.livreurColIndex !== null && livreurName) {
            const livreurLetter = colIndexToLetter(structure.livreurColIndex);
            updateData.push({
                range: `'${structure.sheetName}'!${livreurLetter}${row}`,
                values: [[livreurName]],
            });
        }
        // Horodatage de mise à jour en temps réel
        if (structure.updatedAtColIndex !== null) {
            const updatedLetter = colIndexToLetter(structure.updatedAtColIndex);
            const nowStr = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Lome" });
            updateData.push({
                range: `'${structure.sheetName}'!${updatedLetter}${row}`,
                values: [[nowStr]],
            });
        }
        // Date de rappel programmée
        if (structure.reminderColIndex !== null && reminderAt) {
            const reminderLetter = colIndexToLetter(structure.reminderColIndex);
            updateData.push({
                range: `'${structure.sheetName}'!${reminderLetter}${row}`,
                values: [[new Date(reminderAt).toLocaleString("fr-FR", { timeZone: "Africa/Lome" })]],
            });
        }
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                valueInputOption: "USER_ENTERED",
                data: updateData,
            },
        });
        console.log(`writeOrderStatusToSheet: synchronisé avec succès sur ${sheetId} (Ligne ${row} -> ${label})`);
    }
    catch (err) {
        console.error(`writeOrderStatusToSheet échec pour ${sheetId} :`, err?.message || err);
    }
}
