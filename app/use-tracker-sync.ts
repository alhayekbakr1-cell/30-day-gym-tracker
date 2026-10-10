"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { TrackerSync, type ProgressAPI } from "../lib/tracker-sync";
import type { SyncedProgress } from "./tracker-types";

async function readResponse(response: Response): Promise<SyncedProgress> {
  const data = await response.json() as SyncedProgress;
  if (!Number.isSafeInteger(data.version) || data.version < 0 || !("state" in data)) throw new Error("Invalid progress response");
  return data;
}
const api: ProgressAPI = {
  read: async () => {
    const response = await fetch("/api/progress", { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Progress could not be loaded");
    return readResponse(response);
  },
  write: async (state, version) => {
    const response = await fetch("/api/progress", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ baseVersion: version, state }), signal: AbortSignal.timeout(15000) });
    if (!response.ok && response.status !== 409) throw new Error("Progress could not be saved");
    return { conflict: response.status === 409, progress: await readResponse(response) };
  },
};

export function useTrackerSync(email: string | null) {
  const localOnly = !email || email === "preview@gym.local";
  const controller = useMemo(() => new TrackerSync(`gym-tracker:progress:v1:${encodeURIComponent(email ?? "guest")}`, () => window.localStorage, !email || email === "preview@gym.local" ? null : api), [email]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  useEffect(() => {
    controller.hydrate();
    if (!localOnly) void controller.sync();
    const reconnect = () => void controller.sync();
    const visible = () => { if (document.visibilityState === "visible") void controller.sync(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = controller.getSnapshot();
      if (current.pending && !current.localSaved) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("online", reconnect);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", visible);
    const retry = window.setInterval(() => {
      if (navigator.onLine && controller.getSnapshot().pending && !controller.getSnapshot().conflict) void controller.sync();
    }, 30000);
    return () => { controller.dispose(); window.clearInterval(retry); window.removeEventListener("online", reconnect); window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("visibilitychange", visible); };
  }, [controller, localOnly]);
  return { ...snapshot, controller, localOnly };
}
