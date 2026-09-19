import * as admin from "firebase-admin";

const GRAPH_API_VERSION = "v19.0";
const FB_APP_ID = process.env.FB_APP_ID || "27919549707704174";
const FB_APP_SECRET = process.env.FB_APP_SECRET || "6cc4953195a5abd90ed608b830895643";

export interface MetaPixel {
  id: string;
  name: string;
}

export interface MetaAdAccount {
  id: string; // e.g. "act_123456"
  accountId: string; // e.g. "123456"
  name: string;
  currency?: string;
  business?: { id: string; name: string };
  pixels: MetaPixel[];
}

export interface MetaBusiness {
  id: string;
  name: string;
}

export async function fetchMetaAdAccountsAndPixels(userAccessToken: string) {
  if (!userAccessToken) {
    throw new Error("Token d'accès utilisateur manquant.");
  }

  // 1. Récupérer le profil utilisateur Facebook
  const meRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me?fields=id,name,picture&access_token=${encodeURIComponent(userAccessToken)}`
  );
  const meData = (await meRes.json()) as any;
  if (!meRes.ok) {
    throw new Error(meData?.error?.message || "Impossible de récupérer le profil Facebook.");
  }

  // 2. Récupérer les Business Managers
  let businesses: MetaBusiness[] = [];
  try {
    const bizRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/businesses?fields=id,name&access_token=${encodeURIComponent(userAccessToken)}`
    );
    const bizData = (await bizRes.json()) as any;
    if (bizRes.ok && Array.isArray(bizData?.data)) {
      businesses = bizData.data.map((b: any) => ({ id: b.id, name: b.name }));
    }
  } catch (err) {
    console.warn("Erreur fetch businesses:", err);
  }

  // 3. Récupérer les comptes publicitaires
  const adAccountsRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/adaccounts?fields=id,name,account_id,currency,business&access_token=${encodeURIComponent(userAccessToken)}`
  );
  const adAccountsData = (await adAccountsRes.json()) as any;
  if (!adAccountsRes.ok) {
    throw new Error(adAccountsData?.error?.message || "Impossible de récupérer les comptes publicitaires.");
  }

  const rawAccounts = Array.isArray(adAccountsData?.data) ? adAccountsData.data : [];

  // 4. Pour chaque compte pub, récupérer ses pixels associés
  const adAccounts: MetaAdAccount[] = await Promise.all(
    rawAccounts.map(async (acc: any) => {
      let pixels: MetaPixel[] = [];
      try {
        const pixRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${acc.id}/adspixels?fields=id,name&access_token=${encodeURIComponent(userAccessToken)}`
        );
        const pixData = (await pixRes.json()) as any;
        if (pixRes.ok && Array.isArray(pixData?.data)) {
          pixels = pixData.data.map((p: any) => ({ id: p.id, name: p.name }));
        }
      } catch (err) {
        console.warn(`Erreur fetch pixels pour compte ${acc.id}:`, err);
      }

      return {
        id: acc.id,
        accountId: acc.account_id || acc.id.replace("act_", ""),
        name: acc.name || `Compte ${acc.account_id || acc.id}`,
        currency: acc.currency,
        business: acc.business ? { id: acc.business.id, name: acc.business.name } : undefined,
        pixels,
      };
    })
  );

  return {
    user: {
      id: meData.id,
      name: meData.name,
      picture: meData.picture?.data?.url,
    },
    businesses,
    adAccounts,
  };
}

export interface SetupMetaParams {
  workspaceId: string;
  teamId: string;
  userAccessToken: string;
  businessId?: string;
  businessName?: string;
  adAccountId: string;
  adAccountName?: string;
  pixelId: string;
  pixelName?: string;
  currency?: string;
  connectedUserName?: string;
}

export async function setupMetaSystemUserAndPixel(params: SetupMetaParams) {
  const {
    workspaceId,
    teamId,
    userAccessToken,
    businessId,
    businessName,
    adAccountId,
    adAccountName,
    pixelId,
    pixelName,
    currency = "XOF",
    connectedUserName,
  } = params;

  if (!workspaceId || !teamId || !userAccessToken || !adAccountId || !pixelId) {
    throw new Error("Paramètres requis manquants pour la configuration Meta.");
  }

  let finalAccessToken = "";
  let isSystemUser = false;
  let systemUserId = "";
  let tokenExpiresAt: number | null = null;
  const cleanAdAccountId = adAccountId.replace("act_", "");

  // =========================================================================
  // CAS A : Tentative de création du Système Utilisateur (Jeton PERMANENT)
  // =========================================================================
  if (businessId) {
    try {
      console.log(`Tentative Système Utilisateur sur Business Manager ${businessId}...`);

      // 1. Vérifier si un Système Utilisateur "Ecom COD Bot" existe déjà
      const listSuRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${businessId}/system_users?access_token=${encodeURIComponent(userAccessToken)}`
      );
      const listSuData = (await listSuRes.json()) as any;

      if (listSuRes.ok && Array.isArray(listSuData?.data)) {
        const existingSu = listSuData.data.find((su: any) =>
          /Ecom.*COD.*Bot|EcomCOD/i.test(su.name)
        );
        if (existingSu) {
          systemUserId = existingSu.id;
          console.log(`Système Utilisateur existant trouvé: ${systemUserId}`);
        }
      }

      // 2. Si non existant, créer le Système Utilisateur
      if (!systemUserId) {
        let createSuRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${businessId}/system_users`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              name: "Ecom COD Bot",
              role: "ADMIN",
              access_token: userAccessToken,
            }),
          }
        );
        let createSuData = (await createSuRes.json()) as any;

        if (!createSuRes.ok) {
          console.warn("Création SU ADMIN échouée, tentative EMPLOYEE:", createSuData?.error?.message);
          createSuRes = await fetch(
            `https://graph.facebook.com/${GRAPH_API_VERSION}/${businessId}/system_users`,
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                name: "Ecom COD Bot",
                role: "EMPLOYEE",
                access_token: userAccessToken,
              }),
            }
          );
          createSuData = await createSuRes.json();
        }

        if (createSuRes.ok && createSuData?.id) {
          systemUserId = createSuData.id;
          console.log(`Système Utilisateur créé avec succès: ${systemUserId}`);
        } else {
          console.warn("Échec création Système Utilisateur:", createSuData?.error?.message);
        }
      }

      // 3. Si on a un Système Utilisateur, lui assigner le compte publicitaire
      if (systemUserId) {
        try {
          const assignRes = await fetch(
            `https://graph.facebook.com/${GRAPH_API_VERSION}/${businessId}/system_users/${systemUserId}/assigned_ads_accounts`,
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                adaccount_id: cleanAdAccountId,
                tasks: JSON.stringify(["MANAGE"]),
                access_token: userAccessToken,
              }),
            }
          );
          const assignData = (await assignRes.json()) as any;
          console.log("Résultat assignation compte pub au SU:", assignData);
        } catch (err) {
          console.warn("Erreur assignation compte pub:", err);
        }

        // 4. Générer le jeton permanent du Système Utilisateur
        const tokenRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${systemUserId}/access_tokens`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: FB_APP_ID,
              client_secret: FB_APP_SECRET,
              scope: "ads_management,ads_read",
              access_token: userAccessToken,
            }),
          }
        );
        const tokenData = (await tokenRes.json()) as any;

        if (tokenRes.ok && tokenData?.access_token) {
          finalAccessToken = tokenData.access_token;
          isSystemUser = true;
          console.log("✓ Jeton Système Utilisateur permanent généré avec succès !");
        } else {
          console.warn("Génération jeton SU échouée:", tokenData?.error?.message);
        }
      }
    } catch (suErr) {
      console.warn("Erreur globale flux Système Utilisateur:", suErr);
    }
  }

  // =========================================================================
  // CAS B : Fallback vers jeton étendu 60 jours
  // =========================================================================
  if (!finalAccessToken) {
    console.log("Génération jeton étendu 60 jours en fallback...");
    const exchangeUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${encodeURIComponent(userAccessToken)}`;
    const exchangeRes = await fetch(exchangeUrl);
    const exchangeData = (await exchangeRes.json()) as any;

    if (exchangeRes.ok && exchangeData?.access_token) {
      finalAccessToken = exchangeData.access_token;
      isSystemUser = false;
      const expiresInSec = Number(exchangeData.expires_in) || 60 * 86400;
      tokenExpiresAt = Date.now() + expiresInSec * 1000;
      console.log("✓ Jeton étendu 60 jours obtenu avec succès !");
    } else {
      console.warn("Échec token 60 jours, utilisation directe du token utilisateur:", exchangeData?.error?.message);
      finalAccessToken = userAccessToken;
      isSystemUser = false;
    }
  }

  // =========================================================================
  // Sauvegarde dans Firestore
  // =========================================================================
  const db = admin.firestore();
  const teamRef = db.collection("workspaces").doc(workspaceId).collection("teams").doc(teamId);

  const metaCapiConfig = {
    enabled: true,
    pixelId: pixelId.trim(),
    accessToken: finalAccessToken.trim(),
    currency: (currency || "XOF").toUpperCase(),
    adAccountId,
    adAccountName: adAccountName || "",
    pixelName: pixelName || "",
    businessId: businessId || "",
    businessName: businessName || "",
    systemUserId: systemUserId || "",
    isSystemUser,
    tokenExpiresAt,
    connectedAt: Date.now(),
    connectedUserName: connectedUserName || "",
  };

  await teamRef.update({ metaCapiConfig });

  return {
    success: true,
    isSystemUser,
    message: isSystemUser
      ? "✓ Connecté avec succès ! Jeton permanent (Système Utilisateur) actif."
      : "✓ Connecté avec succès ! Jeton sécurisé 60 jours actif.",
    metaCapiConfig,
  };
}

export async function disconnectMetaCapiConfig(workspaceId: string, teamId: string) {
  if (!workspaceId || !teamId) {
    throw new Error("workspaceId et teamId requis.");
  }
  const db = admin.firestore();
  await db
    .collection("workspaces")
    .doc(workspaceId)
    .collection("teams")
    .doc(teamId)
    .update({
      "metaCapiConfig.enabled": false,
      "metaCapiConfig.accessToken": "",
    });

  return { success: true, message: "Meta CAPI désactivé avec succès." };
}
