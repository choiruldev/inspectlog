import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// Ensure data folder exists
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "inspect.db");
const db = new DatabaseSync(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    target_url TEXT NOT NULL,
    final_url TEXT,
    page_title TEXT,
    created_at TEXT NOT NULL,
    total_requests INTEGER DEFAULT 0,
    error_requests INTEGER DEFAULT 0,
    console_errors INTEGER DEFAULT 0,
    navigation_time_ms INTEGER DEFAULT 0,
    screenshot TEXT,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
`);

export interface ScanRecord {
  id: string;
  target_url: string;
  final_url: string;
  page_title: string;
  created_at: string;
  total_requests: number;
  error_requests: number;
  console_errors: number;
  navigation_time_ms: number;
  screenshot: string | null;
  data: string; // JSON string
}

export function saveScan(record: {
  id: string;
  targetUrl: string;
  finalUrl: string;
  pageTitle: string;
  totalRequests: number;
  errorRequests: number;
  consoleErrors: number;
  navigationTimeMs: number;
  screenshot: string | null;
  fullData: any;
}) {
  const stmt = db.prepare(`
    INSERT INTO scans (
      id, target_url, final_url, page_title, created_at,
      total_requests, error_requests, console_errors, navigation_time_ms,
      screenshot, data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    record.id,
    record.targetUrl,
    record.finalUrl || record.targetUrl,
    record.pageTitle || "",
    now,
    record.totalRequests,
    record.errorRequests,
    record.consoleErrors,
    record.navigationTimeMs,
    record.screenshot || null,
    JSON.stringify(record.fullData)
  );

  return { id: record.id, createdAt: now };
}

export function getScan(id: string): (Omit<ScanRecord, "data"> & { data: any }) | null {
  const stmt = db.prepare(`SELECT * FROM scans WHERE id = ? LIMIT 1`);
  const row = stmt.get(id) as ScanRecord | undefined;

  if (!row) return null;

  try {
    return {
      ...row,
      data: JSON.parse(row.data),
    };
  } catch {
    return {
      ...row,
      data: null,
    };
  }
}

export function listRecentScans(limit = 20): Array<Omit<ScanRecord, "data" | "screenshot">> {
  const stmt = db.prepare(`
    SELECT id, target_url, final_url, page_title, created_at,
           total_requests, error_requests, console_errors, navigation_time_ms
    FROM scans
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return stmt.all(limit) as Array<Omit<ScanRecord, "data" | "screenshot">>;
}

export function deleteScan(id: string): boolean {
  const stmt = db.prepare(`DELETE FROM scans WHERE id = ?`);
  const res = stmt.run(id);
  return (res.changes as number) > 0;
}
