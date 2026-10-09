import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth } from "../firebase";
import type { AccountPlatform } from "../background/auth";

function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

/** Set while a full-page redirect sign-in is in flight, so only that return trip checks for a result. */
export const REDIRECT_PENDING_KEY = "lp:redirect-sign-in";

/** Popups are blocked or unsupported in some mobile/in-app browsers; a full-page redirect works there. */
const REDIRECT_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
]);

export function authErrorMessage(error: unknown): Error {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return new Error("Sign-in was cancelled");
    case "auth/unauthorized-domain":
      return new Error(
        `${window.location.hostname} isn't allowed to sign in yet — add it under Authentication > Settings > Authorized domains in the Firebase console`,
      );
    case "auth/network-request-failed":
      return new Error("Couldn't reach Google — check your connection and try again");
    case "auth/requires-recent-login":
      return new Error("Please sign in again before deleting your account");
    default:
      return error instanceof Error ? error : new Error("Sign-in failed");
  }
}

export const webPlatform: AccountPlatform = {
  async signIn() {
    try {
      return (await signInWithPopup(auth, googleProvider())).user;
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code && REDIRECT_FALLBACK_CODES.has(code)) {
        // Leaves the page; the result is picked up by resumeRedirectSignIn on return.
        window.sessionStorage.setItem(REDIRECT_PENDING_KEY, "1");
        await signInWithRedirect(auth, googleProvider());
        return new Promise<never>(() => {});
      }
      throw authErrorMessage(error);
    }
  },

  async beforeDeleteAccount() {
    // Deleting a Firebase user needs a fresh sign-in; do it before touching
    // any data so cancelling the prompt leaves the account intact.
    if (!auth.currentUser) throw new Error("No user logged in");
    try {
      await reauthenticateWithPopup(auth.currentUser, googleProvider());
    } catch (error) {
      throw authErrorMessage(error);
    }
  },

  async deleteIdentity(user) {
    await user.delete();
  },
};
