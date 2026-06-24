import { signIn, handleSignOut, deleteUser, searchUserInternal, updateSettingsInternal, updateUsernameInternal, completeOnboardingInternal } from "./auth";
import { addFriend, acceptFriendInternal, rejectFriendInternal, removeFriendInternal } from "./friends";
import { checkForNewLinks, updateBadge } from "./sync";
import { refreshFriendProfiles } from "./friendsSync";
import { openExtensionUi } from "./ui";
import { handleUpdateLinkStatusMessage, shareLink } from "./links";

const CHECK_NEW_LINKS_ALARM = "checkNewLinks";
const QUICK_SYNC_THROTTLE_MS = 10000;

let lastQuickSyncAt = 0;

function ensureCheckNewLinksAlarm() {
  chrome.alarms.create(CHECK_NEW_LINKS_ALARM, { periodInMinutes: 0.5 });
}

function triggerQuickSync(reason: string, skipThrottle = false) {
  const now = Date.now();
  if (!skipThrottle && now - lastQuickSyncAt < QUICK_SYNC_THROTTLE_MS) {
    return;
  }

  lastQuickSyncAt = now;
  checkForNewLinks().catch((error) => {
    console.error(`Quick sync failed (${reason}):`, error);
  });
}

export function registerBackgroundListeners() {
  // Open the extension popup when the user clicks a notification
  chrome.notifications.onClicked.addListener((notificationId) => {
    if (
      notificationId.startsWith("link-") ||
      notificationId.startsWith("friend-")
    ) {
      openExtensionUi();
      chrome.notifications.clear(notificationId);
    }
  });

  // Update badge whenever storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.user) {
      updateBadge();
    }
  });

  // Periodic polling for new links
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === CHECK_NEW_LINKS_ALARM) {
      await checkForNewLinks();
    }
  });

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "shareLinkMenu",
      title: "Share this site with LinkPaddy",
      contexts: ["page"],
    });
    ensureCheckNewLinksAlarm();
    triggerQuickSync("onInstalled");
    updateBadge();
  });

  chrome.runtime.onStartup.addListener(() => {
    ensureCheckNewLinksAlarm();
    triggerQuickSync("onStartup");
    updateBadge();
  });

  // Run a quick sync when the user becomes active in the browser.
  chrome.tabs.onActivated.addListener(() => {
    triggerQuickSync("tabActivated");
  });

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.active) {
      triggerQuickSync("activeTabLoaded");
    }
  });

  // Refresh data when popup connects (user opens the extension)
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "popup") {
      console.log("Popup opened, refreshing data...");
      triggerQuickSync("popupConnected", true);

      // Keep refreshing while popup is open (every 5 seconds)
      const intervalId = setInterval(() => {
        triggerQuickSync("popupPolling");
      }, 5000);

      port.onDisconnect.addListener(() => {
        console.log("Popup closed, stopping live refresh");
        clearInterval(intervalId);
      });
    }
  });

  // Initial badge check when service worker starts
  ensureCheckNewLinksAlarm();
  triggerQuickSync("serviceWorkerStart");
  updateBadge();

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "shareLinkMenu" && tab && tab.url) {
      // Store the URL in local storage
      chrome.storage.local.set({ shareUrl: tab.url }, () => {
        // Open the extension popup
        openExtensionUi();
      });
    }
  });

  // Keyboard shortcut handler
  chrome.commands.onCommand.addListener(async (command) => {
    if (
      command === "share-current-tab" ||
      command === "share-current-tab-mac-alt"
    ) {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (
          tab?.url &&
          (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
        ) {
          chrome.storage.local.set({ shareUrl: tab.url }, () => {
            openExtensionUi();
          });
        }
      } catch (error) {
        console.error("Error sharing current tab:", error);
      }
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SIGN_IN") {
      signIn();
    } else if (message.type === "SIGN_OUT") {
      handleSignOut();
    } else if (message.type === "DELETE_ACCOUNT") {
      deleteUser(message.uid);
    } else if (message.type === "ADD_FRIEND") {
      addFriend(message.currentUser, message.friendUsername, message.friendUid)
        .then((result) =>
          sendResponse({ success: true, newFriend: result.newFriend }),
        )
        .catch((error) =>
          sendResponse({ success: false, error: error.message }),
        );
      return true; // Indicates that the response is sent asynchronously
    } else if (message.type === "ACCEPT_FRIEND") {
      acceptFriendInternal(message.currentUser, message.friendUsername)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === "REJECT_FRIEND") {
      rejectFriendInternal(message.currentUser, message.friendUsername)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === "SHARE_LINK") {
      shareLink(message.link, message.selectedFriends)
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message }),
        );
      return true;
    } else if (message.type === "REFRESH_DATA") {
      checkForNewLinks()
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message }),
        );
      return true;
    } else if (message.type === "UPDATE_LINK_STATUS") {
      handleUpdateLinkStatusMessage(message, sendResponse);
      return true;
    } else if (message.type === "SEARCH_USER") {
      searchUserInternal(message.searchTerm)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === "REMOVE_FRIEND") {
      removeFriendInternal(message.currentUser, message.friendUsername)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === "UPDATE_SETTINGS") {
      updateSettingsInternal(message.uid, message.settings)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === "UPDATE_USERNAME") {
      updateUsernameInternal(message.uid, message.nextUsername)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === "COMPLETE_ONBOARDING") {
      completeOnboardingInternal(message.uid)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    } else if (message.type === "REFRESH_FRIEND_PROFILES") {
      refreshFriendProfiles(message.uid)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    }

    return false;
  });
}
