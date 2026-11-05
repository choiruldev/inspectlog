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

  CREATE TABLE IF NOT EXISTS feedbacks (
    id TEXT PRIMARY KEY,
    email TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS monitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    interval_minutes INTEGER DEFAULT 60,
    alert_type TEXT DEFAULT 'telegram',
    alert_destination TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    last_checked_at TEXT,
    last_status INTEGER,
    last_health_score INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_monitors_status ON monitors(status);

  CREATE TABLE IF NOT EXISTS monitor_logs (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL,
    scan_id TEXT,
    status_code INTEGER,
    health_score INTEGER,
    alert_sent INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_monitor_logs_created_at ON monitor_logs(created_at DESC);

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'free', -- 'free' | 'pro'
    google_id TEXT,
    avatar_url TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    provider TEXT NOT NULL, -- 'midtrans' | 'stripe'
    status TEXT DEFAULT 'pending', -- 'pending' | 'paid' | 'failed'
    payment_url TEXT,
    created_at TEXT NOT NULL,
    paid_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
`);

try {
  db.exec(`ALTER TABLE users ADD COLUMN google_id TEXT;`);
} catch {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`);
} catch {}

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

export function saveFeedback(email: string, message: string) {
  const stmt = db.prepare(`
    INSERT INTO feedbacks (id, email, message, created_at)
    VALUES (?, ?, ?, ?)
  `);
  const id = `fb_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  stmt.run(id, email || null, message, new Date().toISOString());
  return { id };
}

export function listFeedbacks() {
  const stmt = db.prepare(`SELECT * FROM feedbacks ORDER BY created_at DESC LIMIT 50`);
  return stmt.all();
}

export interface MonitorRecord {
  id: string;
  name: string;
  url: string;
  interval_minutes: number;
  alert_type: "telegram" | "webhook";
  alert_destination: string;
  status: "active" | "paused";
  last_checked_at: string | null;
  last_status: number | null;
  last_health_score: number | null;
  created_at: string;
}

export function createMonitor(data: {
  name: string;
  url: string;
  intervalMinutes?: number;
  alertType: "telegram" | "webhook";
  alertDestination: string;
}) {
  const id = `mon_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO monitors (
      id, name, url, interval_minutes, alert_type, alert_destination,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
  `);
  stmt.run(
    id,
    data.name,
    data.url,
    data.intervalMinutes || 60,
    data.alertType,
    data.alertDestination,
    now
  );
  return { id, createdAt: now };
}

export function listMonitors(): MonitorRecord[] {
  const stmt = db.prepare(`SELECT * FROM monitors ORDER BY created_at DESC`);
  return stmt.all() as MonitorRecord[];
}

export function getMonitor(id: string): MonitorRecord | null {
  const stmt = db.prepare(`SELECT * FROM monitors WHERE id = ? LIMIT 1`);
  return (stmt.get(id) as MonitorRecord) || null;
}

export function updateMonitorCheck(
  id: string,
  statusCode: number,
  healthScore: number,
  scanId?: string,
  alertSent = false
) {
  const now = new Date().toISOString();
  const updateStmt = db.prepare(`
    UPDATE monitors
    SET last_checked_at = ?, last_status = ?, last_health_score = ?
    WHERE id = ?
  `);
  updateStmt.run(now, statusCode, healthScore, id);

  const logStmt = db.prepare(`
    INSERT INTO monitor_logs (id, monitor_id, scan_id, status_code, health_score, alert_sent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const logId = `log_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  logStmt.run(logId, id, scanId || null, statusCode, healthScore, alertSent ? 1 : 0, now);
}

export function toggleMonitorStatus(id: string, newStatus: "active" | "paused") {
  const stmt = db.prepare(`UPDATE monitors SET status = ? WHERE id = ?`);
  const res = stmt.run(newStatus, id);
  return (res.changes as number) > 0;
}

export function deleteMonitor(id: string) {
  const stmt = db.prepare(`DELETE FROM monitors WHERE id = ?`);
  const res = stmt.run(id);
  return (res.changes as number) > 0;
}

// User & Auth Management
export interface UserRecord {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: "free" | "pro";
  google_id?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

export function createUser(email: string, name: string, passwordHash: string): UserRecord {
  const id = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, 'free', ?)
  `);
  stmt.run(id, email.toLowerCase(), name, passwordHash, now);
  return { id, email: email.toLowerCase(), name, password_hash: passwordHash, role: "free", created_at: now };
}

export function findOrCreateGoogleUser(data: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}): UserRecord {
  const existing = findUserByEmail(data.email);
  if (existing) {
    if (!existing.google_id || !existing.avatar_url) {
      const updateStmt = db.prepare(`UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?`);
      updateStmt.run(data.googleId, data.avatarUrl || null, existing.id);
      existing.google_id = data.googleId;
      existing.avatar_url = data.avatarUrl || null;
    }
    return existing;
  }

  const id = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, google_id, avatar_url, created_at)
    VALUES (?, ?, ?, 'google_oauth_no_password', 'free', ?, ?, ?)
  `);
  stmt.run(id, data.email.toLowerCase(), data.name, data.googleId, data.avatarUrl || null, now);
  return {
    id,
    email: data.email.toLowerCase(),
    name: data.name,
    password_hash: "google_oauth_no_password",
    role: "free",
    google_id: data.googleId,
    avatar_url: data.avatarUrl || null,
    created_at: now,
  };
}

export function findUserByEmail(email: string): UserRecord | null {
  const stmt = db.prepare(`SELECT * FROM users WHERE email = ? LIMIT 1`);
  return (stmt.get(email.toLowerCase()) as UserRecord) || null;
}

export function findUserById(id: string): UserRecord | null {
  const stmt = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`);
  return (stmt.get(id) as UserRecord) || null;
}

export function updateUserRole(userId: string, role: "free" | "pro") {
  const stmt = db.prepare(`UPDATE users SET role = ? WHERE id = ?`);
  stmt.run(role, userId);
}

// Session Management
export function createSession(userId: string, expiresDays = 30): string {
  const token = `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 12)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresDays * 24 * 60 * 60 * 1000).toISOString();

  const stmt = db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(token, userId, expiresAt, now.toISOString());
  return token;
}

export function getUserFromSession(token: string): UserRecord | null {
  const stmt = db.prepare(`
    SELECT u.* FROM users u
    JOIN sessions s ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?
    LIMIT 1
  `);
  return (stmt.get(token, new Date().toISOString()) as UserRecord) || null;
}

export function deleteSession(token: string) {
  const stmt = db.prepare(`DELETE FROM sessions WHERE token = ?`);
  stmt.run(token);
}

// Payment & Transactions
export interface TransactionRecord {
  id: string;
  user_id: string;
  amount: number;
  provider: "midtrans" | "stripe";
  status: "pending" | "paid" | "failed";
  payment_url: string | null;
  created_at: string;
  paid_at: string | null;
}

export function createTransaction(data: {
  id: string;
  userId: string;
  amount: number;
  provider: "midtrans" | "stripe";
  paymentUrl?: string;
}): TransactionRecord {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO transactions (id, user_id, amount, provider, status, payment_url, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `);
  stmt.run(data.id, data.userId, data.amount, data.provider, data.paymentUrl || null, now);
  return {
    id: data.id,
    user_id: data.userId,
    amount: data.amount,
    provider: data.provider,
    status: "pending",
    payment_url: data.paymentUrl || null,
    created_at: now,
    paid_at: null,
  };
}

export function markTransactionPaid(transactionId: string) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE transactions
    SET status = 'paid', paid_at = ?
    WHERE id = ?
  `);
  stmt.run(now, transactionId);

  // Upgrade the user to 'pro'
  const txStmt = db.prepare(`SELECT user_id FROM transactions WHERE id = ? LIMIT 1`);
  const row = txStmt.get(transactionId) as { user_id: string } | undefined;
  if (row) {
    updateUserRole(row.user_id, "pro");
  }
}


