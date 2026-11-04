import { NextRequest, NextResponse } from "next/server";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { saveScan } from "@/lib/db";
import crypto from "node:crypto";

export const maxDuration = 60; // Allow up to 60s for Playwright scan

interface RequestItem {
  id: string;
  url: string;
  pathname: string;
  queryParams: Record<string, string>;
  method: string;
  resourceType: string;
  requestHeaders: Record<string, string>;
  requestPayload: any;
  status: number | null;
  statusText: string | null;
  responseHeaders: Record<string, string>;
  responseBody: any;
  durationMs: number | null;
  failed: boolean;
  failureReason: string | null;
  isError: boolean;
  timestamp: number;
}

interface ConsoleItem {
  id: string;
  type: string;
  text: string;
  location?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  timestamp: number;
}

interface PageErrorItem {
  id: string;
  message: string;
  stack?: string;
  timestamp: number;
}

export async function POST(req: NextRequest) {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    const body = await req.json();
    const {
      url,
      waitDuration = 3000,
      authMode = "none",
      rawCookies = "",
      rawHeaders = "",
      loginConfig,
      captureScreenshot = true,
    } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL target website wajib diisi." },
        { status: 400 }
      );
    }

    const scanId = `scan_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;

    // Launch Playwright using installed Google Chrome or Chromium
    try {
      browser = await chromium.launch({
        channel: "chrome",
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-security",
          "--disable-features=IsolateOrigins,site-per-process",
        ],
      });
    } catch {
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ignoreHTTPSErrors: true,
    });

    // Handle Custom Headers
    if (authMode === "headers" && rawHeaders) {
      try {
        const parsedHeaders =
          typeof rawHeaders === "string" ? JSON.parse(rawHeaders) : rawHeaders;
        await context.setExtraHTTPHeaders(parsedHeaders);
      } catch (e: any) {
        console.warn("Failed parsing extra headers:", e.message);
      }
    }

    // Handle Cookies
    if (authMode === "cookies" && rawCookies) {
      try {
        const targetUrlObj = new URL(url);
        const domain = targetUrlObj.hostname;

        if (rawCookies.trim().startsWith("[")) {
          const parsedCookies = JSON.parse(rawCookies);
          const formattedCookies = parsedCookies.map((c: any) => ({
            name: c.name,
            value: c.value,
            domain: c.domain || domain,
            path: c.path || "/",
          }));
          await context.addCookies(formattedCookies);
        } else {
          const cookiePairs = rawCookies.split(";").map((s: string) => s.trim());
          const formattedCookies = cookiePairs
            .filter((pair: string) => pair.includes("="))
            .map((pair: string) => {
              const eqIdx = pair.indexOf("=");
              const name = pair.substring(0, eqIdx).trim();
              const value = pair.substring(eqIdx + 1).trim();
              return {
                name,
                value,
                domain,
                path: "/",
              };
            });
          await context.addCookies(formattedCookies);
        }
      } catch (e: any) {
        console.warn("Failed parsing cookies:", e.message);
      }
    }

    const page: Page = await context.newPage();

    // Data containers
    const requestsMap = new Map<string, RequestItem>();
    const consoleLogs: ConsoleItem[] = [];
    const pageErrors: PageErrorItem[] = [];

    // Intercept Console
    page.on("console", (msg) => {
      consoleLogs.push({
        id: `console_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: Date.now(),
      });
    });

    // Intercept Uncaught Page Exceptions
    page.on("pageerror", (err) => {
      pageErrors.push({
        id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        message: err.message,
        stack: err.stack,
        timestamp: Date.now(),
      });
    });

    // Helper to parse query params
    const parseUrlInfo = (rawUrl: string) => {
      try {
        const parsed = new URL(rawUrl);
        const params: Record<string, string> = {};
        parsed.searchParams.forEach((v, k) => {
          params[k] = v;
        });
        return { pathname: parsed.pathname, queryParams: params };
      } catch {
        return { pathname: rawUrl, queryParams: {} };
      }
    };

    // Intercept Network Requests
    page.on("request", (req) => {
      const reqId = `${req.method()}_${req.url()}_${Date.now()}`;
      let payload: any = null;
      try {
        const postData = req.postData();
        if (postData) {
          try {
            payload = JSON.parse(postData);
          } catch {
            payload = postData;
          }
        }
      } catch {
        payload = null;
      }

      const { pathname, queryParams } = parseUrlInfo(req.url());

      requestsMap.set(req.url(), {
        id: reqId,
        url: req.url(),
        pathname,
        queryParams,
        method: req.method(),
        resourceType: req.resourceType(),
        requestHeaders: req.headers(),
        requestPayload: payload,
        status: null,
        statusText: null,
        responseHeaders: {},
        responseBody: null,
        durationMs: null,
        failed: false,
        failureReason: null,
        isError: false,
        timestamp: Date.now(),
      });
    });

    // Intercept Network Response
    page.on("response", async (res) => {
      const req = res.request();
      const existing = requestsMap.get(req.url());
      const status = res.status();
      const isError = status >= 400;

      let bodyData: any = null;
      const resourceType = req.resourceType();

      if (
        ["fetch", "xhr", "document"].includes(resourceType) ||
        res.headers()["content-type"]?.includes("json") ||
        res.headers()["content-type"]?.includes("text")
      ) {
        try {
          const text = await res.text();
          if (text) {
            try {
              bodyData = JSON.parse(text);
            } catch {
              bodyData = text.length > 50000 ? text.substring(0, 50000) + "... [truncated]" : text;
            }
          }
        } catch {
          bodyData = "[Unable to read response body]";
        }
      }

      if (existing) {
        existing.status = status;
        existing.statusText = res.statusText();
        existing.responseHeaders = res.headers();
        existing.responseBody = bodyData;
        existing.durationMs = Date.now() - existing.timestamp;
        existing.isError = isError;
      } else {
        const { pathname, queryParams } = parseUrlInfo(req.url());
        requestsMap.set(req.url(), {
          id: `${req.method()}_${req.url()}_${Date.now()}`,
          url: req.url(),
          pathname,
          queryParams,
          method: req.method(),
          resourceType: req.resourceType(),
          requestHeaders: req.headers(),
          requestPayload: null,
          status,
          statusText: res.statusText(),
          responseHeaders: res.headers(),
          responseBody: bodyData,
          durationMs: 0,
          failed: false,
          failureReason: null,
          isError,
          timestamp: Date.now(),
        });
      }
    });

    // Intercept Request Failures
    page.on("requestfailed", (req) => {
      const existing = requestsMap.get(req.url());
      const failure = req.failure();
      const reason = failure ? failure.errorText : "Network request failed";

      if (existing) {
        existing.failed = true;
        existing.failureReason = reason;
        existing.isError = true;
      } else {
        const { pathname, queryParams } = parseUrlInfo(req.url());
        requestsMap.set(req.url(), {
          id: `${req.method()}_${req.url()}_${Date.now()}`,
          url: req.url(),
          pathname,
          queryParams,
          method: req.method(),
          resourceType: req.resourceType(),
          requestHeaders: req.headers(),
          requestPayload: null,
          status: 0,
          statusText: "FAILED",
          responseHeaders: {},
          responseBody: null,
          durationMs: 0,
          failed: true,
          failureReason: reason,
          isError: true,
          timestamp: Date.now(),
        });
      }
    });

    // Perform Login Flow if specified
    if (authMode === "loginFlow" && loginConfig?.loginUrl) {
      try {
        await page.goto(loginConfig.loginUrl, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });

        if (loginConfig.username && loginConfig.usernameSelector) {
          await page.fill(loginConfig.usernameSelector, loginConfig.username);
        }
        if (loginConfig.password && loginConfig.passwordSelector) {
          await page.fill(loginConfig.passwordSelector, loginConfig.password);
        }
        if (loginConfig.submitSelector) {
          await Promise.all([
            page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
            page.click(loginConfig.submitSelector),
          ]);
        }
        await page.waitForTimeout(2000);
      } catch (loginErr: any) {
        console.warn("Login flow failed:", loginErr.message);
      }
    }

    // Navigate to target URL
    const navStartTime = Date.now();
    let navError: string | null = null;
    try {
      await page.goto(url, {
        waitUntil: "load",
        timeout: 30000,
      });
    } catch (err: any) {
      navError = err.message;
    }

    // Wait for subsequent AJAX / background requests
    const waitTime = Math.min(Math.max(Number(waitDuration) || 3000, 1000), 15000);
    await page.waitForTimeout(waitTime);

    const finalUrl = page.url();
    const pageTitle = await page.title().catch(() => "");

    let screenshotBase64: string | null = null;
    if (captureScreenshot) {
      try {
        const buffer = await page.screenshot({ fullPage: false, type: "jpeg", quality: 60 });
        screenshotBase64 = buffer.toString("base64");
      } catch {
        screenshotBase64 = null;
      }
    }

    // Convert map to array
    const allRequests = Array.from(requestsMap.values());
    const apiRequests = allRequests.filter((r) =>
      ["fetch", "xhr"].includes(r.resourceType)
    );
    const errorRequests = allRequests.filter((r) => r.isError);
    const consoleErrors = consoleLogs.filter((c) => c.type === "error");

    // Calculate Health Score (100 is perfect)
    let healthScore = 100;
    if (navError) healthScore -= 50;
    healthScore -= pageErrors.length * 20;
    healthScore -= errorRequests.filter((r) => r.status && r.status >= 500).length * 15;
    healthScore -= errorRequests.filter((r) => r.status && r.status >= 400 && r.status < 500).length * 5;
    healthScore -= errorRequests.filter((r) => r.failed).length * 10;
    healthScore -= consoleErrors.length * 5;
    healthScore = Math.max(0, Math.min(100, healthScore));

    // Generate Diagnostic Summaries
    const diagnostics = generateDiagnostics({
      navError,
      errorRequests,
      consoleErrors,
      pageErrors,
      finalUrl,
      targetUrl: url,
    });

    const fullResult = {
      id: scanId,
      meta: {
        id: scanId,
        targetUrl: url,
        finalUrl,
        pageTitle,
        healthScore,
        navigationTimeMs: Date.now() - navStartTime,
        totalRequestsCount: allRequests.length,
        apiRequestsCount: apiRequests.length,
        errorRequestsCount: errorRequests.length,
        consoleErrorsCount: consoleErrors.length,
        pageErrorsCount: pageErrors.length,
        screenshot: screenshotBase64 ? `data:image/jpeg;base64,${screenshotBase64}` : null,
      },
      diagnostics,
      requests: allRequests,
      consoleLogs,
      pageErrors,
    };

    // Save to SQLite
    saveScan({
      id: scanId,
      targetUrl: url,
      finalUrl,
      pageTitle,
      totalRequests: allRequests.length,
      errorRequests: errorRequests.length,
      consoleErrors: consoleErrors.length,
      navigationTimeMs: Date.now() - navStartTime,
      screenshot: fullResult.meta.screenshot,
      fullData: fullResult,
    });

    return NextResponse.json({
      success: true,
      ...fullResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Gagal melakukan inspect website.",
      },
      { status: 500 }
    );
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

function generateDiagnostics({
  navError,
  errorRequests,
  consoleErrors,
  pageErrors,
  finalUrl,
  targetUrl,
}: {
  navError: string | null;
  errorRequests: RequestItem[];
  consoleErrors: ConsoleItem[];
  pageErrors: PageErrorItem[];
  finalUrl: string;
  targetUrl: string;
}) {
  const issues: Array<{
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
    category: "NAVIGATION" | "API_HTTP" | "API_NETWORK" | "JS_CRASH" | "CONSOLE";
    title: string;
    details: string;
    endpoint?: string;
    status?: number | string;
    payload?: any;
    response?: any;
    recommendation: string;
  }> = [];

  if (navError) {
    issues.push({
      severity: "CRITICAL",
      category: "NAVIGATION",
      title: "Gagal memuat halaman utama",
      details: navError,
      recommendation:
        "Cek apakah URL target aktif, server online, atau ada firewall / proteksi bot yang memblokir akses headless browser.",
    });
  }

  if (finalUrl !== targetUrl && (finalUrl.includes("/login") || finalUrl.includes("/signin") || finalUrl.includes("/auth"))) {
    issues.push({
      severity: "HIGH",
      category: "NAVIGATION",
      title: "Halaman dialihkan (Redirect) ke halaman Login",
      details: `Target: ${targetUrl} dialihkan ke: ${finalUrl}`,
      recommendation:
        "Website memerlukan autentikasi. Gunakan mode Cookies atau Custom Headers (Authorization) pada panel Autentikasi untuk membuka halaman ini.",
    });
  }

  // API Errors
  errorRequests.forEach((req) => {
    let title = "";
    let recommendation = "";
    let severity: "CRITICAL" | "HIGH" | "MEDIUM" = "HIGH";

    if (req.failed) {
      title = `Koneksi API Gagal (${req.failureReason || "Network Error"})`;
      recommendation =
        "Periksa apakah endpoint mendukung CORS, URL endpoint valid, atau endpoint menolak koneksi dari browser.";
    } else if (req.status === 401) {
      title = "Unauthorized (401) - Autentikasi Hilang atau Kadaluarsa";
      recommendation =
        "Request API tidak menyertakan token autentikasi (Bearer token/Cookie session) atau token sudah expired.";
    } else if (req.status === 403) {
      title = "Forbidden (403) - Hak Akses Ditolak";
      recommendation =
        "Akun/token yang digunakan tidak memiliki izin untuk mengakses resource endpoint ini.";
    } else if (req.status === 404) {
      title = "Not Found (404) - Endpoint API Tidak Ditemukan";
      recommendation =
        "Endpoint URL salah atau route backend belum didefinisikan / dihapus.";
    } else if (req.status === 422 || req.status === 400) {
      title = `Bad Request / Validation Error (${req.status})`;
      recommendation =
        "Payload yang dikirimkan tidak sesuai dengan schema validasi backend. Cek bagian 'Request Payload' (lemparan).";
    } else if (req.status && req.status >= 500) {
      severity = "CRITICAL";
      title = `Server Error (${req.status}) - Backend Crash`;
      recommendation =
        "Terjadi unhandled exception atau crash di server backend saat memproses request ini. Cek log server backend.";
    } else {
      title = `HTTP Error (${req.status})`;
      recommendation = "Cek response body dari backend untuk detail pesan kesalahan.";
    }

    issues.push({
      severity,
      category: req.failed ? "API_NETWORK" : "API_HTTP",
      title,
      endpoint: req.url,
      status: req.status || "FAILED",
      details: `Method ${req.method} pada resource [${req.resourceType}].`,
      payload: req.requestPayload,
      response: req.responseBody,
      recommendation,
    });
  });

  // Page Javascript Crashes
  pageErrors.forEach((err) => {
    issues.push({
      severity: "CRITICAL",
      category: "JS_CRASH",
      title: "Uncaught JavaScript Exception",
      details: err.message,
      recommendation:
        "Script frontend mengalami crash runtime (contoh: Cannot read properties of undefined). Periksa stack trace di file JS frontend.",
    });
  });

  // Console Errors
  consoleErrors.forEach((c) => {
    issues.push({
      severity: "MEDIUM",
      category: "CONSOLE",
      title: "Console Error Log",
      details: c.text,
      recommendation: c.location?.url
        ? `Error tercatat di ${c.location.url}:${c.location.lineNumber}`
        : "Periksa console log browser pada script terkait.",
    });
  });

  return issues;
}
