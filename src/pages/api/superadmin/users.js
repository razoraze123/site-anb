import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { hashPassword, generateTempPassword } from "../../../lib/password.js";
import { logActivity } from "../../../lib/journal.js";

export const prerender = false;

const ROLES = ['admin', 'super_admin', 'editeur'];

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

    const result = await db.prepare(
      "SELECT id, nom, email, role, statut, created_at FROM utilisateurs ORDER BY created_at DESC"
    ).all();

    return new Response(JSON.stringify({ users: result.results }), {
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

// Crée un compte directement (pas d'envoi d'e-mail branché) : le mot de
// passe temporaire est renvoyé une seule fois dans la réponse pour être
// communiqué manuellement par le super-admin.
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
    const { nom, email, role } = body;

    if (!nom || !email || !role) {
      return new Response(JSON.stringify({ error: "Les paramètres nom, email et role sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: `role doit être l'un de : ${ROLES.join(', ')}.` }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const tempPassword = generateTempPassword();
    const hashed = await hashPassword(tempPassword);

    const result = await db.prepare(
      "INSERT INTO utilisateurs (nom, email, mot_de_passe, role, statut) VALUES (?, ?, ?, ?, 'actif')"
    ).bind(nom, email, hashed, role).run();

    await logActivity(db, context, user, "Création d'un utilisateur", `${nom} (${role})`);

    return new Response(JSON.stringify({
      success: true,
      message: "Utilisateur créé. Communiquez-lui le mot de passe temporaire ci-dessous.",
      tempPassword,
      data: result
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    // email UNIQUE -> conflit
    const message = /UNIQUE/i.test(error.message)
      ? "Un compte existe déjà avec cet e-mail."
      : error.message;
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Modifie le rôle/statut d'un utilisateur, ou réinitialise son mot de passe
// (resetPassword: true) — un seul de ces cas par appel.
export async function PUT(context) {
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
    const { id, role, statut, resetPassword } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: "Le paramètre id est requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Un super_admin ne peut ni se suspendre ni se retirer son propre rôle
    // super_admin — sinon il perd l'accès à ce panneau et ne peut plus se
    // réactiver lui-même.
    if (Number(id) === user.id) {
      if (statut === 'desactive') {
        return new Response(JSON.stringify({ error: "Vous ne pouvez pas suspendre votre propre compte." }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (role && role !== 'super_admin') {
        return new Response(JSON.stringify({ error: "Vous ne pouvez pas retirer votre propre rôle Super Admin." }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    if (resetPassword) {
      const tempPassword = generateTempPassword();
      const hashed = await hashPassword(tempPassword);
      await db.prepare("UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?").bind(hashed, id).run();
      await logActivity(db, context, user, "Réinitialisation de mot de passe", `Utilisateur #${id}`);
      return new Response(JSON.stringify({
        success: true,
        message: "Mot de passe réinitialisé. Communiquez le nouveau mot de passe ci-dessous.",
        tempPassword
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (role && !ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: `role doit être l'un de : ${ROLES.join(', ')}.` }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (statut && !['actif', 'desactive'].includes(statut)) {
      return new Response(JSON.stringify({ error: "statut doit être 'actif' ou 'desactive'." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!role && !statut) {
      return new Response(JSON.stringify({ error: "Rien à modifier : fournissez role, statut ou resetPassword." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (role && statut) {
      await db.prepare("UPDATE utilisateurs SET role = ?, statut = ? WHERE id = ?").bind(role, statut, id).run();
    } else if (role) {
      await db.prepare("UPDATE utilisateurs SET role = ? WHERE id = ?").bind(role, id).run();
    } else {
      await db.prepare("UPDATE utilisateurs SET statut = ? WHERE id = ?").bind(statut, id).run();
    }

    const changeDesc = [role && `rôle → ${role}`, statut && `statut → ${statut}`].filter(Boolean).join(', ');
    await logActivity(db, context, user, "Modification d'un utilisateur", `Utilisateur #${id} : ${changeDesc}`);

    return new Response(JSON.stringify({ success: true, message: "Utilisateur modifié avec succès." }), {
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

export async function DELETE(context) {
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
    const id = searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: "Le paramètre id est requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (Number(id) === user.id) {
      return new Response(JSON.stringify({ error: "Vous ne pouvez pas supprimer votre propre compte." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare("DELETE FROM utilisateurs WHERE id = ?").bind(id).run();

    await logActivity(db, context, user, "Suppression d'un utilisateur", `Utilisateur #${id}`);

    return new Response(JSON.stringify({ success: true, message: "Utilisateur supprimé." }), {
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
