"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, FileText, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { addVisibleDailyBalances, companyBalanceThroughDate, formatCurrency, todayIso, yesterdayIso } from "@/lib/accounting";
import type { Company, EnrichedTransaction, EntryType, Site, Transaction, TransactionType, Vendor } from "@/lib/types";

type OpeningChoice = {
  mode: "manual" | "yesterday";
  amount: string;
};

type LocalDatabase = {
  companies: Company[];
  vendors: Vendor[];
  sites: Site[];
  transactions: Transaction[];
};

const transactionTypes: TransactionType[] = ["cash", "upi", "cheque"];
const entryTypes: EntryType[] = ["credit", "debit"];

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [needsOpening, setNeedsOpening] = useState(true);
  const [openingChoices, setOpeningChoices] = useState<Record<string, OpeningChoice>>({});
  const [filters, setFilters] = useState({ companyId: "", siteId: "", vendorId: "", start: "", end: "" });
  const [companyForm, setCompanyForm] = useState({ name: "", owner_name: "", address: "" });
  const [vendorForm, setVendorForm] = useState({ name: "", address: "" });
  const [siteForm, setSiteForm] = useState({ name: "", address: "" });
  const [memberForm, setMemberForm] = useState({ email: "", full_name: "", role: "member", company_id: "" });
  const [entryForm, setEntryForm] = useState({
    date: todayIso(),
    amount: "",
    transaction_type: "cash" as TransactionType,
    entry_type: "credit" as EntryType,
    company_id: "",
    vendor_id: "",
    site_id: "",
    upi_transaction_id: "",
    cheque_number: "",
    cheque_date: "",
    cheque_status: "pending",
    description: ""
  });

  const visibleCompanies = companies;
  const visibleSites = sites;

  const enrichedTransactions = useMemo(() => {
    const companyMap = new Map(companies.map((company) => [company.id, company.name]));
    const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
    const siteMap = new Map(sites.map((site) => [site.id, site.name]));
    const scoped = transactions
      .filter((entry) => !filters.companyId || entry.company_id === filters.companyId)
      .filter((entry) => !filters.siteId || entry.site_id === filters.siteId)
      .filter((entry) => !filters.vendorId || entry.vendor_id === filters.vendorId)
      .filter((entry) => !filters.start || entry.date >= filters.start)
      .filter((entry) => !filters.end || entry.date <= filters.end)
      .map((entry) => ({
        ...entry,
        company_name: companyMap.get(entry.company_id) || "-",
        vendor_name: vendorMap.get(entry.vendor_id) || "-",
        site_name: siteMap.get(entry.site_id) || "-"
      }))
      .sort((a, b) => `${b.date}${b.created_at}`.localeCompare(`${a.date}${a.created_at}`));

    return addVisibleDailyBalances(scoped, companies, transactions);
  }, [companies, filters, sites, transactions, vendors]);

  const summary = useMemo(() => {
    const totalCredit = enrichedTransactions.filter((entry) => entry.entry_type === "credit").reduce((total, entry) => total + Number(entry.amount), 0);
    const totalDebit = enrichedTransactions.filter((entry) => entry.entry_type === "debit").reduce((total, entry) => total + Number(entry.amount), 0);
    const summaryCompanies = filters.companyId ? companies.filter((company) => company.id === filters.companyId) : visibleCompanies;
    const openingBalance = summaryCompanies.reduce((total, company) => total + Number(company.opening_balance || 0), 0);
    return { totalCredit, totalDebit, openingBalance, net: openingBalance + totalCredit - totalDebit };
  }, [companies, enrichedTransactions, filters.companyId, visibleCompanies]);

  useEffect(() => {
    async function initialize() {
      try {
        await loadAll();
        setNeedsOpening(true);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load database file.");
        setLoading(false);
      }
    }
    void initialize();
  }, []);

  useEffect(() => {
    const choices: Record<string, OpeningChoice> = {};
    visibleCompanies.forEach((company) => {
      choices[company.id] = { mode: "manual", amount: String(Number(company.opening_balance || 0).toFixed(2)) };
    });
    setOpeningChoices(choices);
  }, [visibleCompanies.length]);

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

  async function saveOpeningBalances() {
    const next = await fetchDatabase();
    next.companies = next.companies.map((company) => {
      const choice = openingChoices[company.id];
      const amount = choice?.mode === "yesterday" ? companyBalanceThroughDate(company, transactions, yesterdayIso()) : Number(choice?.amount || 0);
      return { ...company, opening_balance: amount, opening_balance_date: todayIso() };
    });
    await persist(next);
    setNeedsOpening(false);
  }

  async function createCompany(event: FormEvent) {
    event.preventDefault();
    const next = await fetchDatabase();
    next.companies = [...next.companies, { ...companyForm, id: createId(), opening_balance: 0, opening_balance_date: null, created_at: new Date().toISOString() }];
    await persist(next);
    setCompanyForm({ name: "", owner_name: "", address: "" });
  }

  async function createVendor(event: FormEvent) {
    event.preventDefault();
    const next = await fetchDatabase();
    next.vendors = [...next.vendors, { ...vendorForm, id: createId(), created_at: new Date().toISOString() }];
    await persist(next);
    setVendorForm({ name: "", address: "" });
  }

  async function createSite(event: FormEvent) {
    event.preventDefault();
    const next = await fetchDatabase();
    next.sites = [...next.sites, { ...siteForm, id: createId(), created_at: new Date().toISOString() }];
    await persist(next);
    setSiteForm({ name: "", address: "" });
  }

  function saveMemberProfile(event: FormEvent) {
    event.preventDefault();
    setMemberForm({ email: "", full_name: "", role: "member", company_id: "" });
    setMessage("File database mode uses one admin user. Member permissions need a full multi-user database.");
  }

  async function addTransaction(event: FormEvent) {
    event.preventDefault();
    if (entryForm.transaction_type === "upi" && !entryForm.upi_transaction_id) {
      setMessage("UPI transaction ID is required.");
      return;
    }
    if (entryForm.transaction_type === "cheque" && !entryForm.cheque_number) {
      setMessage("Cheque number is required.");
      return;
    }
    const next = await fetchDatabase();
    const payload: Transaction = {
      ...entryForm,
      id: createId(),
      amount: Number(entryForm.amount),
      upi_transaction_id: entryForm.upi_transaction_id || null,
      cheque_number: entryForm.cheque_number || null,
      cheque_date: entryForm.cheque_date || null,
      description: entryForm.description || null,
      created_by: "file-admin",
      created_at: new Date().toISOString()
    };
    next.transactions = [payload, ...next.transactions];
    await persist(next);
    setEntryForm((current) => ({ ...current, amount: "", description: "", upi_transaction_id: "", cheque_number: "" }));
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

  if (needsOpening) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <section className="rounded-lg border border-line bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Company Opening Balances</h1>
          <p className="mt-1 text-sm text-slate-600">Confirm this when opening the register. Select No to use yesterday&apos;s net balance.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {visibleCompanies.map((company) => {
              const yesterdayBalance = companyBalanceThroughDate(company, transactions, yesterdayIso());
              const choice = openingChoices[company.id] || { mode: "manual", amount: "0.00" };
              return (
                <div key={company.id} className="rounded border border-line p-4">
                  <h2 className="font-semibold">{company.name}</h2>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <label><input type="radio" checked={choice.mode === "manual"} onChange={() => setOpeningChoices((old) => ({ ...old, [company.id]: { ...choice, mode: "manual" } }))} /> Yes</label>
                    <label><input type="radio" checked={choice.mode === "yesterday"} onChange={() => setOpeningChoices((old) => ({ ...old, [company.id]: { ...choice, mode: "yesterday" } }))} /> No, use {formatCurrency(yesterdayBalance)}</label>
                  </div>
                  <input className="mt-3 w-full rounded border border-line p-2 disabled:bg-slate-100" type="number" step="0.01" disabled={choice.mode === "yesterday"} value={choice.amount} onChange={(event) => setOpeningChoices((old) => ({ ...old, [company.id]: { ...choice, amount: event.target.value } }))} />
                </div>
              );
            })}
          </div>
          <button onClick={saveOpeningBalances} className="mt-5 rounded bg-blue-600 px-4 py-2 font-medium text-white">Save Opening Balances</button>
        </section>
      </main>
    );
  }

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

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <Metric label="Opening Balance" value={formatCurrency(summary.openingBalance)} tone={summary.openingBalance >= 0 ? "green" : "red"} />
        <Metric label="Total Credit" value={formatCurrency(summary.totalCredit)} tone="green" />
        <Metric label="Total Debit" value={formatCurrency(summary.totalDebit)} tone="red" />
        <Metric label="Current Balance" value={formatCurrency(summary.net)} tone={summary.net >= 0 ? "green" : "red"} />
      </section>

      <section className="mb-5 rounded-lg border border-line bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Filters & Reports</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <Select value={filters.companyId} onChange={(value) => setFilters({ ...filters, companyId: value })} items={visibleCompanies} label="All Companies" />
          <Select value={filters.siteId} onChange={(value) => setFilters({ ...filters, siteId: value })} items={visibleSites} label="All Sites" />
          <Select value={filters.vendorId} onChange={(value) => setFilters({ ...filters, vendorId: value })} items={vendors} label="All Vendors" />
          <input type="date" className="rounded border border-line p-2" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
          <input type="date" className="rounded border border-line p-2" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={exportJson} className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-2 text-white"><Download size={16} />Export JSON</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-white"><Printer size={16} />Print / PDF</button>
        </div>
      </section>

      <section className="mb-5 rounded-lg border border-line bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Add Transaction</h2>
        <form onSubmit={addTransaction} className="grid gap-3 md:grid-cols-4">
          <input required type="date" className="rounded border border-line p-2" value={entryForm.date} onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })} />
          <input required type="number" step="0.01" placeholder="Amount" className="rounded border border-line p-2" value={entryForm.amount} onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })} />
          <select className="rounded border border-line p-2" value={entryForm.transaction_type} onChange={(e) => setEntryForm({ ...entryForm, transaction_type: e.target.value as TransactionType })}>{transactionTypes.map((type) => <option key={type} value={type}>{type.toUpperCase()}</option>)}</select>
          <select className="rounded border border-line p-2" value={entryForm.entry_type} onChange={(e) => setEntryForm({ ...entryForm, entry_type: e.target.value as EntryType })}>{entryTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <Select required value={entryForm.company_id} onChange={(value) => setEntryForm({ ...entryForm, company_id: value })} items={visibleCompanies} label="Select Company" />
          <Select required value={entryForm.site_id} onChange={(value) => setEntryForm({ ...entryForm, site_id: value })} items={visibleSites} label="Select Site" />
          <Select required value={entryForm.vendor_id} onChange={(value) => setEntryForm({ ...entryForm, vendor_id: value })} items={vendors} label="Select Vendor" />
          <input placeholder="Description" className="rounded border border-line p-2" value={entryForm.description} onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })} />
          {entryForm.transaction_type === "upi" && <input placeholder="UPI transaction ID" className="rounded border border-line p-2" value={entryForm.upi_transaction_id} onChange={(e) => setEntryForm({ ...entryForm, upi_transaction_id: e.target.value })} />}
          {entryForm.transaction_type === "cheque" && <input placeholder="Cheque number" className="rounded border border-line p-2" value={entryForm.cheque_number} onChange={(e) => setEntryForm({ ...entryForm, cheque_number: e.target.value })} />}
          {entryForm.transaction_type === "cheque" && <input type="date" className="rounded border border-line p-2" value={entryForm.cheque_date} onChange={(e) => setEntryForm({ ...entryForm, cheque_date: e.target.value })} />}
          <button className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-white"><Plus size={16} />Add</button>
        </form>
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-4">
        <AdminCard title="Company" onSubmit={createCompany}>
          <input required placeholder="Company name" className="rounded border border-line p-2" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} />
          <input required placeholder="Owner name" className="rounded border border-line p-2" value={companyForm.owner_name} onChange={(e) => setCompanyForm({ ...companyForm, owner_name: e.target.value })} />
          <textarea placeholder="Address" className="rounded border border-line p-2" value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} />
        </AdminCard>
        <AdminCard title="Vendor" onSubmit={createVendor}>
          <input required placeholder="Vendor name" className="rounded border border-line p-2" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} />
          <textarea placeholder="Address" className="rounded border border-line p-2" value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} />
        </AdminCard>
        <AdminCard title="Site" onSubmit={createSite}>
          <input required placeholder="Site name" className="rounded border border-line p-2" value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} />
          <textarea placeholder="Address" className="rounded border border-line p-2" value={siteForm.address} onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })} />
        </AdminCard>
        <AdminCard title="Member Permissions" onSubmit={saveMemberProfile}>
          <input required placeholder="Member email" className="rounded border border-line p-2" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} />
          <input placeholder="Full name" className="rounded border border-line p-2" value={memberForm.full_name} onChange={(e) => setMemberForm({ ...memberForm, full_name: e.target.value })} />
          <Select value={memberForm.company_id} onChange={(value) => setMemberForm({ ...memberForm, company_id: value })} items={companies} label="Select Company" />
        </AdminCard>
      </section>

      <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <FileText size={18} />
          <h2 className="text-lg font-semibold">Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>{["Date", "Company", "Vendor", "Site", "Amount", "Type", "Entry", "Opening", "Closing", "Description", ""].map((head) => <th key={head} className="p-2 text-left">{head}</th>)}</tr>
            </thead>
            <tbody>
              {enrichedTransactions.map((entry) => (
                <tr key={entry.id} className="border-b border-line">
                  <td className="p-2">{entry.date}</td>
                  <td className="p-2">{entry.company_name}</td>
                  <td className="p-2">{entry.vendor_name}</td>
                  <td className="p-2">{entry.site_name}</td>
                  <td className={`p-2 font-semibold ${entry.entry_type === "credit" ? "text-green-700" : "text-red-700"}`}>{formatCurrency(Number(entry.amount))}</td>
                  <td className="p-2">{entry.transaction_type}</td>
                  <td className="p-2">{entry.entry_type}</td>
                  <td className="p-2">{entry.opening_balance == null ? "-" : formatCurrency(entry.opening_balance)}</td>
                  <td className="p-2">{entry.closing_balance == null ? "-" : formatCurrency(entry.closing_balance)}</td>
                  <td className="p-2">{entry.description || "-"}</td>
                  <td className="p-2"><button onClick={() => deleteTransaction(entry.id)} className="no-print rounded bg-red-600 p-2 text-white"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "green" | "red" }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-600">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "green" ? "text-green-700" : "text-red-700"}`}>{value}</div>
    </div>
  );
}

function Select({ value, onChange, items, label, required }: { value: string; onChange: (value: string) => void; items: { id: string; name: string }[]; label: string; required?: boolean }) {
  return (
    <select required={required} className="rounded border border-line p-2" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{label}</option>
      {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  );
}

function AdminCard({ title, children, onSubmit }: { title: string; children: React.ReactNode; onSubmit: (event: FormEvent) => void }) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {children}
      <button className="rounded bg-slate-800 px-3 py-2 text-white">Save</button>
    </form>
  );
}
