import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  deleteUser,
} from "firebase/auth";
import { NativeBiometric } from "capacitor-native-biometric";

import { auth, googleProvider, db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  onSnapshot,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { clearUserData } from "@/lib/storage";

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
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const authSessionRef = useRef<number>(0);

  // Handle redirect result (for mobile/APK)
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          // Sanitized notification without exposing auth token details
          if (process.env.NODE_ENV !== "production") {
            console.log("Google redirect sign-in completed successfully");
          }
        }
      })
      .catch((error) => {
        console.error("Redirect error:", error);
      });
  }, []);

  // Coordinated auth state and real-time profile listener
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Invalidate any in-flight asynchronous operations from previous user
      authSessionRef.current += 1;
      const currentSessionId = authSessionRef.current;

      // Clean up previous Firestore listener immediately on auth change
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = undefined;
      }

      if (firebaseUser) {
        // Immediately establish baseline authenticated identity and resolve loading
        // to prevent premature redirection or flashes of stale data
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          fullName: firebaseUser.displayName || "",
          photoURL: firebaseUser.photoURL || null,
        });
        setLoading(false);

        const userRef = doc(db, "users", firebaseUser.uid);

        try {
          // Ensure user document exists in Firestore
          await setDoc(
            userRef,
            {
              fullName: firebaseUser.displayName || "",
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL,
            },
            { merge: true }
          );
        } catch (err) {
          console.error("Failed to sync user document:", err);
        }

        // Check if session changed while setDoc was pending
        if (currentSessionId !== authSessionRef.current) {
          return;
        }

        // Real-time sync with permission/error callback
        unsubscribeFirestore = onSnapshot(
          userRef,
          (snap) => {
            // Discard stale snapshot if user switched or logged out
            if (currentSessionId !== authSessionRef.current) {
              return;
            }

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
          },
          (error) => {
            if (currentSessionId !== authSessionRef.current) {
              return;
            }
            console.error("Firestore user profile listener error:", error);
            // Fallback to basic auth identity on permission error or offline state
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              fullName: firebaseUser.displayName || "",
              photoURL: firebaseUser.photoURL || null,
            });
            setLoading(false);
          }
        );
      } else {
        // User is logged out
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  // 🔐 Email login (stable reference)
  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  // 🔐 Email signup (stable reference)
  const signUp = useCallback(async (data: {
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
  }, []);

  // 🔥 Google Login (Web + APK) (stable reference)
  const signInWithGoogle = useCallback(async () => {
    const isMobile = /Android|iPhone/i.test(navigator.userAgent);

    if (isMobile) {
      // ✅ APK
      await signInWithRedirect(auth, googleProvider);
    } else {
      // ✅ Web
      await signInWithPopup(auth, googleProvider);
    }
  }, []);

  // 🔓 Logout with comprehensive credential cleanup and strict error handling
  const signOut = useCallback(async () => {
    try {
      // Purge all user-specific authentication credentials and obsolete session data
      localStorage.removeItem("auth_password");
      localStorage.removeItem("auth_email");
      localStorage.removeItem("flowfi_session");
      localStorage.removeItem("flowfi_users");
      localStorage.removeItem("flowfi_transactions");

      // Safely delete native biometric credentials if present
      try {
        await NativeBiometric.deleteCredentials({ server: "flowfi.app" });
      } catch {
        // Ignored on web or if biometrics were not configured
      }

      // Terminate the Firebase Auth session
      await firebaseSignOut(auth);

      // Successfully logged out: reset user state
      setUser(null);
      setLoading(false);
    } catch (err) {
      console.error("Sign-out error:", err);
      // DO NOT falsely present user as logged out on failure!
      throw err;
    }
  }, []);

  // 🗑️ Permanently delete user account and all associated financial records
  const deleteAccount = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Unauthorized: No authenticated user to delete");
    }

    const uid = currentUser.uid;

    try {
      // 1. Delete all user transactions from Firestore in chunks of up to 400
      try {
        const txQ = query(collection(db, "transactions"), where("userId", "==", uid));
        const txSnap = await getDocs(txQ);
        const batchSize = 400;
        for (let i = 0; i < txSnap.docs.length; i += batchSize) {
          const batch = writeBatch(db);
          const chunk = txSnap.docs.slice(i, i + batchSize);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (err) {
        console.error("Failed to delete user transactions during account deletion:", err);
        throw err;
      }

      // 2. Delete optional user collections (budgets, goals) if present
      try {
        const budgetQ = query(collection(db, "budgets"), where("userId", "==", uid));
        const budgetSnap = await getDocs(budgetQ);
        if (!budgetSnap.empty) {
          const batch = writeBatch(db);
          budgetSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch {
        // Optional collection if not present
      }

      try {
        const goalQ = query(collection(db, "goals"), where("userId", "==", uid));
        const goalSnap = await getDocs(goalQ);
        if (!goalSnap.empty) {
          const batch = writeBatch(db);
          goalSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch {
        // Optional collection if not present
      }

      // 3. Delete user profile document
      try {
        await deleteDoc(doc(db, "users", uid));
      } catch (err) {
        console.error("Failed to delete user profile document during account deletion:", err);
        throw err;
      }

      // 4. Scrub local storage and biometric credentials
      localStorage.removeItem("auth_password");
      localStorage.removeItem("auth_email");
      localStorage.removeItem("flowfi_session");
      localStorage.removeItem("flowfi_users");
      localStorage.removeItem("flowfi_transactions");
      clearUserData(uid);

      try {
        await NativeBiometric.deleteCredentials({ server: "flowfi.app" });
      } catch {
        // Ignored on web or if biometrics were not configured
      }

      // 5. Delete Firebase Auth user
      try {
        await deleteUser(currentUser);
      } catch (err: any) {
        if (err?.code === "auth/requires-recent-login") {
          throw new Error(
            "For security, account deletion requires recent authentication. Please sign out, sign in again, and retry account deletion."
          );
        }
        throw err;
      }

      // 6. Reset client state
      setUser(null);
      setLoading(false);
    } catch (err) {
      console.error("Account deletion error:", err);
      throw err;
    }
  }, []);

  // Memoize context value to eliminate cascading re-renders across all consumers
  const value = useMemo(
    () => ({
      user,
      loading,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
      deleteAccount,
    }),
    [user, loading, signIn, signUp, signOut, signInWithGoogle, deleteAccount]
  );

  return (
    <AuthContext.Provider value={value}>
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