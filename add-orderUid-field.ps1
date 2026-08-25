$path = "functions\src\index.ts"

if (-not (Test-Path $path)) {
    Write-Host "ERREUR: fichier introuvable : $path" -ForegroundColor Red
    exit 1
}

$content = Get-Content -Raw -Encoding UTF8 -Path $path

if ($content -match "orderUid\?: string;") {
    Write-Host "Le champ orderUid existe deja dans le type, rien a faire." -ForegroundColor Yellow
    exit 0
}

$pattern = "(?ms)(interface IncomingSheetOrder \{\s*\r?\n\s*sheetId: string;\s*\r?\n\s*rowNumber: number;\s*\r?\n)"

if ($content -notmatch $pattern) {
    Write-Host "ERREUR: pattern de l'interface IncomingSheetOrder introuvable." -ForegroundColor Red
    Write-Host "Aucun changement effectue." -ForegroundColor Yellow
    exit 1
}

$updated = [regex]::Replace($content, $pattern, "`$1  orderUid?: string;`r`n")

[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $updated, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "SUCCES: champ orderUid ajoute au type IncomingSheetOrder." -ForegroundColor Green
