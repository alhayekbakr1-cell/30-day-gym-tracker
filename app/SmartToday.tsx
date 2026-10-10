"use client";

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
  const insight = smartTodayInsight(tracker);

  return (
    <section className={`card smart-today-card mode-${insight.mode}`} id="today" aria-labelledby="today-title">
      <div className="smart-today-heading">
        <div>
          <p className="eyebrow">Smart Today</p>
          <h2 id="today-title">{insight.title}</h2>
        </div>
        <span className="today-mode">{insight.modeLabel}</span>
      </div>

      <div className="smart-today-layout">
        <article className="today-primary">
          <div className="today-session-line">
            <span>Session {insight.session}</span>
            <strong>Workout {insight.workoutId}</strong>
            <span>{readableDate(insight.date)}</span>
          </div>
          <h3>{insight.focus}</h3>
          <p>{insight.detail}</p>
          <div className="today-actions">
            {!started ? (
              <button className="primary-button" disabled={!ready} type="button" onClick={onStart}>{ready ? "Start ongoing plan" : "Loading progress…"}</button>
            ) : (
              <>
                <button className="primary-button" disabled={!ready} type="button" onClick={() => onOpen(insight.mode === "short")}>Open workout</button>
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
