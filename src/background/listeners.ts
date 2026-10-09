import { checkForNewLinks, updateBadge } from "./sync";
import { openExtensionUi, openSidePanel, setSidebarPreferred, syncPanelBehavior } from "./ui";
import { extensionPlatform } from "./extensionPlatform";
import { handleMessage } from "./messages";
import { ensureSharingReminderAlarm, maybeShowSharingReminder, SHARING_REMINDER_ALARM } from "./reminders";

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
      notificationId.startsWith("friend-") ||
      notificationId.startsWith("like:") ||
      notificationId.startsWith("sharing-reminder-")
    ) {
      openExtensionUi();
      chrome.notifications.clear(notificationId);
    }
  });

  // Update badge whenever storage changes, and keep the toolbar click
  // pointed at the remembered surface when the sidebar preference flips.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.user) {
      updateBadge();
    }
    if (areaName === "local" && changes.preferSidebar) {
      void syncPanelBehavior();
    }
  });

  // Periodic polling for new links
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === CHECK_NEW_LINKS_ALARM) {
      await checkForNewLinks();
    } else if (alarm.name === SHARING_REMINDER_ALARM) {
      await maybeShowSharingReminder();
    }
  });

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "shareLinkMenu",
      title: "Share this site with LinkPaddy",
      contexts: ["page"],
    });
    chrome.contextMenus.create({
      id: "openSidebarMenu",
      title: "Open LinkPaddy sidebar",
      contexts: ["page", "action"],
    });
    void syncPanelBehavior();
    ensureCheckNewLinksAlarm();
    ensureSharingReminderAlarm();
    triggerQuickSync("onInstalled");
    updateBadge();
  });

  chrome.runtime.onStartup.addListener(() => {
    ensureCheckNewLinksAlarm();
    ensureSharingReminderAlarm();
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

      // Keep refreshing while popup is open. Polled loosely: every sync
      // does full-doc server reads, and write bandwidth is precious.
      const intervalId = setInterval(() => {
        triggerQuickSync("popupPolling");
      }, 15000);

      port.onDisconnect.addListener(() => {
        console.log("Popup closed, stopping live refresh");
        clearInterval(intervalId);
      });
    }
  });

  // Initial badge check when service worker starts
  ensureCheckNewLinksAlarm();
  ensureSharingReminderAlarm();
  void syncPanelBehavior();
  triggerQuickSync("serviceWorkerStart");
  updateBadge();

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "shareLinkMenu" && tab && tab.url) {
      // Store the URL in local storage
      chrome.storage.local.set({ shareUrl: tab.url }, () => {
        // Open the extension popup
        openExtensionUi();
      });
      return;
    }
    if (info.menuItemId === "openSidebarMenu") {
      void openSidePanel(tab?.windowId).then((opened) => {
        if (opened) {
          // Remember the choice so the next toolbar click opens the sidebar.
          void setSidebarPreferred(true).then(() => syncPanelBehavior());
        } else {
          openExtensionUi();
        }
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
    if (message.type === "OPEN_SIDE_PANEL") {
      openSidePanel(sender.tab?.windowId)
        .then((opened) => {
          if (opened) {
            // Remember the choice so the next toolbar click opens the sidebar.
            void setSidebarPreferred(true).then(() => syncPanelBehavior());
          } else {
            openExtensionUi();
          }
          sendResponse({ success: opened });
        })
        .catch((error) => {
          openExtensionUi();
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        });
      return true; // Async response
    }
    if (message.type === "SET_SIDEBAR_PREFERENCE") {
      void setSidebarPreferred(message.prefer === true).then(() =>
        syncPanelBehavior(),
      );
      return false;
    }
    return handleMessage(message, sendResponse, extensionPlatform);
  });
}
