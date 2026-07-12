-- Complete Database Schema for ANB Bordeaux Platform (D1 SQL)

-- 1. Table utilisateurs
CREATE TABLE IF NOT EXISTS utilisateurs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mot_de_passe TEXT NOT NULL,
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auteur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL
);

-- 3. Table evenements
CREATE TABLE IF NOT EXISTS evenements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  place TEXT NOT NULL,
  category TEXT NOT NULL,
  registered_count INTEGER DEFAULT 0,
  max_places INTEGER DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'Ouvert',
  bg_gradient TEXT NOT NULL,
  tab TEXT NOT NULL DEFAULT 'À venir',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table inscriptions
CREATE TABLE IF NOT EXISTS inscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Confirmé',
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
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_name TEXT NOT NULL,
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
-- Utilisateurs (Passwords hashed roughly in mock or plaintext for demo, here 'demo1234')
INSERT OR IGNORE INTO utilisateurs (id, nom, email, mot_de_passe, role, statut) VALUES
(1, 'Nasser Diallo', 'nasser.diallo@anb-bordeaux.fr', 'demo1234', 'super_admin', 'actif'),
(2, 'Mariama Souley', 'mariama.souley@anb-bordeaux.fr', 'demo1234', 'admin', 'actif'),
(3, 'Fatou Ibrahim', 'fatou.ibrahim@anb-bordeaux.fr', 'demo1234', 'editeur', 'actif'),
(4, 'Aïcha Boubacar', 'aicha.boubacar@anb-bordeaux.fr', 'demo1234', 'admin', 'actif'),
(5, 'Ibrahim Moussa', 'ibrahim.moussa@anb-bordeaux.fr', 'demo1234', 'super_admin', 'desactive');

-- Actualités
INSERT OR IGNORE INTO actualites (title, slug, excerpt, content, category, auteur_id, status, bg_gradient) VALUES
('Retour sur notre dernière rencontre communautaire', 'retour-rencontre-communautaire', 'Résumé chaleureux de notre dernière assemblée.', 'Le contenu détaillé du bilan de la rencontre associative...', 'Communauté', 2, 'Publié', 'linear-gradient(150deg,#176B4D,#1F2925)'),
('Bienvenue aux nouveaux membres de l''ANB', 'bienvenue-nouveaux-membres', 'Un message d''accueil pour tous les nouveaux adhérents de la métropole.', 'Bienvenue à tous et toutes ! L''association grandit...', 'Vie associative', 2, 'Publié', 'linear-gradient(150deg,#E97824,#E8D8BF)'),
('Appel à bénévoles pour notre prochain événement', 'appel-benevoles-evenement', 'Nous recherchons des forces vives pour l''organisation logistique.', 'Nous avons besoin d''aide pour installer les stands...', 'Bénévolat', 3, 'Publié', 'linear-gradient(150deg,#E8D8BF,#176B4D)'),
('Portrait : parcours d''une étudiante nigérienne à Bordeaux', 'portrait-parcours-etudiante', 'Découvrez le témoignage de Fatouma sur son arrivée et ses études.', 'Arrivée en 2025 pour suivre son master en informatique...', 'Portraits', 3, 'Brouillon', 'linear-gradient(150deg,#1F2925,#E97824)'),
('Journée culturelle 2026 : le programme complet', 'journee-culturelle-programme', 'Consultez les horaires et les détails des animations du 20 septembre.', 'Le programme complet de notre grande journée annuelle...', 'Événements', 2, 'Programmé', 'linear-gradient(150deg,#176B4D,#E97824)'),
('Bilan de la collecte solidaire 2025', 'bilan-collecte-solidaire-2025', 'Merci à tous les donateurs pour la collecte d''hiver.', 'Grâce à vos dons, nous avons pu aider...', 'Solidarité', 1, 'Archivé', 'linear-gradient(150deg,#5a655f,#1F2925)');

-- Événements
INSERT OR IGNORE INTO evenements (title, date, place, category, registered_count, max_places, status, bg_gradient, tab) VALUES
('Journée culturelle nigérienne', '20 sept. 2026', 'Parc Bordelais', 'Culture', 86, 120, 'Ouvert', 'linear-gradient(150deg,#176B4D,#1F2925)', 'À venir'),
('Tournoi de football amical', '12 oct. 2026', 'Stade Léo Lagrange', 'Sport', 40, 40, 'Complet', 'linear-gradient(150deg,#E97824,#1F2925)', 'À venir'),
('Soirée d''entraide et collecte solidaire', '8 nov. 2026', 'Salle associative', 'Solidarité', 12, 80, 'Ouvert', 'linear-gradient(150deg,#1F2925,#176B4D)', 'À venir'),
('Atelier CV et recherche d''emploi', '3 déc. 2026', 'Bordeaux', 'Formation', 0, 30, 'Annulé', 'linear-gradient(150deg,#5a655f,#1F2925)', 'Annulés'),
('Pique-nique communautaire', 'juin 2026', 'Bords de Garonne', 'Rencontre', 64, 64, 'Terminé', 'linear-gradient(150deg,#E8D8BF,#176B4D)', 'Passés'),
('Repas de nouvel an', 'janvier 2026', 'Bordeaux', 'Rencontre', 58, 60, 'Terminé', 'linear-gradient(150deg,#E97824,#E8D8BF)', 'Passés'),
('Soirée musique — édition 2027', 'à définir', '—', 'Culture', 0, 100, 'Brouillon', 'linear-gradient(150deg,#1F2925,#E8D8BF)', 'Brouillons');

-- Adhésions
INSERT OR IGNORE INTO adhesions (name, email, motivation, status) VALUES
('Aïcha Boubacar', 'aicha.b@email.fr', 'Souhaite rejoindre pour retrouver la communauté et participer aux événements.', 'Nouvelle'),
('Ibrahim Moussa', 'ibrahim.m@email.fr', 'Nouvel arrivant à Bordeaux pour ses études, cherche à s''intégrer.', 'En attente'),
('Fatouma Idrissa', 'fatouma.i@email.fr', 'Souhaite devenir bénévole et adhérer à l''ANB.', 'Validée'),
('Souley Hassane', 'souley.h@email.fr', 'Renouvellement annuel de cotisation.', 'Renouvellement');

-- Messages
INSERT OR IGNORE INTO messages (from_name, subject, category, status, content) VALUES
('Aïcha B.', 'Demande d''adhésion', 'Adhésion', 'À traiter', 'Bonjour, je souhaiterais rejoindre l''ANB et en savoir plus sur les prochains événements.'),
('Ibrahim M.', 'Question sur le logement', 'Contact', 'Non lu', 'Bonjour, je cherche un logement étudiant à Bordeaux, pouvez-vous m''aider ?'),
('Fatou K.', 'Proposition de bénévolat', 'Bénévolat', 'Traité', 'Je serais ravie d''aider pour le prochain événement, dites-moi comment m''organiser.'),
('Assane T.', 'Partenariat commerçant', 'Partenariat', 'Traité', 'Notre restaurant souhaite proposer une réduction aux membres de l''ANB.'),
('Mariam D.', 'Question générale', 'Autre', 'Archivé', 'Bonjour, à quelle heure se termine la journée culturelle ?');

-- Inscriptions
INSERT OR IGNORE INTO inscriptions (event_id, first_name, last_name, email, phone, status) VALUES
(1, 'Aïcha', 'Boubacar', 'aicha.b@email.fr', '06 12 34 56 78', 'Confirmé'),
(1, 'Ibrahim', 'Moussa', 'ibrahim.m@email.fr', '06 23 45 67 89', 'Confirmé'),
(1, 'Fatouma', 'Idrissa', 'fatouma.i@email.fr', '06 34 56 78 90', 'En attente'),
(1, 'Souley', 'Hassane', 'souley.h@email.fr', '06 45 67 89 01', 'Confirmé'),
(1, 'Mariam', 'Diallo', 'mariam.d@email.fr', '06 56 78 90 12', 'Liste d''attente'),
(1, 'Assane', 'Traoré', 'assane.t@email.fr', '06 67 89 01 23', 'Annulé');

-- Journal d'activité (Audit Logs)
INSERT OR IGNORE INTO journal_activite (utilisateur_email, role, action, details, adresse_ip) VALUES
('mariama.souley@anb-bordeaux.fr', 'Admin', 'Publication d''une actualité', 'Bienvenue aux nouveaux membres de l''ANB', '82.124.32.91'),
('nasser.diallo@anb-bordeaux.fr', 'Super Admin', 'Modification du rôle utilisateur', 'Fatou I. passe de Bénévole à Éditeur', '90.41.223.15'),
('nasser.diallo@anb-bordeaux.fr', 'Super Admin', 'Export de données', 'Justification : Contrôle annuel des inscrits', '90.41.223.15'),
('mariama.souley@anb-bordeaux.fr', 'Admin', 'Création d''un événement', 'Tournoi de football amical', '82.124.32.91'),
('fatou.ibrahim@anb-bordeaux.fr', 'Éditeur', 'Soumission pour validation', 'Portrait : parcours d''une étudiante', '78.232.112.5'),
('nasser.diallo@anb-bordeaux.fr', 'Super Admin', 'Connexion', 'Connexion depuis Bordeaux', '90.41.223.15');

-- Galerie Médias
INSERT OR IGNORE INTO media_galerie (nom_fichier, titre, texte_alternatif, credit, type, taille_octets) VALUES
('photos/galerie_1.jpg', 'Moment de partage traditionnel', 'Membres partageant un repas traditionnel', 'ANB Bordeaux', 'Photo', 2048500),
('photos/galerie_2.jpg', 'Danses et célébrations', 'Groupe de danse traditionnelle nigérienne', 'ANB Bordeaux', 'Photo', 1850320),
('videos/galerie_3.mp4', 'Vidéo récapitulative Journée Culturelle', 'Vidéo montrant les temps forts de l''événement', 'ANB Bordeaux', 'Vidéo', 15482000),
('photos/galerie_4.jpg', 'Atelier de cuisine traditionnelle', 'Préparation du riz au gras', 'ANB Bordeaux', 'Photo', 980450),
('photos/galerie_5.jpg', 'Remise d''équipements sportifs', 'Membres de l''équipe de football réunis', 'ANB Bordeaux', 'Photo', 1230400),
('videos/galerie_6.mp4', 'Présentation des danses', 'Vidéo des danseurs au parc', 'ANB Bordeaux', 'Vidéo', 8700500);

-- 9. Table recensement
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
