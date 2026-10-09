import { getRedirectResult } from "firebase/auth";
import { auth } from "../firebase";
import { completeSignIn } from "../background/auth";
import { checkForNewLinks, updateBadge } from "../background/sync";
import { installChromeShim } from "./chromeShim";
import { listenForInstallPrompt } from "./install";
import { REDIRECT_PENDING_KEY, authErrorMessage, webPlatform } from "./platform";
import { extractShared } from "./shareTarget";

// The extension's service worker polls on alarms and while a popup is open;
// the web app has no background context, so it syncs while visible instead.
const SYNC_INTERVAL_MS = 15000;
const SYNC_THROTTLE_MS = 10000;

/**
 * Must run before React mounts: the UI reads chrome.* as it renders. Also
 * stashes a link handed over by the OS share sheet so the first screen after
 * sign-in is the share sheet for it.
 */
export function prepareWebRuntime() {
  installChromeShim(webPlatform);
  listenForInstallPrompt();

  const shared = extractShared(new URLSearchParams(window.location.search));
  if (shared) {
    chrome.storage.local.set("url" in shared ? { shareUrl: shared.url } : { shareText: shared.text });
    window.history.replaceState(null, "", window.location.pathname);
  }
}

export function startWebRuntime() {
  startSync();
  void resumeRedirectSignIn();
  registerServiceWorker();
}

function startSync() {
  let lastSyncAt = 0;
  const sync = (force = false) => {
    if (document.visibilityState !== "visible") return;
    const now = Date.now();
    if (!force && now - lastSyncAt < SYNC_THROTTLE_MS) return;
    lastSyncAt = now;
    checkForNewLinks().catch((error) => console.error("Sync failed:", error));
  };

  sync(true);
  window.setInterval(() => sync(), SYNC_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => sync());
  window.addEventListener("focus", () => sync());
  window.addEventListener("online", () => sync(true));

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.user) void updateBadge();
  });
  void updateBadge();
}

/** Picks up a sign-in that finished on a full-page redirect (popup-hostile browsers). */
async function resumeRedirectSignIn() {
  // getRedirectResult loads Firebase's auth iframe, so skip it on ordinary page loads.
  if (window.sessionStorage.getItem(REDIRECT_PENDING_KEY) !== "1") return;
  window.sessionStorage.removeItem(REDIRECT_PENDING_KEY);
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) await completeSignIn(Promise.resolve(result.user));
  } catch (error) {
    chrome.runtime.sendMessage({
      type: "SIGN_IN_ERROR",
      error: authErrorMessage(error).message,
    });
  }
}

function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("/app/sw.js", { scope: "/app/" })
    .catch((error) => console.warn("Service worker registration failed:", error));
}
