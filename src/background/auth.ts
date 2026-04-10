import { auth, db } from "../firebase";
import {
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from "firebase/auth/web-extension";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  collection,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";

function normalizeUsername(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^@/, "").toLowerCase();
}

function buildUsernameBase(displayName: unknown): string {
  const normalized =
    typeof displayName === "string"
      ? displayName.toLowerCase().replace(/\s+/g, "")
      : "user";
  const safe = normalized.replace(/[^a-z0-9_]/g, "");
  return safe || "user";
}

async function generateUniqueUsername(displayName: unknown): Promise<string> {
  const baseName = buildUsernameBase(displayName);

  for (let attempt = 0; attempt < 8; attempt++) {
    const randomNum = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    const candidate = `${baseName}${randomNum}`;

    const existing = await getDocs(
      query(collection(db, "users"), where("username", "==", candidate)),
    );

    if (existing.empty) {
      return candidate;
    }
  }

  return `${baseName}${Date.now().toString().slice(-6)}`;
}

export async function signIn() {
  try {
    // Use launchWebAuthFlow for Edge compatibility
    const redirectUri = chrome.identity.getRedirectURL();
    const clientId =
      "309540318772-nsj2lle011ifcke7f3l5opp9ql9pr013.apps.googleusercontent.com";
    const scopes = [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "openid",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("scope", scopes);

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

    const response = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch user info");
    }

    const userInfo = await response.json();

    // Use the access token with GoogleAuthProvider
    const credential = GoogleAuthProvider.credential(null, token);
    const result = await signInWithCredential(auth, credential);
    const user = result.user;

    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    let userData;
    if (!userDoc.exists()) {
      const username = await generateUniqueUsername(user.displayName);

      userData = {
        uid: user.uid,
        email: user.email,
        username: username,
        displayName: user.displayName,
        photoURL: user.photoURL,
        friends: [],
        pendingInvites: [],
        isNewUser: true, // Explicitly set this flag
      };
      await setDoc(userRef, userData);
    } else {
      userData = userDoc.data();
      userData.isNewUser = false; // Ensure this is set for existing users
    }

    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        {
          user: {
            ...userData,
            displayName: user.displayName,
            photoURL: user.photoURL,
          },
        },
        resolve,
      );
    });

    chrome.runtime.sendMessage({
      type: "SIGN_IN_COMPLETE",
      user: {
        ...userData,
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
    });
  } catch (error) {
    console.error("Sign-in error:", error);
    chrome.runtime.sendMessage({
      type: "SIGN_IN_ERROR",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

export async function handleSignOut() {
  try {
    chrome.action.setBadgeText({ text: "" });
    await firebaseSignOut(auth);

    // Clear all cached auth tokens and local storage
    chrome.identity.clearAllCachedAuthTokens(() => {
      chrome.storage.local.clear(() => {
        chrome.runtime.sendMessage({ type: "SIGN_OUT_COMPLETE" });
      });
    });
  } catch (error) {
    console.error("Sign-out error:", error);
    chrome.runtime.sendMessage({
      type: "SIGN_OUT_ERROR",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

export async function deleteUser(uid: string) {
  try {
    // Get the current user data from storage
    const userData = await new Promise<{
      uid: string;
      username?: string;
      [key: string]: any;
    }>((resolve, reject) => {
      chrome.storage.local.get(["user"], (result) => {
        if (!result.user) {
          reject(new Error("No user data found"));
          return;
        }
        resolve(result.user);
      });
    });

    // Verify the uid matches
    if (userData.uid !== uid) {
      throw new Error("User ID mismatch");
    }

    // Delete user document from Firestore
    const userRef = doc(db, "users", uid);
    await deleteDoc(userRef);

    // Clean up user from friends' lists if username exists
    if (userData.username || userData.uid) {
      const normalizedDeletedUsername = normalizeUsername(userData.username);
      const allUsersSnapshot = await getDocs(collection(db, "users"));

      await Promise.all(
        allUsersSnapshot.docs.map(async (snapshotDoc) => {
          if (snapshotDoc.id === uid) return;

          const snapshotData = snapshotDoc.data();
          const existingFriends = Array.isArray(snapshotData.friends)
            ? snapshotData.friends
            : [];

          const filteredFriends = existingFriends.filter((friend: any) => {
            if (typeof friend === "string") {
              const legacyFriendUsername = normalizeUsername(friend);
              return legacyFriendUsername !== normalizedDeletedUsername;
            }

            const friendUid =
              typeof friend?.uid === "string" ? friend.uid.trim() : "";
            const friendUsername = normalizeUsername(friend?.username);
            const matchesUid = !!friendUid && friendUid === uid;
            const matchesUsername =
              !!normalizedDeletedUsername &&
              friendUsername === normalizedDeletedUsername;

            return !(matchesUid || matchesUsername);
          });

          if (filteredFriends.length !== existingFriends.length) {
            await updateDoc(doc(db, "users", snapshotDoc.id), {
              friends: filteredFriends,
            });
          }
        }),
      );
    }

    // Handle Firebase Auth user deletion
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === uid) {
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
      await fetch(
        `https://accounts.google.com/o/oauth2/revoke?token=${token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

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
    }

    // Clear local storage
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    });

    // Send success message
    chrome.runtime.sendMessage({
      type: "DELETE_ACCOUNT_COMPLETE",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    chrome.runtime.sendMessage({
      type: "DELETE_ACCOUNT_ERROR",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
    throw error; // Re-throw error for handling by caller
  }
}
