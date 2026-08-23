# Backlog — Backend ANB Bordeaux

Backlog de ce qu'il reste à implémenter côté backend pour que le front (déjà terminé) soit pleinement opérationnel.
État de référence : audit du 2026-08-21, revérifié le 2026-08-23 sur la branche `content/contacts-legal-info`.
**Mise à jour du 2026-08-23 (soir)** : Phase 1 (Super-admin) implémentée et testée en local — voir détail ci-dessous. Rien n'a encore été appliqué sur la base D1 distante (`anb-db`) ni poussé sur `origin` (hors le tout premier commit de fix de hash) : tout est en local en attente de votre feu vert.

Légende priorité : 🔴 Bloquant lancement · 🟠 Important · 🟡 Nice-to-have / peut attendre
Légende statut : ✅ Fait (testé en local) · 🚧 Partiel · ⏳ Reporté (décision explicite) · ⬜ Pas commencé

---

## Phase 0 — Préparer la base de données

- [x] ✅ 🔴 Ajouter la table `site_settings` (clé/valeur) dans [`db/schema.sql`](db/schema.sql) — créée, seedée avec les 6 clés identité/SEO. Commit `ed9ce45`.
- [ ] ⏳ 🟡 Ajouter la table `sessions` — reporté (décision explicite : la vue "Sécurité" reste factice pour l'instant).
- [ ] 🚧 🔴 Appliquer les migrations avec `wrangler d1 execute` — **fait en local uniquement** (`--local`). **Pas encore appliqué sur `anb-db` distant** : le fix de hash des mots de passe et la table `site_settings` doivent être poussés sur la base réelle avant toute mise en prod.
- [ ] ⬜ 🟡 **Nouveau** : `db/schema.sql` n'est pas idempotent pour les tables sans contrainte `UNIQUE` (`evenements`, `adhesions`, `messages`, `inscriptions`, `journal_activite`) — chaque réapplication du fichier duplique leurs lignes de seed (déjà constaté en local : `evenements` a 2x ses lignes "À venir"). Ajouter des contraintes `UNIQUE` ou séparer schéma/seed avant de rejouer ce fichier sur une base qui a déjà des données.

---

## Phase 1 — Espace Super-admin ✅ Implémentée (locale, testée)

Fichier : [`src/pages/superadmin.astro`](src/pages/superadmin.astro). Modèle suivi : [`src/pages/api/admin/news.js`](src/pages/api/admin/news.js) (`requireRole`, `env.DB`, `prepare().bind().run()`).

| # | Vue | Route API | Table | Statut |
|---|---|---|---|---|
| 1.1 | `view-users` | [`api/superadmin/users.js`](src/pages/api/superadmin/users.js) (GET/POST/PUT/DELETE) | `utilisateurs` | ✅ Fait. Invitation = création directe (pas d'e-mail branché, mot de passe temporaire affiché une fois). Suspendre/réactiver, réinitialiser mot de passe, supprimer — tous branchés. Garde anti-auto-suspension/auto-suppression/auto-retrait de rôle. |
| 1.2 | `view-journal` | [`api/superadmin/journal.js`](src/pages/api/superadmin/journal.js) (GET) | `journal_activite` | ✅ Fait. Alimenté automatiquement par toutes les routes `api/superadmin/*` via [`src/lib/journal.js`](src/lib/journal.js). |
| 1.3 | `view-contenus` (validations) | [`api/superadmin/validations.js`](src/pages/api/superadmin/validations.js) (GET/PUT) | `actualites.status = 'En attente'` | ✅ Fait côté super-admin, mais **la file sera vide** tant que la Phase 2 (soumission éditeur) n'existe pas — rien ne pose ce statut pour l'instant. |
| 1.4 | `view-overview` + `view-stats` | [`api/superadmin/stats.js`](src/pages/api/superadmin/stats.js) (GET) | agrégats sur tables existantes | ✅ Fait. Volontairement **sans** pageviews/trafic (aucun outil d'analytics branché) — remplacé par "Prochains événements"/"Derniers articles publiés", tous réels. |
| 1.5 | `view-donnees` (export RGPD) | [`api/superadmin/export.js`](src/pages/api/superadmin/export.js) (POST) | `recensement`/`adhesions`/`messages`/`inscriptions` → CSV | ✅ Fait, export CSV réel et téléchargeable. La liste "Demandes RGPD" (accès/suppression/rectification) reste non trackée dans l'outil — remplacée par une note renvoyant vers l'e-mail de contact (aucune table pour ça). |
| 1.6 | `view-reglages` (identité/SEO) | [`api/superadmin/settings.js`](src/pages/api/superadmin/settings.js) (GET/PUT) | `site_settings` | ✅ Fait pour Identité (nom/slogan/e-mail/tél.) et SEO (titre/description). Le pied de page public les reflète en direct via [`api/settings.js`](src/pages/api/settings.js) (public, sans auth). ⚠️ Le `<title>`/`<meta description>` de chaque page (Layout.astro) ne sont **pas** branchés — chaque page a son propre titre, un réglage global unique les écraserait tous. Carte "Navigation et pages" laissée en placeholder (pas de structure de menu éditable). |
| 1.7 | `view-mentions` | même route que 1.6 | `site_settings` | ⬜ **Pas fait.** L'édition du contenu long des mentions légales/CGU/confidentialité (pas juste identité/SEO) n'a pas été implémentée — les boutons "Modifier" restent des `alert()`. Plus gros que prévu (contenu long, pas du clé/valeur simple) ; à rescoper si besoin. |
| 1.8 | `view-profil` | [`api/superadmin/profile.js`](src/pages/api/superadmin/profile.js) (GET/PUT) | `utilisateurs` (self) | ✅ Fait, avec en plus (hors backlog initial, ajouté sur demande) : confirmation du nouveau mot de passe + bouton afficher/masquer. |
| 1.9 | `view-securite` (sessions) | — | `sessions` | ⏳ Reporté (décision explicite). Vue toujours factice. |
| 1.10 | `view-sauvegardes` | — | — | ✅ Fait comme prévu par le backlog : remplacé par un lien vers la procédure `wrangler d1 time-travel` de Cloudflare, plus de faux système de sauvegarde/restauration. |
| 1.11 | `view-integrations` | — | — | ✅ Fait comme prévu : les outils tiers non branchés (Maps, newsletter, paiement, analytics, réseaux sociaux) affichent honnêtement "À venir" au lieu de "Connecté" (fictif). "Formulaires" reste "Connecté" (réellement vrai). |

**Ordre suivi :** 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.8 → 1.10/1.11, un commit par vue (13 commits, voir historique git sur `content/contacts-legal-info`).

---

## Phase 2 — Espace Éditeur ✅ Implémentée (locale, testée)

Fichier : [`src/pages/editeur.astro`](src/pages/editeur.astro).

- [x] ✅ 🔴 `view-econtenus` — formulaire "Nouveau brouillon" → `POST /api/admin/news.js` (statut forcé `Brouillon` pour un éditeur), bouton "Soumettre" → [`PUT api/editeur/submit.js`](src/pages/api/editeur/submit.js) qui passe à `En attente` (repris par la vue 1.3 du Super Admin — boucle complète vérifiée de bout en bout). Limite : seuls les **articles** sont pris en charge (pas d'édition d'un brouillon existant, juste créer + soumettre ; pas d'événements/ressources, aucune API pour ça).
- [x] ✅ 🟠 `view-edash` (dashboard perso) — [`GET api/editeur/dashboard.js`](src/pages/api/editeur/dashboard.js), filtré par `auteur_id`, compteurs + commentaire de retour visible.
- [x] ✅ 🟠 `view-profil` — réutilise la route 1.8 (`api/superadmin/profile.js`, élargie au rôle éditeur), + confirmation mot de passe/afficher-masquer.
- [x] ✅ **Nouveau (trouvé en implémentant)** : ajout de `actualites.commentaire_retour` pour que l'éditeur voie pourquoi son contenu a été renvoyé (sinon perdu dans le seul journal, invisible pour lui). Nouveau statut `Renvoyé` distinct de `Brouillon`.

---

## Phase 3 — Galerie publique

Fichier : [`src/pages/galerie.astro`](src/pages/galerie.astro) (20 lignes, quasi vide). **Non commencée.**

- [ ] 🟠 `GET src/pages/api/media.js` — lit la table `media_galerie` (déjà remplie en seed)
- [ ] 🟠 Modifier [`src/pages/api/admin/upload.js`](src/pages/api/admin/upload.js) pour qu'il insère aussi une ligne dans `media_galerie` lors d'un upload
- [ ] 🟠 Brancher `galerie.astro` sur ce fetch + affichage grille (remplace le placeholder actuel)

---

## Phase 4 — Nettoyage avant mise en production

- [ ] 🔴 Supprimer [`src/pages/api/test-db.js`](src/pages/api/test-db.js) et [`src/pages/api/test-r2.js`](src/pages/api/test-r2.js) — nuance : déjà neutralisés (renvoient 404), donc pas un risque de sécurité actif, juste du nettoyage cosmétique.
- [ ] 🔴 Retirer le mot de passe pré-rempli `demo1234` sur `connexion.astro`
- [ ] ⏳ 🔴 Remplacer les comptes de seed par les vrais comptes admin/super-admin du client — **reporté par décision explicite** (comptes de démo conservés pour l'instant, sera fait avant la mise en prod)
- [ ] 🔴 **Nouveau** : appliquer sur `anb-db` distant (1) le hash des mots de passe, (2) la table `site_settings`, (3) la colonne `actualites.commentaire_retour` — et pousser les commits locaux des Phases 1 et 2 sur `origin`

---

## Phase 5 — Contenu réel (dépend du client, voir `contenu-en-attente-client-anb`)

- [ ] 🔴 Remplacer `src/lib/demo-data.ts` (équipe, événements, actualités) utilisé dans :
  - [`src/pages/association.astro`](src/pages/association.astro)
  - [`src/pages/index.astro`](src/pages/index.astro)
  - [`src/components/Header.astro`](src/components/Header.astro)
  - [`src/pages/galerie.astro`](src/pages/galerie.astro)
- [ ] 🔴 Photos individuelles des membres du bureau + photos générales de l'association
- [ ] 🟠 Adresse du siège social (toujours "???" côté client)
- [ ] 🟠 Numéro WhatsApp (aucun lien fourni pour l'instant)
- [ ] 🟡 Confirmation client : compte TikTok exact, lien Instagram
- [ ] 🟡 Statuts / papiers juridiques de l'association

---

## Déjà fait (pour référence, ne pas refaire)

- Auth/connexion + middleware par rôle (`admin`, `super_admin`, `editeur`)
- Espace Admin complet (actus, événements, messages, recensement, upload R2)
- Recensement public, Adhésion, Contact, Chatbot IA (rate-limité)
- Pages vitrines statiques (accueil, association, événements, actualités, culture, vie pratique, CGU, confidentialité, mentions légales)
- Coordonnées réelles intégrées (tél, e-mail, réseaux sociaux) — voir commit `8c16a2d`
- **Espace Super-admin (Phase 1 ci-dessus)** : Utilisateurs & rôles, Journal d'activité, Contenus & validations, Vue d'ensemble, Statistiques, Données & exports, Réglages identité/SEO (+ reflet en direct sur le site public), Mon profil, Sauvegardes (lien Time Travel), Intégrations (statuts honnêtes) — testé en local, pas encore en prod
- **Espace Éditeur (Phase 2 ci-dessus)** : création/soumission de brouillons d'articles, tableau de bord perso, boucle complète avec la validation super-admin (renvoi avec commentaire visible, re-soumission, publication) — testé en local, pas encore en prod
- **Fix identité en dur** : `admin.astro` et `editeur.astro` affichaient un nom figé ("Mariama Souley"/"Fatou Ibrahim") quel que soit le compte connecté — corrigé, plus grave : la création d'actualités attribuait tous les articles à Mariama (id 2) peu importe l'auteur réel — corrigé côté serveur (`api/admin/news.js` dérive désormais l'auteur de la session, jamais du client)
