import { sanitizeTrackerState } from "./tracker-validation";
import type { TrackerState } from "../app/tracker-types";
export const recoveryKey = (email: string) => `gym-tracker:progress:v1:${encodeURIComponent(email)}`;
export function isolatedTabKey(base: string, id: string) { return `${base}:tab:${id}`; }
export function copyInitialRecovery(storage: Pick<Storage, "getItem" | "setItem">, base: string, key: string) {
  if (storage.getItem(key)) return;
  const raw = storage.getItem(base);
  if (raw) {
    const value = JSON.parse(raw);
    if (value.format !== 1 || !sanitizeTrackerState(value.state) || !Number.isSafeInteger(value.version)) throw new Error("Unreadable original recovery copy");
    storage.setItem(key, raw);
  }
}
export function readDeviceDrafts(storage: Storage, base: string): { key: string; state: TrackerState; pending: boolean }[] {
  const values = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key || (key !== base && !key.startsWith(base + ":tab:"))) continue;
    try {
      const value = JSON.parse(storage.getItem(key) ?? "null");
      const state = value?.format === 1 ? sanitizeTrackerState(value.state) : null;
      if (state && value.pending) values.push({ key, state, pending: true });
    } catch { /* Invalid drafts remain untouched. */ }
  }
  return values;
}

/** A controller-specific gate fences late requests after its tab/account loses access. */
export class EditGate {
  private active = false;
  constructor(readonly identity: string) {}
  get allowed() { return this.active; }
  set(allowed: boolean) { this.active = allowed; }
}
