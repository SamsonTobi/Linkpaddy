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
  writeBatch,
} from "firebase/firestore";

type SharedLink = {
  id: string;
  link: string;
  sender: string;
  timestamp: string;
  recipients: string[];
  status: string;
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "shareLinkMenu",
    title: "Share this site with Link Sharing Extension",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "shareLinkMenu" && tab && tab.url) {
    // Store the URL in local storage
    chrome.storage.local.set({ shareUrl: tab.url }, () => {
      // Open the extension popup
      chrome.action.openPopup();
    });
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
        sendResponse({ success: true, newFriend: result.newFriend })
      )
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Indicates that the response is sent asynchronously
  } else if (message.type === "SHARE_LINK") {
    shareLink(message.link, message.selectedFriends);
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
              link.id === linkId ? { ...link, status } : link
          );
          await updateDoc(userRef, { receivedLinks: updatedReceivedLinks });
        }

        // Update sender's document
        const senderQuery = query(
          collection(db, "users"),
          where("username", "==", senderUsername)
        );
        const senderSnapshot = await getDocs(senderQuery);

        if (!senderSnapshot.empty) {
          const senderDoc = senderSnapshot.docs[0];
          const senderRef = doc(db, "users", senderDoc.id);
          const senderData = senderDoc.data();

          if (senderData && senderData.sharedLinks) {
            const updatedSharedLinks = senderData.sharedLinks.map(
              (link: { id: any }) =>
                link.id === linkId ? { ...link, status } : link
            );
            await updateDoc(senderRef, { sharedLinks: updatedSharedLinks });
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
    const token = await new Promise<string>((resolve, reject) => {
      chrome.identity.clearAllCachedAuthTokens(() => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          if (token) {
            resolve(token);
          } else {
            reject("Token is undefined");
          }
        });
      });
    });

    const response = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const userInfo = await response.json();

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
        resolve
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
    await firebaseSignOut(auth);

    chrome.identity.getAuthToken(
      { interactive: false },
      async function (token) {
        if (token) {
          await fetch(
            `https://accounts.google.com/o/oauth2/revoke?token=${token}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
            }
          );

          chrome.identity.removeCachedAuthToken({ token }, () => {
            chrome.identity.clearAllCachedAuthTokens(() => {
              chrome.storage.local.clear(() => {
                chrome.runtime.sendMessage({ type: "SIGN_OUT_COMPLETE" });
              });
            });
          });
        }
      }
    );
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
        where("friends", "array-contains", userData.username)
      );
      const friendsSnapshot = await getDocs(friendsQuery);

      await Promise.all(
        friendsSnapshot.docs.map((friendDoc) =>
          updateDoc(doc(db, "users", friendDoc.id), {
            friends: arrayRemove(userData.username),
          })
        )
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
        }
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

async function addFriend(
  currentUser: {
    uid: string;
    username: any;
    displayName: any;
    email: any;
    photoURL: any;
  },
  friendUsername: unknown
) {
  try {
    const userRef = doc(db, "users", currentUser.uid);
    const friendQuery = query(
      collection(db, "users"),
      where("username", "==", friendUsername)
    );
    const friendSnapshot = await getDocs(friendQuery);

    if (friendSnapshot.empty) {
      throw new Error("Friend not found");
    }

    const friendDoc = friendSnapshot.docs[0];
    const friendData = friendDoc.data();
    const friendRef = doc(db, "users", friendDoc.id);

    // Create complete friend objects for both users
    const newFriendForCurrentUser = {
      uid: friendDoc.id,
      username: friendData.username,
      displayName: friendData.displayName || "",
      email: friendData.email || "",
      photoURL: friendData.photoURL || "",
      addedAt: new Date().toISOString(),
    };

    const currentUserAsFriend = {
      uid: currentUser.uid,
      username: currentUser.username,
      displayName: currentUser.displayName || "",
      email: currentUser.email || "",
      photoURL: currentUser.photoURL || "",
      addedAt: new Date().toISOString(),
    };

    // Update both users' documents atomically
    const batch = writeBatch(db);

    batch.update(userRef, {
      friends: arrayUnion(newFriendForCurrentUser),
    });

    batch.update(friendRef, {
      friends: arrayUnion(currentUserAsFriend),
    });

    await batch.commit();

    return { newFriend: newFriendForCurrentUser };
  } catch (error) {
    console.error("Error adding friend:", error);
    throw error;
  }
}

async function shareLink(link: string, selectedFriends: string[]) {
  try {
    const userDataRaw = await new Promise<{ [key: string]: any }>((resolve) => {
      chrome.storage.local.get(["user"], (result) => resolve(result.user));
    });

    if (!userDataRaw) throw new Error("No user logged in");

    const linkId = Date.now().toString(); // Generate unique ID

    const sharedLinkData = {
      id: linkId,
      link,
      sender: userDataRaw.username,
      timestamp: new Date().toISOString(),
      recipients: selectedFriends,
      status: "unseen",
    };

    // Add shared link to sender's shared links
    const userRef = doc(db, "users", userDataRaw.uid);
    await updateDoc(userRef, {
      sharedLinks: arrayUnion(sharedLinkData),
    });

    // Add shared link to each recipient's received links
    for (const friendUsername of selectedFriends) {
      const friendQuery = query(
        collection(db, "users"),
        where("username", "==", friendUsername)
      );
      const friendSnapshot = await getDocs(friendQuery);
      if (!friendSnapshot.empty) {
        const friendDoc = friendSnapshot.docs[0];
        const friendRef = doc(db, "users", friendDoc.id);

        const receivedLinkData = {
          ...sharedLinkData,
          type: "received",
        };

        await updateDoc(friendRef, {
          receivedLinks: arrayUnion(receivedLinkData),
        });
      }
    }
  } catch (error) {
    console.error("Error sharing link:", error);
    chrome.runtime.sendMessage({
      type: "SHARE_LINK_ERROR",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}
