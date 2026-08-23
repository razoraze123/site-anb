-- Migration 2026-08-24 : refonte du modèle Événements & Inscriptions.
--
-- Contexte : le statut d'un événement se limite désormais à
-- OPEN | COMPLETED | CANCELLED (colonnes 'Ouvert' | 'Terminé' | 'Annulé').
-- "Complet" n'est plus un statut stocké : c'est calculé (inscrits >= capacité).
-- "Brouillon" disparaît (un admin publie toujours directement, comme pour
-- les actualités). L'ouverture/fermeture des inscriptions devient un champ
-- séparé du statut de l'événement. La colonne `tab`, qui servait à ranger
-- les événements dans les anciens onglets À venir/Passés/Brouillons/Annulés,
-- est retirée : les onglets admin sont désormais calculés depuis le statut
-- + la capacité, pas depuis un champ à mettre à jour à la main.
--
-- Une inscription à un événement n'a plus de statut de confirmation
-- (Confirmé/En attente/Liste d'attente/Annulé) : elle existe ou elle
-- n'existe pas (l'admin la supprime si besoin). Elle ne collecte plus que
-- prénom + nom — jamais d'e-mail ni de téléphone (différent du recensement).

-- 1. Table evenements -------------------------------------------------

ALTER TABLE evenements ADD COLUMN inscriptions_ouvertes INTEGER NOT NULL DEFAULT 1;

-- Nettoyage des valeurs de statut qui n'existent plus :
-- "Complet" devient un état calculé -> les événements qui l'avaient en dur
-- redeviennent "Ouvert" (leur vrai état recalculé, potentiellement encore
-- complet si inscrits >= capacité, mais ce n'est plus stocké tel quel).
UPDATE evenements SET status = 'Ouvert' WHERE status = 'Complet';

-- "Brouillon" disparaît. Les 2 lignes concernées ("Soirée musique — édition
-- 2027", date "à définir") sont des doublons de données de seed sans
-- contenu réel (déjà documentés comme bug de seed non-idempotent dans
-- BACKLOG.md) : on les supprime plutôt que de les publier avec une date
-- fictive.
DELETE FROM evenements WHERE status = 'Brouillon';

ALTER TABLE evenements DROP COLUMN tab;

-- 2. Table inscriptions -------------------------------------------------

-- L'ancien système de confirmation (statuts Confirmé/En attente/Liste
-- d'attente/Annulé) disparaît : une inscription existe ou n'existe pas.
-- E-mail et téléphone n'ont jamais été collectés par le formulaire public
-- (toujours vides en pratique, cf. audit du 2026-08-23) ; le nouveau modèle
-- ne les demande plus du tout. Vérifié avant suppression : aucune autre
-- route ne lit `inscriptions.status/email/phone` en dehors de ce qui est
-- corrigé dans cette même livraison (api/inscriptions.js, api/admin/data.js,
-- api/superadmin/export.js, admin.astro).
ALTER TABLE inscriptions DROP COLUMN status;
ALTER TABLE inscriptions DROP COLUMN email;
ALTER TABLE inscriptions DROP COLUMN phone;
