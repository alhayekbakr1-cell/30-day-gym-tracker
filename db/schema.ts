import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gymProgress = sqliteTable("gym_progress", {
  userEmail: text("user_email").primaryKey(),
  stateJson: text("state_json").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
});

export const gymCoachSnapshot = sqliteTable("gym_coach_snapshot", {
  userEmail: text("user_email").primaryKey(),
  completedSessions: integer("completed_sessions").notNull().default(0),
  sessionsDue: integer("sessions_due").notNull().default(0),
  consistencyPct: integer("consistency_pct").notNull().default(0),
  totalVolume: integer("total_volume").notNull().default(0),
  weightUnit: text("weight_unit").notNull().default("lb"),
  loadUnit: text("load_unit").notNull().default("lb"),
  progressVersion: integer("progress_version").notNull().default(0),
  latestWeight: text("latest_weight"),
  weightChange: text("weight_change"),
  averageSleep: text("average_sleep"),
  averageRir: text("average_rir"),
  rirCoveragePct: integer("rir_coverage_pct").notNull().default(0),
  nextWorkout: text("next_workout"),
  nextWorkoutDate: text("next_workout_date"),
  recommendation: text("recommendation").notNull().default(""),
  updatedAt: integer("updated_at").notNull(),
});

export const gymChallengeHistory = sqliteTable(
  "gym_challenge_history",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    stateJson: text("state_json").notNull(),
    archivedAt: integer("archived_at").notNull(),
  },
  (table) => [index("gym_challenge_history_user_archived_idx").on(table.userEmail, table.archivedAt)],
);
