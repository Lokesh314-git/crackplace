import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB1P2VBP82rZ3y3pJqzeQsGE_Hl9sVbdfc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'crackprep-webapp.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'crackprep-webapp',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'crackprep-webapp.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1060022259206',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1060022259206:web:760e6130a83940aeb2bd87',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-27NGQ7R3LH'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics conditionally (supported only in client browser environments)
export let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Non-browser or tracking-blocked environment
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;

