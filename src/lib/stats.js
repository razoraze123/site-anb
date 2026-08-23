// Source de vérité unique pour les 4 KPI communs aux dashboards Admin et
// Super Admin. Calculés côté serveur (agrégations SQL), jamais en chargeant
// des tables entières dans le navigateur pour faire un .length/.filter().
//
// Définitions (ne pas dévier sans mettre à jour ce commentaire ET
// BACKLOG.md) :
// - Événements à venir : statut Ouvert (jamais Terminé/Annulé) ET dont la
//   vraie date événementielle (`evenements.event_date`, ISO AAAA-MM-JJ —
//   PAS le texte affiché `date`) est aujourd'hui ou dans le futur. C'est la
//   colonne introduite pour le tri chronologique du calendrier événements ;
//   c'est la seule source de date fiable du projet, on ne réintroduit pas
//   de comparaison sur le texte libre `date`.
// - Inscriptions aux événements : COUNT(*) sur `inscriptions`, TOUTES
//   confondues, tous événements. C'est un nombre de LIGNES, jamais un
//   nombre de personnes distinctes — pas de DISTINCT sur first_name/
//   last_name, pas de lien avec `recensement` (les deux tables sont et
//   restent indépendantes).
// - Actualités publiées : COUNT(*) sur `actualites` WHERE status = 'Publié'.
// - Personnes recensées : COUNT(*) sur `recensement`. L'email y est UNIQUE,
//   donc ce compte représente bien des personnes distinctes (contrairement
//   aux inscriptions).
export async function getCommonKpis(db) {
  const [evenementsAVenir, inscriptionsEvenements, actualitesPubliees, personnesRecensees] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM evenements WHERE status = 'Ouvert' AND event_date >= date('now')").first(),
    db.prepare("SELECT COUNT(*) AS n FROM inscriptions").first(),
    db.prepare("SELECT COUNT(*) AS n FROM actualites WHERE status = 'Publié'").first(),
    db.prepare("SELECT COUNT(*) AS n FROM recensement").first(),
  ]);

  return {
    evenements_a_venir: evenementsAVenir.n,
    inscriptions_evenements: inscriptionsEvenements.n,
    actualites_publiees: actualitesPubliees.n,
    personnes_recensees: personnesRecensees.n,
  };
}
