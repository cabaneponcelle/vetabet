"use client";

import { useEffect } from "react";

// Enregistre le service worker (PWA) — uniquement en production pour éviter
// tout cache parasite en développement.
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
