export type ExerciseGuide = {
  checks: readonly [string, string];
  image: string;
  imageAlt: string;
  reference: {
    label: string;
    url: string;
  };
  setup: string;
  steps: readonly [string, string, string];
};

const legPress: ExerciseGuide = {
  image: "/exercises/leg-press.webp",
  imageAlt:
    "Side-by-side start and finish positions for a seated leg press with the back supported and feet planted",
  setup:
    "Adjust the seat so your back and pelvis stay flat on the pad. Place your whole feet about shoulder-width apart on the platform.",
  steps: [
    "Brace gently and lower until your knees reach a comfortable bend—about 90° is enough for most people.",
    "Press through your midfoot and heel while each knee follows the direction of its toes.",
    "Stop just before your knees lock, then return slowly without letting the weight stack slam.",
  ],
  checks: [
    "Your heels never lift and your knees never collapse inward.",
    "Your tailbone stays against the pad at the deepest position.",
  ],
  reference: {
    label: "Watch Mayo Clinic's leg-press demonstration",
    url: "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/leg-press/vid-20084684",
  },
};

const lateralRaise: ExerciseGuide = {
  image: "/exercises/seated-dumbbell-lateral-raise.webp",
  imageAlt:
    "Side-by-side start and finish positions for a seated dumbbell lateral raise",
  setup:
    "Sit tall near the front of the bench with very light dumbbells at your sides, palms facing inward and elbows softly bent.",
  steps: [
    "Set your ribs over your pelvis and keep your neck long.",
    "Lead with your elbows and raise the dumbbells slightly forward of your body until about shoulder height.",
    "Pause briefly, then lower under control all the way to your sides.",
  ],
  checks: [
    "Your shoulders stay away from your ears and your torso does not swing.",
    "Your hands finish level with or slightly below your elbows—not far above them.",
  ],
  reference: {
    label: "Review the ACE lateral-raise guide",
    url: "https://www.acefitness.org/resources/everyone/exercise-library/26/lateral-raise/",
  },
};

export const EXERCISE_GUIDES: Record<string, ExerciseGuide> = {
  "leg-press": legPress,
  "leg-press-c": legPress,
  "flat-db-bench": {
    image: "/exercises/flat-dumbbell-bench-press.webp",
    imageAlt:
      "Side-by-side bottom and top positions for a flat dumbbell bench press",
    setup:
      "Lie with your eyes below the dumbbells, feet firmly planted, and shoulder blades gently pulled down and back against the bench.",
    steps: [
      "Start above mid-chest with wrists stacked over elbows and a soft bend at the top.",
      "Lower for 2–3 seconds until the dumbbells reach chest level, keeping elbows about 30–45° from your torso.",
      "Press up and slightly inward without bouncing, shrugging, or letting your shoulders roll forward.",
    ],
    checks: [
      "Your forearms look nearly vertical at the bottom and your wrists stay straight.",
      "Your feet, glutes, head, and upper back remain supported throughout.",
    ],
    reference: {
      label: "Review the ACE dumbbell chest-press guide",
      url: "https://www.acefitness.org/resources/everyone/exercise-library/19/chest-press/",
    },
  },
  "db-rdl": {
    image: "/exercises/dumbbell-romanian-deadlift.webp",
    imageAlt:
      "Side-by-side upright and hip-hinged positions for a dumbbell Romanian deadlift",
    setup:
      "Stand hip-width with dumbbells close to your thighs, knees softly bent, ribs stacked, and weight spread across each whole foot.",
    steps: [
      "Push your hips straight back as if closing a car door while keeping your shins almost vertical.",
      "Slide the dumbbells close to your legs and stop when your hamstrings feel loaded—often around mid-shin.",
      "Drive the floor away and bring your hips forward to stand tall; finish without leaning backward.",
    ],
    checks: [
      "Your spine and neck stay long and neutral; the movement comes from the hips.",
      "Your knees remain softly bent rather than turning the hinge into a squat.",
    ],
    reference: {
      label: "Review the ACE Romanian-deadlift guide",
      url: "https://www.acefitness.org/resources/everyone/exercise-library/317/romanian-deadlift/",
    },
  },
  "lat-pulldown": {
    image: "/exercises/lat-pulldown.webp",
    imageAlt:
      "Side-by-side arms-up and bar-down positions for a seated lat pulldown",
    setup:
      "Lock the thigh pad snugly over your legs. Sit tall and take a comfortable overhand grip slightly wider than your shoulders.",
    steps: [
      "Begin with long arms, then pull your shoulder blades gently down away from your ears.",
      "Drive your elbows toward your sides until the bar reaches your upper chest.",
      "Return slowly to long arms without losing your tall torso or letting the weight stack slam.",
    ],
    checks: [
      "Your torso stays almost upright—only a small natural lean is needed.",
      "The bar travels in front of your face, never behind your neck.",
    ],
    reference: {
      label: "Review the ACE seated lat-pulldown guide",
      url: "https://www.acefitness.org/resources/everyone/exercise-library/158/seated-lat-pulldown/",
    },
  },
  "lateral-raise-a": lateralRaise,
  "lateral-raise-c": lateralRaise,
  "front-plank": {
    image: "/exercises/front-plank.webp",
    imageAlt:
      "Side-by-side setup and braced positions for a forearm front plank",
    setup:
      "Place elbows directly under shoulders, forearms on the floor, and step your feet back about hip-width.",
    steps: [
      "Press the floor away and make a straight line from the back of your head through your heels.",
      "Gently squeeze your glutes and draw your ribs toward your pelvis without holding your breath.",
      "End the set when you can no longer keep the same straight, braced position.",
    ],
    checks: [
      "Your hips neither sag toward the floor nor lift into a tent.",
      "You can take small, quiet breaths while maintaining the brace.",
    ],
    reference: {
      label: "Review the ACE front-plank guide",
      url: "https://www.acefitness.org/resources/everyone/exercise-library/32/front-plank/",
    },
  },
  "split-squat": {
    image: "/exercises/supported-split-squat.webp",
    imageAlt:
      "Side-by-side standing and lowered positions for a supported split squat",
    setup:
      "Use one hand on a stable rail or bench. Take a staggered stance with your feet hip-width apart, not balanced on one line.",
    steps: [
      "Keep most of your pressure through the whole front foot and lower your body mostly straight down.",
      "Let the front knee follow the second and third toes while the back knee moves toward the floor.",
      "Stop at a pain-free depth, then drive through the front foot to return to the same stance.",
    ],
    checks: [
      "Your front heel stays planted and the knee does not cave inward.",
      "The support helps balance only—you are not pulling yourself up with your arm.",
    ],
    reference: {
      label: "Watch Mayo Clinic's lunge demonstration",
      url: "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/lunge/vid-20084662",
    },
  },
  "incline-db-bench": {
    image: "/exercises/incline-dumbbell-bench-press.webp",
    imageAlt:
      "Side-by-side bottom and top positions for a low-incline dumbbell bench press",
    setup:
      "Set the bench to a low incline, roughly 20–35°. Plant your feet and keep your head, upper back, and glutes supported.",
    steps: [
      "Start with dumbbells above the upper chest, wrists straight and shoulders down.",
      "Lower under control with elbows about 30–45° from your torso until the dumbbells reach chest level.",
      "Press up without shrugging or letting your lower back lift away from its natural small arch.",
    ],
    checks: [
      "Your forearms stay nearly vertical beneath the dumbbells.",
      "The bench is not so steep that the movement becomes a shoulder press.",
    ],
    reference: {
      label: "Review the ACE incline chest-press guide",
      url: "https://www.acefitness.org/resources/everyone/exercise-library/25/incline-chest-press/",
    },
  },
  "leg-curl": {
    image: "/exercises/seated-leg-curl.webp",
    imageAlt:
      "Side-by-side straight-leg and curled positions for a seated leg-curl machine",
    setup:
      "Align your knee with the machine pivot, secure the thigh pad, and place the lower pad just above your heels.",
    steps: [
      "Sit fully back with a tall, supported torso and begin with knees comfortably extended.",
      "Pull your heels down and back by bending the knees without lifting your hips from the seat.",
      "Pause briefly, then return slowly without letting the plates touch between repetitions.",
    ],
    checks: [
      "The machine pivot remains lined up with your knee joint.",
      "Your hips stay down and you do not jerk the weight to start the curl.",
    ],
    reference: {
      label: "Watch Mayo Clinic's seated hamstring-curl demonstration",
      url: "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/seated-hamstring-curl/vid-20084685",
    },
  },
  "seated-row": {
    image: "/exercises/seated-row.webp",
    imageAlt:
      "Side-by-side arms-long and handles-pulled positions for a seated row machine",
    setup:
      "Sit tall with feet supported, knees softly bent, chest up, and shoulders relaxed away from your ears.",
    steps: [
      "Begin with long arms while keeping your spine neutral rather than rounding forward.",
      "Pull your elbows back toward your pockets until the handle reaches your lower ribs.",
      "Pause without shrugging, then straighten your arms slowly while your torso stays still.",
    ],
    checks: [
      "Your shoulders do not roll forward or climb toward your ears.",
      "You are not rocking your torso back and forth to move the load.",
    ],
    reference: {
      label: "Watch Mayo Clinic's seated-row demonstration",
      url: "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/seated-row/vid-20084688",
    },
  },
  "hammer-curl": {
    image: "/exercises/dumbbell-hammer-curl.webp",
    imageAlt:
      "Side-by-side arms-down and elbows-bent positions for a dumbbell hammer curl",
    setup:
      "Stand tall with light dumbbells at your sides, palms facing your thighs, wrists straight, and elbows resting beside your ribs.",
    steps: [
      "Brace gently and curl the dumbbells by bending only at the elbows.",
      "Stop before your elbows drift forward or your shoulders roll in.",
      "Lower for 2–3 seconds until your arms are long again, keeping the neutral grip.",
    ],
    checks: [
      "Your upper arms remain nearly still beside your torso.",
      "Your body does not lean back or swing to start the repetition.",
    ],
    reference: {
      label: "Review the ACE hammer-curl guide",
      url: "https://www.acefitness.org/resources/everyone/exercise-library/10/hammer-curl/",
    },
  },
  "triceps-extension": {
    image: "/exercises/overhead-dumbbell-triceps-extension.webp",
    imageAlt:
      "Side-by-side lowered and raised positions for a seated overhead dumbbell triceps extension",
    setup:
      "Sit tall against the bench and hold one dumbbell securely by its upper head with both hands above your head.",
    steps: [
      "Keep your ribs stacked and point your upper arms generally upward with elbows comfortably narrow.",
      "Bend only the elbows to lower the dumbbell behind your head through a pain-free range.",
      "Straighten the elbows smoothly without arching your back or forcing the elbows inward.",
    ],
    checks: [
      "Your upper arms stay mostly still and your neck remains relaxed.",
      "You feel the triceps working without pinching in either shoulder or elbow.",
    ],
    reference: {
      label: "Review the ACE dumbbell triceps-extension guide",
      url: "https://www.acefitness.org/resources/everyone/exercise-library/74/triceps-extension/",
    },
  },
  "machine-press": {
    image: "/exercises/machine-chest-press.webp",
    imageAlt:
      "Side-by-side handles-back and arms-extended positions for a seated machine chest press",
    setup:
      "Adjust the seat so the handles line up around mid-chest. Keep your feet planted and your head, upper back, and pelvis against the pad.",
    steps: [
      "Begin with wrists straight, forearms behind the handles, and elbows slightly below shoulder height.",
      "Press forward smoothly until your arms are nearly straight without locking the elbows.",
      "Return under control until you feel a comfortable chest stretch while your shoulders remain supported.",
    ],
    checks: [
      "Your shoulders stay down rather than rolling forward at the finish.",
      "The handles track at chest level—not high toward your neck.",
    ],
    reference: {
      label: "Watch Mayo Clinic's machine chest-press demonstration",
      url: "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/chest-press/vid-20084687",
    },
  },
  "db-hip-thrust": {
    image: "/exercises/dumbbell-hip-thrust.webp",
    imageAlt:
      "Side-by-side lowered and raised positions for a bench-supported dumbbell hip thrust",
    setup:
      "Place your upper back against the bench edge, feet about hip-width, and a padded dumbbell securely across the front of your hips.",
    steps: [
      "Start with hips lowered and chin gently tucked while your whole feet stay planted.",
      "Drive through your heels and squeeze your glutes to lift until your torso and thighs form one line.",
      "Pause without arching your lower back, then lower your hips slowly.",
    ],
    checks: [
      "At the top, your shins are roughly vertical and your ribs stay down.",
      "You finish by squeezing the glutes—not by throwing your head back or overextending your spine.",
    ],
    reference: {
      label: "Review the ACE elevated glute-bridge guide",
      url: "https://www.acefitness.org/resources/everyone/exercise-library/367/elevated-glute-bridge/",
    },
  },
  "one-arm-row": {
    image: "/exercises/one-arm-dumbbell-row.webp",
    imageAlt:
      "Side-by-side arm-long and dumbbell-pulled positions for a bench-supported one-arm row",
    setup:
      "Support one hand and the same-side knee on the bench. Plant the other foot wide enough for balance and keep a long neutral spine.",
    steps: [
      "Let the dumbbell hang under your shoulder while keeping your torso square to the floor.",
      "Pull your elbow toward your back pocket until the dumbbell reaches the side of your lower ribs.",
      "Lower slowly to a long arm without rotating your chest or shrugging.",
    ],
    checks: [
      "Your spine stays neutral and both shoulders remain at nearly the same height.",
      "The dumbbell travels toward your hip rather than straight up toward your shoulder.",
    ],
    reference: {
      label: "Review the ACE single-arm row guide",
      url: "https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/",
    },
  },
  "calf-raise": {
    image: "/exercises/standing-dumbbell-calf-raise.webp",
    imageAlt:
      "Side-by-side heels-down and heels-raised positions for a supported standing dumbbell calf raise",
    setup:
      "Stand tall with feet about hip-width, one hand lightly on stable support, and a dumbbell in the other hand.",
    steps: [
      "Keep your knees straight but soft and spread pressure evenly across the base of your toes.",
      "Rise as high as you can onto the balls of both feet without rolling your ankles outward.",
      "Pause, then lower your heels slowly to a comfortable stretch before the next repetition.",
    ],
    checks: [
      "Your ankles travel straight up rather than collapsing inward or outward.",
      "Your torso stays tall and you are not bouncing through the bottom.",
    ],
    reference: {
      label: "Watch Mayo Clinic's dumbbell calf-raise demonstration",
      url: "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/calf-raise/vid-20084681",
    },
  },
  "dead-bug": {
    image: "/exercises/dead-bug.webp",
    imageAlt: "Side-by-side setup and opposite arm-and-leg extension positions for a dead bug exercise",
    setup: "Lie on your back with hips and knees bent to about 90 degrees and both arms reaching toward the ceiling. Gently press your low back toward the mat.",
    steps: [
      "Brace as if preparing for a cough while continuing to breathe quietly.",
      "Slowly extend one leg and the opposite arm only as far as you can without your low back lifting.",
      "Return with control, reset your brace, and alternate sides without rushing.",
    ],
    checks: [
      "Your ribs stay down and your low back remains gently connected to the mat.",
      "The moving arm and leg stop before your trunk position changes.",
    ],
    reference: {
      label: "Review the ACE supine dead-bug guide",
      url: "https://www.acefitness.org/resources/everyone/exercise-library/147/supine-dead-bug/",
    },
  },
  "cable-crunch": {
    image: "/exercises/kneeling-cable-crunch.webp",
    imageAlt: "Side-by-side tall-kneeling and shortened positions for a kneeling rope cable crunch",
    setup: "Attach a rope to a high pulley, kneel facing the machine, and hold the rope beside your temples. Start tall with your hips stable and the cable already under light tension.",
    steps: [
      "Brace and bring your ribs toward your pelvis by rounding through the trunk rather than sitting your hips backward.",
      "Pause briefly when your abdominal muscles are shortened; keep your hands quiet beside your head.",
      "Return slowly to the tall start position without letting the weight stack pull you upward.",
    ],
    checks: [
      "Your hips stay nearly fixed while the rib cage moves toward the pelvis.",
      "Your arms hold the rope in place instead of pulling it down like a pulldown.",
    ],
    reference: {
      label: "Read ACE's evidence-based abdominal-training overview",
      url: "https://www.acefitness.org/resources/pros/expert-articles/8989/crunch-time-an-evidence-based-approach-to-training-the-abs/",
    },
  },
};

export const WARMUP_GUIDES: Partial<Record<string, ExerciseGuide>> = {
  squats: {
    image: "/exercises/bodyweight-squat-warmup.webp",
    imageAlt:
      "Side-by-side standing and lowered positions for a bodyweight warm-up squat",
    setup:
      "Stand with feet about shoulder-width, toes turned out only slightly, and pressure spread across each whole foot.",
    steps: [
      "Reach your arms forward, brace gently, and sit your hips down and back.",
      "Let your knees bend in the same direction as your toes while both heels stay planted.",
      "Stop at a comfortable depth, then push the floor away to stand tall without snapping the knees back.",
    ],
    checks: [
      "Your knees track over your feet instead of collapsing toward each other.",
      "You can keep your whole foot planted and your spine long at the bottom.",
    ],
    reference: {
      label: "Watch Mayo Clinic's squat demonstration",
      url: "https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/squat/vid-20084663",
    },
  },
  hinges: {
    image: "/exercises/bodyweight-hip-hinge-warmup.webp",
    imageAlt:
      "Side-by-side upright and hip-hinged positions for a bodyweight warm-up hinge",
    setup:
      "Stand hip-width with hands on your hip creases, knees softly bent, ribs stacked, and weight over your whole feet.",
    steps: [
      "Push your hips straight behind you while your shins remain almost vertical.",
      "Let your torso tip forward as one long unit without rounding your back or bending deeply at the knees.",
      "Squeeze your glutes and bring your hips forward to stand tall without leaning backward.",
    ],
    checks: [
      "You feel the back of your thighs load more than the front of your knees.",
      "Your head, ribs, and pelvis stay aligned rather than curling forward.",
    ],
    reference: {
      label: "Review the ACE hip-hinge pattern",
      url: "https://www.acefitness.org/resources/everyone/exercise-library/317/romanian-deadlift/",
    },
  },
};
