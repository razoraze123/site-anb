import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { logActivity } from "../../../lib/journal.js";

export const prerender = false;

const PERIOD_DAYS = { '30': 30, '90': 90, '365': 365 };

// Note : "adhésion" et "recensement" sont la même démarche côté site
// public — /adherer poste vers /api/recensement (voir la table
// `recensement`). L'ancienne table `adhesions` n'est plus alimentée par
// aucun formulaire réel (seulement 4 lignes de seed figées depuis le
// début) ; l'export ci-dessous porte donc sur `recensement`, la vraie
// source de données.
const SOURCES = {
  recensement: {
    label: 'Recensement (adhésions)',
    columns: ['first_name', 'last_name', 'status', 'phone', 'email', 'origine', 'annee_arrivee', 'domaine', 'benevole', 'rgpd_consent', 'created_at'],
  },
  inscriptions: {
    label: 'Inscriptions aux événements',
    columns: ['event_id', 'first_name', 'last_name', 'created_at'],
  },
  messages: {
    label: 'Messages de contact',
    columns: ['from_name', 'subject', 'category', 'status', 'content', 'created_at'],
  },
};

function toCsv(rows, columns) {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.join(';')];
  for (const row of rows) {
    lines.push(columns.map((c) => escape(row[c])).join(';'));
  }
  return lines.join('\n');
}

// Génère un export CSV multi-sections (une table par section), tracé dans
// le journal d'activité avec la raison fournie — champ obligatoire.
export async function POST(context) {
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

    const body = await context.request.json();
    const { include, period, reason } = body;

    if (!reason || !reason.trim()) {
      return new Response(JSON.stringify({ error: "La raison de l'export est obligatoire." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const selected = (Array.isArray(include) ? include : []).filter((k) => SOURCES[k]);
    if (selected.length === 0) {
      return new Response(JSON.stringify({ error: "Sélectionnez au moins une source de données." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const days = PERIOD_DAYS[period];
    const sections = [];
    for (const key of selected) {
      const src = SOURCES[key];
      const query = days
        ? `SELECT * FROM ${key} WHERE created_at >= datetime('now', '-${days} days') ORDER BY created_at DESC`
        : `SELECT * FROM ${key} ORDER BY created_at DESC`;
      const result = await db.prepare(query).all();
      sections.push(`### ${src.label}\n${toCsv(result.results, src.columns)}`);
    }

    const csv = sections.join('\n\n');

    await logActivity(db, context, user, "Export de données sécurisé", `${reason.trim()} (${selected.join(', ')})`);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="export-anb-${Date.now()}.csv"`,
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
