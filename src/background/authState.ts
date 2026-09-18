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

// Silent re-auth is throttled, not once-per-lifecycle: a failed attempt
// during a network dead spot must not burn the only chance to recover.
const SILENT_REAUTH_THROTTLE_MS = 2 * 60 * 1000;
let lastSilentReauthAt = 0;

export async function requireMatchingAuthUser(expectedUid?: string) {
  await waitForAuthReadyWithTimeout();

  let currentUser = auth.currentUser;

  if (!currentUser) {
    const now = Date.now();
    if (now - lastSilentReauthAt >= SILENT_REAUTH_THROTTLE_MS) {
      lastSilentReauthAt = now;
      console.log("Firebase auth not ready — attempting silent re-auth...");
      currentUser = await trySilentReauth();
    }
  }

  if (!currentUser) {
    // Transient (cold start after idle, slow restore, offline) — NOT a
    // logout. Callers treat this as "try again later" and the popup keeps
    // showing cached data. A forced login screen is only sent when the
    // server confirms the account is gone (see sync).
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
