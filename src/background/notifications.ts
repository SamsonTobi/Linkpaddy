import { Friend, SharedLink } from "./types";

export function showLinkNotification(link: SharedLink) {
  const notificationId = `link-${link.id}`;
  chrome.notifications.getPermissionLevel((level) => {
    if (level !== "granted") {
      console.warn("Notification permission is not granted");
      return;
    }

    chrome.notifications.create(
      notificationId,
      {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "New link from " + link.sender,
        message: link.link,
        priority: 2,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Failed to create link notification:",
            chrome.runtime.lastError.message,
          );
        }
      },
    );
  });
}

export function showFriendNotification(friend: Friend) {
  const identity = friend.uid || friend.username || Date.now().toString();
  const friendName = friend.displayName || friend.username || "Someone";
  const notificationId = `friend-${identity}`;

  chrome.notifications.getPermissionLevel((level) => {
    if (level !== "granted") {
      console.warn("Notification permission is not granted");
      return;
    }

    chrome.notifications.create(
      notificationId,
      {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "New friend added",
        message: `${friendName} added you as a friend.`,
        priority: 2,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Failed to create friend notification:",
            chrome.runtime.lastError.message,
          );
        }
      },
    );
  });
}
