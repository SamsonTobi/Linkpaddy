import { auth } from "../firebase";
import { checkForNewLinks, updateBadge } from "../background/sync";
import { installChromeShim } from "./chromeShim";
import { listenForInstallPrompt } from "./install";
import { webPlatform } from "./platform";
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
  void warmUpPopupSignIn();
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

/**
 * Firebase loads its sign-in iframe lazily on desktop browsers. If that load
 * only starts at click time, the popup opens after the click's user-activation
 * window and gets blocked on slow networks, so start it now. The SDK does the
 * same eagerly on mobile and Safari through the resolver's _initialize, which
 * is not in the public types; if it ever disappears this is just a no-op.
 */
async function warmUpPopupSignIn() {
  try {
    await auth.authStateReady();
    const resolver = (auth as unknown as {
      _popupRedirectResolver?: { _initialize?: (auth: unknown) => Promise<unknown> };
    })._popupRedirectResolver;
    await resolver?._initialize?.(auth);
  } catch (error) {
    console.warn("Sign-in warm-up skipped:", error);
  }
}

function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("/app/sw.js", { scope: "/app/" })
    .catch((error) => console.warn("Service worker registration failed:", error));
}
