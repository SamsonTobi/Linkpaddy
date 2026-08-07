import { db } from "../firebase";
import { arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import { resolveFriendRefByUsername } from "./friends";
import { requireMatchingAuthUser } from "./authState";
import {
  ContentStatus,
  PublicProfile,
  SharedContent,
  normalizeUsername,
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
  return {
    uid: user.uid,
    username: normalizeUsername(user.username),
    displayName: user.displayName,
    photoURL: user.photoURL,
    joinedAt: user.joinedAt,
  };
}

async function resolveProfile(user: StoredUser, username: string) {
  const normalized = normalizeUsername(username);
  const local = (user.friends || []).find(
    (friend) => normalizeUsername(friend.username) === normalized,
  );
  if (local?.uid) {
    return { profile: { ...local, username: normalized }, ref: doc(db, "users", local.uid) };
  }
  const resolved = await resolveFriendRefByUsername(normalized);
  if (!resolved) return null;
  const snapshot = await getDoc(resolved.ref);
  const data = snapshot.data() || {};
  return {
    ref: resolved.ref,
    profile: {
      uid: resolved.uid,
      username: normalized,
      displayName: data.displayName,
      photoURL: data.photoURL,
      joinedAt: data.joinedAt,
    } as PublicProfile,
  };
}

async function updateLocalUser(user: StoredUser, patch: Partial<StoredUser>) {
  await chrome.storage.local.set({ user: { ...user, ...patch } });
}

async function updateRecipientCopies(
  owner: StoredUser,
  recipients: string[],
  transform: (item: SharedContent) => SharedContent | null,
) {
  for (const username of recipients) {
    const resolved = await resolveProfile(owner, username);
    if (!resolved) continue;
    const snapshot = await getDoc(resolved.ref);
    if (!snapshot.exists()) continue;
    const links = (snapshot.data().receivedLinks || []) as SharedContent[];
    const next = links.flatMap((item) => {
      const result = transform(item);
      return result ? [result] : [];
    });
    await updateDoc(resolved.ref, { receivedLinks: next });
  }
}

export async function shareLink(link: string, selectedFriends: string[]) {
  return shareContent({ link, contentType: "link" }, selectedFriends);
}

export async function shareContent(
  input: { link?: string; text?: string; contentType: "link" | "text" },
  selectedFriends: string[],
) {
  const content = validateContent(input);
  const recipients = Array.from(new Set(selectedFriends.map(normalizeUsername).filter(Boolean)));
  if (recipients.length === 0) throw new Error("Please select at least one friend");

  const user = await getStoredUser();
  const resolvedRecipients = [];
  for (const username of recipients) {
    const resolved = await resolveProfile(user, username);
    if (!resolved) throw new Error(`Could not find @${username}`);
    resolvedRecipients.push(resolved);
  }

  const timestamp = new Date().toISOString();
  const id = `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  const recipientProfiles = resolvedRecipients.map(({ profile }) => profile);
  const item: SharedContent = {
    id,
    ...content,
    sender: normalizeUsername(user.username),
    senderUid: user.uid,
    timestamp,
    recipients,
    recipientProfiles,
    recipientStatuses: recipientProfiles.map((profile) => ({ ...profile, status: "unseen" })),
    status: "unseen",
    likedBy: [],
  };

  const userRef = doc(db, "users", user.uid);
  const recentShareRecipientUsernames = [
    ...recipients,
    ...(user.recentShareRecipientUsernames || []).filter((username) => !recipients.includes(username)),
  ];
  await updateDoc(userRef, { sharedLinks: arrayUnion(item), lastSharedAt: Date.now(), recentShareRecipientUsernames });
  for (const { ref } of resolvedRecipients) {
    await updateDoc(ref, { receivedLinks: arrayUnion(item) });
  }

  await updateLocalUser(user, {
    sharedLinks: [...(user.sharedLinks || []), item],
    lastSharedAt: Date.now(),
    recentShareRecipientUsernames,
  });
  await chrome.storage.local.set({ lastAnimatedShareId: id });
  chrome.runtime.sendMessage({ type: "SHARE_LINK_SUCCESS", item });
  return item;
}

export async function updateLinkStatus(
  linkId: string,
  status: ContentStatus,
  senderUsername?: string,
) {
  const user = await getStoredUser();
  const now = new Date().toISOString();
  const profile = profileFromUser(user);
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  const receivedLinks = ((userSnap.data()?.receivedLinks || []) as SharedContent[]).map((item) =>
    item.id === linkId ? { ...item, status } : item,
  );
  await updateDoc(userRef, { receivedLinks });
  await updateLocalUser(user, { receivedLinks });

  const sender = await resolveProfile(user, senderUsername || "");
  if (!sender) return;
  const senderSnap = await getDoc(sender.ref);
  const sharedLinks = ((senderSnap.data()?.sharedLinks || []) as SharedContent[]).map((item) =>
    item.id === linkId
      ? { ...item, recipientStatuses: updateRecipientStatus(item.recipientStatuses, profile, status, now) }
      : item,
  );
  await updateDoc(sender.ref, { sharedLinks });
}

export function handleUpdateLinkStatusMessage(message: any, sendResponse: (response: Response) => void) {
  updateLinkStatus(message.linkId, message.status, message.senderUsername)
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
    patch.activityNotifications = arrayUnion({
      id: `like:${linkId}:${user.uid}`,
      type: "link_liked",
      shareId: linkId,
      actorUid: user.uid,
      actorUsername: user.username,
      actorFirstName: user.displayName?.split(/\s+/)[0] || user.username,
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
