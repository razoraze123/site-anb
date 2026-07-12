import { env } from "cloudflare:workers";

export const prerender = false;

export async function GET() {
  try {
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { results } = await db.prepare("SELECT COUNT(*) as total FROM recensement").all();
    const count = results[0]?.total ?? 0;

    return new Response(JSON.stringify({ count }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch {
    return new Response(JSON.stringify({ count: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
