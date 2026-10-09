// Installs the slice of the `chrome.*` API that the UI and data layer use, so
// the same code runs as an ordinary web page. Anything the web has no
// equivalent for (identity tokens, system notifications) is a deliberate no-op
// or reports "unavailable", the way the extension APIs do when they fail.
import { handleMessage } from "../background/messages";
import type { AccountPlatform } from "../background/auth";
import { createRuntime } from "./messageBus";
import { createStorageArea, type StorageChangeListener } from "./storageArea";
import { WEB_RUNTIME_ID } from "./env";

export function installChromeShim(platform: AccountPlatform) {
  const storageListeners = new Set<StorageChangeListener>();
  const local = createStorageArea(
    window.localStorage,
    "local",
    (changes, areaName) => storageListeners.forEach((listener) => listener(changes, areaName)),
  );

  // Another tab (or the installed app) wrote: surface it like a local change.
  window.addEventListener("storage", (event) => {
    if (event.storageArea === window.localStorage) {
      local.applyExternalChange(event.key, event.oldValue, event.newValue);
    }
  });

  const runtime = createRuntime(WEB_RUNTIME_ID, (message, sendResponse) =>
    handleMessage(message, sendResponse, platform),
  );

  const shim = {
    runtime,
    storage: {
      local,
      onChanged: {
        addListener: (listener: StorageChangeListener) => void storageListeners.add(listener),
        removeListener: (listener: StorageChangeListener) => void storageListeners.delete(listener),
        hasListener: (listener: StorageChangeListener) => storageListeners.has(listener),
      },
    },
    action: {
      // The unread count becomes the installed app's icon badge where supported.
      setBadgeText: ({ text }: { text: string }) => {
        const count = parseInt(text, 10);
        const nav = navigator as Navigator & {
          setAppBadge?: (count: number) => Promise<void>;
          clearAppBadge?: () => Promise<void>;
        };
        const apply = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.();
        apply?.catch(() => {});
      },
      setBadgeBackgroundColor: () => {},
    },
    identity: {
      // No silent Google token on the web; Firebase restores its own session.
      getAuthToken: (_options: unknown, callback: (token?: string) => void) =>
        Promise.resolve().then(() => callback(undefined)),
      clearAllCachedAuthTokens: (callback?: () => void) => callback?.(),
    },
    // Push notifications need a backend (FCM); until then the data layer sees
    // "not granted" and skips them.
    notifications: {
      getPermissionLevel: (callback: (level: "granted" | "denied") => void) => callback("denied"),
      create: () => {},
    },
  };

  (globalThis as unknown as { chrome: unknown }).chrome = shim;
  return shim;
}
