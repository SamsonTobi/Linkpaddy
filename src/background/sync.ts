import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { showFriendNotification, showLinkNotification } from "./notifications";
import { Friend, SharedLink } from "./types";

export async function updateBadge() {
  try {
    const result = await chrome.storage.local.get(["user"]);
    if (result.user && result.user.receivedLinks) {
      const unseenCount = result.user.receivedLinks.filter(
        (link: any) => link.status === "unseen" && link.kind !== "friend_added",
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
  try {
    const result = await chrome.storage.local.get(["user"]);
    if (!result.user || !result.user.uid) return;

    if (typeof (auth as any).authStateReady === "function") {
      await (auth as any).authStateReady();
    }

    if (!auth.currentUser || auth.currentUser.uid !== result.user.uid) {
      console.warn(
        "Auth state is not fully restored in background; attempting sync anyway",
      );
    }

    const userRef = doc(db, "users", result.user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
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
          .map((f) => f.uid || f.username)
          .filter((key): key is string => !!key),
      );
      const brandNewFriends = newFriends.filter((f) => {
        const key = f.uid || f.username;
        return !!key && !oldFriendKeys.has(key);
      });

      const brandNewShareLinks = brandNewLinks.filter(
        (link) => link.kind !== "friend_added",
      );
      const brandNewFriendEvents = brandNewLinks.filter(
        (link) => link.kind === "friend_added",
      );

      // Show a notification for each new shared link received
      for (const newLink of brandNewShareLinks) {
        showLinkNotification(newLink);
      }

      // Friend-added events should notify once, then be marked seen.
      for (const friendEvent of brandNewFriendEvents) {
        showFriendNotification({ username: friendEvent.sender });
      }

      for (const newFriend of brandNewFriends) {
        showFriendNotification(newFriend);
      }

      const normalizedReceivedLinks = newReceivedLinks.map((link) => {
        if (link.kind === "friend_added" && link.status === "unseen") {
          return { ...link, status: "seen" };
        }
        return link;
      });

      const shouldPersistSeenFriendEvents = normalizedReceivedLinks.some(
        (link, index) => link.status !== newReceivedLinks[index]?.status,
      );

      if (shouldPersistSeenFriendEvents) {
        await updateDoc(userRef, { receivedLinks: normalizedReceivedLinks });
      }

      const updatedUser = {
        ...result.user,
        receivedLinks: normalizedReceivedLinks,
        sharedLinks: userData.sharedLinks || [],
        friends: userData.friends || [],
      };
      await chrome.storage.local.set({ user: updatedUser });
    }
  } catch (error) {
    console.error("Error checking for new links:", error);
  }
}
