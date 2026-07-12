export const prerender = false;

export async function POST(context) {
  context.session.destroy();
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
