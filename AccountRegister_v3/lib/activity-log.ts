import { appendFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { ActivityLog } from "./types";

const activityLogDirectory = process.env.ACCOUNT_REGISTER_LOG_DIR
  ? path.resolve(process.env.ACCOUNT_REGISTER_LOG_DIR)
  : path.join(process.cwd(), "data", "activity-logs");
const activityLogTimeZone = process.env.ACCOUNT_REGISTER_TIME_ZONE || "Asia/Kolkata";

function dateInLogTimeZone(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: activityLogTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  const day = parts.find((part) => part.type === "day")?.value || "00";

  return `${year}-${month}-${day}`;
}

export async function appendActivityLog(log: Partial<ActivityLog>) {
  const createdAt = log.created_at || new Date().toISOString();
  const safeLog: ActivityLog = {
    id: log.id || randomUUID(),
    action: log.action || "transaction_created",
    label: log.label || "Activity",
    details: log.details || "",
    transaction_id: log.transaction_id || null,
    amount: typeof log.amount === "number" ? log.amount : null,
    company_name: log.company_name || null,
    receiver: log.receiver || null,
    site_name: log.site_name || null,
    created_by: log.created_by || "file-admin",
    created_at: createdAt
  };
  const fileName = `${dateInLogTimeZone(createdAt)}.log`;
  const filePath = path.join(activityLogDirectory, fileName);

  await mkdir(activityLogDirectory, { recursive: true });
  await appendFile(filePath, `${JSON.stringify(safeLog)}\n`, "utf8");
}

export function isValidActivityLogDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export async function readActivityLog(date: string) {
  if (!isValidActivityLogDate(date)) {
    throw new Error("Invalid activity log date.");
  }

  return readFile(path.join(activityLogDirectory, `${date}.log`), "utf8");
}
