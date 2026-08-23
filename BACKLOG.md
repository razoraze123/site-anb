# Backlog réel — ANB Bordeaux

**Audit complet du code fait le 2026-08-23.** Chaque ligne ci-dessous a été vérifiée dans le code source (routes API, sections HTML, appels `fetch`), et les points marqués « vérifié en exécution » ont été testés en lançant réellement l'application.

Ce document remplace le backlog précédent, qui contenait des affirmations non vérifiées.

**État git :** 25 commits sur la branche `content/contacts-legal-info`, dont **24 non poussés**. Aucune migration appliquée sur la base distante `anb-db` — tout le travail est local.

Légende : 🔴 Bloquant lancement · 🟠 Important · 🟡 Peut attendre

---

## 1. Bugs confirmés à corriger

### 1.1 🔴 Le Super Admin a 3 liens qui mènent à une page blanche

**Vérifié en exécution :** dans `/superadmin`, cliquer sur « Actualités », « Événements » ou « Messages » n'affiche **rien du tout** — aucune section, aucun titre, aucun message d'erreur. La page reste vide.

Cause : `src/pages/superadmin.astro` déclare ces 3 entrées dans son menu, mais ne contient aucune section `view-actualites`, `view-evenements` ni `view-messages` correspondante.

C'est exactement le problème que vous soupçonniez : **le Super Admin ne peut pas gérer les contenus depuis son espace**, alors que :
- les routes API l'autorisent déjà (`api/admin/news.js`, `events.js`, `messages.js` acceptent `super_admin`) ;
- le middleware l'autorise déjà à ouvrir `/admin` (`ROLE_REQUIRED['/admin'] = ['admin','super_admin']`).

Donc la permission existe, seule l'interface manque. Deux options :
- **(A) Rapide :** retirer les 3 liens cassés et ajouter à la place un lien « Ouvrir l'espace Admin » vers `/admin`.
- **(B) Complet :** dupliquer les 3 vues dans `superadmin.astro` pour tout gérer sans changer d'espace.

→ **Décision à prendre avant implémentation.**

### 1.2 🔴 Le formulaire de contact public n'envoie rien

**Vérifié :** `src/pages/contact.astro` (lignes 74-81) intercepte l'envoi (`e.preventDefault()`), affiche un message de confirmation… et **s'arrête là**. Aucun appel réseau, aucune écriture en base.

Conséquences réelles :
- un visiteur croit avoir envoyé un message, personne ne le reçoit ;
- la table `messages` ne peut être remplie que par les données de démo ;
- la vue « Messages » de l'admin gère donc des messages qui n'arriveront jamais.

À faire : créer `src/pages/api/contact.js` (POST public, avec anti-abus comme `api/recensement.js`) et brancher le formulaire dessus.

### 1.3 🟠 « Mon profil » de l'espace Admin n'enregistre rien

`src/pages/admin.astro` ligne 579 : le bouton Enregistrer est encore `onclick="alert('Profil enregistré !')"`. J'ai branché cette vue pour le Super Admin et l'Éditeur, mais **j'ai oublié l'Admin**. La route `api/superadmin/profile.js` accepte déjà le rôle `admin` — il ne manque que le câblage côté écran (même code que dans `editeur.astro`).

### 1.4 🟠 « Pages du site » (Admin) est une maquette figée

`renderPages()` (`admin.astro` ligne 1440) affiche une liste écrite en dur : 7 pages avec de fausses dates de modification et de faux auteurs (« Modifié le 12 juil. 2026 par Mariama S. »). Aucune donnée réelle, aucune action possible.

Options : supprimer la vue, ou la remplacer par une liste réelle des pages du site avec un lien « voir la page ».

---

## 2. Opérations CRUD manquantes

Tableau vérifié route par route.

| Entité | Créer | Lire | Modifier | Supprimer |
|---|---|---|---|---|
| **Utilisateurs** | ✅ | ✅ | ✅ | ✅ |
| **Actualités** | ✅ | ✅ | ✅ | ❌ **manquant** |
| **Événements** | ✅ | ✅ | ✅ | ❌ **manquant** |
| **Messages** | ❌ (formulaire cassé, cf. 1.2) | ✅ | ✅ (statut) | ❌ **manquant** |
| **Inscriptions événements** | ✅ (public) | ✅ | ❌ **manquant** | ❌ **manquant** |
| **Recensement / adhésions** | ✅ (public) | ✅ | ❌ **manquant** | ✅ |
| **Réglages du site** | — | ✅ | ✅ | — (clé/valeur, normal) |

À faire :
- [ ] 🟠 `DELETE /api/admin/news` + bouton Supprimer dans la vue Actualités
- [ ] 🟠 `DELETE /api/admin/events` + bouton Supprimer dans la vue Événements
- [ ] 🟡 `DELETE /api/admin/messages` + bouton Supprimer (ou archiver)
- [ ] 🟠 `PUT /api/admin/inscriptions` — changer le statut d'un inscrit (Confirmé / En attente / Annulé). Les statuts existent en base et s'affichent, mais **rien ne permet de les modifier**.
- [ ] 🟡 `DELETE /api/admin/inscriptions` — désinscrire quelqu'un
- [ ] 🟡 `PUT /api/admin/recensement` — corriger la fiche d'un membre recensé (aujourd'hui : suppression uniquement)

---

## 3. Vues encore en maquette (aucune donnée réelle)

| Vue | Fichier | État |
|---|---|---|
| **Galerie publique** | `src/pages/galerie.astro` | 20 lignes, vide. La table `media_galerie` est remplie en base mais **n'est lue nulle part dans le code**. |
| **Sécurité** (Super Admin) | `superadmin.astro` | 2FA et « sessions actives » entièrement fictifs. Reporté par décision explicite. |
| **Intégrations** (Super Admin) | `superadmin.astro` ligne 1398 | Bouton « Configurer » = `alert()`. Statuts affichent honnêtement « À venir » depuis la correction. |
| **Mentions & RGPD** (Super Admin) | `superadmin.astro` ligne 1469 | Bouton « Modifier » = `alert()`. L'édition du texte long des mentions légales/CGU n'existe pas. |
| **Pages du site** (Admin) | `admin.astro` ligne 1440 | Liste écrite en dur (cf. 1.4). |

Pour la galerie (Phase 3 d'origine) :
- [ ] 🟠 `GET /api/media.js` — lire `media_galerie`
- [ ] 🟠 Modifier `api/admin/upload.js` pour insérer une ligne dans `media_galerie` à chaque upload
- [ ] 🟠 Brancher `galerie.astro` sur ce fetch (affichage grille)

---

## 4. Avant mise en production

- [ ] 🔴 **Appliquer les migrations sur la base distante `anb-db`** — rien n'y a été appliqué :
  1. mots de passe de seed hashés (PBKDF2) ;
  2. table `site_settings` ;
  3. colonne `actualites.commentaire_retour`.
- [ ] 🔴 **Pousser les 24 commits locaux** sur `origin`.
- [ ] 🔴 Retirer le mot de passe pré-rempli `demo1234` — `connexion.astro` ligne 96 (`value="demo1234"`).
- [ ] 🔴 Remplacer les comptes de démo par les vrais comptes du client (reporté par décision explicite).
- [ ] 🟡 Supprimer `api/test-db.js` et `api/test-r2.js` — déjà neutralisés (renvoient 404), donc cosmétique.
- [ ] 🟡 `db/schema.sql` n'est pas idempotent : les tables sans contrainte `UNIQUE` (`evenements`, `adhesions`, `messages`, `inscriptions`, `journal_activite`) **dupliquent leurs lignes de seed** à chaque réapplication du fichier. Déjà constaté en local. À corriger avant de rejouer ce fichier sur une base contenant des données.
- [ ] 🟡 Table `adhesions` morte : plus aucun formulaire n'y écrit (« adhésion » = « recensement », cf. section 6). Elle ne contient que 4 lignes de démo. À supprimer du schéma ou à documenter comme obsolète.

---

## 5. Contenu attendu du client

- [ ] 🔴 Remplacer `src/lib/demo-data.ts` (équipe, événements, actualités), utilisé dans `association.astro`, `index.astro`, `Header.astro`, `galerie.astro`
- [ ] 🔴 Photos des membres du bureau + photos de l'association
- [ ] 🟠 Adresse du siège social (toujours absente)
- [ ] 🟠 Numéro WhatsApp
- [ ] 🟡 Confirmation du compte TikTok exact et du lien Instagram
- [ ] 🟡 Statuts / documents juridiques

---

## 6. Fait et vérifié

### Espace Super Admin
- **Utilisateurs & rôles** — CRUD complet (créer, suspendre/réactiver, réinitialiser le mot de passe, supprimer). Création et réinitialisation génèrent un mot de passe temporaire affiché une seule fois (aucun e-mail n'est envoyé). Un super-admin ne peut ni se suspendre, ni se retirer son rôle, ni se supprimer lui-même.
- **Journal d'activité** — alimenté automatiquement par toutes les routes `api/superadmin/*` via `src/lib/journal.js`.
- **Contenus & validations** — approuver (publie) / renvoyer avec commentaire. Boucle complète vérifiée en exécution avec l'espace Éditeur.
- **Vue d'ensemble & Statistiques globales** — agrégats réels. Volontairement sans mesure d'audience (aucun outil d'analytics n'est branché sur le site).
- **Données & exports** — export CSV réel (recensement / inscriptions / messages), raison obligatoire, tracé au journal.
- **Réglages (identité + SEO)** — enregistrés dans `site_settings` ; le pied de page public les reflète en direct via `api/settings.js`. ⚠️ Le `<title>` et la `<meta description>` des pages ne sont **pas** branchés (chaque page a son propre titre ; un réglage global unique les écraserait tous).
- **Mon profil** — avec confirmation du mot de passe et bouton afficher/masquer.
- **Sauvegardes** — remplacé par un lien vers la procédure Cloudflare D1 Time Travel (pas de système maison à coder).

### Espace Éditeur
- Création, **modification** et soumission de brouillons d'articles ; tableau de bord personnel ; filtres par statut avec tri « ce qui demande une action d'abord ». Seuls les **articles** sont pris en charge (pas d'événements ni de ressources — aucune API pour ça).
- Colonne `actualites.commentaire_retour` ajoutée pour que l'éditeur voie *pourquoi* son contenu a été renvoyé.

### Espace Admin
- Actualités, Événements, Inscriptions (lecture), Recensement, Messages, Statistiques (branchées sur données réelles).

### Corrections transverses
- **Identité en dur** — `admin.astro` et `editeur.astro` affichaient un nom figé (« Mariama Souley » / « Fatou Ibrahim ») quel que soit le compte connecté. Plus grave : **tous les articles créés étaient attribués à Mariama** quel que soit l'auteur réel — corrigé côté serveur (l'auteur vient désormais de la session, jamais du client).
- **Adhésion = recensement** — c'est la même démarche (`/adherer` poste vers `/api/recensement`). Mon code de Phase 1 interrogeait la table morte `adhesions` : la Vue d'ensemble affichait une fausse alerte et l'export RGPD sortait des données de démo au lieu des vraies. Corrigé.
- **Matrice de permissions** — 2 lignes sur 8 étaient fausses (l'éditeur ne peut pas créer de brouillons d'événements/médias ; aucune distinction « stats simples » n'existe pour l'Admin). Corrigées.
- **Onglet perdu au rechargement** — l'onglet actif est désormais mémorisé (F5 ne renvoie plus au tableau de bord) sur les 3 espaces.

### Déjà en place avant cette session
Auth + middleware par rôle · Recensement/adhésion public · Inscription aux événements · Chatbot IA (limité en débit) · Upload R2 · Pages vitrines · Coordonnées réelles (commit `8c16a2d`)
