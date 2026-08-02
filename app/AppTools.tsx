"use client";

import { useEffect, useMemo, useState } from "react";
import type { TrackerState } from "./tracker-types";
import { scheduledDate } from "./tracker-logic";
import { SCHEDULED_DAYS } from "./workout-data";

type InstallPromptEvent = Event & {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
};

type AppToolsProps = {
  lastSyncedAt: number | null;
  onReset: () => void;
  onSyncCheck: () => Promise<boolean>;
  started: boolean;
  syncStatus: "error" | "loading" | "saved" | "syncing";
  syncVersion: number;
  tracker: TrackerState;
  user: { email: string; name: string } | null;
};

function download(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export default function AppTools({
  lastSyncedAt,
  onReset,
  onSyncCheck,
  started,
  syncStatus,
  syncVersion,
  tracker,
  user,
}: AppToolsProps) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [checkingSync, setCheckingSync] = useState(false);
  const [syncCheckResult, setSyncCheckResult] = useState<"failed" | "passed" | null>(null);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const updateStandalone = () => setIsStandalone(standaloneQuery.matches);
    const initialCheck = window.setTimeout(updateStandalone, 0);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };
    standaloneQuery.addEventListener("change", updateStandalone);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.clearTimeout(initialCheck);
      standaloneQuery.removeEventListener("change", updateStandalone);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const syncLabel =
    syncStatus === "saved"
      ? "Connected"
      : syncStatus === "syncing"
        ? "Saving now"
        : syncStatus === "loading"
          ? "Checking"
          : "Needs attention";

  const exportRows = useMemo(() => {
    const rows: unknown[][] = [[
      "record_type",
      "date",
      "session",
      "exercise_slot",
      "set",
      "load",
      "reps",
      "rir",
      "completed",
      "protein_g",
      "steps",
      "weight",
      "waist",
      "sleep_hours",
    ]];
    for (const [index, day] of SCHEDULED_DAYS.entries()) {
      const log = tracker.workouts[String(day)];
      if (!log) continue;
      for (const [exerciseId, sets] of Object.entries(log.sets)) {
        sets.forEach((set, setIndex) => {
          if (!set.done && !set.load && !set.reps) return;
          rows.push([
            "workout",
            scheduledDate(tracker, day),
            index + 1,
            log.substitutions?.[exerciseId] ?? exerciseId,
            setIndex + 1,
            set.load,
            set.reps,
            set.rir,
            set.done,
            "",
            "",
            "",
            "",
            log.readiness?.sleepHours ?? "",
          ]);
        });
      }
    }
    for (const [date, metric] of Object.entries(tracker.dailyMetrics)) {
      rows.push([
        "daily",
        date,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        metric.protein,
        metric.steps,
        `${metric.weight} ${tracker.profile.weightUnit}`.trim(),
        metric.waist,
        metric.sleepHours,
      ]);
    }
    return rows.map((row) => row.map(csvCell).join(",")).join("\n");
  }, [tracker]);

  const install = async () => {
    if (!installPrompt) {
      setShowInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  const checkSync = async () => {
    setCheckingSync(true);
    setSyncCheckResult(null);
    setSyncCheckResult((await onSyncCheck()) ? "passed" : "failed");
    setCheckingSync(false);
  };

  return (
    <section className="utility-grid" id="app-tools" aria-label="App and data tools">
      <article className="card utility-card install-card">
        <span className="utility-icon" aria-hidden="true">↧</span>
        <div>
          <p className="eyebrow">Quick access</p>
          <h2>{isStandalone ? "Installed on this device" : "Install the app"}</h2>
          <p>{isStandalone ? "Open it from your Home Screen like any other app." : "Add the tracker to your phone for one-tap gym access."}</p>
          {!isStandalone && (
            <button className="secondary-button" type="button" onClick={install}>
              Install on this device
            </button>
          )}
          {showInstallHelp && !isStandalone && (
            <div className="install-help" role="status">
              <strong>On iPhone:</strong> tap Share, choose <b>Add to Home Screen</b>, then tap Add. On Android or desktop, use your browser&apos;s Install option.
            </div>
          )}
        </div>
      </article>

      <article className="card utility-card sync-card">
        <span className="utility-icon" aria-hidden="true">↻</span>
        <div>
          <p className="eyebrow">Across devices</p>
          <h2>Sync diagnostics</h2>
          <dl className="sync-details">
            <div><dt>Status</dt><dd className={syncStatus === "error" ? "sync-bad" : "sync-good"}>{syncLabel}</dd></div>
            <div><dt>Account</dt><dd>{user?.email ?? "Not signed in"}</dd></div>
            <div><dt>Server version</dt><dd>{syncVersion || "—"}</dd></div>
            <div><dt>Last confirmed</dt><dd>{lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : "Not yet"}</dd></div>
          </dl>
          <button className="secondary-button" disabled={!user || checkingSync} type="button" onClick={checkSync}>
            {checkingSync ? "Checking…" : "Run sync check"}
          </button>
          {syncCheckResult && (
            <span className={`sync-check-result ${syncCheckResult}`} role="status">
              {syncCheckResult === "passed" ? "Server connection verified." : "Sync check failed—retry when online."}
            </span>
          )}
        </div>
      </article>

      <article className="card utility-card data-card">
        <span className="utility-icon" aria-hidden="true">⌁</span>
        <div>
          <p className="eyebrow">Your records</p>
          <h2>Export or restart</h2>
          <p>Keep a portable copy of every workout and daily health entry.</p>
          <div className="data-buttons">
            <button className="secondary-button" disabled={!started} type="button" onClick={() => download("gym-tracker-data.json", JSON.stringify(tracker, null, 2), "application/json")}>Export JSON</button>
            <button className="secondary-button" disabled={!started} type="button" onClick={() => download("gym-tracker-data.csv", exportRows, "text/csv")}>Export CSV</button>
          </div>
          {!resetArmed ? (
            <button className="text-danger" disabled={!started} type="button" onClick={() => setResetArmed(true)}>Restart challenge</button>
          ) : (
            <div className="reset-confirm" role="alert">
              <p>This clears workouts and scheduling. Nutrition history and goals stay saved.</p>
              <div>
                <button type="button" onClick={() => setResetArmed(false)}>Cancel</button>
                <button type="button" onClick={() => { onReset(); setResetArmed(false); }}>Yes, restart</button>
              </div>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
