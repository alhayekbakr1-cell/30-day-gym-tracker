"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackerState } from "./tracker-types";
import {
  buildCoachSummary,
  coachSnapshotText,
  recentWorkoutDetails,
} from "@/lib/coach-summary";

type SiteTool = {
  annotations?: {
    destructiveHint?: boolean;
    openWorldHint?: boolean;
    readOnlyHint?: boolean;
  };
  description: string;
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
  inputSchema: Record<string, unknown>;
  name: string;
};

type ModelContext = {
  registerTool: (tool: SiteTool) => Promise<unknown>;
  unregisterTool?: (name: string) => Promise<unknown>;
};

function formatMetric(value: number | null, suffix = "") {
  return value === null ? "—" : `${value}${suffix}`;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    notation: value >= 100_000 ? "compact" : "standard",
  }).format(value);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export default function CoachPanel({ ready, signedIn, tracker }: { ready: boolean; signedIn: boolean; tracker: TrackerState }) {
  const trackerRef = useRef(tracker);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [siteToolsReady, setSiteToolsReady] = useState(false);
  const summary = useMemo(() => buildCoachSummary(tracker), [tracker]);

  useEffect(() => {
    trackerRef.current = tracker;
  }, [tracker]);

  useEffect(() => {
    if (!ready || !signedIn) return;
    const modelContext = (
      document as Document & { modelContext?: ModelContext }
    ).modelContext;
    if (typeof modelContext?.registerTool !== "function") return;

    const toolNames = [
      "gym_get_training_summary",
      "gym_get_recent_workouts",
      "gym_get_next_workout",
    ];
    let active = true;

    const register = async () => {
      try {
        await modelContext.registerTool({
          name: toolNames[0],
          description:
            "Read the signed-in athlete's ongoing training summary, rolling adherence, recovery signals, progression data, and next recommendation.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false,
          },
          execute: async () => buildCoachSummary(trackerRef.current),
        });
        await modelContext.registerTool({
          name: toolNames[1],
          description:
            "Read the athlete's most recently completed workouts with exercises, sets, reps, load, RIR, and notes.",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "integer",
                minimum: 1,
                maximum: 8,
                description: "Number of recent workouts to return.",
              },
            },
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false,
          },
          execute: async (input) =>
            recentWorkoutDetails(
              trackerRef.current,
              typeof input.limit === "number" ? input.limit : 4,
            ),
        });
        await modelContext.registerTool({
          name: toolNames[2],
          description:
            "Read the athlete's next planned workout, date, training phase, and focus.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false,
          },
          execute: async () => buildCoachSummary(trackerRef.current).nextWorkout,
        });
        if (active) setSiteToolsReady(true);
      } catch {
        if (active) setSiteToolsReady(false);
      }
    };

    void register();
    return () => {
      active = false;
      if (modelContext.unregisterTool) {
        for (const name of toolNames) void modelContext.unregisterTool(name);
      }
    };
  }, [ready, signedIn]);

  const copySnapshot = async () => {
    try {
      await copyText(coachSnapshotText(tracker));
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  const adherenceWidth = Math.min(Math.max(summary.consistencyPct, 0), 100);

  return (
    <section className="card coach-card" id="coach" aria-labelledby="coach-title">
      <div className="coach-header">
        <div>
          <p className="eyebrow">Smart weekly review</p>
          <h2 id="coach-title">Coach snapshot</h2>
          <p>
            A rule-based summary of your saved training, recovery, and
            progression signals. It updates whenever you log a result.
          </p>
        </div>
        <span className={siteToolsReady ? "coach-link is-ready" : "coach-link"}>
          <i aria-hidden="true" />
          {siteToolsReady ? "ChatGPT page tools ready" : "Rule-based insights"}
        </span>
      </div>

      <div className="coach-layout">
        <article className="coach-recommendation">
          <span>Best next move</span>
          <h3>{summary.recommendation.title}</h3>
          <p>{summary.recommendation.detail}</p>
          {summary.nextWorkout && (
            <div className="next-session-strip">
              <span>Next</span>
              <strong>
                Session {summary.nextWorkout.session} · Workout{" "}
                {summary.nextWorkout.workout}
              </strong>
              <small>
                {summary.nextWorkout.phase} · {summary.nextWorkout.focus}
              </small>
            </div>
          )}
        </article>

        <div className="coach-metrics">
          <article>
            <span>Adherence</span>
            <strong>{summary.consistencyPct}%</strong>
            <div className="coach-meter" aria-hidden="true">
              <i style={{ width: `${adherenceWidth}%` }} />
            </div>
            <small>{summary.completedSessions} sessions completed</small>
          </article>
          <article>
            <span>Recent effort</span>
            <strong>{formatMetric(summary.averageRir, " RIR")}</strong>
            <small>{summary.rirCoveragePct}% of sets include RIR</small>
          </article>
          <article>
            <span>Recent sleep</span>
            <strong>{formatMetric(summary.averageSleepHours, " h")}</strong>
            <small>Daily logs or session check-ins</small>
          </article>
          <article>
            <span>Total volume</span>
            <strong>{compactNumber(summary.totalVolume)}</strong>
            <small>{summary.loadUnit} · completed load × reps</small>
          </article>
        </div>
      </div>

      <div className="coach-share">
        <div>
          <strong>Review it with ChatGPT</strong>
          <span>
            In ChatGPT&apos;s built-in browser, ask it to review this tracker.
            On any device, copy the clean snapshot and paste it into a chat.
          </span>
        </div>
        <button className="secondary-button" type="button" onClick={copySnapshot}>
          {copied ? "Snapshot copied" : copyFailed ? "Copy failed — try again" : "Copy for ChatGPT"}
        </button>
      </div>
    </section>
  );
}
