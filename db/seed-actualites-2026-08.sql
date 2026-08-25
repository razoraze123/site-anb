-- 5 actualités réelles ajoutées le 2026-08-23, à la demande du client :
-- 3 dates passées, 2 dates futures (rentrée 2026).
-- Catégories limitées à celles réellement proposées dans le formulaire
-- admin (Communauté, Vie associative, Bénévolat, Culture, Solidarité).
-- MAJ 2026-08-23 : le statut "Programmé" a été retiré du fonctionnement de
-- l'app (un admin/super-admin publie toujours directement) — les 2 articles
-- à date future sont donc en "Publié" comme les autres, malgré leur date de
-- création future affichée dans le tri.

INSERT INTO actualites (title, slug, excerpt, content, category, auteur_id, status, bg_gradient, created_at) VALUES
(
  'Distribution de vêtements chauds : merci à tous les bénévoles',
  'distribution-vetements-chauds-2026',
  'Retour sur notre collecte et distribution de vêtements chauds organisée ce printemps pour accompagner les nouveaux arrivants avant l''hiver.',
  'Grâce à la mobilisation de nos bénévoles et aux dons de nombreux membres de la communauté, l''ANB a pu distribuer plus de 80 manteaux, pulls et couvertures aux familles et étudiants nouvellement arrivés à Bordeaux. Un grand merci à toutes celles et ceux qui ont participé à la collecte, ainsi qu''aux commerçants partenaires qui nous ont ouvert leurs portes. Cette action sera reconduite chaque année à l''approche de l''hiver.',
  'Solidarité',
  2,
  'Publié',
  'linear-gradient(150deg,#176B4D,#1F2925)',
  '2026-05-12 10:00:00'
),
(
  'Assemblée générale 2026 : un nouveau bureau élu',
  'assemblee-generale-2026',
  'Retour sur notre assemblée générale annuelle, l''occasion de faire le bilan de l''année et d''élire le nouveau bureau de l''association.',
  'Une trentaine de membres se sont réunis pour cette assemblée générale, marquée par la présentation du bilan moral et financier de l''année écoulée. Le bureau a été reconduit avec quelques nouvelles arrivées parmi les bénévoles actifs. Plusieurs projets pour l''année à venir ont été évoqués, notamment le renforcement de l''accompagnement des nouveaux étudiants et l''organisation d''événements culturels supplémentaires.',
  'Vie associative',
  1,
  'Publié',
  'linear-gradient(150deg,#E97824,#E8D8BF)',
  '2026-06-20 18:30:00'
),
(
  'Portrait : Aïcha, bénévole depuis les débuts de l''ANB',
  'portrait-aicha-benevole',
  'Rencontre avec Aïcha Boubacar, bénévole depuis les tout premiers pas de l''association, qui revient sur son engagement au service de la communauté nigérienne de Bordeaux.',
  'Arrivée à Bordeaux il y a plusieurs années, Aïcha fait partie des membres fondateurs de l''ANB. Elle raconte comment l''association est née d''un simple groupe d''entraide entre étudiants avant de devenir la structure que l''on connaît aujourd''hui. « Ce qui me tient à cœur, c''est qu''aucun nouvel arrivant ne se sente seul à Bordeaux », confie-t-elle. Elle continue aujourd''hui d''accompagner les nouveaux membres dans leurs démarches administratives et leur installation.',
  'Communauté',
  3,
  'Publié',
  'linear-gradient(150deg,#1F2925,#E97824)',
  '2026-07-28 09:15:00'
),
(
  'Reprise des permanences d''accueil pour les nouveaux étudiants',
  'reprise-permanences-accueil-etudiants',
  'À l''approche de la rentrée, l''ANB reprend ses permanences d''accueil pour aider les nouveaux étudiants nigériens dans leurs démarches à Bordeaux.',
  'Comme chaque année, l''association tiendra des permanences pour accompagner les nouveaux arrivants dans leurs premières démarches : logement, inscription universitaire, ouverture de compte bancaire et titre de séjour. Ces permanences seront animées par des bénévoles expérimentés, disponibles pour répondre aux questions et orienter chacun vers les bonnes ressources. Toutes les informations pratiques seront prochainement publiées sur la page Vie pratique du site.',
  'Communauté',
  2,
  'Publié',
  'linear-gradient(150deg,#176B4D,#E97824)',
  '2026-09-18 08:00:00'
),
(
  'L''ANB signe un partenariat avec le CROUS de Bordeaux',
  'partenariat-crous-bordeaux',
  'L''ANB annonce un partenariat avec le CROUS de Bordeaux pour faciliter l''accès au logement et aux aides sociales des étudiants nigériens.',
  'Ce nouveau partenariat doit permettre de simplifier l''orientation des étudiants membres de l''ANB vers les dispositifs d''aide du CROUS : logement en résidence universitaire, bourses et aides d''urgence. Une session d''information conjointe sera organisée à la rentrée pour présenter ces dispositifs à l''ensemble de la communauté. L''association continue ainsi de développer ses partenariats locaux au bénéfice de ses membres.',
  'Vie associative',
  1,
  'Publié',
  'linear-gradient(150deg,#E8D8BF,#176B4D)',
  '2026-10-10 14:00:00'
);
