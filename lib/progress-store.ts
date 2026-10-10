import type { ChallengeArchive, SyncedProgress, TrackerState } from "@/app/tracker-types";
import { defaultSchedule, normalizeTrackerState } from "@/app/tracker-logic";
import { buildCoachSummary } from "@/lib/coach-summary";
import { initialFourDaySets } from "@/app/four-day-data";

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
    state: normalizeTrackerState(JSON.parse(row.state_json) as TrackerState),
    updatedAt: row.updated_at,
    version: row.version,
  };
}

async function refreshCoachSnapshot(
  db: Awaited<ReturnType<typeof database>>,
  userEmail: string,
  state: TrackerState,
  updatedAt: number,
  progressVersion: number,
) {
  const summary = buildCoachSummary(state);
  const nextWorkout = summary.nextWorkout
    ? `Session ${summary.nextWorkout.session} · Workout ${summary.nextWorkout.workout} · ${summary.nextWorkout.focus}`
    : null;
  const recommendation = `${summary.recommendation.title} — ${summary.recommendation.detail}`;

  try {
    await db
      .prepare(
        `INSERT INTO gym_coach_snapshot (
          user_email, completed_sessions, sessions_due, consistency_pct,
          total_volume, weight_unit, load_unit, progress_version, latest_weight, weight_change,
          average_sleep, average_rir, rir_coverage_pct, next_workout,
          next_workout_date, recommendation, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_email) DO UPDATE SET
          completed_sessions = excluded.completed_sessions,
          sessions_due = excluded.sessions_due,
          consistency_pct = excluded.consistency_pct,
          total_volume = excluded.total_volume,
          weight_unit = excluded.weight_unit,
          load_unit = excluded.load_unit,
          progress_version = excluded.progress_version,
          latest_weight = excluded.latest_weight,
          weight_change = excluded.weight_change,
          average_sleep = excluded.average_sleep,
          average_rir = excluded.average_rir,
          rir_coverage_pct = excluded.rir_coverage_pct,
          next_workout = excluded.next_workout,
          next_workout_date = excluded.next_workout_date,
          recommendation = excluded.recommendation,
          updated_at = excluded.updated_at
        WHERE gym_coach_snapshot.progress_version <= excluded.progress_version`,
      )
      .bind(
        userEmail,
        summary.completedSessions,
        summary.sessionsDue,
        summary.consistencyPct,
        summary.totalVolume,
        summary.weightUnit,
        summary.loadUnit,
        progressVersion,
        summary.latestWeight?.toString() ?? null,
        summary.weightChange?.toString() ?? null,
        summary.averageSleepHours?.toString() ?? null,
        summary.averageRir?.toString() ?? null,
        summary.rirCoveragePct,
        nextWorkout,
        summary.nextWorkout?.date ?? null,
        recommendation,
        updatedAt,
      )
      .run();
  } catch (error) {
    console.error("Coach snapshot refresh failed.", error);
  }
}

export async function readProgress(userEmail: string): Promise<SyncedProgress> {
  const db = await database();
  const row = await db
    .prepare(
      "SELECT state_json, version, updated_at FROM gym_progress WHERE user_email = ?",
    )
    .bind(userEmail)
    .first() as ProgressRow | null;

  return rowToProgress(row);
}

export async function writeProgress(
  userEmail: string,
  state: TrackerState,
  baseVersion: number,
  inputSchemaVersion = 8,
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
      await refreshCoachSnapshot(db, userEmail, state, updatedAt, 1);
      return {
        conflict: false,
        progress: { state, updatedAt, version: 1 },
      };
    }
  } else {
    const nextVersion = baseVersion + 1;
    const result = await db
      .prepare(
        "UPDATE gym_progress SET state_json = ?, version = ?, updated_at = ? WHERE user_email = ? AND version = ? AND (? >= 6 OR json_extract(state_json, '$.fourDayPlan') IS NULL) AND (? >= 7 OR json_extract(state_json, '$.equipment') IS NULL) AND (? >= 8 OR json_extract(state_json, '$.cardio') IS NULL)",
      )
      .bind(stateJson, nextVersion, updatedAt, userEmail, baseVersion, inputSchemaVersion, inputSchemaVersion, inputSchemaVersion)
      .run();

    if (Number(result.meta.changes ?? 0) > 0) {
      await refreshCoachSnapshot(db, userEmail, state, updatedAt, nextVersion);
      return {
        conflict: false,
        progress: { state, updatedAt, version: nextVersion },
      };
    }
  }

  return { conflict: true, progress: await readProgress(userEmail) };
}

type ArchiveRow = { id: string; archived_at: number; state_json: string };

export async function readChallengeHistory(userEmail: string): Promise<ChallengeArchive[]> {
  const db = await database();
  const result = await db.prepare(
    "SELECT id, archived_at, state_json FROM gym_challenge_history WHERE user_email = ? ORDER BY archived_at DESC LIMIT 20",
  ).bind(userEmail).all() as { results?: ArchiveRow[] };
  return (result.results ?? []).map((row: ArchiveRow) => ({
    id: row.id,
    archivedAt: row.archived_at,
    state: normalizeTrackerState(JSON.parse(row.state_json) as TrackerState),
  }));
}

export async function startNewChallenge(
  userEmail: string,
  baseVersion: number,
  startDate: string,
): Promise<{ conflict: boolean; progress: SyncedProgress }> {
  const current = await readProgress(userEmail);
  if (!current.state || current.version !== baseVersion) return { conflict: true, progress: current };

  const db = await database();
  const archivedAt = Date.now();
  const archiveId = crypto.randomUUID();
  const nextState: TrackerState = {
    ...current.state,
    blockId: crypto.randomUUID(),
    programVersion: 3,
    fourDayPlan: { id: crypto.randomUUID(), version: 1, startsOn: startDate, modifiedAt: new Date(archivedAt).toISOString(), sets: initialFourDaySets(), rir: 3, shifts: {} },
    schedule: defaultSchedule(),
    scheduleModifiedAt: new Date(archivedAt).toISOString(),
    startDate,
    workouts: {},
  };
  const nextVersion = baseVersion + 1;
  const statements = await db.batch([
    db.prepare(
      "INSERT INTO gym_challenge_history (id, user_email, state_json, archived_at) SELECT ?, user_email, state_json, ? FROM gym_progress WHERE user_email = ? AND version = ?",
    ).bind(archiveId, archivedAt, userEmail, baseVersion),
    db.prepare(
      "UPDATE gym_progress SET state_json = ?, version = ?, updated_at = ? WHERE user_email = ? AND version = ?",
    ).bind(JSON.stringify(nextState), nextVersion, archivedAt, userEmail, baseVersion),
  ]);
  const updated = Number(statements[1]?.meta.changes ?? 0) > 0;
  if (!updated) return { conflict: true, progress: await readProgress(userEmail) };
  await refreshCoachSnapshot(db, userEmail, nextState, archivedAt, nextVersion);
  return { conflict: false, progress: { state: nextState, updatedAt: archivedAt, version: nextVersion } };
}
