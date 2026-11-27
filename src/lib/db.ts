import { getFirestore, collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { app, auth } from "./firebase";

const db = getFirestore(app);

// Add transaction with enforced authenticated user ownership
export const addTransaction = async (data: any) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error("Unauthorized: User must be signed in to add transactions");
  }
  await addDoc(collection(db, "transactions"), {
    ...data,
    userId: currentUid,
  });
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