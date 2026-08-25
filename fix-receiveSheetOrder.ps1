$path = "functions\src\index.ts"

if (-not (Test-Path $path)) {
    Write-Host "ERREUR: fichier introuvable : $path" -ForegroundColor Red
    Write-Host "Assure-toi de lancer ce script depuis la racine de ecom-cd-socle-technique" -ForegroundColor Yellow
    exit 1
}

Copy-Item $path "$path.backup" -Force
Write-Host "Sauvegarde creee : $path.backup" -ForegroundColor Green

$content = Get-Content -Raw -Encoding UTF8 -Path $path

$newFunction = @'
export const receiveSheetOrder = onRequest({ secrets: [sheetWebhookSecret] }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const providedSecret = req.headers["x-webhook-secret"];
    if (providedSecret !== sheetWebhookSecret.value()) {
      console.error("receiveSheetOrder: secret invalide recu.");
      res.status(401).send("Unauthorized");
      return;
    }

    const body = req.body as IncomingSheetOrder;
    console.log("receiveSheetOrder: payload recu:", JSON.stringify(body));

    if (!body.sheetId || !body.rowNumber || !body.clientName || !body.phone) {
      console.error("receiveSheetOrder: champs manquants.", JSON.stringify(body));
      res.status(400).send("Champs requis manquants.");
      return;
    }

    const teamsSnap = await db
      .collectionGroup("teams")
      .where("sheetIds", "array-contains", body.sheetId)
      .limit(1)
      .get();

    if (teamsSnap.empty) {
      console.error(`receiveSheetOrder: aucune equipe trouvee pour sheetId=${body.sheetId}`);
      res.status(404).send("Aucune equipe connectee a ce Sheet.");
      return;
    }

    const teamDoc = teamsSnap.docs[0];
    const team = teamDoc.data();
    const workspaceId = team.workspaceId as string;
    const teamId = teamDoc.id;
    console.log(`receiveSheetOrder: equipe trouvee, workspaceId=${workspaceId}, teamId=${teamId}`);

    const existingSnap = await db
      .collection("workspaces")
      .doc(workspaceId)
      .collection("orders")
      .where("sheetId", "==", body.sheetId)
      .where("sourceRowId", "==", String(body.rowNumber))
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      console.log("receiveSheetOrder: commande deja existante, skip.");
      res.status(200).send({ skipped: true, reason: "already exists" });
      return;
    }

    const phoneParsed = parsePhoneNumberFromString(body.phone, team.defaultCountry as never);
    const clientPhoneFormatted = phoneParsed?.formatInternational() ?? body.phone;

    const orderRef = db.collection("workspaces").doc(workspaceId).collection("orders").doc();
    await orderRef.set({
      workspaceId,
      teamId,
      sheetId: body.sheetId,
      sourceRowId: String(body.rowNumber),
      clientName: body.clientName,
      clientPhoneRaw: body.phone,
      clientPhoneFormatted,
      product: body.product,
      amount: body.totalPrice,
      closeuseId: null,
      livreurId: null,
      statutCloseuse: "nouveau",
      statutLivreur: null,
      statutAdminOverride: null,
      callInProgress: null,
      timestamps: {
        received: Date.now(),
        assignedToCloseuse: null,
        assignedToLivreur: null,
        closeuseDecidedAt: null,
        livreurRespondedAt: null,
        delivered: null,
      },
      capiSent: false,
      purgeAt: null,
    });

    console.log(`receiveSheetOrder: commande creee avec succes, orderId=${orderRef.id}`);
    res.status(200).send({ success: true, orderId: orderRef.id });
  } catch (err) {
    console.error("receiveSheetOrder: erreur inattendue:", err);
    res.status(500).send("Erreur interne.");
  }
});
'@

$pattern = '(?ms)^export const receiveSheetOrder = onRequest\(\{ secrets: \[sheetWebhookSecret\] \}, async \(req, res\) => \{.*?^\}\);\s*$'

if ($content -notmatch $pattern) {
    Write-Host "ERREUR : bloc receiveSheetOrder introuvable dans le fichier." -ForegroundColor Red
    Write-Host "Aucun changement effectue. Le fichier original est intact." -ForegroundColor Yellow
    exit 1
}

$evaluator = { param($m) $newFunction }
$updated = [regex]::Replace($content, $pattern, $evaluator, 1)

$fullPath = (Resolve-Path $path).Path
[System.IO.File]::WriteAllText($fullPath, $updated, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "SUCCES: la fonction receiveSheetOrder a ete remplacee avec la version loggee." -ForegroundColor Green
Write-Host "Tu peux maintenant lancer: firebase deploy --only functions:receiveSheetOrder" -ForegroundColor Cyan
