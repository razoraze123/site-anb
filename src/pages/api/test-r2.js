import { env } from "cloudflare:workers";

export const prerender = false;

export async function GET() {
  try {
    const r2 = env.R2;
    if (!r2) {
      return new Response(JSON.stringify({ success: false, error: "R2 binding is undefined" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Try putting a small test object
    await r2.put("test-diagnose.txt", "R2 simulation is active!");
    
    // Try reading it back
    const obj = await r2.get("test-diagnose.txt");
    if (!obj) {
      return new Response(JSON.stringify({ success: false, error: "Failed to read test object from R2" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const text = await obj.text();

    return new Response(JSON.stringify({
      success: true,
      message: "R2 bucket simulation is fully operational!",
      data: text
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
