import type { Transaction } from "./storage";
import { parseTransactionDate } from "./financial";

/**
 * Escapes a single CSV field according to RFC 4180.
 * Also neutralizes spreadsheet formula injection (=, +, -, @) by prepending a single quote.
 */
export function escapeCSVField(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = String(val);

  // Formula injection defense (prevent Excel/Sheets from executing arbitrary code)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180: If field contains commas, newlines, or quotes, wrap in quotes and double internal quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts a list of transactions into an RFC 4180 compliant CSV string.
 * Preserves all essential fields: Transaction ID, ISO Date, Formatted Date, Type, Category, Description, and Amount.
 */
export function generateTransactionsCSV(transactions: Transaction[]): string {
  const headers = [
    "Transaction ID",
    "Date (ISO)",
    "Date (Local)",
    "Type",
    "Category",
    "Description",
    "Amount (INR)",
  ];

  const rows = transactions.map((t) => {
    const d = parseTransactionDate(t);
    const dateIso = !isNaN(d.getTime()) ? d.toISOString() : String(t.date || "");
    const dateLocal = !isNaN(d.getTime())
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      : "Unknown";
    const amountStr = typeof t.amount === "number" ? t.amount.toFixed(2) : String(t.amount || 0);

    return [
      escapeCSVField(t.id),
      escapeCSVField(dateIso),
      escapeCSVField(dateLocal),
      escapeCSVField(t.type),
      escapeCSVField(t.category),
      escapeCSVField(t.description || ""),
      escapeCSVField(amountStr),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n");
}

/**
 * Triggers a browser download of the generated CSV file with an ISO timestamped filename.
 */
export function downloadTransactionsCSV(
  transactions: Transaction[],
  filenamePrefix: string = "flowfi-transactions"
): boolean {
  if (!transactions || transactions.length === 0) {
    return false;
  }

  const csvContent = generateTransactionsCSV(transactions);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `${filenamePrefix}-${timestamp}.csv`;

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
  return true;
}
