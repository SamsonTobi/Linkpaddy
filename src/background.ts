import { auth, db } from './firebase';
import { signInWithCredential, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, query, collection, where, getDocs } from 'firebase/firestore';

type SharedLink = {
  id: string;
  link: string;
  sender: string;
  timestamp: string;
  recipients: string[];
  status: string;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SIGN_IN') {
    signIn();
  } else if (message.type === 'SIGN_OUT') {
    handleSignOut();
  } else if (message.type === 'ADD_FRIEND') {
    addFriend(message.friendUsername);
  } else if (message.type === 'SHARE_LINK') {
    shareLink(message.link, message.selectedFriends);
  } else if (message.type === 'UPDATE_LINK_STATUS') {
    const { linkId, status, senderUsername } = message;
    
    // Get current user data first
    chrome.storage.local.get(['user'], async (result) => {
      const currentUser = result.user;
      if (!currentUser) return;

      try {
        // Update receiver's document
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        
        if (userData && userData.receivedLinks) {
          const updatedReceivedLinks = userData.receivedLinks.map((link: { id: any; }) => 
            link.id === linkId ? { ...link, status } : link
          );
          await updateDoc(userRef, { receivedLinks: updatedReceivedLinks });
        }

        // Update sender's document
        const senderQuery = query(collection(db, 'users'), where('username', '==', senderUsername));
        const senderSnapshot = await getDocs(senderQuery);
        
        if (!senderSnapshot.empty) {
          const senderDoc = senderSnapshot.docs[0];
          const senderRef = doc(db, 'users', senderDoc.id);
          const senderData = senderDoc.data();
          
          if (senderData && senderData.sharedLinks) {
            const updatedSharedLinks = senderData.sharedLinks.map((link: { id: any; }) => 
              link.id === linkId ? { ...link, status } : link
            );
            await updateDoc(senderRef, { sharedLinks: updatedSharedLinks });
          }
        }
      } catch (error) {
        console.error('Error updating link status:', error);
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
            reject('Token is undefined');
          }
        });
      });
    });

    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const userInfo = await response.json();

    const credential = GoogleAuthProvider.credential(null, token);
    const result = await signInWithCredential(auth, credential);
    const user = result.user;

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    let userData;
    if (!userDoc.exists()) {
      const baseName = (user.displayName || 'user').toLowerCase().replace(/\s+/g, '');
      const randomNum = Math.floor(Math.random() * 10000);
      const username = `${baseName}${randomNum}`;

      userData = {
        uid: user.uid,
        email: user.email,
        username: username,
        friends: [],
        pendingInvites: []
      };
      await setDoc(userRef, userData);
    } else {
      userData = userDoc.data();
    }

    await new Promise<void>((resolve) => {
      chrome.storage.local.set({
        user: {
          ...userData,
          displayName: user.displayName,
          photoURL: user.photoURL,
        }
      }, resolve);
    });

    chrome.runtime.sendMessage({ 
      type: 'SIGN_IN_COMPLETE', 
      user: {
        ...userData,
        displayName: user.displayName,
        photoURL: user.photoURL,
      }
    });

  } catch (error) {
    console.error('Sign-in error:', error);
    chrome.runtime.sendMessage({ 
      type: 'SIGN_IN_ERROR', 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
}

async function handleSignOut() {
  try {
    await firebaseSignOut(auth);
    
    chrome.identity.getAuthToken({ interactive: false }, async function(token) {
      if (token) {
        await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        chrome.identity.removeCachedAuthToken({ token }, () => {
          chrome.identity.clearAllCachedAuthTokens(() => {
            chrome.storage.local.clear(() => {
              chrome.runtime.sendMessage({ type: 'SIGN_OUT_COMPLETE' });
            });
          });
        });
      }
    });
    
  } catch (error) {
    console.error('Sign-out error:', error);
    chrome.runtime.sendMessage({ 
      type: 'SIGN_OUT_ERROR', 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
}

async function addFriend(friendUsername: string) {
  try {
    const userDataRaw = await new Promise<{ [key: string]: any }>((resolve) => {
      chrome.storage.local.get(['user'], (result) => resolve(result.user));
    });

    if (!userDataRaw) throw new Error('No user logged in');

    const userRef = doc(db, 'users', userDataRaw.uid);
    const friendQuery = query(collection(db, 'users'), where('username', '==', friendUsername));
    const friendSnapshot = await getDocs(friendQuery);

    if (friendSnapshot.empty) {
      throw new Error('Friend not found');
    }

    const friendDoc = friendSnapshot.docs[0];
    const friendRef = doc(db, 'users', friendDoc.id);

    // Add friend to user's friends list
    await updateDoc(userRef, {
      friends: arrayUnion(friendUsername)
    });

    // Add user to friend's friends list
    await updateDoc(friendRef, {
      friends: arrayUnion(userDataRaw.username)
    });

    const updatedFriends = [...(userDataRaw.friends || []), friendUsername];
    const updatedUserData = { ...userDataRaw, friends: updatedFriends };

    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ user: updatedUserData }, resolve);
    });

    chrome.runtime.sendMessage({ 
      type: 'FRIEND_ADDED', 
      friends: updatedFriends 
    });
  } catch (error) {
    console.error('Error adding friend:', error);
    chrome.runtime.sendMessage({ 
      type: 'ADD_FRIEND_ERROR', 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
}

async function shareLink(link: string, selectedFriends: string[]) {
  try {
    const userDataRaw = await new Promise<{ [key: string]: any }>((resolve) => {
      chrome.storage.local.get(['user'], (result) => resolve(result.user));
    });

    if (!userDataRaw) throw new Error('No user logged in');

    const linkId = Date.now().toString(); // Generate unique ID

    const sharedLinkData = {
      id: linkId,
      link,
      sender: userDataRaw.username,
      timestamp: new Date().toISOString(),
      recipients: selectedFriends,
      status: 'unseen'
    };

    // Add shared link to sender's shared links
    const userRef = doc(db, 'users', userDataRaw.uid);
    await updateDoc(userRef, {
      sharedLinks: arrayUnion(sharedLinkData)
    });

    // Add shared link to each recipient's received links
    for (const friendUsername of selectedFriends) {
      const friendQuery = query(collection(db, 'users'), where('username', '==', friendUsername));
      const friendSnapshot = await getDocs(friendQuery);
      if (!friendSnapshot.empty) {
        const friendDoc = friendSnapshot.docs[0];
        const friendRef = doc(db, 'users', friendDoc.id);
        
        const receivedLinkData = {
          ...sharedLinkData,
          type: 'received'
        };
        
        await updateDoc(friendRef, {
          receivedLinks: arrayUnion(receivedLinkData)
        });
      }
    }
  } catch (error) {
    console.error('Error sharing link:', error);
    chrome.runtime.sendMessage({ 
      type: 'SHARE_LINK_ERROR', 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
}