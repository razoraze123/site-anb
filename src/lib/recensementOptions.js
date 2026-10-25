// Listes de référence du recensement — seule source de vérité, partagée par :
// - le formulaire public (src/pages/adherer.astro : <option> et icônes) ;
// - l'admin (src/lib/adminContent.js : onglets de filtre du recensement) ;
// - l'API (src/pages/api/recensement.js : refus de toute valeur hors liste).
// `value` est ce qui est stocké en base (recensement.status / .domaine) :
// le changer impose de migrer les lignes existantes.

export const RECENSEMENT_STATUTS = [
  { value: 'Étudiant', label: 'Étudiant(e)', pluriel: 'Étudiants', icon: '🎓' },
  { value: 'Salarié', label: 'Salarié(e)', pluriel: 'Salariés', icon: '💼' },
  { value: "Chercheur d'emploi", label: "Chercheur(se) d'emploi", pluriel: "Chercheurs d'emploi", icon: '🔍' },
  { value: 'Entrepreneur / Indépendant', label: 'Entrepreneur(e) / Indépendant(e)', pluriel: 'Entrepreneurs / Indépendants', icon: '💡' },
  { value: 'Commerçant / Artisan', label: 'Commerçant(e) / Artisan(e)', pluriel: 'Commerçants / Artisans', icon: '🏪' },
  { value: 'En exil', label: 'En exil', pluriel: 'En exil', icon: '🌍' },
  { value: 'Retraité', label: 'Retraité(e)', pluriel: 'Retraités', icon: '🧓' },
  { value: 'Sans activité professionnelle', label: 'Sans activité professionnelle', pluriel: 'Sans activité', icon: '🧭' },
  { value: 'Au foyer', label: 'Au foyer', pluriel: 'Au foyer', icon: '🏠' },
  { value: 'Autre', label: 'Autre situation', pluriel: 'Autre', icon: '➕' },
];

// Domaine facultatif : chaîne vide acceptée en plus de ces valeurs.
export const RECENSEMENT_DOMAINES = [
  { value: 'Informatique / Tech', icon: '💻' },
  { value: 'Santé / Médecine', icon: '🩺' },
  { value: 'Droit / Sciences politiques', icon: '⚖️' },
  { value: 'Sciences économiques / Commerce', icon: '📈' },
  { value: "Sciences de l'ingénieur", icon: '⚙️' },
  { value: 'Arts / Culture / Communication', icon: '🎨' },
  { value: 'Éducation / Formation', icon: '📚' },
  { value: 'BTP / Architecture', icon: '🏗️' },
  { value: 'Agriculture / Environnement', icon: '🌱' },
  { value: 'Restauration / Hôtellerie', icon: '🍽️' },
  { value: 'Autre', icon: '➕' },
];
