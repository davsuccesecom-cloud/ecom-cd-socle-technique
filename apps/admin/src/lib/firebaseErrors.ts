/**
 * Traduction centralisée des erreurs Firebase (Auth, Firestore, Functions) et
 * réseau en messages français sobres, clairs et exploitables par l'utilisateur.
 * Aucun détail technique interne (nom de fournisseur, variable d'env, stack)
 * n'est jamais exposé.
 */

export interface FriendlyError {
  title: string;
  message: string;
  code?: string;
  recoverable: boolean;
  actionLabel?: string;
}

const CODE_MAP: Record<string, { title: string; message: string; recoverable: boolean; actionLabel?: string }> = {
  "permission-denied": {
    title: "Accès non autorisé",
    message: "Votre compte ne dispose pas des droits nécessaires pour effectuer cette opération.",
    recoverable: false,
  },
  "unauthenticated": {
    title: "Session expirée",
    message: "Veuillez vous reconnecter pour continuer.",
    recoverable: true,
    actionLabel: "Se reconnecter",
  },
  "unavailable": {
    title: "Connexion interrompue",
    message: "Le serveur est momentanément injoignable. Vérifiez votre connexion Internet.",
    recoverable: true,
    actionLabel: "Réessayer",
  },
  "deadline-exceeded": {
    title: "Délai d'attente dépassé",
    message: "L'opération a pris trop de temps. Votre connexion est peut-être ralentie.",
    recoverable: true,
    actionLabel: "Réessayer",
  },
  "resource-exhausted": {
    title: "Service très sollicité",
    message: "Trop de requêtes simultanées. Patientez quelques secondes avant de réessayer.",
    recoverable: true,
    actionLabel: "Réessayer",
  },
  "not-found": {
    title: "Élément introuvable",
    message: "Cet enregistrement n'existe plus ou a été déplacé.",
    recoverable: false,
  },
  "already-exists": {
    title: "Doublon détecté",
    message: "Un élément identique existe déjà dans votre espace.",
    recoverable: false,
  },
  "failed-precondition": {
    title: "Opération en préparation",
    message: "La base de données finalise une mise à jour. Réessayez dans un instant.",
    recoverable: true,
    actionLabel: "Réessayer",
  },
  "invalid-argument": {
    title: "Données invalides",
    message: "Veuillez vérifier les champs saisis avant de valider.",
    recoverable: false,
  },
  "auth/invalid-credential": {
    title: "Identifiants incorrects",
    message: "L'adresse e-mail ou le mot de passe est incorrect.",
    recoverable: false,
  },
  "auth/wrong-password": {
    title: "Mot de passe incorrect",
    message: "Vérifiez votre mot de passe et réessayez.",
    recoverable: false,
  },
  "auth/user-not-found": {
    title: "Compte introuvable",
    message: "Aucun compte ne correspond à cette adresse e-mail.",
    recoverable: false,
  },
  "auth/too-many-requests": {
    title: "Compte temporairement protégé",
    message: "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
    recoverable: true,
  },
  "auth/network-request-failed": {
    title: "Hors connexion",
    message: "Impossible de joindre le serveur d'authentification. Vérifiez votre réseau.",
    recoverable: true,
    actionLabel: "Réessayer",
  },
};

function extractCode(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const anyErr = err as { code?: unknown; message?: unknown };
  if (typeof anyErr.code === "string") {
    return anyErr.code.replace(/^functions\//, "").replace(/^firestore\//, "");
  }
  const msg = typeof anyErr.message === "string" ? anyErr.message : "";
  const match = msg.match(/\b(permission-denied|unauthenticated|unavailable|deadline-exceeded|resource-exhausted|not-found|already-exists|failed-precondition|invalid-argument|auth\/[a-z-]+)\b/i);
  return match ? match[1].toLowerCase() : "";
}

export function formatFirebaseError(err: unknown, fallbackMessage = "Une erreur inattendue est survenue."): FriendlyError {
  const code = extractCode(err);
  if (code && CODE_MAP[code]) {
    return { ...CODE_MAP[code], code };
  }

  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";

  if (/network|fetch|failed to fetch|load failed|offline/i.test(raw)) {
    return {
      title: "Connexion réseau indisponible",
      message: "Vérifiez votre connexion Internet et réessayez.",
      code: "network-error",
      recoverable: true,
      actionLabel: "Réessayer",
    };
  }

  if (/quota|429|rate.?limit|sollicit/i.test(raw)) {
    return {
      title: "Service très sollicité",
      message: "Patientez quelques secondes puis relancez votre demande.",
      code: "rate-limit",
      recoverable: true,
      actionLabel: "Réessayer",
    };
  }

  if (/variable d'environnement|api_key|groq|nvidia|gemini|openrouter|cloudflare|pollinations|http 40[13]|http 50\d/i.test(raw)) {
    return {
      title: "Service momentanément indisponible",
      message: "Le service traite votre demande. Veuillez réessayer dans quelques secondes.",
      code: "service-busy",
      recoverable: true,
      actionLabel: "Réessayer",
    };
  }

  const cleanMessage = raw && raw.length < 180 && !/at\s+\w+\s*\(|https?:\/\//i.test(raw) ? raw : fallbackMessage;
  return {
    title: "Opération interrompue",
    message: cleanMessage,
    code: code || undefined,
    recoverable: true,
    actionLabel: "Réessayer",
  };
}
