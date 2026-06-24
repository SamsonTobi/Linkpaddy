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
  limit,
  orderBy,
} from "firebase/firestore";
import { requireMatchingAuthUser } from "./authState";

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

      // Auto-add founder as the new user's first friend
      const autoFriends: any[] = [];
      try {
        // Try by username first, fall back to email in case username changes
        let founderSnapshot = await getDocs(
          query(collection(db, "users"), where("username", "==", "samsontobie")),
        );

        if (founderSnapshot.empty) {
          founderSnapshot = await getDocs(
            query(collection(db, "users"), where("email", "==", "samsonadebowale890@gmail.com")),
          );
        }

        if (!founderSnapshot.empty) {
          const founderDoc = founderSnapshot.docs[0];
          const founderData = founderDoc.data();
          const founderUid = founderDoc.id;
          const founderUsername =
            typeof founderData.username === "string" ? founderData.username : "samsontobie";
          const now = new Date().toISOString();

          autoFriends.push({
            uid: founderUid,
            username: founderUsername,
            displayName:
              typeof founderData.displayName === "string"
                ? founderData.displayName
                : "",
            email:
              typeof founderData.email === "string" ? founderData.email : "",
            photoURL:
              typeof founderData.photoURL === "string"
                ? founderData.photoURL
                : "",
            addedAt: now,
            status: "auto",
          });

          // Add the new user to the founder's friends list
          const rawFounderFriends = Array.isArray(founderData.friends)
            ? founderData.friends
            : [];
          rawFounderFriends.push({
            uid: user.uid,
            username,
            displayName: user.displayName || "",
            email: user.email || "",
            photoURL: user.photoURL || "",
            addedAt: now,
            status: "auto",
          });
          await updateDoc(doc(db, "users", founderUid), {
            friends: rawFounderFriends,
          });
        }
      } catch (e) {
        console.warn("Failed to auto-add founder friend:", e);
      }

      userData = {
        uid: user.uid,
        email: user.email,
        username: username,
        displayName: user.displayName,
        photoURL: user.photoURL,
        friends: autoFriends,
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

export async function searchUserInternal(searchTerm: string) {
  const normalizedSearchTerm = searchTerm.trim().replace(/^@/, "").toLowerCase();
  if (!normalizedSearchTerm) return { success: false, error: "Invalid search term" };

  try {
    await requireMatchingAuthUser();

    // Prefix match: find usernames that start with the typed term
    const q = query(
      collection(db, "users"),
      where("username", ">=", normalizedSearchTerm),
      where("username", "<", normalizedSearchTerm + "\uf8ff"),
      orderBy("username"),
      limit(10),
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: false, error: "User not found" };
    }

    // Return all prefix-matching results
    const users = querySnapshot.docs.map((userDoc) => {
      const userData = userDoc.data();
      return {
        uid: userDoc.id,
        username: userData.username,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
      };
    });

    return { success: true, users };
  } catch (error) {
    console.error("Error searching user:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function updateSettingsInternal(uid: string, settings: any) {
  try {
    await requireMatchingAuthUser(uid);

    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { settings });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update settings" };
  }
}

export async function completeOnboardingInternal(uid: string) {
  try {
    await requireMatchingAuthUser(uid);

    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { isNewUser: false });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to complete onboarding" };
  }
}

export async function updateUsernameInternal(uid: string, nextUsername: string) {
  try {
    await requireMatchingAuthUser(uid);

    const existing = await getDocs(
      query(collection(db, "users"), where("username", "==", nextUsername)),
    );
    if (!existing.empty) {
      return { success: false, error: "Username already taken" };
    }

    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { success: false, error: "User not found" };
    }

    const userData = userSnap.data();
    const oldUsername = normalizeUsername(userData.username);
    const latestDisplayName = typeof userData.displayName === "string" ? userData.displayName : "";
    const latestPhotoURL = typeof userData.photoURL === "string" ? userData.photoURL : "";

    // Update the user's own doc with the new username
    await updateDoc(userRef, { username: nextUsername });

    // Fire-and-forget: propagate to every user who references this uid
    // in their friends array, receivedLinks sender fields, or sharedLinks recipients.
    void (async () => {
      try {
        const allUsersSnapshot = await getDocs(collection(db, "users"));

        allUsersSnapshot.docs.forEach(async (snapshotDoc) => {
          if (snapshotDoc.id === uid) return;

          const data = snapshotDoc.data();
          const targetRef = doc(db, "users", snapshotDoc.id);
          const rawFriends: any[] = Array.isArray(data.friends) ? data.friends : [];
          const rawReceived: any[] = Array.isArray(data.receivedLinks) ? data.receivedLinks : [];
          const rawShared: any[] = Array.isArray(data.sharedLinks) ? data.sharedLinks : [];

          let needsUpdate = false;

          const nextFriends = rawFriends.map((f: any) => {
            const fUid = typeof f.uid === "string" ? f.uid.trim() : "";
            if (fUid !== uid) return f;
            needsUpdate = true;
            return {
              ...f,
              username: nextUsername,
              displayName: latestDisplayName || f.displayName || "",
              photoURL: latestPhotoURL || f.photoURL || "",
            };
          });

          const nextReceived = rawReceived.map((link: any) => {
            if (typeof link.sender === "string" && normalizeUsername(link.sender) === oldUsername) {
              needsUpdate = true;
              return { ...link, sender: nextUsername };
            }
            return link;
          });

          const nextShared = rawShared.map((link: any) => {
            if (!Array.isArray(link.recipients)) return link;
            const idx = link.recipients.findIndex(
              (r: string) => normalizeUsername(r) === oldUsername,
            );
            if (idx < 0) return link;
            needsUpdate = true;
            const newRecipients = [...link.recipients];
            newRecipients[idx] = nextUsername;
            return { ...link, recipients: newRecipients };
          });

          if (needsUpdate) {
            await updateDoc(targetRef, {
              ...(nextFriends.some((f, i) => f !== rawFriends[i]) ? { friends: nextFriends } : {}),
              ...(nextReceived.some((l, i) => l !== rawReceived[i]) ? { receivedLinks: nextReceived } : {}),
              ...(nextShared.some((l, i) => l !== rawShared[i]) ? { sharedLinks: nextShared } : {}),
            }).catch((e) => {
              console.warn(
                `Skipped username propagation to ${snapshotDoc.id} (permission denied or doc changed):`,
                e,
              );
            });
          }
        });
      } catch (propagationError) {
        console.warn("Username propagation sweep failed:", propagationError);
      }
    })();

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update username",
    };
  }
}
