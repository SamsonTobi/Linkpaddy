import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { requireMatchingAuthUser } from "./authState";
import { Friend } from "./types";

function normalizeUsername(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^@/, "").toLowerCase();
}

function friendIdentityKey(friend: Partial<Friend> | null | undefined): string {
  const uid = typeof friend?.uid === "string" ? friend.uid.trim() : "";
  if (uid) {
    return `uid:${uid}`;
  }
  const username = normalizeUsername(friend?.username);
  return username ? `username:${username}` : "";
}

function sanitizeFriend(friend: Friend): Friend | null {
  const uid = typeof friend?.uid === "string" ? friend.uid.trim() : "";
  const username = normalizeUsername(friend?.username);
  if (!uid && !username) return null;
  return {
    ...(uid ? { uid } : {}),
    ...(username ? { username } : {}),
    displayName: typeof friend?.displayName === "string" ? friend.displayName : "",
    email: typeof friend?.email === "string" ? friend.email : "",
    photoURL: typeof friend?.photoURL === "string" ? friend.photoURL : "",
    addedAt: typeof friend?.addedAt === "string" && friend.addedAt ? friend.addedAt : new Date().toISOString(),
    ...(friend.status ? { status: friend.status } : {}),
  };
}

function mergeFriend(existing: Friend, incoming: Friend): Friend {
  return {
    displayName: incoming.displayName || existing.displayName || "",
    email: incoming.email || existing.email || "",
    photoURL: incoming.photoURL || existing.photoURL || "",
    addedAt: existing.addedAt || incoming.addedAt || new Date().toISOString(),
    uid: incoming.uid || existing.uid,
    username: incoming.username || existing.username,
    status: incoming.status || existing.status,
  };
}

function dedupeFriends(friends: Friend[]): Friend[] {
  const byIdentity = new Map<string, Friend>();
  for (const friend of friends) {
    const sanitized = sanitizeFriend(friend);
    if (!sanitized) continue;
    const key = friendIdentityKey(sanitized);
    const existing = byIdentity.get(key);
    byIdentity.set(key, existing ? mergeFriend(existing, sanitized) : sanitized);
  }
  return Array.from(byIdentity.values());
}

export async function refreshFriendProfiles(uid: string) {
  await requireMatchingAuthUser(uid);

  const { user: storedUser } = await new Promise<{ user?: any }>((resolve) => {
    chrome.storage.local.get(["user"], resolve);
  });

  if (!storedUser || !Array.isArray(storedUser.friends)) {
    return { success: true, updated: false, changes: [] };
  }

  const friends: Friend[] = storedUser.friends;
  const changes: { username: string; oldUsername?: string; oldDisplayName?: string; newDisplayName?: string }[] = [];

  const batchSize = 10;
  let updated = false;

  for (let i = 0; i < friends.length; i += batchSize) {
    const batch = friends.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (friend) => {
        const friendUid = typeof friend.uid === "string" ? friend.uid.trim() : "";
        if (!friendUid) return null;

        const friendDoc = await getDoc(doc(db, "users", friendUid));
        if (!friendDoc.exists()) return null;

        const data = friendDoc.data();
        const latestUsername = normalizeUsername(data.username);
        if (!latestUsername) return null;

        const currentFriendUsername = normalizeUsername(friend.username);
        const currentDisplayName = friend.displayName || "";
        const currentPhotoURL = friend.photoURL || "";
        const latestDisplayName = typeof data.displayName === "string" ? data.displayName : "";
        const latestPhotoURL = typeof data.photoURL === "string" ? data.photoURL : "";

        const usernameChanged = latestUsername !== currentFriendUsername;
        const displayNameChanged = latestDisplayName !== currentDisplayName;
        const photoChanged = latestPhotoURL !== currentPhotoURL;

        if (!usernameChanged && !displayNameChanged && !photoChanged) {
          return null;
        }

        return {
          friendUid,
          oldUsername: currentFriendUsername,
          newUsername: latestUsername,
          oldDisplayName: currentDisplayName,
          newDisplayName: latestDisplayName,
          newPhotoURL: latestPhotoURL,
          newEmail: typeof data.email === "string" ? data.email : "",
        };
      }),
    );

    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const change = result.value;

      const idx = friends.findIndex(
        (f) => (typeof f.uid === "string" ? f.uid.trim() : "") === change.friendUid,
      );
      if (idx === -1) continue;

      friends[idx] = {
        ...friends[idx],
        username: change.newUsername,
        displayName: change.newDisplayName || friends[idx].displayName,
        photoURL: change.newPhotoURL || friends[idx].photoURL,
        email: change.newEmail || friends[idx].email,
      };
      updated = true;

      changes.push({
        username: change.newUsername,
        oldUsername: change.oldUsername,
        oldDisplayName: change.oldDisplayName,
        newDisplayName: change.newDisplayName,
      });
    }
  }

  if (!updated) {
    return { success: true, updated: false, changes: [] };
  }

  const deduped = dedupeFriends(friends);

  const updatedUser = { ...storedUser, friends: deduped };
  await chrome.storage.local.set({ user: updatedUser });

  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { friends: deduped });
  } catch (error) {
    console.warn("Failed to persist friend profile updates to Firestore:", error);
  }

  return { success: true, updated: true, changes };
}
