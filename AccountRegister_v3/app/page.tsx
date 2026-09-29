"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, FileText, Pencil, Plus, Printer, RefreshCw, Save, Trash2, X } from "lucide-react";
import { formatCurrency, todayIso } from "@/lib/accounting";
import type { Company, Site, Transaction, Vendor } from "@/lib/types";

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

const transactionLimitOptions = [20, 40, 60, 80, 100];

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
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
  const visibleTransactions = useMemo(() => {
    const start = (transactionPage - 1) * transactionLimit;
    return enrichedTransactions.slice(start, start + transactionLimit);
  }, [enrichedTransactions, transactionLimit, transactionPage]);

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
    setEntryForm((current) => ({ ...current, amount: "", company_name: "", receiver: "", site_name: "", work: "" }));
    setMessage("");
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
    next.transactions = next.transactions.map((entry) => {
      if (entry.id !== id) return entry;
      return {
        ...entry,
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
    });
    await persist(next);
    cancelEditTransaction();
    setMessage("");
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Delete this transaction?")) return;
    const next = await fetchDatabase();
    next.transactions = next.transactions.filter((entry) => entry.id !== id);
    await persist(next);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), companies, vendors, sites, transactions }, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `account-register-${todayIso()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <main className="p-6">Loading...</main>;

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold">Account Register</h1>
          <p className="text-sm text-slate-600">File database storage</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="inline-flex items-center gap-2 rounded border border-line px-3 py-2"><RefreshCw size={16} />Refresh</button>
        </div>
      </header>

      {message && <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">{message}</div>}

      <section className="mb-5 rounded-lg border border-line bg-white p-4 shadow-sm">
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

      <section className="mb-5 rounded-lg border border-line bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Filters & Reports</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <input placeholder="Company Name" className="rounded border border-line p-2" value={filters.companyName} onChange={(e) => setFilters({ ...filters, companyName: e.target.value })} />
          <input placeholder="Receiver" className="rounded border border-line p-2" value={filters.receiver} onChange={(e) => setFilters({ ...filters, receiver: e.target.value })} />
          <input placeholder="Site Name" className="rounded border border-line p-2" value={filters.siteName} onChange={(e) => setFilters({ ...filters, siteName: e.target.value })} />
          <input type="date" className="rounded border border-line p-2" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
          <input type="date" className="rounded border border-line p-2" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={exportJson} className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-2 text-white"><Download size={16} />Export JSON</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-white"><Printer size={16} />Print / PDF</button>
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>{["Sr No", "Date", "Amount", "Company Name", "Receiver", "Site Name", "Work", "Actions"].map((head) => <th key={head} className="p-2 text-left">{head}</th>)}</tr>
            </thead>
            <tbody>
              {visibleTransactions.map((entry, index) => {
                const isEditing = editingTransactionId === entry.id;
                return (
                  <tr key={entry.id} className="border-b border-line">
                    <td className="p-2 font-medium text-slate-600">{(transactionPage - 1) * transactionLimit + index + 1}</td>
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
                    <td className="p-2">
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
        <div className="mt-4 flex flex-wrap items-center gap-1">
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
