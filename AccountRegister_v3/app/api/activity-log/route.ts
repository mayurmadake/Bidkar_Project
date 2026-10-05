import { NextResponse } from "next/server";
import { appendActivityLog, isValidActivityLogDate, readActivityLog } from "@/lib/activity-log";
import type { ActivityLog } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "";

  if (!isValidActivityLogDate(date)) {
    return NextResponse.json({ ok: false, error: "Select a valid activity log date." }, { status: 400 });
  }

  try {
    const content = await readActivityLog(date);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="activity-log-${date}.log"`
      }
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined;
    if (code === "ENOENT") {
      return NextResponse.json({ ok: false, error: "Activity logs not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: false, error: "Could not read activity log." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const log = (await request.json()) as Partial<ActivityLog>;

    if (typeof log.action !== "string" || typeof log.label !== "string" || typeof log.details !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid activity log." }, { status: 400 });
    }

    await appendActivityLog(log);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not write activity log." }, { status: 500 });
  }
}
