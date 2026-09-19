import { db } from "../firebase";
import { arrayUnion, doc, getDoc, updateDoc, writeBatch } from "firebase/firestore";
import { resolveFriendRefByUsername } from "./friends";
import { requireMatchingAuthUser } from "./authState";
import {
  ContentStatus,
  PublicProfile,
  SharedContent,
  buildRecipientStatuses,
  ensureRecipientStatuses,
  normalizeUsername,
  parseLinkList,
  sanitizePublicProfile,
  updateLike,
  updateRecipientStatus,
  validateContent,
} from "../shared/content";

interface StoredUser {
  uid: string;
  username: string;
  displayName?: string;
  photoURL?: string;
  joinedAt?: string;
  friends?: Array<PublicProfile & { status?: string }>;
  sharedLinks?: SharedContent[];
  receivedLinks?: SharedContent[];
  bookmarkedLinkIds?: string[];
  recentShareRecipientUsernames?: string[];
  lastSharedAt?: number;
  [key: string]: unknown;
}

type Response = { success: boolean; error?: string; item?: SharedContent };

async function getStoredUser(): Promise<StoredUser> {
  const { user } = await chrome.storage.local.get(["user"]);
  if (!user?.uid) throw new Error("No user logged in");
  await requireMatchingAuthUser(user.uid);
  return user as StoredUser;
}

function profileFromUser(user: StoredUser): PublicProfile {
  return sanitizePublicProfile({
    uid: user.uid,
    username: user.username,
    displayName: user.displayName,
    photoURL: user.photoURL,
    joinedAt: user.joinedAt,
  });
}

async function resolveProfile(user: StoredUser, username: string) {
  const normalized = normalizeUsername(username);
  const local = (user.friends || []).find(
    (friend) => normalizeUsername(friend.username) === normalized,
  );
  if (local?.uid) {
    return { profile: sanitizePublicProfile({ ...local, username: normalized }), ref: doc(db, "users", local.uid) };
  }
  const resolved = await resolveFriendRefByUsername(normalized);
  if (!resolved) return null;
  const snapshot = await getDoc(resolved.ref);
  const data = snapshot.data() || {};
  return {
    ref: resolved.ref,
    profile: sanitizePublicProfile({
      uid: resolved.uid,
      username: normalized,
      displayName: data.displayName,
      photoURL: data.photoURL,
      joinedAt: data.joinedAt,
    }),
  };
}

async function updateLocalUser(user: StoredUser, patch: Partial<StoredUser>) {
  await chrome.storage.local.set({ user: { ...user, ...patch } });
}

// Serializes full-array doc rewrites so concurrent updates can't clobber
// each other (last-writer-wins on the same array drops entries). One chain
// per process is enough: these ops are infrequent and never nest inside
// each other, which also rules out deadlocks by construction.
let statusChain: Promise<void> = Promise.resolve();
export function serializeStatusWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = statusChain.then(task);
  statusChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function updateRecipientCopies(
  owner: StoredUser,
  recipients: string[],
  transform: (item: SharedContent) => SharedContent | null,
) {
  await Promise.all(
    recipients.map(async (username) => {
      const resolved = await resolveProfile(owner, username);
      if (!resolved) return;
      const snapshot = await getDoc(resolved.ref);
      if (!snapshot.exists()) return;
      const links = (snapshot.data().receivedLinks || []) as SharedContent[];
      const next = links.flatMap((item) => {
        const result = transform(item);
        return result ? [result] : [];
      });
      await updateDoc(resolved.ref, { receivedLinks: next });
    }),
  );
}

export async function shareLink(link: string, selectedFriends: string[]) {
  return shareContent({ link, contentType: "link" }, selectedFriends);
}

export async function shareContent(
  input: { link?: string; text?: string; contentType: "link" | "text" },
  selectedFriends: string[],
) {
  // Fail fast while offline: Firestore write promises pend (never reject)
  // without connectivity, which used to wedge the sheet on "Sharing..."
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("You're offline — reconnect and try again");
  }

  const recipients = Array.from(new Set(selectedFriends.map(normalizeUsername).filter(Boolean)));
  if (recipients.length === 0) throw new Error("Please select at least one friend");
  if (recipients.length > 400) throw new Error("Too many recipients at once");

  const user = await getStoredUser();
  // Recipient lookups run concurrently and are usually free: known friends
  // resolve from the local list with zero network round trips.
  const settled = await Promise.all(recipients.map((username) => resolveProfile(user, username)));
  const missing = recipients.filter((_, index) => !settled[index]);
  if (missing.length > 0) throw new Error(`Could not find @${missing[0]}`);
  const resolvedRecipients = settled as NonNullable<Awaited<ReturnType<typeof resolveProfile>>>[];

  // One item per link (comma-separated input supported); a single text is
  // one item. Per-link ids keep seen/like state independent with no UI changes.
  const contents =
    input.contentType === "text"
      ? [validateContent(input)]
      : parseLinkList(input.link).map((link) => ({ contentType: "link" as const, link }));

  const timestamp = new Date().toISOString();
  const base = Date.now();
  const sender = normalizeUsername(user.username);
  const recipientProfiles = resolvedRecipients.map(({ profile }) => sanitizePublicProfile(profile));
  // recipientStatuses embeds the profiles, so profiles aren't stored twice.
  const recipientStatuses = buildRecipientStatuses(recipientProfiles);
  const items: SharedContent[] = contents.map((content, index) => ({
    id: `${base}-${index}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
    ...content,
    sender,
    senderUid: user.uid,
    timestamp,
    recipients,
    recipientStatuses,
    status: "unseen",
    likedBy: [],
  }));
  // Bound the commit size (links x recipients), not just each dimension.
  if (items.length * resolvedRecipients.length > 2000) {
    throw new Error("Too much at once — split into smaller shares");
  }

  const userRef = doc(db, "users", user.uid);
  const recentShareRecipientUsernames = [
    ...recipients,
    ...(user.recentShareRecipientUsernames || []).filter((username) => !recipients.includes(username)),
  ];
  const lastSharedAt = Date.now();

  // Optimistic local update first so the feed is instant; reverted on failure.
  await chrome.storage.local.set({
    user: { ...user, sharedLinks: [...(user.sharedLinks || []), ...items], lastSharedAt, recentShareRecipientUsernames },
    lastAnimatedShareId: items[items.length - 1].id,
  });

  // Single atomic commit: sender + every recipient, or nothing. The old
  // sender-first + per-recipient writes left phantom "sent" copies whenever
  // any recipient write failed (the flaky text-send bug), and cost N+1
  // round trips. set-with-merge tolerates a missing recipient doc.
  // The commit is raced against a timeout because Firestore pends (never
  // settles) when the backend is unreachable or throttling writes — without
  // this the share hangs forever. Kept under the popup's 30s timeout so the
  // specific error below wins over the generic one.
  const COMMIT_TIMEOUT_MS = 25000;
  const batch = writeBatch(db);
  batch.update(userRef, { sharedLinks: arrayUnion(...items), lastSharedAt, recentShareRecipientUsernames });
  for (const { ref } of resolvedRecipients) {
    batch.set(ref, { receivedLinks: arrayUnion(...items) }, { merge: true });
  }
  try {
    await Promise.race([
      batch.commit(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("COMMIT_TIMEOUT")), COMMIT_TIMEOUT_MS),
      ),
    ]);
  } catch (error) {
    // Surgical revert: remove only our item ids from the latest local copy
    // instead of restoring a stale snapshot over concurrent updates.
    try {
      const latest = await chrome.storage.local.get(["user"]);
      const ids = new Set(items.map((item) => item.id));
      if (latest.user) {
        await chrome.storage.local.set({
          user: {
            ...latest.user,
            sharedLinks: (latest.user.sharedLinks || []).filter((link: SharedContent) => !ids.has(link.id)),
          },
        });
      }
      await chrome.storage.local.remove("lastAnimatedShareId");
    } catch {
      // Revert is best-effort; the next sync reconciles local state anyway.
    }
    if (error instanceof Error && error.message === "COMMIT_TIMEOUT") {
      throw new Error(
        typeof navigator !== "undefined" && navigator.onLine === false
          ? "You're offline — reconnect and try again"
          : "Couldn't reach LinkPaddy servers — try again in a bit",
      );
    }
    throw friendlyShareError(error);
  }
  return items[items.length - 1];
}

/** Map low-level commit failures to copy the share sheet can show. */
function friendlyShareError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/permission-denied|insufficient permissions/i.test(message)) {
    return new Error("Couldn't deliver — please try again");
  }
  if (/resource-exhausted|quota|bandwidth|queued writes/i.test(message)) {
    return new Error("LinkPaddy servers are busy right now — try again in a bit");
  }
  if (/too large|too big/i.test(message)) {
    return new Error("That share is too large to deliver — try fewer links or recipients");
  }
  return error instanceof Error ? error : new Error("Failed to share");
}

export function updateLinkStatus(
  linkId: string,
  status: ContentStatus,
  senderUsername?: string,
  senderUid?: string,
) {
  return serializeStatusWrite(() => updateLinkStatusInner(linkId, status, senderUsername, senderUid));
}

async function updateLinkStatusInner(
  linkId: string,
  status: ContentStatus,
  senderUsername?: string,
  senderUid?: string,
) {
  const user = await getStoredUser();
  const now = new Date().toISOString();
  const profile = profileFromUser(user);
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  const storedReceived = ((userSnap.data()?.receivedLinks || []) as SharedContent[]);
  const receivedItem = storedReceived.find((item) => item.id === linkId);
  const receivedLinks = storedReceived.map((item) =>
    item.id === linkId ? { ...item, status } : item,
  );
  await updateDoc(userRef, { receivedLinks });
  await updateLocalUser(user, { receivedLinks });

  // Resolve the sender by stable uid first: usernames can change after a
  // link is shared, which used to make this lookup silently miss and leave
  // the sender's recipient sheet stuck on "Not seen" forever.
  const uidFromParam = typeof senderUid === "string" ? senderUid.trim() : "";
  const uidFromItem = typeof receivedItem?.senderUid === "string" ? receivedItem.senderUid.trim() : "";
  const senderUidResolved = uidFromParam || uidFromItem;
  let senderRef = senderUidResolved ? doc(db, "users", senderUidResolved) : null;
  if (!senderRef) {
    const sender = await resolveProfile(user, senderUsername || receivedItem?.sender || "");
    if (!sender) return;
    senderRef = sender.ref;
  }
  const senderSnap = await getDoc(senderRef);
  if (!senderSnap.exists()) return;
  const sharedLinks = ((senderSnap.data()?.sharedLinks || []) as SharedContent[]).map((item) =>
    item.id === linkId
      ? { ...item, recipientStatuses: updateRecipientStatus(ensureRecipientStatuses(item), profile, status, now) }
      : item,
  );
  await updateDoc(senderRef, { sharedLinks });
}

export function handleUpdateLinkStatusMessage(message: any, sendResponse: (response: Response) => void) {
  updateLinkStatus(message.linkId, message.status, message.senderUsername, message.senderUid)
    .then(() => sendResponse({ success: true }))
    .catch((error) => sendResponse({ success: false, error: error instanceof Error ? error.message : "Status update failed" }));
}

async function toggleBookmark(linkId: string, bookmarked: boolean) {
  const user = await getStoredUser();
  const ids = new Set(user.bookmarkedLinkIds || []);
  if (bookmarked) ids.add(linkId);
  else ids.delete(linkId);
  const bookmarkedLinkIds = Array.from(ids);
  await updateDoc(doc(db, "users", user.uid), { bookmarkedLinkIds });
  await updateLocalUser(user, { bookmarkedLinkIds });
}

async function toggleLike(linkId: string, liked: boolean) {
  const user = await getStoredUser();
  const ownItem = (user.sharedLinks || []).find((item) => item.id === linkId);
  const receivedItem = (user.receivedLinks || []).find((item) => item.id === linkId);
  const senderUsername = ownItem?.sender || receivedItem?.sender;
  if (!senderUsername) throw new Error("Item not found");
  if ((ownItem || receivedItem)?.contentType === "text") throw new Error("Only links can be liked");

  const sender = ownItem
    ? { ref: doc(db, "users", user.uid), profile: profileFromUser(user) }
    : await resolveProfile(user, senderUsername);
  if (!sender) throw new Error("Sender not found");
  const senderSnap = await getDoc(sender.ref);
  const senderData = senderSnap.data() as StoredUser;
  let updatedItem: SharedContent | undefined;
  const sharedLinks = (senderData.sharedLinks || []).map((item) => {
    if (item.id !== linkId) return item;
    updatedItem = { ...item, likedBy: updateLike(item.likedBy, user.username, liked) };
    return updatedItem;
  });
  if (!updatedItem) throw new Error("Item not found");

  const patch: any = { sharedLinks };
  if (liked && senderData.uid !== user.uid) {
    const actorUsername = normalizeUsername(user.username);
    patch.activityNotifications = arrayUnion({
      id: `like:${linkId}:${user.uid}`,
      type: "link_liked",
      shareId: linkId,
      actorUid: user.uid,
      actorUsername,
      actorFirstName: (typeof user.displayName === "string" ? user.displayName.split(/\s+/)[0] : "") || actorUsername,
      createdAt: new Date().toISOString(),
      read: false,
    });
  }
  await updateDoc(sender.ref, patch);
  await updateRecipientCopies(senderData, updatedItem.recipients || [], (item) =>
    item.id === linkId ? { ...item, likedBy: updatedItem!.likedBy } : item,
  );

  const sharedLocal = (user.sharedLinks || []).map((item) => item.id === linkId ? { ...item, likedBy: updatedItem!.likedBy } : item);
  const receivedLocal = (user.receivedLinks || []).map((item) => item.id === linkId ? { ...item, likedBy: updatedItem!.likedBy } : item);
  await updateLocalUser(user, { sharedLinks: sharedLocal, receivedLinks: receivedLocal });
}

export function handleToggleContentMessage(message: any, sendResponse: (response: Response) => void) {
  const operation = message.type === "TOGGLE_BOOKMARK"
    ? toggleBookmark(message.linkId, !!message.value)
    : toggleLike(message.linkId, !!message.value);
  operation
    .then(() => sendResponse({ success: true }))
    .catch((error) => sendResponse({ success: false, error: error instanceof Error ? error.message : "Update failed" }));
}

export async function editText(linkId: string, text: string) {
  const validated = validateContent({ contentType: "text", text });
  const user = await getStoredUser();
  const editedAt = new Date().toISOString();
  let edited: SharedContent | undefined;
  const sharedLinks = (user.sharedLinks || []).map((item) => {
    if (item.id !== linkId || item.contentType !== "text") return item;
    edited = { ...item, text: validated.text, editedAt };
    return edited;
  });
  if (!edited) throw new Error("Only the sender can edit this text");
  await updateDoc(doc(db, "users", user.uid), { sharedLinks });
  await updateRecipientCopies(user, edited.recipients || [], (item) => item.id === linkId ? edited! : item);
  await updateLocalUser(user, { sharedLinks });
}

export async function deleteContent(linkId: string) {
  const user = await getStoredUser();
  const item = (user.sharedLinks || []).find((candidate) => candidate.id === linkId);
  if (!item) throw new Error("Only the sender can delete this item");
  const sharedLinks = (user.sharedLinks || []).filter((candidate) => candidate.id !== linkId);
  await updateDoc(doc(db, "users", user.uid), { sharedLinks });
  await updateRecipientCopies(user, item.recipients || [], (candidate) => candidate.id === linkId ? null : candidate);
  await updateLocalUser(user, { sharedLinks });
}
