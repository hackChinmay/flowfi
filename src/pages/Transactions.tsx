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
import { getErrorMessage } from "@/lib/errorHandler";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Trash2, Calendar, Download, Pencil, Check, X, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/ThemeToggle";

export default function Transactions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { transactions: txns, error: txnsError, refresh, updateTransaction, deleteTransaction } = useTransactions();
  const { toast } = useToast();

  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState("");
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteTxn, setConfirmDeleteTxn] = useState<Transaction | null>(null);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditingTxn(null);
        setConfirmDeleteTxn(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // ✅ DELETE CONFIRMED WITH GUARD & FEEDBACK
  const handleDeleteConfirmed = useCallback(async () => {
    if (!confirmDeleteTxn || deletingId) return;
    try {
      setDeletingId(confirmDeleteTxn.id);
      await deleteTransaction(confirmDeleteTxn.id);
      toast({ title: "Deleted", description: "Transaction removed successfully" });
      setConfirmDeleteTxn(null);
    } catch (err) {
      toast({ title: "Delete Failed", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }, [confirmDeleteTxn, deletingId, deleteTransaction, toast]);

  // ✅ EDIT TRANSACTION IN FIRESTORE WITH RESILIENT ERROR HANDLING
  const handleStartEdit = useCallback((txn: Transaction) => {
    setEditingTxn(txn);
    setEditAmount(String(txn.amount || ""));
    setEditCategory(txn.category || "Food");
    setEditType((txn.type as "income" | "expense") || "expense");
    setEditDescription(txn.description || "");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingTxn || editLoading) return;
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
      toast({ title: "Update Failed", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  }, [editingTxn, editLoading, editAmount, editType, editCategory, editDescription, updateTransaction, toast]);

  // ✅ EXPORT CSV
  const handleExportCSV = useCallback(() => {
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
  }, [filteredTxns, toast]);

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
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full font-medium" aria-live="polite">
            {filteredTxns.length} items
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            aria-label="Export transactions as CSV"
            className="h-7 px-2.5 rounded-lg text-xs gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Download size={13} aria-hidden="true" /> CSV
          </Button>
          <ThemeToggle />
        </div>
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

      {/* Search Bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-muted-foreground pointer-events-none" aria-hidden="true" />
        <Input
          id="search-transactions"
          aria-label="Search transactions by category or description"
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 rounded-xl pl-9 focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-muted rounded-xl p-1" role="tablist" aria-label="Filter transactions by type">
        {(["all", "income", "expense"] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              filter === f
                ? f === "income"
                  ? "gradient-primary text-primary-foreground shadow"
                  : f === "expense"
                  ? "bg-destructive text-destructive-foreground shadow"
                  : "bg-card shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Transaction List or Empty State */}
      {filteredTxns.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center space-y-3">
          <p className="text-3xl" aria-hidden="true">{txns.length === 0 ? "💸" : "🔍"}</p>
          <h2 className="text-sm font-semibold">
            {txns.length === 0 ? "No transactions recorded yet" : "No matching transactions found"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {txns.length === 0
              ? "Start tracking your expenses and income to see your transaction history."
              : "Try adjusting your search terms or filters."}
          </p>
          {txns.length === 0 ? (
            <Button
              onClick={() => navigate("/add")}
              className="rounded-xl gradient-primary text-primary-foreground text-xs mt-2"
            >
              Add First Transaction
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
              className="rounded-xl text-xs mt-2"
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, items]) => (
            <section key={date} aria-label={`Transactions on ${date}`} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Calendar size={12} className="text-muted-foreground" aria-hidden="true" />
                <p className="text-xs font-medium text-muted-foreground">
                  {date}
                </p>
              </div>

              {items.map((txn) => (
                <div
                  key={txn.id}
                  className="glass-card rounded-xl p-3 flex items-center justify-between group hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                        CATEGORY_CSS[txn.category] ||
                        "bg-muted text-muted-foreground"
                      }`}
                      role="img"
                      aria-label={txn.category}
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
                      <span className="sr-only">{txn.type === "income" ? "Income: +" : "Expense: -"}</span>
                      <span aria-hidden="true">{txn.type === "income" ? "+" : "-"}</span>
                      {formatCurrency(txn.amount)}
                    </p>

                    <button
                      onClick={() => handleStartEdit(txn)}
                      aria-label={`Edit ${txn.category} of ${formatCurrency(txn.amount)}`}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>

                    <button
                      onClick={() => setConfirmDeleteTxn(txn)}
                      aria-label={`Delete ${txn.category} of ${formatCurrency(txn.amount)}`}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </section>
          ))}

          {visibleCount < filteredTxns.length && (
            <div className="pt-2 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="w-full rounded-xl py-2 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
              >
                Load More Transactions ({filteredTxns.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteTxn && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          aria-describedby="delete-confirm-desc"
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="glass-card rounded-2xl p-5 max-w-sm w-full space-y-4 border border-destructive/20 shadow-2xl animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center shrink-0" aria-hidden="true">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 id="delete-confirm-title" className="text-base font-bold text-foreground">Delete Transaction?</h3>
                <p id="delete-confirm-desc" className="text-xs text-muted-foreground mt-0.5">
                  Are you sure you want to delete this {confirmDeleteTxn.category} transaction of {formatCurrency(confirmDeleteTxn.amount)}? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDeleteTxn(null)}
                disabled={Boolean(deletingId)}
                className="flex-1 rounded-xl h-10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConfirmed}
                disabled={Boolean(deletingId)}
                className="flex-1 rounded-xl h-10 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
              >
                {deletingId ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTxn && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-transaction-title"
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="glass-card rounded-2xl p-5 max-w-sm w-full space-y-4 border border-border shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between">
              <h3 id="edit-transaction-title" className="text-base font-bold">Edit Transaction</h3>
              <button
                onClick={() => setEditingTxn(null)}
                aria-label="Close edit transaction dialog"
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>

            {/* Type selector */}
            <div className="flex bg-muted rounded-xl p-1" role="tablist" aria-label="Transaction type">
              {(["expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={editType === t}
                  onClick={() => setEditType(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    editType === t
                      ? t === "expense"
                        ? "bg-destructive text-destructive-foreground shadow"
                        : "gradient-primary text-primary-foreground shadow"
                      : "text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label htmlFor="edit-amount-input" className="text-xs font-semibold text-muted-foreground">Amount (₹)</label>
              <Input
                id="edit-amount-input"
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
              <label htmlFor="edit-category-select" className="text-xs font-semibold text-muted-foreground">Category</label>
              <select
                id="edit-category-select"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full h-10 rounded-xl bg-background border border-border px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              <label htmlFor="edit-description-input" className="text-xs font-semibold text-muted-foreground">Description (optional)</label>
              <Input
                id="edit-description-input"
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
                className="flex-1 rounded-xl h-10 gradient-primary text-primary-foreground font-semibold"
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