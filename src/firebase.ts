import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDdIjG8XTEYfq2eht4193fvlxFp481ZrHQ",
  authDomain: "link-share-ext.firebaseapp.com",
  projectId: "link-share-ext",
  storageBucket: "link-share-ext.appspot.com",
  messagingSenderId: "309540318772",
  appId: "1:309540318772:web:366f2b36a81e0dc750e461"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, app };