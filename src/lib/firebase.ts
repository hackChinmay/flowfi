import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBwIgRWr-dLoWGMYjfEYy7SuYPYiBPxiSY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "flowfinance-80117.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "flowfinance-80117",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "flowfinance-80117.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "942157535972",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:942157535972:web:86480eb786a84d61adeaf1"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();