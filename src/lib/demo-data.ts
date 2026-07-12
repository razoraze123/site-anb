// Données de démonstration — à remplacer par des données réelles (D1) en phase 5+.
// Ne jamais présenter ce contenu comme des informations officielles de l'ANB.

export const navItems = [
  { href: '/', label: 'Accueil' },
  { href: '/association', label: "L'association" },
  { href: '/evenements', label: 'Événements' },
  { href: '/actualites', label: 'Actualités' },
  { href: '/vie-pratique', label: 'Vie pratique' },
  { href: '/culture-nigerienne', label: 'Culture nigérienne' },
  { href: '/contact', label: 'Contact' },
] as const;

export const homeGallery = [
  { bg: 'linear-gradient(150deg,#176B4D,#1F2925)', span: 2, label: 'Repas communautaire' },
  { bg: 'linear-gradient(150deg,#E97824,#E8D8BF)', span: 1, label: 'Journée culturelle' },
  { bg: 'linear-gradient(150deg,#1F2925,#176B4D)', span: 1, label: 'Bénévoles en action' },
  { bg: 'linear-gradient(150deg,#E8D8BF,#E97824)', span: 2, label: 'Musique et danse' },
  { bg: 'linear-gradient(150deg,#176B4D,#E97824)', span: 1, label: 'Rencontre des familles' },
  { bg: 'linear-gradient(150deg,#E97824,#1F2925)', span: 1, label: 'Sport communautaire' },
  { bg: 'linear-gradient(150deg,#1F2925,#E8D8BF)', span: 1, label: 'Sourires partagés' },
  { bg: 'linear-gradient(150deg,#E8D8BF,#176B4D)', span: 1, label: 'Artistes locaux' },
] as const;

export const newsArticles = [
  {
    category: 'Communauté',
    date: '2 juillet 2026',
    title: 'Retour sur notre dernière rencontre communautaire',
    excerpt: "Plus de 80 personnes réunies pour un après-midi de partage, de musique et de repas fait maison.",
    bg: 'linear-gradient(150deg,#176B4D,#1F2925)',
  },
  {
    category: 'Vie associative',
    date: '18 juin 2026',
    title: "Bienvenue aux nouveaux membres de l'ANB",
    excerpt: "Ce trimestre, notre communauté s'agrandit : découvrez les nouveaux visages qui nous rejoignent.",
    bg: 'linear-gradient(150deg,#E97824,#E8D8BF)',
  },
  {
    category: 'Bénévolat',
    date: '5 juin 2026',
    title: 'Appel à bénévoles pour notre prochain événement',
    excerpt: "La Journée culturelle nigérienne approche : nous avons besoin de bras et de bonnes volontés.",
    bg: 'linear-gradient(150deg,#E8D8BF,#176B4D)',
  },
] as const;

export const nextEvent = {
  date: 'Samedi 20 septembre',
  title: 'Journée culturelle nigérienne',
  place: 'Bordeaux Métropole',
  description: "Musique, danses, gastronomie et rencontres : une journée pour célébrer nos traditions et partager la richesse de notre culture avec toute la métropole.",
};

export const events = [
  { id: 1, date: 'Samedi 20 septembre 2026', title: 'Journée culturelle nigérienne', place: 'Parc Bordelais, Bordeaux', desc: "Musique, danses, gastronomie et rencontres pour célébrer nos traditions, ouvert à tous.", category: 'Culture', color: '#176B4D', isPast: false },
  { id: 2, date: 'Dimanche 12 octobre 2026', title: 'Tournoi de football amical', place: 'Stade Léo Lagrange, Bordeaux', desc: 'Un tournoi convivial entre équipes de la communauté et amis du Niger.', category: 'Sport', color: '#E97824', isPast: false },
  { id: 3, date: 'Samedi 8 novembre 2026', title: "Soirée d'entraide et collecte solidaire", place: 'Salle associative, Bordeaux', desc: "Une collecte pour soutenir des familles et des projets solidaires au Niger.", category: 'Solidarité', color: '#1F2925', isPast: false },
  { id: 4, date: 'Juin 2026', title: 'Pique-nique communautaire', place: 'Bords de Garonne, Bordeaux', desc: "Un après-midi convivial entre familles, au bord de l'eau.", category: 'Rencontres', color: '#176B4D', isPast: true },
  { id: 5, date: 'Mars 2026', title: 'Soirée musique et poésie', place: 'Bordeaux', desc: 'Une soirée dédiée aux artistes nigériens de la région.', category: 'Culture', color: '#E97824', isPast: true },
  { id: 6, date: 'Janvier 2026', title: "Repas de nouvel an de l'ANB", place: 'Bordeaux', desc: "Le traditionnel repas partagé pour bien commencer l'année ensemble.", category: 'Rencontres', color: '#1F2925', isPast: true },
] as const;

export const eventFilters = ['Tous', 'Culture', 'Solidarité', 'Sport', 'Rencontres'] as const;

export const teamMembers = [
  { name: 'Prénom Nom', role: 'Président', bg: 'linear-gradient(150deg,#176B4D,#1F2925)' },
  { name: 'Prénom Nom', role: 'Vice-Présidente', bg: 'linear-gradient(150deg,#E97824,#E8D8BF)' },
  { name: 'Prénom Nom', role: 'Trésorier', bg: 'linear-gradient(150deg,#1F2925,#176B4D)' },
  { name: 'Prénom Nom', role: 'Secrétaire générale', bg: 'linear-gradient(150deg,#E8D8BF,#E97824)' },
  { name: 'Prénom Nom', role: 'Responsable culture', bg: 'linear-gradient(150deg,#176B4D,#E97824)' },
  { name: 'Prénom Nom', role: 'Responsable solidarité', bg: 'linear-gradient(150deg,#E97824,#1F2925)' },
] as const;

export const timeline = [
  { year: '20XX', text: "Création de l'association par un groupe d'étudiants et de familles nigériennes de Bordeaux." },
  { year: '20XX', text: "Premiers événements culturels et mise en place d'un réseau d'entraide pour les nouveaux arrivants." },
  { year: '20XX', text: 'Structuration du bureau et lancement des actions solidaires en direction du Niger.' },
  { year: "Aujourd'hui", text: 'Une communauté active, des événements réguliers et un accompagnement renforcé pour chacun.' },
] as const;

export const fullGallery = [
  ...homeGallery,
  ...homeGallery.map((g, i) => ({ ...g, label: `${g.label} — ${i + 2}` })),
];
