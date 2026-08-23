# Backlog réel — ANB Bordeaux

**Audit complet du code fait le 2026-08-23.** Chaque ligne ci-dessous a été vérifiée dans le code source (routes API, sections HTML, appels `fetch`), et les points marqués « vérifié en exécution » ont été testés en lançant réellement l'application.

Ce document remplace le backlog précédent, qui contenait des affirmations non vérifiées.

**État git :** 56 commits sur la branche `content/contacts-legal-info`, dont **39 non poussés** vers `origin`. Aucune migration appliquée sur la base distante `anb-db` — tout le travail est local.

Légende : 🔴 Bloquant lancement · 🟠 Important · 🟡 Peut attendre

---

## 1. À faire — par ordre de priorité

### 🔴 P1 — Le formulaire de contact public n'envoie rien

`src/pages/contact.astro` (lignes 74-81) intercepte l'envoi, affiche un message de confirmation… et **s'arrête là**. Aucun appel réseau, aucune écriture en base.

Conséquences : un visiteur croit avoir envoyé un message, personne ne le reçoit ; la table `messages` ne peut être remplie que par les données de démo ; la vue « Messages » de l'admin gère des messages qui n'arriveront jamais.

À faire : créer `api/contact.js` (POST public + anti-abus, sur le modèle de `api/recensement.js`) et brancher le formulaire dessus.

### 🟡 P2 — Reliquats mineurs Événements/Inscriptions

Le gros de l'audit du 2026-08-23 sur Événements & Inscriptions est traité — voir section 5 (« Refonte Événements & Inscriptions »). Ce qui reste, volontairement laissé de côté (hors du périmètre demandé) :

- La vue Inscrits n'a pas de recherche (contrairement à Recensement, qui en a une) — gênant seulement si un événement a beaucoup d'inscrits.
- Matrice de permissions (Super Admin, ligne « Traitement des inscriptions et adhésions ») affiche `✓` pour admin/super-admin — en réalité on peut seulement consulter/supprimer une inscription (plus de statut à « traiter » depuis la refonte). Formulation à ajuster en même temps que le reste de la matrice.

✅ *Fait le 2026-08-24 : le Super Admin a maintenant sa propre vue Inscriptions (identique à `/admin`, composant partagé `ViewInscriptions.astro` + `content.renderInscriptions()` dans `lib/adminContent.js`) — plus besoin d'un compte admin séparé pour consulter/supprimer une inscription.*

### 🟠 P3 — « Pages du site » (Admin) est une maquette figée

`renderPages()` (`admin.astro`) affiche une liste écrite en dur : 7 pages avec de fausses dates et de faux auteurs. Aucune donnée réelle, aucune action.

Options : supprimer la vue, ou la remplacer par une vraie liste des pages avec un lien « voir la page ».

### 🟠 P4 — Galerie publique vide

`galerie.astro` fait 20 lignes et n'affiche rien. La table `media_galerie` contient des données mais **n'est lue nulle part dans le code**.

- [ ] `GET /api/media.js` — lire `media_galerie`
- [ ] `api/admin/upload.js` — insérer une ligne dans `media_galerie` à chaque upload
- [ ] Brancher `galerie.astro` (affichage grille)

### 🟡 P5 — Suppressions et corrections secondaires

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
| **Messages** | ❌ formulaire cassé (P1) | ✅ | ✅ statut | ✅ (uniquement après archivage) |
| **Inscriptions événements** | ✅ public | ✅ | — *(plus de statut à modifier, cf. section 5)* | ✅ |
| **Recensement / adhésions** | ✅ public | ✅ | ❌ (P5) | ✅ |
| **Réglages du site** | — | ✅ | ✅ | — (clé/valeur, normal) |
| **Médias / galerie** | ✅ upload R2 | ❌ (P4) | ❌ | ❌ |

---

## 3. Avant mise en production

- [ ] 🔴 **Appliquer les migrations sur la base distante `anb-db`** — rien n'y a été appliqué :
  1. mots de passe de seed hashés (PBKDF2) ;
  2. table `site_settings` ;
  3. colonne `actualites.commentaire_retour`.
- [ ] 🔴 **Pousser les 31 commits locaux** sur `origin`.
- [ ] 🔴 Retirer le mot de passe pré-rempli `demo1234` — `connexion.astro` ligne 96 (`value="demo1234"`).
- [ ] 🔴 Remplacer les comptes de démo par les vrais comptes du client (reporté par décision explicite).
- [ ] 🟡 Supprimer `api/test-db.js` et `api/test-r2.js` — déjà neutralisés (renvoient 404), donc cosmétique.
- [ ] 🟡 `db/schema.sql` n'est pas idempotent : les tables sans contrainte `UNIQUE` (`evenements`, `adhesions`, `messages`, `inscriptions`, `journal_activite`) **dupliquent leurs lignes de seed** à chaque réapplication du fichier. Déjà constaté en local. À corriger avant de rejouer ce fichier sur une base contenant des données.
- [ ] 🟡 Table `adhesions` morte : plus aucun formulaire n'y écrit (« adhésion » = « recensement », cf. section 5). Elle ne contient que 4 lignes de démo. À supprimer du schéma ou à documenter comme obsolète.

---

## 4. Contenu attendu du client

- [ ] 🔴 Remplacer les données restantes de `src/lib/demo-data.ts` : bureau/équipe (`association.astro`), galerie photo (`galerie.astro`), photo de couverture + prochain événement mis en avant sur la home (`index.astro`). *(Les actualités de la home sont désormais branchées sur la vraie base — voir section 5.)*
- [ ] 🔴 Photos des membres du bureau + photos de l'association
- [ ] 🟠 Adresse du siège social (toujours absente)
- [ ] 🟠 Numéro WhatsApp
- [ ] 🟡 Confirmation du compte TikTok exact et du lien Instagram
- [ ] 🟡 Statuts / documents juridiques

---

## 5. Fait et vérifié

### Formulaires Actualités Admin/Éditeur harmonisés (2026-08-24)
Même socle de champs, même ordre (Titre → Catégorie/Rédacteur → Image de couverture → Résumé court → Contenu) — seules les actions finales changent selon le rôle (Admin : Publier · Éditeur : Enregistrer le brouillon / Soumettre à validation, cette dernière enchaînant sauvegarde + `PUT /api/editeur/submit` en un clic).
- **Bug corrigé** : `POST /api/admin/upload` était réservé à `['admin', 'super_admin']` — un éditeur ne pouvait pas illustrer son propre brouillon (le formulaire proposait l'upload, l'API le refusait). Ouvert à `editeur` — reste une simple permission d'upload, pas un droit d'administration R2 (pas de liste/suppression). Vérifié : upload par un compte éditeur → 200.
- Le slug n'était déjà pas modifiable (champ readonly), mais ressemblait visuellement à un champ de saisie. Remplacé par une ligne d'information (« URL : /actualites/... ») sur les deux formulaires.
- `api/editeur/dashboard.js` ne renvoyait pas `bg_gradient` — corrigé, sinon l'image d'un brouillon disparaissait de l'écran à la réouverture pour modification.
- Système d'upload (compression, glisser-déposer, aperçu) factorisé en exports du module partagé (`lib/adminContent.js`) au lieu d'être dupliqué : l'espace Éditeur (qui n'utilise pas le reste de ce module) réutilise les mêmes fonctions.
- Vérifié en exécution : upload éditeur, brouillon créé avec image, image conservée à la réouverture pour modification, « Soumettre à validation » passe bien `Brouillon → En attente` en conservant l'image, édition d'un article existant côté admin toujours fonctionnelle.

### Tri chronologique des événements (2026-08-24)
Public et admin affichent désormais les événements dans l'ordre des dates (nouvelle colonne `event_date`, ISO, dédiée au tri — `date` reste le texte affiché). Corrigé aussi au passage : « Modifier une actualité/un événement » ne sauvegardait jamais la nouvelle image de couverture (seule la création l'enregistrait) — vérifié et corrigé.

### Refonte Événements & Inscriptions (2026-08-24)
Réponse aux points 🔴 de l'audit précédent (voir l'ancien contenu de la section P2), avec un vrai modèle de données :

- **Statut de l'événement** simplifié à 3 valeurs posées uniquement par un admin : Ouvert / Terminé / Annulé. **« Complet » n'est plus stocké** : c'est calculé (inscrits ≥ capacité), recalculé à chaque lecture — plus besoin d'y toucher manuellement, et supprimer une inscription libère automatiquement une place. **« Brouillon » a disparu** (même principe que pour les actualités : un admin publie toujours directement).
- **Inscriptions ouvertes/fermées** devient un champ indépendant du statut (nouvelle colonne `inscriptions_ouvertes`), modifiable à la création et à l'édition.
- **Nouvelles actions admin** : « Annuler l'événement » (confirmation requise, disparaît du site public, inscriptions existantes conservées, pas de suppression automatique) et « Marquer comme terminé » (reste visible publiquement, plus inscriptible). Aucune des deux n'est déduite automatiquement de la date.
- **Bug corrigé** : « Modifier » un événement réinitialisait silencieusement son statut à « Ouvert » à chaque sauvegarde (même famille que le bug déjà corrigé sur les actualités) — un événement annulé redevenait inscriptible dès qu'on touchait à sa description. Le contenu et le statut sont désormais des mises à jour strictement séparées côté API.
- **Onglets admin** recalculés depuis statut + capacité (Ouvert/Complet/Terminé/Annulé) au lieu d'un champ `tab` à mettre à jour à la main — l'ancien système faisait que 3 des 4 onglets n'étaient jamais atteignables depuis l'interface réelle (vérifié en base avant correction).
- **Inscription publique** : ne demande plus que prénom + nom (retrait des champs e-mail/téléphone, qui n'ont jamais été collectés en pratique — vérifié). Immédiate, sans validation manuelle : l'ancien système de statuts (Confirmé/En attente/Liste d'attente/Annulé) disparaît complètement, une inscription existe ou n'existe pas.
- **Concurrence** : l'inscription publique est désormais une seule requête SQL atomique (`INSERT ... SELECT ... WHERE`) qui vérifie et écrit en une seule opération — élimine la fenêtre de dépassement de capacité entre deux inscriptions simultanées sur la toute dernière place. Vérifié en tirant 5 inscriptions concurrentes sur un événement à 1 place : exactement 1 a réussi.
- **Suppression d'une inscription** par l'admin, avec libération réelle de la place — vérifié.
- **Date/heure** : le champ texte libre est remplacé par un vrai sélecteur date + heure dans le formulaire admin (le format texte stocké en base ne change pas, aucune rupture de compatibilité).
- Migration appliquée en local : `db/migration-2026-08-24-evenements-inscriptions.sql` (colonnes `evenements.tab` et `inscriptions.status/email/phone` supprimées après vérification qu'elles n'étaient utilisées nulle part ailleurs ; `inscriptions_ouvertes` ajoutée). `db/schema.sql` mis à jour en conséquence.
- Bug préexistant (indépendant de cette refonte, trouvé en testant la vue Inscrits) : le sélecteur d'événement de la vue Inscrits se figeait dès que l'événement affiché par défaut n'avait aucun inscrit — corrigé au passage.
- Tout vérifié en exécution : création/édition via le vrai formulaire, annulation, marquage terminé, inscription publique avec/sans places disponibles, inscriptions fermées, événement annulé absent du site public, suppression d'inscription, anti-abus (5/10 min), et le test de concurrence ci-dessus.

### Audit ciblé « le système Actualités/Événements marche-t-il à 100% ? »
Deux bugs réels trouvés en le faisant volontairement échouer (pas en relisant le code), corrigés et re-testés :
- **Message d'erreur illisible sur un titre en double** — créer/modifier un article dont le titre génère la même adresse qu'un article existant renvoyait l'erreur SQLite brute (`D1_ERROR: UNIQUE constraint failed...`). Le slug étant généré automatiquement (non modifiable à la main), l'admin n'avait aucun moyen de comprendre. Traduit en message clair + code 409.
- **Un événement complet propose quand même « Je participe »** — aucune tâche planifiée ne fait jamais passer un événement à « Complet » automatiquement (statut posé à la main uniquement). Un visiteur pouvait donc s'inscrire à un événement déjà plein et se faire refuser après coup par l'API (qui, elle, bloquait déjà correctement toute surinscription). Le badge et le bouton comparent désormais aussi la capacité réelle, pas seulement le statut.
- **Limite acceptée, pas un bug** : le statut « Programmé » d'un article n'a pas de vrai système de publication planifiée (aucune tâche cron dans ce projet) — c'est un simple statut manuel, cohérent avec le reste de l'app (aucune automatisation nulle part ailleurs non plus).

### Actualités de la page d'accueil branchées sur la vraie base
`index.astro` affichait 3 actualités bidons codées en dur (`src/lib/demo-data.ts`), y compris quand la base contenait déjà les 5 vrais articles ajoutés le 2026-08-23 — ils n'apparaissaient jamais sur la home. La page passe désormais en rendu dynamique (comme `/actualites`) et affiche les 3 derniers articles réellement publiés, avec lien vers le vrai article, image de couverture (ou dégradé) réelle, et date formatée. Vérifié en exécution après nettoyage de deux articles de test qui traînaient en base locale suite à mes propres tests.

### Simplification du workflow Actualités (Admin/Super Admin) + suppression des messages
- **Actualités** — un admin/super-admin publiait déjà toujours directement (le formulaire n'a pas de champ statut), mais la liste affichait 4 onglets (Publiées/Brouillons/Programmées/Archivées) alors que rien, dans ce workflow, ne produit réellement un « Brouillon » ou un « Programmé » côté admin — ces statuts n'existaient que via le circuit éditeur (Brouillon → soumission → validation, géré ailleurs, dans son propre espace et dans « Contenus & validations ») ou via des données de test. Simplifié à **2 onglets : Publiées / Archivées**. Le circuit éditeur n'est pas touché. Les 3 articles restés au statut « Programmé » (dont 2 créés pour la démonstration du 2026-08-23) sont repassés en « Publié ». Vérifié en exécution sur `/admin` et `/superadmin`.
  - Oubli corrigé le lendemain : l'onglet Archivées n'avait aucun moyen d'y envoyer un article (aucun bouton). Ajout d'un bouton **Archiver/Publier** (bascule) sur chaque carte, `PUT /api/admin/news` accepte maintenant un changement de statut (réservé admin/super-admin — un éditeur ne peut pas l'utiliser). Au passage, corrigé un vrai bug que ce changement aurait révélé : le formulaire « Modifier » envoyait `status: 'Publié'` en dur à chaque sauvegarde, ce qui aurait republié silencieusement un article archivé dès qu'on corrige une simple faute de frappe. Vérifié en exécution (archiver → disparaît du site public → publier → réapparaît → modifier un article archivé ne le republie pas).
- **Messages** — suppression désormais possible, mais uniquement pour un message déjà archivé (nouveau bouton « Archiver », puis « Supprimer définitivement » qui n'apparaît qu'une fois archivé). Garde-fou appliqué aussi côté serveur (`DELETE /api/admin/messages` refuse un message qui n'est pas au statut Archivé), pas seulement caché dans l'interface. Vérifié en exécution (archiver → supprimer → disparu de la liste).

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
