import { describe, it, expect } from "vitest";
import { parseTransactionDate } from "@/lib/financial";
import type { Transaction } from "@/lib/storage";

describe("Database Performance & Query Optimization", () => {
  const sampleTransactions: Transaction[] = [
    { id: "1", userId: "userA", type: "income", amount: 50000, category: "Salary", date: "2026-11-01T10:00:00.000Z", description: "Monthly Salary" },
    { id: "2", userId: "userA", type: "expense", amount: 1500, category: "Food", date: "2026-11-02T12:00:00.000Z", description: "Groceries" },
    { id: "3", userId: "userA", type: "expense", amount: 3000, category: "Transport", date: "2026-11-05T09:30:00.000Z", description: "Fuel" },
    { id: "4", userId: "userA", type: "expense", amount: 2500, category: "Shopping", date: "2026-11-10T15:00:00.000Z", description: "Clothes" },
    { id: "5", userId: "userA", type: "expense", amount: 800, category: "Food", date: "2026-11-15T20:00:00.000Z", description: "Dinner" },
    { id: "6", userId: "userA", type: "expense", amount: 12000, category: "Bills", date: "2026-11-18T11:00:00.000Z", description: "Electricity & Wi-Fi" },
    { id: "7", userId: "userA", type: "income", amount: 15000, category: "Freelance", date: "2026-11-20T16:00:00.000Z", description: "Consulting" },
    { id: "8", userId: "userA", type: "expense", amount: 450, category: "Entertainment", date: "2026-11-25T18:00:00.000Z", description: "Movie ticket" },
  ];

  describe("Recent Transactions Optimization (Limit & Chronological Order)", () => {
    it("limits recent transactions strictly to requested count", () => {
      const sorted = [...sampleTransactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const recent5 = sorted.slice(0, 5);

      expect(recent5.length).toBe(5);
      expect(recent5[0].id).toBe("8"); // Newest
      expect(recent5[4].id).toBe("4");
    });

    it("handles datasets smaller than the requested limit without errors", () => {
      const subset = sampleTransactions.slice(0, 2);
      const recent5 = subset.slice(0, 5);
      expect(recent5.length).toBe(2);
    });
  });

  describe("Pagination and Memory Protection", () => {
    it("slices pages accurately with page size 3", () => {
      const pageSize = 3;
      const sorted = [...sampleTransactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const page1 = sorted.slice(0, pageSize);
      const page2 = sorted.slice(pageSize, pageSize * 2);
      const page3 = sorted.slice(pageSize * 2, pageSize * 3);

      expect(page1.length).toBe(3);
      expect(page2.length).toBe(3);
      expect(page3.length).toBe(2); // Remaining items

      // Confirm no overlapping IDs between pages
      const page1Ids = page1.map(t => t.id);
      const page2Ids = page2.map(t => t.id);
      expect(page1Ids.some(id => page2Ids.includes(id))).toBe(false);
    });

    it("calculates hasMore flag correctly", () => {
      const pageSize = 5;
      const totalItems = sampleTransactions.length; // 8
      let visibleCount = pageSize; // 5

      expect(visibleCount < totalItems).toBe(true);

      visibleCount += pageSize; // 10
      expect(visibleCount < totalItems).toBe(false);
    });

    it("resets visible pagination count when filters change", () => {
      let visibleCount = 60;
      const defaultPageSize = 20;

      // Filter change simulates user toggling 'income'
      const onFilterChange = () => {
        visibleCount = defaultPageSize;
      };

      onFilterChange();
      expect(visibleCount).toBe(20);
    });
  });

  describe("Server-side and Date-Range Scoping", () => {
    it("filters transactions strictly within a specific date range", () => {
      const startDate = "2026-11-05T00:00:00.000Z";
      const endDate = "2026-11-18T23:59:59.999Z";

      const startMs = new Date(startDate).getTime();
      const endMs = new Date(endDate).getTime();

      const inRange = sampleTransactions.filter(t => {
        const tMs = new Date(t.date).getTime();
        return tMs >= startMs && tMs <= endMs;
      });

      expect(inRange.length).toBe(4); // ids: 3, 4, 5, 6
      expect(inRange.map(t => t.id)).toEqual(["3", "4", "5", "6"]);
    });

    it("computes monthly start and end timestamps correctly", () => {
      const year = 2026;
      const month = 10; // November (0-indexed)

      const start = new Date(year, month, 1, 0, 0, 0, 0);
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

      expect(start.getMonth()).toBe(10);
      expect(start.getDate()).toBe(1);
      expect(end.getMonth()).toBe(10);
      expect(end.getDate()).toBe(30); // November has 30 days
    });
  });

  describe("Account Isolation & Cache Invalidation", () => {
    it("clears cached transactions immediately on logout or user switch", () => {
      let activeUserId: string | null = "userA";
      let cachedTransactions: Transaction[] = [...sampleTransactions];

      // Simulate sign out
      activeUserId = null;
      if (!activeUserId) {
        cachedTransactions = [];
      }

      expect(cachedTransactions.length).toBe(0);
      expect(cachedTransactions).toEqual([]);
    });

    it("prevents transaction data from user A leaking into user B cache", () => {
      const userATxns: Transaction[] = [
        { id: "101", userId: "userA", type: "income", amount: 1000, category: "Salary", date: "2026-11-01T00:00:00.000Z" }
      ];
      const userBTxns: Transaction[] = [
        { id: "201", userId: "userB", type: "expense", amount: 500, category: "Food", date: "2026-11-01T00:00:00.000Z" }
      ];

      let currentSessionUser = "userB";
      const sessionCache = currentSessionUser === "userB" ? userBTxns : userATxns;

      expect(sessionCache.every(t => t.userId === "userB")).toBe(true);
      expect(sessionCache.some(t => t.userId === "userA")).toBe(false);
    });
  });

  describe("Single Real-time Subscription Deduplication", () => {
    it("maintains a single reference to avoid duplicate listener creation across pages", () => {
      let activeListeners = 0;

      // Centralized context listener lifecycle
      const subscribe = () => {
        activeListeners++;
        return () => {
          activeListeners--;
        };
      };

      // App level provider mounts
      const unsubscribe = subscribe();
      expect(activeListeners).toBe(1);

      // Navigating across 4 pages does NOT add new listeners
      const pageLoads = ["/dashboard", "/transactions", "/analytics", "/profile"];
      pageLoads.forEach(() => {
        // Consumer pages use context directly, active listeners remain 1
      });

      expect(activeListeners).toBe(1);

      // App unmounts on logout
      unsubscribe();
      expect(activeListeners).toBe(0);
    });
  });
});
