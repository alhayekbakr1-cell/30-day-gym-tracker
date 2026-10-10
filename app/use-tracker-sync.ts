"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { TrackerSync, type ProgressAPI } from "../lib/tracker-sync";
import { recoveryKey, isolatedTabKey, copyInitialRecovery, EditGate } from "../lib/tab-recovery";
import type { SyncedProgress } from "./tracker-types";

async function readResponse(response: Response): Promise<SyncedProgress> {
  const data = await response.json() as SyncedProgress;
  if (!Number.isSafeInteger(data.version) || data.version < 0 || !("state" in data)) throw new Error("Invalid progress response");
  return data;
}
export function useTrackerSync(email: string | null) {
  const localOnly = !email || email === "preview@gym.local";
  const channel = useRef<BroadcastChannel | null>(null);
  const [ownership, setOwnership] = useState("Waiting for edit ownership…");
  const [online, setOnline] = useState(true);
  const [editable, setEditable] = useState(false);
  const [accountChanged, setAccountChanged] = useState(false);
  const [diskKey, setDiskKey] = useState("");
  const base = recoveryKey(email ?? "guest");
  const gate = useMemo(() => new EditGate(`${base}:${diskKey}`), [base, diskKey]);
  const controller = useMemo(() => {
    const failAccount = () => { gate.set(false); setEditable(false); setAccountChanged(true); };
    const check = async (response: Response) => {
      if ([401, 403, 412].includes(response.status)) { failAccount(); throw new Error("Account changed"); }
      if (!response.ok && response.status !== 409) throw new Error("Progress unavailable");
      return readResponse(response);
    };
    const headers = { "content-type": "application/json", "x-gym-expected-account": email ?? "" };
    const api: ProgressAPI = {
      read: async () => check(await fetch("/api/progress", { headers, cache: "no-store", signal: AbortSignal.timeout(15000) })),
      write: async (state, version) => {
        const response = await fetch("/api/progress", { method: "PUT", headers, body: JSON.stringify({ baseVersion: version, state }), signal: AbortSignal.timeout(15000) });
        return { conflict: response.status === 409, progress: await check(response) };
      },
    };
    return new TrackerSync(diskKey || base, () => window.localStorage, localOnly ? null : api,
      // The constructor stores callbacks; notifications read the ref only after an effect/event persists a draft.
      // eslint-disable-next-line react-hooks/refs
      () => gate.allowed, () => { try { channel.current?.postMessage({ type: "draft-changed" }); } catch { /* Storage events remain available. */ } }, diskKey.includes(":tab:"));
  }, [email, base, diskKey, localOnly, gate]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);

  useEffect(() => {
    gate.set(false);
    let stopped = false;
    let invalidAccount = false;
    let release: (() => void) | undefined;
    const abort = new AbortController();
    const update = (allowed: boolean, message: string) => { if (!stopped) { gate.set(allowed && !invalidAccount); setEditable(allowed && !invalidAccount); setOwnership(message); } };
    const session = async () => {
      if (localOnly || !navigator.onLine || stopped) return;
      try {
        const response = await fetch("/api/session", { cache: "no-store", signal: AbortSignal.timeout(10000) });
        const data = await response.json() as { email?: string };
        if (stopped) return;
        if (!response.ok || data.email !== email) {
          invalidAccount = true; update(false, "Account changed — reload to continue."); setAccountChanged(true); controller.clearAccountView(); release?.();
        }
      } catch { /* Offline is not a new authentication claim. */ }
    };
    const begin = async () => {
      if (!email) { update(false, "Sign in online to open your account records."); return; }
      if (!diskKey) {
        let key = base;
        if (!navigator.locks) {
          try {
            // A fresh key per document also handles duplicated tabs safely. Older keys stay exportable.
            key = isolatedTabKey(base, crypto.randomUUID());
            copyInitialRecovery(localStorage, base, key);
          } catch { update(false, "Recovery storage unavailable — editing locked to protect existing drafts."); return; }
        }
        setDiskKey(key); return;
      }
      try { channel.current = new BroadcastChannel(base); } catch { channel.current = null; }
      if (channel.current) channel.current.onmessage = event => {
        if (event.data?.type === "draft-changed" && !gate.allowed && !invalidAccount) controller.reloadRecovery();
        if (event.data?.type === "account-check") void session();
      };
      await session();
      if (stopped || invalidAccount) return;
      controller.hydrate();
      if (navigator.locks) {
        update(false, "Read-only: another tab may be editing. Close that tab to transfer ownership.");
        try {
          await navigator.locks.request(base, { signal: abort.signal }, async () => {
            if (stopped || invalidAccount) return;
            controller.reloadRecovery(); update(true, "This tab owns editing and synchronization.");
            if (!localOnly) void controller.sync();
            await new Promise<void>(done => { release = done; });
          });
        } catch { if (!stopped) update(false, "Edit lock unavailable. Drafts are preserved; reload or use another browser."); }
      } else {
        update(true, "Isolated draft mode: tabs retain separate drafts. After a reload, export an unsynced draft below and restore it through Backup tools.");
        if (!localOnly) void controller.sync();
      }
    };
    queueMicrotask(() => { if (!stopped) void begin(); });
    const connectivity = () => { setOnline(navigator.onLine); if (navigator.onLine) void session().then(() => { if (gate.allowed) void controller.sync(); }); };
    const visible = () => { if (document.visibilityState === "visible") void session().then(() => { if (gate.allowed && navigator.onLine) void controller.sync(); }); };
    const storage = (event: StorageEvent) => { if (event.key === diskKey && !gate.allowed && !invalidAccount) controller.reloadRecovery(); };
    const beforeUnload = (event: BeforeUnloadEvent) => { const state = controller.getSnapshot(); if (state.pending && !state.localSaved) { event.preventDefault(); event.returnValue = ""; } };
    const tick = window.setInterval(() => { void session().then(() => { if (gate.allowed && navigator.onLine && controller.getSnapshot().pending && !controller.getSnapshot().conflict) void controller.sync(); }); }, 30000);
    queueMicrotask(() => { if (!stopped) setOnline(navigator.onLine); });
    window.addEventListener("online", connectivity); window.addEventListener("offline", connectivity); window.addEventListener("storage", storage); window.addEventListener("beforeunload", beforeUnload); document.addEventListener("visibilitychange", visible);
    return () => { stopped = true; gate.set(false); abort.abort(); release?.(); controller.dispose(); channel.current?.close(); channel.current = null; window.clearInterval(tick); window.removeEventListener("online", connectivity); window.removeEventListener("offline", connectivity); window.removeEventListener("storage", storage); window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("visibilitychange", visible); };
  }, [controller, diskKey, base, email, localOnly, gate]);
  return { ...snapshot, state: accountChanged ? controller.getServerSnapshot().state : snapshot.state, loaded: snapshot.loaded && !accountChanged, controller, localOnly, editable: editable && !accountChanged, ownership, online, accountChanged, recoveryBase: base, revokeAccount: () => { gate.set(false); setAccountChanged(true); setEditable(false); controller.clearAccountView(); try { channel.current?.postMessage({ type: "account-check" }); } catch { /* Navigation still signs out. */ } } };
}
