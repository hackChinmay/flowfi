import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { addTransaction, EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_CSS } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { serverTimestamp } from "firebase/firestore";
import { updateStreak } from "@/lib/storage";
import { roundCurrency } from "@/lib/financial";
import { getErrorMessage } from "@/lib/errorHandler";

export default function AddExpense() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  const categories =
    type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  // 🔥 SAVE TO FIREBASE WITH FINANCIAL INTEGRITY & DUPLICATE PROTECTION
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate concurrent submissions
    if (loading) return;

    if (!user) {
      toast({
        title: "Error",
        description: "User not logged in",
        variant: "destructive",
      });
      return;
    }

    const parsedAmount = roundCurrency(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive amount",
        variant: "destructive",
      });
      return;
    }

    if (parsedAmount > 1000000000) {
      toast({
        title: "Amount Too High",
        description: "Amount cannot exceed ₹100 Crore",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      await addTransaction({
        type,
        amount: parsedAmount,
        category,
        description: (description || "").trim(),
        createdAt: serverTimestamp(),
        date: new Date().toISOString(),
      });

      updateStreak(user.uid);

      // UI feedback
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);

      toast({
        title: "Success 🎉",
        description: `${type === "income" ? "Income" : "Expense"} added successfully`,
      });

      // Reset form
      setAmount("");
      setDescription("");
      setCategory(type === "expense" ? "Food" : "Salary");

    } catch (error) {
      console.error("Error adding transaction:", error);
      toast({
        title: "Transaction Failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24 px-4 pt-6 max-w-md mx-auto space-y-5">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Add Transaction</h1>
        <ThemeToggle />
      </div>

      {/* Type Toggle */}
      <div className="flex bg-muted rounded-xl p-1" role="tablist" aria-label="Transaction Type">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={type === t}
            onClick={() => {
              setType(t);
              setCategory(t === "expense" ? "Food" : "Salary");
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              type === t
                ? t === "expense"
                  ? "gradient-warm text-primary-foreground shadow"
                  : "gradient-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "expense" ? "💸 Expense" : "💰 Income"}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Amount */}
        <div className={`glass-card rounded-2xl p-6 text-center ${added ? "animate-pulse-glow" : ""}`}>
          <label htmlFor="amount-input" className="text-xs font-medium text-muted-foreground mb-2 block">Amount (₹)</label>

          <div className="flex items-center justify-center gap-1">
            <span className="text-3xl font-bold text-muted-foreground" aria-hidden="true">₹</span>
            <input
              id="amount-input"
              aria-label="Amount in rupees"
              type="number"
              step="0.01"
              min="0.01"
              max="1000000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="text-5xl font-bold bg-transparent border-none outline-none text-center w-48 text-foreground focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label id="category-label" className="text-sm font-medium">Category</label>

          <div role="radiogroup" aria-labelledby="category-label" className="grid grid-cols-4 gap-2">
            {categories.map((c) => {
              const isActive = category === c.name;

              return (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={c.name}
                  onClick={() => setCategory(c.name)}
                  className={`flex flex-col items-center justify-center min-h-[52px] gap-1.5 p-3 rounded-xl text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive
                      ? `${CATEGORY_CSS[c.name] || "bg-primary/15 text-primary"} ring-2 ring-current/30 shadow-md font-bold`
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <span className="text-xl" aria-hidden="true">{c.icon}</span>
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label htmlFor="description-input" className="sr-only">Add a note (optional)</label>
          <Input
            id="description-input"
            aria-label="Add a note (optional)"
            placeholder="Add a note (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading}
          className={`w-full h-12 rounded-xl font-semibold text-base transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
            type === "expense" ? "gradient-warm" : "gradient-primary"
          } text-primary-foreground`}
        >
          {loading ? (
            "Saving..."
          ) : added ? (
            <>
              <Sparkles className="mr-2 animate-spin" size={18} aria-hidden="true" />
              Added!
            </>
          ) : (
            <>
              <Check className="mr-2" size={18} aria-hidden="true" />
              Add {type === "income" ? "Income" : "Expense"}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}