import { describe, it, expect } from "vitest";
import {
  toPaise,
  toRupees,
  roundCurrency,
  roundPercent,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateBalance,
  calculateNetBalance,
  calculateSavings,
  calculateRemainingBudget,
  isBudgetExceeded,
  calculateBudgetUsagePercent,
  calculateSavingsProgress,
  calculateSavingsRate,
  calculateExpenseRatio,
  filterTransactionsByMonth,
  filterTransactionsByYear,
  filterTransactionsByCurrentMonth,
  calculateCurrentMonthSpending,
  calculateMonthlySummary,
  calculateCategoryBreakdown,
  formatCurrency,
  parseTransactionDate,
  TransactionLike
} from "../lib/financial";

describe("Financial Calculation Engine", () => {

  // 1. Income addition
  describe("1. Income Addition", () => {
    it("adds multiple incomes accurately", () => {
      const txns: TransactionLike[] = [
        { amount: 50000, type: "income", category: "Salary" },
        { amount: 15000, type: "income", category: "Freelance" },
        { amount: 2500, type: "income", category: "Investment" },
      ];
      expect(calculateTotalIncome(txns)).toBe(67500);
    });

    it("ignores expense transactions when calculating total income", () => {
      const txns: TransactionLike[] = [
        { amount: 50000, type: "income" },
        { amount: 12000, type: "expense" },
        { amount: 8000, type: "income" },
      ];
      expect(calculateTotalIncome(txns)).toBe(58000);
    });

    it("handles realistic INR income amounts", () => {
      const txns: TransactionLike[] = [
        { amount: 1524655, type: "income", category: "Salary" },
      ];
      expect(calculateTotalIncome(txns)).toBe(1524655);
    });
  });

  // 2. Expense addition
  describe("2. Expense Addition", () => {
    it("adds multiple expenses accurately", () => {
      const txns: TransactionLike[] = [
        { amount: 150000, type: "expense", category: "Food" },
        { amount: 15000, type: "expense", category: "Bills" },
        { amount: 5456, type: "expense", category: "Food" },
      ];
      expect(calculateTotalExpenses(txns)).toBe(170456);
    });

    it("ignores income transactions when calculating total expenses", () => {
      const txns: TransactionLike[] = [
        { amount: 4500, type: "expense" },
        { amount: 100000, type: "income" },
        { amount: 5500, type: "expense" },
      ];
      expect(calculateTotalExpenses(txns)).toBe(10000);
    });
  });

  // 3. Balance calculation
  describe("3. Balance Calculation", () => {
    it("calculates positive balance (surplus) correctly", () => {
      const income = 100000;
      const expenses = 45000;
      expect(calculateBalance(income, expenses)).toBe(55000);
      expect(calculateSavings(income, expenses)).toBe(55000);
    });

    it("calculates negative balance (deficit) correctly", () => {
      const income = 30000;
      const expenses = 45000;
      expect(calculateBalance(income, expenses)).toBe(-15000);
    });

    it("calculates net balance directly from a mixed transactions array", () => {
      const txns: TransactionLike[] = [
        { amount: 100000, type: "income" },
        { amount: 35000, type: "expense" },
        { amount: 15000, type: "expense" },
        { amount: 5000, type: "income" },
      ];
      expect(calculateNetBalance(txns)).toBe(55000);
    });
  });

  // 4. Budget remaining calculation
  describe("4. Budget Remaining Calculation", () => {
    it("calculates remaining budget when under limit", () => {
      const budgetLimit = 25000;
      const actualSpending = 18500;
      expect(calculateRemainingBudget(budgetLimit, actualSpending)).toBe(6500);
      expect(isBudgetExceeded(budgetLimit, actualSpending)).toBe(false);
      expect(calculateBudgetUsagePercent(budgetLimit, actualSpending)).toBe(74);
    });

    it("calculates negative remaining budget when budget is exceeded", () => {
      const budgetLimit = 20000;
      const actualSpending = 24500;
      expect(calculateRemainingBudget(budgetLimit, actualSpending)).toBe(-4500);
      expect(isBudgetExceeded(budgetLimit, actualSpending)).toBe(true);
      expect(calculateBudgetUsagePercent(budgetLimit, actualSpending)).toBe(122.5);
    });

    it("handles zero budget limit safely", () => {
      expect(calculateRemainingBudget(0, 5000)).toBe(-5000);
      expect(isBudgetExceeded(0, 5000)).toBe(false);
      expect(calculateBudgetUsagePercent(0, 5000)).toBe(0);
    });
  });

  // 5. Savings progress
  describe("5. Savings Progress", () => {
    it("calculates accurate savings progress toward goal", () => {
      const currentSavings = 25000;
      const savingsGoal = 50000;
      expect(calculateSavingsProgress(currentSavings, savingsGoal)).toBe(50);
    });

    it("caps progress at 100% when savings exceed goal", () => {
      const currentSavings = 75000;
      const savingsGoal = 50000;
      expect(calculateSavingsProgress(currentSavings, savingsGoal)).toBe(100);
    });

    it("handles zero savings goal safely (division by zero protection)", () => {
      expect(calculateSavingsProgress(10000, 0)).toBe(0);
      expect(calculateSavingsProgress(10000, -500)).toBe(0);
    });

    it("returns 0 when current savings is 0 or negative", () => {
      expect(calculateSavingsProgress(0, 50000)).toBe(0);
      expect(calculateSavingsProgress(-1000, 50000)).toBe(0);
    });
  });

  // 6. Zero-value handling
  describe("6. Zero-Value and Edge Case Handling", () => {
    it("handles empty transaction lists without errors", () => {
      expect(calculateTotalIncome([])).toBe(0);
      expect(calculateTotalExpenses([])).toBe(0);
      expect(calculateNetBalance([])).toBe(0);
      expect(calculateCategoryBreakdown([])).toEqual([]);
    });

    it("handles null/undefined values safely", () => {
      // @ts-ignore
      expect(calculateTotalIncome(null)).toBe(0);
      // @ts-ignore
      expect(calculateTotalExpenses(undefined)).toBe(0);
      expect(toPaise(null)).toBe(0);
      expect(toPaise(undefined)).toBe(0);
      expect(toPaise("")).toBe(0);
      expect(toPaise("invalid_number")).toBe(0);
    });

    it("calculates 0% savings rate when income is 0", () => {
      expect(calculateSavingsRate(0, 5000)).toBe(0);
      expect(calculateSavingsRate(0, 0)).toBe(0);
    });

    it("handles expense ratio when income is 0", () => {
      expect(calculateExpenseRatio(0, 5000)).toBe(1);
      expect(calculateExpenseRatio(0, 0)).toBe(0);
    });
  });

  // 7. Decimal and rounding accuracy (floating-point precision)
  describe("7. Decimal & Rounding Accuracy (Paise Precision)", () => {
    it("avoids JavaScript floating-point error (0.1 + 0.2)", () => {
      // In raw JS: 0.1 + 0.2 = 0.30000000000000004
      const txns: TransactionLike[] = [
        { amount: 0.1, type: "income" },
        { amount: 0.2, type: "income" },
      ];
      expect(calculateTotalIncome(txns)).toBe(0.3);
    });

    it("handles decimal subtractions without precision loss", () => {
      // In raw JS: 1.4 - 1.0 = 0.3999999999999999
      const income = 1.4;
      const expenses = 1.0;
      expect(calculateBalance(income, expenses)).toBe(0.4);
    });

    it("correctly converts fractional rupees to integer paise without truncation", () => {
      // In raw JS: 19.99 * 100 = 1998.9999999999998
      expect(toPaise(19.99)).toBe(1999);
      expect(toRupees(1999)).toBe(19.99);
      expect(roundCurrency(19.99)).toBe(19.99);
    });

    it("handles realistic paise additions (e.g. ₹150.75 + ₹49.25 = ₹200.00)", () => {
      const txns: TransactionLike[] = [
        { amount: 150.75, type: "expense" },
        { amount: 49.25, type: "expense" },
      ];
      expect(calculateTotalExpenses(txns)).toBe(200);
    });
  });

  // 8. Editing transactions
  describe("8. Editing Transactions", () => {
    it("updates totals when a transaction's amount is edited", () => {
      let txns: TransactionLike[] = [
        { id: "1", amount: 1000, type: "expense", category: "Food" },
        { id: "2", amount: 2000, type: "expense", category: "Transport" },
      ];
      expect(calculateTotalExpenses(txns)).toBe(3000);

      // Edit transaction 1 from 1000 to 1500
      txns = txns.map(t => t.id === "1" ? { ...t, amount: 1500 } : t);
      expect(calculateTotalExpenses(txns)).toBe(3500);
    });

    it("updates balance when a transaction's type is changed from expense to income", () => {
      let txns: TransactionLike[] = [
        { id: "1", amount: 5000, type: "expense" },
      ];
      expect(calculateNetBalance(txns)).toBe(-5000);

      // Correct misclassified transaction to income
      txns = txns.map(t => t.id === "1" ? { ...t, type: "income" } : t);
      expect(calculateNetBalance(txns)).toBe(5000);
    });
  });

  // 9. Deleting transactions
  describe("9. Deleting Transactions", () => {
    it("correctly reduces totals and updates balance when a transaction is removed", () => {
      const original: TransactionLike[] = [
        { id: "t1", amount: 50000, type: "income" },
        { id: "t2", amount: 10000, type: "expense" },
        { id: "t3", amount: 5000, type: "expense" },
      ];
      expect(calculateNetBalance(original)).toBe(35000);

      // Delete t3
      const afterDeletion = original.filter(t => t.id !== "t3");
      expect(calculateTotalExpenses(afterDeletion)).toBe(10000);
      expect(calculateNetBalance(afterDeletion)).toBe(40000);
    });
  });

  // 10. Monthly and yearly filtering
  describe("10. Monthly & Yearly Filtering", () => {
    it("filters transactions strictly by month and year", () => {
      const txns: TransactionLike[] = [
        { amount: 1000, type: "expense", date: "2026-11-01T10:00:00.000Z" },
        { amount: 2000, type: "expense", date: "2026-11-15T10:00:00.000Z" },
        { amount: 3000, type: "expense", date: "2026-10-25T10:00:00.000Z" },
        { amount: 4000, type: "expense", date: "2025-11-01T10:00:00.000Z" }, // Different year
      ];

      // November is month 10 (0-indexed in JS)
      const nov2026 = filterTransactionsByMonth(txns, 2026, 10);
      expect(nov2026).toHaveLength(2);
      expect(calculateTotalExpenses(nov2026)).toBe(3000);
    });

    it("filters transactions strictly by year", () => {
      const txns: TransactionLike[] = [
        { amount: 5000, type: "income", date: "2026-01-05T12:00:00.000Z" },
        { amount: 7000, type: "income", date: "2026-06-15T12:00:00.000Z" },
        { amount: 9000, type: "income", date: "2025-06-15T12:00:00.000Z" },
      ];
      const year2026 = filterTransactionsByYear(txns, 2026);
      expect(year2026).toHaveLength(2);
      expect(calculateTotalIncome(year2026)).toBe(12000);
    });

    it("calculates current month spending independently from prior months", () => {
      const refDate = new Date("2026-11-15T12:00:00.000Z");
      const txns: TransactionLike[] = [
        { amount: 5000, type: "expense", date: "2026-11-02T00:00:00.000Z" },
        { amount: 2500, type: "expense", date: "2026-11-10T00:00:00.000Z" },
        { amount: 15000, type: "expense", date: "2026-10-15T00:00:00.000Z" }, // Previous month
      ];
      expect(calculateCurrentMonthSpending(txns, refDate)).toBe(7500);
    });

    it("produces rolling 6-month summary in chronological order", () => {
      const refDate = new Date("2026-11-01T00:00:00.000Z");
      const txns: TransactionLike[] = [
        { amount: 10000, type: "income", date: "2026-11-01T00:00:00.000Z" },
        { amount: 3000, type: "expense", date: "2026-11-01T00:00:00.000Z" },
        { amount: 5000, type: "income", date: "2026-10-01T00:00:00.000Z" },
      ];
      const summary = calculateMonthlySummary(txns, 6, refDate);
      expect(summary).toHaveLength(6);
      expect(summary[5].name).toBe("Nov");
      expect(summary[5].income).toBe(10000);
      expect(summary[5].expense).toBe(3000);
      expect(summary[5].net).toBe(7000);

      expect(summary[4].name).toBe("Oct");
      expect(summary[4].income).toBe(5000);
    });
  });

  // 11. Duplicate submission prevention & idempotency
  describe("11. Duplicate Submission Prevention & Idempotency", () => {
    it("roundCurrency produces idempotent output", () => {
      const val = 1250.75;
      const step1 = roundCurrency(val);
      const step2 = roundCurrency(step1);
      expect(step1).toBe(step2);
      expect(step2).toBe(1250.75);
    });

    it("calculating totals twice on identical transaction list yields identical results", () => {
      const txns: TransactionLike[] = [
        { amount: 12000, type: "income" },
        { amount: 4500, type: "expense" },
      ];
      const r1 = calculateBalance(calculateTotalIncome(txns), calculateTotalExpenses(txns));
      const r2 = calculateBalance(calculateTotalIncome(txns), calculateTotalExpenses(txns));
      expect(r1).toBe(r2);
      expect(r1).toBe(7500);
    });
  });

  // 12. Large monetary values (Lakhs & Crores)
  describe("12. Large Monetary Values in INR", () => {
    it("accurately calculates values exceeding 1 Crore (10,000,000 INR)", () => {
      const txns: TransactionLike[] = [
        { amount: 10000000, type: "income" },   // 1 Crore
        { amount: 2500000, type: "expense" },   // 25 Lakhs
      ];
      expect(calculateNetBalance(txns)).toBe(7500000); // 75 Lakhs
    });

    it("formats Indian Rupee currency correctly with Indian comma grouping", () => {
      expect(formatCurrency(1524655)).toBe("₹15,24,655");
      expect(formatCurrency(150000)).toBe("₹1,50,000");
      expect(formatCurrency(10000000)).toBe("₹1,00,00,000"); // 1 Crore
      expect(formatCurrency(5456.75)).toBe("₹5,456.75");
      expect(formatCurrency(0)).toBe("₹0");
      expect(formatCurrency(-5000)).toBe("-₹5,000");
    });
  });
});

