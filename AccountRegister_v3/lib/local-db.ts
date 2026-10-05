import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import type { Company, Transaction, Vendor, Site } from "./types";

export type LocalDatabase = {
  companies: Company[];
  vendors: Vendor[];
  sites: Site[];
  transactions: Transaction[];
};

const databasePath = process.env.ACCOUNT_REGISTER_DB_PATH
  ? path.resolve(process.env.ACCOUNT_REGISTER_DB_PATH)
  : path.join(process.cwd(), "data", "account-register.json");
const dataDirectory = path.dirname(databasePath);

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
    const content = (await readFile(databasePath, "utf8")).replace(/^\uFEFF/, "");
    const parsed = JSON.parse(content) as Partial<LocalDatabase>;
    return {
      companies: Array.isArray(parsed.companies) ? parsed.companies : seedCompanies,
      vendors: parsed.vendors || [],
      sites: parsed.sites || [],
      transactions: parsed.transactions || []
    };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined;
    if (code !== "ENOENT") throw error;

    const database = emptyDatabase();
    await writeDatabase(database);
    return database;
  }
}

export async function writeDatabase(database: LocalDatabase) {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${databasePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(database, null, 2), "utf8");
  await rename(temporaryPath, databasePath);
}
