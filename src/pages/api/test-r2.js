// Endpoint de test supprimé pour des raisons de sécurité.
// Ne jamais exposer de routes de diagnostic en production.
export const prerender = false;

export async function GET() {
  return new Response(JSON.stringify({ error: 'Not found.' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}
