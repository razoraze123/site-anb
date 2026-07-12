import { env } from "cloudflare:workers";

export const prerender = false;

export async function POST(context) {
  try {
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env. Veuillez vérifier wrangler.jsonc." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { email, password } = await context.request.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email et mot de passe requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const user = await db.prepare(
      "SELECT id, nom, email, role FROM utilisateurs WHERE email = ? AND mot_de_passe = ? AND statut = 'actif'"
    ).bind(email, password).first();

    if (!user) {
      return new Response(JSON.stringify({ error: "Identifiants incorrects." }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    context.session.set('user', user);

    return new Response(JSON.stringify({ role: user.role, nom: user.nom }), {
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
