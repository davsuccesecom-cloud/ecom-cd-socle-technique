import { useState } from "react";
import { ShieldCheck, Lock, FileText, Trash2, X, CheckCircle2, Globe, Server } from "lucide-react";

export type LegalTab = "privacy" | "terms" | "deletion" | "security";

interface LegalPrivacyModalProps {
  initialTab?: LegalTab;
  standalone?: boolean;
  onClose?: () => void;
}

export default function LegalPrivacyModal({
  initialTab = "privacy",
  standalone = false,
  onClose,
}: LegalPrivacyModalProps) {
  const [tab, setTab] = useState<LegalTab>(initialTab);

  const tabs: { id: LegalTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "privacy", label: "Politique de Confidentialité", icon: ShieldCheck },
    { id: "terms", label: "Conditions d'Utilisation (CGU)", icon: FileText },
    { id: "deletion", label: "Suppression des Données (Meta / RGPD)", icon: Trash2 },
    { id: "security", label: "Architecture & Sécurité COD", icon: Lock },
  ];

  const content = (
    <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-white/15 bg-[#0b101d] text-slate-200 shadow-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0f172a] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand/40 bg-brand/15 text-brand">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Centre de Confidentialité, Conformité & Sécurité — Ecom COD
            </h2>
            <p className="text-xs text-slate-400">
              Conformité RGPD, Meta Conversions API (CAPI), Shopify Webhooks & Protection des Données
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
            <span>Fermer</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-white/10 bg-[#090d16] px-6 py-2.5">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                active
                  ? "bg-brand text-white shadow-md shadow-brand/25"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="max-h-[72vh] space-y-6 overflow-y-auto p-6 text-xs leading-relaxed text-slate-300">
        {tab === "privacy" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-200">
              <p className="font-semibold">
                Engagement de Confidentialité Stricte (Zéro Revente de Données)
              </p>
              <p className="mt-1 text-emerald-300/90">
                Chaque espace de travail (Workspace) et chaque équipe pays sur Ecom COD sont strictement cloisonnés. Vos fichiers clients, numéros de téléphone, chiffres d'affaires et Pixels publicitaires vous appartiennent exclusivement.
              </p>
            </div>

            <section className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">1. Données collectées et finalités opérationnelles</h3>
              <p>
                Dans le cadre de l'exécution du système de gestion e-commerce Cash-On-Delivery (COD), Ecom COD traite uniquement les données nécessaires à vos opérations :
              </p>
              <ul className="list-disc space-y-1 pl-5 text-slate-300">
                <li>
                  <strong>Données de commandes (Shopify / Google Sheets)</strong> : Nom du destinataire, numéro de téléphone, ville/quartier de livraison, produit commandé, montant COD et horodatage de traitement.
                </li>
                <li>
                  <strong>Données d'authentification des opérateurs</strong> : Adresse email de la Direction (connexion par lien magique sans mot de passe) et identifiants internes des Closeuses et Livreurs.
                </li>
                <li>
                  <strong>Données d'intégration Meta Conversions API (CAPI)</strong> : Identifiant du compte publicitaire, ID du Pixel Meta et jeton d'accès système chiffré côté serveur pour l'envoi exclusif des événements <code>Purchase</code> après livraison réelle.
                </li>
              </ul>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">2. Hachage SHA-256 & Protection Meta CAPI</h3>
              <p>
                Conformément aux standards de confidentialité de Meta Platforms, Inc., toutes les données clients utilisées pour le rapprochement publicitaire (numéro de téléphone normalisé E.164, pays, ville) sont <strong>systématiquement hachées en SHA-256</strong> avant tout appel serveur vers l'API Graph de Meta. De plus, les commandes doublons (même numéro de téléphone) sont automatiquement isolées sous le statut <em>« Accès libre site »</em> afin d'éviter toute pollution ou surfacturation du Pixel.
              </p>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">3. Cloisonnement Multi-Marchés & Conservation</h3>
              <p>
                Les données sont hébergées sur l'infrastructure sécurisée Google Cloud / Firebase (Firestore) protégée par des règles de sécurité strictes (<code>firestore.rules</code>) vérifiant l'identifiant d'espace de travail (<code>workspaceId</code>) et le rôle de chaque utilisateur. Aucune équipe ne peut lire les commandes d'un autre espace.
              </p>
            </section>
          </div>
        )}

        {tab === "terms" && (
          <div className="space-y-4">
            <section className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">1. Objet de la plateforme Ecom COD</h3>
              <p>
                Ecom COD fournit un système d'exploitation complet dédié au e-commerce avec paiement à la livraison (Cash-On-Delivery) en Afrique et à l'international, comprenant trois applications synchronisées : <strong>Poste de Pilotage Admin</strong>, <strong>App Closeuse</strong> et <strong>App Livreur</strong>.
              </p>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">2. Responsabilité de l'Administrateur et Contrôle Caisse</h3>
              <p>
                L'Administrateur du Workspace est seul décisionnaire de la création des comptes opérateurs (closeuses, livreurs, gérants), du paramétrage des barèmes de commissions, et de la validation des versements en fin de journée dans le module <strong>Caisse & Versements Livreurs</strong> (y compris les déductions pour imprévus de livraison accompagnées d'une note justificative).
              </p>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">3. Utilisation conforme de WhatsApp et des exports téléphoniques</h3>
              <p>
                Les fonctionnalités d'appel direct, de messagerie WhatsApp pré-remplie et d'exportation CSV des numéros sur une période sont destinées au suivi de commande, à la confirmation de livraison et au Service Après-Vente (SAV) auprès des clients ayant passé commande sur vos boutiques.
              </p>
            </section>
          </div>
        )}

        {tab === "deletion" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-blue-200">
              <p className="font-semibold">
                Protocole Officiel de Révocation & Suppression des Données (Meta / Google / RGPD)
              </p>
              <p className="mt-1 text-blue-300/90">
                Vous gardez un contrôle total et immédiat sur vos connexions tierces (Facebook Login, Meta CAPI, Shopify, Google Sheets) et vos données stockées.
              </p>
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-white">
                Procédure 1 : Déconnexion instantanée du Pixel & Jeton Meta CAPI
              </h3>
              <ol className="list-decimal space-y-1.5 pl-5">
                <li>Ouvrez votre application <strong>Admin Ecom COD</strong> et accédez à <strong>Paramètres & Flux &gt; Meta Conversions API</strong>.</li>
                <li>Cliquez sur le bouton rouge <strong>« Désactiver »</strong> puis confirmez la révocation.</li>
                <li>Le jeton d'accès Meta (<code>accessToken</code>) et l'identifiant du Pixel sont immédiatement purgés de la base de données Firestore pour ce marché.</li>
              </ol>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-white">
                Procédure 2 : Révocation depuis votre compte Facebook
              </h3>
              <p>
                Vous pouvez également retirer l'autorisation de l'application à tout moment depuis votre compte Facebook : allez dans <em>Paramètres et confidentialité &gt; Paramètres &gt; Intégrations professionnelles</em>, sélectionnez l'application et cliquez sur <strong>Supprimer</strong>.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold text-white">
                Procédure 3 : Suppression complète d'un compte opérateur ou d'un Workspace
              </h3>
              <p>
                Depuis <strong>Utilisateurs & Accès</strong>, l'Administrateur peut supprimer définitivement tout compte Closeuse ou Livreur (révocation simultanée dans Firebase Authentication et Firestore). Pour demander la purge intégrale d'un Workspace complet, utilisez l'assistant Direction ou contactez l'administrateur principal du domaine.
              </p>
            </section>
          </div>
        )}

        {tab === "security" && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                <span>Double Validation des Actions Sensibles</span>
              </div>
              <p className="text-slate-400">
                Toute modification de barème financier, suppression d'accès, déconnexion de flux ou changement de statut critique exige une confirmation explicite.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-brand font-semibold">
                <Server className="h-4 w-4" />
                <span>Passerelle OAuth Isolée (Incognito / Multi-Profils)</span>
              </div>
              <p className="text-slate-400">
                Les liens de connexion externe Meta utilisent un secret cryptographique à usage unique haché en SHA-256 (validité 15 min) détruit dès l'autorisation reçue.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-semibold">
                <Lock className="h-4 w-4" />
                <span>Verrouillage Caisse avant Rémunération</span>
              </div>
              <p className="text-slate-400">
                Les commissions livreurs sont automatiquement croisées avec l'état de versement réel en caisse pour empêcher tout paiement avant remise des fonds.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-sky-400 font-semibold">
                <Globe className="h-4 w-4" />
                <span>Isolation Strictement Multi-Pays</span>
              </div>
              <p className="text-slate-400">
                Chaque marché (Togo, Bénin, Côte d'Ivoire, Sénégal, Cameroun, etc.) opère dans son propre périmètre avec sa devise et ses règles.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#090d16] px-6 py-3 text-[11px] text-slate-500">
        <span>URL directe de conformité : {window.location.origin}/?legal=privacy</span>
        <span>Dernière mise à jour : Novembre 2026 • Ecom COD Socle Technique</span>
      </div>
    </div>
  );

  if (standalone) {
    return (
      <div className="min-h-screen bg-[#070a12] px-4 py-10 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl">
        {content}
      </div>
    </div>
  );
}
