import { useEffect, useState } from "react";

// `beforeinstallprompt` fires once, early; keep the event so Settings can
// trigger the browser's install dialog whenever the user asks.
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((subscriber) => subscriber());

export function listenForInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iOS has no install prompt API; Safari users add the app from the Share sheet. */
const isIosSafari = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

export type InstallState =
  | { kind: "installed" }
  | { kind: "prompt"; install: () => Promise<void> }
  | { kind: "ios" }
  | { kind: "unavailable" };

export function useInstallState(): InstallState {
  const [, rerender] = useState(0);
  useEffect(() => {
    const subscriber = () => rerender((n) => n + 1);
    subscribers.add(subscriber);
    return () => void subscribers.delete(subscriber);
  }, []);

  if (isStandalone()) return { kind: "installed" };
  if (deferredPrompt) {
    const event = deferredPrompt;
    return {
      kind: "prompt",
      install: async () => {
        await event.prompt();
        await event.userChoice;
        deferredPrompt = null;
        notify();
      },
    };
  }
  return isIosSafari() ? { kind: "ios" } : { kind: "unavailable" };
}
