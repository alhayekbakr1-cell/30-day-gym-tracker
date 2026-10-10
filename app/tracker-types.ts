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
  prescription?: import("./four-day-data").SessionPrescription;
  completed: boolean;
  completedAt: string | null;
  lowSleep: boolean;
  loadUnit: "kg" | "lb";
  modifiedAt: string;
  note: string;
  readiness: ReadinessLog;
  sets: Record<string, SetLog[]>;
  substitutions: Record<string, string>;
  warmup: Record<string, boolean>;
  workoutId: WorkoutId;
};

export type ProfileSettings = {
  loadUnit: "kg" | "lb";
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
  weightUnit?: "kg" | "lb";
};

export type TrackerState = {
  fourDayPlan: import("./four-day-data").FourDayPlan | null;
  blockId: string | null;
  dailyMetrics: Record<string, DailyMetric>;
  programVersion: 1 | 2 | 3;
  profile: ProfileSettings;
  schedule: Record<string, string>;
  scheduleModifiedAt: string;
  schemaVersion: 8;
  cardio: import("./cardio-logic").CardioState | null;
  equipment: import("./equipment-logic").EquipmentProfile;
  startDate: string | null;
  workouts: Record<string, WorkoutLog>;
};

export type SyncedProgress = {
  state: TrackerState | null;
  updatedAt: number | null;
  version: number;
};

export type ChallengeArchive = {
  id: string;
  archivedAt: number;
  state: TrackerState;
};
import type { WorkoutId } from "./workout-data";
