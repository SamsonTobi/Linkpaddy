import { db } from "../firebase";
import { doc, getDoc, getDocFromServer, updateDoc } from "firebase/firestore";
import {
  showFriendNotification,
  showLinkNotification,
  showFriendRequestNotification,
  showFriendAcceptedNotification,
  showFriendRequestReminderNotification,
} from "./notifications";
import { Friend, SharedLink } from "./types";
import { getFriendProfile, resolveFriendRefByUsername } from "./friends";
import {
  MAX_STORED_RECEIVED_LINKS,
  MAX_STORED_SHARED_LINKS,
  ensureRecipientStatuses,
  trimNewest,
  updateRecipientStatus,
} from "../shared/content";
import { serializeStatusWrite } from "./links";
import {
  BackgroundAuthNotReadyError,
  requireMatchingAuthUser,
} from "./authState";

let syncInProgress = false;
let syncQueued = false;

async function getUserSnapshot(userRef: ReturnType<typeof doc>) {
  try {
    return { snap: await getDocFromServer(userRef), fromServer: true };
  } catch (error) {
    console.warn("Falling back to cached Firestore doc read:", error);
    return { snap: await getDoc(userRef), fromServer: false };
  }
}

async function enrichLegacyRecipientData(
  currentUser: any,
  userRef: ReturnType<typeof doc>,
  receivedLinks: SharedLink[],
): Promise<{ links: SharedLink[]; changed: boolean }> {
  let changed = false;
  const links = await Promise.all(
    receivedLinks.map(async (receivedLink) => {
      if (receivedLink.kind || receivedLink.recipients?.length || receivedLink.recipientProfiles?.length) {
        return receivedLink;
      }

      try {
        const senderRef = await resolveFriendRefByUsername(receivedLink.sender);
        if (!senderRef) return receivedLink;
        const senderSnapshot = (await getUserSnapshot(senderRef.ref)).snap;
        const senderData = senderSnapshot.data() || {};
        const senderLink = (senderData.sharedLinks || []).find(
          (item: SharedLink) => item.id === receivedLink.id,
        );
        if (!senderLink?.recipients?.length) return receivedLink;

        const senderFriends = Array.isArray(senderData.friends) ? senderData.friends : [];
        const recipientProfiles = senderLink.recipients.map((username: string) => {
          const friend = senderFriends.find(
            (candidate: any) => String(candidate.username || "").toLowerCase() === username.toLowerCase(),
          );
          const profile: Record<string, string> = {
            username,
            displayName: friend?.displayName || username,
            photoURL: friend?.photoURL || "",
          };
          if (typeof friend?.uid === "string" && friend.uid) profile.uid = friend.uid;
          if (typeof friend?.joinedAt === "string" && friend.joinedAt) profile.joinedAt = friend.joinedAt;
          return profile;
        });

        changed = true;
        return {
          ...receivedLink,
          recipients: senderLink.recipients,
          recipientProfiles,
          recipientStatuses: senderLink.recipientStatuses || recipientProfiles.map((profile: any) => ({ ...profile, status: "unseen" })),
        };
      } catch (error) {
        console.warn("Could not enrich legacy recipient data:", receivedLink.id, error);
        return receivedLink;
      }
    }),
  );

  if (changed) {
    await updateDoc(userRef, { receivedLinks: links });
    await chrome.storage.local.set({ user: { ...currentUser, receivedLinks: links } });
  }

  return { links, changed };
}

const SEEN_HEAL_THROTTLE_MS = 60 * 60 * 1000;

/**
 * Seed recipientStatuses on sent links created before that field existed,
 * so the sender's recipient sheet can list every recipient instead of
 * falling back to a permanently "Not seen" aggregate.
 */
async function backfillSharedRecipientStatuses(
  userRef: ReturnType<typeof doc>,
  sharedLinks: SharedLink[],
): Promise<SharedLink[]> {
  let changed = false;
  const links = sharedLinks.map((link) => {
    if (
      (!link.recipientStatuses || link.recipientStatuses.length === 0) &&
      ((link.recipients || []).length > 0 || (link.recipientProfiles || []).length > 0)
    ) {
      changed = true;
      return { ...link, recipientStatuses: ensureRecipientStatuses(link) };
    }
    return link;
  });

  if (changed) {
    await updateDoc(userRef, { sharedLinks: links });
  }
  return links;
}

/**
 * One-way heal for recipient sheets stuck on "Not seen": for links this
 * device already marked seen/opened, push that status into the sender's
 * sharedLinks copy. Runs at most once an hour so a normal sync stays cheap.
 */
async function maybePushSeenStatusesToSenders(
  currentUser: any,
  receivedLinks: SharedLink[],
): Promise<void> {
  try {
    const { lastSeenHealAt } = await chrome.storage.local.get(["lastSeenHealAt"]);
    if (lastSeenHealAt && Date.now() - lastSeenHealAt < SEEN_HEAL_THROTTLE_MS) return;
    await chrome.storage.local.set({ lastSeenHealAt: Date.now() });
  } catch {
    // Storage unavailable — still attempt the heal once.
  }

  const seenLinks = receivedLinks.filter(
    (link) =>
      (link.status === "seen" || link.status === "opened") &&
      (!link.kind || (link.kind !== "friend_added" && !link.kind.startsWith("friend_request_") && link.kind !== "friend_removed")),
  );
  if (seenLinks.length === 0) return;

  const ownProfile = {
    uid: currentUser?.uid,
    username: currentUser?.username,
    displayName: currentUser?.displayName,
    photoURL: currentUser?.photoURL,
    joinedAt: currentUser?.joinedAt,
  };

  const bySender = new Map<string, { uid: string; username: string; links: SharedLink[] }>();
  for (const link of seenLinks) {
    const uid = typeof (link as any).senderUid === "string" ? (link as any).senderUid.trim() : "";
    const username = typeof link.sender === "string" ? link.sender.trim().replace(/^@/, "").toLowerCase() : "";
    const key = uid ? `uid:${uid}` : username ? `username:${username}` : "";
    if (!key) continue;
    const group = bySender.get(key) || { uid, username, links: [] as SharedLink[] };
    group.links.push(link);
    bySender.set(key, group);
  }

  const now = new Date().toISOString();
  for (const group of bySender.values()) {
    try {
      // Read and rewrite the sender doc inside the shared serializer so a
      // concurrent status update can't interleave and drop entries.
      await serializeStatusWrite(async () => {
        const senderRef = group.uid
          ? doc(db, "users", group.uid)
          : (await resolveFriendRefByUsername(group.username))?.ref;
        if (!senderRef) return;
        const senderSnap = await getDoc(senderRef);
        if (!senderSnap.exists()) return;
        const sharedLinks = ((senderSnap.data()?.sharedLinks || []) as SharedLink[]);
        let changed = false;
        const next = sharedLinks.map((item) => {
          const mine = group.links.find((link) => link.id === item.id);
          if (!mine) return item;
          const seeded = ensureRecipientStatuses(item);
          const updated = updateRecipientStatus(seeded, ownProfile as any, mine.status as "seen" | "opened", now);
          if (JSON.stringify(updated) !== JSON.stringify(seeded)) {
            changed = true;
            return { ...item, recipientStatuses: updated };
          }
          return item;
        });
        if (changed) {
          await updateDoc(senderRef, { sharedLinks: next });
        }
      });
    } catch (error) {
      console.warn("Seen-status heal blocked for sender:", group.username || group.uid, error);
    }
  }
}

async function runLinksSync() {
  const result = await chrome.storage.local.get(["user"]);
  if (!result.user || !result.user.uid) return;

  await requireMatchingAuthUser(result.user.uid);

  const userRef = doc(db, "users", result.user.uid);
  const { snap: userSnap, fromServer } = await getUserSnapshot(userRef);

  if (!userSnap.exists()) {
    if (fromServer) {
      // The server confirms this account is gone (deleted elsewhere) —
      // the only case where dropping the local session is correct.
      // Offline cache misses must never log the user out.
      await chrome.storage.local.remove("user");
      try {
        chrome.runtime.sendMessage({ type: "SIGN_OUT_FORCED" });
      } catch {
        // Popup might not be open — it reads storage on open anyway.
      }
    }
    return;
  }

  const userData = userSnap.data();
  const oldReceivedLinks: SharedLink[] = result.user.receivedLinks || [];
  const enrichedReceived = await enrichLegacyRecipientData(
    result.user,
    userRef,
    (userData.receivedLinks || []) as SharedLink[],
  );
  const newReceivedLinks: SharedLink[] = enrichedReceived.links;
  const oldFriends: Friend[] = result.user.friends || [];
  const newFriends: Friend[] = userData.friends || [];
  const oldNotificationIds = new Set((result.user.activityNotifications || []).map((notification: any) => notification.id));
  const newActivityNotifications = (userData.activityNotifications || []).filter((notification: any) => !oldNotificationIds.has(notification.id));

  // Find truly new links by comparing IDs
  const oldLinkIds = new Set(oldReceivedLinks.map((l) => l.id));
  const brandNewLinks = newReceivedLinks.filter(
    (l) => !oldLinkIds.has(l.id) && l.status === "unseen",
  );

  const oldFriendKeys = new Set(
    oldFriends
      .filter((f) => f !== null && f !== undefined)
      .map((f) => f.uid || f.username)
      .filter((key): key is string => !!key),
  );
  const oldFriendStatusByIdentity = new Map<string, Friend["status"]>();
  oldFriends.forEach((friend) => {
    if (!friend) return;
    const keys = [friend.uid, friend.username?.toLowerCase()].filter(
      (key): key is string => !!key,
    );
    keys.forEach((key) => oldFriendStatusByIdentity.set(key, friend.status));
  });

  const brandNewFriends = newFriends.filter((f) => {
    if (!f) return false;
    const key = f.uid || f.username;
    return !!key && !oldFriendKeys.has(key);
  });
  const newReceivedRequestFriends = newFriends.filter((friend) => {
    if (!friend || friend.status !== "request_received") return false;

    const keys = [friend.uid, friend.username?.toLowerCase()].filter(
      (key): key is string => !!key,
    );

    return keys.every(
      (key) => oldFriendStatusByIdentity.get(key) !== "request_received",
    );
  });

  const brandNewShareLinks = brandNewLinks.filter(
    (link) => !link.kind || (link.kind !== "friend_added" && !link.kind.startsWith("friend_request_")),
  );
  const brandNewFriendEvents = brandNewLinks.filter(
    (link) => link.kind === "friend_added",
  );
  const brandNewRequests = brandNewLinks.filter(
    (link) => link.kind === "friend_request_received",
  );
  const brandNewAccepts = brandNewLinks.filter(
    (link) => link.kind === "friend_request_accepted",
  );
  const brandNewRejects = brandNewLinks.filter(
    (link) => link.kind === "friend_request_rejected",
  );
  const brandNewRemovals = brandNewLinks.filter(
    (link) => link.kind === "friend_removed",
  );

  // Show a notification for each new shared link received
  for (const newLink of brandNewShareLinks) {
    showLinkNotification(newLink);
  }
  for (const notification of newActivityNotifications) {
    if (notification.type === "link_liked") {
      chrome.notifications.create(notification.id, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: `${notification.actorFirstName || notification.actorUsername} liked your link`,
        message: "Open LinkPaddy to see the activity.",
        priority: 1,
      });
    }
  }

  // Friend-added events should notify once, then be marked seen.
  for (const friendEvent of brandNewFriendEvents) {
    showFriendNotification({ username: friendEvent.sender });
  }

  const notifiedRequestSenders = new Set<string>();

  for (const newFriend of brandNewFriends) {
    if (!newFriend) continue;
    if (newFriend.status === "request_received") {
      const sender = (newFriend.username || newFriend.uid || "").toLowerCase();
      if (sender) {
        notifiedRequestSenders.add(sender);
      }
      showFriendRequestNotification(newFriend.username || "Someone");
    } else {
      showFriendNotification(newFriend);
    }
  }

  for (const requestFriend of newReceivedRequestFriends) {
    if (!requestFriend) continue;
    const sender = (requestFriend.username || requestFriend.uid || "").toLowerCase();
    if (!sender || notifiedRequestSenders.has(sender)) continue;
    notifiedRequestSenders.add(sender);
    showFriendRequestNotification(requestFriend.username || "Someone");
  }

  let friendsListUpdated = false;
  let currentFriends = [...newFriends];

  for (const request of brandNewRequests) {
    const sender = request.sender;
    if (!sender) continue;

    if (!notifiedRequestSenders.has(sender.toLowerCase())) {
      showFriendRequestNotification(sender);
      notifiedRequestSenders.add(sender.toLowerCase());
    }

    const senderKey = sender.toLowerCase();
    const requestProfile =
      request.senderProfile ||
      (await (async () => {
        try {
          console.log(
            "senderProfile is missing from request payload; falling back to network profile query...",
          );
          const resolved = await getFriendProfile(sender);
          return resolved
            ? {
                uid: resolved.uid,
                displayName: resolved.displayName,
                photoURL: resolved.photoURL,
                email: resolved.email,
              }
            : null;
        } catch (err) {
          console.error(
            "Failed to resolve profile for friend request sender:",
            sender,
            err,
          );
          return null;
        }
      })());

    const existingIndex = currentFriends.findIndex(
      (f) => (f.username || "").toLowerCase() === senderKey,
    );

    if (existingIndex >= 0) {
      const existingFriend = currentFriends[existingIndex];
      if (existingFriend.status !== "accepted") {
        const nextFriend: Friend = {
          ...existingFriend,
          displayName:
            existingFriend.displayName || requestProfile?.displayName || "",
          email: existingFriend.email || requestProfile?.email || "",
          photoURL: existingFriend.photoURL || requestProfile?.photoURL || "",
          status: "request_received",
        };
        const uid = existingFriend.uid || requestProfile?.uid;
        if (uid) {
          nextFriend.uid = uid;
        }
        currentFriends[existingIndex] = nextFriend;
        friendsListUpdated = true;
      }
    } else if (requestProfile) {
      currentFriends.push({
        uid: requestProfile.uid,
        username: senderKey,
        displayName: requestProfile.displayName || "",
        email: requestProfile.email || "",
        photoURL: requestProfile.photoURL || "",
        addedAt: new Date().toISOString(),
        status: "request_received",
      });
      friendsListUpdated = true;
    }
  }

  for (const accept of brandNewAccepts) {
    const sender = accept.sender;
    if (!sender) continue;

    showFriendAcceptedNotification(sender);

    currentFriends = currentFriends.map((f) => {
      if ((f.username || "").toLowerCase() === sender.toLowerCase()) {
        friendsListUpdated = true;
        return { ...f, status: "accepted" as const };
      }
      return f;
    });
  }

  for (const reject of brandNewRejects) {
    const sender = reject.sender;
    if (!sender) continue;

    const beforeCount = currentFriends.length;
    currentFriends = currentFriends.filter(
      (f) => (f.username || "").toLowerCase() !== sender.toLowerCase()
    );
    if (currentFriends.length !== beforeCount) {
      friendsListUpdated = true;
    }
  }

  for (const removal of brandNewRemovals) {
    const sender = removal.sender;
    if (!sender) continue;

    const beforeCount = currentFriends.length;
    currentFriends = currentFriends.filter(
      (f) => (f.username || "").toLowerCase() !== sender.toLowerCase()
    );
    if (currentFriends.length !== beforeCount) {
      friendsListUpdated = true;
    }
  }

  if (friendsListUpdated) {
    await updateDoc(userRef, { friends: currentFriends });
  }

  // Reminder notification for pending requests
  const pendingCount = currentFriends.filter((f) => f.status === "request_received").length;
  if (pendingCount > 0) {
    const reminderResult = await chrome.storage.local.get(["lastRequestReminderAt"]);
    const lastReminder = reminderResult.lastRequestReminderAt || 0;
    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    if (now - lastReminder >= twentyFourHoursMs) {
      showFriendRequestReminderNotification(pendingCount);
      await chrome.storage.local.set({ lastRequestReminderAt: now });
    }
  }

  // Remove friend-request/friend-added signals from receivedLinks after processing
  const normalizedReceivedLinks = newReceivedLinks.filter((link) => {
    return !link.kind || (link.kind !== "friend_added" && !link.kind.startsWith("friend_request_") && link.kind !== "friend_removed");
  });

  // Cap history so every read/write stays constant-time and docs stay far
  // from the 1MB Firestore limit (arrays are append-ordered, oldest first).
  const trimmedReceivedLinks = trimNewest(normalizedReceivedLinks, MAX_STORED_RECEIVED_LINKS);
  const receivedTrimmed = trimmedReceivedLinks.length !== normalizedReceivedLinks.length;

  const signalsWereRemoved = receivedTrimmed || normalizedReceivedLinks.length !== newReceivedLinks.length;

  if (signalsWereRemoved) {
    await updateDoc(userRef, { receivedLinks: trimmedReceivedLinks });
  }

  const latestResult = await chrome.storage.local.get(["user"]);
  const latestUser = latestResult.user || result.user;
  const isNewUser =
    latestUser.isNewUser === false || userData.isNewUser === false
      ? false
      : !!(userData.isNewUser ?? latestUser.isNewUser);

  const backfilledSharedLinks = await backfillSharedRecipientStatuses(
    userRef,
    (userData.sharedLinks || []) as SharedLink[],
  );
  const sharedLinks = trimNewest(backfilledSharedLinks, MAX_STORED_SHARED_LINKS);
  if (sharedLinks.length !== backfilledSharedLinks.length) {
    await updateDoc(userRef, { sharedLinks });
  }

  // Heal sender sheets stuck on "Not seen" for links already viewed here.
  // Best-effort and throttled; never blocks the local sync.
  void maybePushSeenStatusesToSenders(latestUser, trimmedReceivedLinks).catch((error) => {
    console.warn("Seen-status heal failed:", error);
  });

  const updatedUser = {
    ...latestUser,
    receivedLinks: trimmedReceivedLinks,
    sharedLinks,
    friends: currentFriends,
    isNewUser,
    activityNotifications: userData.activityNotifications || [],
  };
  await chrome.storage.local.set({ user: updatedUser });
}

export async function updateBadge() {
  try {
    const result = await chrome.storage.local.get(["user"]);
    if (result.user && result.user.receivedLinks) {
      const unseenCount = result.user.receivedLinks.filter(
        (link: any) =>
          link.status === "unseen" &&
          link.kind !== "friend_added" &&
          (!link.kind || !link.kind.startsWith("friend_request_")),
      ).length;
      if (unseenCount > 0) {
        chrome.action.setBadgeText({ text: unseenCount.toString() });
        chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
      } else {
        chrome.action.setBadgeText({ text: "" });
      }
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } catch (error) {
    console.error("Error updating badge:", error);
  }
}

export async function checkForNewLinks() {
  if (syncInProgress) {
    syncQueued = true;
    return;
  }

  syncInProgress = true;
  try {
    do {
      syncQueued = false;
      await runLinksSync();
    } while (syncQueued);
    await chrome.storage.local.remove("syncError");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await chrome.storage.local.set({ syncError: `${new Date().toISOString()}: ${errorMsg}` });

    if (error instanceof BackgroundAuthNotReadyError) {
      console.warn("Skipping link sync until Firebase auth is ready:", error.message);
      return;
    }
    console.error("Error checking for new links:", error);
  } finally {
    syncInProgress = false;
  }
}
