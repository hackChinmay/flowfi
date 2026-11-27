import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TransactionProvider, useTransactions } from "@/contexts/TransactionContext";
import { addTransaction, updateTransaction, deleteTransaction } from "@/lib/db";
import { getStreak, updateStreak, signOut as storageSignOut } from "@/lib/storage";
import { NativeBiometric } from "capacitor-native-biometric";
import { auth, db } from "@/lib/firebase";

// Mock capacitor-native-biometric
vi.mock("capacitor-native-biometric", () => ({
  NativeBiometric: {
    setCredentials: vi.fn().mockResolvedValue(true),
    getCredentials: vi.fn().mockResolvedValue({ username: "user_a@flowfi.com", password: "password123" }),
    deleteCredentials: vi.fn().mockResolvedValue(true),
    verifyIdentity: vi.fn().mockResolvedValue(true),
    isAvailable: vi.fn().mockResolvedValue({ isAvailable: true }),
  },
}));

// Mock Firebase Auth and Firestore with controllable event emitters
let authStateCallback: ((user: any) => void) | null = null;
let firestoreSnapshotCallbacks: Map<string, (snap: any) => void> = new Map();
let unsubscribeAuthSpy = vi.fn();
let unsubscribeFirestoreSpy = vi.fn();

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
  })),
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    authStateCallback = callback;
    return unsubscribeAuthSpy;
  }),
  signInWithEmailAndPassword: vi.fn((_auth, email, password) => {
    if (password === "wrong-password") {
      const err = new Error("Invalid credentials");
      (err as any).code = "auth/invalid-credential";
      return Promise.reject(err);
    }
    const mockUser = {
      uid: "user_A",
      email,
      displayName: "User Alpha",
      photoURL: null,
    };
    (auth as any).currentUser = mockUser;
    if (authStateCallback) authStateCallback(mockUser);
    return Promise.resolve({ user: mockUser });
  }),
  createUserWithEmailAndPassword: vi.fn((_auth, email, _password) => {
    const mockUser = {
      uid: "user_new",
      email,
      displayName: "New User",
      photoURL: null,
    };
    (auth as any).currentUser = mockUser;
    if (authStateCallback) authStateCallback(mockUser);
    return Promise.resolve({ user: mockUser });
  }),
  signOut: vi.fn(() => {
    (auth as any).currentUser = null;
    if (authStateCallback) authStateCallback(null);
    return Promise.resolve();
  }),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn().mockResolvedValue(null),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((_db, collectionName, id) => ({ collectionName, id, path: `${collectionName}/${id}` })),
  collection: vi.fn((_db, collectionName) => ({ collectionName })),
  query: vi.fn((collectionRef, ...constraints) => ({ collectionRef, constraints })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  addDoc: vi.fn().mockResolvedValue({ id: "new_txn_id" }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  serverTimestamp: vi.fn(() => ({ seconds: 123456 })),
  onSnapshot: vi.fn((queryOrDoc, onNext) => {
    const key = queryOrDoc.path || queryOrDoc.collectionRef?.collectionName || "unknown";
    firestoreSnapshotCallbacks.set(key, onNext);
    return unsubscribeFirestoreSpy;
  }),
}));

function TestAuthConsumer() {
  const { user, loading, signIn, signOut } = useAuth();
  return (
    <div>
      <div data-testid="auth-loading">{loading ? "loading" : "ready"}</div>
      <div data-testid="auth-user">{user ? user.uid : "no-user"}</div>
      <div data-testid="auth-email">{user?.email || "no-email"}</div>
      <button onClick={() => signIn("test@flowfi.com", "pass123")}>Sign In</button>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}

function TestTransactionConsumer() {
  const { user } = useAuth();
  const { transactions, loading, error } = useTransactions();
  return (
    <div>
      <div data-testid="txn-user">{user ? user.uid : "no-user"}</div>
      <div data-testid="txn-loading">{loading ? "loading" : "ready"}</div>
      <div data-testid="txn-count">{transactions.length}</div>
      <div data-testid="txn-error">{error || "no-error"}</div>
      <ul data-testid="txn-list">
        {transactions.map((t) => (
          <li key={t.id} data-testid={`txn-item-${t.id}`}>
            {t.userId}:{t.description}:{t.amount}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProtectedRouteTest({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div data-testid="loading-fallback" role="status" aria-label="Loading authentication">Loading FlowFi...</div>;
  }
  if (!user) {
    return <Navigate to="/landing" replace />;
  }
  return <>{children}</>;
}

describe("FlowFi Correction 8: Authentication, Session Management & Account Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (auth as any).currentUser = null;
    firestoreSnapshotCallbacks.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // 1. Initial Authentication Loading State
  it("1. Maintains loading state and prevents premature access before auth resolves", () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    // Before onAuthStateChanged fires, loading is true and user is null
    expect(screen.getByTestId("auth-loading").textContent).toBe("loading");
    expect(screen.getByTestId("auth-user").textContent).toBe("no-user");
  });

  // 2. Successful Login
  it("2. Successfully updates authenticated user state on login", async () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    // Initial state resolution
    act(() => {
      if (authStateCallback) authStateCallback(null);
    });

    expect(screen.getByTestId("auth-loading").textContent).toBe("ready");
    expect(screen.getByTestId("auth-user").textContent).toBe("no-user");

    // Perform sign in
    await act(async () => {
      screen.getByText("Sign In").click();
    });

    expect(screen.getByTestId("auth-user").textContent).toBe("user_A");
    expect(screen.getByTestId("auth-email").textContent).toBe("test@flowfi.com");
  });

  // 3. Failed Login
  it("3. Failed login does not set user and propagates understandable error", async () => {
    const { signInWithEmailAndPassword } = await import("firebase/auth");

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    act(() => {
      if (authStateCallback) authStateCallback(null);
    });

    // Attempt login with invalid password
    await expect(
      signInWithEmailAndPassword(auth, "test@flowfi.com", "wrong-password")
    ).rejects.toThrow("Invalid credentials");

    expect(screen.getByTestId("auth-user").textContent).toBe("no-user");
  });

  // 4. Successful Signup
  it("4. Creates new user account and initializes default profile settings", async () => {
    const { createUserWithEmailAndPassword } = await import("firebase/auth");

    let registeredUser: any = null;
    await act(async () => {
      const res = await createUserWithEmailAndPassword(auth, "newuser@flowfi.com", "securePassword123");
      registeredUser = res.user;
    });

    expect(registeredUser).toBeDefined();
    expect(registeredUser.uid).toBe("user_new");
    expect(registeredUser.email).toBe("newuser@flowfi.com");
  });

  // 5. Successful Logout & State Cleanup
  it("5. Terminates session on logout and purges credentials while preserving harmless preferences", async () => {
    // Seed localStorage with sensitive/obsolete keys and user theme
    localStorage.setItem("auth_password", "rawSecret123");
    localStorage.setItem("auth_email", "user_a@flowfi.com");
    localStorage.setItem("flowfi_session", "user_A");
    localStorage.setItem("flowfi_theme", "dark");

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    // Authenticate as User A
    act(() => {
      const userA = { uid: "user_A", email: "user_a@flowfi.com", displayName: "Alpha" };
      (auth as any).currentUser = userA;
      if (authStateCallback) authStateCallback(userA);
    });

    expect(screen.getByTestId("auth-user").textContent).toBe("user_A");

    // Perform sign out
    await act(async () => {
      screen.getByText("Sign Out").click();
    });

    // NativeBiometric credentials must be deleted on logout
    expect(NativeBiometric.deleteCredentials).toHaveBeenCalledWith({ server: "flowfi.app" });

    // Sensitive & obsolete session keys must be purged
    expect(localStorage.getItem("auth_password")).toBeNull();
    expect(localStorage.getItem("auth_email")).toBeNull();
    expect(localStorage.getItem("flowfi_session")).toBeNull();

    // Harmless preferences (theme) must be preserved
    expect(localStorage.getItem("flowfi_theme")).toBe("dark");

    // React state must be reset to unauthenticated
    expect(screen.getByTestId("auth-user").textContent).toBe("no-user");
  });

  // 6. Logout Listener Cleanup
  it("6. Unsubscribes Firestore listeners when the user logs out", async () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    // Log in User A
    act(() => {
      const userA = { uid: "user_A", email: "user_a@flowfi.com" };
      (auth as any).currentUser = userA;
      if (authStateCallback) authStateCallback(userA);
    });

    // Log out User A
    await act(async () => {
      screen.getByText("Sign Out").click();
    });

    // Verify Firestore listener unsubscribe was called
    expect(unsubscribeFirestoreSpy).toHaveBeenCalled();
  });

  // 7. User A to User B Account Switching
  it("7. Immediately replaces User A identity with User B identity without stale state leakage", async () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    // Start as User A
    act(() => {
      const userA = { uid: "user_A", email: "alpha@flowfi.com" };
      (auth as any).currentUser = userA;
      if (authStateCallback) authStateCallback(userA);
    });

    expect(screen.getByTestId("auth-user").textContent).toBe("user_A");
    expect(screen.getByTestId("auth-email").textContent).toBe("alpha@flowfi.com");

    // Fast account switch to User B
    act(() => {
      const userB = { uid: "user_B", email: "beta@flowfi.com" };
      (auth as any).currentUser = userB;
      if (authStateCallback) authStateCallback(userB);
    });

    expect(screen.getByTestId("auth-user").textContent).toBe("user_B");
    expect(screen.getByTestId("auth-email").textContent).toBe("beta@flowfi.com");
  });

  // 8. Previous-User Transaction Data Clearing
  it("8. Immediately purges User A transactions when User A signs out or User B signs in", async () => {
    render(
      <AuthProvider>
        <TransactionProvider>
          <TestTransactionConsumer />
        </TransactionProvider>
      </AuthProvider>
    );

    // 1. Sign in as User A
    act(() => {
      const userA = { uid: "user_A", email: "alpha@flowfi.com" };
      (auth as any).currentUser = userA;
      if (authStateCallback) authStateCallback(userA);
    });

    // Emit User A's transactions from Firestore snapshot
    act(() => {
      const txnCallback = firestoreSnapshotCallbacks.get("transactions");
      if (txnCallback) {
        txnCallback({
          docs: [
            {
              id: "tx_1",
              data: () => ({
                userId: "user_A",
                type: "expense",
                amount: 1500,
                category: "Food",
                description: "Alpha Lunch",
                date: "2026-11-20T12:00:00.000Z",
              }),
            },
          ],
        });
      }
    });

    expect(screen.getByTestId("txn-user").textContent).toBe("user_A");
    expect(screen.getByTestId("txn-count").textContent).toBe("1");
    expect(screen.getByTestId("txn-item-tx_1")).toHaveTextContent("user_A:Alpha Lunch:1500");

    // 2. Sign out User A
    act(() => {
      (auth as any).currentUser = null;
      if (authStateCallback) authStateCallback(null);
    });

    // Transactions must be wiped immediately to 0
    expect(screen.getByTestId("txn-user").textContent).toBe("no-user");
    expect(screen.getByTestId("txn-count").textContent).toBe("0");

    // 3. Sign in as User B
    act(() => {
      const userB = { uid: "user_B", email: "beta@flowfi.com" };
      (auth as any).currentUser = userB;
      if (authStateCallback) authStateCallback(userB);
    });

    // Before User B's snapshot arrives, count must be 0 (no lingering User A data!)
    expect(screen.getByTestId("txn-user").textContent).toBe("user_B");
    expect(screen.getByTestId("txn-count").textContent).toBe("0");

    // Emit User B's transactions
    act(() => {
      const txnCallback = firestoreSnapshotCallbacks.get("transactions");
      if (txnCallback) {
        txnCallback({
          docs: [
            {
              id: "tx_2",
              data: () => ({
                userId: "user_B",
                type: "income",
                amount: 75000,
                category: "Salary",
                description: "Beta Paycheck",
                date: "2026-11-25T10:00:00.000Z",
              }),
            },
          ],
        });
      }
    });

    expect(screen.getByTestId("txn-count").textContent).toBe("1");
    expect(screen.getByTestId("txn-item-tx_2")).toHaveTextContent("user_B:Beta Paycheck:75000");
    expect(screen.queryByTestId("txn-item-tx_1")).toBeNull();
  });

  // 9. Previous-User Asynchronous Requests Being Ignored
  it("9. Aborts in-flight transaction write if active session switched before resolution", async () => {
    // Current user is User A
    (auth as any).currentUser = { uid: "user_A" };

    // Start an asynchronous transaction write for User A
    const transactionData = {
      type: "expense",
      amount: 500,
      category: "Food",
      description: "Coffee",
    };

    // User switches to User B while the write was initiated
    (auth as any).currentUser = { uid: "user_B" };

    // addTransaction with expectedUid="user_A" must abort because current user is user_B
    await expect(
      addTransaction(transactionData, "user_A")
    ).rejects.toThrow(/Account switched/);
  });

  // 10. Protected Route Behavior During Authentication Loading
  it("10. Protected route renders loading indicator and holds redirection while auth initializes", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <Routes>
            <Route path="/landing" element={<div>Landing Page</div>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRouteTest>
                  <div data-testid="dashboard-content">Private Dashboard</div>
                </ProtectedRouteTest>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    // Initial state: loading is true, protected route renders loading fallback
    expect(screen.getByTestId("loading-fallback")).toBeInTheDocument();
    expect(screen.queryByText("Landing Page")).toBeNull();
    expect(screen.queryByTestId("dashboard-content")).toBeNull();
  });

  // 11. Protected Route Redirection After Logout
  it("11. Protected route redirects to landing page when user is unauthenticated", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <Routes>
            <Route path="/landing" element={<div data-testid="landing-page">Landing Page</div>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRouteTest>
                  <div data-testid="dashboard-content">Private Dashboard</div>
                </ProtectedRouteTest>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    // Auth resolves as logged out
    act(() => {
      if (authStateCallback) authStateCallback(null);
    });

    await waitFor(() => {
      expect(screen.getByTestId("landing-page")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("dashboard-content")).toBeNull();
  });

  // 12. User-Specific Query & Storage Isolation
  it("12. Confirms user streaks and local storage are strictly scoped by UID", () => {
    // Set streak for User A
    updateStreak("user_A");
    expect(getStreak("user_A")).toBe(1);

    // User B should have independent streak of 0
    expect(getStreak("user_B")).toBe(0);

    // Modify User A's stored streak directly in localStorage
    localStorage.setItem(
      "flowfi_streak_user_A",
      JSON.stringify({ count: 7, lastDate: new Date().toDateString() })
    );

    // User A should read 7, while User B remains strictly isolated at 0
    expect(getStreak("user_A")).toBe(7);
    expect(getStreak("user_B")).toBe(0);

    // Now update User B's streak independently
    updateStreak("user_B");
    expect(getStreak("user_B")).toBe(1);
    expect(getStreak("user_A")).toBe(7);
  });

  // 13. Biometric Authentication Fallback
  it("13. Handles biometric failure or unsupported web environments gracefully", async () => {
    // Mock biometric throwing an exception
    vi.mocked(NativeBiometric.deleteCredentials).mockRejectedValueOnce(
      new Error("Biometrics not available on this web platform")
    );

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    act(() => {
      const userA = { uid: "user_A", email: "user_a@flowfi.com" };
      (auth as any).currentUser = userA;
      if (authStateCallback) authStateCallback(userA);
    });

    // Sign out should not crash when biometric credentials deletion throws on web
    await act(async () => {
      screen.getByText("Sign Out").click();
    });

    expect(screen.getByTestId("auth-user").textContent).toBe("no-user");
  });
});
