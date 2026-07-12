import { env } from "cloudflare:workers";

export const prerender = false;

export async function POST(context) {
  try {
    const body = await context.request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Le paramètre messages est requis et doit être un tableau." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const apiKey = env.MISTRAL_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "MISTRAL_API_KEY non configurée." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    const modelName = "mistral-small-2603";

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `Erreur Mistral: ${errorText}` }), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
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
