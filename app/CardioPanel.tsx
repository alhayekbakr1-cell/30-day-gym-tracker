"use client";

import { useRef, useState } from "react";
import type { TrackerState } from "./tracker-types";
import { isoDateOffset, localIsoDate } from "./tracker-logic";
import {
  CARDIO_MODALITIES, TALK_TEST, cardioSessionFor, cardioStatus, cardioSummary,
  cardioWeek, editCardioPlan, editCardioSession, logCardio, logExtraCardio,
  logStrengthCardio, setCardioOpportunity, strengthCardioId,
  type CardioModality, type CardioOpportunity, type CardioSession,
} from "./cardio-logic";

type Props = {
  workoutKey: number; tracker: TrackerState; disabled: boolean; saveLabel: string;
  onChange: (transform: (current: TrackerState) => TrackerState) => void;
};
type EditForm = {
  row: CardioOpportunity | null; recordId: string; sessionId: string | null;
  date: string; modality: CardioModality; minutes: string;
  effort: CardioSession["effort"]; note: string;
};

export default function CardioPanel({ workoutKey, tracker, disabled, saveLabel, onChange }: Props) {
  const today = localIsoDate();
  const cardio = tracker.cardio;
  const liftId = strengthCardioId(tracker, workoutKey);
  const liftSession = cardio?.sessions[liftId] ?? null;
  const [week, setWeek] = useState(cardioWeek(today));
  const [machine, setMachine] = useState<CardioModality | null>(null);
  const [minutes, setMinutes] = useState("20");
  const [form, setForm] = useState<EditForm | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const saving = useRef(false);
  const summary = cardioSummary(cardio, week, today);
  const history = cardio ? Object.values(cardio.sessions).sort((a, b) => b.date.localeCompare(a.date) || Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt)) : [];
  const oldVisits = cardio ? Object.values(cardio.opportunities).filter(row => row.week === week || (row.plannedDate && row.plannedDate >= week && row.plannedDate <= isoDateOffset(week, 6))) : [];
  const available = cardio?.plan.available ?? Object.keys(CARDIO_MODALITIES) as CardioModality[];

  function act(transform: (state: TrackerState) => TrackerState) {
    if (disabled) return;
    try { onChange(transform); setError(false); setMessage("Change queued. Check the save status below."); }
    catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Could not update cardio."); }
  }
  function start(row: CardioOpportunity | null, session: CardioSession | null = null, forWorkout = false) {
    setMessage(""); setError(false);
    setForm({ row, recordId: session?.id ?? (forWorkout ? liftId : row ? `done-${row.id}` : `extra-${crypto.randomUUID()}`), sessionId: session?.id ?? null,
      date: session?.date ?? today, modality: session?.modality ?? row?.modality ?? cardio?.plan.preferred[0] ?? "treadmill",
      minutes: session ? String(session.minutes) : "", effort: session?.effort ?? null, note: session?.note ?? "" });
    setTimeout(() => formRef.current?.focus(), 0);
  }
  function save() {
    if (!form || disabled || saving.current) return;
    saving.current = true;
    try {
      const input = { date: form.date, modality: form.modality, minutes: Number(form.minutes), effort: form.effort, note: form.note };
      const transform = (state: TrackerState) => form.sessionId ? editCardioSession(state, form.sessionId, input) : form.row ? logCardio(state, form.row, input) : form.recordId === liftId ? logStrengthCardio(state, workoutKey, input) : logExtraCardio(state, form.recordId, input);
      transform(tracker); onChange(transform); setForm(null); setError(false); setMessage("Cardio recorded. Check the save status below.");
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Could not record cardio."); }
    finally { saving.current = false; }
  }

  function finishCardio() {
    if (disabled || saving.current || liftSession) return;
    saving.current = true;
    try {
      const input = { date: today, modality: machine ?? cardio?.plan.preferred[0] ?? "treadmill", minutes: Number(minutes), effort: null, note: "" };
      const transform = (state: TrackerState) => logStrengthCardio(state, workoutKey, input);
      transform(tracker); onChange(transform); setError(false); setMessage("Cardio recorded. Check the save status below.");
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Could not record cardio."); }
    finally { saving.current = false; }
  }
  function editDetails() {
    start(null, liftSession, true);
    if (!liftSession) setForm({ row: null, recordId: liftId, sessionId: null, date: today, modality: machine ?? cardio?.plan.preferred[0] ?? "treadmill", minutes, effort: null, note: "" });
  }
  const displayedMachine = liftSession?.modality ?? machine ?? cardio?.plan.preferred[0] ?? "treadmill";

  return <section className={`card cardio-panel${liftSession ? " cardio-recorded" : ""}`} id="cardio-panel" aria-labelledby="cardio-title">
    <div className="cardio-inline-heading"><div><h2 id="cardio-title">Cardio</h2><p>20 minutes after lifting</p></div>{liftSession && <span className="cardio-complete-label">✓ Logged</span>}</div>
    <div className="cardio-workout-row">
      <label>Machine<select aria-label="Cardio machine for this workout" value={displayedMachine} disabled={disabled || !!liftSession} onChange={event => { setMachine(event.target.value as CardioModality); setMessage(""); }}>{Object.entries(CARDIO_MODALITIES).filter(([id]) => available.includes(id as CardioModality) || id === displayedMachine).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Minutes done<input aria-label="Cardio minutes completed" type="number" inputMode="decimal" min={0.1} max={600} step="any" value={liftSession ? String(liftSession.minutes) : minutes} disabled={disabled || !!liftSession} onChange={event => { setMinutes(event.target.value); setMessage(""); }}/></label>
      <button className={liftSession ? "secondary-button cardio-done-button" : "primary-button cardio-done-button"} type="button" disabled={disabled} onClick={liftSession ? editDetails : finishCardio}>{liftSession ? "Edit" : "Done"}</button>
    </div>
    <div className="cardio-inline-meta"><span>{liftSession ? liftSession.date : "Today"}</span>{!liftSession && <button className="cardio-text-button" type="button" disabled={disabled} aria-expanded={!!form} onClick={editDetails}>Date, effort or note</button>}</div>

    {form && <div className="cardio-log-form" id="cardio-log-form" ref={formRef} tabIndex={-1} role="region" aria-labelledby="cardio-form-title">
      <div className="cardio-form-heading"><h3 id="cardio-form-title">{form.sessionId ? "Edit cardio" : "Cardio details"}</h3><button className="cardio-text-button" type="button" onClick={() => { setForm(null); setMessage(""); }}>Cancel</button></div>
      <fieldset className="cardio-machine-picker"><legend>Machine</legend><div>{Object.entries(CARDIO_MODALITIES).filter(([id]) => form.sessionId || available.includes(id as CardioModality) || id === form.modality).map(([id, label]) => <button key={id} type="button" aria-pressed={form.modality === id} disabled={disabled} onClick={() => setForm({ ...form, modality: id as CardioModality })}>{label}</button>)}</div></fieldset>
      <div className="cardio-record-row"><label htmlFor="cardio-minutes">Minutes completed<span className="cardio-minutes-input"><input id="cardio-minutes" type="number" inputMode="decimal" min={0.1} max={600} step="any" placeholder="20" value={form.minutes} disabled={disabled} onChange={e => setForm({ ...form, minutes: e.target.value })}/><span>min</span></span></label><button className="cardio-quick-fill" type="button" disabled={disabled} onClick={() => setForm({ ...form, minutes: "20" })}>I did 20 min</button><button className="primary-button" type="button" disabled={disabled} onClick={save}>{form.sessionId ? "Save changes" : "Save cardio"}</button></div>
      <p className="cardio-form-hint">Log what you actually did. Shorter sessions count too.</p>
      <details className="cardio-log-extras"><summary>Date, effort & note <span>{form.date === today ? "Today" : form.date}</span></summary><div className="cardio-extra-fields"><label>Date<input type="date" value={form.date} disabled={disabled} onChange={e => setForm({ ...form, date: e.target.value })}/></label><label>Effort<select value={form.effort ?? ""} disabled={disabled} onChange={e => setForm({ ...form, effort: e.target.value ? e.target.value as CardioSession["effort"] : null })}><option value="">Not recorded</option><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="hard">Hard</option></select></label><label className="cardio-note-field">Note<textarea rows={2} maxLength={500} value={form.note} disabled={disabled} onChange={e => setForm({ ...form, note: e.target.value })}/></label></div></details>
    </div>}
    {message && <p className={`cardio-feedback${error ? " cardio-error" : ""}`} role={error ? "alert" : "status"}>{message}</p>}
    <div className="cardio-bottom"><p className="cardio-save" role="status">{saveLabel}</p><details className="cardio-more"><summary>History & options</summary><div className="cardio-more-body">
      <div className="cardio-week"><button aria-label="Previous cardio week" type="button" onClick={() => setWeek(isoDateOffset(week, -7))}>←</button><span>{summary.week} – {summary.end}</span><button aria-label="Next cardio week" type="button" onClick={() => setWeek(isoDateOffset(week, 7))}>→</button><button className="cardio-text-button" type="button" onClick={() => setWeek(cardioWeek(today))}>This week</button></div>
      <div className="cardio-week-totals"><div><strong>{summary.minutes}<small> min</small></strong><span>Logged this week</span></div><div><strong>{summary.completed}</strong><span>Cardio sessions</span></div><p>Your target: 20 min with each strength workout.<br/>Four workouts = 80 min.</p></div>
      <details className="cardio-history-list"><summary>Recent cardio <span>{history.length} logs</span></summary>{!history.length ? <p>No cardio logged yet.</p> : history.slice(0, 20).map(session => <article key={session.id} className="cardio-history"><div><strong>{CARDIO_MODALITIES[session.modality]}</strong><span>{session.date} · {session.minutes} min{session.effort ? ` · ${session.effort}` : ""}</span>{session.note && <p>{session.note}</p>}</div><button className="cardio-text-button" type="button" disabled={disabled} onClick={() => start(session.opportunityId ? cardio!.opportunities[session.opportunityId] ?? null : null, session)}>Edit</button></article>)}{history.length > 20 && <p>Latest 20 shown. Your backup includes every log.</p>}</details>
      {oldVisits.length > 0 && <details><summary>Saved flexible visits</summary><div className="cardio-opportunities">{oldVisits.map(row => { const session = cardioSessionFor(cardio!, row.id); return <article key={row.id} className="cardio-opportunity"><strong>{CARDIO_MODALITIES[row.modality]} · {row.targetMinutes} min</strong><p>{cardioStatus(cardio!, row, today)} · {row.plannedDate ?? "Flexible date"}</p>{session ? <button type="button" disabled={disabled} onClick={() => start(row, session)}>Edit log</button> : <><button type="button" disabled={disabled || !cardio!.plan.enabled} onClick={() => start(row)}>Log visit</button><label>Planned date<input type="date" min={cardio!.plan.startsOn} value={row.plannedDate ?? ""} disabled={disabled || !cardio!.plan.enabled} onChange={e => act(state => setCardioOpportunity(state, row, { plannedDate: e.target.value || null }))}/></label><button type="button" disabled={disabled || !cardio!.plan.enabled} onClick={() => act(state => setCardioOpportunity(state, row, { status: row.status === "skipped" ? "planned" : "skipped" }))}>{row.status === "skipped" ? "Return to plan" : "Skip visit"}</button></>}</article>; })}</div></details>}
      {cardio && <details className="cardio-settings"><summary>Equipment & plan settings</summary><label>Preferred machine<select value={cardio.plan.preferred[0]} disabled={disabled} onChange={e => act(state => editCardioPlan(state, { preferred: [e.target.value as CardioModality] }))}>{Object.entries(CARDIO_MODALITIES).filter(([id]) => available.includes(id as CardioModality)).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><fieldset><legend>Available equipment</legend>{Object.entries(CARDIO_MODALITIES).map(([id, label]) => <label className="equipment-choice" key={id}><input type="checkbox" disabled={disabled} checked={available.includes(id as CardioModality)} onChange={e => { const next = e.target.checked ? [...available, id as CardioModality] : available.filter(key => key !== id); act(state => editCardioPlan(state, { available: next, preferred: cardio.plan.preferred.some(key => next.includes(key)) ? cardio.plan.preferred.filter(key => next.includes(key)) : next.slice(0, 1) })); }}/>{label}</label>)}</fieldset><button className="secondary-button" type="button" disabled={disabled} onClick={() => act(state => editCardioPlan(state, { enabled: !cardio.plan.enabled }))}>{cardio.plan.enabled ? "Pause plan" : "Resume plan"}</button><p>Pausing preserves every log. Logging from a workout resumes your plan.</p></details>}
      {cardio && <button className="cardio-text-button" type="button" disabled={disabled || !cardio.plan.enabled} onClick={() => start(null)}>+ Log other cardio</button>}
      <details className="cardio-guidance"><summary>Effort & general guidance</summary><p>{TALK_TEST}</p><p>80 min across four workouts is your personal starting target, below the general adult aerobic guideline. CDC recommends 150 moderate minutes or 75 vigorous minutes weekly, plus strengthening on at least two days. Only app-recorded cardio is counted. No calorie or weight-loss estimates.</p><a href="https://www.cdc.gov/physical-activity-basics/guidelines/adults.html" target="_blank" rel="noreferrer">CDC activity guidance ↗</a></details>
    </div></details></div>
  </section>;
}
