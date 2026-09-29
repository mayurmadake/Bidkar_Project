import { NextResponse } from "next/server";
import { readDatabase, writeDatabase, type LocalDatabase } from "@/lib/local-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await readDatabase();
  return NextResponse.json(database);
}

export async function PUT(request: Request) {
  const database = (await request.json()) as LocalDatabase;
  await writeDatabase({
    companies: database.companies || [],
    vendors: database.vendors || [],
    sites: database.sites || [],
    transactions: database.transactions || []
  });
  return NextResponse.json({ ok: true });
}
