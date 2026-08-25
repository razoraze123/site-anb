-- Migration 2026-08-24 (bis) : tri chronologique des événements.
--
-- `evenements.date` est un texte libre affiché tel quel ("20 sept. 2026",
-- "juin 2026", parfois même sans jour) — impossible à trier correctement
-- en SQL. On ajoute une vraie colonne de tri `event_date` (ISO
-- AAAA-MM-JJ), remplie à partir du sélecteur de date de l'admin à chaque
-- création/modification. Le champ `date` affiché ne change pas.

ALTER TABLE evenements ADD COLUMN event_date TEXT;

-- Reconstitution ponctuelle pour les événements déjà en base (créés avant
-- ce champ). Pour "juin 2026" et "janvier 2026" (pas de jour dans le texte
-- d'origine), le 1er du mois est utilisé par défaut — à corriger via
-- "Modifier" + le nouveau sélecteur si la vraie date est connue.
UPDATE evenements SET event_date = '2026-09-20' WHERE id = 1;
UPDATE evenements SET event_date = '2026-10-12' WHERE id = 2;
UPDATE evenements SET event_date = '2026-06-01' WHERE id = 5;
UPDATE evenements SET event_date = '2026-01-01' WHERE id = 6;
UPDATE evenements SET event_date = '2026-11-08' WHERE id = 10;
UPDATE evenements SET event_date = '2026-12-03' WHERE id = 11;

-- Nettoyage d'un événement de test oublié (créé durant une session de
-- vérification précédente, sans contenu réel).
DELETE FROM evenements WHERE title = 'test';
