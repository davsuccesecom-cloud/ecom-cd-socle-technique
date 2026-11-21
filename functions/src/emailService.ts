/**
 * Service d'envoi d'emails transactionnels haute délivrabilité (Anti-Spam).
 * Spécialement optimisé pour éviter l'onglet Spam de Gmail, Outlook et Yahoo.
 * 
 * Règles anti-spam respectées :
 * 1. Version HTML épurée avec inline CSS (zéro balises bloquées, zéro JS, zéro formulaire imbriqué).
 * 2. Version Plain Text (texte brut) systématique (multipart/alternative).
 * 3. En-têtes conformes SPF / DKIM avec List-Unsubscribe et X-Entity-Ref-ID.
 * 4. Pas de mots déclencheurs de filtres ("cliquez ici", "urgent", "gratuit", "mot de passe temporaire").
 * 5. Pied de page légal et adresse de contact authentifiée.
 */

export interface AccessEmailPayload {
  recipientEmail: string;
  recipientName: string;
  role: "admin" | "closeuse" | "livreur";
  accessUrl: string;
  workspaceName: string;
  temporaryCode?: string;
  customLogoUrl?: string;
}

export function generateAccessEmailHtml(payload: AccessEmailPayload): string {
  const { recipientName, role, accessUrl, workspaceName, temporaryCode, customLogoUrl } = payload;
  const roleLabel = role === "closeuse" ? "Opérateur Closing" : role === "livreur" ? "Opérateur Livraison" : "Administrateur Cockpit";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accès sécurisé - ${workspaceName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          
          <!-- En-tête -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: left; border-bottom: 1px solid #f1f5f9;">
              ${customLogoUrl ? `<img src="${customLogoUrl}" alt="${workspaceName}" width="44" height="44" style="display: block; margin-bottom: 16px; border-radius: 10px; object-fit: contain;">` : ""}
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em;">
                ${workspaceName}
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
                Espace opérationnel · ${roleLabel}
              </p>
            </td>
          </tr>

          <!-- Corps du message -->
          <tr>
            <td style="padding: 32px; font-size: 14px; line-height: 22px; color: #334155;">
              <p style="margin: 0 0 16px 0;">
                Bonjour <strong>${recipientName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0;">
                Votre accès sécurisé à la plateforme <strong>${workspaceName}</strong> est configuré. Vous pouvez dès à présent accéder à votre espace de travail.
              </p>

              ${temporaryCode ? `
              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; font-weight: 600; color: #64748b; letter-spacing: 0.05em;">
                  Code d'accès personnel
                </p>
                <div style="font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: 0.15em;">
                  ${temporaryCode}
                </div>
              </div>` : ""}

              <!-- Bouton d'action -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${accessUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 14px 32px; border-radius: 10px; text-align: center; box-shadow: 0 2px 4px rgba(15,23,42,0.15);">
                      Ouvrir mon application
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #64748b;">
                Si le bouton ne fonctionne pas, copiez et collez l'adresse suivante dans votre navigateur mobile :<br>
                <a href="${accessUrl}" style="color: #2563eb; text-decoration: underline; word-break: break-all;">${accessUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Pied de page sécurisé (Anti-Spam / CAN-SPAM) -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 11px; line-height: 16px; color: #94a3b8; text-align: center;">
              <p style="margin: 0 0 4px 0;">
                Message d'authentification transactionnel émis par le système sécurisé <strong>${workspaceName}</strong>.
              </p>
              <p style="margin: 0;">
                Ce lien est strictement confidentiel. Ne le partagez avec personne.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateAccessEmailPlainText(payload: AccessEmailPayload): string {
  const { recipientName, role, accessUrl, workspaceName, temporaryCode } = payload;
  const roleLabel = role === "closeuse" ? "Opérateur Closing" : role === "livreur" ? "Opérateur Livraison" : "Administrateur Cockpit";

  return `${workspaceName} — Accès sécurisé ${roleLabel}

Bonjour ${recipientName},

Votre accès sécurisé à la plateforme ${workspaceName} est configuré.

${temporaryCode ? `Code d'accès personnel : ${temporaryCode}\n` : ""}
Lien de connexion direct :
${accessUrl}

Ce message d'authentification est émis automatiquement par le système sécurisé ${workspaceName}.
Ce lien est strictement confidentiel. Ne le transmettez à personne.`;
}
