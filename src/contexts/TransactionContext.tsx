import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import {
  addTransaction as dbAddTransaction,
  updateTransaction as dbUpdateTransaction,
  deleteTransaction as dbDeleteTransaction,
} from "@/lib/db";
import { getErrorMessage, logError, withRetry } from "@/lib/errorHandler";
import type { Transaction } from "@/lib/storage";

interface TransactionContextType {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  addTransaction: (data: any) => Promise<void>;
  updateTransaction: (id: string, updates: Record<string, any>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  refresh: () => void;
}

const TransactionContext = createContext<TransactionContextType | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    setRetryTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    // Clean up and clear data immediately on logout or if user is unauthenticated
    if (!user?.uid) {
      setTransactions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Single coordinated real-time Firestore listener for the authenticated user session
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rawDocs = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const rawDate = d.date || d.createdAt;
          let dateStr = new Date().toISOString();

          if (rawDate?.seconds) {
            dateStr = new Date(rawDate.seconds * 1000).toISOString();
          } else if (typeof rawDate === "string") {
            dateStr = rawDate;
          }

          return {
            id: docSnap.id,
            userId: d.userId,
            type: d.type,
            amount: Number(d.amount || 0),
            category: d.category || "Other",
            description: d.description || "",
            date: dateStr,
          } as Transaction;
        });

        // Pre-sort descending chronologically (newest first)
        rawDocs.sort((a, b) => {
          const tA = new Date(a.date).getTime() || 0;
          const tB = new Date(b.date).getTime() || 0;
          return tB - tA;
        });

        setTransactions(rawDocs);
        setError(null);
        setLoading(false);
      },
      (err) => {
        logError(err, { operation: "onSnapshot_transactions", userId: user.uid });
        setError(getErrorMessage(err));
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid, retryTrigger]);

  const addTransaction = useCallback(async (data: any) => {
    try {
      await withRetry(() => dbAddTransaction(data), { maxRetries: 2 });
    } catch (err) {
      logError(err, { operation: "addTransaction", amount: data?.amount });
      throw err;
    }
  }, []);

  const updateTransaction = useCallback(async (id: string, updates: Record<string, any>) => {
    try {
      await withRetry(() => dbUpdateTransaction(id, updates), { maxRetries: 2 });
    } catch (err) {
      logError(err, { operation: "updateTransaction", id });
      throw err;
    }
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    try {
      await withRetry(() => dbDeleteTransaction(id), { maxRetries: 2 });
    } catch (err) {
      logError(err, { operation: "deleteTransaction", id });
      throw err;
    }
  }, []);

  // Memoize context value to prevent downstream consumers from re-rendering unless data changes
  const contextValue = useMemo(
    () => ({
      transactions,
      loading,
      error,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      refresh,
    }),
    [transactions, loading, error, addTransaction, updateTransaction, deleteTransaction, refresh]
  );

  return (
    <TransactionContext.Provider value={contextValue}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const ctx = useContext(TransactionContext);
  if (!ctx) {
    throw new Error("useTransactions must be used within TransactionProvider");
  }
  return ctx;
}
