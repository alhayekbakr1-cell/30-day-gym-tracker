import { FOUR_DAY_WORKOUTS, type FourDayWorkoutId } from "./four-day-data";
export type WorkoutId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | FourDayWorkoutId;
export type ProgramVersion = 1 | 2 | 3;

export type Exercise = {
  alternative?: string;
  cue: string;
  id: string;
  name: string;
  reps: string;
};

export type ExercisePair = {
  exercises: Exercise[];
  id: string;
  title: string;
};

export type WorkoutPlan = {
  focus: string;
  id: WorkoutId;
  pairs: ExercisePair[];
  patterns: readonly string[];
  subtitle: string;
};

const TRAINING_DAY_OFFSETS = new Set([0, 2, 4]);

export function isTrainingDayNumber(day: number) {
  return Number.isInteger(day) && day > 0 && TRAINING_DAY_OFFSETS.has((day - 1) % 7);
}

export function scheduledTrainingDays(startDay: number, endDay: number) {
  const first = Math.max(1, Math.floor(startDay));
  const last = Math.max(first - 1, Math.floor(endDay));
  const days: number[] = [];
  for (let day = first; day <= last; day += 1) {
    if (isTrainingDayNumber(day)) days.push(day);
  }
  return days;
}

export function adjacentTrainingDay(day: number, direction: -1 | 1) {
  let candidate = day + direction;
  while (candidate > 0 && !isTrainingDayNumber(candidate)) candidate += direction;
  return candidate > 0 ? candidate : null;
}

export const WARMUP_ITEMS = [
  { id: "cardio", label: "3 min easy cardio", detail: "Treadmill, bike, or elliptical" },
  { id: "squats", label: "8 bodyweight squats", detail: "Sit toward a bench and keep your whole foot planted" },
  { id: "hinges", label: "8 hip hinges", detail: "Push the hips back with a long, neutral spine" },
  { id: "practice", label: "1 light practice set", detail: "Rehearse the first two exercises before loading them" },
] as const;

export const WORKOUTS: Record<WorkoutId, WorkoutPlan> = {
  ...FOUR_DAY_WORKOUTS,
  A: {
    focus: "Squat + horizontal push",
    id: "A",
    patterns: ["Quads", "Chest", "Hinge", "Back", "Shoulders", "Core"],
    subtitle: "Full body · foundation",
    pairs: [
      {
        id: "a-pair-1",
        title: "Pair 1",
        exercises: [
          { id: "leg-press", name: "Leg press", reps: "8–12 reps", alternative: "Dumbbell reverse lunge", cue: "Control the lowering and keep knees tracking over the toes." },
          { id: "flat-db-bench", name: "Flat dumbbell bench press", reps: "8–12 reps", cue: "Keep shoulder blades gently set against the bench." },
        ],
      },
      {
        id: "a-pair-2",
        title: "Pair 2",
        exercises: [
          { id: "db-rdl", name: "Dumbbell Romanian deadlift", reps: "8–12 reps", cue: "Keep the dumbbells close and stop when the hamstrings feel loaded." },
          { id: "lat-pulldown", name: "Lat pulldown", reps: "8–12 reps", alternative: "Available back machine", cue: "Drive elbows toward your pockets without leaning far back." },
        ],
      },
      {
        id: "a-pair-3",
        title: "Pair 3",
        exercises: [
          { id: "lateral-raise-a", name: "Seated dumbbell lateral raise", reps: "12–20 reps", cue: "Use light weight and lead with the elbows." },
          { id: "front-plank", name: "Front plank", reps: "20–45 sec", cue: "Squeeze glutes and keep ribs stacked over the pelvis." },
        ],
      },
    ],
  },
  B: {
    focus: "Single-leg + upper back",
    id: "B",
    patterns: ["Single-leg", "Chest", "Hamstrings", "Back", "Biceps", "Triceps"],
    subtitle: "Full body · unilateral",
    pairs: [
      {
        id: "b-pair-1",
        title: "Pair 1",
        exercises: [
          { id: "split-squat", name: "Supported split squat", reps: "8–12 / leg", cue: "Use one hand for balance and keep the front foot fully planted." },
          { id: "incline-db-bench", name: "Incline dumbbell bench press", reps: "8–12 reps", cue: "Use a low incline and lower the dumbbells with control." },
        ],
      },
      {
        id: "b-pair-2",
        title: "Pair 2",
        exercises: [
          { id: "leg-curl", name: "Leg-curl machine", reps: "10–15 reps", cue: "Pause briefly in the shortened position." },
          { id: "seated-row", name: "Seated row", reps: "8–12 reps", alternative: "One-arm dumbbell row", cue: "Pull with the elbows and avoid shrugging." },
        ],
      },
      {
        id: "b-pair-3",
        title: "Pair 3",
        exercises: [
          { id: "hammer-curl", name: "Dumbbell hammer curl", reps: "10–15 reps", cue: "Keep elbows still and wrists neutral." },
          { id: "triceps-extension", name: "Overhead dumbbell triceps extension", reps: "10–15 reps", cue: "Keep elbows comfortably narrow and move through a pain-free range." },
        ],
      },
    ],
  },
  C: {
    focus: "Glutes + supported machines",
    id: "C",
    patterns: ["Quads", "Chest", "Glutes", "Back", "Shoulders", "Calves"],
    subtitle: "Full body · build",
    pairs: [
      {
        id: "c-pair-1",
        title: "Pair 1",
        exercises: [
          { id: "leg-press-c", name: "Leg press", reps: "10–15 reps", alternative: "Leg extension", cue: "Use a comfortable stance and stop short of your pelvis curling." },
          { id: "machine-press", name: "Machine chest press", reps: "8–12 reps", alternative: "Shoulder-press machine", cue: "Keep the movement smooth and finish with two good reps available." },
        ],
      },
      {
        id: "c-pair-2",
        title: "Pair 2",
        exercises: [
          { id: "db-hip-thrust", name: "Dumbbell hip thrust", reps: "10–15 reps", cue: "Pause at the top without overextending the lower back." },
          { id: "one-arm-row", name: "One-arm dumbbell row", reps: "10–15 / side", alternative: "Available back machine", cue: "Brace on the bench and pull toward the hip." },
        ],
      },
      {
        id: "c-pair-3",
        title: "Pair 3",
        exercises: [
          { id: "lateral-raise-c", name: "Seated dumbbell lateral raise", reps: "12–20 reps", cue: "Stop around shoulder height and avoid swinging." },
          { id: "calf-raise", name: "Standing dumbbell calf raise", reps: "12–20 reps", cue: "Use support for balance and pause at the top and bottom." },
        ],
      },
    ],
  },
  D: {
    focus: "Hinge + vertical pull",
    id: "D",
    patterns: ["Hinge", "Back", "Single-leg", "Chest", "Biceps", "Core"],
    subtitle: "Full body · posterior chain",
    pairs: [
      {
        id: "d-pair-1",
        title: "Strength pair",
        exercises: [
          { id: "db-rdl", name: "Dumbbell Romanian deadlift", reps: "8–12 reps", cue: "Keep the dumbbells close and stop when the hamstrings feel loaded." },
          { id: "lat-pulldown", name: "Lat pulldown", reps: "8–12 reps", alternative: "Available back machine", cue: "Drive elbows toward your pockets without leaning far back." },
        ],
      },
      {
        id: "d-pair-2",
        title: "Balance pair",
        exercises: [
          { id: "split-squat", name: "Supported split squat", reps: "8–12 / leg", cue: "Use one hand for balance and keep the front foot fully planted." },
          { id: "flat-db-bench", name: "Flat dumbbell bench press", reps: "8–12 reps", cue: "Keep shoulder blades gently set against the bench." },
        ],
      },
      {
        id: "d-pair-3",
        title: "Finish pair",
        exercises: [
          { id: "hammer-curl", name: "Dumbbell hammer curl", reps: "10–15 reps", cue: "Keep elbows still and wrists neutral." },
          { id: "front-plank", name: "Front plank", reps: "20–45 sec", cue: "Squeeze glutes and keep ribs stacked over the pelvis." },
        ],
      },
    ],
  },
  E: {
    focus: "Knee flexion + machine press",
    id: "E",
    patterns: ["Hamstrings", "Chest", "Quads", "Back", "Shoulders", "Calves"],
    subtitle: "Full body · controlled volume",
    pairs: [
      {
        id: "e-pair-1",
        title: "Strength pair",
        exercises: [
          { id: "leg-curl", name: "Leg-curl machine", reps: "10–15 reps", cue: "Pause briefly in the shortened position." },
          { id: "machine-press", name: "Machine chest press", reps: "8–12 reps", alternative: "Flat dumbbell bench press", cue: "Keep the movement smooth and finish with two good reps available." },
        ],
      },
      {
        id: "e-pair-2",
        title: "Balance pair",
        exercises: [
          { id: "leg-press-c", name: "Leg press", reps: "10–15 reps", alternative: "Supported split squat", cue: "Use a comfortable stance and stop short of your pelvis curling." },
          { id: "one-arm-row", name: "One-arm dumbbell row", reps: "10–15 / side", alternative: "Available back machine", cue: "Brace on the bench and pull toward the hip." },
        ],
      },
      {
        id: "e-pair-3",
        title: "Finish pair",
        exercises: [
          { id: "lateral-raise-c", name: "Seated dumbbell lateral raise", reps: "12–20 reps", cue: "Stop around shoulder height and avoid swinging." },
          { id: "calf-raise", name: "Standing dumbbell calf raise", reps: "12–20 reps", cue: "Use support for balance and pause at the top and bottom." },
        ],
      },
    ],
  },
  F: {
    focus: "Glutes + incline push",
    id: "F",
    patterns: ["Glutes", "Chest", "Quads", "Back", "Triceps", "Core"],
    subtitle: "Full body · mixed angles",
    pairs: [
      {
        id: "f-pair-1",
        title: "Strength pair",
        exercises: [
          { id: "db-hip-thrust", name: "Dumbbell hip thrust", reps: "10–15 reps", cue: "Pause at the top without overextending the lower back." },
          { id: "incline-db-bench", name: "Incline dumbbell bench press", reps: "8–12 reps", cue: "Use a low incline and lower the dumbbells with control." },
        ],
      },
      {
        id: "f-pair-2",
        title: "Balance pair",
        exercises: [
          { id: "leg-press", name: "Leg press", reps: "8–12 reps", alternative: "Supported split squat", cue: "Control the lowering and keep knees tracking over the toes." },
          { id: "seated-row", name: "Seated row", reps: "8–12 reps", alternative: "One-arm dumbbell row", cue: "Pull with the elbows and avoid shrugging." },
        ],
      },
      {
        id: "f-pair-3",
        title: "Finish pair",
        exercises: [
          { id: "triceps-extension", name: "Overhead dumbbell triceps extension", reps: "10–15 reps", cue: "Keep elbows comfortably narrow and move through a pain-free range." },
          { id: "front-plank", name: "Front plank", reps: "20–45 sec", cue: "Squeeze glutes and keep ribs stacked over the pelvis." },
        ],
      },
    ],
  },
  G: {
    focus: "Chest + shoulders + triceps + abs",
    id: "G",
    patterns: ["Chest priority", "Shoulders", "Triceps", "Abs"],
    subtitle: "Push A · chest priority",
    pairs: [
      {
        id: "g-pair-1",
        title: "Chest strength",
        exercises: [
          { id: "flat-db-bench", name: "Flat dumbbell bench press", reps: "8–12 reps", cue: "Keep shoulder blades gently set against the bench." },
          { id: "lateral-raise-a", name: "Seated dumbbell lateral raise", reps: "12–20 reps", cue: "Use light weight and lead with the elbows." },
        ],
      },
      {
        id: "g-pair-2",
        title: "Upper-chest + triceps",
        exercises: [
          { id: "incline-db-bench", name: "Incline dumbbell bench press", reps: "8–12 reps", cue: "Use a low incline and lower the dumbbells with control." },
          { id: "triceps-extension", name: "Overhead dumbbell triceps extension", reps: "10–15 reps", cue: "Keep elbows comfortably narrow and use a pain-free range." },
        ],
      },
      {
        id: "g-pair-3",
        title: "Chest + abs finish",
        exercises: [
          { id: "machine-press", name: "Machine chest press", reps: "10–15 reps", cue: "Keep the movement smooth and finish with two good reps available." },
          { id: "dead-bug", name: "Dead bug", reps: "6–10 / side", cue: "Keep your low back gently heavy on the floor as the opposite arm and leg extend." },
        ],
      },
    ],
  },
  H: {
    focus: "Back + biceps + abs",
    id: "H",
    patterns: ["Lats", "Upper back", "Biceps", "Abs"],
    subtitle: "Pull A · back balance",
    pairs: [
      {
        id: "h-pair-1",
        title: "Vertical pull + abs",
        exercises: [
          { id: "lat-pulldown", name: "Lat pulldown", reps: "8–12 reps", cue: "Drive elbows toward your pockets without leaning far back." },
          { id: "dead-bug", name: "Dead bug", reps: "6–10 / side", cue: "Keep your low back gently heavy on the floor as the opposite arm and leg extend." },
        ],
      },
      {
        id: "h-pair-2",
        title: "Mid-back + biceps",
        exercises: [
          { id: "seated-row", name: "Seated row", reps: "8–12 reps", cue: "Pull with the elbows and avoid shrugging." },
          { id: "hammer-curl", name: "Dumbbell hammer curl", reps: "10–15 reps", cue: "Keep elbows still and wrists neutral." },
        ],
      },
      {
        id: "h-pair-3",
        title: "Back + abs finish",
        exercises: [
          { id: "one-arm-row", name: "One-arm dumbbell row", reps: "10–15 / side", cue: "Brace on the bench and pull toward the hip." },
          { id: "cable-crunch", name: "Kneeling cable crunch", reps: "10–15 reps", cue: "Bring ribs toward the pelvis without pulling with your arms." },
        ],
      },
    ],
  },
  I: {
    focus: "Legs + chest + shoulders + abs",
    id: "I",
    patterns: ["Quads", "Hamstrings", "Chest", "Shoulders", "Abs"],
    subtitle: "Legs A · upper-body priority support",
    pairs: [
      {
        id: "i-pair-1",
        title: "Legs + upper chest",
        exercises: [
          { id: "leg-press", name: "Leg press", reps: "8–12 reps", cue: "Control the lowering and keep knees tracking over the toes." },
          { id: "incline-db-bench", name: "Incline dumbbell bench press", reps: "8–12 reps", cue: "Use a low incline and lower the dumbbells with control." },
        ],
      },
      {
        id: "i-pair-2",
        title: "Single-leg + shoulders",
        exercises: [
          { id: "split-squat", name: "Supported split squat", reps: "8–12 / leg", cue: "Use one hand for balance and keep the front foot fully planted." },
          { id: "lateral-raise-a", name: "Seated dumbbell lateral raise", reps: "12–20 reps", cue: "Use light weight and lead with the elbows." },
        ],
      },
      {
        id: "i-pair-3",
        title: "Hamstrings + abs",
        exercises: [
          { id: "leg-curl", name: "Leg-curl machine", reps: "10–15 reps", cue: "Pause briefly in the shortened position." },
          { id: "front-plank", name: "Front plank", reps: "20–45 sec", cue: "Squeeze glutes and keep ribs stacked over the pelvis." },
        ],
      },
    ],
  },
  J: {
    focus: "Chest + shoulders + triceps + abs",
    id: "J",
    patterns: ["Chest priority", "Shoulders", "Triceps", "Abs"],
    subtitle: "Push B · alternate angles",
    pairs: [
      {
        id: "j-pair-1",
        title: "Chest + shoulders",
        exercises: [
          { id: "machine-press", name: "Machine chest press", reps: "8–12 reps", cue: "Keep the movement smooth and finish with two good reps available." },
          { id: "lateral-raise-c", name: "Seated dumbbell lateral raise", reps: "12–20 reps", cue: "Stop around shoulder height and avoid swinging." },
        ],
      },
      {
        id: "j-pair-2",
        title: "Chest + triceps",
        exercises: [
          { id: "flat-db-bench", name: "Flat dumbbell bench press", reps: "8–12 reps", cue: "Keep shoulder blades gently set against the bench." },
          { id: "triceps-extension", name: "Overhead dumbbell triceps extension", reps: "10–15 reps", cue: "Keep elbows comfortably narrow and use a pain-free range." },
        ],
      },
      {
        id: "j-pair-3",
        title: "Upper chest + abs",
        exercises: [
          { id: "incline-db-bench", name: "Incline dumbbell bench press", reps: "10–15 reps", cue: "Use a low incline and lower the dumbbells with control." },
          { id: "cable-crunch", name: "Kneeling cable crunch", reps: "10–15 reps", cue: "Bring ribs toward the pelvis without pulling with your arms." },
        ],
      },
    ],
  },
  K: {
    focus: "Back + biceps + abs",
    id: "K",
    patterns: ["Upper back", "Lats", "Biceps", "Abs"],
    subtitle: "Pull B · alternate angles",
    pairs: [
      {
        id: "k-pair-1",
        title: "Row + abs",
        exercises: [
          { id: "one-arm-row", name: "One-arm dumbbell row", reps: "8–12 / side", cue: "Brace on the bench and pull toward the hip." },
          { id: "cable-crunch", name: "Kneeling cable crunch", reps: "10–15 reps", cue: "Bring ribs toward the pelvis without pulling with your arms." },
        ],
      },
      {
        id: "k-pair-2",
        title: "Lats + biceps",
        exercises: [
          { id: "lat-pulldown", name: "Lat pulldown", reps: "10–15 reps", cue: "Drive elbows toward your pockets without leaning far back." },
          { id: "hammer-curl", name: "Dumbbell hammer curl", reps: "10–15 reps", cue: "Keep elbows still and wrists neutral." },
        ],
      },
      {
        id: "k-pair-3",
        title: "Mid-back + deep core",
        exercises: [
          { id: "seated-row", name: "Seated row", reps: "10–15 reps", cue: "Pull with the elbows and avoid shrugging." },
          { id: "dead-bug", name: "Dead bug", reps: "6–10 / side", cue: "Keep your low back gently heavy on the floor as the opposite arm and leg extend." },
        ],
      },
    ],
  },
  L: {
    focus: "Legs + chest + shoulders + abs",
    id: "L",
    patterns: ["Hamstrings", "Glutes", "Chest", "Shoulders", "Abs"],
    subtitle: "Legs B · posterior chain",
    pairs: [
      {
        id: "l-pair-1",
        title: "Hinge + chest",
        exercises: [
          { id: "db-rdl", name: "Dumbbell Romanian deadlift", reps: "8–12 reps", cue: "Keep the dumbbells close and stop when the hamstrings feel loaded." },
          { id: "flat-db-bench", name: "Flat dumbbell bench press", reps: "8–12 reps", cue: "Keep shoulder blades gently set against the bench." },
        ],
      },
      {
        id: "l-pair-2",
        title: "Glutes + shoulders",
        exercises: [
          { id: "db-hip-thrust", name: "Dumbbell hip thrust", reps: "10–15 reps", cue: "Pause at the top without overextending the lower back." },
          { id: "lateral-raise-c", name: "Seated dumbbell lateral raise", reps: "12–20 reps", cue: "Stop around shoulder height and avoid swinging." },
        ],
      },
      {
        id: "l-pair-3",
        title: "Quads + abs",
        exercises: [
          { id: "leg-press-c", name: "Leg press", reps: "10–15 reps", cue: "Use a comfortable stance and stop short of your pelvis curling." },
          { id: "front-plank", name: "Front plank", reps: "20–45 sec", cue: "Squeeze glutes and keep ribs stacked over the pelvis." },
        ],
      },
    ],
  },
};

export const EXERCISE_LIBRARY: Record<string, Exercise> = Object.fromEntries(
  Object.values(WORKOUTS).flatMap((workout) =>
    workout.pairs.flatMap((pair) =>
      pair.exercises.map((exercise) => [exercise.id, exercise]),
    ),
  ),
);

export const EXERCISE_SUBSTITUTIONS: Record<string, readonly string[]> = {
  "leg-press": ["split-squat"],
  "flat-db-bench": ["machine-press", "incline-db-bench"],
  "db-rdl": [],
  "lat-pulldown": ["one-arm-row", "seated-row"],
  "split-squat": ["leg-press"],
  "incline-db-bench": ["machine-press", "flat-db-bench"],
  "leg-curl": [],
  "seated-row": ["one-arm-row", "lat-pulldown"],
  "leg-press-c": ["split-squat"],
  "machine-press": ["flat-db-bench", "incline-db-bench"],
  "db-hip-thrust": [],
  "one-arm-row": ["seated-row", "lat-pulldown"],
  "front-plank": [],
  "dead-bug": ["front-plank", "cable-crunch"],
  "cable-crunch": ["dead-bug", "front-plank"],
};

export function workoutIdForDay(
  day: number,
  programVersion: ProgramVersion = 3,
): WorkoutId {
  const index = workoutIndexForDay(day);
  const rotation = programVersion === 1
    ? (["A", "B", "C"] as const)
    : programVersion === 2
      ? (["A", "B", "C", "D", "E", "F"] as const)
      : (["G", "H", "I", "J", "K", "L"] as const);
  return rotation[index % rotation.length];
}

export function workoutIndexForDay(day: number): number {
  if (!isTrainingDayNumber(day)) return 0;
  const zeroBasedDay = day - 1;
  const fullWeeks = Math.floor(zeroBasedDay / 7);
  const offset = zeroBasedDay % 7;
  const sessionsThisWeek = offset >= 4 ? 3 : offset >= 2 ? 2 : 1;
  return fullWeeks * 3 + sessionsThisWeek - 1;
}

export function workoutSessionNumber(day: number) {
  return workoutIndexForDay(day) + 1;
}

export function trainingPhaseForDay(day: number) {
  const index = workoutIndexForDay(day);
  if (index < 3) {
    return { label: "Learn", note: "Practice repeatable technique with 3 reps in reserve." };
  }
  if (index < 6) {
    return { label: "Build", note: "Add clean reps while keeping 2–3 reps in reserve." };
  }
  if (index < 10) {
    return { label: "Progress", note: "The first four movements expand to three working sets." };
  }
  return { label: "Consolidate", note: "Beat a prior rep or load without testing a maximum." };
}

export function canonicalExerciseId(id: string) {
  if (id === "leg-press-c") return "leg-press";
  if (id === "lateral-raise-c") return "lateral-raise-a";
  return id;
}

export function workingSetsForDay(day: number, exerciseIndex: number, short: boolean) {
  return short || workoutIndexForDay(day) < 6 || exerciseIndex >= 4 ? 2 : 3;
}
