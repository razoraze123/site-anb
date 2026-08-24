import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { logActivity } from "../../../lib/journal.js";

export const prerender = false;

const MAX_LENGTHS = { nom: 150, fonction: 150 };

// Ajout non explicitement listé dans la demande initiale, mais
// nécessaire : GET /api/equipe (public) ne renvoie que actif=1, donc un
// membre désactivé y devient invisible. Sans ce GET admin (tous les
// membres, actifs ou non), le bouton "Activer/Désactiver" n'aurait
// aucun moyen de réactiver quelqu'un depuis l'interface.
export async function GET(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const result = await db.prepare(
      "SELECT id, nom, fonction, photo, ordre, actif, created_at FROM equipe ORDER BY ordre ASC, id ASC"
    ).all();
    const membres = result.results.map((m) => ({ ...m, photo_url: m.photo ? `/api/media/${m.photo}` : null }));

    return new Response(JSON.stringify({ membres }), {
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

// Création d'un membre. La photo est facultative : si fournie, c'est déjà
// une clé R2 réelle (uploadée via POST /api/admin/upload, mécanisme
// partagé avec Actualités/Événements/Galerie, non dupliqué ici).
export async function POST(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const nom = (body.nom || '').trim();
    const fonction = (body.fonction || '').trim();
    const photo = (body.photo || '').trim() || null;

    if (!nom || !fonction) {
      return new Response(JSON.stringify({ error: "Les champs nom et fonction sont obligatoires." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (nom.length > MAX_LENGTHS.nom || fonction.length > MAX_LENGTHS.fonction) {
      return new Response(JSON.stringify({ error: "Un ou plusieurs champs dépassent la longueur autorisée." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Nouveau membre placé en fin de liste par défaut (ordre max + 1) —
    // l'admin peut ensuite le déplacer avec les boutons ↑ / ↓.
    const maxOrdre = await db.prepare("SELECT COALESCE(MAX(ordre), -1) AS m FROM equipe").first();
    const ordre = Number.isFinite(body.ordre) ? body.ordre : maxOrdre.m + 1;

    const result = await db.prepare(
      "INSERT INTO equipe (nom, fonction, photo, ordre, actif) VALUES (?, ?, ?, ?, 1)"
    ).bind(nom, fonction, photo, ordre).run();

    await logActivity(db, context, user, "Ajout d'un membre de l'équipe", nom);

    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
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

// Mise à jour complète d'un membre : métadonnées, photo, actif et ordre
// passent tous par cette même route (modification du formulaire, bascule
// Activer/Désactiver, boutons ↑ / ↓) — même principe que le bouton
// Archiver/Publier des Actualités, qui renvoie l'objet complet avec un
// seul champ changé plutôt que d'avoir une route dédiée par action.
export async function PUT(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { id } = body;
    const nom = (body.nom || '').trim();
    const fonction = (body.fonction || '').trim();
    const photo = (body.photo || '').trim() || null;
    const ordre = Number.isFinite(body.ordre) ? body.ordre : 0;
    const actif = body.actif ? 1 : 0;

    if (!id || !nom || !fonction) {
      return new Response(JSON.stringify({ error: "Les paramètres id, nom et fonction sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (nom.length > MAX_LENGTHS.nom || fonction.length > MAX_LENGTHS.fonction) {
      return new Response(JSON.stringify({ error: "Un ou plusieurs champs dépassent la longueur autorisée." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare(
      "UPDATE equipe SET nom = ?, fonction = ?, photo = ?, ordre = ?, actif = ? WHERE id = ?"
    ).bind(nom, fonction, photo, ordre, actif, id).run();

    await logActivity(db, context, user, "Modification d'un membre de l'équipe", nom);

    return new Response(JSON.stringify({ success: true }), {
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

// Supprime la ligne equipe ET son objet R2 s'il existe. Ne touche jamais
// aux fichiers R2 des Actualités/Événements/Galerie : `photo` n'est
// jamais saisi à la main (toujours issu d'un upload réel fait pour CE
// membre) — aucun chevauchement possible par construction, même
// raisonnement que api/admin/galerie.js.
export async function DELETE(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { searchParams } = new URL(context.request.url);
    const id = searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: "Le paramètre id est requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const membre = await db.prepare("SELECT nom, photo FROM equipe WHERE id = ?").bind(id).first();
    if (!membre) {
      return new Response(JSON.stringify({ error: "Membre introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Supprime l'objet R2 (s'il existe) avant la ligne D1 : en cas
    // d'échec ici, on s'arrête et la ligne reste intacte (état cohérent,
    // réessayable).
    if (membre.photo) {
      const r2 = env.R2;
      if (r2) {
        try {
          await r2.delete(membre.photo);
        } catch (r2Error) {
          return new Response(JSON.stringify({ error: `Échec de la suppression de la photo R2 : ${r2Error.message}` }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    }

    await db.prepare("DELETE FROM equipe WHERE id = ?").bind(id).run();
    await logActivity(db, context, user, "Suppression d'un membre de l'équipe", membre.nom);

    return new Response(JSON.stringify({ success: true }), {
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
