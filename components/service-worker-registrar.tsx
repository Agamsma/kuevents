"use client";

import { useEffect } from "react";

/**
 * Registers the app-shell service worker.
 *
 * Skipped in development: an SW that caches the dev server's HTML makes hot
 * reload behave like a haunting.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("[pwa] service worker registration failed", error);
      });
    };

    // Wait for load so the SW install does not compete with first paint.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
