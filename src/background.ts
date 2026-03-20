import { auth, db } from "./firebase";
import {
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  query,
  collection,
  where,
  getDocs,
  arrayRemove,
  deleteDoc,
} from "firebase/firestore";

type SharedLink = {
  id: string;
  link: string;
  sender: string;
  timestamp: string;
  recipients: string[];
  status: string;
  kind?: "link" | "friend_added";
};

type Friend = {
  uid?: string;
  username?: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  addedAt?: string;
};

// ── Badge management ──────────────────────────────────────────────
async function updateBadge() {
  try {
    const result = await chrome.storage.local.get(["user"]);
    if (result.user && result.user.receivedLinks) {
      const unseenCount = result.user.receivedLinks.filter(
        (link: any) => link.status === "unseen" && link.kind !== "friend_added",
      ).length;
      if (unseenCount > 0) {
        chrome.action.setBadgeText({ text: unseenCount.toString() });
        chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
      } else {
        chrome.action.setBadgeText({ text: "" });
      }
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } catch (error) {
    console.error("Error updating badge:", error);
  }
}

async function checkForNewLinks() {
  try {
    const result = await chrome.storage.local.get(["user"]);
    if (!result.user || !result.user.uid) return;

    // Avoid Firestore permission-denied loops when auth is not restored yet.
    if (!auth.currentUser || auth.currentUser.uid !== result.user.uid) {
      return;
    }

    const userRef = doc(db, "users", result.user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      const oldReceivedLinks: SharedLink[] = result.user.receivedLinks || [];
      const newReceivedLinks: SharedLink[] = userData.receivedLinks || [];
      const oldFriends: Friend[] = result.user.friends || [];
      const newFriends: Friend[] = userData.friends || [];

      // Find truly new links by comparing IDs
      const oldLinkIds = new Set(oldReceivedLinks.map((l) => l.id));
      const brandNewLinks = newReceivedLinks.filter(
        (l) => !oldLinkIds.has(l.id) && l.status === "unseen",
      );

      const oldFriendKeys = new Set(
        oldFriends
          .map((f) => f.uid || f.username)
          .filter((key): key is string => !!key),
      );
      const brandNewFriends = newFriends.filter((f) => {
        const key = f.uid || f.username;
        return !!key && !oldFriendKeys.has(key);
      });

      const brandNewShareLinks = brandNewLinks.filter(
        (link) => link.kind !== "friend_added",
      );
      const brandNewFriendEvents = brandNewLinks.filter(
        (link) => link.kind === "friend_added",
      );

      // Show a notification for each new shared link received
      for (const newLink of brandNewShareLinks) {
        showLinkNotification(newLink);
      }

      // Friend-added events should notify once, then be marked seen.
      for (const friendEvent of brandNewFriendEvents) {
        showFriendNotification({ username: friendEvent.sender });
      }

      for (const newFriend of brandNewFriends) {
        showFriendNotification(newFriend);
      }

      const normalizedReceivedLinks = newReceivedLinks.map((link) => {
        if (link.kind === "friend_added" && link.status === "unseen") {
          return { ...link, status: "seen" };
        }
        return link;
      });

      const shouldPersistSeenFriendEvents = normalizedReceivedLinks.some(
        (link, index) => link.status !== newReceivedLinks[index]?.status,
      );

      if (shouldPersistSeenFriendEvents) {
        await updateDoc(userRef, { receivedLinks: normalizedReceivedLinks });
      }

      const updatedUser = {
        ...result.user,
        receivedLinks: normalizedReceivedLinks,
        sharedLinks: userData.sharedLinks || [],
        friends: userData.friends || [],
      };
      await chrome.storage.local.set({ user: updatedUser });
    }
  } catch (error) {
    console.error("Error checking for new links:", error);
  }
}

// ── Notifications ──────────────────────────────────────────────────
function showLinkNotification(link: SharedLink) {
  const notificationId = `link-${link.id}`;
  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "New link from " + link.sender,
    message: link.link,
    priority: 2,
  });
}

function showFriendNotification(friend: Friend) {
  const identity = friend.uid || friend.username || Date.now().toString();
  const friendName = friend.displayName || friend.username || "Someone";
  const notificationId = `friend-${identity}`;

  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "New friend added",
    message: `${friendName} added you as a friend.`,
    priority: 2,
  });
}

function openExtensionUi() {
  chrome.action.openPopup(() => {
    if (!chrome.runtime.lastError) {
      return;
    }

    chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
  });
}

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
  if (alarm.name === "checkNewLinks") {
    await checkForNewLinks();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "shareLinkMenu",
    title: "Share this site with LinkPaddy",
    contexts: ["page"],
  });
  chrome.alarms.create("checkNewLinks", { periodInMinutes: 0.5 });
  updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("checkNewLinks", { periodInMinutes: 0.5 });
  updateBadge();
});

// Refresh data when popup connects (user opens the extension)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    console.log("Popup opened, refreshing data...");
    checkForNewLinks();

    // Keep refreshing while popup is open (every 5 seconds)
    const intervalId = setInterval(() => {
      checkForNewLinks();
    }, 5000);

    port.onDisconnect.addListener(() => {
      console.log("Popup closed, stopping live refresh");
      clearInterval(intervalId);
    });
  }
});

// Initial badge check when service worker starts
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
  if (command === "share-current-tab") {
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
    addFriend(message.currentUser, message.friendUsername)
      .then((result) =>
        sendResponse({ success: true, newFriend: result.newFriend }),
      )
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Indicates that the response is sent asynchronously
  } else if (message.type === "SHARE_LINK") {
    shareLink(message.link, message.selectedFriends);
  } else if (message.type === "REFRESH_DATA") {
    checkForNewLinks()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.type === "UPDATE_LINK_STATUS") {
    const { linkId, status, senderUsername } = message;

    // Get current user data first
    chrome.storage.local.get(["user"], async (result) => {
      const currentUser = result.user;
      if (!currentUser) return;

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
      }
    });
  }
});

async function signIn() {
  try {
    // Use launchWebAuthFlow for Edge compatibility
    const redirectUri = chrome.identity.getRedirectURL();
    const clientId =
      "309540318772-nsj2lle011ifcke7f3l5opp9ql9pr013.apps.googleusercontent.com";
    const scopes = [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "openid",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("scope", scopes);

    const responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.toString(),
          interactive: true,
        },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(
              new Error(chrome.runtime.lastError.message || "Auth flow failed"),
            );
            return;
          }
          if (redirectUrl) {
            resolve(redirectUrl);
          } else {
            reject(new Error("No redirect URL received"));
          }
        },
      );
    });

    // Extract access token from the redirect URL
    const url = new URL(responseUrl.replace("#", "?"));
    const token = url.searchParams.get("access_token");

    if (!token) {
      throw new Error("No access token in response");
    }

    const response = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch user info");
    }

    const userInfo = await response.json();

    // Use the access token with GoogleAuthProvider
    const credential = GoogleAuthProvider.credential(null, token);
    const result = await signInWithCredential(auth, credential);
    const user = result.user;

    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    let userData;
    if (!userDoc.exists()) {
      const baseName = (user.displayName || "user")
        .toLowerCase()
        .replace(/\s+/g, "");
      const randomNum = Math.floor(Math.random() * 10000);
      const username = `${baseName}${randomNum}`;

      userData = {
        uid: user.uid,
        email: user.email,
        username: username,
        displayName: user.displayName,
        photoURL: user.photoURL,
        friends: [],
        pendingInvites: [],
        isNewUser: true, // Explicitly set this flag
      };
      await setDoc(userRef, userData);
    } else {
      userData = userDoc.data();
      userData.isNewUser = false; // Ensure this is set for existing users
    }

    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        {
          user: {
            ...userData,
            displayName: user.displayName,
            photoURL: user.photoURL,
          },
        },
        resolve,
      );
    });

    chrome.runtime.sendMessage({
      type: "SIGN_IN_COMPLETE",
      user: {
        ...userData,
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
    });
  } catch (error) {
    console.error("Sign-in error:", error);
    chrome.runtime.sendMessage({
      type: "SIGN_IN_ERROR",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

async function handleSignOut() {
  try {
    chrome.action.setBadgeText({ text: "" });
    await firebaseSignOut(auth);

    // Clear all cached auth tokens and local storage
    chrome.identity.clearAllCachedAuthTokens(() => {
      chrome.storage.local.clear(() => {
        chrome.runtime.sendMessage({ type: "SIGN_OUT_COMPLETE" });
      });
    });
  } catch (error) {
    console.error("Sign-out error:", error);
    chrome.runtime.sendMessage({
      type: "SIGN_OUT_ERROR",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

async function deleteUser(uid: string) {
  try {
    // Get the current user data from storage
    const userData = await new Promise<{
      uid: string;
      username?: string;
      [key: string]: any;
    }>((resolve, reject) => {
      chrome.storage.local.get(["user"], (result) => {
        if (!result.user) {
          reject(new Error("No user data found"));
          return;
        }
        resolve(result.user);
      });
    });

    // Verify the uid matches
    if (userData.uid !== uid) {
      throw new Error("User ID mismatch");
    }

    // Delete user document from Firestore
    const userRef = doc(db, "users", uid);
    await deleteDoc(userRef);

    // Clean up user from friends' lists if username exists
    if (userData.username) {
      const friendsQuery = query(
        collection(db, "users"),
        where("friends", "array-contains", userData.username),
      );
      const friendsSnapshot = await getDocs(friendsQuery);

      await Promise.all(
        friendsSnapshot.docs.map((friendDoc) =>
          updateDoc(doc(db, "users", friendDoc.id), {
            friends: arrayRemove(userData.username),
          }),
        ),
      );
    }

    // Handle Firebase Auth user deletion
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === uid) {
      // Get fresh token
      const token = await new Promise<string>((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          if (!token) {
            reject(new Error("No auth token available"));
            return;
          }
          resolve(token);
        });
      });

      // Revoke Google OAuth token
      await fetch(
        `https://accounts.google.com/o/oauth2/revoke?token=${token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      // Remove cached token
      await new Promise<void>((resolve, reject) => {
        chrome.identity.removeCachedAuthToken({ token }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          chrome.identity.clearAllCachedAuthTokens(() => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve();
          });
        });
      });

      // Delete the Firebase Auth user
      await currentUser.delete();
    }

    // Clear local storage
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    });

    // Send success message
    chrome.runtime.sendMessage({
      type: "DELETE_ACCOUNT_COMPLETE",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    chrome.runtime.sendMessage({
      type: "DELETE_ACCOUNT_ERROR",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
    throw error; // Re-throw error for handling by caller
  }
}

async function resolveFriendRefByUsername(friendUsername: string) {
  const friendSnapshot = await getDocs(
    query(collection(db, "users"), where("username", "==", friendUsername)),
  );

  if (friendSnapshot.empty) {
    return null;
  }

  const friendDoc = friendSnapshot.docs[0];
  return {
    ref: doc(db, "users", friendDoc.id),
    uid: friendDoc.id,
    username: friendUsername,
  };
}

async function addFriend(
  currentUser: {
    uid: string;
    username: any;
    displayName: any;
    email: any;
    photoURL: any;
  },
  friendUsername: unknown,
) {
  try {
    const rawFriendIdentifier =
      typeof friendUsername === "string" ? friendUsername : "";
    const normalizedIdentifier = rawFriendIdentifier.trim().replace(/^@/, "");

    if (!normalizedIdentifier) {
      throw new Error("Please enter a valid username or email");
    }

    const userRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error("Current user not found");
    }

    let friendSnapshot = await getDocs(
      query(
        collection(db, "users"),
        where("username", "==", normalizedIdentifier),
      ),
    );

    if (friendSnapshot.empty && normalizedIdentifier.includes("@")) {
      friendSnapshot = await getDocs(
        query(
          collection(db, "users"),
          where("email", "==", normalizedIdentifier),
        ),
      );
    }

    if (friendSnapshot.empty) {
      throw new Error("Friend not found");
    }

    const friendDoc = friendSnapshot.docs[0];
    const friendData = friendDoc.data();
    const friendRef = doc(db, "users", friendDoc.id);

    if (friendDoc.id === currentUser.uid) {
      throw new Error("You cannot add yourself as a friend");
    }

    const currentUserFriends: Friend[] = userDoc.data().friends || [];
    const existingFriend = currentUserFriends.find(
      (f) => f.username === friendData.username,
    );

    if (existingFriend) {
      return {
        newFriend: {
          username: existingFriend.username || friendData.username,
          displayName:
            existingFriend.displayName || friendData.displayName || "",
          email: existingFriend.email || friendData.email || "",
          photoURL: existingFriend.photoURL || friendData.photoURL || "",
          addedAt: existingFriend.addedAt || new Date().toISOString(),
        },
      };
    }

    // Create complete friend objects for both users
    const newFriendForCurrentUser = {
      username: friendData.username,
      displayName: friendData.displayName || "",
      email: friendData.email || "",
      photoURL: friendData.photoURL || "",
      addedAt: new Date().toISOString(),
    };

    // Always update current user's friend list.
    await updateDoc(userRef, {
      friends: arrayUnion(newFriendForCurrentUser),
    });

    // Send a notification event via recipient's receivedLinks (rules allow this key).
    try {
      await updateDoc(friendRef, {
        receivedLinks: arrayUnion({
          id: `friend-${Date.now()}`,
          link: "",
          sender: currentUser.username,
          timestamp: new Date().toISOString(),
          status: "unseen",
          kind: "friend_added",
        }),
      });
    } catch (friendNotificationError) {
      console.warn(
        "Friend notification write blocked by Firestore rules:",
        friendNotificationError,
      );
    }

    return { newFriend: newFriendForCurrentUser };
  } catch (error) {
    console.error("Error adding friend:", error);
    throw error;
  }
}

async function shareLink(link: string, selectedFriends: string[]) {
  console.log("=== SHARE_LINK CALLED ===");
  console.log("Link:", link);
  console.log("Selected friends:", selectedFriends);

  try {
    const userDataRaw = await new Promise<{ [key: string]: any }>((resolve) => {
      chrome.storage.local.get(["user"], (result) => resolve(result.user));
    });

    console.log("Current user:", userDataRaw?.username, userDataRaw?.uid);

    if (!userDataRaw) throw new Error("No user logged in");

    const linkId = Date.now().toString();
    const timestamp = new Date().toISOString();

    const sharedLinkData = {
      id: linkId,
      link,
      sender: userDataRaw.username,
      timestamp,
      recipients: selectedFriends,
      status: "unseen",
    };

    // Look up friend UIDs from the local friends list (avoids Firestore read permission issue)
    const friends: any[] = userDataRaw.friends || [];
    const friendRefs: { ref: any; username: string }[] = [];

    for (const friendUsername of selectedFriends) {
      const friend = friends.find((f: any) => f.username === friendUsername);
      if (friend && friend.uid) {
        console.log(
          `Found friend locally: ${friendUsername} -> uid: ${friend.uid}`,
        );
        friendRefs.push({
          ref: doc(db, "users", friend.uid),
          username: friendUsername,
        });
      } else {
        const resolvedFriend = await resolveFriendRefByUsername(friendUsername);
        if (resolvedFriend) {
          console.log(
            `Resolved friend by username: ${friendUsername} -> uid: ${resolvedFriend.uid}`,
          );
          friendRefs.push({
            ref: resolvedFriend.ref,
            username: friendUsername,
          });
        } else {
          console.error(
            `Friend ${friendUsername} not found in local list or by username lookup`,
          );
        }
      }
    }

    console.log(
      `Total friends resolved: ${friendRefs.length} of ${selectedFriends.length}`,
    );

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
  }
}
