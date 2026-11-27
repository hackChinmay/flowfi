/**
 * FlowFi Financial Calculation Engine
 * 
 * Production-grade financial mathematics module for FlowFi.
 * Enforces integer minor-unit (paise) arithmetic internally to completely
 * prevent IEEE-754 floating-point inaccuracies (e.g. 0.1 + 0.2 = 0.30000000000000004).
 */

export type TransactionType = "income" | "expense";

export interface TransactionLike {
  id?: string;
  userId?: string;
  amount: number | string;
  type: string;
  category?: string;
  description?: string;
  date?: any;
  createdAt?: any;
}

export interface CategoryBreakdownItem {
  name: string;
  amount: number;
  percent: number;
}

export interface MonthlyDataPoint {
  name: string;
  monthKey: string;
  year: number;
  month: number;
  income: number;
  expense: number;
  net: number;
}

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// ============================================================================
// 1. MONETARY PRECISION & MINOR UNIT (PAISE) CONVERSIONS
// ============================================================================

/**
 * Safely converts an amount in Rupees to integer Paise (1 INR = 100 paise).
 * Applies Math.round to eliminate floating-point representation artifacts.
 */
export function toPaise(rupees: number | string | null | undefined): number {
  if (rupees === null || rupees === undefined || rupees === "") return 0;
  const num = typeof rupees === "number" ? rupees : Number(rupees);
  if (!isFinite(num) || isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Converts integer Paise back to Rupees.
 */
export function toRupees(paise: number): number {
  if (!isFinite(paise) || isNaN(paise)) return 0;
  return paise / 100;
}

/**
 * Rounds any monetary amount to 2 decimal places (paise precision).
 */
export function roundCurrency(amount: number | string | null | undefined): number {
  return toRupees(toPaise(amount));
}

/**
 * Safe percentage rounding (default 1 decimal place).
 */
export function roundPercent(value: number, decimals: number = 1): number {
  if (!isFinite(value) || isNaN(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ============================================================================
// 2. CORE FINANCIAL FORMULAS (CALCULATION ENGINE)
// ============================================================================

/**
 * Determines whether a transaction is income.
 */
export function isIncome(t: TransactionLike): boolean {
  return t.type?.toLowerCase() === "income";
}

/**
 * Determines whether a transaction is an expense.
 */
export function isExpense(t: TransactionLike): boolean {
  return t.type?.toLowerCase() === "expense";
}

/**
 * Calculates total income across transactions using integer paise arithmetic.
 */
export function calculateTotalIncome(txns: TransactionLike[]): number {
  if (!txns || !Array.isArray(txns)) return 0;
  const totalPaise = txns.reduce((sum, t) => {
    if (isIncome(t)) {
      const p = toPaise(t.amount);
      return sum + (p > 0 ? p : 0);
    }
    return sum;
  }, 0);
  return toRupees(totalPaise);
}

/**
 * Calculates total expenses across transactions using integer paise arithmetic.
 */
export function calculateTotalExpenses(txns: TransactionLike[]): number {
  if (!txns || !Array.isArray(txns)) return 0;
  const totalPaise = txns.reduce((sum, t) => {
    if (isExpense(t)) {
      const p = toPaise(t.amount);
      return sum + (p > 0 ? p : 0);
    }
    return sum;
  }, 0);
  return toRupees(totalPaise);
}

/**
 * Balance = Total Income - Total Expenses
 */
export function calculateBalance(totalIncome: number, totalExpenses: number): number {
  return toRupees(toPaise(totalIncome) - toPaise(totalExpenses));
}

/**
 * Net Balance directly from transactions.
 */
export function calculateNetBalance(txns: TransactionLike[]): number {
  return calculateBalance(calculateTotalIncome(txns), calculateTotalExpenses(txns));
}

/**
 * Savings = Income - Expenses
 */
export function calculateSavings(income: number, expenses: number): number {
  return calculateBalance(income, expenses);
}

/**
 * Remaining Budget = Budget Limit - Actual Spending.
 * Positive when within budget, negative when limit exceeded.
 */
export function calculateRemainingBudget(budgetLimit: number, actualSpending: number): number {
  return toRupees(toPaise(budgetLimit) - toPaise(actualSpending));
}

/**
 * Checks if spending exceeds the budget limit.
 */
export function isBudgetExceeded(budgetLimit: number, actualSpending: number): boolean {
  const safeLimit = toPaise(budgetLimit);
  const safeSpending = toPaise(actualSpending);
  return safeLimit > 0 && safeSpending > safeLimit;
}

/**
 * Budget usage percentage.
 */
export function calculateBudgetUsagePercent(budgetLimit: number, actualSpending: number): number {
  const safeLimit = toPaise(budgetLimit);
  if (safeLimit <= 0) return 0;
  const safeSpending = toPaise(actualSpending);
  return roundPercent((safeSpending / safeLimit) * 100, 1);
}

/**
 * Savings Progress = (Current Savings / Savings Goal) * 100.
 * Safely handles missing goal, zero goal, negative savings, and caps progress at 100%.
 */
export function calculateSavingsProgress(currentSavings: number, savingsGoal: number): number {
  const safeGoal = toPaise(savingsGoal);
  if (safeGoal <= 0) return 0;

  const safeSavings = toPaise(currentSavings);
  if (safeSavings <= 0) return 0;

  const progress = (safeSavings / safeGoal) * 100;
  return Math.min(100, roundPercent(progress, 1));
}

/**
 * Savings Rate = ((Total Income - Total Expenses) / Total Income) * 100.
 * Returns 0 if income <= 0 or if expenses exceed income.
 */
export function calculateSavingsRate(totalIncome: number, totalExpenses: number): number {
  const incPaise = toPaise(totalIncome);
  if (incPaise <= 0) return 0;

  const expPaise = toPaise(totalExpenses);
  const netSavingsPaise = incPaise - expPaise;
  if (netSavingsPaise <= 0) return 0;

  return roundPercent((netSavingsPaise / incPaise) * 100, 1);
}

/**
 * Expense to Income ratio.
 */
export function calculateExpenseRatio(totalIncome: number, totalExpenses: number): number {
  const incPaise = toPaise(totalIncome);
  const expPaise = toPaise(totalExpenses);

  if (incPaise <= 0) {
    return expPaise > 0 ? 1 : 0;
  }
  return roundPercent(expPaise / incPaise, 3);
}

// ============================================================================
// 3. DATE EXTRACTION & PERIOD REPORTING
// ============================================================================

/**
 * Robustly parses a date from Firestore Timestamp ({ seconds, nanoseconds }),
 * ISO string, Date object, or numeric milliseconds.
 */
export function parseTransactionDate(t: TransactionLike | any): Date {
  if (!t) return new Date();
  const raw = t.date || t.createdAt;
  if (!raw) return new Date();

  // Firestore Timestamp
  if (typeof raw === "object" && typeof raw.seconds === "number") {
    return new Date(raw.seconds * 1000);
  }

  // Date instance
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? new Date() : raw;
  }

  // String / Number
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Filters transactions for a specific month (zero-indexed: 0 = Jan, 11 = Dec) and year.
 */
export function filterTransactionsByMonth(
  txns: TransactionLike[],
  year: number,
  monthZeroIndexed: number
): TransactionLike[] {
  if (!txns || !Array.isArray(txns)) return [];
  return txns.filter((t) => {
    const d = parseTransactionDate(t);
    return d.getFullYear() === year && d.getMonth() === monthZeroIndexed;
  });
}

/**
 * Filters transactions for the current month based on a reference date.
 */
export function filterTransactionsByCurrentMonth(
  txns: TransactionLike[],
  referenceDate: Date = new Date()
): TransactionLike[] {
  return filterTransactionsByMonth(
    txns,
    referenceDate.getFullYear(),
    referenceDate.getMonth()
  );
}

/**
 * Filters transactions for a specific year.
 */
export function filterTransactionsByYear(
  txns: TransactionLike[],
  year: number
): TransactionLike[] {
  if (!txns || !Array.isArray(txns)) return [];
  return txns.filter((t) => {
    const d = parseTransactionDate(t);
    return d.getFullYear() === year;
  });
}

/**
 * Calculates current month's expenses using integer paise arithmetic.
 */
export function calculateCurrentMonthSpending(
  txns: TransactionLike[],
  referenceDate: Date = new Date()
): number {
  const currentMonthTxns = filterTransactionsByCurrentMonth(txns, referenceDate);
  return calculateTotalExpenses(currentMonthTxns);
}

/**
 * Calculates rolling monthly summary (e.g. past 6 months) in chronological order.
 */
export function calculateMonthlySummary(
  txns: TransactionLike[],
  monthsCount: number = 6,
  referenceDate: Date = new Date()
): MonthlyDataPoint[] {
  const points: MonthlyDataPoint[] = [];

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;

    const monthTxns = filterTransactionsByMonth(txns, y, m);
    const income = calculateTotalIncome(monthTxns);
    const expense = calculateTotalExpenses(monthTxns);
    const net = calculateBalance(income, expense);

    points.push({
      name: MONTH_NAMES[m],
      monthKey,
      year: y,
      month: m,
      income,
      expense,
      net,
    });
  }

  return points;
}

// ============================================================================
// 4. CATEGORY BREAKDOWN
// ============================================================================

/**
 * Computes category breakdown for expenses with safe percentage rounding.
 */
export function calculateCategoryBreakdown(
  txns: TransactionLike[],
  totalExpensesOverride?: number
): CategoryBreakdownItem[] {
  if (!txns || !Array.isArray(txns)) return [];

  const catMapPaise: Record<string, number> = {};

  txns.forEach((t) => {
    if (isExpense(t)) {
      const cat = t.category || "Other";
      const p = toPaise(t.amount);
      if (p > 0) {
        catMapPaise[cat] = (catMapPaise[cat] || 0) + p;
      }
    }
  });

  const totalExpPaise = totalExpensesOverride !== undefined
    ? toPaise(totalExpensesOverride)
    : Object.values(catMapPaise).reduce((s, p) => s + p, 0);

  return Object.entries(catMapPaise)
    .map(([name, paise]) => {
      const amount = toRupees(paise);
      const percent = totalExpPaise > 0
        ? roundPercent((paise / totalExpPaise) * 100, 1)
        : 0;
      return { name, amount, percent };
    })
    .sort((a, b) => b.amount - a.amount);
}

// ============================================================================
// 5. UNIFIED CURRENCY FORMATTER
// ============================================================================

/**
 * Consistent, robust Indian Rupee (INR) currency formatter.
 * Handles negative amounts, integers (₹1,50,000), decimals (₹150.50), and zero (₹0).
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "₹0";
  const num = typeof amount === "number" ? amount : Number(amount);
  if (!isFinite(num) || isNaN(num)) return "₹0";

  const safe = roundCurrency(num);
  const isNegative = safe < 0;
  const abs = Math.abs(safe);
  const hasPaise = abs % 1 !== 0;

  const formattedAbs = abs.toLocaleString("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  });

  return `${isNegative ? "-" : ""}₹${formattedAbs}`;
}
