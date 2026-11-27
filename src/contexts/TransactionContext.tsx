import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import {
  addTransaction as dbAddTransaction,
  updateTransaction as dbUpdateTransaction,
  deleteTransaction as dbDeleteTransaction,
} from "@/lib/db";
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
        setLoading(false);
      },
      (err) => {
        console.error("Centralized transaction listener error:", err);
        setError(err.message || "Failed to load transactions");
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);

  const addTransaction = useCallback(async (data: any) => {
    await dbAddTransaction(data);
  }, []);

  const updateTransaction = useCallback(async (id: string, updates: Record<string, any>) => {
    await dbUpdateTransaction(id, updates);
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    await dbDeleteTransaction(id);
  }, []);

  const refresh = useCallback(() => {
    // For manual triggers if needed
  }, []);

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        loading,
        error,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        refresh,
      }}
    >
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
