const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

async function main() {
  const workspaceId = process.argv[2];
  const teamId = process.argv[3];
  if (!workspaceId || !teamId) {
    console.error("Usage: node countOrders.js <workspaceId> <teamId>");
    process.exit(1);
  }

  const ordersRef = db.collection("workspaces").doc(workspaceId).collection("orders");

  const allByTeam = await ordersRef.where("teamId", "==", teamId).get();
  console.log(`Total commandes (teamId seulement, sans orderBy) : ${allByTeam.size}`);

  const withOrderBy = await ordersRef.where("teamId", "==", teamId).orderBy("timestamps.received", "desc").get();
  console.log(`Total commandes (teamId + orderBy timestamps.received) : ${withOrderBy.size}`);

  const missing = allByTeam.size - withOrderBy.size;
  console.log(`Difference (commandes invisibles dans l'app a cause du champ timestamps mal forme) : ${missing}`);

  if (missing > 0) {
    console.log("\nExemples de commandes problematiques :");
    const withOrderByIds = new Set(withOrderBy.docs.map((d) => d.id));
    let shown = 0;
    for (const doc of allByTeam.docs) {
      if (!withOrderByIds.has(doc.id) && shown < 10) {
        const data = doc.data();
        console.log(`- ${doc.id} : timestamps =`, JSON.stringify(data.timestamps), "clientName =", data.clientName);
        shown++;
      }
    }
  }
}

main().catch(console.error);
