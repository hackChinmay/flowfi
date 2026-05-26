import { useAuth } from "@/contexts/AuthContext";
import type { Transaction } from "@/lib/storage";
import { formatCurrency, CATEGORY_CSS } from "@/lib/storage";
import { useMemo, useState, useEffect } from "react";
import { Search, Trash2, Calendar, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/ThemeToggle";

import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";

export default function Transactions() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState("");
  const [txns, setTxns] = useState<Transaction[]>([]);

  // ✅ REALTIME FIRESTORE LISTENER
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Transaction[];

      setTxns(data);
    });

    return () => unsubscribe();
  }, [user]);

  // ✅ FILTER + GROUP (OPTIMIZED)
  const { filteredTxns, grouped } = useMemo(() => {
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

    const grouped: Record<string, Transaction[]> = {};

    all.forEach((t) => {
      const key = new Date(t.date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });

    return { filteredTxns: all, grouped };
  }, [txns, filter, search]);

  // ✅ DELETE FROM FIRESTORE
  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "transactions", id));
      toast({ title: "Deleted", description: "Transaction removed" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete transaction" });
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

    const rows = filteredTxns.map((t) => [
      new Date(t.date).toLocaleDateString("en-IN"),
      t.type,
      t.category,
      t.description || "",
      t.amount,
    ]);

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
  };

  const totalFiltered = filteredTxns.reduce(
    (s, t) => s + (t.type === "income" ? t.amount : -t.amount),
    0
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
                          new Date(txn.date).toLocaleTimeString("en-IN")}
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
                      onClick={() => handleDelete(txn.id)}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}