import { db } from "../firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { resolveFriendRefByUsername } from "./friends";

function normalizeRecipientUsername(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function handleUpdateLinkStatusMessage(
  message: any,
  sendResponse: (response: { success: boolean; error?: string }) => void,
) {
  const { linkId, status, senderUsername } = message;

  // Get current user data first
  chrome.storage.local.get(["user"], async (result) => {
    const currentUser = result.user;
    if (!currentUser) {
      sendResponse({ success: false, error: "No user logged in" });
      return;
    }

    try {
      // Update receiver's document
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();

      if (userData && userData.receivedLinks) {
        const updatedReceivedLinks = userData.receivedLinks.map(
          (link: { id: any }) =>
            link.id === linkId ? { ...link, status } : link,
        );
        await updateDoc(userRef, { receivedLinks: updatedReceivedLinks });

        // Sync local storage so badge updates even if popup is closed
        const updatedUser = {
          ...currentUser,
          receivedLinks: updatedReceivedLinks,
        };
        chrome.storage.local.set({ user: updatedUser });
      }

      // Update sender's sharedLinks using friend UID from local friends list
      const friends: any[] = currentUser.friends || [];
      const sender = friends.find((f: any) => f.username === senderUsername);

      if (sender && sender.uid) {
        console.log(
          `Updating sender ${senderUsername} (uid: ${sender.uid}) sharedLinks status`,
        );
        try {
          const senderRef = doc(db, "users", sender.uid);
          const senderSnap = await getDoc(senderRef);

          if (!senderSnap.exists()) {
            console.error(`Sender doc does not exist for uid: ${sender.uid}`);
          } else {
            const senderData = senderSnap.data();
            console.log(
              `Sender doc read success. sharedLinks count: ${(senderData.sharedLinks || []).length}`,
            );

            if (senderData && senderData.sharedLinks) {
              const updatedSharedLinks = senderData.sharedLinks.map(
                (link: { id: any }) =>
                  link.id === linkId ? { ...link, status } : link,
              );
              await updateDoc(senderRef, { sharedLinks: updatedSharedLinks });
              console.log(
                `Sender sharedLinks status updated to ${status} for linkId ${linkId}`,
              );
            } else {
              console.error("Sender has no sharedLinks array");
            }
          }
        } catch (senderError) {
          console.error("Error updating sender's sharedLinks:", senderError);
        }
      } else {
        try {
          const resolvedSender =
            await resolveFriendRefByUsername(senderUsername);
          if (resolvedSender) {
            console.log(
              `Updating sender ${senderUsername} (resolved uid: ${resolvedSender.uid}) sharedLinks status`,
            );

            const senderSnap = await getDoc(resolvedSender.ref);
            if (senderSnap.exists()) {
              const senderData = senderSnap.data();
              if (senderData && senderData.sharedLinks) {
                const updatedSharedLinks = senderData.sharedLinks.map(
                  (link: { id: any }) =>
                    link.id === linkId ? { ...link, status } : link,
                );
                await updateDoc(resolvedSender.ref, {
                  sharedLinks: updatedSharedLinks,
                });
              }
            }
          } else {
            console.error(
              `Sender ${senderUsername} not found in local friends list or by username lookup. Friends:`,
              JSON.stringify(friends.map((f: any) => f.username)),
            );
          }
        } catch (senderResolveError) {
          console.error(
            "Error resolving sender by username:",
            senderResolveError,
          );
        }
      }
    } catch (error) {
      console.error("Error updating link status:", error);
      sendResponse({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update link status",
      });
      return;
    }

    sendResponse({ success: true });
  });
}

export async function shareLink(link: string, selectedFriends: string[]) {
  const normalizedSelectedFriends = Array.from(
    new Set(
      selectedFriends
        .map((friendUsername) => normalizeRecipientUsername(friendUsername))
        .filter(Boolean),
    ),
  );

  console.log("=== SHARE_LINK CALLED ===");
  console.log("Link:", link);
  console.log("Selected friends:", normalizedSelectedFriends);

  try {
    const userDataRaw = await new Promise<{ [key: string]: any }>((resolve) => {
      chrome.storage.local.get(["user"], (result) => resolve(result.user));
    });

    console.log("Current user:", userDataRaw?.username, userDataRaw?.uid);

    if (!userDataRaw) throw new Error("No user logged in");
    if (normalizedSelectedFriends.length === 0) {
      throw new Error("Please select at least one friend");
    }

    const linkId = Date.now().toString();
    const timestamp = new Date().toISOString();

    const sharedLinkData = {
      id: linkId,
      link,
      sender: userDataRaw.username,
      timestamp,
      recipients: normalizedSelectedFriends,
      status: "unseen",
    };

    // Look up friend UIDs from the local friends list (avoids Firestore read permission issue)
    const friends: any[] = userDataRaw.friends || [];
    const friendRefsByUid = new Map<string, { ref: any; username: string }>();

    for (const friendUsername of normalizedSelectedFriends) {
      const friend = friends.find(
        (f: any) => normalizeRecipientUsername(f?.username) === friendUsername,
      );
      if (friend && friend.uid) {
        console.log(
          `Found friend locally: ${friendUsername} -> uid: ${friend.uid}`,
        );
        if (!friendRefsByUid.has(friend.uid)) {
          friendRefsByUid.set(friend.uid, {
            ref: doc(db, "users", friend.uid),
            username: friendUsername,
          });
        }
      } else {
        const resolvedFriend = await resolveFriendRefByUsername(friendUsername);
        if (resolvedFriend?.uid) {
          console.log(
            `Resolved friend by username: ${friendUsername} -> uid: ${resolvedFriend.uid}`,
          );
          if (!friendRefsByUid.has(resolvedFriend.uid)) {
            friendRefsByUid.set(resolvedFriend.uid, {
              ref: resolvedFriend.ref,
              username: friendUsername,
            });
          }
        } else {
          console.error(
            `Friend ${friendUsername} not found in local list or by username lookup`,
          );
        }
      }
    }

    const friendRefs = Array.from(friendRefsByUid.values());

    console.log(
      `Total friends resolved: ${friendRefs.length} of ${normalizedSelectedFriends.length}`,
    );

    if (friendRefs.length === 0) {
      throw new Error(
        "Could not resolve any selected friend. Remove and re-add your friend, then try again.",
      );
    }

    if (friendRefs.length !== normalizedSelectedFriends.length) {
      throw new Error(
        "Some selected friends could not be resolved. Remove and re-add those friends, then try again.",
      );
    }

    // Update sender's sharedLinks
    const userRef = doc(db, "users", userDataRaw.uid);
    await updateDoc(userRef, {
      sharedLinks: arrayUnion(sharedLinkData),
    });
    console.log("Sender sharedLinks updated");

    // Update each recipient's receivedLinks individually
    for (const { ref, username } of friendRefs) {
      const receivedLinkData = {
        id: linkId,
        link,
        sender: userDataRaw.username,
        timestamp,
        status: "unseen",
      };

      console.log(
        `Updating receivedLinks for ${username}:`,
        JSON.stringify(receivedLinkData),
      );
      await updateDoc(ref, {
        receivedLinks: arrayUnion(receivedLinkData),
      });
      console.log(`receivedLinks updated for ${username}`);
    }

    console.log("All writes completed successfully!");

    // Update local storage with the new shared link
    const updatedUser = {
      ...userDataRaw,
      sharedLinks: [...(userDataRaw.sharedLinks || []), sharedLinkData],
    };
    chrome.storage.local.set({ user: updatedUser });

    chrome.runtime.sendMessage({
      type: "SHARE_LINK_SUCCESS",
    });
  } catch (error) {
    console.error("Error sharing link:", error);
    chrome.runtime.sendMessage({
      type: "SHARE_LINK_ERROR",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });

    throw error;
  }
}
