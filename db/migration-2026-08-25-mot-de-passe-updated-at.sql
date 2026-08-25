-- Migration 2026-08-25 : ajoute utilisateurs.mot_de_passe_updated_at.
--
-- Correction P0.4 (audit-auth.md §5/§9) : combler l'écart trouvé lors des
-- tests — un reset de mot de passe fait par un super_admin sur le compte
-- d'un autre utilisateur ne coupait pas la session déjà ouverte de ce
-- dernier (seuls statut/role étaient revérifiés dans getSessionUser()).
-- Cette colonne est comparée au même moment, dans le même SELECT, sans
-- requête D1 supplémentaire.
--
-- Étape 1 : ajout de la colonne. D1/SQLite refuse CURRENT_TIMESTAMP comme
-- défaut non constant sur ADD COLUMN (testé, erreur SQLITE_ERROR) — la
-- colonne est donc ajoutée sans défaut (NULL pour les lignes existantes,
-- backfillées à l'étape 2). Un compte créé après cette migration (POST
-- /api/superadmin/users) aura NULL ici tant que son mot de passe n'a pas
-- été explicitement reset ou changé — sans danger : getSessionUser()
-- (lib/auth.js) compare NULL à NULL au login initial (cohérent), et toute
-- vraie modification future écrit un horodatage réel, qui déclenchera
-- alors la coupure de session attendue.
ALTER TABLE utilisateurs ADD COLUMN mot_de_passe_updated_at DATETIME;

-- Étape 2 : pour les comptes déjà existants, on attribue created_at — la
-- meilleure approximation honnête de "dernier moment connu où ce mot de
-- passe a été défini" (leur création), plutôt que l'heure de la migration
-- qui n'aurait aucun sens (leur mot de passe n'a pas changé "maintenant").
UPDATE utilisateurs SET mot_de_passe_updated_at = created_at;
