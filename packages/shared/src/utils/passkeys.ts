/**
 * Helper client WebAuthn / FIDO2 pour les Passkeys biométriques (Touch ID, Face ID, Windows Hello, Clés FIDO2)
 * Prépare la sécurisation des comptes administrateurs et des opérations financières (APIs CinetPay).
 */

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function isPasskeySupported(): boolean {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return false;
  }
  return true;
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  try {
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch {
    return false;
  }
  return false;
}

export interface RegisterPasskeyOptions {
  challenge: string;
  userId: string;
  userEmail: string;
  userName?: string;
  rpName?: string;
  rpId?: string;
}

export interface AuthenticatePasskeyOptions {
  challenge: string;
  allowCredentialIds?: string[];
  rpId?: string;
}

/**
 * Enregistre une nouvelle Passkey (Touch ID, Face ID, Windows Hello, Clé de sécurité FIDO2)
 */
export async function registerPasskey(options: RegisterPasskeyOptions) {
  if (!isPasskeySupported()) {
    throw new Error("Les Passkeys ne sont pas prises en charge sur ce navigateur.");
  }

  const challengeBuffer = base64UrlToBuffer(options.challenge);
  const userIdBuffer = new TextEncoder().encode(options.userId);

  const creationOptions: CredentialCreationOptions = {
    publicKey: {
      challenge: challengeBuffer,
      rp: {
        name: options.rpName || "WariTrack & Azify Cloud",
        id: options.rpId || window.location.hostname,
      },
      user: {
        id: userIdBuffer,
        name: options.userEmail,
        displayName: options.userName || options.userEmail.split("@")[0] || "Administrateur",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },  // ES256 (P-256)
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform", // Touch ID / Face ID / Windows Hello intégré
        userVerification: "preferred",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  };

  const credential = (await navigator.credentials.create(creationOptions)) as PublicKeyCredential | null;
  if (!credential) {
    throw new Error("Création de la Passkey annulée par l'utilisateur.");
  }

  const rawResponse = credential.response as AuthenticatorAttestationResponse;

  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(rawResponse.clientDataJSON),
      attestationObject: bufferToBase64Url(rawResponse.attestationObject),
    },
  };
}

/**
 * Authentifie ou valide un challenge via Passkey (Vérification Step-Up pour paiements CinetPay)
 */
export async function authenticatePasskey(options: AuthenticatePasskeyOptions) {
  if (!isPasskeySupported()) {
    throw new Error("Les Passkeys ne sont pas prises en charge sur ce navigateur.");
  }

  const challengeBuffer = base64UrlToBuffer(options.challenge);
  const allowCredentials = (options.allowCredentialIds || []).map((id) => ({
    id: base64UrlToBuffer(id),
    type: "public-key" as const,
  }));

  const requestOptions: CredentialRequestOptions = {
    publicKey: {
      challenge: challengeBuffer,
      rpId: options.rpId || window.location.hostname,
      userVerification: "preferred",
      timeout: 60000,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    },
  };

  const assertion = (await navigator.credentials.get(requestOptions)) as PublicKeyCredential | null;
  if (!assertion) {
    throw new Error("Authentification Passkey annulée par l'utilisateur.");
  }

  const assertionResponse = assertion.response as AuthenticatorAssertionResponse;

  return {
    id: assertion.id,
    rawId: bufferToBase64Url(assertion.rawId),
    type: assertion.type,
    response: {
      clientDataJSON: bufferToBase64Url(assertionResponse.clientDataJSON),
      authenticatorData: bufferToBase64Url(assertionResponse.authenticatorData),
      signature: bufferToBase64Url(assertionResponse.signature),
      userHandle: assertionResponse.userHandle ? bufferToBase64Url(assertionResponse.userHandle) : null,
    },
  };
}
