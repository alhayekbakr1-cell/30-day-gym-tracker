import type { TrackerState } from "./tracker-types";
import { FOUR_DAY_EXERCISES, FOUR_DAY_NAMES, FOUR_DAY_ROTATION, FOUR_DAY_WORKOUTS, initialFourDaySets } from "./four-day-data";
import { MUSCLE_BY_EXERCISE } from "./training-insights";

const evidence = [
  { label: "2026 ACSM position stand", note: "Progressive resistance training supports strength and muscle. Volume, load, and effort should fit the person and goal.", url: "https://pubmed.ncbi.nlm.nih.gov/41843416/" },
  { label: "Split versus full-body routines", note: "Neither split was consistently superior when volume was equated. Upper/lower is a practical choice for four visits.", url: "https://pubmed.ncbi.nlm.nih.gov/38595233/" },
  { label: "Weekly volume and frequency", note: "More volume can produce more gains with diminishing returns. Adjust to actual progress and recovery.", url: "https://pubmed.ncbi.nlm.nih.gov/41343037/" },
  { label: "Effort and proximity to failure", note: "Closer-to-failure work may support hypertrophy; the precise optimal distance is uncertain. Routine failure is not required.", url: "https://pubmed.ncbi.nlm.nih.gov/38970765/" },
  { label: "Rest between sets", note: "Allow enough recovery to maintain technique and repetitions. This plan uses longer rests for demanding lifts.", url: "https://pubmed.ncbi.nlm.nih.gov/39205815/" },
  { label: "Progression in reps or load", note: "Both can produce gains. Repeating the top of a range twice is this app’s conservative rule, not a guideline requirement.", url: "https://pubmed.ncbi.nlm.nih.gov/38286426/" },
];

export default function ProgramIntelligence({ tracker }: { tracker: TrackerState }) {
  const sets = tracker.fourDayPlan?.sets ?? initialFourDaySets();
  const allocation = new Map<string, { current: number; target: number }>();
  for (const id of FOUR_DAY_ROTATION) for (const exercise of FOUR_DAY_EXERCISES[id]) {
    const group = MUSCLE_BY_EXERCISE[exercise.id];
    if (!group) continue;
    const previous = allocation.get(group) ?? { current: 0, target: 0 };
    allocation.set(group, { current: previous.current + sets[id][exercise.id], target: previous.target + exercise.targetSets });
  }
  return <section className="card program-card" id="program" aria-labelledby="program-title">
    <div className="section-heading program-heading"><div><p className="eyebrow">Evidence, made practical</p><h2 id="program-title">A balanced four-day routine</h2>
      <p>Upper and lower sessions repeat twice per cycle. Keep the main lifts consistent, log your effort, and build volume gradually.</p></div>
      <span className="program-version">{tracker.fourDayPlan ? "Four-day plan active" : "Available four-day plan"}</span></div>
    <div className="rotation-track four-day-rotation" aria-label="Four-workout rotation">
      {FOUR_DAY_ROTATION.map((id, index) => <article className="rotation-stop" key={id}><div><span>{index + 1}</span><small>{FOUR_DAY_NAMES[id]}</small></div>
        <strong>{FOUR_DAY_NAMES[id]}</strong><p>{FOUR_DAY_EXERCISES[id].length} exercises · {Object.values(sets[id]).reduce((sum, count) => sum + count, 0)} working sets</p>
        <ul>{FOUR_DAY_WORKOUTS[id].patterns.map(pattern => <li key={pattern}>{pattern}</li>)}</ul></article>)}
    </div>
    <section className="muscle-priority" aria-labelledby="muscle-priority-title"><div><strong id="muscle-priority-title">Working sets per four-session cycle</strong><span>{tracker.fourDayPlan ? "Chosen dose / eventual target" : "Starting dose / eventual target"}. Targets guide gradual progression; they are not minimum requirements.</span></div>
      <div className="muscle-bars">{[...allocation].map(([group, value]) => <div key={group}><span>{group}</span><i aria-hidden="true"><b style={{ width: `${value.current / value.target * 100}%` }} /></i><strong>{value.current}/{value.target}</strong></div>)}</div>
      {tracker.trainingCycle?.enabled && <p>These show your configured base dose. Future prescriptions may advance within these caps at two-month checkpoints; substitutions can change the muscle emphasis. Each workout shows its actual saved dose.</p>}
      <p>These are direct set counts. Pressing also involves triceps and front shoulders; pulling involves biceps; leg presses, split squats, and hinges also train glutes. Supporting work is not counted as a full extra set.</p>
    </section>
    <div className="program-insight-grid"><article className="phase-ladder"><div className="insight-title"><div><strong>Progress at your pace</strong><small>{tracker.trainingCycle?.enabled ? "Two-month checkpoints with performance gates" : "Set counts never rise automatically"}</small></div></div><ol>
      <li><span>Transition</span><strong>Find your dose</strong><small>Start with 43 weekly working sets and about 3 RIR.</small></li>
      <li><span>Repeat</span><strong>Build clean reps</strong><small>Keep technique and recovery consistent.</small></li>
      <li><span>Progress</span><strong>Make one change</strong><small>Add reps or a small load increase; add sets gradually.</small></li>
    </ol></article><article className="rir-guide"><div className="insight-title"><div><strong>Repetitions in reserve</strong><small>Estimate how many more clean reps you could perform</small></div></div>
      <p>Keep about 3 RIR during transition and about 2 as training settles. Most working sets can stay around 1–3 RIR. Stop before technique deteriorates.</p>
      <p>For load increases, reach the top of the rep range on every prescribed set, with reserve, in two comparable sessions. Use the smallest practical increase.</p>
    </article></div>
    <details className="evidence-notes"><summary><span><strong>Why these rules?</strong><small>Guidelines and reviews behind the plan</small></span><b>Sources</b></summary>
      <div className="evidence-grid">{evidence.map(item => <a href={item.url} key={item.label} rel="noreferrer" target="_blank"><strong>{item.label}</strong><span>{item.note}</span><small>Read source</small></a>)}</div>
      <p>This is a practical program for generally healthy adults pursuing strength and muscle. The exact routine and transition rules are a synthesis of the evidence, not a uniquely superior regimen tested as a whole.</p>
    </details>
  </section>;
}
