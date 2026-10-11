"use client";

import { useState } from "react";
import type { TrackerState } from "./tracker-types";
import { cycleBlock, cycleDate } from "./training-cycle";
import { isIsoDate, localIsoDate } from "./tracker-logic";

export default function TrainingCycleSettings({ tracker, disabled, onEnable, onPause }: {
  tracker: TrackerState; disabled: boolean; onEnable: (date: string) => Promise<void>; onPause: () => void;
}) {
  const [date, setDate] = useState(localIsoDate), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const cycle = tracker.trainingCycle, today = localIsoDate();
  const block = cycle ? Math.max(0, cycleBlock(cycle.startsOn, today)) : 0;
  const next = cycleDate(cycle?.startsOn ?? (isIsoDate(date) ? date : today), (block + 1) * 2);
  return <section className="card training-cycle-settings" aria-labelledby="training-cycle-title">
    <div className="section-heading"><div><h2 id="training-cycle-title">Variety & progression</h2><p>Different arm exercises across sessions. A progression checkpoint every two calendar months.</p></div><span className="program-version">{cycle?.enabled ? today < cycle.startsOn ? `Starts ${cycle.startsOn}` : `Block ${block + 1}` : "Future workouts"}</span></div>
    <p>Keep your main lifts consistent. Rotate dumbbell curls, triceps extensions, shoulder accessories, calves and core using your saved equipment. New movements start with their own history and a manageable load.</p>
    <details><summary>How the two-month progression works</summary><ul>
      <li>Start with about 3 clean reps in reserve. At a checkpoint, qualifying movements can move to about 2.</li>
      <li>From the second checkpoint, add at most one working set to one movement per workout template in each block, within the plan’s set limits.</li>
      <li>Progress requires two comparable completed exposures reaching the top of the range with reserve within the previous 28 days. Missing RIR, incomplete sessions or logged recovery concerns keep the dose steady.</li>
      <li>Build reps and use the existing small-load progression rule throughout. The calendar never adds weight, forces failure, or increases cardio beyond your 20-minute target.</li>
    </ul><p>These two-month blocks are your preference, not a medical requirement. Once set and effort limits are reached, continue through reps and manageable load increases.</p></details>
    {cycle?.enabled ? <div className="training-cycle-actions"><p>Next checkpoint: <strong>{next}</strong>. Started workouts keep their saved movements and targets.</p><button className="secondary-button" type="button" disabled={disabled} onClick={onPause}>Pause future rotation</button></div> : <div className="training-cycle-actions">
      {!cycle && <label>First block starts<input type="date" min={today} value={date} disabled={disabled || busy} onChange={event => setDate(event.target.value)}/></label>}
      <button className="primary-button" type="button" disabled={disabled || busy || !date} onClick={async () => {
        setBusy(true); setMessage("");
        try { await onEnable(date); setMessage("Saved for future workouts. Your existing sessions are unchanged."); }
        catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not save the future plan."); }
        finally { setBusy(false); }
      }}>{busy ? "Saving…" : cycle ? "Resume future rotation" : "Save backup & add variety"}</button>
    </div>}
    <p className="training-cycle-footnote">Your schedule, session IDs, completed and unfinished workouts stay intact. Details live here so the workout screen stays focused on logging.</p>
    {message && <p role="status">{message}</p>}
  </section>;
}
