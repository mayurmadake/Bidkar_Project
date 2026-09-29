import type { Company, EnrichedTransaction, Transaction } from "./types";

export function signedAmount(entry: Pick<Transaction, "amount" | "entry_type">) {
  return entry.entry_type === "credit" ? Number(entry.amount) : -Number(entry.amount);
}

export function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function yesterdayIso() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function companyBalanceThroughDate(
  company: Company,
  transactions: Transaction[],
  date: string
) {
  const base = Number(company.opening_balance || 0);
  const entries = transactions.filter((entry) => {
    if (entry.company_id !== company.id) return false;
    if (entry.date > date) return false;
    if (company.opening_balance_date && entry.date < company.opening_balance_date) return false;
    return true;
  });
  return base + entries.reduce((total, entry) => total + signedAmount(entry), 0);
}

export function addVisibleDailyBalances(
  entries: EnrichedTransaction[],
  companies: Company[],
  allTransactions: Transaction[]
) {
  const byCompany = new Map(companies.map((company) => [company.id, company]));
  const rows = entries.map((entry) => ({ ...entry }));
  const byId = new Map(rows.map((entry) => [entry.id, entry]));
  const transactionsByCompany = new Map<string, Transaction[]>();

  allTransactions.forEach((entry) => {
    const group = transactionsByCompany.get(entry.company_id) || [];
    group.push(entry);
    transactionsByCompany.set(entry.company_id, group);
  });

  transactionsByCompany.forEach((companyTransactions, companyId) => {
    const company = byCompany.get(companyId);
    if (!company) return;

    let runningBalance = Number(company.opening_balance || 0);
    companyTransactions
      .filter((entry) => !company.opening_balance_date || entry.date >= company.opening_balance_date)
      .sort((a, b) => `${a.date}${a.created_at}`.localeCompare(`${b.date}${b.created_at}`))
      .forEach((entry) => {
        const visibleEntry = byId.get(entry.id);
        if (visibleEntry) visibleEntry.opening_balance = runningBalance;
        runningBalance += signedAmount(entry);
        if (visibleEntry) visibleEntry.closing_balance = runningBalance;
    });
  });

  return rows;
}
