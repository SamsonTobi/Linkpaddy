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

export function showFriendRequestNotification(senderUsername: string) {
  const notificationId = `friend-request-${senderUsername}-${Date.now()}`;
  chrome.notifications.getPermissionLevel((level) => {
    if (level !== "granted") return;
    chrome.notifications.create(
      notificationId,
      {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "New Friend Request",
        message: `@${senderUsername} sent you a friend request.`,
        priority: 2,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error("Failed to create friend request notification:", chrome.runtime.lastError.message);
        }
      }
    );
  });
}

export function showFriendAcceptedNotification(senderUsername: string) {
  const notificationId = `friend-accepted-${senderUsername}-${Date.now()}`;
  chrome.notifications.getPermissionLevel((level) => {
    if (level !== "granted") return;
    chrome.notifications.create(
      notificationId,
      {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Friend Request Accepted",
        message: `@${senderUsername} accepted your friend request!`,
        priority: 2,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error("Failed to create friend accepted notification:", chrome.runtime.lastError.message);
        }
      }
    );
  });
}

export function showFriendRequestReminderNotification(count: number) {
  const notificationId = `friend-reminder-${Date.now()}`;
  chrome.notifications.getPermissionLevel((level) => {
    if (level !== "granted") return;
    chrome.notifications.create(
      notificationId,
      {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Pending Friend Requests",
        message: `You have ${count} pending friend request${count > 1 ? "s" : ""} waiting for your response.`,
        priority: 1,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error("Failed to create friend reminder notification:", chrome.runtime.lastError.message);
        }
      }
    );
  });
}
