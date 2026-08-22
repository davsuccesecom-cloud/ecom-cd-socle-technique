# Ecom COD — Socle technique (package partagé + Firestore + Cloud Functions)

Ce dossier contient la **première brique** du système, conforme au document `ARCHITECTURE-Technique-Systeme-Complet.md` : le code que les 3 apps (admin/closeuse/livreur) consommeront sans jamais dupliquer la logique.

## Structure

```
ecom-cod/
├── packages/shared/       ← package @ecomcod/shared (types, hooks, utils)
│   └── src/
│       ├── types.ts        ← modèle de données (section 4)
│       ├── constants.ts    ← statuts, limites (10/10/5/20)
│       ├── firebase.ts     ← init Firebase, injecté par chaque app
│       ├── hooks/          ← useOrders, useTeam, useAuth, useCallInProgress, useUpdateOrderStatus
│       └── utils/          ← phone.ts, loadBalancing.ts, remuneration.ts
├── functions/              ← Cloud Functions
│   └── src/index.ts        ← authenticateAccess, assignation, propagation, purge, rappels, digest
├── firestore.rules         ← sécurité : isolation workspace + sync à sens unique (section 14)
└── firestore.indexes.json  ← index composites requis par les requêtes
```

## Ce qui est déjà fonctionnel

- **`authenticateAccess`** — connexion par lien + mot de passe, limite 2 sessions, notif admin (section 10)
- **`onOrderCreated`** — assignation automatique à la closeuse la moins chargée, sans plafond bloquant (section 8)
- **`onOrderUpdated`** — propagation `En route`/`Livré`/`Injoignable` du livreur vers la closeuse en temps réel, calcul de rémunération (sections 6, 15)
- **`scheduledPurge`** — suppression quotidienne des commandes traitées après 3 jours (section 15/16)
- **`scheduledReminders`** — rappel toutes les 5 min si des commandes `Nouveau` dépassent 20 min (section 6)
- **`scheduledDigest`** — résumé périodique admin par équipe, selon `digestIntervalMinutes` (section 5.1)
- **Règles Firestore** — une closeuse ne peut écrire QUE `statutCloseuse`/`callInProgress` sur ses propres commandes, un livreur QUE `statutLivreur` — la synchronisation à sens unique (section 14) est donc appliquée **au niveau base de données**, pas juste dans le code client (donc infalsifiable même si quelqu'un bidouille l'app).

## Installation

```bash
cd ecom-cod
npm install --workspaces
```

## Configurer et déployer (une fois un projet Firebase choisi)

```bash
npm install -g firebase-tools
firebase login
firebase init firestore functions   # sélectionner le projet meta-capi-app existant (ou nouveau)
firebase deploy --only firestore:rules,firestore:indexes
cd functions && npm run build && firebase deploy --only functions
```

## Prochaine étape (roadmap architecture, section 17)

Construire l'**app Closeuse** (React + Vite + `vite-plugin-pwa`), qui importera `@ecomcod/shared` pour :
- s'authentifier (`useAccessLinkAuth`)
- écouter ses commandes en temps réel (`useOrders`)
- afficher les statuts prioritaires + menu ☰ secondaire (`CLOSEUSE_PRIORITY_STATUSES` / `CLOSEUSE_SECONDARY_STATUSES`)
- gérer la barre "appel en cours" (`useCallInProgress`)
- changer les statuts (`useUpdateOrderStatus`)
