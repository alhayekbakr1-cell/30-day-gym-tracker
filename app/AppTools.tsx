"use client";
import { isSessionKey, sessionNumberForKey } from "./tracker-logic";

import { useEffect, useMemo, useState } from "react";
import { cardioCsvRows, csvCell, downloadFile as download, downloadBackup, parseBackup, MAX_BACKUP_BYTES } from "./backup-logic";
import type { SyncStatus } from "../lib/tracker-sync";
import type { TrackerState } from "./tracker-types";
import { scheduledDate } from "./tracker-logic";

type InstallPromptEvent = Event & {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
};

type AppToolsProps = {
  blockMessage: string;
  lastSyncedAt: number | null;
  onReset: () => Promise<boolean>;
  onRestore: (state: TrackerState) => Promise<boolean>;
  localOnly: boolean;
  canRestore: boolean;
  onSyncCheck: () => Promise<boolean>;
  restarting: boolean;
  started: boolean;
  syncStatus: SyncStatus;
  syncVersion: number;
  tracker: TrackerState;
  user: { email: string; name: string } | null;
};

export default function AppTools({
  blockMessage,
  lastSyncedAt,
  onReset,
  onRestore,
  localOnly,
  canRestore,
  onSyncCheck,
  restarting,
  started,
  syncStatus,
  syncVersion,
  tracker,
  user,
}: AppToolsProps) {
  const [importState, setImportState] = useState<TrackerState | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [backupAcknowledged, setBackupAcknowledged] = useState(false);
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
    localOnly ? "This device only" : syncStatus === "queued" ? "Waiting to sync" : syncStatus === "saved"
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
      "load_unit",
      "reps",
      "rir",
      "completed",
      "protein_g",
      "steps",
      "weight",
      "waist",
      "sleep_hours",
      "cardio_modality", "duration_minutes", "perceived_effort", "cardio_note", "planned_visit_id",
    ]];
    const workoutDays = Object.keys(tracker.workouts).map(Number).filter(day => isSessionKey(tracker, day)).sort((a, b) => a - b);
    for (const day of workoutDays) {
      const log = tracker.workouts[String(day)];
      if (!log) continue;
      for (const [exerciseId, sets] of Object.entries(log.sets)) {
        sets.forEach((set, setIndex) => {
          if (!set.done && !set.load && !set.reps) return;
          rows.push([
            "workout",
            scheduledDate(tracker, day),
            sessionNumberForKey(tracker, day),
            log.substitutions?.[exerciseId] ?? exerciseId,
            setIndex + 1,
            set.load,
            log.loadUnit,
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
        "",
        metric.protein,
        metric.steps,
        `${metric.weight} ${metric.weightUnit ?? tracker.profile.weightUnit}`.trim(),
        metric.waist,
        metric.sleepHours,
      ]);
    }
    rows.push(...cardioCsvRows(tracker));
    return rows.map((row) => [...row,...Array(Math.max(0,20-row.length)).fill("")].map(csvCell).join(",")).join("\n");
  }, [tracker]);

  const readBackup = async (file?: File) => {
    setImportState(null);
    setBackupAcknowledged(false);
    setImportMessage("");
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("Choose a JSON backup smaller than 2 MB.");
      setImportState(parseBackup(await file.text()));
    } catch (error) { setImportMessage(error instanceof Error ? error.message : "Backup could not be read."); }
  };
  const restore = async () => {
    if (!importState || !backupAcknowledged) return;
    setImporting(true);
    try {
      if (await onRestore(importState)) { setImportState(null); setImportMessage("Backup restored. Review the save status above."); }
      else setImportMessage("Restore paused. Resolve the save or connection issue, then try again.");
    } catch { setImportMessage("Restore could not be completed. Your current records are preserved."); }
    finally { setImporting(false); }
  };

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
          <button className="secondary-button" disabled={!user || checkingSync || localOnly} type="button" onClick={checkSync}>
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
          <h2>Back up your training</h2>
          <p>Keep a portable copy of every workout and daily health entry.</p>
          <div className="data-buttons">
            <button className="secondary-button" disabled={!started} type="button" onClick={() => downloadBackup(tracker)}>Export JSON</button>
            <button className="secondary-button" disabled={!started} type="button" onClick={() => download("gym-tracker-data.csv", exportRows, "text/csv")}>Export CSV</button>
          </div>
          <div className="restore-backup">
            <label className="backup-file">Restore a JSON backup<input accept=".json,application/json" aria-label="Choose JSON backup" disabled={!canRestore || importing || restarting} type="file" onChange={event => { void readBackup(event.target.files?.[0]); event.target.value = ""; }} /></label>
            {importState && <div className="reset-confirm" role="region" aria-label="Review backup before restoring">
              <strong>Review this backup</strong>
              <p>{Object.keys(importState.workouts).length} logged sessions · {Object.keys(importState.dailyMetrics).length} daily entries · Plan started {importState.startDate ?? "not yet"}.</p>
              <p>Cardio: {importState.cardio ? `${importState.cardio.plan.enabled ? "Active" : "Paused"} plan · ${Object.keys(importState.cardio.opportunities).length} planned visits · ${Object.keys(importState.cardio.sessions).length} logged sessions` : "Not enabled"}.</p>
              <p>Equipment profile: {Object.values(importState.equipment.available).filter(Boolean).length} available items · {Object.keys(importState.equipment.exerciseNotes).length} exercise reminders · {Object.keys(importState.equipment.notes).length} equipment reminders · future Upper B flat-bench preference {importState.equipment.futureUpperBFlat ? "enabled" : "disabled"}.</p>
              <p>Restoring replaces the current plan and syncs it to your account. Export your current records and confirm the download is saved before continuing.</p>
              <button type="button" className="secondary-button" onClick={() => downloadBackup(tracker, "gym-tracker-before-restore")}>Save current backup</button>
              <label className="restore-ack"><input type="checkbox" checked={backupAcknowledged} onChange={event => setBackupAcknowledged(event.target.checked)} /> I saved a copy of my current records.</label>
              <div><button type="button" disabled={importing} onClick={() => setImportState(null)}>Cancel</button><button type="button" disabled={!backupAcknowledged || importing || restarting || !canRestore} onClick={() => void restore()}>{importing ? "Restoring…" : "Restore this backup"}</button></div>
            </div>}
            {importMessage && <p role="status">{importMessage}</p>}
          </div>
          {!resetArmed ? (
            <button className="text-danger" disabled={!started || restarting || localOnly || !canRestore} type="button" onClick={() => setResetArmed(true)}>Archive and restart plan</button>
          ) : (
            <div className="reset-confirm" role="alert">
              <p>Your current training history will be archived first. Daily health history and goals carry into the new ongoing plan.</p>
              <div>
                <button type="button" onClick={() => setResetArmed(false)}>Cancel</button>
                <button disabled={restarting} type="button" onClick={async () => { if (await onReset()) setResetArmed(false); }}>{restarting ? "Archiving…" : "Archive & start"}</button>
              </div>
            </div>
          )}
          {blockMessage && <span className="block-message" role="status">{blockMessage}</span>}
        </div>
      </article>
    </section>
  );
}
