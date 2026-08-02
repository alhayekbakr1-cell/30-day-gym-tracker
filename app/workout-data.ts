export type WorkoutId = "A" | "B" | "C";

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
  id: WorkoutId;
  pairs: ExercisePair[];
  subtitle: string;
};

export const SCHEDULED_DAYS = [
  1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26, 29,
] as const;

export const CHALLENGE_LENGTH_DAYS = 30;

export const WARMUP_ITEMS = [
  { id: "cardio", label: "3 min easy cardio", detail: "Treadmill, bike, or elliptical" },
  { id: "squats", label: "8 bodyweight squats", detail: "Sit toward a bench and keep your whole foot planted" },
  { id: "hinges", label: "8 hip hinges", detail: "Push the hips back with a long, neutral spine" },
  { id: "practice", label: "1 light practice set", detail: "Rehearse the first two exercises before loading them" },
] as const;

export const WORKOUTS: Record<WorkoutId, WorkoutPlan> = {
  A: {
    id: "A",
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
    id: "B",
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
          { id: "leg-curl", name: "Leg-curl machine", reps: "10–15 reps", alternative: "Dumbbell hip thrust", cue: "Pause briefly in the shortened position." },
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
    id: "C",
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
  "db-rdl": ["db-hip-thrust", "leg-curl"],
  "lat-pulldown": ["one-arm-row", "seated-row"],
  "split-squat": ["leg-press"],
  "incline-db-bench": ["machine-press", "flat-db-bench"],
  "leg-curl": ["db-hip-thrust", "db-rdl"],
  "seated-row": ["one-arm-row", "lat-pulldown"],
  "leg-press-c": ["split-squat"],
  "machine-press": ["flat-db-bench", "incline-db-bench"],
  "db-hip-thrust": ["db-rdl", "leg-curl"],
  "one-arm-row": ["seated-row", "lat-pulldown"],
};

export function workoutIdForDay(day: number): WorkoutId {
  const index = SCHEDULED_DAYS.indexOf(day as (typeof SCHEDULED_DAYS)[number]);
  return (["A", "B", "C"] as const)[Math.max(index, 0) % 3];
}

export function workoutIndexForDay(day: number): number {
  return Math.max(
    SCHEDULED_DAYS.indexOf(day as (typeof SCHEDULED_DAYS)[number]),
    0,
  );
}
