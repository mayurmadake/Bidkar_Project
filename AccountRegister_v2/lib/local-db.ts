import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Company, Transaction, Vendor, Site } from "./types";

export type LocalDatabase = {
  companies: Company[];
  vendors: Vendor[];
  sites: Site[];
  transactions: Transaction[];
};

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "account-register.json");

function makeCompany(id: string, name: string, owner_name: string, address: string): Company {
  return {
    id,
    name,
    owner_name,
    address,
    opening_balance: 0,
    opening_balance_date: null,
    created_at: new Date().toISOString()
  };
}

const seedCompanies: Company[] = [
  makeCompany("company-sk", "SK enterprises", "SK Enterprise Owner", "SK enterprises site"),
  makeCompany("company-rk", "RK enterprises", "RK Enterprise Owner", "RK enterprises site"),
  makeCompany("company-ar", "AR enterprises", "AR Enterprise Owner", "AR enterprises site")
];

export function emptyDatabase(): LocalDatabase {
  return {
    companies: seedCompanies,
    vendors: [],
    sites: [],
    transactions: []
  };
}

export async function readDatabase(): Promise<LocalDatabase> {
  try {
    const content = await readFile(databasePath, "utf8");
    const parsed = JSON.parse(content) as Partial<LocalDatabase>;
    return {
      companies: parsed.companies?.length ? parsed.companies : seedCompanies,
      vendors: parsed.vendors || [],
      sites: parsed.sites || [],
      transactions: parsed.transactions || []
    };
  } catch {
    const database = emptyDatabase();
    await writeDatabase(database);
    return database;
  }
}

export async function writeDatabase(database: LocalDatabase) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(databasePath, JSON.stringify(database, null, 2), "utf8");
}
