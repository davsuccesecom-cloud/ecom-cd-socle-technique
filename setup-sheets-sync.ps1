# ============================================================================
# setup-sheets-sync.ps1
# À lancer depuis la RACINE du projet (ecom-cd-socle-technique)
# ============================================================================

Write-Host "=== 1. Installation des dependances ===" -ForegroundColor Cyan
Set-Location .\functions
npm install libphonenumber-js googleapis --save
if ($LASTEXITCODE -ne 0) { Write-Host "npm install a echoue." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=== 2. Secrets Firebase ===" -ForegroundColor Cyan
Write-Host "Ces 2 etapes sont INTERACTIVES (Firebase va te demander de coller une valeur)." -ForegroundColor Yellow
Write-Host ""

$genSecret = Read-Host "Generer automatiquement une valeur aleatoire pour SHEET_WEBHOOK_SECRET ? (o/n)"
if ($genSecret -eq "o") {
    $secretValue = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    Write-Host "Valeur generee (note-la, tu en auras besoin cote Apps Script) :" -ForegroundColor Green
    Write-Host $secretValue -ForegroundColor Green
    Write-Host ""
    Write-Host "Colle cette meme valeur quand Firebase te la demande juste apres." -ForegroundColor Yellow
}
firebase functions:secrets:set SHEET_WEBHOOK_SECRET

Write-Host ""
Write-Host "Pour GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY : colle le JSON complet de la cle" -ForegroundColor Yellow
Write-Host "du compte de service (recuperee sur Google Cloud Console)." -ForegroundColor Yellow
firebase functions:secrets:set GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY

Write-Host ""
Write-Host "=== 3. Verification manuelle requise ===" -ForegroundColor Cyan
Write-Host "Avant de continuer, confirme que tu as bien :" -ForegroundColor Yellow
Write-Host "  - Cree functions/src/sheetsSync.ts (copie du fichier fourni)"
Write-Host "  - Colle le code de receiveSheetOrder.ts dans functions/src/index.ts"
Write-Host "  - Colle le bloc onOrderUpdated-ajout.ts A L'INTERIEUR de onOrderUpdated"
Write-Host "  - Ajoute les imports (defineSecret, writeOrderStatusToSheet, parsePhoneNumberFromString)"
Write-Host "  - Ajoute { secrets: [...] } aux options de receiveSheetOrder ET onOrderUpdated"
$ready = Read-Host "Tout est fait ? (o/n)"
if ($ready -ne "o") {
    Write-Host "Ok, relance ce script une fois pret." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "=== 4. Compilation TypeScript ===" -ForegroundColor Cyan
npx tsc
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur de compilation TypeScript. Corrige les erreurs ci-dessus avant de continuer." -ForegroundColor Red
    exit 1
}
Write-Host "Compilation OK." -ForegroundColor Green

Write-Host ""
Write-Host "=== 5. Verification que les fonctions sont bien dans le JS compile ===" -ForegroundColor Cyan
Select-String -Path .\lib\index.js -Pattern "receiveSheetOrder"
Select-String -Path .\lib\index.js -Pattern "writeOrderStatusToSheet"

Write-Host ""
Write-Host "=== 6. Deploiement ===" -ForegroundColor Cyan
Set-Location ..
firebase deploy --only functions

Write-Host ""
Write-Host "=== Termine ===" -ForegroundColor Green
Write-Host "Recupere l'URL de receiveSheetOrder dans les logs ci-dessus," -ForegroundColor Yellow
Write-Host "colle-la dans le script Apps Script (WEBHOOK_URL), avec le meme secret." -ForegroundColor Yellow
