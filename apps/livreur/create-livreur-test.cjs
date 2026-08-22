// create-livreur-test.js
// Usage : node create-livreur-test.js
// Nécessite : npm install firebase-admin bcryptjs
// Nécessite : le fichier JSON du service account (le même que celui du script Python de sync)

const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");

// ⚠️ Remplace par le chemin réel vers ton fichier service account JSON
const serviceAccount = require("./service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  const workspaceId = "ws-test";
  const teamId = "team-test";
  const userId = "livreur-test";
  const linkId = "link-livreur-test";
  const plainPassword = "test1234";

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  // 1. Utilisateur livreur
  await db
    .collection("workspaces")
    .doc(workspaceId)
    .collection("users")
    .doc(userId)
    .set({
      workspaceId,
      teamId,
      role: "livreur",
      name: "Test Livreur",
      phone: "+22890000000",
      fcmTokens: [],
      status: "active",
    });

  // 2. Access link livreur
  await db
    .collection("workspaces")
    .doc(workspaceId)
    .collection("accessLinks")
    .doc(linkId)
    .set({
      id: linkId,
      workspaceId,
      userId,
      passwordHash,
      disabledAt: null,
      activeSessions: [],
    });

  console.log("✅ Données de test livreur créées.");
  console.log("URL de test :", `localhost:5174/l/${linkId}`);
  console.log("Mot de passe :", plainPassword);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Erreur :", err);
    process.exit(1);
  });
