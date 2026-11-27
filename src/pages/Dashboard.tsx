import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/contexts/TransactionContext";
import { CATEGORY_CSS, CATEGORY_BG, getStreak, calculateStreakFromTransactions } from "@/lib/storage";
import {
  formatCurrency,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateBalance,
  calculateSavingsProgress,
  calculateCategoryBreakdown,
  calculateCurrentMonthSpending,
  calculateBudgetUsagePercent,
  parseTransactionDate,
  calculateExpenseRatio
} from "@/lib/financial";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Smile, Meh, Frown, Flame, Target, ArrowRight, Lightbulb, PiggyBank, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

export default function Dashboard() {
  const { user } = useAuth();
  const { transactions: txns, error: txnsError, refresh } = useTransactions();
  const navigate = useNavigate();

  const [tipPage, setTipPage] = useState(0);


  const { income, expenses, balance, currentMonthExpenses, spendingLimit, recentTxns, moodData, weeklyData, categoryBreakdown, streak, savingsProgress, savingTips } = useMemo(() => {
    if (!user) return { income: 0, expenses: 0, balance: 0, currentMonthExpenses: 0, spendingLimit: 0, recentTxns: [], moodData: { emoji: "neutral", label: "Neutral" }, weeklyData: { spent: 0, saved: 0 }, categoryBreakdown: [], streak: 0, savingsProgress: 0, savingTips: [] };

    // Standardized integer-paise calculations
    const inc = calculateTotalIncome(txns);
    const exp = calculateTotalExpenses(txns);
    const bal = calculateBalance(inc, exp);
    const ratio = calculateExpenseRatio(inc, exp);

    // Current month actual spending evaluated against monthly spending limit
    const currentMonthExp = calculateCurrentMonthSpending(txns);
    const limitAmount = Number(user.spendingLimit || 0);
    const limitExceeded = limitAmount > 0 && currentMonthExp >= limitAmount;

    // Fixed mood logic
    let moodData;

    if (limitExceeded && ratio < 0.5) {
      moodData = {
        emoji: "neutral",
        label: "Good savings, but overspending ⚠️"
      };
    }
    else if (limitExceeded) {
      moodData = {
        emoji: "stressed",
        label: "Overspending alert ⚠️"
      };
    }
    else if (ratio < 0.4) {
      moodData = {
        emoji: "happy",
        label: "You're saving well! 🎉"
      };
    }
    else if (ratio < 0.75) {
      moodData = {
        emoji: "neutral",
        label: "Spending is balanced"
      };
    }
    else {
      moodData = {
        emoji: "stressed",
        label: "Watch your spending!"
      };
    }

    const weekAgoMs = Date.now() - 7 * 86400000;
    const weekTxns = txns.filter(t => parseTransactionDate(t).getTime() >= weekAgoMs);
    const weekSpent = calculateTotalExpenses(weekTxns);
    const weekEarned = calculateTotalIncome(weekTxns);

    // Category breakdown
    const categoryBreakdown = calculateCategoryBreakdown(txns, exp).slice(0, 5);

    const streak = Math.max(calculateStreakFromTransactions(txns), getStreak(user.uid));
    const savingsGoal = Number(user.savingsGoal || 0);
    const savingsProgress = calculateSavingsProgress(Math.max(0, bal), savingsGoal);

    // Generate personalized money-saving tips
    const topCat = categoryBreakdown[0]?.name;

    const savingTips: { icon: string; title: string; desc: string; color: string }[] = [];

    if (!inc && !exp) {
      savingTips.push({ icon: "📝", title: "Start Tracking", desc: "Record your first income and expense to get personalized saving tips!", color: "bg-primary/10" });
    }
    if (ratio > 0.8) {
      savingTips.push({ icon: "🚨", title: "High Expenses Alert", desc: `You're spending ${Math.round(ratio * 100)}% of your income. Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings.`, color: "bg-destructive/8" });
    } else if (ratio > 0.5) {
      savingTips.push({ icon: "⚠️", title: "Watch Your Spending", desc: `You're spending ${Math.round(ratio * 100)}% of income. Aim to keep expenses under 70% so you save at least 30%.`, color: "bg-warning/8" });
    } else if (inc > 0) {
      savingTips.push({ icon: "🏆", title: "Great Savings Rate!", desc: `You're saving ${Math.round((1 - ratio) * 100)}% of your income. Consider investing the surplus to grow your wealth faster.`, color: "bg-primary/8" });
    }
    if (topCat === "Food" || topCat === "Dining") {
      savingTips.push({ icon: "🍱", title: "Meal Prep Saves Money", desc: "Food is your biggest expense. Cooking at home and meal prepping can cut food costs by up to 60%.", color: "bg-yellow-500/8" });
    }
    if (topCat === "Shopping") {
      savingTips.push({ icon: "🛒", title: "Shop Smarter", desc: "Try a 24-hour rule: wait a day before non-essential purchases. This reduces impulse buying by ~30%.", color: "bg-purple-500/8" });
    }
    if (topCat === "Entertainment") {
      savingTips.push({ icon: "🎭", title: "Free Fun Ideas", desc: "Look for free or low-cost alternatives: parks, libraries, free events. You can still enjoy life while saving.", color: "bg-blue-500/8" });
    }
    if (topCat === "Transport") {
      savingTips.push({ icon: "🚌", title: "Cut Transport Costs", desc: "Carpool, use public transit or cycle for short trips. Transport costs can be reduced by 40% with small habit changes.", color: "bg-green-500/8" });
    }
    if (!user.savingsGoal) {
      savingTips.push({ icon: "🎯", title: "Set a Savings Goal", desc: "People with defined savings goals save 2× more on average. Set one in your Profile to stay motivated!", color: "bg-accent/10" });
    }
    // Always-on universal tips (rotate by day)
    const universalTips = [
      { icon: "💳", title: "Avoid Credit Card Debt", desc: "Pay your full balance every month. Credit card interest (24–40% p.a.) can silently drain your savings.", color: "bg-rose-500/8" },
      { icon: "📱", title: "Audit Subscriptions", desc: "Review all monthly subscriptions. Cancel ones unused for 30+ days — the average person wastes ₹600/month on forgotten subs.", color: "bg-indigo-500/8" },
      { icon: "💧", title: "Save Before You Spend", desc: "Transfer a fixed amount to savings the moment you receive income. 'Pay yourself first' is the #1 wealth habit.", color: "bg-teal-500/8" },
      { icon: "📊", title: "Review Weekly", desc: "Spending 5 minutes reviewing your transactions each week leads to 15% less overspending on average.", color: "bg-orange-500/8" },
    ];
    savingTips.push(universalTips[new Date().getDay() % universalTips.length]);

    return {
      income: inc,
      expenses: exp,
      balance: bal,
      currentMonthExpenses: currentMonthExp,
      spendingLimit: limitAmount,
      recentTxns: [...txns].sort((a, b) => {
        const timeA = parseTransactionDate(a).getTime();
        const timeB = parseTransactionDate(b).getTime();
        return timeB - timeA;
      }).slice(0, 5),
      moodData,
      weeklyData: { spent: weekSpent, saved: calculateBalance(weekEarned, weekSpent) },
      categoryBreakdown,
      streak,
      savingsProgress,
      savingTips,
    };
  }, [user, txns]);

  if (!user) {
    return (
      <div role="status" aria-label="Loading dashboard" className="pb-24 px-4 pt-6 max-w-md mx-auto space-y-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-28 bg-muted rounded-md" />
            <div className="h-7 w-36 bg-muted rounded-md" />
          </div>
          <div className="w-9 h-9 rounded-xl bg-muted" />
        </div>
        <div className="h-44 rounded-2xl bg-muted" />
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-2xl bg-muted" />
          <div className="h-24 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  const limitPercent = spendingLimit > 0 ? Math.min(calculateBudgetUsagePercent(spendingLimit, currentMonthExpenses), 100) : 0;
  const nearLimit = limitPercent >= 80;
  const MoodIcon = moodData.emoji === "happy" ? Smile : moodData.emoji === "neutral" ? Meh : Frown;

  return (
    <main className="pb-24 px-4 pt-6 max-w-md mx-auto space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between animate-fade-in-up">
        <div>
          <p className="text-sm text-muted-foreground">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},</p>
          <h1 className="text-2xl font-bold">{user?.fullName?.split(" ")[0] || "User"} 👋</h1>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/15 text-warning" aria-label={`Current streak: ${streak} days`}>
              <Flame size={16} aria-hidden="true" />
              <span className="text-sm font-bold">{streak}d</span>
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Database Error Banner with Retry */}
      {txnsError && (
        <div role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl p-4 flex items-center justify-between text-xs font-semibold gap-3 animate-fade-in-up">
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

      {/* Balance Card */}
      <section aria-labelledby="total-balance-heading" className="relative gradient-primary rounded-2xl p-5 text-primary-foreground shadow-xl animate-fade-in-up stagger-1 overflow-hidden">
        {/* Texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
        />
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-sm" />
        <div className="absolute -bottom-6 -left-4 w-24 h-24 rounded-full bg-white/5" />
        <div className="relative">
          <p id="total-balance-heading" className="text-sm opacity-80 font-medium">Total Balance</p>
          <p className="text-3xl font-bold mt-1 animate-count-up">{formatCurrency(balance)}</p>
          <div className="flex gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center" aria-hidden="true">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-xs opacity-70">Income</p>
                <p className="text-sm font-semibold">{formatCurrency(income)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center" aria-hidden="true">
                <TrendingDown size={16} />
              </div>
              <div>
                <p className="text-xs opacity-70">Expenses</p>
                <p className="text-sm font-semibold">{formatCurrency(expenses)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section aria-label="Quick Actions" className="grid grid-cols-4 gap-2 animate-fade-in-up stagger-2">
        {[
          { label: "Add Income", emoji: "💰", gradient: "gradient-primary", action: () => navigate("/add") },
          { label: "Add Expense", emoji: "💸", gradient: "gradient-warm", action: () => navigate("/add") },
          { label: "Analytics", emoji: "📊", gradient: "gradient-cool", action: () => navigate("/analytics") },
          { label: "Goals", emoji: "🎯", gradient: "gradient-accent", action: () => navigate("/profile") },
        ].map(item => (
          <button
            key={item.label}
            onClick={item.action}
            aria-label={item.label}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <div className={`w-10 h-10 rounded-xl ${item.gradient} flex items-center justify-center text-lg shadow-sm`} aria-hidden="true">
              {item.emoji}
            </div>
            <span className="text-[10px] font-medium text-muted-foreground leading-tight text-center">{item.label}</span>
          </button>
        ))}
      </section>

      {/* Money Mood + Spending Limit Row */}
      <div className="grid grid-cols-2 gap-3 animate-fade-in-up stagger-3">
        <div className={`glass-card rounded-2xl p-4 flex flex-col gap-2 ${moodData.emoji === "happy" ? "border-primary/30" : moodData.emoji === "stressed" ? "border-destructive/30" : "border-warning/30"}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${moodData.emoji === "happy" ? "bg-primary/15 text-primary" : moodData.emoji === "neutral" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`} aria-hidden="true">
            <MoodIcon size={22} />
          </div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Money Mood</p>
          <p className="text-xs font-semibold leading-tight">{moodData.label}</p>
        </div>

        <div className={`glass-card rounded-2xl p-4 flex flex-col gap-2 ${nearLimit ? "border-destructive/30" : ""}`}>
          <div className="flex items-center justify-between">
            <Wallet size={18} className="text-muted-foreground" aria-hidden="true" />
            {nearLimit && <AlertTriangle size={14} className="text-warning animate-pulse" aria-label="Warning: Near spending limit" />}
          </div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Limit</p>
          <div
            className="w-full h-2 bg-muted rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(limitPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Monthly spending limit usage percentage"
          >
            <div className={`h-full rounded-full transition-all ${nearLimit ? "bg-destructive" : "bg-primary"}`} style={{ width: `${limitPercent}%` }} />
          </div>
          <p className="text-xs font-semibold">{Math.round(limitPercent)}% used</p>
        </div>
      </div>

      {/* Savings Goal */}
      {user.savingsGoal && user.savingsGoal > 0 && (
        <section aria-labelledby="savings-goal-heading" className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-3 border-accent/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center" aria-hidden="true">
                <Target size={16} className="text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Savings Goal</p>
                <p id="savings-goal-heading" className="text-sm font-semibold">{user.savingsGoalName || "My Goal"}</p>
              </div>
            </div>
            <span className="text-sm font-bold text-accent">{Math.round(savingsProgress)}%</span>
          </div>
          <div
            className="w-full h-2.5 bg-muted rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(savingsProgress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${user.savingsGoalName || "Savings goal"} progress percentage`}
          >
            <div className="h-full rounded-full gradient-accent transition-all" style={{ width: `${savingsProgress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(Math.max(0, balance))} of {formatCurrency(user.savingsGoal)} saved
          </p>
        </section>
      )}

      {/* Weekly Summary */}
      <section aria-labelledby="weekly-summary-heading" className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-4">
        <p id="weekly-summary-heading" className="text-sm font-semibold flex items-center gap-2">📊 Weekly Summary</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 text-center gradient-warm/10 bg-cat-food/10">
            <p className="text-xs text-muted-foreground">Spent</p>
            <p className="text-lg font-bold text-destructive">
              <span className="sr-only">Spent: </span>
              {formatCurrency(weeklyData.spent)}
            </p>
          </div>
          <div className="rounded-xl p-3 text-center bg-primary/10">
            <p className="text-xs text-muted-foreground">Saved</p>
            <p className="text-lg font-bold text-primary">
              <span className="sr-only">Saved: </span>
              {formatCurrency(Math.max(0, weeklyData.saved))}
            </p>
          </div>
        </div>
      </section>

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <section aria-labelledby="category-breakdown-heading" className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-4">
          <div className="flex items-center justify-between">
            <p id="category-breakdown-heading" className="text-sm font-semibold">🏷️ Top Categories</p>
            <button
              onClick={() => navigate("/transactions")}
              aria-label="See all category transactions"
              className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              See all <ArrowRight size={12} aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-2.5">
            {categoryBreakdown.map(cat => (
              <div key={cat.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{cat.name}</span>
                  <span className="text-muted-foreground">{formatCurrency(cat.amount)} ({Math.round(cat.percent)}%)</span>
                </div>
                <div
                  className="w-full h-2 bg-muted rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(cat.percent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${cat.name} spending percentage`}
                >
                  <div className={`h-full rounded-full ${CATEGORY_BG[cat.name] || "bg-cat-other"} transition-all`} style={{ width: `${cat.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Financial Insights */}
      {recentTxns.length > 0 && (
        <section aria-labelledby="smart-insights-heading" className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-4 border-secondary/20">
          <p id="smart-insights-heading" className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb size={15} className="text-secondary" aria-hidden="true" /> Smart Insights
          </p>
          <div className="space-y-2">
            {nearLimit && (
              <div className="flex items-start gap-2.5 text-xs bg-destructive/8 rounded-xl p-3">
                <AlertTriangle size={14} className="text-destructive mt-0.5 shrink-0" aria-hidden="true" />
                <p>You've used <strong>{Math.round(limitPercent)}%</strong> of your monthly spending limit. Consider cutting back on discretionary purchases.</p>
              </div>
            )}
            {categoryBreakdown[0] && (
              <div className="flex items-start gap-2.5 text-xs bg-muted rounded-xl p-3">
                <span className="text-base shrink-0" aria-hidden="true">💡</span>
                <p>Your top spending category is <strong>{categoryBreakdown[0].name}</strong> at {Math.round(categoryBreakdown[0].percent)}% of total expenses.</p>
              </div>
            )}
            {income > 0 && expenses / income < 0.5 ? (
              <div className="flex items-start gap-2.5 text-xs bg-primary/8 rounded-xl p-3">
                <span className="text-base shrink-0" aria-hidden="true">🎉</span>
                <p>Great job! You're saving <strong>{Math.round(100 - (expenses / income) * 100)}%</strong> of your income. Keep it up!</p>
              </div>
            ) : income > 0 && (
              <div className="flex items-start gap-2.5 text-xs bg-warning/8 rounded-xl p-3">
                <span className="text-base shrink-0" aria-hidden="true">📈</span>
                <p>You're spending <strong>{Math.round((expenses / income) * 100)}%</strong> of your income. Aim to save at least 20%.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* How to Save Money Tips */}
      {savingTips.length > 0 && (
        <section aria-labelledby="saving-tips-heading" className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-4 border-emerald-500/20">
          <div className="flex items-center justify-between">
            <p id="saving-tips-heading" className="text-sm font-semibold flex items-center gap-2">
              <PiggyBank size={16} className="text-primary" aria-hidden="true" /> How to Save Money
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTipPage(p => Math.max(0, p - 1))}
                disabled={tipPage === 0}
                aria-label="Previous saving tip"
                className="w-7 h-7 min-w-[28px] min-h-[28px] rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronLeft size={14} aria-hidden="true" />
              </button>
              <span className="text-xs text-muted-foreground" aria-live="polite">{tipPage + 1}/{savingTips.length}</span>
              <button
                onClick={() => setTipPage(p => Math.min(savingTips.length - 1, p + 1))}
                disabled={tipPage === savingTips.length - 1}
                aria-label="Next saving tip"
                className="w-7 h-7 min-w-[28px] min-h-[28px] rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Current tip */}
          {savingTips[tipPage] && (
            <div className={`rounded-xl p-3.5 flex items-start gap-3 ${savingTips[tipPage].color}`} tabIndex={0} aria-label={`Tip: ${savingTips[tipPage].title}. ${savingTips[tipPage].desc}`}>
              <span className="text-2xl shrink-0" aria-hidden="true">{savingTips[tipPage].icon}</span>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">{savingTips[tipPage].title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{savingTips[tipPage].desc}</p>
              </div>
            </div>
          )}

          {/* Dot indicator */}
          <div className="flex justify-center gap-1.5" role="tablist" aria-label="Tip pagination dots">
            {savingTips.map((_, i) => (
              <button
                key={i}
                onClick={() => setTipPage(i)}
                role="tab"
                aria-selected={i === tipPage}
                aria-label={`Go to saving tip ${i + 1}`}
                className={`rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${i === tipPage ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30"}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent Transactions */}
      <section aria-labelledby="recent-txns-heading" className="space-y-3 animate-fade-in-up stagger-5">
        <div className="flex items-center justify-between">
          <h2 id="recent-txns-heading" className="text-sm font-semibold">Recent Transactions</h2>
          {recentTxns.length > 0 && (
            <button
              onClick={() => navigate("/transactions")}
              aria-label="View all transactions"
              className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              View all <ArrowRight size={12} aria-hidden="true" />
            </button>
          )}
        </div>
        {recentTxns.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center space-y-2">
            <p className="text-3xl" aria-hidden="true">💸</p>
            <p className="text-sm text-muted-foreground">No transactions yet</p>
            <button
              onClick={() => navigate("/add")}
              className="text-sm text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              Add your first one →
            </button>
          </div>
        ) : (
          recentTxns.map(txn => (
            <div key={txn.id} className="glass-card rounded-xl p-3 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${CATEGORY_CSS[txn.category] || "bg-muted text-muted-foreground"}`}
                  role="img"
                  aria-label={txn.category}
                >
                  {getCategoryEmoji(txn.category)}
                </div>
                <div>
                  <p className="text-sm font-medium">{txn.category}</p>
                  <p className="text-xs text-muted-foreground">{txn.description || new Date(txn.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                </div>
              </div>
              <p className={`text-sm font-bold ${txn.type === "income" ? "text-primary" : "text-destructive"}`}>
                <span className="sr-only">{txn.type === "income" ? "Income: +" : "Expense: -"}</span>
                <span aria-hidden="true">{txn.type === "income" ? "+" : "-"}</span>
                {formatCurrency(txn.amount)}
              </p>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

function getCategoryEmoji(cat: string): string {
  const map: Record<string, string> = { Food: "🍕", Transport: "🚗", Shopping: "🛍️", Entertainment: "🎬", Bills: "📄", Health: "💊", Education: "📚", Salary: "💰", Freelance: "💻", Investment: "📈", Gift: "🎁" };
  return map[cat] || "📦";
}
