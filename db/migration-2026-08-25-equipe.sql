-- Migration 2026-08-25 : table equipe (bloc Bureau/Équipe de /association).
--
-- Remplace teamMembers (demo-data.ts, fictif) par une vraie table
-- administrable, sur le même principe que media_galerie (P1.3).
--
-- Volontairement AUCUN seed : la table reste vide après cette migration.
-- Ne jamais y insérer les vrais membres du bureau sans validation du
-- client — voir aussi schema.sql, section equipe, même remarque.

CREATE TABLE IF NOT EXISTS equipe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  fonction TEXT NOT NULL,
  photo TEXT,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
