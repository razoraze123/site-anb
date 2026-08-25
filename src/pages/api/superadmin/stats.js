import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { getCommonKpis } from "../../../lib/stats.js";

export const prerender = false;

// Uniquement des agrégats sur les tables existantes (pas de pageviews/trafic :
// aucun outil d'analytics n'est branché sur le site, donc rien n'est inventé
// ici — voir latest_articles/upcoming_events en remplacement des "pages les
// plus vues" fictives du mock d'origine).
//
// "Adhésion" et "recensement" désignent la même démarche côté site public
// (/adherer poste vers /api/recensement, table `recensement`) — la table
// `adhesions` n'est alimentée par aucun formulaire réel (seulement 4 lignes
// de seed figées) et n'est donc jamais utilisée ici.
const PERIOD_DAYS = { '7': 7, '30': 30, '90': 90, '365': 365 };

export async function GET(context) {
  try {
    const user = await requireRole(context, ['super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { searchParams } = new URL(context.request.url);
    const days = PERIOD_DAYS[searchParams.get('period')] || 30;
    const sinceExpr = `datetime('now', '-${days} days')`;

    // Les 4 KPI communs avec le dashboard Admin (membres/personnes
    // recensées, événements à venir, inscriptions aux événements,
    // actualités publiées) viennent tous de lib/stats.js — source de
    // vérité unique, mêmes requêtes SQL que celles utilisées par
    // /api/admin/kpis pour l'espace Admin. Ne plus dupliquer ces calculs
    // ici.
    const [
      commonKpis, recensementCeMois, messagesATraiter,
      adminsActifs, comptesDesactives, recensementPeriode,
      recentJournal, latestArticles, upcomingEvents,
      messagesNonTraites7j, evenementsSansImage, inscriptionsPeriode,
    ] = await Promise.all([
      getCommonKpis(db),
      db.prepare("SELECT COUNT(*) AS n FROM recensement WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')").first(),
      db.prepare("SELECT COUNT(*) AS n FROM messages WHERE status IN ('Non lu', 'À traiter')").first(),
      db.prepare("SELECT COUNT(*) AS n FROM utilisateurs WHERE role IN ('admin','super_admin') AND statut = 'actif'").first(),
      db.prepare("SELECT COUNT(*) AS n FROM utilisateurs WHERE statut = 'desactive'").first(),
      db.prepare(`SELECT COUNT(*) AS n FROM recensement WHERE created_at >= ${sinceExpr}`).first(),
      db.prepare("SELECT utilisateur_email, role, action, details, created_at FROM journal_activite ORDER BY created_at DESC LIMIT 5").all(),
      db.prepare("SELECT title, category, status, created_at FROM actualites ORDER BY created_at DESC LIMIT 5").all(),
      db.prepare("SELECT title, date, place FROM evenements WHERE status = 'Ouvert' ORDER BY created_at DESC LIMIT 5").all(),
      // Messages non traités depuis plus de 7 jours — pour "Attention
      // requise" de la Vue d'ensemble (maquette d'origine : "3 demandes
      // d'adhésion n'ont pas été traitées depuis plus de 7 jours" ;
      // reformulé sur les messages, seule donnée réelle équivalente — le
      // recensement n'a aucun état "en attente de traitement").
      db.prepare("SELECT COUNT(*) AS n FROM messages WHERE status IN ('Non lu', 'À traiter') AND created_at <= datetime('now', '-7 days')").first(),
      // Événements à venir sans vraie image de couverture (bg_gradient
      // encore au dégradé par défaut, jamais remplacé par une URL R2) —
      // même logique que isImageUrl() côté client (lib/adminContent.js).
      db.prepare("SELECT COUNT(*) AS n FROM evenements WHERE status = 'Ouvert' AND event_date >= date('now') AND bg_gradient NOT LIKE '/%' AND bg_gradient NOT LIKE 'http%'").first(),
      // Inscriptions sur la période sélectionnée — distinct du KPI commun
      // (toujours le total non filtré, lib/stats.js) : ne le remplace pas,
      // n'alimente que la carte "Inscriptions aux événements" de
      // Statistiques globales.
      db.prepare(`SELECT COUNT(*) AS n FROM inscriptions WHERE created_at >= ${sinceExpr}`).first(),
    ]);

    // Pas de file d'attente pour le recensement (contrairement aux messages) :
    // chaque soumission est enregistrée directement, il n'y a rien à valider.
    const attention = [];
    if (messagesATraiter.n > 0) {
      attention.push(`${messagesATraiter.n} message(s) non lu(s) ou à traiter.`);
    }
    if (comptesDesactives.n > 0) {
      attention.push(`${comptesDesactives.n} compte(s) administrateur désactivé(s).`);
    }

    return new Response(JSON.stringify({
      overview: {
        // membres/evenements_a_venir/inscriptions_evenements/
        // actualites_publiees : source unique lib/stats.js, identique à
        // /api/admin/kpis.
        membres: commonKpis.personnes_recensees,
        adhesions_ce_mois: recensementCeMois.n,
        evenements_a_venir: commonKpis.evenements_a_venir,
        inscriptions_evenements: commonKpis.inscriptions_evenements,
        actualites_publiees: commonKpis.actualites_publiees,
        demandes_a_traiter: messagesATraiter.n,
        admins_actifs: adminsActifs.n,
        comptes_desactives: comptesDesactives.n,
        messages_non_traites_7j: messagesNonTraites7j.n,
        evenements_sans_image: evenementsSansImage.n,
      },
      attention,
      recent_activity: recentJournal.results,
      period_days: days,
      period_stats: {
        adhesions: recensementPeriode.n,
        inscriptions: inscriptionsPeriode.n,
      },
      latest_articles: latestArticles.results,
      upcoming_events: upcomingEvents.results,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
