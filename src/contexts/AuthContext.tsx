import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from "react";
import { User } from "firebase/auth/web-extension";

interface SharedLink {
  id: string;
  link: string;
  sender: string;
  recipients: string[];
  timestamp: string;
  status: "unseen" | "seen" | "opened";
  kind?: "link" | "friend_added" | "friend_request_received" | "friend_request_accepted" | "friend_request_rejected" | "friend_removed" | "auto_friend_added";
  senderProfile?: {
    uid: string;
    displayName: string;
    photoURL: string;
    email: string;
  };
}

interface ReceivedLink {
  id: string;
  link: string;
  sender: string;
  timestamp: string;
  status: "unseen" | "seen" | "opened";
  kind?: "link" | "friend_added" | "friend_request_received" | "friend_request_accepted" | "friend_request_rejected" | "friend_removed" | "auto_friend_added";
  senderProfile?: {
    uid: string;
    displayName: string;
    photoURL: string;
    email: string;
  };
}

interface Friend {
  uid?: string;
  username: string;
  displayName: string;
  email: string;
  photoURL: string;
  addedAt: string;
  status?: "accepted" | "request_sent" | "request_received" | "auto";
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
  isNewUser?: boolean;
}

interface AuthContextType {
  currentUser: ExtendedUser | null;
  signIn: () => void;
  signOut: () => void;
  isLoading: boolean;
  error: string | null;
  addFriend: (friendUsername: string, friendUid?: string) => Promise<void>;
  searchUser: (username: string) => Promise<ExtendedUser[]>;
  removeFriend: (friendUsername: string) => Promise<void>;
  shareLink: (link: string, selectedFriends: string[]) => Promise<void>;
  updateLinkStatus: (
    linkId: string,
    status: "unseen" | "seen" | "opened",
  ) => Promise<void>;
  acceptFriend: (friendUsername: string) => Promise<void>;
  rejectFriend: (friendUsername: string) => Promise<void>;
  isNewUser: boolean;
  completeOnboarding: () => Promise<void>;
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

  const sanitized: Friend = {
    ...(uid ? { uid } : {}),
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

  if (friend.status) {
    sanitized.status = friend.status;
  }

  return sanitized;
}

function mergeFriend(existing: Friend, incoming: Friend): Friend {
  const merged: Friend = {
    username: incoming.username || existing.username,
    displayName: incoming.displayName || existing.displayName || "",
    email: incoming.email || existing.email || "",
    photoURL: incoming.photoURL || existing.photoURL || "",
    addedAt: existing.addedAt || incoming.addedAt || new Date().toISOString(),
  };

  const uid = incoming.uid || existing.uid;
  const status = incoming.status || existing.status;

  if (uid) {
    merged.uid = uid;
  }
  if (status) {
    merged.status = status;
  }

  return merged;
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
    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === "local" && changes.user && changes.user.newValue) {
        const userData = changes.user.newValue;
        setCurrentUser({
          ...userData,
          friends: dedupeFriendsByIdentity(userData.friends || []),
        });
        setIsNewUser(!!userData.isNewUser);
      }
    };
    chrome.storage.onChanged.addListener(storageListener);

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
      } else if (message.type === "SIGN_OUT_FORCED") {
        // Firebase auth session was lost silently — show the login screen
        setCurrentUser(null);
        setIsNewUser(false);
        setIsLoading(false);
        setError("Your session expired. Please sign in again.");
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

      }
      setIsLoading(false); // Keep this outside the if condition
    });

    // Return cleanup function at the useEffect level
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.onChanged.removeListener(storageListener);
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

  const acceptFriend = async (friendUsername: string) => {
    if (!currentUser) throw new Error("No user logged in");
    const previousFriends = currentUser.friends || [];
    try {
      const updatedFriends = previousFriends.map((f) => {
        if (normalizeFriendUsername(f.username) === normalizeFriendUsername(friendUsername)) {
          return { ...f, status: "accepted" as const };
        }
        return f;
      });
      const updatedUser = { ...currentUser, friends: updatedFriends };
      setCurrentUser(updatedUser);
      chrome.storage.local.set({ user: updatedUser });

      const response = await new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: "ACCEPT_FRIEND",
            currentUser: { uid: currentUser.uid, username: currentUser.username },
            friendUsername,
          },
          (res) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(res);
            }
          },
        );
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to accept request");
      }
    } catch (err) {
      console.error("Error accepting friend, rolling back:", err);
      const revertedUser = { ...currentUser, friends: previousFriends };
      setCurrentUser(revertedUser);
      chrome.storage.local.set({ user: revertedUser });
      throw err;
    }
  };

  const rejectFriend = async (friendUsername: string) => {
    if (!currentUser) throw new Error("No user logged in");
    const previousFriends = currentUser.friends || [];
    try {
      const updatedFriends = previousFriends.filter(
        (f) => normalizeFriendUsername(f.username) !== normalizeFriendUsername(friendUsername),
      );
      const updatedUser = { ...currentUser, friends: updatedFriends };
      setCurrentUser(updatedUser);
      chrome.storage.local.set({ user: updatedUser });

      const response = await new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: "REJECT_FRIEND",
            currentUser: { uid: currentUser.uid, username: currentUser.username },
            friendUsername,
          },
          (res) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(res);
            }
          },
        );
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to reject request");
      }
    } catch (err) {
      console.error("Error rejecting friend, rolling back:", err);
      const revertedUser = { ...currentUser, friends: previousFriends };
      setCurrentUser(revertedUser);
      chrome.storage.local.set({ user: revertedUser });
      throw err;
    }
  };

  const removeFriend = async (friendUsername: string) => {
    if (!currentUser) throw new Error("No user logged in");

    const normalizedTargetUsername = normalizeFriendUsername(friendUsername);
    if (!normalizedTargetUsername) {
      throw new Error("Invalid friend username");
    }

    try {
      const response = await new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: "REMOVE_FRIEND",
            currentUser: { uid: currentUser.uid, username: currentUser.username },
            friendUsername: normalizedTargetUsername,
          },
          (res) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(res);
            }
          }
        );
      });

      if (!response || !response.success) {
        throw new Error((response && response.error) || "Failed to remove friend");
      }
    } catch (error) {
      console.error("Error removing friend:", error);
      throw new Error("Failed to remove friend");
    }
  };

  const searchUser = async (
    searchTerm: string,
  ): Promise<ExtendedUser[]> => {
    try {
      const normalizedSearchTerm = searchTerm.trim().replace(/^@/, "");
      if (!normalizedSearchTerm) return [];

      const response = await new Promise<{ success: boolean; users?: ExtendedUser[]; error?: string }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "SEARCH_USER", searchTerm: normalizedSearchTerm },
          (res) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(res);
            }
          }
        );
      });

      if (!response || !response.success) {
        if (response && response.error === "User not found") {
          return [];
        }
        throw new Error((response && response.error) || "Failed to search for user");
      }

      return response.users || [];
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
      const updatedReceivedLinks = (currentUser.receivedLinks || []).map(
        (link: ReceivedLink) =>
          link.id === linkId ? { ...link, status } : link,
      );

      // Update local state optimistically
      setCurrentUser((prevUser) => {
        if (!prevUser) return null;
        const updatedUser = {
          ...prevUser,
          receivedLinks: updatedReceivedLinks,
        };
        chrome.storage.local.set({ user: updatedUser });
        return updatedUser;
      });

      chrome.runtime.sendMessage({ type: "UPDATE_LINK_STATUS", linkId, status });
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
      const newSettings = {
        ...currentUser.settings,
        ...settings,
      };

      // Update local state optimistically
      setCurrentUser((prevUser) => {
        if (!prevUser) return null;
        const updatedUser = {
          ...prevUser,
          settings: newSettings,
        };
        chrome.storage.local.set({ user: updatedUser });
        return updatedUser;
      });

      chrome.runtime.sendMessage({ type: "UPDATE_SETTINGS", uid: currentUser.uid, settings });
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
      const response = await new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "UPDATE_USERNAME", uid: currentUser.uid, nextUsername: normalizedUsername },
          (res) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(res);
            }
          }
        );
      });

      if (!response || !response.success) {
        throw new Error((response && response.error) || "Failed to update username");
      }

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

  const completeOnboarding = async () => {
    if (!currentUser) return;

    const previousUser = currentUser;
    const updatedUser = { ...currentUser, isNewUser: false };
    setIsNewUser(false);
    setCurrentUser(updatedUser);
    chrome.storage.local.set({ user: updatedUser });

    try {
      const response = await new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "COMPLETE_ONBOARDING", uid: currentUser.uid },
          (res) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(res);
            }
          },
        );
      });

      if (!response || !response.success) {
        throw new Error(response?.error || "Failed to complete onboarding");
      }
    } catch (error) {
      setIsNewUser(!!previousUser.isNewUser);
      setCurrentUser(previousUser);
      chrome.storage.local.set({ user: previousUser });
      throw error;
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
    acceptFriend,
    rejectFriend,
    isNewUser,
    completeOnboarding,
    deleteAccount,
    updateSettings,
    updateUsername,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
