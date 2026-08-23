import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { logActivity } from "../../../lib/journal.js";

export const prerender = false;

// Suppression définitive d'un événement. Attention : le schéma déclare
// ON DELETE CASCADE sur inscriptions.event_id — supprimer un événement
// supprime donc aussi toutes ses inscriptions. On prévient l'appelant du
// nombre d'inscrits concernés pour qu'il puisse confirmer en connaissance
// de cause (voir le paramètre ?confirm=1).
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
    const confirmed = searchParams.get('confirm') === '1';
    if (!id) {
      return new Response(JSON.stringify({ error: "Le paramètre id est requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const event = await db.prepare("SELECT title FROM evenements WHERE id = ?").bind(id).first();
    if (!event) {
      return new Response(JSON.stringify({ error: "Événement introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { n: inscrits } = await db
      .prepare("SELECT COUNT(*) AS n FROM inscriptions WHERE event_id = ?")
      .bind(id)
      .first();

    // Garde-fou : on refuse la suppression tant que l'appelant n'a pas
    // explicitement confirmé la perte des inscriptions associées.
    if (inscrits > 0 && !confirmed) {
      return new Response(JSON.stringify({
        error: `Cet événement a ${inscrits} inscription(s). Les supprimer aussi ?`,
        needsConfirmation: true,
        inscrits,
      }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare("DELETE FROM evenements WHERE id = ?").bind(id).run();
    await logActivity(
      db, context, user,
      "Suppression d'un événement",
      inscrits > 0 ? `${event.title} (+ ${inscrits} inscription(s))` : event.title
    );

    return new Response(JSON.stringify({
      success: true,
      message: inscrits > 0
        ? `Événement supprimé, ainsi que ses ${inscrits} inscription(s).`
        : "Événement supprimé.",
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

export async function POST(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env. Veuillez vérifier wrangler.jsonc." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { title, date, event_date, place, category, max_places, bg_gradient, inscriptions_ouvertes } = body;

    if (!title || !date || !place) {
      return new Response(JSON.stringify({ error: "Les paramètres title, date et place sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Default values if omitted
    const cat = category || "Culture";
    const maxPl = max_places !== undefined ? max_places : 100;
    const bg = bg_gradient || "linear-gradient(150deg,#E97824,#1F2925)";
    const regOpen = inscriptions_ouvertes === false || inscriptions_ouvertes === 0 ? 0 : 1;
    // Un admin/super-admin publie toujours directement (même principe que
    // pour les actualités) : un événement nouvellement créé démarre
    // toujours "Ouvert", quoi que le client envoie. Le statut ne change
    // ensuite que via les actions dédiées "Annuler" / "Marquer comme
    // terminé" (voir PUT), jamais via ce formulaire de création.
    const stat = "Ouvert";

    // Insert into D1 (registered_count is derived live from `inscriptions`, not stored)
    const statement = db.prepare(
      "INSERT INTO evenements (title, date, event_date, place, category, max_places, status, inscriptions_ouvertes, bg_gradient) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(title, date, event_date || null, place, cat, maxPl, stat, regOpen, bg);

    const result = await statement.run();

    return new Response(JSON.stringify({
      success: true,
      message: "Événement créé avec succès !",
      data: result
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function PUT(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env. Veuillez vérifier wrangler.jsonc." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { id, title, date, event_date, place, category, max_places, status, inscriptions_ouvertes, bg_gradient } = body;

    if (!id || !title || !date || !place) {
      return new Response(JSON.stringify({ error: "Les paramètres id, title, date et place sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const cat = category || "Culture";
    const maxPl = max_places !== undefined ? max_places : 100;
    // bg_gradient : image de couverture (URL R2) ou dégradé CSS. Oubliée à
    // tort de ce UPDATE jusqu'ici (même bug que sur les actualités) — seule
    // la création (POST) l'enregistrait.
    const bg = bg_gradient || "linear-gradient(150deg,#E97824,#1F2925)";
    // inscriptions_ouvertes est un champ normal du formulaire d'édition
    // (contrairement à `status`, voir plus bas) : s'il n'est pas fourni on
    // garde la valeur par défaut "ouvertes" plutôt que de deviner.
    const regOpen = inscriptions_ouvertes === false || inscriptions_ouvertes === 0 ? 0 : 1;

    // IMPORTANT : modifier le contenu d'un événement ne doit JAMAIS changer
    // son statut tout seul (c'était le bug — "Modifier" envoyait status:
    // 'Ouvert' en dur à chaque sauvegarde, ce qui réouvrait silencieusement
    // un événement annulé ou terminé). `status` n'est donc mis à jour que
    // si le body en fournit un explicitement ET que c'est une vraie
    // transition métier ('Annulé' ou 'Terminé', posées par les actions
    // dédiées "Annuler l'événement" / "Marquer comme terminé"). Dans tous
    // les autres cas (édition normale du contenu), la colonne status n'est
    // même pas présente dans l'UPDATE : elle garde sa valeur actuelle.
    const allowStatusChange = ['Annulé', 'Terminé'].includes(status);

    const statement = allowStatusChange
      ? db.prepare("UPDATE evenements SET title = ?, date = ?, event_date = ?, place = ?, category = ?, max_places = ?, inscriptions_ouvertes = ?, bg_gradient = ?, status = ? WHERE id = ?")
          .bind(title, date, event_date || null, place, cat, maxPl, regOpen, bg, status, id)
      : db.prepare("UPDATE evenements SET title = ?, date = ?, event_date = ?, place = ?, category = ?, max_places = ?, inscriptions_ouvertes = ?, bg_gradient = ? WHERE id = ?")
          .bind(title, date, event_date || null, place, cat, maxPl, regOpen, bg, id);

    const result = await statement.run();

    return new Response(JSON.stringify({
      success: true,
      message: "Événement modifié avec succès !",
      data: result
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
