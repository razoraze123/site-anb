import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";

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

    // "membres" (label affiché : "Personnes recensées") = COUNT(*) sur
    // `recensement`, distinct de `inscriptions` : les deux tables n'ont
    // aucune relation entre elles (voir BACKLOG.md). "inscriptionsPeriode"
    // = nombre total de lignes de `inscriptions`, pas un nombre de
    // personnes distinctes (pas de notion fiable de participant unique
    // dans ce modèle). "evenementsAVenir" = statut Ouvert uniquement
    // (jamais Terminé/Annulé) — même définition que le KPI "Événements à
    // venir" du dashboard Admin.
    const [
      membres, recensementCeMois, evenementsAVenir, messagesATraiter,
      adminsActifs, comptesDesactives, inscriptionsPeriode, recensementPeriode,
      recentJournal, latestArticles, upcomingEvents
    ] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS n FROM recensement").first(),
      db.prepare("SELECT COUNT(*) AS n FROM recensement WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')").first(),
      db.prepare("SELECT COUNT(*) AS n FROM evenements WHERE status = 'Ouvert'").first(),
      db.prepare("SELECT COUNT(*) AS n FROM messages WHERE status IN ('Non lu', 'À traiter')").first(),
      db.prepare("SELECT COUNT(*) AS n FROM utilisateurs WHERE role IN ('admin','super_admin') AND statut = 'actif'").first(),
      db.prepare("SELECT COUNT(*) AS n FROM utilisateurs WHERE statut = 'desactive'").first(),
      db.prepare(`SELECT COUNT(*) AS n FROM inscriptions WHERE created_at >= ${sinceExpr}`).first(),
      db.prepare(`SELECT COUNT(*) AS n FROM recensement WHERE created_at >= ${sinceExpr}`).first(),
      db.prepare("SELECT utilisateur_email, role, action, details, created_at FROM journal_activite ORDER BY created_at DESC LIMIT 5").all(),
      db.prepare("SELECT title, category, status, created_at FROM actualites ORDER BY created_at DESC LIMIT 5").all(),
      db.prepare("SELECT title, date, place FROM evenements WHERE status = 'Ouvert' ORDER BY created_at DESC LIMIT 5").all(),
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
        membres: membres.n,
        adhesions_ce_mois: recensementCeMois.n,
        evenements_a_venir: evenementsAVenir.n,
        demandes_a_traiter: messagesATraiter.n,
        admins_actifs: adminsActifs.n,
        comptes_desactives: comptesDesactives.n,
      },
      attention,
      recent_activity: recentJournal.results,
      period_days: days,
      period_stats: {
        inscriptions: inscriptionsPeriode.n,
        adhesions: recensementPeriode.n,
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
