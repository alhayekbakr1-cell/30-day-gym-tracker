import type { Exercise, WorkoutPlan } from "./workout-data";

export type FourDayWorkoutId = "UA" | "LA" | "UB" | "LB";
export const FOUR_DAY_ROTATION: readonly FourDayWorkoutId[] = ["UA", "LA", "UB", "LB"];
export const FOUR_DAY_OFFSETS = [0, 1, 3, 4] as const;
// A separate namespace keeps every legacy calendar-day key unchanged.
export const FOUR_DAY_KEY_START = 1_000_001;
export const FOUR_DAY_SESSION_LIMIT = 20_000;
export function isFourDayKey(key: number) {
  return Number.isSafeInteger(key) && key >= FOUR_DAY_KEY_START && key < FOUR_DAY_KEY_START + FOUR_DAY_SESSION_LIMIT;
}
export function fourDayWorkoutId(key: number): FourDayWorkoutId {
  return FOUR_DAY_ROTATION[(key - FOUR_DAY_KEY_START) % 4];
}

type PrescriptionExercise = Exercise & { targetSets: number; transitionSets: number; restSeconds: number };
const exercise = (id: string, name: string, reps: string, targetSets: number, transitionSets: number, restSeconds: number, cue: string): PrescriptionExercise =>
  ({ id, name, reps, targetSets, transitionSets, restSeconds, cue });
const flat = (sets: number, reps: string) => exercise("flat-db-bench", "Flat dumbbell bench press", reps, sets, 2, 180, "Keep shoulder blades gently set and lower with control.");
const incline = (sets: number, reps: string) => exercise("incline-db-bench", "Low-incline dumbbell press", reps, sets, 2, sets === 3 ? 180 : 120, "Use a low incline and a comfortable, controlled range.");
const row = (sets: number) => exercise("seated-row", "Seated row", "8–12 reps", sets, 2, 180, "Pull with the elbows without shrugging or rocking.");
const pulldown = (sets: number) => exercise("lat-pulldown", "Lat pulldown", "8–12 reps", sets, 2, sets === 3 ? 180 : 120, "Drive elbows toward your sides without leaning far back.");
const lateral = () => exercise("lateral-raise-a", "Dumbbell lateral raise", "12–20 reps", 3, 2, 90, "Lead with the elbows; use a load you can lift without swinging.");
const curl = () => exercise("hammer-curl", "Dumbbell hammer curl", "10–15 reps", 2, 2, 90, "Keep elbows still and wrists neutral.");
const triceps = () => exercise("triceps-extension", "Overhead dumbbell triceps extension", "10–15 reps", 2, 2, 90, "Keep elbows comfortably narrow and use a pain-free range.");
const press = (sets: number, reps: string) => exercise("leg-press", "Leg press", reps, sets, 2, sets === 3 ? 180 : 120, "Keep your whole foot planted and stop before your pelvis curls.");
const rdl = (reps: string) => exercise("db-rdl", "Dumbbell Romanian deadlift", reps, 2, 1, 180, "Move the hips back with dumbbells close; stop at a controlled hamstring stretch.");
const legCurl = () => exercise("leg-curl", "Leg-curl machine", "10–15 reps", 2, 1, 120, "Keep your hips supported and control both directions.");
const calf = () => exercise("calf-raise", "Supported standing calf raise", "10–20 reps", 2, 1, 90, "Hold a support for balance. Pause at the top and bottom without bouncing.");

export const FOUR_DAY_EXERCISES: Record<FourDayWorkoutId, PrescriptionExercise[]> = {
  UA: [flat(3, "6–10 reps"), row(3), pulldown(2), incline(2, "8–12 reps"), lateral(), curl(), triceps()],
  LA: [press(3, "8–12 reps"), rdl("8–12 reps"), legCurl(), calf(), exercise("cable-crunch", "Kneeling cable crunch", "10–15 reps", 2, 2, 90, "Bring ribs toward the pelvis without pulling with your arms.")],
  UB: [incline(3, "6–10 reps"), pulldown(3), exercise("machine-press", "Machine chest press", "10–15 reps", 2, 2, 120, "Keep your shoulders supported and the movement smooth."), exercise("one-arm-row", "Supported one-arm dumbbell row", "10–15 / side", 2, 2, 120, "Brace on the bench and pull toward the hip."), lateral(), curl(), triceps()],
  LB: [rdl("6–10 reps"), exercise("split-squat", "Supported split squat", "8–12 / leg", 3, 1, 180, "Hold a support for balance and keep the front foot fully planted."), press(2, "10–15 reps"), legCurl(), calf(), exercise("front-plank", "Front plank", "20–45 sec", 2, 2, 90, "Squeeze glutes and keep ribs stacked over the pelvis. Stop when the brace fades.")],
};
export const FOUR_DAY_NAMES: Record<FourDayWorkoutId, string> = { UA: "Upper A", LA: "Lower A", UB: "Upper B", LB: "Lower B" };
function fourDayWorkout(id: FourDayWorkoutId): WorkoutPlan { return {
  id, focus: FOUR_DAY_NAMES[id], subtitle: `${FOUR_DAY_NAMES[id]} · strength + muscle`,
  patterns: id.startsWith("U") ? ["Chest", "Back", "Shoulders", "Arms"] : ["Quads", "Hamstrings", "Calves", "Core"],
  pairs: FOUR_DAY_EXERCISES[id].map((item, index) => ({ id: `${id}-${item.id}`, title: index === 0 ? "Priority lift" : item.name, exercises: [item] })),
}; }
export const FOUR_DAY_WORKOUTS: Record<FourDayWorkoutId, WorkoutPlan> = { UA: fourDayWorkout("UA"), LA: fourDayWorkout("LA"), UB: fourDayWorkout("UB"), LB: fourDayWorkout("LB") };

export type FourDaySets = Record<FourDayWorkoutId, Record<string, number>>;
export type FourDayPlan = {
  id: string;
  version: 1;
  startsOn: string;
  modifiedAt: string;
  sets: FourDaySets;
  rir: 2 | 3;
  // Each entry shifts this session and all following sessions by this many days.
  shifts: Record<string, number>;
};
export function initialFourDaySets(): FourDaySets {
  return Object.fromEntries(FOUR_DAY_ROTATION.map(id => [id, Object.fromEntries(FOUR_DAY_EXERCISES[id].map(item => [item.id, item.transitionSets]))])) as FourDaySets;
}
export type ExercisePrescription = { sets: number; reps: string; restSeconds: number; rir: number };
export type FourDayPrescription = { program: 4; templateVersion: 1; sessionId: string; exercises: Record<string, ExercisePrescription> };
export type VarietyPrescription = {
  program: "variety"; templateVersion: 1; sessionId: string;
  cycleId: string; block: number; advancedSlot: string | null;
  baseSets: Record<string, number>;
  exercises: Record<string, ExercisePrescription>;
};
export type SessionPrescription = FourDayPrescription | VarietyPrescription;
