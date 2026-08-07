export type ContentType = "link" | "text";
export type ContentStatus = "unseen" | "seen" | "opened";

export interface PublicProfile {
  uid?: string;
  username: string;
  displayName?: string;
  photoURL?: string;
  joinedAt?: string;
}

export interface RecipientStatus extends PublicProfile {
  status: ContentStatus;
  seenAt?: string;
  openedAt?: string;
}

export interface SharedContent {
  id: string;
  contentType?: ContentType;
  link?: string;
  text?: string;
  sender: string;
  senderUid?: string;
  recipients?: string[];
  recipientProfiles?: PublicProfile[];
  recipientStatuses?: RecipientStatus[];
  timestamp: string;
  editedAt?: string;
  status: ContentStatus;
  likedBy?: string[];
  kind?: string;
}

export interface ReminderInput {
  now: number;
  lastReminderAt?: number;
  lastSharedAt?: number;
  acceptedFriendCount: number;
  remindersEnabled: boolean;
  localHour: number;
}

export const TEXT_LIMIT = 1000;
export const REMINDER_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

export function normalizeUsername(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/^@/, "").toLowerCase()
    : "";
}

export function getContentType(item: SharedContent): ContentType {
  return item.contentType === "text" ? "text" : "link";
}

export function validateContent(input: {
  contentType: ContentType;
  link?: string;
  text?: string;
}): { link?: string; text?: string; contentType: ContentType } {
  if (input.contentType === "text") {
    const text = input.text?.trim() || "";
    if (!text) throw new Error("Write something to share");
    if (text.length > TEXT_LIMIT) {
      throw new Error(`Text must be ${TEXT_LIMIT} characters or fewer`);
    }
    return { contentType: "text", text };
  }

  const link = input.link?.trim() || "";
  try {
    const parsed = new URL(link);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("Enter a valid http or https link");
  }
  return { contentType: "link", link };
}

export function updateLike(
  likedBy: string[] | undefined,
  username: string,
  liked: boolean,
): string[] {
  const normalized = normalizeUsername(username);
  const values = new Set((likedBy || []).map(normalizeUsername).filter(Boolean));
  if (liked) values.add(normalized);
  else values.delete(normalized);
  return Array.from(values);
}

export function updateRecipientStatus(
  statuses: RecipientStatus[] | undefined,
  profile: PublicProfile,
  status: ContentStatus,
  now: string,
): RecipientStatus[] {
  const username = normalizeUsername(profile.username);
  const existing = statuses || [];
  const previous = existing.find((person) => normalizeUsername(person.username) === username);
  const next: RecipientStatus = {
    ...previous,
    ...profile,
    username,
    status,
    ...(status !== "unseen" ? { seenAt: previous?.seenAt || now } : {}),
    ...(status === "opened" ? { openedAt: now } : {}),
  };
  return [...existing.filter((person) => normalizeUsername(person.username) !== username), next];
}

export function firstName(profile: Pick<PublicProfile, "displayName" | "username">): string {
  return profile.displayName?.trim().split(/\s+/)[0] || profile.username;
}

export function shouldSendSharingReminder(input: ReminderInput): boolean {
  if (!input.remindersEnabled || input.acceptedFriendCount === 0) return false;
  if (input.localHour < 10 || input.localHour >= 19) return false;
  if (input.lastReminderAt && input.now - input.lastReminderAt < REMINDER_INTERVAL_MS) return false;
  if (input.lastSharedAt && input.now - input.lastSharedAt < REMINDER_INTERVAL_MS) return false;
  return true;
}
