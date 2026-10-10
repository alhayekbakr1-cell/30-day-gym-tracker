"use client";
import { useEffect, useState } from "react";
export default function OfflineSupport() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/service-worker.js", { scope: "/", updateViaCache: "none" }).then(registration => {
      const update = () => { if (active && registration.waiting) setMessage("An app update is ready. Finish saving or export your draft, then close all tracker tabs and reopen. No automatic reload."); };
      update();
      registration.addEventListener("updatefound", () => registration.installing?.addEventListener("statechange", update));
    }).catch(() => { if (active) setMessage("Offline shell could not be installed. Keep this tab open offline; device drafts are unaffected."); });
    return () => { active = false; };
  }, []);
  return message ? <p className="offline-update" role="status">{message}</p> : null;
}
