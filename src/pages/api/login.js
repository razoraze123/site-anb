import { env } from 'cloudflare:workers';
import { verifyPassword } from '../../lib/password.js';
import { isRateLimited, tooManyRequests } from '../../lib/rateLimit.js';

export const prerender = false;

export async function POST(context) {
  try {
    // Rate limiting : 5 tentatives par minute par IP
    if (await isRateLimited(context.request, { bucket: 'login', limit: 5, windowSeconds: 60 })) {
      return tooManyRequests();
    }

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'La base de données D1 (DB) n\'est pas configurée dans env.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { email, password } = await context.request.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email et mot de passe requis.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // On récupère le hash stocké — NE PAS comparer en SQL
    const user = await db
      .prepare("SELECT id, nom, email, role, mot_de_passe FROM utilisateurs WHERE email = ? AND statut = 'actif'")
      .bind(email)
      .first();

    // Vérification du hash en temps constant
    const passwordOk = user ? await verifyPassword(password, user.mot_de_passe) : false;

    if (!user || !passwordOk) {
      // Message générique pour ne pas révéler si l'email existe
      return new Response(JSON.stringify({ error: 'Identifiants incorrects.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // On ne stocke jamais le hash en session
    const { mot_de_passe: _omit, ...safeUser } = user;
    context.session.set('user', safeUser);

    return new Response(JSON.stringify({ role: user.role, nom: user.nom }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erreur interne du serveur.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
