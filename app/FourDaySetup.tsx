"use client";

import { useState } from "react";
import type { TrackerState } from "./tracker-types";
import { earliestFourDayStart, isoDateOffset, suggestedFourDayStart } from "./tracker-logic";
import { FOUR_DAY_EXERCISES, FOUR_DAY_NAMES, FOUR_DAY_OFFSETS, FOUR_DAY_ROTATION, type FourDayWorkoutId } from "./four-day-data";

export default function FourDaySetup({ tracker, disabled, onActivate, onSets, onEffort }: {
  tracker: TrackerState;
  disabled: boolean;
  onActivate: (date: string) => Promise<void>;
  onSets: (template: FourDayWorkoutId, slot: string, count: number) => void;
  onEffort: (rir: 2 | 3) => void;
}) {
  const [date, setDate] = useState(() => suggestedFourDayStart(tracker));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const plan = tracker.fourDayPlan;
  const total = plan ? Object.values(plan.sets).flatMap(sets => Object.values(sets)).reduce((sum, count) => sum + count, 0) : 43;
  const start = plan?.startsOn ?? date;
  return <section className="card four-day-setup" aria-labelledby="four-day-title">
    <div className="section-heading">
      <div><p className="eyebrow">Your next training chapter</p><h2 id="four-day-title">{plan ? "Your four-day plan" : "Move to four days per week"}</h2>
        <p>{plan ? `${total} planned working sets per full cycle. Started sessions keep their saved prescription.` : "Upper A, Lower A, Upper B, Lower B. Keep your history and start with a manageable transition."}</p></div>
      <span className="program-version">{plan ? "4 sessions / week" : "History stays with you"}</span>
    </div>
    <div className="four-day-week" aria-label="Four-day rotation">
      {FOUR_DAY_ROTATION.map((id, index) => <div key={id}><span>{plan ? `Session ${index + 1}` : new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(isoDateOffset(start || suggestedFourDayStart(tracker), FOUR_DAY_OFFSETS[index]) + "T12:00:00Z"))}</span><strong>{FOUR_DAY_NAMES[id]}</strong></div>)}
    </div>
    {!plan ? <>
      <p>Begin with 43 working sets per week and about 3 reps in reserve. Calves start at one set per visit. Add volume gradually as your performance and recovery allow.</p>
      <div className="four-day-actions"><label>First upper-body session<input type="date" min={earliestFourDayStart(tracker)} value={date} disabled={disabled || busy} onChange={event => setDate(event.target.value)} /></label>
        <button className="primary-button" disabled={disabled || busy || !date} type="button" onClick={async () => {
          setBusy(true); setMessage("");
          try { await onActivate(date); } catch (error) { setMessage(error instanceof Error ? error.message : "The transition could not be saved. Your records are unchanged."); }
          finally { setBusy(false); }
        }}>{busy ? "Saving transition…" : "Save backup & switch to four days"}</button></div>
      <small>Allow at least two days after your latest saved session. Your completed and unfinished workouts remain available.</small>
    </> : <details className="four-day-volume">
      <summary>Adjust future volume · {total} of 58 target sets</summary>
      <p>Keep this starting dose for the first one or two weeks. Add one weekly set at a time when technique and performance hold up. These are practical defaults; you can stay below the target while progressing.</p>
      <label className="four-day-effort">Working-set effort<select disabled={disabled} value={plan.rir} onChange={event => onEffort(event.target.value === "2" ? 2 : 3)}><option value="3">About 3 reps in reserve · transition</option><option value="2">About 2 reps in reserve · established training</option></select></label>
      <div className="four-day-volume-grid">{FOUR_DAY_ROTATION.map(id => <fieldset key={id}><legend>{FOUR_DAY_NAMES[id]}</legend>{FOUR_DAY_EXERCISES[id].map(item => <div className="volume-adjuster" key={item.id}>
        <span>{item.name}<small>Target: {item.targetSets} sets</small></span><div>
          <button type="button" aria-label={`One fewer set of ${item.name} in ${FOUR_DAY_NAMES[id]}`} disabled={disabled || plan.sets[id][item.id] <= 1} onClick={() => onSets(id, item.id, plan.sets[id][item.id] - 1)}>−</button>
          <output aria-label={`${item.name} sets in ${FOUR_DAY_NAMES[id]}`}>{plan.sets[id][item.id]}</output>
          <button type="button" aria-label={`One more set of ${item.name} in ${FOUR_DAY_NAMES[id]}`} disabled={disabled || plan.sets[id][item.id] >= item.targetSets} onClick={() => onSets(id, item.id, plan.sets[id][item.id] + 1)}>+</button>
        </div></div>)}</fieldset>)}</div>
    </details>}
    {message && <p role="status">{message}</p>}
  </section>;
}
