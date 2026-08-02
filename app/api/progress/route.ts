import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { TrackerState } from "@/app/tracker-types";
import { readProgress, writeProgress } from "@/lib/progress-store";
import { sanitizeTrackerState } from "@/lib/tracker-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    return Response.json(await readProgress(user.email));
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

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 80_000) {
    return Response.json({ error: "Progress payload is too large." }, { status: 413 });
  }

  try {
    const body = (await request.json()) as {
      baseVersion?: unknown;
      state?: TrackerState;
    };
    const baseVersion = Number(body.baseVersion);
    const state = sanitizeTrackerState(body.state);

    if (!Number.isInteger(baseVersion) || baseVersion < 0 || !state) {
      return Response.json({ error: "Invalid progress data." }, { status: 400 });
    }

    const result = await writeProgress(user.email, state, baseVersion);
    return Response.json(result.progress, { status: result.conflict ? 409 : 200 });
  } catch {
    return Response.json(
      { error: "Progress could not be saved." },
      { status: 500 },
    );
  }
}
