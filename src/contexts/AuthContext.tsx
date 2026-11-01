import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";

import { auth, googleProvider, db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

export interface AppUser {
  uid: string;
  email: string | null;
  fullName?: string;
  photoURL?: string | null;
  gender?: string;
  profession?: string;
  spendingLimit?: number;
  savingsGoal?: number;
  savingsGoalName?: string;
  streak?: number;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: {
    fullName: string;
    email: string;
    password: string;
    gender?: string;
    profession?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔥 Handle redirect result (for APK)
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("Google redirect success:", result.user);
        }
      })
      .catch((error) => {
        console.error("Redirect error:", error);
      });
  }, []);

  // 🔥 Auth state listener
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, "users", firebaseUser.uid);

        // Ensure user exists in Firestore
        await setDoc(
          userRef,
          {
            fullName: firebaseUser.displayName || "",
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
          },
          { merge: true }
        );

        // Real-time sync
        unsubscribeFirestore = onSnapshot(userRef, (snap) => {
          const data = snap.data() || {};

          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            fullName: data.fullName || firebaseUser.displayName || "",
            photoURL: firebaseUser.photoURL || null,
            gender: data.gender || "",
            profession: data.profession || "",
            spendingLimit: typeof data.spendingLimit === "number" ? data.spendingLimit : 0,
            savingsGoal: typeof data.savingsGoal === "number" ? data.savingsGoal : 0,
            savingsGoalName: data.savingsGoalName || "Emergency Fund",
            streak: data.streak || 0,
          });

          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  // 🔐 Email login
  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  // 🔐 Email signup
  const signUp = async (data: {
    fullName: string;
    email: string;
    password: string;
    gender?: string;
    profession?: string;
  }) => {
    const res = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );

    const firebaseUser = res.user;

    await setDoc(doc(db, "users", firebaseUser.uid), {
      fullName: data.fullName,
      email: data.email,
      gender: data.gender || "Other",
      profession: data.profession || "Other",
      spendingLimit: 10000,
      savingsGoal: 5000,
      savingsGoalName: "Emergency Fund",
    });
  };

  // 🔥 Google Login (Web + APK)
  const signInWithGoogle = async () => {
    const isMobile = /Android|iPhone/i.test(navigator.userAgent);

    if (isMobile) {
      // ✅ APK
      await signInWithRedirect(auth, googleProvider);
    } else {
      // ✅ Web
      await signInWithPopup(auth, googleProvider);
    }
  };

  // 🔓 Logout
  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}