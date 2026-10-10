import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isIsoDate } from "@/app/tracker-logic";
import { readChallengeHistory, startNewChallenge } from "@/lib/progress-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    return Response.json({ challenges: await readChallengeHistory(user.email) });
  } catch {
    return Response.json({ error: "Challenge history could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const text = await request.text();
    if (text.length > 4096) return Response.json({ error: "Request is too large." }, { status: 413 });
    let body: { baseVersion?: unknown; startDate?: unknown };
    try { body = JSON.parse(text); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
    if (!body || typeof body !== "object") return Response.json({ error: "Invalid challenge data." }, { status: 400 });
    const baseVersion = body.baseVersion;
    if (typeof baseVersion !== "number" || !Number.isSafeInteger(baseVersion) || baseVersion < 1 || !isIsoDate(body.startDate)) {
      return Response.json({ error: "Invalid challenge data." }, { status: 400 });
    }
    const result = await startNewChallenge(user.email, baseVersion, body.startDate);
    return Response.json(result.progress, { status: result.conflict ? 409 : 200 });
  } catch {
    return Response.json({ error: "A new challenge could not be started." }, { status: 500 });
  }
}
