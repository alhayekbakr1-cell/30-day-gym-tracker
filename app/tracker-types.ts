export type SetLog = {
  done: boolean;
  load: string;
  reps: string;
  rir: string;
};

export type ReadinessLog = {
  energy: string;
  sleepHours: string;
  soreness: string;
};

export type WorkoutLog = {
  completed: boolean;
  completedAt: string | null;
  lowSleep: boolean;
  modifiedAt: string;
  note: string;
  readiness: ReadinessLog;
  sets: Record<string, SetLog[]>;
  substitutions: Record<string, string>;
  warmup: Record<string, boolean>;
};

export type ProfileSettings = {
  modifiedAt: string;
  proteinGoal: string;
  stepGoal: string;
  weightUnit: "kg" | "lb";
};

export type DailyMetric = {
  modifiedAt: string;
  protein: string;
  sleepHours: string;
  steps: string;
  waist: string;
  weight: string;
};

export type TrackerState = {
  dailyMetrics: Record<string, DailyMetric>;
  profile: ProfileSettings;
  schedule: Record<string, string>;
  scheduleModifiedAt: string;
  schemaVersion: 2;
  startDate: string | null;
  workouts: Record<string, WorkoutLog>;
};

export type SyncedProgress = {
  state: TrackerState | null;
  updatedAt: number | null;
  version: number;
};
