import { auth } from "../firebase";
import {
  signInWithCredential,
  GoogleAuthProvider,
} from "firebase/auth/web-extension";
import type { AccountPlatform } from "./auth";

const CLIENT_ID =
  "309540318772-nsj2lle011ifcke7f3l5opp9ql9pr013.apps.googleusercontent.com";
const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
].join(" ");

// Retried fetch for wake-from-idle sign-ins, where the network often isn't
// up yet on the first attempt (the raw failure used to surface as the
// cryptic "Failed to fetch" on the login screen).
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempts = 3,
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export const extensionPlatform: AccountPlatform = {
  async signIn() {
    // Use launchWebAuthFlow for Edge compatibility
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", chrome.identity.getRedirectURL());
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("scope", SCOPES);

    const responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.toString(),
          interactive: true,
        },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(
              new Error(chrome.runtime.lastError.message || "Auth flow failed"),
            );
            return;
          }
          if (redirectUrl) {
            resolve(redirectUrl);
          } else {
            reject(new Error("No redirect URL received"));
          }
        },
      );
    });

    // Extract access token from the redirect URL
    const url = new URL(responseUrl.replace("#", "?"));
    const token = url.searchParams.get("access_token");

    if (!token) {
      throw new Error("No access token in response");
    }

    const response = await fetchWithRetry(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch user info");
    }

    // Use the access token with GoogleAuthProvider
    const credential = GoogleAuthProvider.credential(null, token);
    const result = await signInWithCredential(auth, credential);
    return result.user;
  },

  async beforeDeleteAccount() {
    // The cached Google token is enough to delete the Firebase user later.
  },

  async deleteIdentity(currentUser) {
    // Get fresh token
    const token = await new Promise<string>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        if (!token) {
          reject(new Error("No auth token available"));
          return;
        }
        resolve(token);
      });
    });

    // Revoke Google OAuth token
    await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    // Remove cached token
    await new Promise<void>((resolve, reject) => {
      chrome.identity.removeCachedAuthToken({ token }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        chrome.identity.clearAllCachedAuthTokens(() => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve();
        });
      });
    });

    // Delete the Firebase Auth user
    await currentUser.delete();
  },
};
