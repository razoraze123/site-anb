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
