import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { logActivity } from "../../../lib/journal.js";

export const prerender = false;

const MAX_LENGTHS = { titre: 200, texte_alternatif: 300, credit: 150 };
const ALLOWED_TYPES = ['Photo', 'Vidéo'];

function friendlyDbError(error) {
  if (/UNIQUE constraint failed: media_galerie\.nom_fichier/.test(error.message)) {
    return "Ce fichier existe déjà dans la galerie.";
  }
  return error.message;
}

// Création d'un média : le fichier est déjà dans R2 à ce stade (uploadé
// via POST /api/admin/upload, mécanisme partagé avec Actualités/
// Événements — non dupliqué ici). Cette route n'enregistre que la ligne
// de métadonnées media_galerie ; nom_fichier est la clé R2 réelle
// renvoyée par /api/admin/upload, jamais une valeur saisie librement
// (le champ correspondant du formulaire est en lecture seule côté
// client, alimenté uniquement par le retour de l'upload).
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
    const nom_fichier = (body.nom_fichier || '').trim();
    const titre = (body.titre || '').trim();
    const texte_alternatif = (body.texte_alternatif || '').trim();
    const credit = (body.credit || '').trim();
    const type = ALLOWED_TYPES.includes(body.type) ? body.type : 'Photo';
    const taille_octets = Number.isFinite(body.taille_octets) ? body.taille_octets : 0;

    if (!nom_fichier || !titre || !texte_alternatif || !credit) {
      return new Response(JSON.stringify({ error: "Les champs fichier, titre, texte alternatif et crédit sont obligatoires." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (titre.length > MAX_LENGTHS.titre || texte_alternatif.length > MAX_LENGTHS.texte_alternatif || credit.length > MAX_LENGTHS.credit) {
      return new Response(JSON.stringify({ error: "Un ou plusieurs champs dépassent la longueur autorisée." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const result = await db.prepare(
      "INSERT INTO media_galerie (nom_fichier, titre, texte_alternatif, credit, type, taille_octets) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(nom_fichier, titre, texte_alternatif, credit, type, taille_octets).run();

    await logActivity(db, context, user, "Ajout d'un média à la galerie", titre);

    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: friendlyDbError(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Modification des métadonnées uniquement — nom_fichier (la clé R2)
// n'est jamais modifiable depuis ce formulaire, pour ne jamais faire
// pointer une ligne existante vers un fichier différent sans repasser
// par un vrai upload.
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
    const titre = (body.titre || '').trim();
    const texte_alternatif = (body.texte_alternatif || '').trim();
    const credit = (body.credit || '').trim();
    const type = ALLOWED_TYPES.includes(body.type) ? body.type : 'Photo';

    if (!id || !titre || !texte_alternatif || !credit) {
      return new Response(JSON.stringify({ error: "Les paramètres id, titre, texte alternatif et crédit sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (titre.length > MAX_LENGTHS.titre || texte_alternatif.length > MAX_LENGTHS.texte_alternatif || credit.length > MAX_LENGTHS.credit) {
      return new Response(JSON.stringify({ error: "Un ou plusieurs champs dépassent la longueur autorisée." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare(
      "UPDATE media_galerie SET titre = ?, texte_alternatif = ?, credit = ?, type = ? WHERE id = ?"
    ).bind(titre, texte_alternatif, credit, type, id).run();

    await logActivity(db, context, user, "Modification d'un média de la galerie", titre);

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

// Supprime la ligne media_galerie ET son objet R2. Ne touche jamais aux
// fichiers R2 des Actualités/Événements : chaque upload génère une clé
// unique (timestamp + aléatoire, voir api/admin/upload.js) et
// nom_fichier n'est jamais saisi à la main (toujours issu d'un upload
// réel fait pour CE média de galerie) — aucun chevauchement possible par
// construction.
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

    const media = await db.prepare("SELECT nom_fichier, titre FROM media_galerie WHERE id = ?").bind(id).first();
    if (!media) {
      return new Response(JSON.stringify({ error: "Média introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Supprime l'objet R2 avant la ligne D1 : en cas d'échec ici, on
    // s'arrête et la ligne reste intacte (état cohérent, réessayable) —
    // plutôt qu'une ligne D1 supprimée pointant vers un fichier encore
    // présent, ou l'inverse.
    const r2 = env.R2;
    if (r2) {
      try {
        await r2.delete(media.nom_fichier);
      } catch (r2Error) {
        return new Response(JSON.stringify({ error: `Échec de la suppression du fichier R2 : ${r2Error.message}` }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    await db.prepare("DELETE FROM media_galerie WHERE id = ?").bind(id).run();
    await logActivity(db, context, user, "Suppression d'un média de la galerie", media.titre);

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
