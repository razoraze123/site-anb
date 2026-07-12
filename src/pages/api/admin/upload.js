import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";

export const prerender = false;

export async function POST(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    const r2 = env.R2;
    if (!r2) {
      return new Response(JSON.stringify({ error: "Le bucket R2 n'est pas configuré dans env. R2." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const formData = await context.request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Aucun fichier fourni ou fichier invalide." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const contentType = file.type || "application/octet-stream";
    const ext = file.name ? file.name.split('.').pop() : 'jpg';
    const key = `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

    const fileBuffer = await file.arrayBuffer();

    // Upload to Cloudflare R2
    await r2.put(key, fileBuffer, {
      httpMetadata: { contentType: contentType }
    });

    const url = `/api/media/${key}`;

    return new Response(JSON.stringify({
      success: true,
      url: url,
      key: key
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
