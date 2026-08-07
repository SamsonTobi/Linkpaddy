import { shouldSendSharingReminder } from "../shared/content";

export const SHARING_REMINDER_ALARM = "sharingReminder";

export function ensureSharingReminderAlarm() {
  chrome.alarms.create(SHARING_REMINDER_ALARM, { periodInMinutes: 360 });
}

export async function maybeShowSharingReminder() {
  const { user, lastSharingReminderAt } = await chrome.storage.local.get(["user", "lastSharingReminderAt"]);
  if (!user) return false;
  const friends = (user.friends || []).filter((friend: any) => !friend.status || friend.status === "accepted" || friend.status === "auto");
  const now = Date.now();
  const eligible = shouldSendSharingReminder({
    now,
    lastReminderAt: lastSharingReminderAt,
    lastSharedAt: user.lastSharedAt,
    acceptedFriendCount: friends.length,
    remindersEnabled: user.settings?.sharingReminders ?? true,
    localHour: new Date(now).getHours(),
  });
  if (!eligible) return false;

  const friend = friends[Math.floor(now / (3 * 24 * 60 * 60 * 1000)) % friends.length];
  const firstName = friend?.displayName?.trim().split(/\s+/)[0];
  await chrome.notifications.create(`sharing-reminder-${now}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Found anything interesting?",
    message: firstName ? `Share it with ${firstName} on LinkPaddy.` : "Share it with your friends on LinkPaddy.",
    priority: 0,
  });
  await chrome.storage.local.set({ lastSharingReminderAt: now });
  return true;
}
