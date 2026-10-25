-- Migration 2026-08-29 : historique des réponses aux messages de contact.
--
-- Fait évoluer le flux `messages` (jusqu'ici "Option A" : ANB collecte,
-- la réponse part du client e-mail de l'admin, aucun envoi automatique —
-- voir migration-2026-08-25-messages-email.sql) vers un envoi réel depuis
-- l'admin via Resend (src/lib/email.js). Décision explicitement demandée
-- par le client, remplaçant l'ancien choix Option A.
--
-- admin_id (pas admin_email) : référence utilisateurs.id, même principe
-- que actualites.auteur_id — ON DELETE SET NULL pour ne jamais perdre
-- l'historique d'une réponse si le compte admin qui l'a rédigée est
-- supprimé plus tard.
CREATE TABLE IF NOT EXISTS message_reponses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  contenu TEXT NOT NULL,
  admin_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
);
