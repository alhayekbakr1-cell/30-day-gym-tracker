"use client";
import { useMemo, useState } from "react";
import { EXERCISE_LIBRARY, canonicalExerciseId } from "./workout-data";
import type { TrackerState } from "./tracker-types";
import { exerciseHistory, filterExerciseHistory, bestCompletedLoad } from "./exercise-history";
import { isoDateOffset, localIsoDate, formatLoad } from "./tracker-logic";

export default function ExerciseHistory({ tracker, initialExercise = "" }: { tracker: TrackerState; initialExercise?: string }) {
  const rows = useMemo(() => exerciseHistory(tracker), [tracker]);
  const requested = canonicalExerciseId(initialExercise);
  const choices = new Map(rows.map(row => [row.exerciseId, row.name]));
  if (requested && EXERCISE_LIBRARY[requested]) choices.set(requested,EXERCISE_LIBRARY[requested].name);
  const options = [...choices.entries()].sort((a,b) => a[1].localeCompare(b[1]));
  const [selected, setSelected] = useState(canonicalExerciseId(initialExercise));
  const [range, setRange] = useState("all");
  const id = options.some(([id]) => id === selected) ? selected : options[0]?.[0] ?? "";
  const history = filterExerciseHistory(rows, id, range === "all" ? null : isoDateOffset(localIsoDate(), -Number(range) + 1));
  return <section className="card exercise-history" aria-labelledby="exercise-history-title">
    <div className="section-heading"><div><p className="eyebrow">Your logged sets</p><h2 id="exercise-history-title">Exercise history</h2></div></div>
    <div className="history-filters">
      <label>Exercise<select value={id} onChange={event => setSelected(event.target.value)} disabled={!options.length}>
        {!options.length && <option value="">No logged exercises yet</option>}
        {options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </select></label>
      <label>Date range<select value={range} onChange={event => setRange(event.target.value)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All history</option></select></label>
    </div>
    <p className="history-help">Completed and partial sessions are included. Variants stay separate. Dates and set values below are the original records; comparisons convert loads only. No estimated strength score.</p>
    {!history.length && <p role="status">No logged sets for this exercise in this date range.</p>}
    <div className="exposure-list">{history.map(row => {
      const best = bestCompletedLoad(row, tracker.profile.loadUnit);
      return <article key={row.id} className="exposure"><div className="exposure-heading"><strong><time dateTime={row.date}>{row.date}</time> · {row.name}</strong><span>{row.completed ? "Workout complete" : "Partial workout"}</span></div>
        <p>Programmed: {row.plannedName} · Performed: {row.name}{row.substituted ? " (substitution)" : ""}</p>
        <p>Workout {row.workoutId} · session key {row.sessionKey}<br/><small>Session ID: {row.sessionId}</small></p>
        <p>Programmed prescription: {row.programmedPrescription.sets} sets · {row.programmedPrescription.reps} · {row.programmedPrescription.rir} RIR · {row.programmedPrescription.restSeconds}s rest</p>
        <p>Performed target: {row.prescription.sets} sets · {row.prescription.reps} · {row.prescription.rir} RIR · {row.prescription.restSeconds}s rest</p>
        <ol className="history-sets">{row.sets.map((set, index) => <li key={index}><strong>Set {index + 1}</strong><span>{set.load || "No load recorded"}{set.load ? ` ${row.unit}` : ""} · {set.reps || "—"} {row.countUnit} · {set.rir || "—"} RIR · {set.done ? "Done" : "Not done"}</span></li>)}</ol>
        {best !== null && <p>Highest logged load in a completed set: {formatLoad(best)} {tracker.profile.loadUnit} (converted for reference; technique and prescription may differ).</p>}
      </article>;
    })}</div>
  </section>;
}
