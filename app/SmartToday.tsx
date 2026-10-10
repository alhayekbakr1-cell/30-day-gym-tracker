"use client";

import { scheduledDate, sessionNumberForKey } from "./tracker-logic";
import { latestIncomplete } from "./equipment-logic";
import { sessionProgress, hydratedWorkoutLog, visibleWorkoutPairs, exercisePrescriptionFor } from "./session-logic";
import { EXERCISE_LIBRARY } from "./workout-data";
import type { TrackerState } from "./tracker-types";
import { smartTodayInsight } from "./training-insights";

function readableDate(date: string | null) {
  if (!date) return "Not scheduled";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day, 12));
}

function signal(value: number | null, suffix: string, fallback: string) {
  return value === null ? fallback : `${value}${suffix}`;
}

export default function SmartToday({
  ready,
  onOpen,
  onStart,
  started,
  tracker,
}: {
  ready: boolean;
  onOpen: (shortMode: boolean) => void;
  onStart: () => void;
  started: boolean;
  tracker: TrackerState;
}) {
  const resumeKey = latestIncomplete(tracker);
  const resumeLog = resumeKey ? hydratedWorkoutLog(tracker, Number(resumeKey)) : null;
  const progress = resumeLog ? sessionProgress(tracker,Number(resumeKey),resumeLog) : null;
  const remainingExercises = resumeLog ? visibleWorkoutPairs(tracker,Number(resumeKey),resumeLog).flatMap(p=>p.exercises).filter(e=>(resumeLog.sets[e.id]??[]).filter(s=>s.done).length < exercisePrescriptionFor(tracker,Number(resumeKey),e.id,resumeLog).sets).length : 0;
  const lastSet = resumeLog ? Object.entries(resumeLog.sets).flatMap(([slot,sets])=>sets.flatMap((set,index)=>set.done?[`${EXERCISE_LIBRARY[resumeLog.substitutions[slot]??slot]?.name??slot}, set ${index+1}`]:[])).at(-1) : null;
  const insight = smartTodayInsight(tracker);

  return (
    <section className={`card smart-today-card mode-${insight.mode}`} id="today" aria-labelledby="today-title">
      <div className="smart-today-heading">
        <div>
          <p className="eyebrow">Smart Today</p>
          <h2 id="today-title">{resumeLog ? "Continue where you left off" : insight.title}</h2>
        </div>
        <span className="today-mode">{insight.modeLabel}</span>
      </div>

      <div className="smart-today-layout">
        <article className="today-primary">
          <div className="today-session-line">
            <span>Session {resumeKey ? sessionNumberForKey(tracker,Number(resumeKey)) : insight.session}</span>
            <strong>Workout {resumeLog?.workoutId ?? insight.workoutId}</strong>
            <span>{readableDate(resumeKey ? scheduledDate(tracker,Number(resumeKey)) : insight.date)}</span>
          </div>
          <h3>{resumeLog ? `Paused / incomplete · Workout ${resumeLog.workoutId}` : insight.focus}</h3>
          {progress && <p>{progress.total-progress.done} sets across {remainingExercises} exercises remain. {progress.next ? `Next: ${progress.next.name}, set ${progress.next.setIndex+1}.` : "Finish your warm-up checks before completing."} {lastSet ? `Last completed in exercise order: ${lastSet}.` : "No completed set yet."} Last edited: {resumeLog?.modifiedAt}.</p>}
          <p>{resumeLog ? "Paused or reopened for editing. Unfinished sets remain unfinished until you log them and explicitly complete the workout." : insight.detail}</p>
          <div className="today-actions">
            {!started ? (
              <button className="primary-button" disabled={!ready} type="button" onClick={onStart}>{ready ? "Start ongoing plan" : "Loading progress…"}</button>
            ) : (
              <>
                <button className="primary-button" disabled={!ready} type="button" onClick={() => onOpen(resumeKey ? false : insight.mode === "short")}>{resumeKey ? "Continue workout" : "Open workout"}</button>
                {insight.mode !== "recover" && (
                  <button className="secondary-button" disabled={!ready} type="button" onClick={() => onOpen(true)}>
                    Use short mode
                  </button>
                )}
              </>
            )}
          </div>
        </article>

        <aside className="today-signals" aria-label="Decision signals">
          <div>
            <span>Sleep</span>
            <strong>{signal(insight.sleep, " h", "Not logged")}</strong>
          </div>
          <div>
            <span>Energy</span>
            <strong>{signal(insight.energy, "/5", "Check in")}</strong>
          </div>
          <div>
            <span>Soreness</span>
            <strong>{signal(insight.soreness, "/5", "Check in")}</strong>
          </div>
          <div className={`progression-watch is-${insight.progression.kind}`}>
            <span>Progression watch</span>
            <strong>{insight.progression.title}</strong>
            <small>{insight.progression.detail}</small>
          </div>
        </aside>
      </div>
    </section>
  );
}
