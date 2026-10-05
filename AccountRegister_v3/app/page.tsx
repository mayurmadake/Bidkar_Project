"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, FileText, LogOut, Pencil, Plus, Printer, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { formatCurrency, todayIso } from "@/lib/accounting";
import type { ActivityLog, ActivityLogAction, Company, Site, Transaction, Vendor } from "@/lib/types";

type LocalDatabase = {
  companies: Company[];
  vendors: Vendor[];
  sites: Site[];
  transactions: Transaction[];
};

type TransactionForm = {
  date: string;
  amount: string;
  company_name: string;
  receiver: string;
  site_name: string;
  work: string;
};

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function cleanDisplayValue(value: string | null | undefined) {
  return value === "-" ? "" : value || "";
}

function transactionActivityDetails(entry: Pick<Transaction, "date" | "amount" | "company_name" | "receiver" | "site_name" | "work">) {
  return [
    `Date: ${entry.date}`,
    `Amount: ${Number(entry.amount || 0).toFixed(2)}`,
    entry.company_name ? `Company: ${entry.company_name}` : "",
    entry.receiver ? `Receiver: ${entry.receiver}` : "",
    entry.site_name ? `Site: ${entry.site_name}` : "",
    entry.work ? `Work: ${entry.work}` : ""
  ].filter(Boolean).join(" | ");
}

function createActivityLog(
  action: ActivityLogAction,
  label: string,
  details: string,
  transaction?: Transaction
): ActivityLog {
  return {
    id: createId(),
    action,
    label,
    details,
    transaction_id: transaction?.id || null,
    amount: transaction ? Number(transaction.amount || 0) : null,
    company_name: transaction?.company_name || null,
    receiver: transaction?.receiver || null,
    site_name: transaction?.site_name || null,
    created_by: "file-admin",
    created_at: new Date().toISOString()
  };
}

const transactionLimitOptions = [20, 40, 60, 80, 100];

function reportFileName() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `AccountRegister_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

export default function Home() {
  const importInputRef = useRef<HTMLInputElement>(null);
  const activityLogDateInputRef = useRef<HTMLInputElement>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ companyName: "", receiver: "", siteName: "", start: "", end: "" });
  const [transactionLimit, setTransactionLimit] = useState(20);
  const [transactionPage, setTransactionPage] = useState(1);
  const [editingTransactionId, setEditingTransactionId] = useState("");
  const [editForm, setEditForm] = useState<TransactionForm>({ date: "", amount: "", company_name: "", receiver: "", site_name: "", work: "" });
  const [entryForm, setEntryForm] = useState<TransactionForm>({
    date: todayIso(),
    amount: "",
    company_name: "",
    receiver: "",
    site_name: "",
    work: ""
  });

  const enrichedTransactions = useMemo(() => {
    const companyMap = new Map(companies.map((company) => [company.id, company.name]));
    const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
    const siteMap = new Map(sites.map((site) => [site.id, site.name]));

    function matches(value: string, term: string) {
      return !term || value.toLowerCase().includes(term.trim().toLowerCase());
    }

    return transactions
      .map((entry) => ({
        ...entry,
        company_name: entry.company_name || companyMap.get(entry.company_id) || entry.company_id || "-",
        receiver: entry.receiver || vendorMap.get(entry.vendor_id) || entry.vendor_id || "-",
        site_name: entry.site_name || siteMap.get(entry.site_id) || entry.site_id || "-",
        work: entry.work || entry.description || "-"
      }))
      .filter((entry) => matches(entry.company_name, filters.companyName))
      .filter((entry) => matches(entry.receiver, filters.receiver))
      .filter((entry) => matches(entry.site_name, filters.siteName))
      .filter((entry) => !filters.start || entry.date >= filters.start)
      .filter((entry) => !filters.end || entry.date <= filters.end)
      .sort((a, b) => {
        const dateSort = b.date.localeCompare(a.date);
        if (dateSort !== 0) return dateSort;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [companies, filters, sites, transactions, vendors]);

  const transactionPageCount = Math.max(1, Math.ceil(enrichedTransactions.length / transactionLimit));
  const firstVisibleTransactionIndex = (transactionPage - 1) * transactionLimit;
  const reportTotalAmount = useMemo(
    () => enrichedTransactions.reduce((total, entry) => total + Number(entry.amount || 0), 0),
    [enrichedTransactions]
  );

  useEffect(() => {
    async function initialize() {
      try {
        await loadAll();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load database file.");
        setLoading(false);
      }
    }
    void initialize();
  }, []);

  useEffect(() => {
    setTransactionPage(1);
  }, [filters, transactionLimit]);

  useEffect(() => {
    if (transactionPage > transactionPageCount) {
      setTransactionPage(transactionPageCount);
    }
  }, [transactionPage, transactionPageCount]);

  async function fetchDatabase(): Promise<LocalDatabase> {
    const response = await fetch("/api/db", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load database file.");
    return response.json();
  }

  async function saveDatabase(database: LocalDatabase) {
    const response = await fetch("/api/db", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(database)
    });
    if (!response.ok) throw new Error("Could not save database file.");
  }

  async function loadAll() {
    setLoading(true);
    const database = await fetchDatabase();
    setCompanies(database.companies);
    setVendors(database.vendors);
    setSites(database.sites);
    setTransactions(database.transactions);
    setLoading(false);
  }

  async function persist(next: LocalDatabase) {
    await saveDatabase(next);
    setCompanies(next.companies);
    setVendors(next.vendors);
    setSites(next.sites);
    setTransactions(next.transactions);
  }

  async function writeActivityLog(log: ActivityLog) {
    const response = await fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log)
    });

    if (!response.ok) throw new Error("Could not write activity log.");
  }

  async function tryWriteActivityLog(log: ActivityLog) {
    try {
      await writeActivityLog(log);
      return "";
    } catch {
      return "Action saved, but activity log could not be written.";
    }
  }

  async function addTransaction(event: FormEvent) {
    event.preventDefault();
    const companyName = entryForm.company_name.trim();
    const receiver = entryForm.receiver.trim();
    const siteName = entryForm.site_name.trim();
    const work = entryForm.work.trim();
    const next = await fetchDatabase();
    const payload: Transaction = {
      id: createId(),
      date: entryForm.date,
      amount: Number(entryForm.amount),
      company_name: companyName,
      receiver,
      site_name: siteName,
      work,
      company_id: companyName,
      vendor_id: receiver,
      site_id: siteName,
      transaction_type: "cash",
      entry_type: "debit",
      upi_transaction_id: null,
      cheque_number: null,
      cheque_date: null,
      cheque_status: null,
      description: work || null,
      created_by: "file-admin",
      created_at: new Date().toISOString()
    };
    next.transactions = [payload, ...next.transactions];
    await persist(next);
    const logMessage = await tryWriteActivityLog(
      createActivityLog("transaction_created", "Added transaction", transactionActivityDetails(payload), payload)
    );
    setEntryForm((current) => ({ ...current, amount: "", company_name: "", receiver: "", site_name: "", work: "" }));
    setMessage(logMessage);
  }

  function startEditTransaction(entry: Transaction) {
    setEditingTransactionId(entry.id);
    setEditForm({
      date: entry.date,
      amount: String(Number(entry.amount || 0)),
      company_name: cleanDisplayValue(entry.company_name),
      receiver: cleanDisplayValue(entry.receiver),
      site_name: cleanDisplayValue(entry.site_name),
      work: cleanDisplayValue(entry.work)
    });
    setMessage("");
  }

  function cancelEditTransaction() {
    setEditingTransactionId("");
    setEditForm({ date: "", amount: "", company_name: "", receiver: "", site_name: "", work: "" });
  }

  async function saveEditedTransaction(id: string) {
    if (!editForm.date || editForm.amount === "") {
      setMessage("Date and Amount are required.");
      return;
    }

    const amount = Number(editForm.amount);
    if (Number.isNaN(amount)) {
      setMessage("Amount must be a valid number.");
      return;
    }

    const companyName = editForm.company_name.trim();
    const receiver = editForm.receiver.trim();
    const siteName = editForm.site_name.trim();
    const work = editForm.work.trim();
    const next = await fetchDatabase();
    const original = next.transactions.find((entry) => entry.id === id);

    if (!original) {
      setMessage("Transaction could not be found.");
      return;
    }

    const updatedTransaction: Transaction = {
      ...original,
      date: editForm.date,
      amount,
      company_name: companyName,
      receiver,
      site_name: siteName,
      work,
      company_id: companyName,
      vendor_id: receiver,
      site_id: siteName,
      description: work || null
    };

    next.transactions = next.transactions.map((entry) => {
      if (entry.id !== id) return entry;
      return updatedTransaction;
    });
    await persist(next);
    const logMessage = await tryWriteActivityLog(
      createActivityLog(
        "transaction_updated",
        "Edited transaction",
        `Before: ${transactionActivityDetails(original)} | After: ${transactionActivityDetails(updatedTransaction)}`,
        updatedTransaction
      )
    );
    cancelEditTransaction();
    setMessage(logMessage);
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Delete this transaction?")) return;
    const next = await fetchDatabase();
    const deletedTransaction = next.transactions.find((entry) => entry.id === id);

    if (!deletedTransaction) {
      setMessage("Transaction could not be found.");
      return;
    }

    next.transactions = next.transactions.filter((entry) => entry.id !== id);
    await persist(next);
    const logMessage = await tryWriteActivityLog(
      createActivityLog("transaction_deleted", "Deleted transaction", transactionActivityDetails(deletedTransaction), deletedTransaction)
    );
    setMessage(logMessage);
  }

  async function printReport() {
    const appliedFilters = [
      filters.companyName ? `Company: ${filters.companyName}` : "",
      filters.receiver ? `Receiver: ${filters.receiver}` : "",
      filters.siteName ? `Site: ${filters.siteName}` : "",
      filters.start ? `Start: ${filters.start}` : "",
      filters.end ? `End: ${filters.end}` : ""
    ].filter(Boolean).join(" | ") || "No filters";

    const logMessage = await tryWriteActivityLog(
      createActivityLog(
        "report_printed",
        "Printed report",
        `Rows: ${enrichedTransactions.length} | Total: ${reportTotalAmount.toFixed(2)} | ${appliedFilters}`
      )
    );
    setMessage(logMessage);

    const originalTitle = document.title;
    document.title = reportFileName();

    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };

    window.addEventListener("afterprint", restoreTitle);
    window.print();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function openImportFilePicker() {
    importInputRef.current?.click();
  }

  function openActivityLogCalendar() {
    const input = activityLogDateInputRef.current;
    if (!input) return;
    const showPicker = (input as HTMLInputElement & { showPicker?: () => void }).showPicker;

    if (typeof showPicker === "function") {
      showPicker.call(input);
      return;
    }

    input.click();
    input.focus();
  }

  async function importTransactions(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setImporting(true);
    setMessage("");

    try {
      const response = await fetch("/api/import-transactions", {
        method: "POST",
        body: formData
      });
      const result = (await response.json().catch(() => null)) as { importedCount?: number; error?: string } | null;

      if (!response.ok) {
        setMessage(result?.error || "Could not import transactions.");
        return;
      }

      await loadAll();
      setMessage(`Imported ${result?.importedCount || 0} transactions from ${file.name}.`);
    } catch {
      setMessage("Could not import transactions.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  async function downloadActivityLog(event: ChangeEvent<HTMLInputElement>) {
    const date = event.target.value;
    if (!date) return;

    try {
      const response = await fetch(`/api/activity-log?date=${encodeURIComponent(date)}`);

      if (response.status === 404) {
        alert("Activity logs not found for selected date.");
        return;
      }

      if (!response.ok) {
        setMessage("Could not download activity log.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `activity-log-${date}.log`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("");
    } catch {
      setMessage("Could not download activity log.");
    } finally {
      event.target.value = "";
    }
  }

  if (loading) return <main className="p-6">Loading...</main>;

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold">Account Register</h1>
          <p className="no-print text-sm text-slate-600">File database storage</p>
        </div>
        <div className="no-print flex gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={importTransactions}
          />
          <input ref={activityLogDateInputRef} type="date" className="hidden" onChange={downloadActivityLog} />
          <button
            type="button"
            onClick={openImportFilePicker}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded border border-line px-3 py-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          >
            <Upload size={16} />
            {importing ? "Importing..." : "Import"}
          </button>
          <button type="button" onClick={openActivityLogCalendar} className="inline-flex items-center gap-2 rounded border border-line px-3 py-2"><CalendarDays size={16} />Activity Log</button>
          <button onClick={loadAll} className="inline-flex items-center gap-2 rounded border border-line px-3 py-2"><RefreshCw size={16} />Refresh</button>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded border border-line px-3 py-2"><LogOut size={16} />Logout</button>
        </div>
      </header>

      {message && <div className="no-print mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">{message}</div>}

      <section className="no-print mb-5 rounded-lg border border-line bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Add Transaction</h2>
        <form onSubmit={addTransaction} className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <input required type="date" className="rounded border border-line p-2" value={entryForm.date} onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })} />
          <input required type="number" step="0.01" placeholder="Amount" className="rounded border border-line p-2" value={entryForm.amount} onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })} />
          <input placeholder="Company Name" className="rounded border border-line p-2" value={entryForm.company_name} onChange={(e) => setEntryForm({ ...entryForm, company_name: e.target.value })} />
          <input placeholder="Receiver" className="rounded border border-line p-2" value={entryForm.receiver} onChange={(e) => setEntryForm({ ...entryForm, receiver: e.target.value })} />
          <input placeholder="Site Name" className="rounded border border-line p-2" value={entryForm.site_name} onChange={(e) => setEntryForm({ ...entryForm, site_name: e.target.value })} />
          <input placeholder="Work" className="rounded border border-line p-2" value={entryForm.work} onChange={(e) => setEntryForm({ ...entryForm, work: e.target.value })} />
          <button className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-white md:col-span-3 md:w-fit lg:col-span-6"><Plus size={16} />Add</button>
        </form>
      </section>

      <section className="no-print mb-5 rounded-lg border border-line bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Filters & Reports</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <input placeholder="Company Name" className="rounded border border-line p-2" value={filters.companyName} onChange={(e) => setFilters({ ...filters, companyName: e.target.value })} />
          <input placeholder="Receiver" className="rounded border border-line p-2" value={filters.receiver} onChange={(e) => setFilters({ ...filters, receiver: e.target.value })} />
          <input placeholder="Site Name" className="rounded border border-line p-2" value={filters.siteName} onChange={(e) => setFilters({ ...filters, siteName: e.target.value })} />
          <input type="date" className="rounded border border-line p-2" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
          <input type="date" className="rounded border border-line p-2" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={printReport} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-white"><Printer size={16} />Print / PDF</button>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={18} />
            <h2 className="text-lg font-semibold">Transactions</h2>
          </div>
          <select aria-label="Transactions per page" className="rounded border border-line p-2 text-sm" value={transactionLimit} onChange={(event) => setTransactionLimit(Number(event.target.value))}>
            {transactionLimitOptions.map((option) => <option key={option} value={option}>{option} / page</option>)}
          </select>
        </div>
        <div className="print-only mb-3 text-sm font-semibold">
          Total Amount: {formatCurrency(reportTotalAmount)}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>{["Sr No", "Date", "Amount", "Company Name", "Receiver", "Site Name", "Work", "Actions"].map((head) => <th key={head} className={`p-2 text-left ${head === "Actions" ? "no-print" : ""}`}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {enrichedTransactions.map((entry, index) => {
                const isEditing = editingTransactionId === entry.id;
                const isVisibleOnScreen = index >= firstVisibleTransactionIndex && index < firstVisibleTransactionIndex + transactionLimit;
                return (
                  <tr key={entry.id} className={`border-b border-line ${isVisibleOnScreen ? "" : "screen-hidden"}`}>
                    <td className="p-2 font-medium text-slate-600">{index + 1}</td>
                    <td className="p-2">
                      {isEditing ? (
                        <input required type="date" className="w-full rounded border border-line p-2" value={editForm.date} onChange={(event) => setEditForm({ ...editForm, date: event.target.value })} />
                      ) : entry.date}
                    </td>
                    <td className="p-2 font-semibold text-slate-900">
                      {isEditing ? (
                        <input required type="number" step="0.01" className="w-full rounded border border-line p-2" value={editForm.amount} onChange={(event) => setEditForm({ ...editForm, amount: event.target.value })} />
                      ) : formatCurrency(Number(entry.amount))}
                    </td>
                    <td className="p-2">
                      {isEditing ? (
                        <input className="w-full rounded border border-line p-2" value={editForm.company_name} onChange={(event) => setEditForm({ ...editForm, company_name: event.target.value })} />
                      ) : entry.company_name}
                    </td>
                    <td className="p-2">
                      {isEditing ? (
                        <input className="w-full rounded border border-line p-2" value={editForm.receiver} onChange={(event) => setEditForm({ ...editForm, receiver: event.target.value })} />
                      ) : entry.receiver}
                    </td>
                    <td className="p-2">
                      {isEditing ? (
                        <input className="w-full rounded border border-line p-2" value={editForm.site_name} onChange={(event) => setEditForm({ ...editForm, site_name: event.target.value })} />
                      ) : entry.site_name}
                    </td>
                    <td className="p-2">
                      {isEditing ? (
                        <input className="w-full rounded border border-line p-2" value={editForm.work} onChange={(event) => setEditForm({ ...editForm, work: event.target.value })} />
                      ) : entry.work}
                    </td>
                    <td className="no-print p-2">
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <button type="button" onClick={() => saveEditedTransaction(entry.id)} className="no-print inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-2 text-white" title="Save transaction"><Save size={14} />Save</button>
                            <button type="button" onClick={cancelEditTransaction} className="no-print inline-flex items-center gap-1 rounded border border-line px-2 py-2" title="Cancel edit"><X size={14} />Cancel</button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => startEditTransaction(entry)} className="no-print inline-flex items-center gap-1 rounded border border-line px-2 py-2" title="Edit transaction"><Pencil size={14} />Edit</button>
                            <button type="button" onClick={() => deleteTransaction(entry.id)} className="no-print rounded bg-red-600 p-2 text-white" title="Delete transaction"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="print-only mt-3 text-sm font-semibold">
          Total Amount: {formatCurrency(reportTotalAmount)}
        </div>
        <div className="no-print mt-4 flex flex-wrap items-center gap-1">
          {Array.from({ length: transactionPageCount }, (_, index) => index + 1).map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setTransactionPage(page)}
              className={`rounded px-2 py-1 text-sm ${transactionPage === page ? "bg-blue-600 text-white" : "text-blue-700 hover:bg-blue-50"}`}
            >
              {page}
            </button>
          ))}
        </div>
      </section>

    </main>
  );
}
