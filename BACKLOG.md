# Backlog réel — ANB Bordeaux

**Audit complet du code fait le 2026-08-23.** Chaque ligne ci-dessous a été vérifiée dans le code source (routes API, sections HTML, appels `fetch`), et les points marqués « vérifié en exécution » ont été testés en lançant réellement l'application.

Ce document remplace le backlog précédent, qui contenait des affirmations non vérifiées.

**État git :** 30 commits sur la branche `content/contacts-legal-info`, dont **29 non poussés**. Aucune migration appliquée sur la base distante `anb-db` — tout le travail est local.

Légende : 🔴 Bloquant lancement · 🟠 Important · 🟡 Peut attendre

---

## 1. À faire — par ordre de priorité

### 🔴 P1 — Le formulaire de contact public n'envoie rien

`src/pages/contact.astro` (lignes 74-81) intercepte l'envoi, affiche un message de confirmation… et **s'arrête là**. Aucun appel réseau, aucune écriture en base.

Conséquences : un visiteur croit avoir envoyé un message, personne ne le reçoit ; la table `messages` ne peut être remplie que par les données de démo ; la vue « Messages » de l'admin gère des messages qui n'arriveront jamais.

À faire : créer `api/contact.js` (POST public + anti-abus, sur le modèle de `api/recensement.js`) et brancher le formulaire dessus.

### 🟠 P2 — Impossible de changer le statut d'un inscrit

Dans la vue Inscriptions, les statuts (Confirmé / En attente / Liste d'attente / Annulé) **s'affichent mais ne peuvent pas être modifiés**. Aucune route ne le permet.

À faire : `PUT /api/admin/inscriptions` + sélecteur de statut dans la vue.

### 🟠 P3 — « Pages du site » (Admin) est une maquette figée

`renderPages()` (`admin.astro`) affiche une liste écrite en dur : 7 pages avec de fausses dates et de faux auteurs. Aucune donnée réelle, aucune action.

Options : supprimer la vue, ou la remplacer par une vraie liste des pages avec un lien « voir la page ».

### 🟠 P4 — Galerie publique vide

`galerie.astro` fait 20 lignes et n'affiche rien. La table `media_galerie` contient des données mais **n'est lue nulle part dans le code**.

- [ ] `GET /api/media.js` — lire `media_galerie`
- [ ] `api/admin/upload.js` — insérer une ligne dans `media_galerie` à chaque upload
- [ ] Brancher `galerie.astro` (affichage grille)

### 🟡 P5 — Suppressions et corrections secondaires

- [ ] `DELETE /api/admin/messages` — supprimer/archiver un message
- [ ] `DELETE /api/admin/inscriptions` — désinscrire quelqu'un
- [ ] `PUT /api/admin/recensement` — corriger la fiche d'un membre recensé (aujourd'hui : suppression uniquement)

### 🟡 P6 — Vues Super Admin encore en maquette

- [ ] **Sécurité** — 2FA et « sessions actives » fictifs (reporté par décision explicite ; nécessiterait une table `sessions`)
- [ ] **Intégrations** — bouton « Configurer » = `alert()` (les statuts affichent honnêtement « À venir »)
- [ ] **Mentions & RGPD** — bouton « Modifier » = `alert()` ; l'édition du texte long des mentions légales/CGU n'existe pas

### 🟡 P7 — SEO global non branché

Les réglages `seo_titre` / `seo_description` sont enregistrés en base mais **le `<title>` et la `<meta description>` des pages ne les lisent pas** : chaque page a son propre titre (« Contact — ANB Bordeaux »), qu'un réglage global unique écraserait. Nécessite de repenser l'approche (titre par page éditable plutôt qu'un titre global).

---

## 2. État des opérations CRUD

Tableau vérifié route par route.

| Entité | Créer | Lire | Modifier | Supprimer |
|---|---|---|---|---|
| **Utilisateurs** | ✅ | ✅ | ✅ | ✅ |
| **Actualités** | ✅ | ✅ | ✅ | ✅ |
| **Événements** | ✅ | ✅ | ✅ | ✅ (avec garde-fou sur les inscrits) |
| **Messages** | ❌ formulaire cassé (P1) | ✅ | ✅ statut | ❌ (P5) |
| **Inscriptions événements** | ✅ public | ✅ | ❌ (P2) | ❌ (P5) |
| **Recensement / adhésions** | ✅ public | ✅ | ❌ (P5) | ✅ |
| **Réglages du site** | — | ✅ | ✅ | — (clé/valeur, normal) |
| **Médias / galerie** | ✅ upload R2 | ❌ (P4) | ❌ | ❌ |

---

## 3. Avant mise en production

- [ ] 🔴 **Appliquer les migrations sur la base distante `anb-db`** — rien n'y a été appliqué :
  1. mots de passe de seed hashés (PBKDF2) ;
  2. table `site_settings` ;
  3. colonne `actualites.commentaire_retour`.
- [ ] 🔴 **Pousser les 29 commits locaux** sur `origin`.
- [ ] 🔴 Retirer le mot de passe pré-rempli `demo1234` — `connexion.astro` ligne 96 (`value="demo1234"`).
- [ ] 🔴 Remplacer les comptes de démo par les vrais comptes du client (reporté par décision explicite).
- [ ] 🟡 Supprimer `api/test-db.js` et `api/test-r2.js` — déjà neutralisés (renvoient 404), donc cosmétique.
- [ ] 🟡 `db/schema.sql` n'est pas idempotent : les tables sans contrainte `UNIQUE` (`evenements`, `adhesions`, `messages`, `inscriptions`, `journal_activite`) **dupliquent leurs lignes de seed** à chaque réapplication du fichier. Déjà constaté en local. À corriger avant de rejouer ce fichier sur une base contenant des données.
- [ ] 🟡 Table `adhesions` morte : plus aucun formulaire n'y écrit (« adhésion » = « recensement », cf. section 5). Elle ne contient que 4 lignes de démo. À supprimer du schéma ou à documenter comme obsolète.

---

## 4. Contenu attendu du client

- [ ] 🔴 Remplacer `src/lib/demo-data.ts` (équipe, événements, actualités), utilisé dans `association.astro`, `index.astro`, `Header.astro`, `galerie.astro`
- [ ] 🔴 Photos des membres du bureau + photos de l'association
- [ ] 🟠 Adresse du siège social (toujours absente)
- [ ] 🟠 Numéro WhatsApp
- [ ] 🟡 Confirmation du compte TikTok exact et du lien Instagram
- [ ] 🟡 Statuts / documents juridiques

---

## 5. Fait et vérifié

### Architecture partagée
- **`src/components/admin/View{Actualites,Evenements,Messages}.astro`** + **`src/lib/adminContent.js`** : les 3 vues de gestion de contenu existent en **un seul exemplaire**, utilisées à l'identique par `/admin` et `/superadmin`. La page hôte injecte ce dont le module a besoin d'elle (navigation, rendu des badges) et lui fournit les données ; le module ignore tout de la navigation propre à chaque espace. Le bouton « Inscrits » n'apparaît que là où une vue Inscriptions existe.
- Conséquence : **un super-admin est un admin** — un seul compte, un seul rôle, et il gère les contenus depuis son propre espace. Toute correction future sur ces vues profite automatiquement aux deux.

### Espace Super Admin
- **Actualités, Événements, Messages** — mêmes vues que l'espace Admin (voir ci-dessus). Corrige les 3 liens qui menaient à une page blanche.
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
- Actualités et Événements — création, modification et **suppression** (la suppression d'un événement demande une confirmation supplémentaire s'il a des inscrits, car ils sont supprimés avec lui).
- Inscriptions (lecture seule), Recensement (lecture + suppression), Messages (changement de statut), Statistiques (branchées sur données réelles).
- **Mon profil** — enregistre réellement, avec confirmation du mot de passe et bouton afficher/masquer (identique aux deux autres espaces).

### Corrections transverses
- **Identité en dur** — `admin.astro` et `editeur.astro` affichaient un nom figé (« Mariama Souley » / « Fatou Ibrahim ») quel que soit le compte connecté. Plus grave : **tous les articles créés étaient attribués à Mariama** quel que soit l'auteur réel — corrigé côté serveur (l'auteur vient désormais de la session, jamais du client).
- **Adhésion = recensement** — c'est la même démarche (`/adherer` poste vers `/api/recensement`). Mon code de Phase 1 interrogeait la table morte `adhesions` : la Vue d'ensemble affichait une fausse alerte et l'export RGPD sortait des données de démo au lieu des vraies. Corrigé.
- **Matrice de permissions** — 2 lignes sur 8 étaient fausses (l'éditeur ne peut pas créer de brouillons d'événements/médias ; aucune distinction « stats simples » n'existe pour l'Admin). Corrigées.
- **Onglet perdu au rechargement** — l'onglet actif est désormais mémorisé (F5 ne renvoie plus au tableau de bord) sur les 3 espaces.

### Déjà en place avant cette session
Auth + middleware par rôle · Recensement/adhésion public · Inscription aux événements · Chatbot IA (limité en débit) · Upload R2 · Pages vitrines · Coordonnées réelles (commit `8c16a2d`)
