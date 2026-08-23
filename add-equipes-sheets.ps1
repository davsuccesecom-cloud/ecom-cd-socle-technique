# ============================================================================
# add-equipes-sheets.ps1
# A lancer depuis la RACINE du projet (ecom-cd-socle-technique)
# ============================================================================

$downloads = "$HOME\Downloads"

Write-Host "=== Copie du fichier ===" -ForegroundColor Cyan
Copy-Item "$downloads\EquipesSheets.tsx" ".\apps\admin\src\pages\EquipesSheets.tsx" -Force
if (Test-Path ".\apps\admin\src\pages\EquipesSheets.tsx") {
    Write-Host "EquipesSheets.tsx copie avec succes." -ForegroundColor Green
} else {
    Write-Host "Echec de la copie - verifie que le fichier existe dans $downloads" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Verification manuelle requise ===" -ForegroundColor Yellow
Write-Host "Confirme que tu as bien ajoute dans Dashboard.tsx :"
Write-Host '  import EquipesSheets from "./EquipesSheets";'
Write-Host '  ) : page === "teams" ? ('
Write-Host '    <EquipesSheets workspaceId={workspaceId} teams={teams} />'
Write-Host '  ) : ('
Write-Host ""
Write-Host "Et dans Sidebar.tsx que ENABLED_KEYS contient bien 'teams'."
$ready = Read-Host "Tout est fait ? (o/n)"
if ($ready -ne "o") {
    Write-Host "Ok, relance le script une fois pret." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "=== Compilation TypeScript ===" -ForegroundColor Cyan
Set-Location .\apps\admin
npx tsc --noEmit
if ($LASTEXITCODE -eq 0) {
    Write-Host "Compilation OK, aucune erreur." -ForegroundColor Green
} else {
    Write-Host "Erreurs de compilation ci-dessus - corrige avant de continuer." -ForegroundColor Red
    Set-Location ..\..
    exit 1
}

Write-Host ""
Write-Host "=== Lancement du serveur de dev ===" -ForegroundColor Cyan
npm run dev
