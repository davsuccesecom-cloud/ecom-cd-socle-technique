/**
 * Script de diagnostic : liste les dernières commandes dans Firestore
 * pour comparer les collections "orders" et "commandes"
 *
 * Usage :
 *   node check-orders.js
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp({
  projectId: 'meta-capi-app',
  credential: applicationDefault(),
});

const db = getFirestore(app);

async function checkCollection(name) {
  console.log(`\n========== Collection: "${name}" ==========`);
  try {
    let snapshot;
    try {
      snapshot = await db
        .collection(name)
        .orderBy('timestamps.received', 'desc')
        .limit(5)
        .get();
    } catch (orderErr) {
      console.log(`(tri par "timestamps.received" impossible: ${orderErr.message})`);
      snapshot = null;
    }

    if (!snapshot || snapshot.empty) {
      const fallback = await db.collection(name).limit(5).get();
      if (fallback.empty) {
        console.log(`  -> Collection "${name}" totalement vide.`);
      } else {
        console.log(`  -> ${fallback.size} doc(s) trouvés (sans tri) :`);
        fallback.forEach((doc) => {
          console.log(`     [${doc.id}]`, JSON.stringify(doc.data(), null, 2));
        });
      }
      return;
    }

    console.log(`${snapshot.size} document(s) trouvé(s) :\n`);
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`--- ${doc.id} ---`);
      console.log(`  teamId: ${data.teamId}`);
      console.log(`  closeuseId: ${data.closeuseId}`);
      console.log(`  livreurId: ${data.livreurId}`);
      console.log(`  received: ${JSON.stringify(data.timestamps?.received)}`);
      console.log('');
    });
  } catch (err) {
    console.error(`Erreur en lisant "${name}":`, err.message);
  }
}

async function main() {
  await checkCollection('orders');
  await checkCollection('commandes');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
