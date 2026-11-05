import dns from "node:dns";
import net from "node:net";

/**
 * Checks if an IPv4 or IPv6 string belongs to a private, loopback, or reserved network range.
 */
export function isPrivateOrReservedIP(ip: string): boolean {
  if (!ip) return true;

  // Normalize IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  const version = net.isIP(ip);
  if (version === 4) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }

    const [b0, b1] = parts;

    // 0.0.0.0/8 (Current network)
    if (b0 === 0) return true;

    // 10.0.0.0/8 (Private-Use)
    if (b0 === 10) return true;

    // 100.64.0.0/10 (Shared Address Space / CGNAT)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;

    // 169.254.0.0/16 (Link Local / Cloud Metadata Service AWS/GCP/Azure)
    if (b0 === 169 && b1 === 254) return true;

    // 172.16.0.0/12 (Private-Use: 172.16.0.0 - 172.31.255.255)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (b0 === 192 && b1 === 0 && parts[2] === 0) return true;

    // 192.0.2.0/24 (TEST-NET-1)
    if (b0 === 192 && b1 === 0 && parts[2] === 2) return true;

    // 192.88.99.0/24 (6to4 Relay Anycast)
    if (b0 === 192 && b1 === 88 && parts[2] === 99) return true;

    // 192.168.0.0/16 (Private-Use)
    if (b0 === 192 && b1 === 168) return true;

    // 198.18.0.0/15 (Benchmarking)
    if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

    // 198.51.100.0/24 (TEST-NET-2)
    if (b0 === 198 && b1 === 51 && parts[2] === 100) return true;

    // 203.0.113.0/24 (TEST-NET-3)
    if (b0 === 203 && b1 === 0 && parts[2] === 113) return true;

    // 224.0.0.0/4 (Multicast)
    if (b0 >= 224 && b0 <= 239) return true;

    // 240.0.0.0/4 (Reserved for future use)
    if (b0 >= 240) return true;

    // 255.255.255.255 (Broadcast)
    if (b0 === 255 && b1 === 255 && parts[2] === 255 && parts[3] === 255) return true;

    return false;
  }

  if (version === 6) {
    const lower = ip.toLowerCase();

    // ::1 (Loopback) or :: (Unspecified)
    if (lower === "::1" || lower === "::") return true;

    // Unique local: fc00::/7 (fc00:: - fdff::)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;

    // Link-local: fe80::/10 (fe80:: - febf::)
    if (/^fe[89ab]/i.test(lower)) return true;

    // Multicast: ff00::/8
    if (lower.startsWith("ff")) return true;

    // Documentation: 2001:db8::/32
    if (lower.startsWith("2001:db8")) return true;

    return false;
  }

  // Not a valid IP -> treat as potentially unsafe
  return true;
}

const FORBIDDEN_HOSTNAMES = new Set([
  "localhost",
  "loopback",
  "local",
  "internal",
  "lan",
  "home",
  "corp",
  "intranet",
  "metadata",
  "metadata.google.internal",
  "169.254.169.254",
]);

/**
 * Validates a target URL against SSRF attacks.
 * Resolves DNS to ensure the domain does not resolve to an internal/private IP.
 */
export async function validateTargetUrl(rawUrl: string): Promise<{
  valid: boolean;
  reason?: string;
  sanitizedUrl?: string;
}> {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, reason: "URL wajib diisi." };
  }

  let formatted = rawUrl.trim();
  if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
    formatted = `https://${formatted}`;
  }

  if (formatted.length > 2048) {
    return { valid: false, reason: "URL melebihi batas maksimal 2048 karakter." };
  }

  let parsed: URL;
  try {
    parsed = new URL(formatted);
  } catch {
    return { valid: false, reason: "Format URL tidak valid." };
  }

  // Enforce http/https protocols only
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      reason: `Protokol '${parsed.protocol}' diblokir demi keamanan. Hanya http dan https yang diizinkan.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check forbidden hostnames and suffix matches
  if (
    FORBIDDEN_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".test") ||
    hostname.endsWith(".invalid") ||
    hostname.endsWith(".onion")
  ) {
    return {
      valid: false,
      reason: "Akses ke domain internal, loopback, atau private host diblokir demi keamanan (SSRF Protection).",
    };
  }

  // If direct IP in hostname
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      return {
        valid: false,
        reason: "Akses ke IP privat / loopback / cloud metadata diblokir (SSRF Protection).",
      };
    }
    return { valid: true, sanitizedUrl: parsed.href };
  }

  // DNS lookup check to prevent DNS rebinding or internal alias domains (e.g. nip.io)
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, reason: "Domain tidak dapat ditemukan pada server DNS publik." };
    }

    for (const record of addresses) {
      if (isPrivateOrReservedIP(record.address)) {
        return {
          valid: false,
          reason: `Domain '${hostname}' mengarah ke IP privat (${record.address}). Akses ditolak demi keamanan (SSRF Protection).`,
        };
      }
    }
  } catch (err: any) {
    // DNS resolution failure
    return {
      valid: false,
      reason: `Gagal menyelesaikan domain DNS (${err.code || "ENOTFOUND"}). Pastikan domain valid dan aktif.`,
    };
  }

  return { valid: true, sanitizedUrl: parsed.href };
}

/**
 * Fast synchronous safety check for sub-requests inside Playwright interceptors.
 */
export function isSafeTargetUrlSync(rawUrl: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:" && parsed.protocol !== "data:") {
      return { valid: false, reason: "Blocked protocol" };
    }

    if (parsed.protocol === "data:") {
      return { valid: true };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
      FORBIDDEN_HOSTNAMES.has(hostname) ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return { valid: false, reason: "Forbidden host" };
    }

    if (net.isIP(hostname) && isPrivateOrReservedIP(hostname)) {
      return { valid: false, reason: "Private IP" };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Invalid URL" };
  }
}
