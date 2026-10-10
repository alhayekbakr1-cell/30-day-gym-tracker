import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isIsoDate } from "@/app/tracker-logic";
import { readProgress } from "@/lib/progress-store";
import { buildCoachSummary } from "@/lib/coach-summary";
import { COACH_INSTRUCTIONS, coachingEquipment, GEMINI_MODEL, coachingHistory, geminiText } from "@/lib/gemini-coach";
export const dynamic = "force-dynamic";
const recent = new Map<string, number>();
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: "Sign in with ChatGPT to request a review." }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Use the coach from this site." }, 403);
  if (request.headers.get("x-gym-expected-account") !== user.email) return reply({ error: "Your account changed. Reload before requesting a review." }, 409);
  try {
    const raw = await request.text();
    if (raw.length > 5000) return reply({ error: "Question is too long." }, 413);
    const body = JSON.parse(raw) as { question?: unknown; date?: unknown; version?: unknown };
    if (!body || typeof body.question !== "string" || !body.question.trim() || body.question.length > 1500 || !isIsoDate(body.date) || !Number.isSafeInteger(body.version)) return reply({ error: "Enter a question of up to 1,500 characters." }, 400);
    const progress = await readProgress(user.email);
    if (!progress.state || progress.version !== body.version) return reply({ error: "Sync your latest workout changes, then request a review." }, 409);
    const { env } = await import("cloudflare:workers");
    const secret = (env as unknown as { GEMINI_API_KEY?: string }).GEMINI_API_KEY;
    if (!secret) return reply({ error: "Gemini is not configured. Your training records are unchanged." }, 503);
    const now = Date.now();
    if (now - (recent.get(user.email) ?? 0) < 30000) return reply({ error: "Please wait 30 seconds between reviews." }, 429);
    for (const [id, timestamp] of recent) if (now - timestamp > 60000) recent.delete(id);
    recent.set(user.email, now);
    const context = { equipment: coachingEquipment(progress.state), question: body.question, summary: buildCoachSummary(progress.state, body.date), history: coachingHistory(progress.state), goals: progress.state.profile };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": secret },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: COACH_INSTRUCTIONS }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify(context) }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 3500 } }),
      signal: AbortSignal.timeout(45000),
    });
    // Never forward provider error bodies, request headers, or secrets to the client/logs.
    if (!response.ok) return reply({ error: response.status === 400 || response.status === 401 || response.status === 403 ? "Google rejected the Gemini credential or model access. Update the server secret; your workouts are unchanged." : response.status === 429 ? "Gemini quota is temporarily unavailable. Try later." : "Gemini is unavailable. Try again later." }, 502);
    const answer = geminiText(await response.json());
    if (!answer) return reply({ error: "Gemini could not provide a complete review. Try a shorter question." }, 502);
    return reply({ answer, model: GEMINI_MODEL, version: progress.version, date: body.date, exposureCount: context.history.includedExposures });
  } catch { return reply({ error: "The review could not be completed. Your workout records are unchanged." }, 502); }
}
