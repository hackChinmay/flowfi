export interface User {
  id: string;
  fullName: string;
  email: string;
  password: string;
  gender: string;
  profession: string;
  spendingLimit: number;
  createdAt: string;
  savingsGoal?: number;
  savingsGoalName?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  date: string;
}

const USERS_KEY = "flowfi_users";
const TRANSACTIONS_KEY = "flowfi_transactions";
const SESSION_KEY = "flowfi_session";
const STREAK_KEY = "flowfi_streak";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getUsers(): User[] {
  return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getTransactions(): Transaction[] {
  return JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || "[]");
}

function saveTransactions(txns: Transaction[]) {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txns));
}

export async function signUp(data: Omit<User, "id" | "password" | "createdAt" | "spendingLimit"> & { password: string }): Promise<User> {
  const users = getUsers();
  if (users.find(u => u.email === data.email)) throw new Error("Email already registered");
  const user: User = {
    id: crypto.randomUUID(),
    fullName: data.fullName,
    email: data.email,
    password: await hashPassword(data.password),
    gender: data.gender,
    profession: data.profession,
    spendingLimit: 10000,
    savingsGoal: 5000,
    savingsGoalName: "Emergency Fund",
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  setSession(user.id);
  return user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const users = getUsers();
  const hashed = await hashPassword(password);
  const user = users.find(u => u.email === email && u.password === hashed);
  if (!user) throw new Error("Invalid email or password");
  setSession(user.id);
  return user;
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}

function setSession(userId: string) {
  localStorage.setItem(SESSION_KEY, userId);
}

export function getCurrentUser(): User | null {
  const userId = localStorage.getItem(SESSION_KEY);
  if (!userId) return null;
  return getUsers().find(u => u.id === userId) || null;
}

export function updateUser(updates: Partial<User>) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === updates.id);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...updates };
    saveUsers(users);
  }
}

export function addTransaction(txn: Omit<Transaction, "id" | "date">): Transaction {
  const transactions = getTransactions();
  const newTxn: Transaction = {
    ...txn,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
  };
  transactions.push(newTxn);
  saveTransactions(transactions);
  updateStreak(txn.userId);
  return newTxn;
}

export function deleteTransaction(id: string) {
  const transactions = getTransactions().filter(t => t.id !== id);
  saveTransactions(transactions);
}

export function getUserTransactions(userId: string): Transaction[] {
  return getTransactions().filter(t => t.userId === userId);
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

// Streak tracking
function updateStreak(userId: string) {
  const key = `${STREAK_KEY}_${userId}`;
  const data = JSON.parse(localStorage.getItem(key) || '{"count":0,"lastDate":""}');
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (data.lastDate === today) return;
  if (data.lastDate === yesterday) {
    data.count += 1;
  } else {
    data.count = 1;
  }
  data.lastDate = today;
  localStorage.setItem(key, JSON.stringify(data));
}

export function getStreak(userId: string): number {
  const key = `${STREAK_KEY}_${userId}`;
  const data = JSON.parse(localStorage.getItem(key) || '{"count":0,"lastDate":""}');
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (data.lastDate === today || data.lastDate === yesterday) return data.count;
  return 0;
}

export const CATEGORY_COLORS: Record<string, string> = {
  Food: "cat-food",
  Transport: "cat-transport",
  Shopping: "cat-shopping",
  Entertainment: "cat-entertainment",
  Bills: "cat-bills",
  Health: "cat-health",
  Education: "cat-education",
  Salary: "cat-salary",
  Freelance: "cat-freelance",
  Investment: "cat-investment",
  Gift: "cat-gift",
  Other: "cat-other",
};

export const CATEGORY_CSS: Record<string, string> = {
  Food: "bg-cat-food/15 text-cat-food",
  Transport: "bg-cat-transport/15 text-cat-transport",
  Shopping: "bg-cat-shopping/15 text-cat-shopping",
  Entertainment: "bg-cat-entertainment/15 text-cat-entertainment",
  Bills: "bg-cat-bills/15 text-cat-bills",
  Health: "bg-cat-health/15 text-cat-health",
  Education: "bg-cat-education/15 text-cat-education",
  Salary: "bg-cat-salary/15 text-cat-salary",
  Freelance: "bg-cat-freelance/15 text-cat-freelance",
  Investment: "bg-cat-investment/15 text-cat-investment",
  Gift: "bg-cat-gift/15 text-cat-gift",
  Other: "bg-cat-other/15 text-cat-other",
};

export const CATEGORY_BG: Record<string, string> = {
  Food: "bg-cat-food",
  Transport: "bg-cat-transport",
  Shopping: "bg-cat-shopping",
  Entertainment: "bg-cat-entertainment",
  Bills: "bg-cat-bills",
  Health: "bg-cat-health",
  Education: "bg-cat-education",
  Salary: "bg-cat-salary",
  Freelance: "bg-cat-freelance",
  Investment: "bg-cat-investment",
  Gift: "bg-cat-gift",
  Other: "bg-cat-other",
};

export const EXPENSE_CATEGORIES = [
  { name: "Food", icon: "🍕" },
  { name: "Transport", icon: "🚗" },
  { name: "Shopping", icon: "🛍️" },
  { name: "Entertainment", icon: "🎬" },
  { name: "Bills", icon: "📄" },
  { name: "Health", icon: "💊" },
  { name: "Education", icon: "📚" },
  { name: "Other", icon: "📦" },
];

export const INCOME_CATEGORIES = [
  { name: "Salary", icon: "💰" },
  { name: "Freelance", icon: "💻" },
  { name: "Investment", icon: "📈" },
  { name: "Gift", icon: "🎁" },
  { name: "Other", icon: "📦" },
];
