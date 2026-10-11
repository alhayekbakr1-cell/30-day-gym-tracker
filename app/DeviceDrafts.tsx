"use client";
import { useState } from "react";
import { readDeviceDrafts } from "../lib/tab-recovery";
import { downloadBackup } from "./backup-logic";
export default function DeviceDrafts({ base }: { base: string }) {
  const [drafts, setDrafts] = useState<ReturnType<typeof readDeviceDrafts>>([]);
  const [message, setMessage] = useState("");
  return <details className="card device-drafts"><summary>Recover drafts from other tabs</summary>
    <p>Unsynced copies are never automatically replaced or deleted. Export the draft you need, then use the validated Backup tools restore flow. Check dates and sets before restoring.</p>
    <button type="button" className="secondary-button" onClick={() => { try { const values = readDeviceDrafts(localStorage, base); setDrafts(values); setMessage(values.length ? `${values.length} unsynced device drafts found.` : "No unsynced device drafts found."); } catch { setMessage("Browser storage could not be read. Existing drafts have not been changed."); } }}>Find unsynced drafts</button>
    <p role="status">{message}</p>{drafts.map((draft, i) => <div key={draft.key}><span>Draft {i + 1} · {Object.keys(draft.state.workouts).length} workout records · plan starts {draft.state.startDate ?? "not started"}</span><button type="button" onClick={() => { try { const current = readDeviceDrafts(localStorage, base).find(item => item.key === draft.key); if (current) downloadBackup(current.state, "gym-tracker-recovered-draft"); else setMessage("This draft has since synchronized. Refresh the list."); } catch { setMessage("Could not read this draft. It remains stored."); } }}>Export this draft</button></div>)}
  </details>;
}
