import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  limit,
  startAfter,
  QueryConstraint,
  DocumentSnapshot
} from "firebase/firestore";
import { app, auth } from "./firebase";
import { roundCurrency } from "./financial";

const db = getFirestore(app);

// Add transaction with enforced authenticated user ownership and monetary rounding
export const addTransaction = async (data: any, expectedUid?: string) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error("Unauthorized: User must be signed in to add transactions");
  }
  if (expectedUid && currentUid !== expectedUid) {
    throw new Error("Account switched: Transaction aborted because authenticated session changed");
  }
  const safeAmount = roundCurrency(data.amount);
  if (safeAmount <= 0) {
    throw new Error("Invalid amount: Transaction amount must be greater than zero");
  }
  await addDoc(collection(db, "transactions"), {
    ...data,
    amount: safeAmount,
    userId: currentUid,
  });
};

// Update transaction with authenticated owner enforcement and immutable field protection
export const updateTransaction = async (id: string, updates: Record<string, any>, expectedUid?: string) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error("Unauthorized: User must be signed in to update transactions");
  }
  if (expectedUid && currentUid !== expectedUid) {
    throw new Error("Account switched: Update aborted because authenticated session changed");
  }
  if (!id || typeof id !== "string") {
    throw new Error("Invalid transaction ID");
  }
  const safeUpdates = { ...updates };
  // Guard immutable fields
  delete safeUpdates.userId;
  delete safeUpdates.createdAt;
  if (safeUpdates.amount !== undefined) {
    safeUpdates.amount = roundCurrency(safeUpdates.amount);
    if (safeUpdates.amount <= 0) {
      throw new Error("Invalid amount: Transaction amount must be greater than zero");
    }
  }
  await updateDoc(doc(db, "transactions", id), safeUpdates);
};

// Delete transaction
export const deleteTransaction = async (id: string, expectedUid?: string) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error("Unauthorized: User must be signed in to delete transactions");
  }
  if (expectedUid && currentUid !== expectedUid) {
    throw new Error("Account switched: Delete aborted because authenticated session changed");
  }
  if (!id || typeof id !== "string") {
    throw new Error("Invalid transaction ID");
  }
  await deleteDoc(doc(db, "transactions", id));
};

// Get transactions for a user scoped to authenticated user
export const getTransactions = async (userId: string) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== userId) {
    throw new Error("Unauthorized: Cannot access another user's transactions");
  }
  const q = query(
    collection(db, "transactions"),
    where("userId", "==", userId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Optimized query: Fetch recent transactions scoped to user with limit
export const getRecentTransactions = async (userId: string, count: number = 5) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== userId) {
    throw new Error("Unauthorized: Cannot access another user's transactions");
  }
  try {
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", userId),
      orderBy("date", "desc"),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err: any) {
    // Graceful fallback if composite index is still building
    console.warn("Falling back to client-filtered recent transactions:", err.message);
    const q = query(collection(db, "transactions"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    docs.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    return docs.slice(0, count);
  }
};

// Optimized query: Server-side pagination with limit and startAfter
export const getPaginatedTransactions = async (
  userId: string,
  pageSize: number = 20,
  lastDoc?: DocumentSnapshot,
  typeFilter?: "income" | "expense"
) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== userId) {
    throw new Error("Unauthorized: Cannot access another user's transactions");
  }
  try {
    const constraints: QueryConstraint[] = [
      where("userId", "==", userId),
    ];
    if (typeFilter) {
      constraints.push(where("type", "==", typeFilter));
    }
    constraints.push(orderBy("date", "desc"));
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    constraints.push(limit(pageSize));

    const q = query(collection(db, "transactions"), ...constraints);
    const snapshot = await getDocs(q);
    return {
      transactions: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore: snapshot.docs.length === pageSize
    };
  } catch (err: any) {
    console.warn("Falling back to client-filtered paginated transactions:", err.message);
    const q = query(collection(db, "transactions"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (typeFilter) {
      docs = docs.filter((d: any) => d.type === typeFilter);
    }
    docs.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    return {
      transactions: docs.slice(0, pageSize),
      lastDoc: null,
      hasMore: docs.length > pageSize
    };
  }
};

// Optimized query: Date range filtering (for monthly and yearly reports)
export const getTransactionsByDateRange = async (
  userId: string,
  startDate: string,
  endDate: string
) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== userId) {
    throw new Error("Unauthorized: Cannot access another user's transactions");
  }
  try {
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", userId),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err: any) {
    console.warn("Falling back to client-filtered date range:", err.message);
    const q = query(collection(db, "transactions"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    return docs.filter((d: any) => {
      const t = new Date(d.date || 0).getTime();
      return t >= startMs && t <= endMs;
    });
  }
};

// Optimized query: Monthly transactions helper
export const getMonthlyTransactions = async (userId: string, year: number, month: number) => {
  const startDate = new Date(year, month, 1, 0, 0, 0, 0).toISOString();
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
  return getTransactionsByDateRange(userId, startDate, endDate);
};
// ✅ CATEGORY DATA

export const EXPENSE_CATEGORIES = [
  { name: "Food", icon: "🍕" },
  { name: "Transport", icon: "🚗" },
  { name: "Shopping", icon: "🛍️" },
  { name: "Bills", icon: "💡" },
  { name: "Health", icon: "🏥" },
  { name: "Entertainment", icon: "🎮" },
];

export const INCOME_CATEGORIES = [
  { name: "Salary", icon: "💰" },
  { name: "Freelance", icon: "💻" },
  { name: "Business", icon: "🏢" },
  { name: "Investment", icon: "📈" },
];

export const CATEGORY_CSS: Record<string, string> = {
  Food: "bg-orange-500/20 text-orange-400",
  Transport: "bg-blue-500/20 text-blue-400",
  Shopping: "bg-pink-500/20 text-pink-400",
  Bills: "bg-yellow-500/20 text-yellow-400",
  Health: "bg-red-500/20 text-red-400",
  Entertainment: "bg-purple-500/20 text-purple-400",

  Salary: "bg-green-500/20 text-green-400",
  Freelance: "bg-indigo-500/20 text-indigo-400",
  Business: "bg-cyan-500/20 text-cyan-400",
  Investment: "bg-emerald-500/20 text-emerald-400",
};