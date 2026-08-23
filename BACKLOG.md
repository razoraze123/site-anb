# Backlog réel — ANB Bordeaux

**Audit complet du code fait le 2026-08-23.** Chaque ligne ci-dessous a été vérifiée dans le code source (routes API, sections HTML, appels `fetch`), et les points marqués « vérifié en exécution » ont été testés en lançant réellement l'application.

Ce document remplace le backlog précédent, qui contenait des affirmations non vérifiées.

**État git :** 27 commits sur la branche `content/contacts-legal-info`, dont **26 non poussés**. Aucune migration appliquée sur la base distante `anb-db` — tout le travail est local.

Légende : 🔴 Bloquant lancement · 🟠 Important · 🟡 Peut attendre

---

## 1. À faire — par ordre de priorité

### 🔴 P1 — Le Super Admin a 3 liens qui mènent à une page blanche

**Vérifié en exécution :** dans `/superadmin`, cliquer sur « Actualités », « Événements » ou « Messages » n'affiche **rien du tout** — aucune section, aucun titre, aucun message d'erreur.

Cause : `superadmin.astro` déclare ces 3 entrées de menu, mais ne contient aucune section `view-actualites`, `view-evenements` ni `view-messages`.

La permission existe déjà (les routes API acceptent `super_admin`, et le middleware l'autorise à ouvrir `/admin`) — **seule l'interface manque**.

⚠️ **Il n'existe aucun composant réutilisable** dans ce projet : `src/components/` ne contient que `Chatbot`, `Footer` et `Header`. Les 3 espaces (`admin` 1852 lignes, `superadmin` 1548, `editeur` 692) sont des fichiers autonomes qui dupliquent déjà chacun leur propre navigation. On ne peut donc pas « réutiliser les composants » en l'état. Trois options :

| Option | Effort | Conséquence |
|---|---|---|
| **(A)** Retirer les 3 liens cassés, ajouter « Ouvrir l'espace Admin » → `/admin` | ~15 min | Le super-admin change d'espace pour gérer les contenus. Aucune duplication. |
| **(B)** Copier les 3 vues d'`admin.astro` dans `superadmin.astro` | ~2 h | ~600 lignes dupliquées à maintenir en double — chaque correction future devra être faite deux fois. |
| **(C)** Extraire les vues en vrais composants Astro partagés, puis les utiliser dans les deux espaces | ~1 journée | Solution propre et durable, mais c'est un refactoring qui touche du code déjà livré et testé. |

→ **Décision à prendre.** (A) si l'objectif est de débloquer vite, (C) si ces vues vont continuer d'évoluer.

### 🔴 P2 — Le formulaire de contact public n'envoie rien

`src/pages/contact.astro` (lignes 74-81) intercepte l'envoi, affiche un message de confirmation… et **s'arrête là**. Aucun appel réseau, aucune écriture en base.

Conséquences : un visiteur croit avoir envoyé un message, personne ne le reçoit ; la table `messages` ne peut être remplie que par les données de démo ; la vue « Messages » de l'admin gère des messages qui n'arriveront jamais.

À faire : créer `api/contact.js` (POST public + anti-abus, sur le modèle de `api/recensement.js`) et brancher le formulaire dessus.

### 🟠 P3 — Impossible de changer le statut d'un inscrit

Dans la vue Inscriptions, les statuts (Confirmé / En attente / Liste d'attente / Annulé) **s'affichent mais ne peuvent pas être modifiés**. Aucune route ne le permet.

À faire : `PUT /api/admin/inscriptions` + sélecteur de statut dans la vue.

### 🟠 P4 — « Pages du site » (Admin) est une maquette figée

`renderPages()` (`admin.astro`) affiche une liste écrite en dur : 7 pages avec de fausses dates et de faux auteurs. Aucune donnée réelle, aucune action.

Options : supprimer la vue, ou la remplacer par une vraie liste des pages avec un lien « voir la page ».

### 🟠 P5 — Galerie publique vide

`galerie.astro` fait 20 lignes et n'affiche rien. La table `media_galerie` contient des données mais **n'est lue nulle part dans le code**.

- [ ] `GET /api/media.js` — lire `media_galerie`
- [ ] `api/admin/upload.js` — insérer une ligne dans `media_galerie` à chaque upload
- [ ] Brancher `galerie.astro` (affichage grille)

### 🟡 P6 — Suppressions et corrections secondaires

- [ ] `DELETE /api/admin/messages` — supprimer/archiver un message
- [ ] `DELETE /api/admin/inscriptions` — désinscrire quelqu'un
- [ ] `PUT /api/admin/recensement` — corriger la fiche d'un membre recensé (aujourd'hui : suppression uniquement)

### 🟡 P7 — Vues Super Admin encore en maquette

- [ ] **Sécurité** — 2FA et « sessions actives » fictifs (reporté par décision explicite ; nécessiterait une table `sessions`)
- [ ] **Intégrations** — bouton « Configurer » = `alert()` (les statuts affichent honnêtement « À venir »)
- [ ] **Mentions & RGPD** — bouton « Modifier » = `alert()` ; l'édition du texte long des mentions légales/CGU n'existe pas

### 🟡 P8 — SEO global non branché

Les réglages `seo_titre` / `seo_description` sont enregistrés en base mais **le `<title>` et la `<meta description>` des pages ne les lisent pas** : chaque page a son propre titre (« Contact — ANB Bordeaux »), qu'un réglage global unique écraserait. Nécessite de repenser l'approche (titre par page éditable plutôt qu'un titre global).

---

## 2. État des opérations CRUD

Tableau vérifié route par route.

| Entité | Créer | Lire | Modifier | Supprimer |
|---|---|---|---|---|
| **Utilisateurs** | ✅ | ✅ | ✅ | ✅ |
| **Actualités** | ✅ | ✅ | ✅ | ✅ |
| **Événements** | ✅ | ✅ | ✅ | ✅ (avec garde-fou sur les inscrits) |
| **Messages** | ❌ formulaire cassé (P2) | ✅ | ✅ statut | ❌ (P6) |
| **Inscriptions événements** | ✅ public | ✅ | ❌ (P3) | ❌ (P6) |
| **Recensement / adhésions** | ✅ public | ✅ | ❌ (P6) | ✅ |
| **Réglages du site** | — | ✅ | ✅ | — (clé/valeur, normal) |
| **Médias / galerie** | ✅ upload R2 | ❌ (P5) | ❌ | ❌ |

---

## 3. Avant mise en production

- [ ] 🔴 **Appliquer les migrations sur la base distante `anb-db`** — rien n'y a été appliqué :
  1. mots de passe de seed hashés (PBKDF2) ;
  2. table `site_settings` ;
  3. colonne `actualites.commentaire_retour`.
- [ ] 🔴 **Pousser les 26 commits locaux** sur `origin`.
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
