> This research report preceded implementation. Its final section records the requirements at that time. Their current implementation status is in `four-day-upgrade.md`.

# Four-day training plan and evidence review

Prepared for Bakr Alhayek · 10 October 2026

## Recommendation and assumptions

For ongoing recreational training aimed at both muscle growth and strength, my recommended starting framework is **Upper A / Lower A / rest / Upper B / Lower B / rest / rest**. This organizes each major region into two weekly exposures and makes workload easier to balance. It is a practical synthesis of the evidence, not a uniquely superior split demonstrated in a trial.

This provisional prescription assumes a generally healthy adult, no exercise-limiting pain or medical restriction, the dumbbells and machines already listed in your app, and roughly 45–60 minutes per visit. I have reviewed your program code, but not your actual completed loads, recent attendance, recovery, or injury history. Those determine the final starting dose. The optional personalization questions were unanswered, so these assumptions are stated rather than treated as known facts.

Your continued training should carry forward. Changing the schedule does not require restarting as a beginner or deleting any records.

## What the current app prescribes

I calculated the mature-program workload directly from `app/workout-data.ts`: workouts G–L, full mode, after the first six sessions, with three sets on the first four exercises and two on the final two. This cycle occupies two weeks at three sessions per week.

| Muscle/exercise category | Two-week sets | Average per week | Observation |
| --- | ---: | ---: | --- |
| Chest presses | 22 | 11 | Already a substantial allocation |
| Back: rows and pulldowns | 16 | 8 | Concentrated into two pull sessions per cycle |
| Quadriceps: leg presses and split squats | 8 | 4 | Much lower allocation than chest |
| Hamstrings: RDLs and leg curls | 5 | 2.5 | Particularly low relative to the rest of the program |
| Lateral deltoid raises | 12 | 6 | Clear shoulder emphasis |
| Direct biceps | 6 | 3 | Plus work during pulling |
| Direct triceps | 6 | 3 | Plus work during pressing |
| Core drills | 18 | 9 | Repeated in all six sessions |
| Direct calves | 0 | 0 | Omitted from this rotation |

The program contains **48 exercise working sets per average week**. The table does not list hip thrusts, so its categories do not sum to that total. These are programmed counts, not verified completed work. Unilateral sets count once for each leg's exposure, rather than being doubled into six sets per muscle. Compound-exercise overlap, technique, range, load, and effort prevent these counts from being exact measures of muscle stimulus. Glute work overlaps several listed movements and is not assigned a misleading single total.

The current design can reflect a deliberate chest/shoulder preference. For balanced development, however, the lower-body allocation needs attention. Increasing attendance to four sessions while retaining the same G–L rotation would preserve that imbalance and give uneven weekly exposures. Four-day scheduling should accompany a redesigned allocation.

## What the evidence supports

| Question | Evidence and limits | Application here |
| --- | --- | --- |
| Which guideline is current? | The 2026 ACSM position stand synthesized 137 systematic reviews involving over 30,000 participants; its search ran through October 2024. It supports progressive training, with load and volume tailored to outcomes. [1] | Use it as the main framework, supplemented by newer volume evidence. |
| Is upper/lower uniquely best? | A 2024 meta-analysis of 14 studies found similar strength and hypertrophy changes with split and full-body routines when volume was equated. [2] | Choose upper/lower for the four-day schedule and repeatability, not a claim of inherent physiological superiority. |
| How much volume? | The 2026 dose-response review found increasing gains with increasing weekly volume, with diminishing returns. Direct and indirect work need different treatment; frequency had a clearer independent association with strength than hypertrophy. [3] | Count weekly muscle workload, distribute it, and adjust to progress and recovery. Do not add sets indefinitely. |
| How close to failure? | An exploratory 2024 meta-regression associated closer-to-failure sets with more hypertrophy; exact RIR relationships were uncertain because RIR was estimated. [4] ACSM did not find routine failure consistently superior. [1] | Most sets at about 1–3 RIR, with more margin during transition and demanding compounds. |
| How long to rest? | A 2024 review found a possible small benefit above 60 seconds, broad uncertainty, and no appreciable further hypertrophy difference above 90 seconds in its pooled comparisons. [5] | Use 2–3 minutes for demanding compounds and 60–120 seconds for accessories to maintain execution and repetitions. These are practical defaults, not magic thresholds. |
| Can supersets save time? | A 2025 review found shorter sessions and broadly similar long-term adaptations, but higher perceived effort; pair type affected preserved workload. [6] | Pair small opposing-muscle accessories if useful. Give priority lifts adequate recovery. |
| How should progression work? | A 2024 trial in 39 untrained young adults found gains using either load or repetition progression. Generalization beyond that setting is limited. [7] | Use a transparent double-progression rule rather than requiring a weight increase every visit. |

ACSM's public summary highlights approximately ten weekly sets per muscle for hypertrophy and heavier loads around 80% of 1RM for maximizing strength. Those are outcome-oriented reference points, not minimum requirements for every individual or every muscle. [8] This plan uses moderate rep ranges and starts below its eventual workload where your current leg allocation is low. It is a combined muscle-and-strength program rather than a powerlifting peak.

## Weekly schedule

| Day | Session | Main emphasis |
| --- | --- | --- |
| Monday | Upper A | Horizontal press and row |
| Tuesday | Lower A | Knee-dominant lift, hinge, knee flexion |
| Wednesday | Recovery / aerobic activity | No scheduled lifting |
| Thursday | Upper B | Incline press and vertical pull |
| Friday | Lower B | Hinge and unilateral leg work |
| Saturday | Recovery / aerobic activity | No scheduled lifting |
| Sunday | Recovery | Prepare for the next cycle |

For changing shifts, keep the A/B sequence and move dates. The example allows about 72 hours between repeated upper or lower sessions. Adjacent upper/lower days are intentional. If a session is missed, continue the sequence; avoid cramming two full sessions into one visit to satisfy a calendar count.

## The four workouts

The sets below are **working sets after a gradual transition**, excluding warm-up sets. Use a controlled, comfortable range of motion. For each unilateral exercise, complete both sides for one listed set.

### Upper A — 17 working sets

| Order | Exercise | Sets × reps | Rest before repeating the same exercise |
| --- | --- | --- | --- |
| 1 | Flat dumbbell bench press | 3 × 6–10 | 2–3 min |
| 2 | Seated row | 3 × 8–12 | 2–3 min |
| 3 | Lat pulldown | 2 × 8–12 | About 2 min |
| 4 | Low-incline dumbbell press | 2 × 8–12 | About 2 min |
| 5 | Dumbbell lateral raise | 3 × 12–20 | 60–120 sec |
| 6 | Dumbbell hammer curl | 2 × 10–15 | 60–120 sec |
| 7 | Overhead dumbbell triceps extension | 2 × 10–15 | 60–120 sec |

### Lower A — 11 working sets

| Order | Exercise | Sets × reps | Rest |
| --- | --- | --- | --- |
| 1 | Leg press | 3 × 8–12 | 2–3 min |
| 2 | Dumbbell Romanian deadlift | 2 × 8–12 | 2–3 min |
| 3 | Leg-curl machine | 2 × 10–15 | 90–120 sec |
| 4 | Supported standing calf raise | 2 × 10–20 | 60–120 sec |
| 5 | Kneeling cable crunch | 2 × 10–15 | 60–120 sec |

### Upper B — 17 working sets

| Order | Exercise | Sets × reps | Rest |
| --- | --- | --- | --- |
| 1 | Low-incline dumbbell press | 3 × 6–10 | 2–3 min |
| 2 | Lat pulldown | 3 × 8–12 | 2–3 min |
| 3 | Machine chest press | 2 × 10–15 | About 2 min |
| 4 | Supported one-arm dumbbell row | 2 × 10–15 per side | About 2 min |
| 5 | Dumbbell lateral raise | 3 × 12–20 | 60–120 sec |
| 6 | Dumbbell hammer curl | 2 × 10–15 | 60–120 sec |
| 7 | Overhead dumbbell triceps extension | 2 × 10–15 | 60–120 sec |

### Lower B — 13 working sets

| Order | Exercise | Sets × reps | Rest |
| --- | --- | --- | --- |
| 1 | Dumbbell Romanian deadlift | 2 × 6–10 | 2–3 min |
| 2 | Supported split squat | 3 × 8–12 per leg | 2–3 min |
| 3 | Leg press | 2 × 10–15 | About 2 min |
| 4 | Leg-curl machine | 2 × 10–15 | 90–120 sec |
| 5 | Supported standing calf raise | 2 × 10–20 | 60–120 sec |
| 6 | Front plank | 2 × 20–45 sec | 60–120 sec |

Use familiar loads that fit the specified rep range and effort. There is no need to perform a 1RM test to select starting weights. Upper sessions will usually be the longer visits; 45–60 minutes is a planning estimate and may need extending in a busy gym. If only 30–40 minutes are available, keep the main movement patterns and reduce accessory sets rather than rushing demanding lifts.

The curl and triceps exercises can be paired, with sufficient rest after each pair. Use straight sets for the first priority lifts initially. If you later alternate a press and pull, still allow enough elapsed recovery before repeating either exercise; the point is preserved performance, not breathlessness. [6]

### Resulting weekly allocation

| Category | Target working sets/week |
| --- | ---: |
| Chest | 10 |
| Rows and pulldowns | 10 |
| Quads | 8 |
| Hamstrings: RDLs plus curls | 8 |
| Lateral deltoids | 6 |
| Direct biceps / direct triceps | 4 each, plus compound involvement |
| Calves / core | 4 each |

Total exercise working sets: **58/week**. Glutes receive RDL, split-squat, and leg-press work; anterior deltoids receive pressing and posterior deltoids receive rowing contributions. Indirect work is not counted as a full extra direct set in this table. The eight-set lower-body targets are deliberate intermediate targets, given the low existing prescription. They can be adjusted after a stable period of actual progress/recovery data; ten is not a growth threshold.

## Transition from your existing training

Do not jump from the programmed 48 sets to 58 while simultaneously increasing training frequency and weights. Your actual recent completed volume, if lower, is the more relevant baseline.

For the first one to two four-day weeks, my conservative default is:

- Upper sessions: two working sets of each listed exercise, rather than the eventual three-set entries.
- Lower A: leg press 2; RDL 1; leg curl 1; calf raise 2; cable crunch 2.
- Lower B: RDL 1; split squat 1; leg press 2; leg curl 1; calf raise 2; plank 2.
- If calf training is new, start with one calf set per visit.
- Keep about three good repetitions in reserve and retain appropriate familiar loads. Reduce load where the new rep range or repeated lower-body exposure warrants it.

This gives approximately **43–45 working sets per week**, distributed over four visits. It is a practical transition strategy, not a clinically validated dosing formula. It avoids treating an extra day as a requirement to increase everything immediately.

Build toward the listed plan over subsequent weeks only when technique and performance remain stable and soreness does not disrupt the next session or daily activities. In particular, add lower-body work gradually—one additional weekly set for the relevant muscle at a time is a reasonable operational rule. Do not advance volume automatically because a week number changed. You may remain below the target if you are progressing well.

## Progression and recovery rules

**Effort:** after transition, aim for about 2 RIR on compound lifts and 1–2 RIR on accessories. RIR means the number of additional clean repetitions you estimate you could perform. These estimates are imperfect; maintain consistent technique and learn to calibrate them. Stop before technique deteriorates. Routine failure is not required. [1,4]

**Double progression:** choose a load that puts each set inside the rep range at the target RIR. Add repetitions over successive exposures. Once all prescribed sets reach the top of the range with the intended effort on two exposures, use the smallest practical load increase and work upward again. The two-exposure rule is my conservative implementation choice. If the available jump pushes repetitions below the lower limit, keep the existing load or use smaller increments when available. Progression can come from load or repetitions. [7]

**Example:** with a 3 × 8–12 prescription, 10/9/8, then 11/10/9, then eventually 12/12/12 are all meaningful progress. A plateau on one visit is not a diagnosis or an automatic deload trigger.

**Warm-up:** allow roughly 5–8 minutes for easy movement plus progressively heavier, non-fatiguing preparation sets for the first upper- or lower-body lifts. Add preparation for another pattern when needed. The exact minutes are a practical default, not a mandatory physiological threshold.

**Keep exercise selection stable:** use the same main lifts for an initial 6–8-week review period unless pain, equipment availability, or poor fit requires a change. This makes comparisons interpretable; it is not a claim that eight weeks is uniquely optimal. For substitutes, preserve the movement's purpose: a hip thrust, RDL, and leg curl are not interchangeable doses of hamstring training.

**Adjust to the trend:** if multiple sessions deteriorate, review sleep, illness, effort, food intake, recent workload, and pain before adding work. A temporary reduction in sets can be used for fatigue management. Evidence does not justify presenting the app's fixed sleep cutoffs or a three-exposure estimated-strength trend as a validated personal readiness diagnosis. Persistent or exercise-limiting pain requires exercise selection to be reassessed, rather than being overridden by a favorable app score.

For broader cardiovascular health, keep aerobic activity in the plan: WHO recommends 150–300 minutes/week of moderate activity or 75–150 minutes of vigorous activity, or an equivalent combination. This can be accumulated separately from the four lifting sessions. [9]

## Changes required in the tracker

This review specifies a new training program; it does not switch the live site or replace existing workout records.

1. **Versioned transition:** retain every completed and partial session's date, template, units, prescribed sets, and logs. Apply the four-day plan prospectively from a selected transition date. Carry exercise performance forward; do not use archive-and-restart merely to change weekly frequency.
2. **Explicit sessions:** the current `[0,2,4]` day offsets and `workoutIndexForDay` are hard-coded for three days. Changing only those offsets would affect interpretation of historical keys. A migration should give future sessions explicit identifiers, template IDs, dates, and prescription versions while preserving legacy references.
3. **Variable exercise and set counts:** Upper A/B contain seven exercises. Current six-exercise and first-four-three-sets rules cannot express this plan reliably. Store the intended set count per exercise and session rather than infer it solely from calendar position.
4. **Relevant recovery constraints:** allow adjacent upper/lower days. The old rule requiring a full rest day between every lifting session is incompatible with the example four-day schedule.
5. **Useful volume reporting:** calculate completed weekly hard sets by muscle and distinguish direct from indirect contributions. The current hard-coded exposure bars count appearances, not training dose.
6. **Consistent progression language:** `trainingPhaseForDay` cycles its phase labels every 12 sessions, while `workingSetsForDay` permanently raises some sets after session six. Replace that mismatch with explicit, ongoing prescription state and actual performance trends.
7. **Specific substitution and timer rules:** distinguish hinges from knee-flexion work and allow rest by exercise/session purpose. Keep readiness prompts advisory and label the exact heuristics as heuristics.

The next application change should implement this transition and test historical import, completed sessions, partial sessions, unit-aware previous performance, missed sessions, shift rescheduling, and backup round trips. No training-history migration was performed during this evidence review.

## Sources

1. Currier et al. **ACSM Position Stand: Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults**. *Medicine & Science in Sports & Exercise*, 2026. [PubMed](https://pubmed.ncbi.nlm.nih.gov/41843416/). Abstract and official ACSM summary reviewed; full-text retrieval was restricted.
2. Ramos-Campo et al. **Efficacy of Split Versus Full-Body Resistance Training on Strength and Muscle Growth**. *Journal of Strength and Conditioning Research*, 2024. [PubMed](https://pubmed.ncbi.nlm.nih.gov/38595233/).
3. Pelland et al. **The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains**. *Sports Medicine*, 2026; online December 2025. [PubMed](https://pubmed.ncbi.nlm.nih.gov/41343037/).
4. Robinson et al. **Exploring the Dose–Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy**. *Sports Medicine*, 2024. [PubMed](https://pubmed.ncbi.nlm.nih.gov/38970765/).
5. Singer et al. **Give it a rest: a systematic review with Bayesian meta-analysis on inter-set rest and hypertrophy**. *Frontiers in Sports and Active Living*, 2024. [PubMed](https://pubmed.ncbi.nlm.nih.gov/39205815/).
6. Zhang et al. **Superset Versus Traditional Resistance Training Prescriptions**. *Sports Medicine*, 2025. [PubMed](https://pubmed.ncbi.nlm.nih.gov/39903375/).
7. Chaves et al. **Effects of Resistance Training Overload Progression Protocols on Strength and Muscle Mass**. *International Journal of Sports Medicine*, 2024. [PubMed](https://pubmed.ncbi.nlm.nih.gov/38286426/).
8. ACSM. **Updated resistance training guidelines**, 17 March 2026. [Official summary](https://acsm.org/resistance-training-guidelines-update-2026/).
9. WHO. **Physical activity recommendations for adults**. [Official guidance](https://www.who.int/europe/news-room/fact-sheets/item/physical-activity).

This is an evidence-informed practical prescription under the stated assumptions. Its exact exercise combination, transition schedule, and adjustment rules have not themselves been tested as one superior regimen in a clinical trial.
