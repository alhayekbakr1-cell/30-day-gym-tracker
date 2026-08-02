export type SetLog = {
  done: boolean;
  load: string;
  reps: string;
  rir: string;
};

export type WorkoutLog = {
  completed: boolean;
  completedAt: string | null;
  lowSleep: boolean;
  modifiedAt: string;
  note: string;
  sets: Record<string, SetLog[]>;
  warmup: Record<string, boolean>;
};

export type TrackerState = {
  startDate: string | null;
  workouts: Record<string, WorkoutLog>;
};

export type SyncedProgress = {
  state: TrackerState | null;
  updatedAt: number | null;
  version: number;
};
