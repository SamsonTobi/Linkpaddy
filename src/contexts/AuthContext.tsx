import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';

interface ExtendedUser extends User {
  username?: string;
  friends?: string[];
}

interface AuthContextType {
  currentUser: ExtendedUser | null;
  signIn: () => void;
  signOut: () => void;
  isLoading: boolean;
  error: string | null;
  addFriend: (friendUsername: string) => Promise<void>;
  searchUser: (username: string) => Promise<ExtendedUser | null>;
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
      chrome.runtime.sendMessage({ type: 'ADD_FRIEND', friendUsername });
    } catch (error) {
      console.error('Error adding friend:', error);
      throw new Error('Failed to add friend');
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

  const value = {
    currentUser,
    signIn,
    signOut,
    isLoading,
    error,
    addFriend,
    searchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

