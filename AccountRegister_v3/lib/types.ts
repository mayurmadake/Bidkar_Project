export type Role = "admin" | "member";
export type TransactionType = "cash" | "upi" | "cheque";
export type EntryType = "credit" | "debit";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  company_id: string | null;
  allowed_transaction_types: TransactionType[];
  allowed_site_ids: string[];
};

export type Company = {
  id: string;
  name: string;
  owner_name: string;
  address: string | null;
  opening_balance: number;
  opening_balance_date: string | null;
  created_at: string;
};

export type Vendor = {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
};

export type Site = {
  id: string;
  company_id?: string;
  name: string;
  address: string | null;
  created_at: string;
};

export type Transaction = {
  id: string;
  date: string;
  amount: number;
  company_name?: string | null;
  receiver?: string | null;
  site_name?: string | null;
  work?: string | null;
  transaction_type: TransactionType;
  entry_type: EntryType;
  upi_transaction_id: string | null;
  cheque_number: string | null;
  cheque_date: string | null;
  cheque_status: string | null;
  company_id: string;
  vendor_id: string;
  site_id: string;
  description: string | null;
  created_by: string;
  created_at: string;
};

export type EnrichedTransaction = Transaction & {
  company_name: string;
  receiver: string;
  vendor_name: string;
  site_name: string;
  work: string;
  opening_balance?: number | null;
  closing_balance?: number | null;
};
