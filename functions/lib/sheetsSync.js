"use strict";
// ============================================================================
// NOUVEAU FICHIER : functions/src/sheetsSync.ts
// ============================================================================
//
// Pré-requis (depuis functions/) :
//   npm install googleapis --save
//
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeOrderStatusToSheet = writeOrderStatusToSheet;
const googleapis_1 = require("googleapis");
// Mapping validé : le Sheet ne connaît que 5 valeurs business, alors que
// Firestore a 7 statuts techniques. "en_cours" (livraison immédiate,
// livreur déjà assigné) ET "programme" (rappel plus tard) s'affichent tous
// les deux "B - Programmé" côté Sheet — seule la colonne M (À rappeler)
// les distingue quand une closeuse doit rappeler à une heure précise.
const STATUS_TO_SHEET_LABEL = {
    en_cours: "B - Programmé",
    programme: "B - Programmé",
    livre: "A - Livré",
    rejete: "E - Rejeté",
    injoignable: "D - Injoignable",
    indisponible: "C - Je vous rappelle",
    // "nouveau" volontairement absent : jamais réécrit, le Sheet démarre
    // vide et le reste tant qu'aucune décision n'a été prise.
};
let sheetsClientPromise = null;
function getSheetsClient() {
    if (!sheetsClientPromise) {
        // GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY = contenu JSON complet de la clé de
        // service, stocké comme secret Firebase (voir instructions de
        // déploiement). Jamais commité en clair dans le repo.
        const rawKey = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY;
        if (!rawKey) {
            throw new Error("GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY manquant dans l'environnement.");
        }
        const credentials = JSON.parse(rawKey);
        const auth = new googleapis_1.google.auth.JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        sheetsClientPromise = googleapis_1.google.sheets({ version: "v4", auth });
    }
    return sheetsClientPromise;
}
/**
 * Écrit le statut (et, si fourni, la date de rappel) dans la ligne
 * correspondante du Sheet d'origine. Colonnes fixes selon le modèle
 * "MODEL TRACKING" validé : L = Statut, M = À rappeler.
 */
async function resolveRowNumber(sheetId, sourceRowId) {
    if (sourceRowId.startsWith("row:")) {
        const n = Number(sourceRowId.slice(4));
        return Number.isFinite(n) ? n : null;
    }
    if (sourceRowId.startsWith("uid:")) {
        const uid = sourceRowId.slice(4);
        const sheets = getSheetsClient();
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: "N:N",
        });
        const values = res.data.values ?? [];
        const idx = values.findIndex((r) => r[0] === uid);
        return idx === -1 ? null : idx + 1;
    }
    return null;
}
async function writeOrderStatusToSheet(sheetId, rowNumber, statutCloseuse, reminderAt) {
    const label = STATUS_TO_SHEET_LABEL[statutCloseuse];
    if (!label)
        return; // "nouveau" ou statut non mappé : on ne touche à rien
    const sheets = getSheetsClient();
    const row = await resolveRowNumber(sheetId, rowNumber);
    if (row === null) {
        console.error(`writeOrderStatusToSheet: impossible de resoudre la ligne pour sourceRowId=${rowNumber} sur ${sheetId}.`);
        return;
    }
    const data = [
        {
            range: `L${row}`,
            values: [[label]],
        },
    ];
    if (statutCloseuse === "programme" && reminderAt) {
        data.push({
            range: `M${row}`,
            values: [[new Date(reminderAt).toLocaleString("fr-FR")]],
        });
    }
    try {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: { valueInputOption: "USER_ENTERED", data },
        });
    }
    catch (err) {
        // On ne fait jamais échouer onOrderUpdated à cause d'un problème Sheet
        // (Sheet supprimé, permission retirée, etc.) — on log seulement.
        console.error(`writeOrderStatusToSheet échec pour ${sheetId} ligne ${row} :`, err);
    }
}
