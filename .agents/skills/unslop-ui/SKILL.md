---
name: unslop-ui
description: >-
  Strict Anti-AI Slop guidelines and high-converting COD e-commerce UI design principles.
  Use when designing, coding, or refactoring front-end components, landing pages, forms,
  and product pages to eliminate cliché AI aesthetics and craft human, tactile, ultra-fast interfaces.
---

# Unslop UI — Directives de Design Haute Conversion & Anti-Clichés IA

Ce guide définit les règles strictes pour éliminer le « slop IA » (designs génériques, artificiels et sans âme) et concevoir des interfaces e-commerce et SaaS épurées, tactiles, lisibles et hautement persuasives, particulièrement adaptées au marché e-commerce COD en Afrique.

---

## 1. LES INTERDICTIONS STRICTES (Slop Tells à bannir)

1. **Bannir les dégradés violets / néons génériques** :
   - ❌ Interdit : `bg-gradient-to-r from-purple-600 to-indigo-600`, halos cyan/néon, mesh gradients artificiels.
   - ✅ Utiliser : Des aplats de couleurs solides et affirmées (vert conversion `#16a34a` ou `#15803d`, orange feu `#ea580c`, bleu marine profond `#0f172a`), contrastés avec des surfaces nettes.

2. **Bannir le Glassmorphism excessif & les faux flous** :
   - ❌ Interdit : `backdrop-blur-xl` avec fond semi-transparent illisible sur mobile, halos lumineux géants en `blur-3xl`.
   - ✅ Utiliser : Des bordures nettes et subtiles (`border border-slate-200 dark:border-slate-800`), des cartes opaques à contraste franc (`bg-white` ou `bg-slate-900`) et des ombres légères et réalistes (`shadow-sm`, `shadow-md`).

3. **Bannir les cartes symétriques répétitives sans âme** :
   - ❌ Interdit : Les grilles de 3 cartes identiques avec des icônes dans des cercles colorés et du texte corporate vague ("Solution innovante et synergie d'excellence").
   - ✅ Utiliser : Des blocs à géométrie variée (bento grid, listes à puces avec coches authentiques, tableaux comparatifs "Avant vs Après").

4. **Bannir le texte corporate robotique** :
   - ❌ Interdit : Le jargon marketing IA ("Propulsez votre quotidien vers de nouveaux sommets").
   - ✅ Utiliser : Un langage direct, concret, orienté résultat client :
     - *« Repas chaud en 15 minutes sans micro-ondes »*
     - *« Ne payez aucun centime d'avance : vérifiez le colis avec le livreur puis payez en espèces »*
     - *« Livraison sous 24h à 48h à Dakar, Abidjan, Douala ou Lomé »*.

5. **Bannir les animations superflues et lentes** :
   - ❌ Interdit : `transition: all`, effets de rebond élastiques, zoom agressif sur chaque survol.
   - ✅ Utiliser : Des micro-interactions vives et instantanées (150ms-200ms `ease-out`), des états pressés nets (`active:scale-[0.98]`).

---

## 2. RÈGLES DE DESIGN E-COMMERCE COD (Inspiré de MyRavane, YouCan, EasySell)

Les acheteurs en ligne en Afrique consultent principalement sur mobile, souvent en extérieur sous le soleil ou avec une connexion 3G/4G variable. L'interface doit être **brute, lisible et rassurante**.

### A. Typographie & Lisibilité
* **Contraste maximal** : Titres en gras sombre (`text-slate-900`), textes descriptifs en `text-slate-700` (jamais de gris délavé illisible).
* **Prix impossibles à rater** : Prix promo en très grand, gras et couleur vive (`text-2xl font-black text-emerald-600`), avec ancien prix barré (`line-through text-slate-400`).
* **Chiffres tabulaires** : Utiliser `tabular-nums` pour tous les montants et devises (`FCFA`, `GNF`, `XOF`, etc.).

### B. Sélecteur d'Offres & Bundles (Packs 1, 2, 3)
* Ne jamais afficher un simple bouton "Ajouter au panier".
* Toujours proposer 2 ou 3 cartes d'offres distinctes :
  * **Option 1** : 1 Pièce = Prix standard
  * **Option 2 (Recommandée)** : 2 Pièces = Réduction visible avec badge bien visible *« Le plus populaire • Économisez 5 000 FCFA »*
  * **Option 3** : 3 Pièces = Réduction maximale *« Meilleure offre famille »*
* La carte sélectionnée doit avoir une bordure franche de 2px et un badge coloré distinct.

### C. Le Formulaire de Commande COD 1-Page
* **Champs ultra-simples** :
  1. Nom & Prénom
  2. Téléphone (avec mention WhatsApp claire)
  3. Ville & Quartier de livraison
* **Hauteur des champs tactile** : Minimum 48px de hauteur (`py-3.5 px-4 text-base`), évitant le zoom automatique sur iPhone (`text-base`).
* **Bouton d'action massif** :
  * Texte explicite : *« COMMANDER MAINTENANT — PAIEMENT À LA LIVRAISON »*
  * Couleur contrastée (vert émeraude `#16a34a` ou orange vif).
  * Sous-titre sous le bouton : *« Aucun paiement en ligne requis • Colis vérifié avant paiement »*.

### D. Preuves Sociales Réelles
* Intégrer de vraies captures visuelles de conversations WhatsApp (bulles vertes avec horodatage, photos du produit déballé par le client).
* Avis vérifiés avec localisation locale (*« Fatou D. — Dakar Plateau »*, *« Jean-Marc K. — Abidjan Cocody »*).

### E. Bouton Sticky Flottant (Mobile)
* Sur mobile, garder une barre collée au bas de l'écran avec le prix promo et un bouton direct *« Commander (Paiement Cash) »* qui fait défiler immédiatement vers le formulaire.

---

## 3. CHECKLIST AVANT DE VALIDER UN CODE UI

- [ ] Est-ce que le contraste texte/fond est supérieur à 4.5:1 (WCAG AA) ?
- [ ] Y a-t-il des dégradés violets ou des néons inutiles ? Si oui, les supprimer.
- [ ] Les zones tactiles (boutons, inputs) font-elles au moins 44x44px ?
- [ ] La page se charge-t-elle sans bloquer sur des bibliothèques de design lourdes ?
- [ ] Le formulaire COD est-il accessible sans scroll infini ?
- [ ] Les badges de réassurance (paiement à la livraison, livraison express) sont-ils immédiatement visibles ?
