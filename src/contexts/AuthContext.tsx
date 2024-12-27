import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs, arrayRemove } from 'firebase/firestore';

interface SharedLink {
  link: string;
  recipients: string[];
  timestamp: string;
  status: 'unseen' | 'opened';
}

interface ReceivedLink {
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

  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.type === 'SIGN_IN_COMPLETE') {
        setCurrentUser(message.user);
        setIsLoading(false);
        setError(null);
      } else if (message.type === 'SIGN_IN_ERROR') {
        setCurrentUser(null);
        setIsLoading(false);
        setError(message.error);
      } else if (message.type === 'SIGN_OUT_COMPLETE') {
        setCurrentUser(null);
        setIsLoading(false);
      } else if (message.type === 'SIGN_OUT_ERROR') {
        setError(message.error);
        setIsLoading(false);
      } else if (message.type === 'FRIEND_ADDED') {
        setCurrentUser(prevUser => prevUser ? { ...prevUser, friends: message.friends } : null);
      } else if (message.type === 'LINK_SHARED') {
        setCurrentUser(prevUser => {
          if (!prevUser) return null;
          const updatedSharedLinks = [...(prevUser.sharedLinks || []), message.sharedLink];
          return { ...prevUser, sharedLinks: updatedSharedLinks };
        });
      } else if (message.type === 'LINK_RECEIVED') {
        setCurrentUser(prevUser => {
          if (!prevUser) return null;
          const updatedReceivedLinks = [...(prevUser.receivedLinks || []), message.receivedLink];
          return { ...prevUser, receivedLinks: updatedReceivedLinks };
        });
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    chrome.storage.local.get(['user'], (result) => {
      if (result.user) {
        setCurrentUser(result.user);
      }
      setIsLoading(false);
    });

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
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

  const searchUser = async (username: string): Promise<ExtendedUser | null> => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) return null;
      
      const userDoc = querySnapshot.docs[0];
      return { ...userDoc.data(), uid: userDoc.id } as ExtendedUser;
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

  const updateLinkStatus = async (linkId: string, status: 'opened' | 'seen') => {
    if (!currentUser) throw new Error('No user logged in');
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      
      if (userData) {
        const updatedReceivedLinks = userData.receivedLinks.map((link: ReceivedLink) =>
          link.link === linkId ? { ...link, status } : link
        );
        
        await updateDoc(userRef, { receivedLinks: updatedReceivedLinks });
        
        setCurrentUser(prevUser => {
          if (!prevUser) return null;
          return { ...prevUser, receivedLinks: updatedReceivedLinks };
        });
        
        // Update sender's sharedLinks
        const senderQuery = query(collection(db, 'users'), where('username', '==', userData.receivedLinks.find((link: ReceivedLink) => link.link === linkId)?.sender));
        const senderSnapshot = await getDocs(senderQuery);
        if (!senderSnapshot.empty) {
          const senderDoc = senderSnapshot.docs[0];
          const senderRef = doc(db, 'users', senderDoc.id);
          const senderData = senderDoc.data();
          const updatedSharedLinks = senderData.sharedLinks.map((link: SharedLink) =>
            link.link === linkId ? { ...link, status } : link
          );
          await updateDoc(senderRef, { sharedLinks: updatedSharedLinks });
        }
  
        // Notify background script to update local storage for sender
        chrome.runtime.sendMessage({ 
          type: 'UPDATE_LINK_STATUS', 
          linkId, 
          status, 
          senderUsername: userData.receivedLinks.find((link: ReceivedLink) => link.link === linkId)?.sender 
        });
      }
    } catch (error) {
      console.error('Error updating link status:', error);
      throw new Error('Failed to update link status');
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

