import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/contexts/TransactionContext";
import {
  formatCurrency,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateSavingsRate,
  calculateMonthlySummary,
  calculateCategoryBreakdown
} from "@/lib/financial";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

import { TrendingUp, TrendingDown, BarChart2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";

const CHART_COLORS = [
  "#22c55e", "#3b82f6", "#a855f7",
  "#f97316", "#eab308", "#ec4899"
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type TabType = "monthly" | "categories";

export default function Analytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { transactions: txns, error: txnsError, refresh } = useTransactions();
  const [tab, setTab] = useState<TabType>("monthly");

  // 🧠 CALCULATIONS WITH FINANCIAL INTEGRITY
  const {
    monthlyData,
    categoryData,
    totalIncome,
    totalExpenses,
    savingsRate
  } = useMemo(() => {
    if (!txns.length) {
      return {
        monthlyData: [],
        categoryData: [],
        totalIncome: 0,
        totalExpenses: 0,
        savingsRate: 0
      };
    }

    const totalIncome = calculateTotalIncome(txns);
    const totalExpenses = calculateTotalExpenses(txns);
    const savingsRate = calculateSavingsRate(totalIncome, totalExpenses);
    const monthlyData = calculateMonthlySummary(txns, 6);
    const categoryData = calculateCategoryBreakdown(txns, totalExpenses);

    return {
      monthlyData,
      categoryData,
      totalIncome,
      totalExpenses,
      savingsRate
    };
  }, [txns]);

  if (!user) return null;

  return (
    <div className="pb-24 px-4 pt-6 max-w-md mx-auto space-y-5">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Analytics</h1>
        <ThemeToggle />
      </div>

      {/* Database Error Banner with Retry */}
      {txnsError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl p-4 flex items-center justify-between text-xs font-semibold gap-3 animate-fade-in-up">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
            <span>{txnsError}</span>
          </div>
          <button
            onClick={refresh}
            aria-label="Retry loading transactions"
            className="px-2.5 py-1 bg-destructive/15 hover:bg-destructive/25 text-destructive rounded-lg text-xs font-bold transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          >
            Retry
          </button>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-3 text-center space-y-1">
          <TrendingUp className="mx-auto text-green-500" aria-hidden="true" />
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Income</p>
          <p className="font-semibold text-xs sm:text-sm text-foreground truncate">{formatCurrency(totalIncome)}</p>
        </div>

        <div className="glass-card p-3 text-center space-y-1">
          <TrendingDown className="mx-auto text-destructive" aria-hidden="true" />
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Expenses</p>
          <p className="font-semibold text-xs sm:text-sm text-foreground truncate">{formatCurrency(totalExpenses)}</p>
        </div>

        <div className="glass-card p-3 text-center space-y-1">
          <BarChart2 className="mx-auto text-blue-500" aria-hidden="true" />
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Savings Rate</p>
          <p className="font-semibold text-xs sm:text-sm text-foreground">{savingsRate.toFixed(0)}%</p>
        </div>
      </div>

      {/* EMPTY STATE */}
      {txns.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center space-y-3">
          <p className="text-4xl" aria-hidden="true">📊</p>
          <h2 className="text-base font-semibold">No Financial Data Yet</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Record your income and expenses to unlock visual charts, category breakdowns, and monthly trends.
          </p>
          <Button
            onClick={() => navigate("/add")}
            className="rounded-xl gradient-primary text-primary-foreground text-xs font-semibold px-4 py-2 mt-2"
          >
            Add First Transaction
          </Button>
        </div>
      ) : (
        <>
          {/* TAB SWITCH */}
          <div className="flex bg-muted rounded-xl p-1" role="tablist" aria-label="Analytics view selection">
            <button
              onClick={() => setTab("monthly")}
              role="tab"
              aria-selected={tab === "monthly"}
              className={`flex-1 py-2 rounded-lg text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                tab === "monthly" ? "bg-card shadow font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>

            <button
              onClick={() => setTab("categories")}
              role="tab"
              aria-selected={tab === "categories"}
              className={`flex-1 py-2 rounded-lg text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                tab === "categories" ? "bg-card shadow font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Categories
            </button>
          </div>

          {/* CHARTS */}
          {tab === "monthly" ? (
            <div role="region" aria-label="Monthly income and expense bar chart" className="glass-card rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
                  <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div role="region" aria-label="Expenses category breakdown" className="space-y-4">
              {/* PIE CHART */}
              {categoryData.length > 0 ? (
                <>
                  <div className="glass-card rounded-2xl p-4">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                        >
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* CATEGORY LIST */}
                  <div className="glass-card rounded-2xl p-4 space-y-3">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Breakdown by Category</h2>
                    {categoryData.map((cat, i) => (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span>{cat.name}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(cat.value)} ({cat.percent}%)
                          </span>
                        </div>

                        <div
                          className="h-2 bg-muted rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={cat.percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${cat.name} percentage`}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${cat.percent}%`,
                              background: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="glass-card rounded-2xl p-6 text-center text-xs text-muted-foreground">
                  No expense categories recorded yet.
                </div>
              )}
            </div>
          )}
        </>
      )}

    </div>
  );
}