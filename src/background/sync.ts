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
import { getFriendProfile } from "./friends";
import {
  BackgroundAuthNotReadyError,
  requireMatchingAuthUser,
} from "./authState";

let syncInProgress = false;
let syncQueued = false;

async function getUserSnapshot(userRef: ReturnType<typeof doc>) {
  try {
    return await getDocFromServer(userRef);
  } catch (error) {
    console.warn("Falling back to cached Firestore doc read:", error);
    return await getDoc(userRef);
  }
}

async function runLinksSync() {
  const result = await chrome.storage.local.get(["user"]);
  if (!result.user || !result.user.uid) return;

  await requireMatchingAuthUser(result.user.uid);

  const userRef = doc(db, "users", result.user.uid);
  const userSnap = await getUserSnapshot(userRef);

  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  const oldReceivedLinks: SharedLink[] = result.user.receivedLinks || [];
  const newReceivedLinks: SharedLink[] = userData.receivedLinks || [];
  const oldFriends: Friend[] = result.user.friends || [];
  const newFriends: Friend[] = userData.friends || [];

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

  const signalsWereRemoved = normalizedReceivedLinks.length !== newReceivedLinks.length;

  if (signalsWereRemoved) {
    await updateDoc(userRef, { receivedLinks: normalizedReceivedLinks });
  }

  const latestResult = await chrome.storage.local.get(["user"]);
  const latestUser = latestResult.user || result.user;
  const isNewUser =
    latestUser.isNewUser === false || userData.isNewUser === false
      ? false
      : !!(userData.isNewUser ?? latestUser.isNewUser);

  const updatedUser = {
    ...latestUser,
    receivedLinks: normalizedReceivedLinks,
    sharedLinks: userData.sharedLinks || [],
    friends: currentFriends,
    isNewUser,
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
