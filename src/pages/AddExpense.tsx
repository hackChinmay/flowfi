import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_CSS } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

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

  // 🔥 SAVE TO FIREBASE
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Error",
        description: "User not logged in",
        variant: "destructive",
      });
      return;
    }

    if (!amount || Number(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        type,
        amount: Number(amount),
        category,
        description: description || "",
        createdAt: serverTimestamp(),
      });

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
        title: "Error",
        description: "Failed to save transaction",
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
      <div className="flex bg-muted rounded-xl p-1">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setType(t);
              setCategory(t === "expense" ? "Food" : "Salary");
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              type === t
                ? t === "expense"
                  ? "gradient-warm text-primary-foreground"
                  : "gradient-primary text-primary-foreground"
                : "text-muted-foreground"
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
          <p className="text-xs text-muted-foreground mb-2">Amount (₹)</p>

          <div className="flex items-center justify-center gap-1">
            <span className="text-3xl font-bold text-muted-foreground">₹</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="1"
              className="text-5xl font-bold bg-transparent border-none outline-none text-center w-44 text-foreground"
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Category</p>

          <div className="grid grid-cols-4 gap-2">
            {categories.map((c) => {
              const isActive = category === c.name;

              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setCategory(c.name)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs transition-all ${
                    isActive
                      ? `${CATEGORY_CSS[c.name] || "bg-primary/15 text-primary"} ring-2 ring-current/30 shadow-md font-bold`
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="text-xl">{c.icon}</span>
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <Input
          placeholder="Add a note (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-12 rounded-xl"
        />

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading}
          className={`w-full h-12 rounded-xl font-semibold text-base transition-all ${
            type === "expense" ? "gradient-warm" : "gradient-primary"
          } text-primary-foreground`}
        >
          {loading ? (
            "Saving..."
          ) : added ? (
            <>
              <Sparkles className="mr-2 animate-spin" size={18} />
              Added!
            </>
          ) : (
            <>
              <Check className="mr-2" size={18} />
              Add {type === "income" ? "Income" : "Expense"}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}