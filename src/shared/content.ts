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
/** Max links accepted in a single share (comma-separated input). */
export const MAX_LINKS_PER_SHARE = 20;
/** History caps: keeps every read/write constant-time and docs under the 1MB Firestore limit. */
export const MAX_STORED_SHARED_LINKS = 500;
export const MAX_STORED_RECEIVED_LINKS = 500;

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

/**
 * Split a share input into individual links. Entries are separated by commas
 * or newlines, trimmed, de-duplicated, and each must be a valid http(s) URL.
 * Commas *inside* a URL are preserved: a split only happens on a comma that
 * introduces a new URL (e.g. Google Maps links keep working).
 * Throws naming the offending entry.
 */
export function parseLinkList(raw: unknown): string[] {
  const parts = typeof raw === "string" ? raw.split(/\n|,\s*(?=https?:\/\/)|,\s*$/i) : [];
  const links: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const link = part.trim();
    if (!link || seen.has(link)) continue;
    try {
      const parsed = new URL(link);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    } catch {
      const preview = link.length > 60 ? `${link.slice(0, 60)}…` : link;
      throw new Error(`"${preview}" is not a valid http or https link`);
    }
    seen.add(link);
    links.push(link);
  }
  if (links.length === 0) throw new Error("Enter a link to share");
  if (links.length > MAX_LINKS_PER_SHARE) {
    throw new Error(`You can share up to ${MAX_LINKS_PER_SHARE} links at once`);
  }
  return links;
}

/**
 * Keep only the newest `max` entries (arrays are append-ordered, oldest
 * first). Returns the same reference when nothing needs trimming so callers
 * can skip no-op writes.
 */
export function trimNewest<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return items.slice(items.length - max);
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
    ...sanitizePublicProfile(profile),
    username,
    status,
    ...(status !== "unseen" ? { seenAt: previous?.seenAt || now } : {}),
    ...(status === "opened" ? { openedAt: now } : {}),
  };
  return [...existing.filter((person) => normalizeUsername(person.username) !== username), next];
}

/**
 * Strip undefined/null values out of a profile so it can be safely written
 * with Firestore arrayUnion (which rejects `undefined` anywhere in the
 * payload, including nested objects). Older user docs / cached friends can
 * be missing optional fields like displayName, photoURL or joinedAt, which
 * previously crashed sharing with:
 * "Function arrayUnion() called with invalid data. Unsupported field value: undefined".
 */
export function sanitizePublicProfile(
  profile: Partial<PublicProfile> | null | undefined,
): PublicProfile {
  const username = normalizeUsername((profile as { username?: unknown } | null | undefined)?.username);
  const clean: PublicProfile = { username };
  if (!profile) return clean;

  const uid = typeof profile.uid === "string" ? profile.uid.trim() : "";
  if (uid) clean.uid = uid;

  const displayName = typeof profile.displayName === "string" ? profile.displayName : "";
  if (displayName) clean.displayName = displayName;

  const photoURL = typeof profile.photoURL === "string" ? profile.photoURL : "";
  if (photoURL) clean.photoURL = photoURL;

  const joinedAt = typeof profile.joinedAt === "string" ? profile.joinedAt : "";
  if (joinedAt) clean.joinedAt = joinedAt;

  return clean;
}

function sanitizeRecipientStatus(
  person: Partial<RecipientStatus> | null | undefined,
): RecipientStatus | null {
  if (!person) return null;
  const username = normalizeUsername((person as { username?: unknown }).username);
  if (!username) return null;
  const status: ContentStatus =
    person.status === "seen" || person.status === "opened" ? person.status : "unseen";
  const clean: RecipientStatus = { ...sanitizePublicProfile(person), username, status };
  if (typeof person.seenAt === "string" && person.seenAt) clean.seenAt = person.seenAt;
  if (typeof person.openedAt === "string" && person.openedAt) clean.openedAt = person.openedAt;
  return clean;
}

export function buildRecipientStatuses(
  profiles: Array<Partial<PublicProfile> | null | undefined>,
  status: ContentStatus = "unseen",
): RecipientStatus[] {
  const byUsername = new Map<string, RecipientStatus>();
  for (const person of profiles) {
    const username = normalizeUsername((person as { username?: unknown } | null | undefined)?.username);
    if (!username || byUsername.has(username)) continue;
    byUsername.set(username, { ...sanitizePublicProfile(person), username, status });
  }
  return Array.from(byUsername.values());
}

/**
 * Backfill per-recipient statuses for links created before recipientStatuses
 * existed (or written by older clients). Falls back to recipientProfiles,
 * then the legacy recipients username list, so every recipient is
 * represented exactly once and never stuck invisible.
 */
export function ensureRecipientStatuses(
  item: Pick<SharedContent, "recipients" | "recipientProfiles" | "recipientStatuses">,
): RecipientStatus[] {
  const existing = Array.isArray(item.recipientStatuses) ? item.recipientStatuses : [];
  if (existing.length > 0) {
    const cleaned = existing
      .map(sanitizeRecipientStatus)
      .filter((person): person is RecipientStatus => person !== null);
    if (cleaned.length > 0) return cleaned;
  }

  const profiles = Array.isArray(item.recipientProfiles) ? item.recipientProfiles : [];
  const legacyRecipients = Array.isArray(item.recipients) ? item.recipients : [];
  const merged: Array<Partial<PublicProfile>> = [
    ...profiles,
    ...legacyRecipients.map((username) => ({ username })),
  ];
  return buildRecipientStatuses(merged);
}

/**
 * Aggregate per-recipient statuses into a single icon status for sent links.
 * The sender's top-level `status` field is frozen at "unseen" from share
 * time, so deriving from recipientStatuses is the only way the sent eye
 * icon can ever change.
 */
export function aggregateRecipientStatus(
  statuses: Array<Pick<RecipientStatus, "status">> | undefined,
  fallback: ContentStatus = "unseen",
): ContentStatus {
  const list = (statuses || [])
    .map((person) => person?.status)
    .filter((status): status is ContentStatus => status === "unseen" || status === "seen" || status === "opened");
  if (list.length === 0) return fallback;
  if (list.every((status) => status === "opened")) return "opened";
  if (list.some((status) => status === "seen" || status === "opened")) return "seen";
  return "unseen";
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
