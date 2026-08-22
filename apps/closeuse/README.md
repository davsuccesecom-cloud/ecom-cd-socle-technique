# Ecom COD — App Closeuse

Conforme à l'architecture section 6. Écran principal = 4 statuts prioritaires en onglets (`Nouveau`, `Programmé`, `En cours`, `Livré`) ; les statuts secondaires (`Rejeté`, `Injoignable`, `Indisponible`) sont dans le menu ☰.

## Ce qui est fonctionnel

- **Connexion** par lien d'accès (`/c/{accessLinkId}`) + mot de passe simple — zéro configuration côté closeuse
- **Écoute temps réel** des commandes assignées (Firestore `onSnapshot`, pas de polling)
- **Bouton d'appel direct** (`tel:`) avec barre bleue "Appel en cours" tant que l'appel n'est pas clôturé
- **Actions de statut contextuelles** — seuls les boutons pertinents au statut actuel s'affichent
- **Visibilité temps réel de la livraison** — badge "En livraison" dès que le livreur passe en route ; passage automatique à "Livré" dès confirmation (géré côté Cloud Function, section 6)
- **PWA installable** — manifest + service worker générés par `vite-plugin-pwa`, icônes propres incluses (`public/icon-192.png`, `icon-512.png`) — ça règle le problème du carré gris avec badge Chrome vu au début
- **Notifications push** — demande de permission + enregistrement du token FCM au premier chargement

## Ce qui reste à faire manuellement avant de tester en conditions réelles

1. **Copier `.env.example` en `.env.local`** et remplir avec la config Web app Firebase (voir échange précédent : Firebase Console → Paramètres du projet → Vos applications → Web)
2. **Remplacer les `REPLACE_ME`** dans `public/firebase-messaging-sw.js` avec les mêmes valeurs — ce fichier est statique (pas de variables d'environnement possibles dedans), donc c'est la seule copie manuelle nécessaire
3. **Créer un utilisateur de test** directement dans Firestore (`workspaces/{id}/users/{id}` avec `role: "closeuse"`) et un `accessLinks` correspondant tant que l'app Admin (qui génère normalement ça) n'existe pas encore
4. **Déployer les Cloud Functions et règles** du dossier `../../functions` et `../../firestore.rules` si pas déjà fait

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis remplir
npm run dev
```

## Limite connue (honnêteté technique)

Le champ `sound` des notifications n'est pas fiable cross-plateforme (voir architecture section 3.3) — pas de son personnalisé garanti sur desktop, seulement le titre/emoji et la vibration mobile pour différencier l'urgence.
