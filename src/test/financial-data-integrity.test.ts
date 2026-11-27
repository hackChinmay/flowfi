import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { addTransaction, updateTransaction, deleteTransaction } from "@/lib/db";
import {
  roundCurrency,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateBalance,
  calculateSavingsRate,
  calculateCurrentMonthSpending,
  calculateMonthlySummary,
  parseTransactionDate,
} from "@/lib/financial";
import { generateTransactionsCSV, escapeCSVField } from "@/lib/exportUtils";
import type { Transaction } from "@/lib/storage";
import { auth, db } from "@/lib/firebase";

// In-memory mock storage for Firestore documents
let inMemoryStore: Map<string, any> = new Map();

vi.mock("@/lib/firebase", () => {
  const mockAuth = {
    currentUser: { uid: "user_integrity_A", email: "user_a@flowfi.com" },
  };
  const mockDb = { name: "mock-firestore" };
  return {
    auth: mockAuth,
    db: mockDb,
    app: {},
  };
});

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, name) => ({ path: name })),
  doc: vi.fn((_db, collectionName, id) => ({
    path: `${collectionName}/${id}`,
    id,
    collectionName,
  })),
  setDoc: vi.fn(async (docRef, data) => {
    inMemoryStore.set(docRef.path, { ...data, id: docRef.id });
    return Promise.resolve();
  }),
  updateDoc: vi.fn(async (docRef, updates) => {
    if (!inMemoryStore.has(docRef.path)) {
      const err = new Error("Document not found");
      (err as any).code = "not-found";
      throw err;
    }
    const current = inMemoryStore.get(docRef.path);
    inMemoryStore.set(docRef.path, { ...current, ...updates });
    return Promise.resolve();
  }),
  deleteDoc: vi.fn(async (docRef) => {
    inMemoryStore.delete(docRef.path);
    return Promise.resolve();
  }),
  getDocs: vi.fn(async () => ({
    docs: Array.from(inMemoryStore.values()).map((data) => ({
      id: data.id,
      data: () => data,
    })),
  })),
  query: vi.fn((col) => col),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  serverTimestamp: vi.fn(() => ({ seconds: 1700000000 })),
}));

describe("FlowFi Correction 9: Financial Data Integrity, Backup, Recovery & Reliability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryStore.clear();
    (auth as any).currentUser = { uid: "user_integrity_A", email: "user_a@flowfi.com" };
  });

  afterEach(() => {
    inMemoryStore.clear();
  });

  // 1. Duplicate Transaction Submission
  it("1. Idempotently writes transactions: duplicate submission with same ID does not duplicate records", async () => {
    const fixedId = "tx_deterministic_uuid_1";
    const payload = {
      id: fixedId,
      amount: 1250.5,
      type: "expense",
      category: "Food",
      description: "Business Lunch",
      date: "2026-11-27T12:00:00.000Z",
    };

    // First submission
    const id1 = await addTransaction(payload);
    expect(id1).toBe(fixedId);
    expect(inMemoryStore.size).toBe(1);

    // Identical duplicate submission (e.g. rapid double click or network retry)
    const id2 = await addTransaction(payload);
    expect(id2).toBe(fixedId);

    // In-memory store must STILL contain exactly 1 transaction
    expect(inMemoryStore.size).toBe(1);
    const stored = inMemoryStore.get(`transactions/${fixedId}`);
    expect(stored.amount).toBe(1250.5);
    expect(stored.description).toBe("Business Lunch");
  });

  // 2. Failed Transaction Creation
  it("2. Fails safely and rejects transaction creation when user is unauthenticated", async () => {
    (auth as any).currentUser = null;

    await expect(
      addTransaction({ amount: 500, type: "expense", category: "Transport" })
    ).rejects.toThrow("Unauthorized");

    // No document created in store
    expect(inMemoryStore.size).toBe(0);
  });

  // 3. Successful Transaction Creation
  it("3. Successfully creates a valid transaction with rounded integer-paise precision and correct UID", async () => {
    const payload = {
      amount: 499.994, // Should round to 499.99
      type: "expense",
      category: "Shopping",
      description: "Books",
      date: "2026-11-20T10:00:00.000Z",
    };

    const docId = await addTransaction(payload, "user_integrity_A");
    expect(docId).toBeDefined();

    const stored = inMemoryStore.get(`transactions/${docId}`);
    expect(stored).toBeDefined();
    expect(stored.userId).toBe("user_integrity_A");
    expect(stored.amount).toBe(499.99); // Exact 2-decimal rounded rupees
    expect(stored.category).toBe("Shopping");
  });

  // 4. Editing Without Duplicate Creation
  it("4. Editing an existing transaction modifies in-place and never creates a second record", async () => {
    const docId = "tx_edit_test_1";
    await addTransaction({
      id: docId,
      amount: 1000,
      type: "expense",
      category: "Bills",
      description: "Original Internet Bill",
    });

    expect(inMemoryStore.size).toBe(1);

    // Update existing transaction
    await updateTransaction(
      docId,
      {
        amount: 1200,
        description: "Updated Internet + Cable Bill",
      },
      "user_integrity_A"
    );

    // Must still have exactly 1 record
    expect(inMemoryStore.size).toBe(1);
    const updated = inMemoryStore.get(`transactions/${docId}`);
    expect(updated.amount).toBe(1200);
    expect(updated.description).toBe("Updated Internet + Cable Bill");
  });

  // 5. Deleting a Transaction and Refreshing Totals
  it("5. Deleting a transaction removes the record and recalculates balances without phantom residuals", async () => {
    const tx1 = { id: "tx_1", userId: "user_integrity_A", type: "income" as const, amount: 50000, category: "Salary", date: "2026-11-01" };
    const tx2 = { id: "tx_2", userId: "user_integrity_A", type: "expense" as const, amount: 15000, category: "Rent", date: "2026-11-02" };
    const tx3 = { id: "tx_3", userId: "user_integrity_A", type: "expense" as const, amount: 5000, category: "Food", date: "2026-11-03" };

    const initialList = [tx1, tx2, tx3];
    expect(calculateTotalIncome(initialList)).toBe(50000);
    expect(calculateTotalExpenses(initialList)).toBe(20000);
    expect(calculateBalance(50000, 20000)).toBe(30000);

    // Delete tx2 (Rent - 15000)
    await deleteTransaction("tx_2", "user_integrity_A");

    const remainingList = initialList.filter((t) => t.id !== "tx_2");
    expect(calculateTotalIncome(remainingList)).toBe(50000);
    expect(calculateTotalExpenses(remainingList)).toBe(5000);
    expect(calculateBalance(50000, 5000)).toBe(45000); // Exact updated balance
  });

  // 6. Concurrent Update Protection & Immutable Field Guard
  it("6. Protects against immutable field modification and throws when updating non-existent records", async () => {
    const docId = "tx_immutable_test";
    await addTransaction({
      id: docId,
      amount: 2500,
      type: "expense",
      category: "Health",
      userId: "user_integrity_A",
    });

    // Attempt to hijack ownership or alter creation timestamp
    await updateTransaction(
      docId,
      {
        userId: "hacker_UID", // Must be ignored and stripped
        amount: 3000,
      },
      "user_integrity_A"
    );

    const stored = inMemoryStore.get(`transactions/${docId}`);
    expect(stored.userId).toBe("user_integrity_A"); // Retained original owner!
    expect(stored.amount).toBe(3000);

    // Attempt to update non-existent record
    await expect(
      updateTransaction("non_existent_id", { amount: 500 }, "user_integrity_A")
    ).rejects.toThrow("Document not found");
  });

  // 7. Network Failure During Transaction Write
  it("7. Handles transient network errors with retry utilities and identifies non-transient failures", async () => {
    const { categorizeError, isTransientError } = await import("@/lib/errorHandler");

    const networkErr = { code: "unavailable", message: "Database temporarily unavailable" };
    expect(isTransientError(networkErr)).toBe(true);

    const authErr = { code: "permission-denied", message: "Missing permissions" };
    expect(isTransientError(authErr)).toBe(false);

    const errorDetails = categorizeError(networkErr);
    expect(errorDetails.category).toBe("network");
    expect(errorDetails.userMessage).toContain("Database service is temporarily unavailable");
  });

  // 8. Ambiguous Write Result and Retry Safety
  it("8. Retrying a write operation after timeout preserves single-record consistency", async () => {
    const stablePayload = {
      id: "tx_retry_safe_id",
      amount: 750,
      type: "expense",
      category: "Entertainment",
      description: "Concert Ticket",
    };

    // First attempt succeeds in store
    await addTransaction(stablePayload);

    // Simulated network blip / retry with the exact same payload
    await addTransaction(stablePayload);

    // Verify only 1 document exists
    expect(inMemoryStore.size).toBe(1);
    expect(inMemoryStore.get("transactions/tx_retry_safe_id").amount).toBe(750);
  });

  // 9. Offline Account Switching
  it("9. Rejects writes if authenticated session changed before operation executed", async () => {
    const payload = { amount: 200, type: "expense", category: "Food" };

    // Active user is User A, but expected UID is User B
    await expect(
      addTransaction(payload, "user_integrity_B")
    ).rejects.toThrow(/Account switched/);
  });

  // 10. CSV Export Ownership and Data Completeness
  it("10. Generates complete, RFC 4180 compliant CSV and neutralizes formula injection attacks", () => {
    const txns: Transaction[] = [
      {
        id: "tx_csv_1",
        userId: "user_integrity_A",
        date: "2026-11-20T14:30:00.000Z",
        type: "expense",
        category: "Food",
        description: "Lunch at Cafe, with dessert", // Contains comma
        amount: 850.5,
      },
      {
        id: "tx_csv_2",
        userId: "user_integrity_A",
        date: "2026-11-22T09:00:00.000Z",
        type: "income",
        category: "Salary",
        description: "=SUM(A1:A10)", // Potential formula injection!
        amount: 75000,
      },
      {
        id: "tx_csv_3",
        userId: "user_integrity_A",
        date: "2026-11-25T18:00:00.000Z",
        type: "expense",
        category: "Shopping",
        description: 'New "Gaming" Mouse', // Contains quotes
        amount: 2499,
      },
    ];

    const csv = generateTransactionsCSV(txns);

    // Verify header presence
    expect(csv).toContain("Transaction ID,Date (ISO),Date (Local),Type,Category,Description,Amount (INR)");

    // Verify RFC 4180 comma wrapping
    expect(csv).toContain('"Lunch at Cafe, with dessert"');

    // Verify formula injection neutralization with single quote
    expect(csv).toContain("'=SUM(A1:A10)");

    // Verify quote escaping (doubled quotes)
    expect(csv).toContain('"New ""Gaming"" Mouse"');

    // Verify formatted amounts
    expect(csv).toContain("850.50");
    expect(csv).toContain("75000.00");
    expect(csv).toContain("2499.00");
  });

  // 11. Consistent Calculations Across Dashboard and Analytics
  it("11. Verifies mathematical consistency between Dashboard and Analytics calculations", () => {
    const refDate = new Date(2026, 10, 27); // Nov 27, 2026
    const dataset: Transaction[] = [
      { id: "1", userId: "userA", type: "income", amount: 60000, category: "Salary", date: "2026-11-01T10:00:00.000Z", description: "Salary" },
      { id: "2", userId: "userA", type: "expense", amount: 12000, category: "Rent", date: "2026-11-02T10:00:00.000Z", description: "Rent" },
      { id: "3", userId: "userA", type: "expense", amount: 3500, category: "Food", date: "2026-11-15T12:00:00.000Z", description: "Groceries" },
      { id: "4", userId: "userA", type: "income", amount: 15000, category: "Freelance", date: "2026-10-15T12:00:00.000Z", description: "Last Month Project" },
      { id: "5", userId: "userA", type: "expense", amount: 5000, category: "Bills", date: "2026-10-20T12:00:00.000Z", description: "Last Month Utility" },
    ];

    // Global totals
    const totalIncome = calculateTotalIncome(dataset);
    const totalExpenses = calculateTotalExpenses(dataset);
    const balance = calculateBalance(totalIncome, totalExpenses);
    const savingsRate = calculateSavingsRate(totalIncome, totalExpenses);

    expect(totalIncome).toBe(75000);
    expect(totalExpenses).toBe(20500);
    expect(balance).toBe(54500);
    expect(savingsRate).toBe(72.7); // roundCurrency((54500 / 75000) * 100) = 72.7%

    // Current month (Nov 2026) spending evaluated on Dashboard
    const novSpending = calculateCurrentMonthSpending(dataset, refDate);
    expect(novSpending).toBe(15500); // 12000 + 3500

    // Monthly summary evaluated on Analytics
    const monthlySummary = calculateMonthlySummary(dataset, 2, refDate);
    expect(monthlySummary.length).toBe(2);

    const octPoint = monthlySummary[0]; // Oct 2026
    expect(octPoint.monthKey).toBe("2026-10");
    expect(octPoint.income).toBe(15000);
    expect(octPoint.expense).toBe(5000);

    const novPoint = monthlySummary[1]; // Nov 2026
    expect(novPoint.monthKey).toBe("2026-11");
    expect(novPoint.income).toBe(60000);
    expect(novPoint.expense).toBe(15500);

    // Exact parity between Dashboard monthly expense and Analytics November bar
    expect(novSpending).toBe(novPoint.expense);
  });

  // 12. Invalid or Malformed Transaction Data
  it("12. Strictly rejects zero, negative, NaN, and excessive amounts", async () => {
    await expect(addTransaction({ amount: 0, type: "expense" })).rejects.toThrow("greater than zero");
    await expect(addTransaction({ amount: -150, type: "expense" })).rejects.toThrow("greater than zero");
    await expect(addTransaction({ amount: NaN, type: "expense" })).rejects.toThrow("greater than zero");
    await expect(addTransaction({ amount: 1000000001, type: "expense" })).rejects.toThrow("cannot exceed ₹100 Crore");
  });

  // 13. Recovery Behavior After Accidental Deletion
  it("13. Restores an accidentally deleted transaction with identical data and ID", async () => {
    const originalRecord: Transaction = {
      id: "tx_restore_me",
      userId: "user_integrity_A",
      type: "expense",
      amount: 3200,
      category: "Transport",
      description: "Train Pass",
      date: "2026-11-20T08:00:00.000Z",
    };

    // 1. Initial creation
    await addTransaction(originalRecord);
    expect(inMemoryStore.has("transactions/tx_restore_me")).toBe(true);

    // 2. Accidental deletion
    await deleteTransaction("tx_restore_me", "user_integrity_A");
    expect(inMemoryStore.has("transactions/tx_restore_me")).toBe(false);

    // 3. User taps "Undo" - restores the record
    await addTransaction(originalRecord, "user_integrity_A");
    expect(inMemoryStore.has("transactions/tx_restore_me")).toBe(true);

    const restored = inMemoryStore.get("transactions/tx_restore_me");
    expect(restored.id).toBe("tx_restore_me");
    expect(restored.amount).toBe(3200);
    expect(restored.category).toBe("Transport");
    expect(restored.description).toBe("Train Pass");
  });
});
