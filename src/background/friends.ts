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

  return {
    uid: uid || undefined,
    username: username || undefined,
    displayName:
      typeof friend?.displayName === "string" ? friend.displayName : "",
    email: typeof friend?.email === "string" ? friend.email : "",
    photoURL: typeof friend?.photoURL === "string" ? friend.photoURL : "",
    addedAt:
      typeof friend?.addedAt === "string" && friend.addedAt
        ? friend.addedAt
        : new Date().toISOString(),
  };
}

function mergeFriend(existing: Friend, incoming: Friend): Friend {
  return {
    uid: incoming.uid || existing.uid,
    username: incoming.username || existing.username,
    displayName: incoming.displayName || existing.displayName || "",
    email: incoming.email || existing.email || "",
    photoURL: incoming.photoURL || existing.photoURL || "",
    addedAt: existing.addedAt || incoming.addedAt || new Date().toISOString(),
  };
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
      if (!userDoc.exists()) {
        throw new Error("Current user not found");
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
        kind: "friend_added",
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
