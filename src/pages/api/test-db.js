import { env } from "cloudflare:workers";

export const prerender = false;

export async function GET(context) {
  try {
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env. Veuillez vérifier wrangler.jsonc." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { results } = await db.prepare("SELECT * FROM actualites").all();
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Simulation D1 active !",
      count: results.length, 
      data: results 
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
