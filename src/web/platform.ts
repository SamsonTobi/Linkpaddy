import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import type { AccountPlatform } from "../background/auth";

function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

function authErrorMessage(error: unknown): Error {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case "auth/popup-blocked":
      return new Error("Your browser blocked the sign-in pop-up — allow pop-ups for this site and try again");
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
    // Popup only: a full-page redirect loses its result in browsers that
    // partition third-party storage (current Chrome, Edge and Safari).
    try {
      return (await signInWithPopup(auth, googleProvider())).user;
    } catch (error) {
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
