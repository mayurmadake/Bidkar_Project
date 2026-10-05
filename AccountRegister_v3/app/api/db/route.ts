import { NextResponse } from "next/server";
import { readDatabase, writeDatabase, type LocalDatabase } from "@/lib/local-db";
import type { Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

const protectedTransactionStartDate = "2026-10-01";
const protectedTransactionEndDate = "2026-10-03";

function mergeById<T extends { id: string }>(currentItems: T[], incomingItems: T[]) {
  const incomingIds = new Set(incomingItems.map((item) => item.id));
  return [...incomingItems, ...currentItems.filter((item) => !incomingIds.has(item.id))];
}

function isProtectedProductionTransaction(transaction: Transaction) {
  return transaction.date >= protectedTransactionStartDate && transaction.date <= protectedTransactionEndDate;
}

function mergeTransactions(currentTransactions: Transaction[], incomingTransactions: Transaction[]) {
  const protectedCurrentTransactions = new Map(
    currentTransactions
      .filter(isProtectedProductionTransaction)
      .map((transaction) => [transaction.id, transaction])
  );
  const usedIds = new Set<string>();
  const mergedTransactions = incomingTransactions.map((transaction) => {
    const protectedCurrentTransaction = protectedCurrentTransactions.get(transaction.id);
    const mergedTransaction = protectedCurrentTransaction || transaction;
    usedIds.add(mergedTransaction.id);
    return mergedTransaction;
  });

  currentTransactions.forEach((transaction) => {
    if (usedIds.has(transaction.id)) return;
    if (!isProtectedProductionTransaction(transaction)) return;

    mergedTransactions.push(transaction);
    usedIds.add(transaction.id);
  });

  return mergedTransactions;
}

export async function GET() {
  const database = await readDatabase();
  return NextResponse.json(database);
}

export async function PUT(request: Request) {
  const incomingDatabase = (await request.json()) as LocalDatabase;
  const currentDatabase = await readDatabase();

  await writeDatabase({
    companies: mergeById(currentDatabase.companies, incomingDatabase.companies || []),
    vendors: mergeById(currentDatabase.vendors, incomingDatabase.vendors || []),
    sites: mergeById(currentDatabase.sites, incomingDatabase.sites || []),
    transactions: mergeTransactions(currentDatabase.transactions, incomingDatabase.transactions || [])
  });
  return NextResponse.json({ ok: true });
}
