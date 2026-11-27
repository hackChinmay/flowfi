import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  formatCurrency,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateSavingsRate,
  calculateMonthlySummary,
  calculateCategoryBreakdown
} from "@/lib/financial";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

import { TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const CHART_COLORS = [
  "#22c55e", "#3b82f6", "#a855f7",
  "#f97316", "#eab308", "#ec4899"
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type TabType = "monthly" | "categories";

export default function Analytics() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabType>("monthly");
  const [txns, setTxns] = useState<any[]>([]);

  // 🔥 FIRESTORE REAL-TIME DATA
  useEffect(() => {
    if (!user?.uid) {
      setTxns([]);
      return;
    }

    const q = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        }));

        setTxns(data);
      },
      (error) => {
        console.error("Analytics transactions listener error:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

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

      {/* STATS */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-3 text-center">
          <TrendingUp className="mx-auto text-green-400" />
          <p className="font-semibold">{formatCurrency(totalIncome)}</p>
        </div>

        <div className="glass-card p-3 text-center">
          <TrendingDown className="mx-auto text-red-400" />
          <p className="font-semibold">{formatCurrency(totalExpenses)}</p>
        </div>

        <div className="glass-card p-3 text-center">
          <BarChart2 className="mx-auto text-blue-400" />
          <p className="font-semibold">{savingsRate.toFixed(0)}%</p>
        </div>
      </div>

      {/* TAB SWITCH */}
      <div className="flex bg-muted rounded-xl p-1">
        <button
          onClick={() => setTab("monthly")}
          className={`flex-1 py-2 rounded-lg ${
            tab === "monthly" ? "bg-card font-semibold" : ""
          }`}
        >
          Monthly
        </button>

        <button
          onClick={() => setTab("categories")}
          className={`flex-1 py-2 rounded-lg ${
            tab === "categories" ? "bg-card font-semibold" : ""
          }`}
        >
          Categories
        </button>
      </div>

      {/* CHARTS */}
      {tab === "monthly" ? (

        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="income" fill="#22c55e" />
            <Bar dataKey="expense" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>

      ) : (

        <div className="space-y-4">

          {/* PIE CHART */}
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>

          {/* CATEGORY LIST */}
          {categoryData.map((cat, i) => (
            <div key={cat.name}>
              <div className="flex justify-between text-sm mb-1">
                <span>{cat.name}</span>
                <span>
                  {formatCurrency(cat.value)} ({cat.percent}%)
                </span>
              </div>

              <div className="h-2 bg-muted rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${cat.percent}%`,
                    background: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}

        </div>
      )}

    </div>
  );
}