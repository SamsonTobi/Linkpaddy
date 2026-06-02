import { db } from "../firebase";
import {
  doc,
  updateDoc,
  arrayUnion,
  query,
  collection,
  where,
  getDocs,
  getDoc,
  runTransaction,
} from "firebase/firestore";
import { Friend } from "./types";
import { requireMatchingAuthUser } from "./authState";

const addFriendInFlight = new Map<string, Promise<{ newFriend: Friend }>>();

function normalizeIdentifier(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^@/, "");
}

function normalizeUsername(value: unknown): string {
  return normalizeIdentifier(value).toLowerCase();
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
  const key = uid ? `uid:${uid}` : username ? `username:${username}` : "";

  if (!key) {
    return null;
  }

  const sanitized: Friend = {
    ...(uid ? { uid } : {}),
    ...(username ? { username } : {}),
    displayName:
      typeof friend?.displayName === "string" ? friend.displayName : "",
    email: typeof friend?.email === "string" ? friend.email : "",
    photoURL: typeof friend?.photoURL === "string" ? friend.photoURL : "",
    addedAt:
      typeof friend?.addedAt === "string" && friend.addedAt
        ? friend.addedAt
        : new Date().toISOString(),
  };

  if (friend.status) {
    sanitized.status = friend.status;
  }

  return sanitized;
}

function mergeFriend(existing: Friend, incoming: Friend): Friend {
  const merged: Friend = {
    displayName: incoming.displayName || existing.displayName || "",
    email: incoming.email || existing.email || "",
    photoURL: incoming.photoURL || existing.photoURL || "",
    addedAt: existing.addedAt || incoming.addedAt || new Date().toISOString(),
  };

  const uid = incoming.uid || existing.uid;
  const username = incoming.username || existing.username;
  const status = incoming.status || existing.status;

  if (uid) {
    merged.uid = uid;
  }
  if (username) {
    merged.username = username;
  }
  if (status) {
    merged.status = status;
  }

  return merged;
}

function dedupeFriends(friends: Friend[]): Friend[] {
  const byIdentity = new Map<string, Friend>();

  for (const friend of friends) {
    const sanitized = sanitizeFriend(friend);
    if (!sanitized) continue;

    const key = friendIdentityKey(sanitized);
    const existing = byIdentity.get(key);

    if (existing) {
      byIdentity.set(key, mergeFriend(existing, sanitized));
    } else {
      byIdentity.set(key, sanitized);
    }
  }

  return Array.from(byIdentity.values());
}

function buildCanonicalFriend(
  friendUid: string,
  friendData: Record<string, unknown>,
  addedAt: string,
  status?: "accepted" | "request_sent" | "request_received",
): Friend {
  const normalizedUsername = normalizeUsername(friendData.username);
  if (!normalizedUsername) {
    throw new Error("Friend account is missing a valid username");
  }

  return {
    uid: friendUid,
    username: normalizedUsername,
    displayName:
      typeof friendData.displayName === "string" ? friendData.displayName : "",
    email: typeof friendData.email === "string" ? friendData.email : "",
    photoURL:
      typeof friendData.photoURL === "string" ? friendData.photoURL : "",
    addedAt,
    status: status || "accepted",
  };
}

async function lookupFriendByIdentifier(normalizedIdentifier: string) {
  const usersCollection = collection(db, "users");
  const usernameCandidates = Array.from(
    new Set([normalizedIdentifier, normalizedIdentifier.toLowerCase()]),
  );

  for (const usernameCandidate of usernameCandidates) {
    const byUsername = await getDocs(
      query(usersCollection, where("username", "==", usernameCandidate)),
    );
    if (!byUsername.empty) {
      return byUsername.docs[0];
    }
  }

  if (!normalizedIdentifier.includes("@")) {
    return null;
  }

  const emailCandidates = Array.from(
    new Set([normalizedIdentifier, normalizedIdentifier.toLowerCase()]),
  );

  for (const emailCandidate of emailCandidates) {
    const byEmail = await getDocs(
      query(usersCollection, where("email", "==", emailCandidate)),
    );
    if (!byEmail.empty) {
      return byEmail.docs[0];
    }
  }

  return null;
}

async function resolveFriendCandidate(
  normalizedIdentifier: string,
  friendUid?: unknown,
) {
  const normalizedUid = typeof friendUid === "string" ? friendUid.trim() : "";

  if (normalizedUid) {
    const byUidRef = doc(db, "users", normalizedUid);
    const byUidDoc = await getDoc(byUidRef);

    if (byUidDoc.exists()) {
      return {
        id: byUidDoc.id,
        data: byUidDoc.data() as Record<string, unknown>,
      };
    }
  }

  const byIdentifierDoc = await lookupFriendByIdentifier(normalizedIdentifier);
  if (!byIdentifierDoc) {
    return null;
  }

  return {
    id: byIdentifierDoc.id,
    data: byIdentifierDoc.data() as Record<string, unknown>,
  };
}

export async function resolveFriendRefByUsername(friendUsername: string) {
  const normalizedUsername = normalizeUsername(friendUsername);
  if (!normalizedUsername) {
    return null;
  }

  const friendSnapshot = await getDocs(
    query(collection(db, "users"), where("username", "==", normalizedUsername)),
  );

  if (friendSnapshot.empty) {
    return null;
  }

  const friendDoc = friendSnapshot.docs[0];
  return {
    ref: doc(db, "users", friendDoc.id),
    uid: friendDoc.id,
    username: normalizedUsername,
  };
}

async function addFriendInternal(
  currentUser: {
    uid: string;
    username: string;
    displayName?: string;
    email?: string;
    photoURL?: string;
    friends?: Friend[];
  },
  normalizedIdentifier: string,
  friendUid?: unknown,
) {
  await requireMatchingAuthUser(currentUser.uid);

  const friendCandidate = await resolveFriendCandidate(
    normalizedIdentifier,
    friendUid,
  );

  if (!friendCandidate) {
    throw new Error("Friend not found");
  }

  if (friendCandidate.id === currentUser.uid) {
    throw new Error("You cannot add yourself as a friend");
  }

  const userRef = doc(db, "users", currentUser.uid);
  const friendRef = doc(db, "users", friendCandidate.id);
  const friendData = friendCandidate.data;
  const relationCreatedAt = new Date().toISOString();

  const transactionResult = await runTransaction(
    db,
    async (
      transaction,
    ): Promise<{ newFriend: Friend; alreadyExists: boolean }> => {
      const userDoc = await transaction.get(userRef);
      const friendDocSnap = await transaction.get(friendRef);
      if (!userDoc.exists()) {
        throw new Error("Current user not found");
      }
      if (!friendDocSnap.exists()) {
        throw new Error("Friend user not found");
      }

      const rawFriends = Array.isArray(userDoc.data().friends)
        ? (userDoc.data().friends as Friend[])
        : [];
      const normalizedFriends = dedupeFriends(rawFriends);

      const normalizedFriendUsername = normalizeUsername(friendData.username);
      const existingFriend = normalizedFriends.find((friend) => {
        const sameUid = !!friend.uid && friend.uid === friendCandidate.id;
        const sameUsername =
          !!normalizedFriendUsername &&
          normalizeUsername(friend.username) === normalizedFriendUsername;
        return sameUid || sameUsername;
      });

      const canonicalFriend = buildCanonicalFriend(
        friendCandidate.id,
        friendData,
        existingFriend?.addedAt || relationCreatedAt,
        existingFriend?.status || "request_sent",
      );

      const nextFriends = existingFriend
        ? dedupeFriends(
            normalizedFriends.map((friend) => {
              const sameIdentity =
                friendIdentityKey(friend) === friendIdentityKey(existingFriend);
              return sameIdentity
                ? mergeFriend(friend, canonicalFriend)
                : friend;
            }),
          )
        : dedupeFriends([...normalizedFriends, canonicalFriend]);

      transaction.update(userRef, { friends: nextFriends });

      if (!existingFriend) {
        const friendFriendsRaw = Array.isArray(friendDocSnap.data().friends)
          ? (friendDocSnap.data().friends as Friend[])
          : [];
        const normalizedCurrentUsername = normalizeUsername(currentUser.username);
        const alreadyInFriendList = friendFriendsRaw.some((f) => {
          const sameUid = !!f.uid && f.uid === currentUser.uid;
          const sameUsername =
            !!normalizedCurrentUsername &&
            normalizeUsername(f.username) === normalizedCurrentUsername;
          return sameUid || sameUsername;
        });

        if (!alreadyInFriendList) {
          const meAsFriend: Friend = {
            uid: currentUser.uid,
            username: normalizedCurrentUsername,
            displayName: currentUser.displayName || "",
            email: currentUser.email || "",
            photoURL: currentUser.photoURL || "",
            addedAt: relationCreatedAt,
            status: "request_received",
          };

          transaction.update(friendRef, {
            friends: dedupeFriends([...friendFriendsRaw, meAsFriend]),
          });
        }
      }

      return {
        newFriend: canonicalFriend,
        alreadyExists: !!existingFriend,
      };
    },
  );

  if (!transactionResult.alreadyExists) {
    // Notification write is non-blocking to keep add-friend responsive.
    void updateDoc(friendRef, {
      receivedLinks: arrayUnion({
        id: `friend-${Date.now()}`,
        link: "",
        sender: normalizeUsername(currentUser.username),
        timestamp: new Date().toISOString(),
        status: "unseen",
        kind: "friend_request_received",
        senderProfile: {
          uid: currentUser.uid,
          displayName: currentUser.displayName || "",
          photoURL: currentUser.photoURL || "",
          email: currentUser.email || "",
        },
      }),
    }).catch((friendNotificationError) => {
      console.warn(
        "Friend notification write blocked by Firestore rules:",
        friendNotificationError,
      );
    });
  }

  return { newFriend: transactionResult.newFriend };
}

export async function addFriend(
  currentUser: {
    uid: string;
    username: string;
    displayName?: string;
    email?: string;
    photoURL?: string;
    friends?: Friend[];
  },
  friendUsername: unknown,
  friendUid?: unknown,
) {
  const normalizedIdentifier = normalizeIdentifier(friendUsername);
  const normalizedUid = typeof friendUid === "string" ? friendUid.trim() : "";

  if (!normalizedIdentifier && !normalizedUid) {
    throw new Error("Please enter a valid username or email");
  }

  const inFlightIdentity = normalizedUid || normalizedIdentifier.toLowerCase();
  const inFlightKey = `${currentUser.uid}:${inFlightIdentity}`;
  const existingRequest = addFriendInFlight.get(inFlightKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = addFriendInternal(
    currentUser,
    normalizedIdentifier,
    friendUid,
  ).finally(() => {
    addFriendInFlight.delete(inFlightKey);
  });

  addFriendInFlight.set(inFlightKey, request);

  try {
    return await request;
  } catch (error) {
    console.error("Error adding friend:", error);
    throw error;
  }
}

export async function getFriendProfile(username: string) {
  const profile = await resolveFriendCandidate(username);
  if (!profile) return null;
  return {
    uid: profile.id,
    username: normalizeUsername(profile.data.username),
    displayName: typeof profile.data.displayName === "string" ? profile.data.displayName : "",
    email: typeof profile.data.email === "string" ? profile.data.email : "",
    photoURL: typeof profile.data.photoURL === "string" ? profile.data.photoURL : "",
  };
}

export async function acceptFriendInternal(
  currentUser: { uid: string; username: string },
  friendUsername: string,
) {
  await requireMatchingAuthUser(currentUser.uid);

  const normalizedFriendUsername = normalizeUsername(friendUsername);
  const friendRefInfo = await resolveFriendRefByUsername(normalizedFriendUsername);
  if (!friendRefInfo) {
    throw new Error("Friend not found");
  }

  const userRef = doc(db, "users", currentUser.uid);
  const friendRef = doc(db, "users", friendRefInfo.uid);

  const transactionResult = await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const friendDoc = await transaction.get(friendRef);
    if (!userDoc.exists()) {
      throw new Error("Current user not found");
    }
    if (!friendDoc.exists()) {
      throw new Error("Friend user not found");
    }

    // Update current user's friends
    const friends = Array.isArray(userDoc.data().friends)
      ? (userDoc.data().friends as Friend[])
      : [];

    const updatedFriends = friends.map((f) => {
      if (normalizeUsername(f.username) === normalizedFriendUsername) {
        return { ...f, status: "accepted" as const };
      }
      return f;
    });

    transaction.update(userRef, { friends: updatedFriends });

    const friendFriends = Array.isArray(friendDoc.data().friends)
      ? (friendDoc.data().friends as Friend[])
      : [];
    const normalizedCurrentUsername = normalizeUsername(currentUser.username);
    const updatedFriendFriends = friendFriends.map((f) => {
      const sameUid = !!f.uid && f.uid === currentUser.uid;
      const sameUsername =
        !!normalizedCurrentUsername &&
        normalizeUsername(f.username) === normalizedCurrentUsername;
      if (sameUid || sameUsername) {
        return { ...f, status: "accepted" as const };
      }
      return f;
    });
    transaction.update(friendRef, { friends: updatedFriendFriends });

    return updatedFriends;
  });

  chrome.storage.local.get(["user"], (result) => {
    if (result.user) {
      const updatedUser = {
        ...result.user,
        friends: transactionResult,
      };
      chrome.storage.local.set({ user: updatedUser });
    }
  });

  void updateDoc(friendRef, {
    receivedLinks: arrayUnion({
      id: `accept-${Date.now()}`,
      link: "",
      sender: normalizeUsername(currentUser.username),
      timestamp: new Date().toISOString(),
      status: "unseen",
      kind: "friend_request_accepted",
    }),
  }).catch((err) => {
    console.warn("Failed to notify friend of acceptance:", err);
  });
}

export async function rejectFriendInternal(
  currentUser: { uid: string; username: string },
  friendUsername: string,
) {
  await requireMatchingAuthUser(currentUser.uid);

  const normalizedFriendUsername = normalizeUsername(friendUsername);
  const friendRefInfo = await resolveFriendRefByUsername(normalizedFriendUsername);
  if (!friendRefInfo) {
    throw new Error("Friend not found");
  }

  const userRef = doc(db, "users", currentUser.uid);
  const friendRef = doc(db, "users", friendRefInfo.uid);

  const transactionResult = await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const friendDoc = await transaction.get(friendRef);
    if (!userDoc.exists()) {
      throw new Error("Current user not found");
    }
    if (!friendDoc.exists()) {
      throw new Error("Friend user not found");
    }

    // Remove from current user's friends
    const friends = Array.isArray(userDoc.data().friends)
      ? (userDoc.data().friends as Friend[])
      : [];

    const updatedFriends = friends.filter(
      (f) => normalizeUsername(f.username) !== normalizedFriendUsername,
    );

    transaction.update(userRef, { friends: updatedFriends });

    const friendFriends = Array.isArray(friendDoc.data().friends)
      ? (friendDoc.data().friends as Friend[])
      : [];
    const normalizedCurrentUsername = normalizeUsername(currentUser.username);
    const updatedFriendFriends = friendFriends.filter((f) => {
      const sameUid = !!f.uid && f.uid === currentUser.uid;
      const sameUsername =
        !!normalizedCurrentUsername &&
        normalizeUsername(f.username) === normalizedCurrentUsername;
      return !(sameUid || sameUsername);
    });
    transaction.update(friendRef, { friends: updatedFriendFriends });

    return updatedFriends;
  });

  chrome.storage.local.get(["user"], (result) => {
    if (result.user) {
      const updatedUser = {
        ...result.user,
        friends: transactionResult,
      };
      chrome.storage.local.set({ user: updatedUser });
    }
  });

  void updateDoc(friendRef, {
    receivedLinks: arrayUnion({
      id: `reject-${Date.now()}`,
      link: "",
      sender: normalizeUsername(currentUser.username),
      timestamp: new Date().toISOString(),
      status: "unseen",
      kind: "friend_request_rejected",
    }),
  }).catch((err) => {
    console.warn("Failed to notify friend of rejection:", err);
  });
}

export async function removeFriendInternal(
  currentUser: { uid: string; username: string },
  friendUsername: string,
) {
  await requireMatchingAuthUser(currentUser.uid);

  const normalizedFriendUsername = normalizeUsername(friendUsername);
  const friendRefInfo = await resolveFriendRefByUsername(normalizedFriendUsername);
  if (!friendRefInfo) {
    throw new Error("Friend not found");
  }

  const userRef = doc(db, "users", currentUser.uid);
  const friendRef = doc(db, "users", friendRefInfo.uid);

  const transactionResult = await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const friendDoc = await transaction.get(friendRef);
    if (!userDoc.exists()) {
      throw new Error("Current user not found");
    }
    if (!friendDoc.exists()) {
      throw new Error("Friend user not found");
    }

    // Remove from current user's friends
    const friends = Array.isArray(userDoc.data().friends)
      ? (userDoc.data().friends as Friend[])
      : [];

    const updatedFriends = friends.filter(
      (f) => normalizeUsername(f.username) !== normalizedFriendUsername,
    );

    transaction.update(userRef, { friends: updatedFriends });

    const friendFriends = Array.isArray(friendDoc.data().friends)
      ? (friendDoc.data().friends as Friend[])
      : [];
    const normalizedCurrentUsername = normalizeUsername(currentUser.username);
    const updatedFriendFriends = friendFriends.filter((f) => {
      const sameUid = !!f.uid && f.uid === currentUser.uid;
      const sameUsername =
        !!normalizedCurrentUsername &&
        normalizeUsername(f.username) === normalizedCurrentUsername;
      return !(sameUid || sameUsername);
    });
    transaction.update(friendRef, { friends: updatedFriendFriends });

    return updatedFriends;
  });

  chrome.storage.local.get(["user"], (result) => {
    if (result.user) {
      const updatedUser = {
        ...result.user,
        friends: transactionResult,
      };
      chrome.storage.local.set({ user: updatedUser });
    }
  });

  void updateDoc(friendRef, {
    receivedLinks: arrayUnion({
      id: `remove-${Date.now()}`,
      link: "",
      sender: normalizeUsername(currentUser.username),
      timestamp: new Date().toISOString(),
      status: "unseen",
      kind: "friend_removed",
    }),
  }).catch((err) => {
    console.warn("Failed to notify friend of removal:", err);
  });
}
