import type { Exercise } from "./workout-data";

// New movements have distinct IDs: their loads never become a hammer-curl or
// overhead-extension personal record just because they occupy the same slot.
export const VARIETY_EXERCISES: Record<string, Exercise> = {
  "db-supinated-curl": { id: "db-supinated-curl", name: "Dumbbell palms-up curl", reps: "10–15 reps", cue: "Keep upper arms still, palms up and wrists straight. Lower without swinging." },
  "incline-db-curl": { id: "incline-db-curl", name: "Incline dumbbell curl", reps: "10–15 reps", cue: "Support your back on a low incline. Let arms hang naturally and use a comfortable range without pulling shoulders back." },
  "concentration-curl": { id: "concentration-curl", name: "Seated concentration curl", reps: "10–15 / side", cue: "Rest the upper arm against the inner thigh. Curl smoothly without turning your torso; log reps per side." },
  "lying-db-triceps": { id: "lying-db-triceps", name: "Lying dumbbell triceps extension", reps: "10–15 reps", cue: "Lie supported on a bench with a light dumbbell in each hand. Bend the elbows beside your head, then extend through a comfortable range." },
  "single-arm-overhead-triceps": { id: "single-arm-overhead-triceps", name: "Single-arm overhead triceps extension", reps: "10–15 / side", cue: "Sit or stand tall with a light dumbbell. Keep ribs down, bend the elbow comfortably, then extend without forcing the shoulder; log reps per side." },
  "chest-supported-rear-delt-fly": { id: "chest-supported-rear-delt-fly", name: "Chest-supported dumbbell rear-delt fly", reps: "12–20 reps", cue: "Support your chest on an incline bench. Lift very light dumbbells outward with softly bent elbows, without shrugging or arching." },
  "standing-db-lateral-raise": { id: "standing-db-lateral-raise", name: "Standing dumbbell lateral raise", reps: "12–20 reps", cue: "Stand tall with light dumbbells. Lift slightly forward of your sides to a comfortable height without swinging." },
  "side-plank": { id: "side-plank", name: "Side plank", reps: "20–40 sec / side", cue: "Place the elbow under the shoulder. Keep hips aligned and breathe; use bent knees if needed. Log seconds per side." },
  "bird-dog": { id: "bird-dog", name: "Bird dog", reps: "6–10 / side", cue: "From hands and knees, reach the opposite arm and leg without rotating or arching. Pause briefly and log reps per side." },
};
