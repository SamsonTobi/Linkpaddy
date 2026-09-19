// Polyfill XMLHttpRequest inside the Chrome Extension Service Worker (Manifest V3)
// since the modular Firebase JS SDK falls back to XHR for long-polling.
if (typeof globalThis.XMLHttpRequest === "undefined") {
  (globalThis as any).XMLHttpRequest = class MockXMLHttpRequest {
    method: string = "GET";
    url: string = "";
    headers: Record<string, string> = {};
    status: number = 0;
    statusText: string = "";
    responseText: string = "";
    response: any = null;
    responseType: string = "";
    readyState: number = 0; // UNSENT
    withCredentials: boolean = false;
    timeout: number = 0;

    onload: (() => void) | null = null;
    onerror: ((err: any) => void) | null = null;
    onreadystatechange: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onloadend: (() => void) | null = null;

    private controller: AbortController | null = null;

    open(method: string, url: string, async: boolean = true) {
      this.method = method;
      this.url = url;
      this.readyState = 1; // OPENED
      if (this.onreadystatechange) this.onreadystatechange();
    }

    setRequestHeader(name: string, value: string) {
      this.headers[name] = value;
    }

    abort() {
      if (this.controller) {
        this.controller.abort();
      }
      // An aborted request must still terminate from the SDK's perspective.
      // Previously nothing fired here, so Firestore (long-polling, which
      // aborts requests routinely) waited forever: reads and writes never
      // settled and shares sat stuck on "Sharing..." indefinitely.
      if (this.readyState !== 4) {
        this.readyState = 4; // DONE
        this.status = 0;
        if (this.onreadystatechange) this.onreadystatechange();
      }
    }

    send(body: any) {
      this.controller = new AbortController();
      const signal = this.controller.signal;

      const fetchOptions: RequestInit = {
        method: this.method,
        headers: this.headers,
        body: body,
        signal,
      };

      let timeoutId: any = null;
      if (this.timeout > 0) {
        timeoutId = setTimeout(() => {
          this.abort(); // signals termination (readyState + handler) first
          if (this.ontimeout) this.ontimeout();
          if (this.onloadend) this.onloadend();
        }, this.timeout);
      }

      fetch(this.url, fetchOptions)
        .then(async (response) => {
          if (timeoutId) clearTimeout(timeoutId);

          this.status = response.status;
          this.statusText = response.statusText;

          const text = await response.text();
          this.responseText = text;
          this.response = text;
          this.readyState = 4; // DONE

          if (this.onreadystatechange) this.onreadystatechange();
          if (this.onload) this.onload();
          if (this.onloadend) this.onloadend();
        })
        .catch((err) => {
          if (timeoutId) clearTimeout(timeoutId);
          if (err.name === "AbortError") {
            return;
          }
          this.status = 0;
          this.readyState = 4; // DONE

          if (this.onreadystatechange) this.onreadystatechange();
          if (this.onerror) this.onerror(err);
          if (this.onloadend) this.onloadend();
        });
    }
  };
}

import { registerBackgroundListeners } from "./background/listeners";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth/web-extension";
import { waitForAuthReadyWithTimeout } from "./background/authState";

// Diagnostic hook: Firestore SDK internals can reject outside our try/catch
// (e.g. rules denials on cross-user writes). Log them with context instead
// of letting the worker die silently.
(globalThis as any).addEventListener?.("unhandledrejection", (event: any) => {
  console.error("Unhandled background rejection:", event?.reason);
});

// Pre-warm Firebase Auth when service worker boots so auth state is ready
// before the first popup request arrives.
onAuthStateChanged(auth, () => {
  // no-op — just forces Firebase to begin restoring the session immediately
});
waitForAuthReadyWithTimeout().then(() => {
  // Auth restoring here warms the session before the first popup request.
});

registerBackgroundListeners();
