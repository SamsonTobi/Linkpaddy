import { auth, db } from "../firebase";
import { signOut as firebaseSignOut } from "firebase/auth/web-extension";
import type { User } from "firebase/auth/web-extension";
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

/** Map low-level network failures to copy the login screen can show. */
function friendlySignInError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error occurred";
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return "Couldn't reach Google — check your connection and try again";
  }
  return message;
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

/** The signed-in Firebase user, reduced to what profile creation reads. */
export interface SignedInUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/** Everything that differs between the extension and the web app. */
export interface AccountPlatform {
  /** Interactive Google sign-in; resolves with the signed-in Firebase user. */
  signIn(): Promise<SignedInUser>;
  /** Runs before any data is deleted, so a cancelled prompt leaves the account intact. */
  beforeDeleteAccount(): Promise<void>;
  /** Removes the Firebase Auth user once its data is gone. */
  deleteIdentity(user: User): Promise<void>;
}

export async function signIn(platform: AccountPlatform) {
  await completeSignIn(platform.signIn());
}

/** Finishes a sign-in that is still pending, reporting the outcome to the UI. */
export async function completeSignIn(pendingUser: Promise<SignedInUser>) {
  try {
    await saveSignedInUser(await pendingUser);
  } catch (error) {
    console.error("Sign-in error:", error);
    chrome.runtime.sendMessage({
      type: "SIGN_IN_ERROR",
      error: friendlySignInError(error),
    });
  }
}

async function saveSignedInUser(user: SignedInUser) {
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
      joinedAt: new Date().toISOString(),
      usernameLowercase: username,
      settings: { sharingReminders: true },
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

export async function deleteUser(uid: string, platform: AccountPlatform) {
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

    await platform.beforeDeleteAccount();

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
      await platform.deleteIdentity(currentUser);
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
    const currentAuthUser = await requireMatchingAuthUser();

    const end = `${normalizedSearchTerm}\uf8ff`;
    const q = query(
      collection(db, "users"),
      where("username", ">=", normalizedSearchTerm),
      where("username", "<=", end),
      orderBy("username"),
      limit(10),
    );
    const querySnapshot = await getDocs(q);

    // Filter to users whose username or display name starts with the search term, excluding self
    const matchingUsers = querySnapshot.docs
      .filter((doc) => {
        if (doc.id === currentAuthUser.uid) return false;
        const data = doc.data();
        const username = (data.usernameLowercase || data.username || "").toLowerCase();
        return username.startsWith(normalizedSearchTerm);
      })
      .slice(0, 10);

    if (matchingUsers.length === 0) {
      return { success: false, error: "User not found" };
    }

    const users = matchingUsers.map((userDoc) => {
      const userData = userDoc.data();
      return {
        uid: userDoc.id,
        username: userData.username,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        email: userData.email,
        joinedAt: userData.joinedAt,
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

          // Refresh denormalized profile copies keyed by uid (usernames are
          // mutable; uid is stable). Without this, recipient sheets keep the
          // old username and the next view appends a ghost duplicate entry.
          const refreshProfiles = (entries: any) => {
            if (!Array.isArray(entries)) return entries;
            let changed = false;
            const next = entries.map((person: any) => {
              const personUid = typeof person?.uid === "string" ? person.uid.trim() : "";
              if (personUid !== uid || normalizeUsername(person?.username) === nextUsername) return person;
              changed = true;
              return {
                ...person,
                username: nextUsername,
                displayName: latestDisplayName || person.displayName || "",
                photoURL: latestPhotoURL || person.photoURL || "",
              };
            });
            if (!changed) return entries;
            needsUpdate = true;
            return next;
          };

          const refreshLinkProfiles = (link: any) => {
            const nextStatuses = refreshProfiles(link.recipientStatuses);
            const nextProfiles = refreshProfiles(link.recipientProfiles);
            if (nextStatuses === link.recipientStatuses && nextProfiles === link.recipientProfiles) return link;
            return { ...link, recipientStatuses: nextStatuses, recipientProfiles: nextProfiles };
          };

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
            const withProfiles = refreshLinkProfiles(link);
            if (typeof withProfiles.sender === "string" && normalizeUsername(withProfiles.sender) === oldUsername) {
              needsUpdate = true;
              return { ...withProfiles, sender: nextUsername };
            }
            return withProfiles;
          });

          const nextShared = rawShared.map((link: any) => {
            const withProfiles = refreshLinkProfiles(link);
            if (!Array.isArray(withProfiles.recipients)) return withProfiles;
            const idx = withProfiles.recipients.findIndex(
              (r: string) => normalizeUsername(r) === oldUsername,
            );
            if (idx < 0) return withProfiles;
            needsUpdate = true;
            const newRecipients = [...withProfiles.recipients];
            newRecipients[idx] = nextUsername;
            return { ...withProfiles, recipients: newRecipients };
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
