import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from "react";
import { User } from "firebase/auth/web-extension";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";

interface SharedLink {
  id: string;
  link: string;
  sender: string;
  recipients: string[];
  timestamp: string;
  status: "unseen" | "seen" | "opened";
  kind?: "link" | "friend_added";
}

interface ReceivedLink {
  id: string;
  link: string;
  sender: string;
  timestamp: string;
  status: "unseen" | "seen" | "opened";
  kind?: "link" | "friend_added";
}

interface Friend {
  uid?: string;
  username: string;
  displayName: string;
  email: string;
  photoURL: string;
  addedAt: string;
}

interface UserSettings {
  showLinkPreviews?: boolean;
}

interface ExtendedUser extends User {
  username?: string;
  friends?: Friend[];
  sharedLinks?: SharedLink[];
  receivedLinks?: ReceivedLink[];
  settings?: UserSettings;
}

interface AuthContextType {
  currentUser: ExtendedUser | null;
  signIn: () => void;
  signOut: () => void;
  isLoading: boolean;
  error: string | null;
  addFriend: (friendUsername: string, friendUid?: string) => Promise<void>;
  searchUser: (username: string) => Promise<ExtendedUser | null>;
  removeFriend: (friendUsername: string) => Promise<void>;
  shareLink: (link: string, selectedFriends: string[]) => Promise<void>;
  updateLinkStatus: (
    linkId: string,
    status: "unseen" | "seen" | "opened",
  ) => Promise<void>;
  isNewUser: boolean;
  completeOnboarding: () => void;
  deleteAccount: () => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
}

function normalizeFriendUsername(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^@/, "").toLowerCase();
}

function friendIdentity(friend: Partial<Friend> | null | undefined): string {
  const uid = typeof friend?.uid === "string" ? friend.uid.trim() : "";
  if (uid) {
    return `uid:${uid}`;
  }

  const username = normalizeFriendUsername(friend?.username);
  return username ? `username:${username}` : "";
}

function sanitizeFriend(
  friend: Partial<Friend> | null | undefined,
): Friend | null {
  if (!friend) return null;

  const uid = typeof friend.uid === "string" ? friend.uid.trim() : "";
  const username = normalizeFriendUsername(friend.username);

  if (!uid && !username) {
    return null;
  }

  return {
    uid: uid || undefined,
    username,
    displayName:
      typeof friend.displayName === "string" ? friend.displayName : "",
    email: typeof friend.email === "string" ? friend.email : "",
    photoURL: typeof friend.photoURL === "string" ? friend.photoURL : "",
    addedAt:
      typeof friend.addedAt === "string" && friend.addedAt
        ? friend.addedAt
        : new Date().toISOString(),
  };
}

function mergeFriend(existing: Friend, incoming: Friend): Friend {
  return {
    uid: incoming.uid || existing.uid,
    username: incoming.username || existing.username,
    displayName: incoming.displayName || existing.displayName || "",
    email: incoming.email || existing.email || "",
    photoURL: incoming.photoURL || existing.photoURL || "",
    addedAt: existing.addedAt || incoming.addedAt || new Date().toISOString(),
  };
}

function dedupeFriendsByIdentity(
  friends: Array<Partial<Friend> | null | undefined>,
): Friend[] {
  const byIdentity = new Map<string, Friend>();

  friends.forEach((friend) => {
    const sanitized = sanitizeFriend(friend);
    if (!sanitized) return;

    const key = friendIdentity(sanitized);
    const existing = byIdentity.get(key);
    if (existing) {
      byIdentity.set(key, mergeFriend(existing, sanitized));
      return;
    }
    byIdentity.set(key, sanitized);
  });

  return Array.from(byIdentity.values());
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<ExtendedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false); // Added isNewUser state

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let linksUnsubscribe: (() => void) | undefined;

    const messageListener = (message: any) => {
      if (message.type === "SIGN_IN_COMPLETE") {
        setCurrentUser({
          ...message.user,
          friends: dedupeFriendsByIdentity(message.user?.friends || []),
        });
        setIsNewUser(!!message.user.isNewUser); // Set isNewUser based on the user data
        setIsLoading(false);
        setError(null);
      } else if (message.type === "SIGN_IN_ERROR") {
        setCurrentUser(null);
        setIsLoading(false);
        setError(message.error);
      } else if (message.type === "SIGN_OUT_COMPLETE") {
        setCurrentUser(null);
        setIsNewUser(false); // Reset isNewUser on sign out
        setIsLoading(false);
      } else if (message.type === "SIGN_OUT_ERROR") {
        setError(message.error);
        setIsLoading(false);
      } else if (message.type === "DELETE_ACCOUNT_COMPLETE") {
        setCurrentUser(null);
        setIsNewUser(false);
        setIsLoading(false);
      } else if (message.type === "DELETE_ACCOUNT_ERROR") {
        setError(message.error);
        setIsLoading(false);
      } else if (message.type === "FRIEND_ADDED") {
        setCurrentUser((prevUser) =>
          prevUser
            ? {
                ...prevUser,
                friends: dedupeFriendsByIdentity(message.friends || []),
              }
            : null,
        );
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Check for existing user in storage
    chrome.storage.local.get(["user"], (result) => {
      if (result.user) {
        const normalizedStoredUser = {
          ...result.user,
          friends: dedupeFriendsByIdentity(result.user.friends || []),
        };
        setCurrentUser(normalizedStoredUser);
        setIsNewUser(!!normalizedStoredUser.isNewUser); // Set isNewUser based on stored data
        chrome.storage.local.set({ user: normalizedStoredUser });

        // Set up real-time listener when user is loaded
        const userRef = doc(db, "users", normalizedStoredUser.uid);

        // Fetch fresh data from Firestore immediately on popup open
        getDoc(userRef)
          .then((freshSnap) => {
            if (freshSnap.exists()) {
              const freshData = freshSnap.data();
              setCurrentUser((prevUser) => {
                if (prevUser) {
                  const updatedUser = {
                    ...prevUser,
                    ...freshData,
                    friends: dedupeFriendsByIdentity(freshData.friends || []),
                  };
                  chrome.storage.local.set({ user: updatedUser });
                  return updatedUser;
                }
                return null;
              });
              setIsNewUser(!!freshData.isNewUser);
            }
          })
          .catch((err) => console.error("Error fetching fresh data:", err));

        unsubscribe = onSnapshot(
          userRef,
          (doc) => {
            if (doc.exists()) {
              const userData = doc.data();
              setCurrentUser((prevUser) => {
                if (prevUser) {
                  const updatedUser = {
                    ...prevUser,
                    ...userData,
                    friends: dedupeFriendsByIdentity(userData.friends || []),
                  };
                  setIsNewUser(!!userData.isNewUser); // Update isNewUser state
                  // Update chrome storage
                  chrome.storage.local.set({ user: updatedUser });
                  return updatedUser;
                }
                return null;
              });
            }
          },
          (snapshotError) => {
            console.error("User snapshot listener error:", snapshotError);
          },
        );

        linksUnsubscribe = onSnapshot(
          userRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              setCurrentUser((prevUser) => {
                if (prevUser) {
                  const updatedUser = {
                    ...prevUser,
                    sharedLinks: data.sharedLinks || [],
                    receivedLinks: data.receivedLinks || [],
                  };
                  chrome.storage.local.set({ user: updatedUser });
                  return updatedUser;
                }
                return null;
              });
            }
          },
          (snapshotError) => {
            console.error("Links snapshot listener error:", snapshotError);
          },
        );
      }
      setIsLoading(false); // Keep this outside the if condition
    });

    // Return cleanup function at the useEffect level
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      if (unsubscribe) {
        unsubscribe();
      }
      if (linksUnsubscribe) linksUnsubscribe();
    };
  }, []);

  const signIn = () => {
    setIsLoading(true);
    chrome.runtime.sendMessage({ type: "SIGN_IN" });
  };

  const signOut = () => {
    setIsLoading(true);
    setError(null);
    chrome.runtime.sendMessage({ type: "SIGN_OUT" });
  };

  const deleteAccount = async () => {
    if (!currentUser) throw new Error("No user logged in");

    try {
      // Send delete request to background script
      chrome.runtime.sendMessage({
        type: "DELETE_ACCOUNT",
        uid: currentUser.uid,
      });

      // Let the background script handle the actual deletion
      // We'll update states when we receive the DELETE_ACCOUNT_COMPLETE message
    } catch (error) {
      console.error("Error initiating account deletion:", error);
      throw new Error("Failed to delete account");
    }
  };

  const addFriend = async (friendUsername: string, friendUid?: string) => {
    if (!currentUser) throw new Error("No user logged in");
    try {
      const response = await new Promise<{
        success: boolean;
        error?: string;
        newFriend?: Friend;
      }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "ADD_FRIEND", currentUser, friendUsername, friendUid },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!response) {
              reject(new Error("No response from background script"));
            } else {
              resolve(response);
            }
          },
        );
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to add friend");
      }

      if (!response.newFriend) {
        throw new Error("New friend data is missing");
      }

      const newFriend = sanitizeFriend(response.newFriend);
      if (!newFriend) {
        throw new Error("New friend data is invalid");
      }

      // Update local state with complete friend data
      setCurrentUser((prevUser) => {
        if (!prevUser) return null;
        const updatedFriends = dedupeFriendsByIdentity([
          ...(prevUser.friends || []),
          newFriend,
        ]);
        return { ...prevUser, friends: updatedFriends };
      });

      // Update chrome storage with complete friend data
      chrome.storage.local.get(["user"], (result) => {
        if (result.user) {
          const updatedUser = {
            ...result.user,
            friends: dedupeFriendsByIdentity([
              ...(result.user.friends || []),
              newFriend,
            ]),
          };
          chrome.storage.local.set({ user: updatedUser });
        }
      });
    } catch (error) {
      console.error("Error adding friend:", error);
      throw error;
    }
  };

  const removeFriend = async (friendUsername: string) => {
    if (!currentUser) throw new Error("No user logged in");

    const normalizedTargetUsername = normalizeFriendUsername(friendUsername);
    if (!normalizedTargetUsername) {
      throw new Error("Invalid friend username");
    }

    try {
      const userRef = doc(db, "users", currentUser.uid);
      const friendQuery = query(
        collection(db, "users"),
        where("username", "==", normalizedTargetUsername),
      );
      const [friendSnapshot, userSnapshot] = await Promise.all([
        getDocs(friendQuery),
        getDoc(userRef),
      ]);

      if (friendSnapshot.empty) {
        throw new Error("Friend not found");
      }

      if (!userSnapshot.exists()) {
        throw new Error("Current user not found");
      }

      const friendDoc = friendSnapshot.docs[0];
      const friendRef = doc(db, "users", friendDoc.id);
      const friendData = friendDoc.data();

      const currentFriends = dedupeFriendsByIdentity(
        Array.isArray(userSnapshot.data().friends)
          ? (userSnapshot.data().friends as Friend[])
          : currentUser.friends || [],
      );

      const updatedCurrentFriends = currentFriends.filter((friend) => {
        const sameUid = !!friend.uid && friend.uid === friendDoc.id;
        const sameUsername =
          normalizeFriendUsername(friend.username) === normalizedTargetUsername;
        return !(sameUid || sameUsername);
      });

      const friendFriends = dedupeFriendsByIdentity(
        Array.isArray(friendData.friends)
          ? (friendData.friends as Friend[])
          : [],
      );

      const currentUserUsername = normalizeFriendUsername(currentUser.username);
      const updatedFriendFriends = friendFriends.filter((friend) => {
        const sameUid = !!friend.uid && friend.uid === currentUser.uid;
        const sameUsername =
          !!currentUserUsername &&
          normalizeFriendUsername(friend.username) === currentUserUsername;
        return !(sameUid || sameUsername);
      });

      await Promise.all([
        updateDoc(userRef, { friends: updatedCurrentFriends }),
        updateDoc(friendRef, { friends: updatedFriendFriends }),
      ]);

      setCurrentUser((prevUser) => {
        if (!prevUser) return null;
        return { ...prevUser, friends: updatedCurrentFriends };
      });

      // Update local storage
      chrome.storage.local.get(["user"], (result) => {
        if (result.user) {
          const updatedUser = {
            ...result.user,
            friends: updatedCurrentFriends,
          };
          chrome.storage.local.set({ user: updatedUser });
        }
      });
    } catch (error) {
      console.error("Error removing friend:", error);
      throw new Error("Failed to remove friend");
    }
  };

  const searchUser = async (
    searchTerm: string,
  ): Promise<ExtendedUser | null> => {
    try {
      const normalizedSearchTerm = searchTerm.trim().replace(/^@/, "");
      if (!normalizedSearchTerm) return null;

      const usersRef = collection(db, "users");
      let q = query(usersRef, where("username", "==", normalizedSearchTerm));
      let querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        q = query(
          usersRef,
          where("username", "==", normalizedSearchTerm.toLowerCase()),
        );
        querySnapshot = await getDocs(q);
      }

      if (querySnapshot.empty) {
        // If no user found by username, search by email
        q = query(usersRef, where("email", "==", normalizedSearchTerm));
        querySnapshot = await getDocs(q);
      }

      if (querySnapshot.empty) return null;

      const userDoc = querySnapshot.docs[0];

      return { ...userDoc.data(), uid: userDoc.id } as ExtendedUser;
    } catch (error) {
      console.error("Error searching for user:", error);
      throw new Error("Failed to search for user");
    }
  };

  const shareLink = async (link: string, selectedFriends: string[]) => {
    if (!currentUser) throw new Error("No user logged in");
    try {
      const response = await new Promise<{
        success: boolean;
        error?: string;
      }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "SHARE_LINK", link, selectedFriends },
          (messageResponse) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!messageResponse) {
              reject(new Error("No response from background script"));
            } else {
              resolve(messageResponse);
            }
          },
        );
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to share link");
      }
    } catch (error) {
      console.error("Error sharing link:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to share link");
    }
  };

  // Update the updateLinkStatus function in AuthContext:

  const updateLinkStatus = async (
    linkId: string,
    status: "unseen" | "seen" | "opened",
  ) => {
    if (!currentUser) throw new Error("No user logged in");
    try {
      // Update receiver's receivedLinks
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();

      if (userData && userData.receivedLinks) {
        const updatedReceivedLinks = userData.receivedLinks.map(
          (link: ReceivedLink) =>
            link.id === linkId ? { ...link, status } : link,
        );

        await updateDoc(userRef, { receivedLinks: updatedReceivedLinks });

        // Update local state
        setCurrentUser((prevUser) => {
          if (!prevUser) return null;
          const updatedUser = {
            ...prevUser,
            receivedLinks: updatedReceivedLinks,
          };
          chrome.storage.local.set({ user: updatedUser });
          return updatedUser;
        });
      }
    } catch (error) {
      console.error("Error updating link status:", error);
      throw new Error("Failed to update link status");
    }
  };

  const updateSettings = async (
    settings: Partial<{ showLinkPreviews?: boolean }>,
  ) => {
    if (!currentUser) throw new Error("No user logged in");
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const newSettings = {
        ...currentUser.settings,
        ...settings,
      };

      await updateDoc(userRef, { settings: newSettings });

      // Update local state
      setCurrentUser((prevUser) => {
        if (!prevUser) return null;
        const updatedUser = {
          ...prevUser,
          settings: newSettings,
        };
        // Update chrome storage
        chrome.storage.local.set({ user: updatedUser });
        return updatedUser;
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      throw new Error("Failed to update settings");
    }
  };

  const updateUsername = async (nextUsername: string) => {
    if (!currentUser) throw new Error("No user logged in");

    const normalizedUsername = nextUsername
      .trim()
      .replace(/^@/, "")
      .toLowerCase();
    const usernamePattern = /^[a-z0-9_]{3,20}$/;

    if (!usernamePattern.test(normalizedUsername)) {
      throw new Error(
        "Username must be 3-20 characters and use only lowercase letters, numbers, or underscores",
      );
    }

    if (normalizedUsername === currentUser.username) {
      return;
    }

    try {
      const usersRef = collection(db, "users");
      const usernameQuery = query(
        usersRef,
        where("username", "==", normalizedUsername),
      );
      const usernameSnapshot = await getDocs(usernameQuery);

      const takenByAnotherUser = usernameSnapshot.docs.some(
        (snapshotDoc) => snapshotDoc.id !== currentUser.uid,
      );

      if (takenByAnotherUser) {
        throw new Error("That username is already taken");
      }

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { username: normalizedUsername });

      setCurrentUser((prevUser) => {
        if (!prevUser) return null;
        const updatedUser = { ...prevUser, username: normalizedUsername };
        chrome.storage.local.set({ user: updatedUser });
        return updatedUser;
      });
    } catch (error) {
      console.error("Error updating username:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to update username");
    }
  };

  const completeOnboarding = () => {
    // Added completeOnboarding function
    setIsNewUser(false);
    if (currentUser) {
      const userRef = doc(db, "users", currentUser.uid);
      updateDoc(userRef, { isNewUser: false });
      setCurrentUser((prevUser) =>
        prevUser ? { ...prevUser, isNewUser: false } : null,
      );
    }
  };

  const value = {
    currentUser,
    signIn,
    signOut,
    isLoading,
    error,
    addFriend,
    searchUser,
    removeFriend,
    shareLink,
    updateLinkStatus,
    isNewUser,
    completeOnboarding,
    deleteAccount,
    updateSettings,
    updateUsername,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
