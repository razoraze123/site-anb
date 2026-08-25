-- Complete Database Schema for ANB Bordeaux Platform (D1 SQL)

-- 1. Table utilisateurs
-- mot_de_passe_updated_at : utilisé par getSessionUser() (lib/auth.js,
-- Correction P0.4) pour couper immédiatement toute session déjà ouverte
-- quand le mot de passe est réinitialisé par un tiers. Présent ici pour
-- qu'une installation fraîche ait la colonne dès le départ ; pour un
-- environnement déjà initialisé, voir
-- db/migration-2026-08-25-mot-de-passe-updated-at.sql (ALTER TABLE).
CREATE TABLE IF NOT EXISTS utilisateurs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mot_de_passe TEXT NOT NULL,
  mot_de_passe_updated_at DATETIME,
  role TEXT NOT NULL DEFAULT 'editeur',
  statut TEXT NOT NULL DEFAULT 'actif',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table actualites
CREATE TABLE IF NOT EXISTS actualites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  auteur_id INTEGER,
  status TEXT NOT NULL DEFAULT 'Brouillon',
  bg_gradient TEXT NOT NULL,
  commentaire_retour TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auteur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
);

-- 3. Table evenements
-- status : Ouvert (OPEN) | Terminé (COMPLETED) | Annulé (CANCELLED) —
-- toujours posé manuellement par un admin, jamais déduit automatiquement
-- de la date. "Complet" n'est PAS un statut stocké : c'est calculé à
-- l'affichage (registered_count >= max_places), voir requêtes qui lisent
-- cette table. inscriptions_ouvertes est indépendant du statut de
-- l'événement (un événement Ouvert peut avoir ses inscriptions fermées).
CREATE TABLE IF NOT EXISTS evenements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  -- Date ISO (AAAA-MM-JJ) issue du sélecteur de date, uniquement pour le
  -- tri chronologique. `date` reste le texte affiché (peut différer du
  -- format ISO, ex. avec l'heure incluse).
  event_date TEXT,
  place TEXT NOT NULL,
  category TEXT NOT NULL,
  registered_count INTEGER DEFAULT 0,
  max_places INTEGER DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'Ouvert',
  inscriptions_ouvertes INTEGER NOT NULL DEFAULT 1,
  bg_gradient TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table inscriptions
-- Une inscription à un événement n'a pas de statut de confirmation : elle
-- existe ou elle n'existe pas (l'admin la supprime si besoin). Elle ne
-- collecte que prénom + nom — jamais d'e-mail ni de téléphone (différent
-- du recensement, qui lui les demande).
CREATE TABLE IF NOT EXISTS inscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES evenements(id) ON DELETE CASCADE
);

-- 5. Table adhesions
CREATE TABLE IF NOT EXISTS adhesions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  motivation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Nouvelle',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Table messages
-- email : adresse de l'expéditeur, utilisée uniquement pour ouvrir le
-- client e-mail de l'admin ("Répondre par e-mail", lien mailto:) — ANB
-- n'envoie jamais d'e-mail depuis l'outil pour ce flux (voir
-- db/migration-2026-08-25-messages-email.sql).
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Non lu',
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Table journal_activite
CREATE TABLE IF NOT EXISTS journal_activite (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  utilisateur_email TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  adresse_ip TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Table media_galerie
CREATE TABLE IF NOT EXISTS media_galerie (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom_fichier TEXT NOT NULL UNIQUE,
  titre TEXT NOT NULL,
  texte_alternatif TEXT NOT NULL,
  credit TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Photo',
  taille_octets INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- SEED DEMO DATA
-- Utilisateurs : AUCUN seed de compte ici (retiré — voir audit-auth.md §2/§15).
-- Les 5 comptes de démonstration partageaient tous le même mot de passe
-- de démonstration, pré-rempli en clair sur la page /connexion : accès
-- super_admin exploitable sans aucune connaissance préalable. Corrigé le
-- 2026-08-25 (Correction P0.1, audit-auth.md).
--
-- CONSÉQUENCE : une toute nouvelle installation à partir de ce schema.sql
-- ne contient plus aucun compte super_admin — pas de bootstrap possible
-- tant qu'un premier compte n'est pas créé manuellement (INSERT direct en
-- D1 avec un hash généré via hashPassword(), ou futur script de bootstrap
-- dédié). C'est un trou volontairement laissé visible, déjà identifié en
-- P1 de l'audit ("bootstrap sécurisé du premier super_admin") — non
-- résolu ici par choix, pas oublié.

-- Actualités : AUCUN seed ici (retiré, trouvé pendant la revue finale du
-- P0 authentification). Les 6 lignes de démonstration référençaient
-- auteur_id 1/2/3, qui n'existent plus depuis le retrait du seed
-- utilisateurs (Correction P0.1) — D1 impose les FOREIGN KEY par défaut,
-- donc une installation fraîche échouait entièrement à l'application de
-- schema.sql ("FOREIGN KEY constraint failed"), confirmé par test réel.
-- Retiré entièrement plutôt que de mettre auteur_id à NULL, par cohérence
-- avec le choix déjà fait pour utilisateurs : pas de contenu de
-- démonstration par défaut.

-- Événements
INSERT OR IGNORE INTO evenements (title, date, event_date, place, category, registered_count, max_places, status, inscriptions_ouvertes, bg_gradient) VALUES
('Journée culturelle nigérienne', '20 sept. 2026', '2026-09-20', 'Parc Bordelais', 'Culture', 86, 120, 'Ouvert', 1, 'linear-gradient(150deg,#176B4D,#1F2925)'),
('Tournoi de football amical', '12 oct. 2026', '2026-10-12', 'Stade Léo Lagrange', 'Sport', 40, 40, 'Ouvert', 1, 'linear-gradient(150deg,#E97824,#1F2925)'),
('Soirée d''entraide et collecte solidaire', '8 nov. 2026', '2026-11-08', 'Salle associative', 'Solidarité', 12, 80, 'Ouvert', 1, 'linear-gradient(150deg,#1F2925,#176B4D)'),
('Atelier CV et recherche d''emploi', '3 déc. 2026', '2026-12-03', 'Bordeaux', 'Formation', 0, 30, 'Annulé', 1, 'linear-gradient(150deg,#5a655f,#1F2925)'),
('Pique-nique communautaire', 'juin 2026', '2026-06-01', 'Bords de Garonne', 'Rencontre', 64, 64, 'Terminé', 1, 'linear-gradient(150deg,#E8D8BF,#176B4D)'),
('Repas de nouvel an', 'janvier 2026', '2026-01-01', 'Bordeaux', 'Rencontre', 58, 60, 'Terminé', 1, 'linear-gradient(150deg,#E97824,#E8D8BF)');

-- Adhésions
INSERT OR IGNORE INTO adhesions (name, email, motivation, status) VALUES
('Aïcha Boubacar', 'aicha.b@email.fr', 'Souhaite rejoindre pour retrouver la communauté et participer aux événements.', 'Nouvelle'),
('Ibrahim Moussa', 'ibrahim.m@email.fr', 'Nouvel arrivant à Bordeaux pour ses études, cherche à s''intégrer.', 'En attente'),
('Fatouma Idrissa', 'fatouma.i@email.fr', 'Souhaite devenir bénévole et adhérer à l''ANB.', 'Validée'),
('Souley Hassane', 'souley.h@email.fr', 'Renouvellement annuel de cotisation.', 'Renouvellement');

-- Messages
INSERT OR IGNORE INTO messages (from_name, email, subject, category, status, content) VALUES
('Aïcha B.', 'aicha.b@email.fr', 'Demande d''adhésion', 'Adhésion', 'À traiter', 'Bonjour, je souhaiterais rejoindre l''ANB et en savoir plus sur les prochains événements.'),
('Ibrahim M.', 'ibrahim.m@email.fr', 'Question sur le logement', 'Contact', 'Non lu', 'Bonjour, je cherche un logement étudiant à Bordeaux, pouvez-vous m''aider ?'),
('Fatou K.', 'fatou.k@email.fr', 'Proposition de bénévolat', 'Bénévolat', 'Traité', 'Je serais ravie d''aider pour le prochain événement, dites-moi comment m''organiser.'),
('Assane T.', 'assane.t@email.fr', 'Partenariat commerçant', 'Partenariat', 'Traité', 'Notre restaurant souhaite proposer une réduction aux membres de l''ANB.'),
('Mariam D.', 'mariam.d@email.fr', 'Question générale', 'Autre', 'Archivé', 'Bonjour, à quelle heure se termine la journée culturelle ?');

-- Inscriptions
INSERT OR IGNORE INTO inscriptions (event_id, first_name, last_name) VALUES
(1, 'Aïcha', 'Boubacar'),
(1, 'Ibrahim', 'Moussa'),
(1, 'Fatouma', 'Idrissa'),
(1, 'Souley', 'Hassane'),
(1, 'Mariam', 'Diallo');

-- Journal d'activité (Audit Logs)
INSERT OR IGNORE INTO journal_activite (utilisateur_email, role, action, details, adresse_ip) VALUES
('mariama.souley@anb-bordeaux.fr', 'Admin', 'Publication d''une actualité', 'Bienvenue aux nouveaux membres de l''ANB', '82.124.32.91'),
('nasser.diallo@anb-bordeaux.fr', 'Super Admin', 'Modification du rôle utilisateur', 'Fatou I. passe de Bénévole à Éditeur', '90.41.223.15'),
('nasser.diallo@anb-bordeaux.fr', 'Super Admin', 'Export de données', 'Justification : Contrôle annuel des inscrits', '90.41.223.15'),
('mariama.souley@anb-bordeaux.fr', 'Admin', 'Création d''un événement', 'Tournoi de football amical', '82.124.32.91'),
('fatou.ibrahim@anb-bordeaux.fr', 'Éditeur', 'Soumission pour validation', 'Portrait : parcours d''une étudiante', '78.232.112.5'),
('nasser.diallo@anb-bordeaux.fr', 'Super Admin', 'Connexion', 'Connexion depuis Bordeaux', '90.41.223.15');

-- Galerie Médias : volontairement AUCUN seed. media_galerie est
-- désormais la source de vérité de /galerie et de la galerie de la home
-- (P1.3) — y insérer des lignes fictives (comme avant) ferait apparaître
-- de fausses images dès l'installation, sans fichier R2 correspondant.
-- La galerie démarre vide ; elle se peuple via Admin/Super Admin → Galerie.

-- 9. Table site_settings (clé/valeur, éditable depuis le Super Admin)
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO site_settings (key, value) VALUES
('identite_nom', 'Association des Nigériens à Bordeaux'),
('identite_slogan', 'Ensemble, faire vivre la communauté nigérienne à Bordeaux.'),
('identite_email', 'anbordeaux33@outlook.fr'),
('identite_telephone', '07 58 62 42 84'),
-- Vide par défaut : aucune adresse de siège social réelle n'a encore été
-- fournie par le client (cf. mentions-legales.astro, "en cours de
-- finalisation"). Ne jamais y mettre une adresse inventée.
('identite_adresse', ''),
('seo_titre', 'ANB — Association des Nigériens à Bordeaux'),
('seo_description', 'Communauté nigérienne à Bordeaux : événements, entraide et accompagnement.');

-- 10. Table recensement
CREATE TABLE IF NOT EXISTS recensement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  status TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  origine TEXT DEFAULT '',
  annee_arrivee TEXT DEFAULT '',
  domaine TEXT DEFAULT '',
  benevole INTEGER DEFAULT 0,
  rgpd_consent INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Table equipe (bloc Bureau/Équipe de /association)
-- photo : clé R2 (nom_fichier), nullable — repli visuel si absente, jamais
-- de photo inventée. Volontairement AUCUN seed : ne jamais insérer les
-- vrais membres du bureau sans validation du client (voir aussi
-- db/migration-2026-08-25-equipe.sql).
CREATE TABLE IF NOT EXISTS equipe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  fonction TEXT NOT NULL,
  photo TEXT,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
