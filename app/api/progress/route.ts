import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { TrackerState } from "@/app/tracker-types";
import { readProgress, writeProgress } from "@/lib/progress-store";
import { sanitizeTrackerState } from "@/lib/tracker-validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const expected = request.headers.get("x-gym-expected-account");
  if (expected && expected !== user.email) return Response.json({ error: "Account changed. Reload." }, { status: 412 });

  try {
    return Response.json(await readProgress(user.email), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json(
      { error: "Progress could not be loaded." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const expected = request.headers.get("x-gym-expected-account");
  if (expected !== user.email) return Response.json({ error: "Account changed. Reload." }, { status: 412 });
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Use this site to save progress." }, { status: 403 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 2_000_000) {
    return Response.json({ error: "Progress payload is too large." }, { status: 413 });
  }

  try {
    const text = await request.text();
    if (text.length > 2_000_000) return Response.json({ error: "Progress payload is too large." }, { status: 413 });
    let body: { baseVersion?: unknown; state?: TrackerState };
    try { body = JSON.parse(text); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
    if (!body || typeof body !== "object") return Response.json({ error: "Invalid progress data." }, { status: 400 });
    const baseVersion = body.baseVersion;
    const state = sanitizeTrackerState(body.state);

    if (typeof baseVersion !== "number" || !Number.isSafeInteger(baseVersion) || baseVersion < 0 || !state) {
      return Response.json({ error: "Invalid progress data." }, { status: 400 });
    }

    const result = await writeProgress(user.email, state, baseVersion, body.state?.schemaVersion ?? 5);
    return Response.json(result.progress, { status: result.conflict ? 409 : 200 });
  } catch {
    return Response.json(
      { error: "Progress could not be saved." },
      { status: 500 },
    );
  }
}
