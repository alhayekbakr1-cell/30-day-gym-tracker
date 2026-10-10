"use client";
import { useRef, useState } from "react";
import type { TrackerSync } from "../lib/tracker-sync";
import { localIsoDate } from "./tracker-logic";
export default function GeminiCoach({ email, controller, enabled }: { email: string | null; controller: TrackerSync; enabled: boolean }) {
  const [question, setQuestion] = useState("Tell me what to do next: up to 3 short, practical workout actions. No recap.");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [reviewVersion, setReviewVersion] = useState<number | null>(null);
  const inFlight = useRef(false);
  async function review() {
    if (!email || !enabled || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      if (!await controller.sync() || controller.getSnapshot().pending) throw new Error("Sync your latest changes before requesting a review.");
      const version = controller.getSnapshot().version;
      const response = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json", "x-gym-expected-account": email }, body: JSON.stringify({ question, version, date: localIsoDate() }), cache: "no-store", signal: AbortSignal.timeout(55000) });
      const data = await response.json() as { answer?: string; error?: string; version?: number };
      if (!response.ok || typeof data.answer !== "string") throw new Error(data.error ?? "Review unavailable.");
      setAnswer(data.answer); setReviewVersion(data.version ?? version);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review unavailable."); }
    finally { setBusy(false); inFlight.current = false; }
  }
  if (!email) return <section className="card gemini-coach"><h2>Gemini coach</h2><p>Sign in with ChatGPT online to request a private training review.</p></section>;
  return <section className="card gemini-coach" aria-labelledby="gemini-title"><p className="eyebrow">Personal training review</p><h2 id="gemini-title">Gemini coach</h2>
    <p>Request a review of your synced training. Clicking sends your training summary, logged goals, configured gym inventory/load choices, up to 20 recent cardio logs (without notes), and up to 60 recent exercise exposures to Google Gemini. Names, account email, workout/setup notes, and the API key are not included in that snapshot. Advice does not edit your plan.</p>
    <label htmlFor="coach-question">What do you need help with?</label><textarea id="coach-question" value={question} maxLength={1500} rows={3} onChange={event => setQuestion(event.target.value)} disabled={busy || !enabled}/>
    <button className="primary-button" type="button" disabled={!enabled || !email || busy || !question.trim()} onClick={() => void review()}>{busy ? "Reviewing your logs…" : "Send training snapshot & review"}</button>
    {!enabled && <p>Sign in online and use the editing tab to request a review.</p>}
    {error && <p role="alert">{error}{answer ? " The previous review below has not been refreshed." : ""}</p>}
    {answer && <div className="coach-answer" aria-live="polite"><small>Saved v{reviewVersion} · Refresh after edits. AI guidance.</small><p>{answer}</p></div>}
  </section>;
}
