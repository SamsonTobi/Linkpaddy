import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from "react";
import { getAuth, User } from "firebase/auth";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";

interface SharedLink {
  id: string;
  link: string;
  sender: string;  recipients: string[];
  timestamp: string;
  status: "unseen" | "opened";
}

interface ReceivedLink {
  id: string;
  link: string;
  sender: string;
  timestamp: string;
  status: "unseen" | "opened";
}

interface Friend {
  username: string;
  displayName: string,
  email: string;
  photoURL: string;
  addedAt: string;
}

interface ExtendedUser extends User {
  username?: string;
  friends?: Friend[];
  sharedLinks?: SharedLink[];
  receivedLinks?: ReceivedLink[];
}

interface AuthContextType {
  currentUser: ExtendedUser | null;
  signIn: () => void;
  signOut: () => void;
  isLoading: boolean;
  error: string | null;
  addFriend: (friendUsername: string) => Promise<void>;
  searchUser: (username: string) => Promise<ExtendedUser | null>;
  removeFriend: (friendUsername: string) => Promise<void>;
  shareLink: (link: string, selectedFriends: string[]) => Promise<void>;
  updateLinkStatus: (
    linkId: string,
    status: "seen" | "opened"
  ) => Promise<void>;
  isNewUser: boolean; // Added isNewUser property
  completeOnboarding: () => void;
  deleteAccount: () => Promise<void>;
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

    const messageListener = (message: any) => {
      if (message.type === "SIGN_IN_COMPLETE") {
        setCurrentUser(message.user);
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
          prevUser ? { ...prevUser, friends: message.friends } : null
        );
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Check for existing user in storage
    chrome.storage.local.get(["user"], (result) => {
      if (result.user) {
        setCurrentUser(result.user);
        setIsNewUser(!!result.user.isNewUser); // Set isNewUser based on stored data

        // Set up real-time listener when user is loaded
        const userRef = doc(db, "users", result.user.uid);
        unsubscribe = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const userData = doc.data();
            setCurrentUser((prevUser) => {
              if (prevUser) {
                const updatedUser = { ...prevUser, ...userData };
                setIsNewUser(!!userData.isNewUser); // Update isNewUser state
                // Update chrome storage
                chrome.storage.local.set({ user: updatedUser });
                return updatedUser;
              }
              return null;
            });
          }
        });
      }
      setIsLoading(false); // Keep this outside the if condition
    });

    // Return cleanup function at the useEffect level
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      if (unsubscribe) {
        unsubscribe();
      }
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

  const addFriend = async (friendUsername: string) => {
    if (!currentUser) throw new Error("No user logged in");
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

      const newFriend: Friend = {
        username: friendUsername,
        email: friendData.email || '',
        displayName: friendData.displayName || '',
        photoURL: friendData.photoURL || '',
        addedAt: new Date().toISOString(),
      };

      // Add friend to user's friends list
      await updateDoc(userRef, {
        friends: arrayUnion(newFriend),
      });

      const currentUserFriend: Friend = {
        username: currentUser.username || '',
        email: currentUser.email || '',
        displayName: currentUser.displayName || '',
        photoURL: currentUser.photoURL || '',
        addedAt: new Date().toISOString(),
      };

      await updateDoc(friendRef, {
        friends: arrayUnion(currentUserFriend),
      });
      setCurrentUser((prevUser) => {
        if (!prevUser) return null;
        const updatedFriends = [...(prevUser.friends || []), newFriend];
        return { ...prevUser, friends: updatedFriends };
      });

      // Update local storage
      chrome.storage.local.get(["user"], (result) => {
        if (result.user) {
          const updatedUser = {
            ...result.user,
            friends: [...(result.user.friends || []), newFriend],
          };
          chrome.storage.local.set({ user: updatedUser });
        }
      });
    } catch (error) {
      console.error("Error adding friend:", error);
      throw new Error("Failed to add friend");
    }
  };

  const removeFriend = async (friendUsername: string) => {
    if (!currentUser) throw new Error("No user logged in");
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
      const friendRef = doc(db, "users", friendDoc.id);

      await updateDoc(userRef, {
        friends: arrayRemove(
          currentUser.friends?.find((f) => f.username === friendUsername)
        ),
      });

      await updateDoc(friendRef, {
        friends: arrayRemove(
          friendDoc
            .data()
            .friends?.find((f: Friend) => f.username === currentUser.username)
        ),
      });

      setCurrentUser((prevUser) => {
        if (!prevUser) return null;
        const updatedFriends =
          prevUser.friends?.filter(
            (friend) => friend.username !== friendUsername
          ) || [];
        return { ...prevUser, friends: updatedFriends };
      });

      // Update local storage
      chrome.storage.local.get(["user"], (result) => {
        if (result.user) {
          const updatedUser = {
            ...result.user,
            friends:
              result.user.friends?.filter(
                (friend: Friend) => friend.username !== friendUsername
              ) || [],
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
    searchTerm: string
  ): Promise<ExtendedUser | null> => {
    try {
      const usersRef = collection(db, "users");
      let q = query(usersRef, where("username", "==", searchTerm));
      let querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // If no user found by username, search by email
        q = query(usersRef, where("email", "==", searchTerm));
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
      chrome.runtime.sendMessage({ type: "SHARE_LINK", link, selectedFriends });
    } catch (error) {
      console.error("Error sharing link:", error);
      throw new Error("Failed to share link");
    }
  };

  // Update the updateLinkStatus function in AuthContext:

  const updateLinkStatus = async (
    linkId: string,
    status: "opened" | "seen"
  ) => {
    if (!currentUser) throw new Error("No user logged in");
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();

      if (userData && userData.receivedLinks) {
        const updatedReceivedLinks = userData.receivedLinks.map(
          (link: ReceivedLink) =>
            link.id === linkId ? { ...link, status } : link
        );

        await updateDoc(userRef, { receivedLinks: updatedReceivedLinks });

        // Update local state
        setCurrentUser((prevUser) => {
          if (!prevUser) return null;
          return {
            ...prevUser,
            receivedLinks: updatedReceivedLinks,
          };
        });
      }
    } catch (error) {
      console.error("Error updating link status:", error);
      throw new Error("Failed to update link status");
    }
  };

  const completeOnboarding = () => {
    // Added completeOnboarding function
    setIsNewUser(false);
    if (currentUser) {
      const userRef = doc(db, "users", currentUser.uid);
      updateDoc(userRef, { isNewUser: false });
      setCurrentUser((prevUser) =>
        prevUser ? { ...prevUser, isNewUser: false } : null
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
    isNewUser, // Added isNewUser property
    completeOnboarding, // Added completeOnboarding function
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
