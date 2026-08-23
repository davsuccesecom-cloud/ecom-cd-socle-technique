# ============================================================================
# fix-vercel-json-encoding.ps1
# A lancer depuis la RACINE du projet (ecom-cd-socle-technique)
# ============================================================================

$rewriteConfig = '{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}'

# Encoding UTF8 SANS BOM — Set-Content -Encoding utf8 ajoute un BOM par
# defaut sous Windows PowerShell, ce que le parseur JSON de Vercel rejette
# ("Invalid vercel.json file provided"). On utilise .NET directement pour
# eviter ca.
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

$closeusePath = (Resolve-Path ".\apps\closeuse").Path + "\vercel.json"
$livreurPath = (Resolve-Path ".\apps\livreur").Path + "\vercel.json"

[System.IO.File]::WriteAllText($closeusePath, $rewriteConfig, $utf8NoBom)
[System.IO.File]::WriteAllText($livreurPath, $rewriteConfig, $utf8NoBom)

Write-Host "Fichiers reecrits sans BOM." -ForegroundColor Green

Write-Host ""
Write-Host "=== Verification (pas de caractere bizarre au debut) ===" -ForegroundColor Cyan
Get-Content $closeusePath -Raw
Write-Host "---"
Get-Content $livreurPath -Raw

Write-Host ""
Write-Host "=== Envoi sur Git ===" -ForegroundColor Cyan
git add apps/closeuse/vercel.json apps/livreur/vercel.json
git commit -m "Fix encodage UTF-8 BOM dans vercel.json"
git push

Write-Host ""
Write-Host "=== Termine ===" -ForegroundColor Green
Write-Host "Verifie sur Vercel que le nouveau build passe cette fois." -ForegroundColor Yellow
