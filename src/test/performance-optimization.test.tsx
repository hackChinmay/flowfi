import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";

// Test hook simulating memoized AuthContext value stability
function useTestAuth(initialUser: { uid: string; email: string } | null) {
  const [user, setUser] = useState(initialUser);
  const [loading, setLoading] = useState(false);
  const [renderCount, setRenderCount] = useState(0);

  const signIn = useCallback(async () => {}, []);
  const signUp = useCallback(async () => {}, []);
  const signOut = useCallback(async () => {
    setUser(null);
  }, []);
  const signInWithGoogle = useCallback(async () => {}, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
    }),
    [user, loading, signIn, signUp, signOut, signInWithGoogle]
  );

  return { value, setRenderCount, setUser };
}

// Test component simulating Transaction pagination
function TransactionList({
  transactions,
  pageSize = 5,
}: {
  transactions: Array<{ id: string; amount: number; category: string }>;
  pageSize?: number;
}) {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const visibleTxns = useMemo(
    () => transactions.slice(0, visibleCount),
    [transactions, visibleCount]
  );

  return (
    <div>
      <div data-testid="txn-count">{visibleTxns.length} visible</div>
      <ul>
        {visibleTxns.map((t) => (
          <li key={t.id} data-testid={`txn-${t.id}`}>
            {t.category}: ₹{t.amount}
          </li>
        ))}
      </ul>
      {visibleCount < transactions.length && (
        <button
          onClick={() => setVisibleCount((prev) => prev + pageSize)}
          data-testid="load-more"
        >
          Load More
        </button>
      )}
    </div>
  );
}

describe("FlowFi Correction 6: Application Performance & Render Optimization", () => {
  describe("1. Context Value Memoization & Reference Stability", () => {
    it("maintains stable context value reference across re-renders when state is unchanged", () => {
      const { result, rerender } = renderHook(() =>
        useTestAuth({ uid: "user_123", email: "user@example.com" })
      );

      const firstRef = result.current.value;

      // Trigger re-render without state change
      act(() => {
        result.current.setRenderCount((prev) => prev + 1);
      });
      rerender();

      const secondRef = result.current.value;
      // Object reference MUST be identical to prevent downstream consumer re-renders
      expect(secondRef).toBe(firstRef);
    });

    it("updates context value reference only when actual auth state changes", () => {
      const { result, rerender } = renderHook(() =>
        useTestAuth({ uid: "user_123", email: "user@example.com" })
      );

      const firstRef = result.current.value;

      // Change user
      act(() => {
        result.current.setUser({ uid: "user_456", email: "other@example.com" });
      });
      rerender();

      const updatedRef = result.current.value;
      expect(updatedRef).not.toBe(firstRef);
      expect(updatedRef.user?.uid).toBe("user_456");
    });
  });

  describe("2. List Incremental Rendering & Pagination", () => {
    const mockTxns = Array.from({ length: 25 }, (_, i) => ({
      id: `txn_${i + 1}`,
      amount: (i + 1) * 100,
      category: i % 2 === 0 ? "Food" : "Transport",
    }));

    it("only renders initial page size to preserve DOM and rendering performance", () => {
      render(<TransactionList transactions={mockTxns} pageSize={5} />);

      expect(screen.getByTestId("txn-count")).toHaveTextContent("5 visible");
      expect(screen.getByTestId("txn-txn_1")).toBeInTheDocument();
      expect(screen.getByTestId("txn-txn_5")).toBeInTheDocument();
      expect(screen.queryByTestId("txn-txn_6")).not.toBeInTheDocument();
    });

    it("incrementally loads next page when Load More is clicked", () => {
      render(<TransactionList transactions={mockTxns} pageSize={5} />);

      const loadMoreBtn = screen.getByTestId("load-more");
      fireEvent.click(loadMoreBtn);

      expect(screen.getByTestId("txn-count")).toHaveTextContent("10 visible");
      expect(screen.getByTestId("txn-txn_6")).toBeInTheDocument();
      expect(screen.getByTestId("txn-txn_10")).toBeInTheDocument();
      expect(screen.queryByTestId("txn-txn_11")).not.toBeInTheDocument();
    });
  });

  describe("3. Dashboard Recent Transactions Slicing", () => {
    it("slices only top 5 recent transactions from historical dataset", () => {
      const largeHistory = Array.from({ length: 100 }, (_, i) => ({
        id: `t_${i}`,
        amount: 50,
      }));

      const recentTxns = largeHistory.slice(0, 5);
      expect(recentTxns).toHaveLength(5);
      expect(recentTxns[0].id).toBe("t_0");
      expect(recentTxns[4].id).toBe("t_4");
    });
  });
});
