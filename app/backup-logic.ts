import type { TrackerState } from "./tracker-types";
import { normalizeTrackerState } from "./tracker-logic";
import { sanitizeTrackerState } from "../lib/tracker-validation";

export const MAX_BACKUP_BYTES = 2_000_000;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
function sameTextFields(raw: Record<string, unknown>, clean: object, fields: string[]) {
  const sanitized = clean as Record<string, unknown>;
  return fields.every(key => typeof raw[key] === "string" && raw[key] === sanitized[key]);
}

export function parseBackup(text: string) {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error("Choose a JSON backup smaller than 2 MB.");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("This file is not valid JSON. Choose an exported Gym Tracker backup."); }
  if (record(parsed) && parsed.format === "gym-tracker-backup") {
    if (parsed.version !== 1) throw new Error("This backup format needs a newer version of Gym Tracker.");
    parsed = parsed.state;
  }
  if (!record(parsed) || typeof parsed.schemaVersion !== "number" || ![5, 6, 7, 8, 9].includes(parsed.schemaVersion) || !record(parsed.workouts) || !record(parsed.dailyMetrics)
    || !record(parsed.profile) || !record(parsed.schedule)) throw new Error("This is not a supported Gym Tracker backup (schema 5–9).");
  const state = sanitizeTrackerState(parsed);
  if (!state) throw new Error("The backup contains an invalid plan date or unsupported data.");
  // Reject records that would be silently dropped or shortened during server validation.
  for (const field of ["workouts", "dailyMetrics", "schedule"] as const) {
    if (Object.keys(parsed[field] as object).length !== Object.keys(state[field]).length) throw new Error("The backup contains unsupported dates, sessions, or too many records.");
  }
  if (!sameTextFields(parsed.profile, state.profile, ["loadUnit", "weightUnit", "proteinGoal", "stepGoal", "modifiedAt"])) throw new Error("The backup contains invalid profile settings.");
  for (const [date, raw] of Object.entries(parsed.dailyMetrics)) {
    if (!record(raw) || !sameTextFields(raw, state.dailyMetrics[date], ["protein", "sleepHours", "steps", "waist", "weight", "modifiedAt"])
      || (raw.weightUnit !== undefined && raw.weightUnit !== state.dailyMetrics[date].weightUnit)) throw new Error("The backup contains invalid daily entries or units.");
  }
  for (const [day, raw] of Object.entries(parsed.workouts)) {
    if (!record(raw) || !record(raw.sets) || typeof raw.note !== "string" || raw.note.length > 500) throw new Error("A workout record is incomplete or invalid.");
    const clean = state.workouts[day];
    if (!sameTextFields(raw, clean, ["loadUnit", "workoutId", "modifiedAt"]) || typeof raw.completed !== "boolean" || typeof raw.lowSleep !== "boolean"
      || !record(raw.readiness) || !sameTextFields(raw.readiness, clean.readiness, ["energy", "sleepHours", "soreness"])
      || !record(raw.warmup) || Object.entries(raw.warmup).some(([key, value]) => value !== clean.warmup[key])
      || !record(raw.substitutions) || Object.entries(raw.substitutions).some(([key, value]) => value !== clean.substitutions[key])) {
      throw new Error("The backup contains invalid workout settings or exercise substitutions.");
    }
    if (Object.keys(raw.sets).length !== Object.keys(clean.sets).length) throw new Error("The backup contains an unknown exercise.");
    for (const [slot, sets] of Object.entries(raw.sets)) {
      if (!Array.isArray(sets) || sets.length > 3) throw new Error("A workout has unsupported set data.");
      sets.forEach((set, index) => {
        const next = clean.sets[slot][index];
        if (!record(set) || typeof set.done !== "boolean" || ["load", "reps", "rir"].some(key => typeof set[key] !== "string")
          || JSON.stringify([set.done, set.load, set.reps, set.rir]) !== JSON.stringify([next.done, next.load, next.reps, next.rir])) {
          throw new Error("A set contains invalid values. No records were changed.");
        }
      });
    }
  }
  return normalizeTrackerState(state);
}

export function serializeBackup(state: TrackerState) {
  return JSON.stringify({ format: "gym-tracker-backup", version: 1, exportedAt: new Date().toISOString(), state }, null, 2);
}
export function downloadFile(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadBackup(state: TrackerState, prefix = "gym-tracker-backup") {
  downloadFile(`${prefix}-${new Date().toISOString().slice(0, 10)}.json`, serializeBackup(state), "application/json");
}
export function csvCell(value: unknown) {
  const original = String(value ?? "");
  const text = /^[\s]*[=+@-]|^[\t\r]/.test(original) ? `'${original}` : original;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Cardio export stays in distinct records and never enters strength volume columns. */
export function cardioCsvRows(state: TrackerState): unknown[][] {
  return Object.values(state.cardio?.sessions ?? {}).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(row=>[
    "cardio", row.date, row.id, "", "", "", "", "", "", true, "", "", "", "", "",
    row.modality, row.minutes, row.effort ?? "", row.note, row.opportunityId ?? "",
  ]);
}
