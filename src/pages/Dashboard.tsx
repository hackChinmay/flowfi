import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, CATEGORY_CSS, CATEGORY_BG, getStreak } from "@/lib/storage";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Smile, Meh, Frown, Flame, Target, ArrowRight, Lightbulb, PiggyBank, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Dashboard() {
  const { user } = useAuth();
  console.log("LOGGED USER:", user?.uid);
  const navigate = useNavigate();

  const [tipPage, setTipPage] = useState(0);
  const [txns, setTxns] = useState<any[]>([]);
  
  useEffect(() => {
  if (!user) return;

  const q = query(
    collection(db, "transactions"),
    where("userId", "==", user.uid)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((doc) => {
      const d = doc.data();

      return {
        id: doc.id,
        ...d,
        date: d.date?.seconds
          ? new Date(d.date.seconds * 1000).toISOString()
          : d.date ?? new Date().toISOString(),
      };
    });

    console.log("FETCHED DATA:", data); // 🔍 debug

    setTxns(data);
  });

  return () => unsubscribe();
}, [user]);


  const { income, expenses, balance, recentTxns, moodData, weeklyData, categoryBreakdown, streak, savingsProgress, savingTips } = useMemo(() => {
    if (!user) return { income: 0, expenses: 0, balance: 0, recentTxns: [], moodData: { emoji: "neutral", label: "Neutral" }, weeklyData: { spent: 0, saved: 0 }, categoryBreakdown: [], streak: 0, savingsProgress: 0, savingTips: [] };
    const inc = txns.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0);

    const exp = txns.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount || 0), 0);
    const bal = inc - exp;

    const ratio = inc > 0 ? exp / inc : exp > 0 ? 1 : 0;

    // ✅ NEW: Spending limit check
    const limitExceeded =Number(user.spendingLimit || 0) > 0 && exp >= Number(user.spendingLimit || 0);

    // ✅ FIXED MOOD LOGIC
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

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const weekTxns = txns.filter(t => t.date >= weekAgo);
    const weekSpent = weekTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const weekEarned = weekTxns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);

    // Category breakdown
    const catMap: Record<string, number> = {};
    txns.filter(t => t.type === "expense").forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount || 0);
    });
    const categoryBreakdown = Object.entries(catMap)
      .map(([name, amount]) => ({ name, amount, percent: exp > 0 ? (amount / exp) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const streak = getStreak(user.uid);
    const savingsProgress = user.savingsGoal && user.savingsGoal > 0 ? Math.min((Math.max(0, bal) / user.savingsGoal) * 100, 100) : 0;

    // Generate personalized money-saving tips
    const topCat = Object.entries(
  txns
    .filter(t => t.type === "expense")
    .reduce((m: Record<string, number>, t) => {
      const category = t.category || "Other";
      const amount = Number(t.amount || 0);

      m[category] = (m[category] || 0) + amount;
      return m;
    }, {})
)
  .sort((a, b) => Number(b[1]) - Number(a[1]))
  [0]?.[0];

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
      income: inc, expenses: exp, balance: bal,
      recentTxns: [...txns].sort((a, b) => {
        const getTime = (d: any) => {
        if (!d) return 0;
        if (d.seconds) return d.seconds * 1000; // Firestore Timestamp
        return new Date(d).getTime(); // string/date fallback
      };

    return getTime(b.date) - getTime(a.date);
  })
  .slice(0, 5),
      moodData, weeklyData: { spent: weekSpent, saved: weekEarned - weekSpent },
      categoryBreakdown, streak, savingsProgress, savingTips,
    };
  }, [user, txns]);

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const limitPercent =Number(user.spendingLimit || 0) > 0 ? Math.min((expenses / Number(user.spendingLimit || 0)) * 100, 100) : 0;
  const nearLimit = limitPercent >= 80;
  const MoodIcon = moodData.emoji === "happy" ? Smile : moodData.emoji === "neutral" ? Meh : Frown;

  return (
    <div className="pb-24 px-4 pt-6 max-w-md mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <p className="text-sm text-muted-foreground">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},</p>
          <h1 className="text-2xl font-bold">{user?.fullName?.split(" ")[0] || "User"} 👋</h1>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/15 text-warning">
              <Flame size={16} />
              <span className="text-sm font-bold">{streak}d</span>
            </div>
          )}
          <ThemeToggle />
        </div>
      </div>

      {/* Balance Card */}
      <div className="relative gradient-primary rounded-2xl p-5 text-primary-foreground shadow-xl animate-fade-in-up stagger-1 overflow-hidden">
        {/* Texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
        />
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-sm" />
        <div className="absolute -bottom-6 -left-4 w-24 h-24 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-sm opacity-80">Total Balance</p>
          <p className="text-3xl font-bold mt-1 animate-count-up">{formatCurrency(balance)}</p>
          <div className="flex gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-xs opacity-70">Income</p>
                <p className="text-sm font-semibold">{formatCurrency(income)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <TrendingDown size={16} />
              </div>
              <div>
                <p className="text-xs opacity-70">Expenses</p>
                <p className="text-sm font-semibold">{formatCurrency(expenses)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2 animate-fade-in-up stagger-2">
        {[
          { label: "Add Income", emoji: "💰", gradient: "gradient-primary", action: () => navigate("/add") },
          { label: "Add Expense", emoji: "💸", gradient: "gradient-warm", action: () => navigate("/add") },
          { label: "Analytics", emoji: "📊", gradient: "gradient-cool", action: () => navigate("/analytics") },
          { label: "Goals", emoji: "🎯", gradient: "gradient-accent", action: () => navigate("/profile") },
        ].map(item => (
          <button key={item.label} onClick={item.action} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all hover:scale-[1.03] active:scale-95">
            <div className={`w-10 h-10 rounded-xl ${item.gradient} flex items-center justify-center text-lg shadow-sm`}>
              {item.emoji}
            </div>
            <span className="text-[10px] font-medium text-muted-foreground leading-tight text-center">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Money Mood + Spending Limit Row */}
      <div className="grid grid-cols-2 gap-3 animate-fade-in-up stagger-3">
        <div className={`glass-card rounded-2xl p-4 flex flex-col gap-2 ${moodData.emoji === "happy" ? "border-primary/30" : moodData.emoji === "stressed" ? "border-destructive/30" : "border-warning/30"}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${moodData.emoji === "happy" ? "bg-primary/15 text-primary" : moodData.emoji === "neutral" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}>
            <MoodIcon size={22} />
          </div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Money Mood</p>
          <p className="text-xs font-semibold leading-tight">{moodData.label}</p>
        </div>

        <div className={`glass-card rounded-2xl p-4 flex flex-col gap-2 ${nearLimit ? "border-destructive/30" : ""}`}>
          <div className="flex items-center justify-between">
            <Wallet size={18} className="text-muted-foreground" />
            {nearLimit && <AlertTriangle size={14} className="text-warning animate-pulse" />}
          </div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Limit</p>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${nearLimit ? "bg-destructive" : "bg-primary"}`} style={{ width: `${limitPercent}%` }} />
          </div>
          <p className="text-xs font-semibold">{Math.round(limitPercent)}% used</p>
        </div>
      </div>

      {/* Savings Goal */}
      {user.savingsGoal && user.savingsGoal > 0 && (
        <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-3 border-accent/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center">
                <Target size={16} className="text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Savings Goal</p>
                <p className="text-sm font-semibold">{user.savingsGoalName || "My Goal"}</p>
              </div>
            </div>
            <span className="text-sm font-bold text-accent">{Math.round(savingsProgress)}%</span>
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full gradient-accent transition-all" style={{ width: `${savingsProgress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(Math.max(0, balance))} of {formatCurrency(user.savingsGoal)} saved
          </p>
        </div>
      )}

      {/* Weekly Summary */}
      <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-4">
        <p className="text-sm font-semibold flex items-center gap-2">📊 Weekly Summary</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 text-center gradient-warm/10 bg-cat-food/10">
            <p className="text-xs text-muted-foreground">Spent</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(weeklyData.spent)}</p>
          </div>
          <div className="rounded-xl p-3 text-center bg-primary/10">
            <p className="text-xs text-muted-foreground">Saved</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(Math.max(0, weeklyData.saved))}</p>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">🏷️ Top Categories</p>
            <button onClick={() => navigate("/transactions")} className="text-xs text-primary font-medium flex items-center gap-0.5">
              See all <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2.5">
            {categoryBreakdown.map(cat => (
              <div key={cat.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{cat.name}</span>
                  <span className="text-muted-foreground">{formatCurrency(cat.amount)} ({Math.round(cat.percent)}%)</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${CATEGORY_BG[cat.name] || "bg-cat-other"} transition-all`} style={{ width: `${cat.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Financial Insights */}
      {recentTxns.length > 0 && (
        <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-4 border-secondary/20">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb size={15} className="text-secondary" /> Smart Insights
          </p>
          <div className="space-y-2">
            {nearLimit && (
              <div className="flex items-start gap-2.5 text-xs bg-destructive/8 rounded-xl p-3">
                <AlertTriangle size={14} className="text-destructive mt-0.5 shrink-0" />
                <p>You've used <strong>{Math.round(limitPercent)}%</strong> of your monthly spending limit. Consider cutting back on discretionary purchases.</p>
              </div>
            )}
            {categoryBreakdown[0] && (
              <div className="flex items-start gap-2.5 text-xs bg-muted rounded-xl p-3">
                <span className="text-base shrink-0">💡</span>
                <p>Your top spending category is <strong>{categoryBreakdown[0].name}</strong> at {Math.round(categoryBreakdown[0].percent)}% of total expenses.</p>
              </div>
            )}
            {income > 0 && expenses / income < 0.5 ? (
              <div className="flex items-start gap-2.5 text-xs bg-primary/8 rounded-xl p-3">
                <span className="text-base shrink-0">🎉</span>
                <p>Great job! You're saving <strong>{Math.round(100 - (expenses / income) * 100)}%</strong> of your income. Keep it up!</p>
              </div>
            ) : income > 0 && (
              <div className="flex items-start gap-2.5 text-xs bg-warning/8 rounded-xl p-3">
                <span className="text-base shrink-0">📈</span>
                <p>You're spending <strong>{Math.round((expenses / income) * 100)}%</strong> of your income. Aim to save at least 20%.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* How to Save Money Tips */}
      {savingTips.length > 0 && (
        <div className="glass-card rounded-2xl p-4 space-y-3 animate-fade-in-up stagger-4 border-emerald-500/20">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2">
              <PiggyBank size={16} className="text-primary" /> How to Save Money
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTipPage(p => Math.max(0, p - 1))}
                disabled={tipPage === 0}
                className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-muted-foreground">{tipPage + 1}/{savingTips.length}</span>
              <button
                onClick={() => setTipPage(p => Math.min(savingTips.length - 1, p + 1))}
                disabled={tipPage === savingTips.length - 1}
                className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Current tip */}
          {savingTips[tipPage] && (
            <div className={`rounded-xl p-3.5 flex items-start gap-3 ${savingTips[tipPage].color}`}>
              <span className="text-2xl shrink-0">{savingTips[tipPage].icon}</span>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">{savingTips[tipPage].title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{savingTips[tipPage].desc}</p>
              </div>
            </div>
          )}

          {/* Dot indicator */}
          <div className="flex justify-center gap-1.5">
            {savingTips.map((_, i) => (
              <button
                key={i}
                onClick={() => setTipPage(i)}
                className={`rounded-full transition-all ${i === tipPage ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30"}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="space-y-3 animate-fade-in-up stagger-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent Transactions</h2>
          {recentTxns.length > 0 && (
            <button onClick={() => navigate("/transactions")} className="text-xs text-primary font-medium flex items-center gap-0.5">
              View all <ArrowRight size={12} />
            </button>
          )}
        </div>
        {recentTxns.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center space-y-2">
            <p className="text-3xl">💸</p>
            <p className="text-sm text-muted-foreground">No transactions yet</p>
            <button onClick={() => navigate("/add")} className="text-sm text-primary font-semibold">Add your first one →</button>
          </div>
        ) : (
          recentTxns.map(txn => (
            <div key={txn.id} className="glass-card rounded-xl p-3 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${CATEGORY_CSS[txn.category] || "bg-muted text-muted-foreground"}`}>
                  {getCategoryEmoji(txn.category)}
                </div>
                <div>
                  <p className="text-sm font-medium">{txn.category}</p>
                  <p className="text-xs text-muted-foreground">{txn.description || new Date(txn.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                </div>
              </div>
              <p className={`text-sm font-bold ${txn.type === "income" ? "text-primary" : "text-destructive"}`}>
                {txn.type === "income" ? "+" : "-"}{formatCurrency(txn.amount)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getCategoryEmoji(cat: string): string {
  const map: Record<string, string> = { Food: "🍕", Transport: "🚗", Shopping: "🛍️", Entertainment: "🎬", Bills: "📄", Health: "💊", Education: "📚", Salary: "💰", Freelance: "💻", Investment: "📈", Gift: "🎁" };
  return map[cat] || "📦";
}
