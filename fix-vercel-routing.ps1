# ============================================================================
# fix-vercel-routing.ps1
# A lancer depuis la RACINE du projet (ecom-cd-socle-technique)
# ============================================================================

$rewriteConfig = @'
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
'@

Write-Host "=== Creation de apps/closeuse/vercel.json ===" -ForegroundColor Cyan
Set-Content -Path ".\apps\closeuse\vercel.json" -Value $rewriteConfig -Encoding utf8
Write-Host "OK" -ForegroundColor Green

Write-Host "=== Creation de apps/livreur/vercel.json ===" -ForegroundColor Cyan
Set-Content -Path ".\apps\livreur\vercel.json" -Value $rewriteConfig -Encoding utf8
Write-Host "OK" -ForegroundColor Green

Write-Host ""
Write-Host "=== Verification ===" -ForegroundColor Cyan
Get-Content ".\apps\closeuse\vercel.json"
Write-Host "---"
Get-Content ".\apps\livreur\vercel.json"

Write-Host ""
Write-Host "=== Envoi sur Git pour redeployer Vercel ===" -ForegroundColor Cyan
git add apps/closeuse/vercel.json apps/livreur/vercel.json
git commit -m "Fix routing SPA sur Vercel (closeuse + livreur)"
git push

Write-Host ""
Write-Host "=== Termine ===" -ForegroundColor Green
Write-Host "Va sur le dashboard Vercel, attends la fin du redeploiement (~1-2 min)," -ForegroundColor Yellow
Write-Host "puis reteste le lien copie depuis Utilisateurs & Acces." -ForegroundColor Yellow
