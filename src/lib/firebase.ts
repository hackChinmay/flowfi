import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBwIgRWr-dLoWGMYjfEYy7SuYPYiBPxiSY",
  authDomain: "flowfinance-80117.firebaseapp.com",
  projectId: "flowfinance-80117",
  storageBucket: "flowfinance-80117.firebasestorage.app",
  messagingSenderId: "942157535972",
  appId: "1:942157535972:web:86480eb786a84d61adeaf1"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();