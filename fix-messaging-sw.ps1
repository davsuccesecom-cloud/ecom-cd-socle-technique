$apps = @("admin", "closeuse", "livreur")

$firebaseConfig = @{
    apiKey            = "AIzaSyBaH9nab7GenUzF_tHuDwQOPhAUGQH-oWU"
    authDomain        = "meta-capi-app.firebaseapp.com"
    projectId         = "meta-capi-app"
    storageBucket     = "meta-capi-app.firebasestorage.app"
    messagingSenderId = "972779076968"
    appId             = "1:972779076968:web:206a988757da4219a82add"
}

$anyFailed = $false

foreach ($app in $apps) {
    $path = "apps\$app\public\firebase-messaging-sw.js"

    if (-not (Test-Path $path)) {
        Write-Host "ATTENTION: fichier introuvable, ignore : $path" -ForegroundColor Yellow
        continue
    }

    Copy-Item $path "$path.backup" -Force

    $content = Get-Content -Raw -Encoding UTF8 -Path $path

    $newConfigBlock = @"
firebase.initializeApp({
  apiKey: "$($firebaseConfig.apiKey)",
  authDomain: "$($firebaseConfig.authDomain)",
  projectId: "$($firebaseConfig.projectId)",
  storageBucket: "$($firebaseConfig.storageBucket)",
  messagingSenderId: "$($firebaseConfig.messagingSenderId)",
  appId: "$($firebaseConfig.appId)",
});
"@

    $pattern = '(?ms)firebase\.initializeApp\(\{.*?\}\);'

    if ($content -notmatch $pattern) {
        Write-Host "ERREUR: bloc firebase.initializeApp introuvable dans $path" -ForegroundColor Red
        $anyFailed = $true
        continue
    }

    $updated = [regex]::Replace($content, $pattern, { param($m) $newConfigBlock }, 1)

    $fullPath = (Resolve-Path $path).Path
    [System.IO.File]::WriteAllText($fullPath, $updated, (New-Object System.Text.UTF8Encoding($false)))

    Write-Host "OK: $path mis a jour avec les vraies valeurs Firebase." -ForegroundColor Green
}

if ($anyFailed) {
    Write-Host "`nATTENTION: au moins un fichier n'a pas pu etre corrige automatiquement. Verifie manuellement." -ForegroundColor Yellow
} else {
    Write-Host "`nSUCCES: tous les fichiers firebase-messaging-sw.js trouves ont ete corriges." -ForegroundColor Green
    Write-Host "Prochaine etape : commit + push pour redeployer sur Vercel (ce sont des fichiers statiques, pas des Cloud Functions)." -ForegroundColor Cyan
}
