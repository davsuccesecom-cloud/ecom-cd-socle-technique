# Ecom COD v2 — Stack d'amélioration & Architecture cible

## Vue d'ensemble

Ce document définit l'architecture d'amélioration du projet Ecom COD, incluant :
- Le système de clonage et génération de sites
- L'intégration WordPress/WooCommerce
- Le tracking Meta avancé (fbp, fbc, etc.)
- L'automatisation de la création de sites par pays

---

## Architecture cible

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ECOM COD v2                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Site Clone  │  │  Site Clone  │  │  Site Clone  │  ...         │
│  │  (tg.ecom)   │  │  (sn.ecom)   │  │  (ci.ecom)   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         └─────────────────┼─────────────────┘                       │
│                           ▼                                         │
│              ┌────────────────────────┐                             │
│              │   API Gateway (Cloud   │                             │
│              │   Functions)           │                             │
│              │   - receiveOrder       │                             │
│              │   - receiveSiteClone   │                             │
│              │   - trackEvent         │                             │
│              └───────────┬────────────┘                             │
│                          │                                          │
│         ┌────────────────┼────────────────┐                        │
│         ▼                ▼                ▼                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  Firestore  │  │  Cloud      │  │  Meta CAPI  │                 │
│  │  (orders,   │  │  Storage    │  │  (tracking) │                 │
│  │   sites,    │  │  (templates)│  │             │                 │
│  │   users)    │  │             │  │             │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Services Layer                            │   │
│  │  - SiteCloner (Playwright + IA)                              │   │
│  │  - SiteGenerator (templates + données produit)               │   │
│  │  - TrackingService (fbp, fbc, event_id)                      │   │
│  │  - WordPressPlugin (WooCommerce COD)                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Stack d'amélioration

### 1. Système de clonage de sites

**Objectif** : Capturer n'importe quel site, le transformer en template réutilisable, et le régénérer avec du contenu personnalisé.

**Technologies** :
- **Playwright** : Capture du DOM, styles, screenshots
- **IA (vision + DOM)** : Découpage en sections, réécriture des textes
- **GrapesJS** : Éditeur visuel pour ajustements manuels
- **Next.js** : Génération des sites clonés (un seul code pour tous les sites)

**Pipeline de clonage** :
```
URL → Playwright (capture) → IA (analyse) → Schéma JSON → Génération → Publication
```

**Schéma JSON d'une page** :
```json
{
  "id": "page-cod-tg",
  "type": "landing-cod",
  "sections": [
    {
      "type": "hero",
      "title": "Livraison à domicile au Togo",
      "subtitle": "Payez à la livraison",
      "cta": "Commander maintenant",
      "background": "gradient-blue"
    },
    {
      "type": "benefits",
      "items": [
        { "icon": "truck", "title": "Livraison rapide", "text": "24-48h" },
        { "icon": "cash", "title": "Paiement à la livraison", "text": "Payez à la réception" }
      ]
    },
    {
      "type": "product",
      "name": "Produit XYZ",
      "price": 15000,
      "currency": "XOF",
      "images": ["/img/product1.jpg"],
      "form": {
        "fields": ["name", "phone", "city", "address"],
        "submitUrl": "/api/orders"
      }
    },
    {
      "type": "reviews",
      "items": [
        { "name": "Koffi", "text": "Livraison rapide!", "rating": 5 }
      ]
    },
    {
      "type": "faq",
      "items": [
        { "q": "Quels sont les délais?", "a": "24-48h" }
      ]
    }
  ],
  "tracking": {
    "pixelId": "123456789",
    "accessToken": "xxx"
  }
}
```

### 2. Intégration WordPress/WooCommerce

**Plugin WordPress** :
- Formulaire COD sur fiche produit
- Envoi des commandes vers l'API Ecom COD (webhook signé)
- Installation du Pixel Meta (événement "Lead")
- Envoi CAPI côté serveur avec event_id commun

**Structure du plugin** :
```
ecom-cod-wp/
├── ecom-cod-wp.php          # Point d'entrée
├── includes/
│   ├── class-admin.php      # Page de configuration
│   ├── class-form.php       # Formulaire COD
│   ├── class-api.php        # Envoi vers Ecom COD
│   └── class-tracking.php   # Pixel + CAPI
├── assets/
│   ├── css/
│   └── js/
└── templates/
    └── form-cod.php
```

**Configuration** :
```php
// Dans WordPress > Réglages > Ecom COD
define('ECOM_COD_API_URL', 'https://api.ecomcod.app');
define('ECOM_COD_WORKSPACE_ID', 'xxx');
define('ECOM_COD_API_TOKEN', 'xxx');
define('ECOM_COD_PIXEL_ID', 'xxx');
define('ECOM_COD_ACCESS_TOKEN', 'xxx');
```

### 3. Tracking Meta avancé

**Problème actuel** : Le tracking CAPI n'envoie pas le `fbp` (cookie Facebook) ni le `fbc` (click ID), ce qui rend le tracking inefficace.

**Solution** : Implémenter un système de tracking complet côté client et serveur.

**Côté client (JavaScript)** :
```javascript
// tracking.js
function getFbp() {
  const cookie = document.cookie.split('; ').find(c => c.startsWith('_fbp='));
  return cookie ? cookie.split('=')[1] : null;
}

function getFbc() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('fbclid') || null;
}

function sendEvent(eventName, data) {
  const eventId = generateEventId();
  
  // Côté navigateur (Pixel)
  fbq('track', eventName, data, { eventID: eventId });
  
  // Côté serveur (CAPI)
  fetch('/api/track', {
    method: 'POST',
    body: JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      fbp: getFbp(),
      fbc: getFbc(),
      ...data
    })
  });
}
```

**Côté serveur (Cloud Function)** :
```typescript
// functions/src/tracking.ts
export const trackEvent = onRequest(async (req, res) => {
  const { event_name, event_id, fbp, fbc, ...data } = req.body;
  
  // Envoi à Meta CAPI
  await sendMetaCapiEvent({
    event_name,
    event_id,
    fbp,
    fbc,
    user_data: {
      ph: [sha256(data.phone)],
      fn: [sha256(data.first_name)],
      // ...
    },
    custom_data: data
  });
  
  res.json({ success: true });
});
```

### 4. API d'entrée de commandes

**Remplace Google Sheets** par une API directe.

**Endpoint** : `POST /api/orders`

**Format** :
```json
{
  "workspace_id": "xxx",
  "api_token": "xxx",
  "order": {
    "client_name": "Koffi Mensah",
    "phone": "+22890123456",
    "city": "Lomé",
    "address": "Quartier Bè",
    "product": "Produit XYZ",
    "quantity": 1,
    "amount": 15000,
    "order_number": "CMD-001"
  }
}
```

**Sécurité** :
- Token par workspace
- Signature HMAC des requêtes
- Rate limiting
- Validation des données

### 5. Modèle Firestore étendu

**Nouvelles collections** :

```
workspaces/{workspaceId}/
├── sites/                    # Sites clonés/générés
│   └── {siteId}
│       ├── url: string
│       ├── country: string
│       ├── language: string
│       ├── template: string
│       ├── content: object   # Schéma JSON de la page
│       ├── status: "draft" | "published" | "archived"
│       ├── createdAt: number
│       └── publishedAt: number
│
├── tracking/                 # Événements de tracking
│   └── {eventId}
│       ├── event_name: string
│       ├── event_id: string
│       ├── fbp: string
│       ├── fbc: string
│       ├── user_data: object
│       ├── custom_data: object
│       ├── createdAt: number
│       └── syncedToMeta: boolean
│
└── templates/                # Templates de pages
    └── {templateId}
        ├── name: string
        ├── category: "landing" | "product" | "checkout"
        ├── schema: object      # Schéma JSON
        ├── thumbnail: string
        └── createdAt: number
```

---

## Feuille de route

### Phase 0 : Corrections urgentes (1 semaine)
- [ ] Corriger l'encodage des fichiers (UTF-8)
- [ ] Corriger les KPI à 0 (utiliser dailyStats)
- [ ] Finir l'implémentation de dailyStats
- [ ] Sécuriser les secrets (retirer les clés Meta du code)

### Phase 1 : API d'entrée (1 semaine)
- [ ] Créer l'endpoint `receiveOrder`
- [ ] Implémenter la sécurité (token, signature, rate limiting)
- [ ] Tester avec Postman
- [ ] Migrer les clients existants

### Phase 2 : Plugin WordPress (2 semaines)
- [ ] Créer la structure du plugin
- [ ] Implémenter le formulaire COD
- [ ] Implémenter l'envoi vers l'API
- [ ] Implémenter le tracking Meta (Pixel + CAPI)
- [ ] Tester avec WooCommerce

### Phase 3 : Système de clonage (2-3 semaines)
- [ ] Créer le pipeline Playwright
- [ ] Implémenter l'analyse IA
- [ ] Créer le schéma JSON
- [ ] Implémenter la génération Next.js
- [ ] Créer l'éditeur visuel (GrapesJS)

### Phase 4 : Automatisation (1-2 semaines)
- [ ] Créer le template de site par défaut
- [ ] Implémenter la génération par IA
- [ ] Automatiser le déploiement (sous-domaines, SSL)
- [ ] Créer le dashboard de gestion des sites

### Phase 5 : App Shopify (optionnel)
- [ ] Créer l'app Shopify
- [ ] Implémenter les webhooks
- [ ] Tester avec un shop de test

---

## Décisions à trancher

1. **WordPress cloné ou pages Next.js générées ?**
   - WordPress : Plus simple pour les clients existants, mais maintenance lourde
   - Next.js : Un seul code pour tous les sites, mais nécessite un hébergement

2. **Hébergement des sites clonés ?**
   - Vercel (recommandé pour Next.js)
   - WordPress.com (pour WordPress)
   - Serveur VPS (contrôle total)

3. **Modèle de pricing ?**
   - Par site (ex: 50€/mois par site)
   - Par workspace (ex: 200€/mois pour 10 sites)
   - Par commande (ex: 1% du CA)

4. **Niveau d'automatisation ?**
   - Semi-automatique (validation manuelle avant publication)
   - Automatique (publication immédiate après génération)

5. **Support multilingue ?**
   - Français + Anglais (de base)
   + Langues locales (wolof, bambara, etc.)

---

## Risques et mitigation

| Risque | Mitigation |
|--------|------------|
| Perte de données | Sauvegardes automatiques quotidiennes |
| Tracking ineacace | Tests A/B avec et sans fbp/fbc |
| Maintenance WordPress | Versionning + tests automatisés |
| Coûts cachés support | Documentation + FAQ + tutoriels vidéo |
| Contrefaçon | Mode "inspiration" (structure, pas contenu) |

---

## Prochaines étapes

1. **Valider l'architecture** avec l'équipe
2. **Choisir les décisions** listées ci-dessus
3. **Commencer la Phase 0** (corrections urgentes)
4. **Planifier les sprints** pour les phases suivantes

---

*Dernière mise à jour : 2026-09-28*
