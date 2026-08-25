-- Migration 2026-08-25 : formulaire de contact public réellement branché
-- sur `messages` (Option A du workflow Messages : ANB collecte et organise
-- les messages, la réponse part du client e-mail de l'admin — pas d'envoi
-- automatique depuis l'outil, pas de nouvelle table).
--
-- `messages` n'avait jamais de colonne email : le formulaire de contact
-- public n'était pas branché (contact.astro annulait sa propre soumission),
-- donc rien n'avait jamais eu besoin de stocker l'adresse de l'expéditeur.
-- Nécessaire pour que le bouton "Répondre par e-mail" (mailto:) ait une
-- adresse réelle à utiliser.

ALTER TABLE messages ADD COLUMN email TEXT NOT NULL DEFAULT '';

-- Backfill des 5 lignes de seed existantes, pour que la démo reste
-- cohérente une fois "Répondre par e-mail" actif dessus.
UPDATE messages SET email = 'aicha.b@email.fr'      WHERE from_name = 'Aïcha B.';
UPDATE messages SET email = 'ibrahim.m@email.fr'     WHERE from_name = 'Ibrahim M.';
UPDATE messages SET email = 'fatou.k@email.fr'       WHERE from_name = 'Fatou K.';
UPDATE messages SET email = 'assane.t@email.fr'      WHERE from_name = 'Assane T.';
UPDATE messages SET email = 'mariam.d@email.fr'      WHERE from_name = 'Mariam D.';
