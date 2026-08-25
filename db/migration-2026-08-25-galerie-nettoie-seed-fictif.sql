-- Migration 2026-08-25 : nettoie les 6 lignes fictives de media_galerie.
--
-- Contexte (P1.3) : media_galerie devient la source de vérité de
-- /galerie et de la galerie de la home. Le seed original (db/schema.sql,
-- déjà appliqué à toute base initialisée avant cette migration) insérait
-- 6 lignes de démonstration (photos/galerie_1.jpg ... videos/galerie_6.mp4)
-- qui ne correspondent à AUCUN fichier réel dans R2 — les afficher
-- reviendrait à montrer 6 images cassées comme si elles étaient réelles.
--
-- Cette migration ne fait que supprimer ces 6 lignes précises (par
-- nom_fichier exact, aucun risque de toucher un média réel uploadé
-- depuis) ; schema.sql a été mis à jour en conséquence pour ne plus les
-- insérer sur une installation neuve.
--
-- NON APPLIQUÉE À LA D1 DISTANTE — préparée uniquement, à exécuter
-- manuellement quand tu le décides :
--   wrangler d1 execute anb-db --remote --file=db/migration-2026-08-25-galerie-nettoie-seed-fictif.sql

DELETE FROM media_galerie WHERE nom_fichier IN (
  'photos/galerie_1.jpg',
  'photos/galerie_2.jpg',
  'videos/galerie_3.mp4',
  'photos/galerie_4.jpg',
  'photos/galerie_5.jpg',
  'videos/galerie_6.mp4'
);
