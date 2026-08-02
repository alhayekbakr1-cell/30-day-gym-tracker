import type { SyncedProgress, TrackerState } from "@/app/tracker-types";

type ProgressRow = {
  state_json: string;
  updated_at: number;
  version: number;
};

async function database() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Progress database is unavailable.");
  return env.DB;
}

function rowToProgress(row: ProgressRow | null): SyncedProgress {
  if (!row) return { state: null, updatedAt: null, version: 0 };

  return {
    state: JSON.parse(row.state_json) as TrackerState,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

export async function readProgress(userEmail: string): Promise<SyncedProgress> {
  const db = await database();
  const row = await db
    .prepare(
      "SELECT state_json, version, updated_at FROM gym_progress WHERE user_email = ?",
    )
    .bind(userEmail)
    .first<ProgressRow>();

  return rowToProgress(row);
}

export async function writeProgress(
  userEmail: string,
  state: TrackerState,
  baseVersion: number,
): Promise<{ conflict: boolean; progress: SyncedProgress }> {
  const db = await database();
  const updatedAt = Date.now();
  const stateJson = JSON.stringify(state);

  if (baseVersion === 0) {
    const result = await db
      .prepare(
        "INSERT INTO gym_progress (user_email, state_json, version, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_email) DO NOTHING",
      )
      .bind(userEmail, stateJson, updatedAt)
      .run();

    if (Number(result.meta.changes ?? 0) > 0) {
      return {
        conflict: false,
        progress: { state, updatedAt, version: 1 },
      };
    }
  } else {
    const nextVersion = baseVersion + 1;
    const result = await db
      .prepare(
        "UPDATE gym_progress SET state_json = ?, version = ?, updated_at = ? WHERE user_email = ? AND version = ?",
      )
      .bind(stateJson, nextVersion, updatedAt, userEmail, baseVersion)
      .run();

    if (Number(result.meta.changes ?? 0) > 0) {
      return {
        conflict: false,
        progress: { state, updatedAt, version: nextVersion },
      };
    }
  }

  return { conflict: true, progress: await readProgress(userEmail) };
}
