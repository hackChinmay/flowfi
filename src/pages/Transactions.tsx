import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/contexts/TransactionContext";
import type { Transaction } from "@/lib/storage";
import { formatCurrency, CATEGORY_CSS } from "@/lib/storage";
import {
  calculateBalance,
  calculateTotalIncome,
  calculateTotalExpenses,
  roundCurrency
} from "@/lib/financial";
import { useMemo, useState, useEffect } from "react";
import { Search, Trash2, Calendar, Download, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/ThemeToggle";

export default function Transactions() {
  const { user } = useAuth();
  const { transactions: txns, updateTransaction, deleteTransaction } = useTransactions();
  const { toast } = useToast();

  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState("");
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset pagination when search or filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, search]);

  // Editing state
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("Food");
  const [editType, setEditType] = useState<"income" | "expense">("expense");
  const [editDescription, setEditDescription] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // ✅ FILTER + PAGINATE + GROUP (OPTIMIZED)
  const { filteredTxns, pagedTxns, grouped } = useMemo(() => {
    let all = [...txns];

    if (filter !== "all") {
      all = all.filter((t) => t.type === filter);
    }

    if (search) {
      const q = search.toLowerCase();
      all = all.filter(
        (t) =>
          t.category.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }

    const paged = all.slice(0, visibleCount);
    const groupedMap: Record<string, Transaction[]> = {};

    paged.forEach((t) => {
      const d = new Date(t.date);
      const key = isNaN(d.getTime())
        ? "Other"
        : d.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });

      if (!groupedMap[key]) groupedMap[key] = [];
      groupedMap[key].push(t);
    });

    return { filteredTxns: all, pagedTxns: paged, grouped: groupedMap };
  }, [txns, filter, search, visibleCount]);

  // ✅ DELETE FROM FIRESTORE
  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      toast({ title: "Deleted", description: "Transaction removed" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete transaction", variant: "destructive" });
    }
  };

  // ✅ EDIT TRANSACTION IN FIRESTORE
  const handleStartEdit = (txn: Transaction) => {
    setEditingTxn(txn);
    setEditAmount(String(txn.amount || ""));
    setEditCategory(txn.category || "Food");
    setEditType((txn.type as "income" | "expense") || "expense");
    setEditDescription(txn.description || "");
  };

  const handleSaveEdit = async () => {
    if (!editingTxn) return;
    const safeAmount = roundCurrency(editAmount);
    if (isNaN(safeAmount) || safeAmount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid positive amount", variant: "destructive" });
      return;
    }
    if (safeAmount > 1000000000) {
      toast({ title: "Amount Too High", description: "Amount cannot exceed ₹100 Crore", variant: "destructive" });
      return;
    }

    try {
      setEditLoading(true);
      await updateTransaction(editingTxn.id, {
        amount: safeAmount,
        type: editType,
        category: editCategory,
        description: editDescription.trim(),
      });
      setEditingTxn(null);
      toast({ title: "Updated 🎉", description: "Transaction updated successfully" });
    } catch (err) {
      console.error("Failed to update transaction:", err);
      toast({ title: "Error", description: "Failed to update transaction", variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  };

  // ✅ EXPORT CSV
  const handleExportCSV = () => {
    if (filteredTxns.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No transactions match your current filter.",
      });
      return;
    }

    const header = ["Date", "Type", "Category", "Description", "Amount (₹)"];

    const rows = filteredTxns.map((t) => {
      const d = new Date(t.date);
      const dateText = isNaN(d.getTime()) ? t.date : d.toLocaleDateString("en-IN");
      return [
        dateText,
        t.type,
        t.category,
        t.description || "",
        t.amount,
      ];
    });

    const csv = [header, ...rows]
      .map((r) => r.map(String).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "flowfi-transactions.csv";
    a.click();

    URL.revokeObjectURL(url);

    toast({
      title: "Exported!",
      description: `${filteredTxns.length} transactions saved as CSV`,
    });
  };

  const categoryEmojis: Record<string, string> = {
    Food: "🍕",
    Transport: "🚗",
    Shopping: "🛍️",
    Entertainment: "🎬",
    Bills: "📄",
    Health: "💊",
    Education: "📚",
    Salary: "💰",
    Freelance: "💻",
    Investment: "📈",
    Gift: "🎁",
    Business: "🏢",
    Other: "📦",
  };

  const totalFiltered = calculateBalance(
    calculateTotalIncome(filteredTxns),
    calculateTotalExpenses(filteredTxns)
  );

  return (
    <div className="pb-24 px-4 pt-6 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Transactions</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {filteredTxns.length} items
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-7 px-2.5 rounded-lg text-xs gap-1.5"
          >
            <Download size={13} /> CSV
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
        <Input
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 rounded-xl pl-9"
        />
      </div>

      <div className="flex bg-muted rounded-xl p-1">
        {(["all", "income", "expense"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              filter === f
                ? f === "income"
                  ? "gradient-primary text-primary-foreground"
                  : f === "expense"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-card shadow text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filteredTxns.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-3xl">🔍</p>
          <p className="text-sm text-muted-foreground">
            No transactions found
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Calendar size={12} className="text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">
                  {date}
                </p>
              </div>

              {items.map((txn) => (
                <div
                  key={txn.id}
                  className="glass-card rounded-xl p-3 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                        CATEGORY_CSS[txn.category] ||
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      {categoryEmojis[txn.category] || "📦"}
                    </div>

                    <div>
                      <p className="text-sm font-medium">{txn.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {txn.description ||
                          (!isNaN(new Date(txn.date).getTime())
                            ? new Date(txn.date).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-bold ${
                        txn.type === "income"
                          ? "text-primary"
                          : "text-destructive"
                      }`}
                    >
                      {txn.type === "income" ? "+" : "-"}
                      {formatCurrency(txn.amount)}
                    </p>

                    <button
                      onClick={() => handleStartEdit(txn)}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center transition-opacity"
                      title="Edit transaction"
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      onClick={() => handleDelete(txn.id)}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center transition-opacity"
                      title="Delete transaction"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {visibleCount < filteredTxns.length && (
            <div className="pt-2 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="w-full rounded-xl py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Load More Transactions ({filteredTxns.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTxn && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-5 max-w-sm w-full space-y-4 border border-border shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Edit Transaction</h3>
              <button
                onClick={() => setEditingTxn(null)}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X size={15} />
              </button>
            </div>

            {/* Type selector */}
            <div className="flex bg-muted rounded-xl p-1">
              {(["expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEditType(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    editType === t
                      ? t === "expense"
                        ? "bg-destructive text-destructive-foreground"
                        : "gradient-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Amount (₹)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="h-10 rounded-xl font-bold"
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full h-10 rounded-xl bg-background border border-border px-3 text-sm text-foreground"
              >
                {Object.keys(categoryEmojis).map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryEmojis[cat]} {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Description (optional)</label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Notes"
                className="h-10 rounded-xl"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditingTxn(null)}
                className="flex-1 rounded-xl h-10"
              >
                Cancel
              </Button>
              <Button
                disabled={editLoading}
                onClick={handleSaveEdit}
                className="flex-1 rounded-xl h-10 gradient-primary text-primary-foreground"
              >
                {editLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}