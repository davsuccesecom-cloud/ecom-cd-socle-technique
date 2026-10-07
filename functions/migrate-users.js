/**
 * Script de migration : cree les utilisateurs Firebase Auth manquants
 * pour tous les employes existants dans Firestore.
 *
 * Usage : node migrate-users.js
 */

const admin = require("firebase-admin");
const serviceAccount = require("../apps/livreur/service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateUsers() {
  console.log("=== Debut de la migration ===\n");

  const workspacesSnap = await db.collection("workspaces").get();
  console.log(`${workspacesSnap.size} workspace(s) trouve(s)\n`);

  let totalUsers = 0;
  let created = 0;
  let alreadyExists = 0;
  let errors = 0;

  for (const wsDoc of workspacesSnap.docs) {
    const workspaceId = wsDoc.id;
    const usersSnap = await wsDoc.ref.collection("users").get();

    if (usersSnap.empty) continue;

    console.log(`Workspace ${workspaceId}: ${usersSnap.size} utilisateur(s)`);

    for (const userDoc of usersSnap.docs) {
      totalUsers++;
      const userData = userDoc.data();
      const userId = userDoc.id;

      try {
        // Verifier si l'utilisateur existe deja dans Firebase Auth
        try {
          await admin.auth().getUser(userId);
          alreadyExists++;
          console.log(`  ✓ ${userData.name} (${userId}) - existe deja`);
        } catch (authErr) {
          // L'utilisateur n'existe pas dans Firebase Auth, on le cree
          if (authErr.code === "auth/user-not-found") {
            await admin.auth().createUser({
              uid: userId,
              displayName: userData.name || undefined,
              phoneNumber: userData.phone || undefined,
            });
            created++;
            console.log(`  ✓ ${userData.name} (${userId}) - CREE`);
          } else {
            throw authErr;
          }
        }
      } catch (err) {
        errors++;
        console.error(`  ✗ ${userData.name} (${userId}) - ERREUR: ${err.message}`);
      }
    }
  }

  console.log("\n=== Migration terminee ===");
  console.log(`Total utilisateurs: ${totalUsers}`);
  console.log(`Crees: ${created}`);
  console.log(`Deja existants: ${alreadyExists}`);
  console.log(`Erreurs: ${errors}`);
}

migrateUsers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erreur fatale:", err);
    process.exit(1);
  });
