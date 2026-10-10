import { cardioConflict } from "../app/cardio-logic";
import type { SyncedProgress, TrackerState } from "../app/tracker-types";
import { EMPTY_STATE, earliestFourDayStart, mergeTrackerStates, normalizeTrackerState } from "../app/tracker-logic";
import { sanitizeTrackerState } from "./tracker-validation";

export type SyncStatus = "error" | "loading" | "saved" | "syncing" | "local" | "queued";
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export type ProgressAPI = {
  read: () => Promise<SyncedProgress>;
  write: (state: TrackerState, version: number) => Promise<{ conflict: boolean; progress: SyncedProgress }>;
};
export type SyncSnapshot = {
  state: TrackerState; loaded: boolean; pending: boolean; status: SyncStatus;
  version: number; updatedAt: number | null; localSaved: boolean;
  storageError: string | null; message: string; conflict: boolean;
};
type Cache = { format: 1; state: TrackerState; base: TrackerState | null; version: number; pending: boolean; replacement: boolean; updatedAt: number | null };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Durable account-scoped outbox. The server's version remains the write authority. */
export class TrackerSync {
  private snapshot: SyncSnapshot = { state: normalizeTrackerState(EMPTY_STATE), loaded: false, pending: false, status: "loading", version: 0, updatedAt: null, localSaved: false, storageError: null, message: "", conflict: false };
  private readonly initial = this.snapshot;
  private listeners = new Set<() => void>();
  private base: TrackerState | null = null;
  private replacement = false;
  private unreadableCache = false;
  private task: Promise<boolean> | null = null;
  private queued: ReturnType<typeof setTimeout> | null = null;
  private remoteConflict: SyncedProgress | null = null;
  constructor(private key: string, private storage: () => StorageLike, private api: ProgressAPI | null, private owns: () => boolean = () => true, private notify: () => void = () => {}, private retainCompetingDrafts = false) {}
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.initial;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<SyncSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private persist() {
    if (!this.owns() || this.unreadableCache || !this.snapshot.loaded) return false;
    const cache: Cache = { format: 1, state: this.snapshot.state, base: this.base, version: this.snapshot.version, pending: this.snapshot.pending, replacement: this.replacement, updatedAt: this.snapshot.updatedAt };
    try {
      this.storage().setItem(this.key, JSON.stringify(cache));
      this.notify();
      this.publish({ localSaved: true, storageError: null });
      return true;
    } catch {
      this.publish({ localSaved: false, storageError: "This browser could not save a recovery copy. Keep this tab open until sync succeeds, or export JSON." });
      return false;
    }
  }
  hydrate() {
    if (this.snapshot.loaded) return;
    try {
      const raw = this.storage().getItem(this.key);
      if (raw) {
        const cache = JSON.parse(raw) as Cache;
        const state = cache.format === 1 && [5, 6, 7, 8].includes(cache.state?.schemaVersion) ? sanitizeTrackerState(cache.state) : null;
        if (!state || !Number.isSafeInteger(cache.version) || cache.version < 0) throw new Error("Invalid recovery data");
        this.base = cache.base ? normalizeTrackerState(sanitizeTrackerState(cache.base)) : null;
        this.replacement = cache.replacement === true;
        this.publish({ state: normalizeTrackerState(state), loaded: true, pending: Boolean(this.api && cache.pending), version: cache.version, updatedAt: cache.updatedAt, localSaved: true, status: this.api ? (cache.pending ? "queued" : "loading") : "local" });
      }
    } catch {
      this.unreadableCache = true;
      this.publish({ storageError: "The device recovery copy could not be read. It has been preserved; export your loaded records before clearing browser storage." });
    }
    if (!this.api) this.publish({ loaded: true, status: "local" });
  }
  mutate(transform: (current: TrackerState) => TrackerState) {
    if (!this.owns() || !this.snapshot.loaded || this.snapshot.conflict) return;
    const next = transform(this.snapshot.state);
    if (next === this.snapshot.state) return;
    this.publish({ state: next, pending: Boolean(this.api), status: this.api ? "queued" : "local" });
    this.persist();
    if (this.api) {
      if (this.queued) clearTimeout(this.queued);
      this.queued = setTimeout(() => { this.queued = null; void this.sync(false); }, 600);
    }
  }
  replace(next: TrackerState) {
    if (!this.owns()) return;
    this.replacement = true;
    this.mutate(() => next);
  }
  acceptServerPlan() {
    if (!this.owns() || !this.remoteConflict) return;
    const progress = this.remoteConflict;
    this.remoteConflict = null;
    this.replacement = false;
    this.base = progress.state;
    this.publish({ state: normalizeTrackerState(progress.state), version: progress.version, updatedAt: progress.updatedAt, pending: false, conflict: false, status: "saved", loaded: true, message: "Current server plan loaded." });
    this.persist();
  }
  /** Used only after the server has acknowledged an archive/restart transaction. */
  acceptAcknowledged(progress: SyncedProgress) {
    if (!this.owns()) return;
    this.base = progress.state;
    this.replacement = false;
    this.publish({ state: normalizeTrackerState(progress.state), version: progress.version, updatedAt: progress.updatedAt, pending: false, status: this.api ? "saved" : "local", loaded: true, conflict: false, message: "" });
    this.persist();
  }
  private reconcile(progress: SyncedProgress, sent?: TrackerState) {
    const remote = normalizeTrackerState(progress.state);
    const local = this.snapshot.state;
    if (this.retainCompetingDrafts && this.snapshot.pending && !sent && progress.version > this.snapshot.version && !equal(local, remote)) {
      // Keep an immutable, exportable copy before timestamp-based merging can choose another tab's field.
      const retained: Cache = { format: 1, state: local, base: this.base, version: this.snapshot.version, pending: true, replacement: this.replacement, updatedAt: this.snapshot.updatedAt };
      try { this.storage().setItem(`${this.key}:retained:${crypto.randomUUID()}`, JSON.stringify(retained)); }
      catch { this.publish({ storageError: "Could not preserve this competing draft. Merge is paused; export JSON before retrying." }); throw new Error("draft-retention-failed"); }
    }
    if (this.snapshot.pending && cardioConflict(remote.cardio,local.cardio,sent ? sent.cardio : this.base?.cardio ?? null)) {
      this.remoteConflict = progress;
      this.publish({ conflict: true, message: "The same cardio visit or plan was edited differently on another device. Your draft is preserved. Export it before loading the server copy." });
      throw new Error("cardio-conflict");
    }
    const differentPlan = remote.blockId !== local.blockId || remote.startDate !== local.startDate;
    const serverChangedPlan = this.base
      ? remote.blockId !== this.base.blockId || remote.startDate !== this.base.startDate
      : Boolean(remote.startDate && local.startDate);
    const serverChangedProgram = !equal(remote.fourDayPlan, local.fourDayPlan) && !equal(remote.fourDayPlan, this.base?.fourDayPlan ?? null);
    const transitionOverlapsNewHistory = local.fourDayPlan && !remote.fourDayPlan && remote.startDate
      && local.fourDayPlan.startsOn < earliestFourDayStart(remote, remote.startDate);
    if (this.snapshot.pending && !sent && (
      (this.replacement && progress.version !== this.snapshot.version) ||
      (!this.replacement && ((differentPlan && serverChangedPlan) || serverChangedProgram || transitionOverlapsNewHistory))
    )) {
      this.remoteConflict = progress;
      this.publish({ conflict: true, message: "The plan, schedule, or prescription changed on another device. Your device draft is preserved. Export it before loading the server plan." });
      throw new Error("plan-conflict");
    }
    const next = sent
      ? (local === sent ? remote : mergeTrackerStates(remote, local, sent))
      : this.snapshot.pending
        ? (this.replacement ? local : mergeTrackerStates(remote, local, this.base))
        : remote;
    this.base = remote;
    const pending = !equal(next, remote);
    if (!pending) this.replacement = false;
    this.publish({ state: next, loaded: true, version: progress.version, updatedAt: progress.updatedAt, pending, conflict: false, status: pending ? "queued" : "saved", message: "" });
    this.persist();
  }
  sync = (refresh = true): Promise<boolean> => {
    if (this.task) return this.task;
    if (this.queued) { clearTimeout(this.queued); this.queued = null; }
    this.task = this.run(refresh).finally(() => { this.task = null; });
    return this.task;
  };
  private async run(refresh: boolean) {
    if (!this.owns()) return false;
    if (!this.api) return this.persist();
    try {
      if (refresh || !this.snapshot.loaded) {
        this.publish({ status: "loading" });
        const progress = await this.api.read();
        if (!this.owns()) return false;
        this.reconcile(progress);
      }
      let conflicts = 0;
      while (this.snapshot.pending) {
        if (!this.owns()) return false;
        if (this.snapshot.conflict) throw new Error("plan-conflict");
        const sent = this.snapshot.state;
        this.publish({ status: "syncing" });
        const result = await this.api.write(sent, this.snapshot.version);
        if (!this.owns()) return false;
        if (result.conflict) {
          this.reconcile(result.progress);
          if (++conflicts >= 3) throw new Error("Repeated write conflict");
        } else this.reconcile(result.progress, sent);
      }
      this.publish({ status: "saved", message: "" });
      return true;
    } catch {
      this.publish({ status: "error", message: this.snapshot.conflict ? this.snapshot.message : this.snapshot.pending ? "Changes are waiting to sync. Retry when connected." : "Progress could not be checked. Retry the connection." });
      this.persist();
      return false;
    }
  }
  reloadRecovery() {
    this.publish({ loaded: false });
    this.hydrate();
  }
  clearAccountView() {
    this.dispose(); this.base = null;
    this.publish({ state: normalizeTrackerState(EMPTY_STATE), loaded: false, pending: false, status: "error", message: "Account changed. Reload to confirm your identity. Previous drafts remain on this device." });
  }
  dispose() { if (this.queued) clearTimeout(this.queued); this.queued = null; }
}
