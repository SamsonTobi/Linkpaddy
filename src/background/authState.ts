import { auth } from "../firebase";
import { signInWithCredential, GoogleAuthProvider } from "firebase/auth/web-extension";
import type { User } from "firebase/auth/web-extension";

const AUTH_READY_TIMEOUT_MS = 8000;

export class BackgroundAuthNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackgroundAuthNotReadyError";
  }
}

export async function waitForAuthReadyWithTimeout() {
  if (typeof (auth as any).authStateReady !== "function") {
    return;
  }

  try {
    await Promise.race([
      (auth as any).authStateReady(),
      new Promise<void>((resolve) => {
        setTimeout(resolve, AUTH_READY_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.warn("Auth readiness check failed:", error);
  }
}

async function trySilentReauth(): Promise<User | null> {
  try {
    const token = await new Promise<string | null>((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (t) => {
        if (chrome.runtime.lastError || !t) {
          resolve(null);
          return;
        }
        resolve(t);
      });
    });
    if (!token) return null;

    const credential = GoogleAuthProvider.credential(null, token);
    const result = await signInWithCredential(auth, credential);
    return result.user;
  } catch (error) {
    console.warn("Silent re-auth attempt failed:", error);
    return null;
  }
}

let silentReauthAttempted = false;

export async function requireMatchingAuthUser(expectedUid?: string) {
  await waitForAuthReadyWithTimeout();

  let currentUser = auth.currentUser;

  if (!currentUser && !silentReauthAttempted) {
    silentReauthAttempted = true;
    console.log("Firebase auth not ready — attempting silent re-auth...");
    currentUser = await trySilentReauth();
  }

  if (!currentUser) {
    // Send a signal to the popup so it can show the login screen directly
    try {
      chrome.runtime.sendMessage({ type: "SIGN_OUT_FORCED" });
    } catch (_) {
      // Popup might not be open — ignore
    }

    throw new BackgroundAuthNotReadyError(
      "Firebase auth is not ready. Please reopen the extension or sign in again.",
    );
  }

  if (expectedUid && currentUser.uid !== expectedUid) {
    throw new BackgroundAuthNotReadyError(
      "Firebase auth user does not match the stored user. Please sign in again.",
    );
  }

  return currentUser;
}

/** Resets the silent-reauth flag so it can be retried on the next service-worker lifecycle. */
export function resetSilentReauthFlag() {
  silentReauthAttempted = false;
}
