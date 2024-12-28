import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs, arrayRemove, onSnapshot } from 'firebase/firestore';

interface SharedLink {
  link: string;
  recipients: string[];
  timestamp: string;
  status: 'unseen' | 'opened';
}

interface ReceivedLink {
  id: string;
  link: string;
  sender: string;
  timestamp: string;
  status: 'unseen' | 'opened';
}

interface ExtendedUser extends User {
  username?: string;
  friends?: string[];
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
  updateLinkStatus: (linkId: string, status: 'seen' | 'opened') => Promise<void>;
  isNewUser: boolean; // Added isNewUser property
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
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
      if (message.type === 'SIGN_IN_COMPLETE') {
        setCurrentUser(message.user);
        setIsNewUser(!!message.user.isNewUser);  // Set isNewUser based on the user data
        setIsLoading(false);
        setError(null);
      } else if (message.type === 'SIGN_IN_ERROR') {
        setCurrentUser(null);
        setIsLoading(false);
        setError(message.error);
      } else if (message.type === 'SIGN_OUT_COMPLETE') {
        setCurrentUser(null);
        setIsNewUser(false);  // Reset isNewUser on sign out
        setIsLoading(false);
      } else if (message.type === 'SIGN_OUT_ERROR') {
        setError(message.error);
        setIsLoading(false);
      } else if (message.type === 'FRIEND_ADDED') {
        setCurrentUser(prevUser => prevUser ? { ...prevUser, friends: message.friends } : null);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Check for existing user in storage
    chrome.storage.local.get(['user'], (result) => {
      if (result.user) {
        setCurrentUser(result.user);
        
        // Set up real-time listener when user is loaded
        const userRef = doc(db, 'users', result.user.uid);
        unsubscribe = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const userData = doc.data();
            setCurrentUser((prevUser) => { // Updated setCurrentUser call
              if (prevUser) {
                setIsNewUser(!!userData.isNewUser); // Update isNewUser state
                return { ...prevUser, ...userData };
              }
              return null;
            });
            // Update both state and chrome storage
            chrome.storage.local.set({ user: { ...result.user, ...userData } });
          }
        });
      }
      setIsLoading(false);  // Move this outside the if condition
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
    chrome.runtime.sendMessage({ type: 'SIGN_IN' });
  };

  const signOut = () => {
    setIsLoading(true);
    setError(null);
    chrome.runtime.sendMessage({ type: 'SIGN_OUT' });
  };

  const addFriend = async (friendUsername: string) => {
    if (!currentUser) throw new Error('No user logged in');
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        friends: arrayUnion(friendUsername)
      });
      setCurrentUser(prevUser => {
        if (!prevUser) return null;
        return { ...prevUser, friends: [...(prevUser.friends || []), friendUsername] };
      });
    } catch (error) {
      console.error('Error adding friend:', error);
      throw new Error('Failed to add friend');
    }
  };

  const removeFriend = async (friendUsername: string) => {
    if (!currentUser) throw new Error('No user logged in');
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        friends: arrayRemove(friendUsername)
      });
      setCurrentUser(prevUser => {
        if (!prevUser) return null;
        return { ...prevUser, friends: prevUser.friends?.filter(friend => friend !== friendUsername) };
      });
    } catch (error) {
      console.error('Error removing friend:', error);
      throw new Error('Failed to remove friend');
    }
  };

  const searchUser = async (searchTerm: string): Promise<ExtendedUser | null> => {
    try {
      const usersRef = collection(db, 'users');
      let q = query(usersRef, where('username', '==', searchTerm));
      let querySnapshot = await getDocs(q);
    
      if (querySnapshot.empty) {
        // If no user found by username, search by email
        q = query(usersRef, where('email', '==', searchTerm));
        querySnapshot = await getDocs(q);
      }
    
      if (querySnapshot.empty) return null;
    
      const userDoc = querySnapshot.docs[0];

      return { ...userDoc.data(), uid: userDoc.id} as ExtendedUser;
    } catch (error) {
      console.error('Error searching for user:', error);
      throw new Error('Failed to search for user');
    }
  };

  const shareLink = async (link: string, selectedFriends: string[]) => {
    if (!currentUser) throw new Error('No user logged in');
    try {
      chrome.runtime.sendMessage({ type: 'SHARE_LINK', link, selectedFriends });
    } catch (error) {
      console.error('Error sharing link:', error);
      throw new Error('Failed to share link');
    }
  };

  // Update the updateLinkStatus function in AuthContext:

  const updateLinkStatus = async (linkId: string, status: 'opened' | 'seen') => {
    if (!currentUser) throw new Error('No user logged in');
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      
      if (userData && userData.receivedLinks) {
        const updatedReceivedLinks = userData.receivedLinks.map((link: ReceivedLink) =>
          link.id === linkId ? { ...link, status } : link
        );
        
        await updateDoc(userRef, { receivedLinks: updatedReceivedLinks });
        
        // Update local state
        setCurrentUser(prevUser => {
          if (!prevUser) return null;
          return {
            ...prevUser,
            receivedLinks: updatedReceivedLinks
          };
        });
      }
    } catch (error) {
      console.error('Error updating link status:', error);
      throw new Error('Failed to update link status');
    }
  };

  const completeOnboarding = () => { // Added completeOnboarding function
    setIsNewUser(false);
    if (currentUser) {
      const userRef = doc(db, 'users', currentUser.uid);
      updateDoc(userRef, { isNewUser: false });
      setCurrentUser(prevUser => prevUser ? { ...prevUser, isNewUser: false } : null);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

