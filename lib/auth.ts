import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getUserFromSession, UserRecord } from "./db";

const SALT = "inspect_web_salt_2026_xyz";

export function hashPassword(password: string): string {
  return crypto.scryptSync(password, SALT, 64).toString("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  const newHash = hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(newHash, "hex"), Buffer.from(hash, "hex"));
}

export async function getCurrentUser(): Promise<Omit<UserRecord, "password_hash"> | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("inspect_session")?.value;
  if (!token) return null;

  const user = getUserFromSession(token);
  if (!user) return null;

  const { password_hash, ...safeUser } = user;
  return safeUser;
}
