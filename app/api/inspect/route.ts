import { NextRequest, NextResponse } from "next/server";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { saveScan } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limiter";
import { validateTargetUrl, isSafeTargetUrlSync } from "@/lib/security";
import crypto from "node:crypto";

export const maxDuration = 120; // Allow up to 120s for multi-page crawl

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
  pageOriginUrl?: string; // which page triggered this request
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
  pageOriginUrl?: string;
  timestamp: number;
}

interface PageErrorItem {
  id: string;
  message: string;
  stack?: string;
  pageOriginUrl?: string;
  timestamp: number;
}

interface CrawledPageSummary {
  url: string;
  pageTitle: string;
  status: number;
  durationMs: number;
  errorRequestsCount: number;
  consoleErrorsCount: number;
}

export async function POST(req: NextRequest) {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
    const rateCheck = checkRateLimit(`inspect:${clientIp}`, 25, 3600000); // 25 scans per hour per IP

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Batas pemindaian tercapai (Maksimal 25 scan per jam). Silakan tunggu sebentar." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      url,
      waitDuration = 3000,
      authMode = "none",
      rawCookies = "",
      rawHeaders = "",
      loginConfig,
      captureScreenshot = true,
      crawlMode = "single", // "single" | "multi"
      maxPages = 3, // default 3 pages for multi
      device = "desktop", // "desktop" | "mobile"
    } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL target website wajib diisi." },
        { status: 400 }
      );
    }

    // SSRF & Protocol Safety Check
    const urlValidation = await validateTargetUrl(url);
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: urlValidation.reason || "URL ditolak karena alasan keamanan (SSRF Protection)." },
        { status: 400 }
      );
    }

    const safeUrl = urlValidation.sanitizedUrl!;
    const scanId = `scan_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
    const targetUrlObj = new URL(safeUrl);
    const originHostname = targetUrlObj.hostname;
    const originBase = `${targetUrlObj.protocol}//${targetUrlObj.host}`;

    // Clamp parameters against resource exhaustion
    const safeWaitDuration = Math.min(Math.max(Number(waitDuration) || 3000, 1000), 10000);
    const safeMaxPages = Math.min(Math.max(Number(maxPages) || 3, 1), 10);

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

    const isMobile = device === "mobile";
    const viewport = isMobile
      ? { width: 390, height: 844 } // iPhone 14 / modern mobile viewport
      : { width: 1440, height: 900 };
    const userAgent = isMobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    context = await browser.newContext({
      viewport,
      userAgent,
      isMobile,
      hasTouch: isMobile,
      deviceScaleFactor: isMobile ? 3 : 1,
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

    // Runtime Route Blocker (SSRF Defense-in-depth: blocks redirects/sub-requests to internal networks)
    await page.route("**/*", async (route) => {
      const subUrl = route.request().url();
      const check = isSafeTargetUrlSync(subUrl);
      if (!check.valid) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });

    // Data containers
    let currentNavigatingUrl = targetUrlObj.href;
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
        pageOriginUrl: currentNavigatingUrl,
        timestamp: Date.now(),
      });
    });

    // Intercept Uncaught Page Exceptions
    page.on("pageerror", (err) => {
      pageErrors.push({
        id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        message: err.message,
        stack: err.stack,
        pageOriginUrl: currentNavigatingUrl,
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
        pageOriginUrl: currentNavigatingUrl,
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
          pageOriginUrl: currentNavigatingUrl,
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
          pageOriginUrl: currentNavigatingUrl,
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

    // Navigation and Crawl Queue
    const navStartTime = Date.now();
    let initialNavError: string | null = null;
    const crawledPages: CrawledPageSummary[] = [];
    const queue: string[] = [targetUrlObj.href];
    const visited = new Set<string>();

    const pageLimit = crawlMode === "multi" ? safeMaxPages : 1;
    let screenshotBase64: string | null = null;

    while (queue.length > 0 && visited.size < pageLimit) {
      const currentUrl = queue.shift()!;
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);
      currentNavigatingUrl = currentUrl;

      const pageStart = Date.now();
      let pageStatusCode = 200;
      let pageTitle = "";

      const beforeErrorsCount = Array.from(requestsMap.values()).filter((r) => r.isError).length;
      const beforeConsoleCount = consoleLogs.filter((c) => c.type === "error").length;

      try {
        const response = await page.goto(currentUrl, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        if (response) {
          pageStatusCode = response.status();
        }
        pageTitle = await page.title().catch(() => "");
      } catch (err: any) {
        pageStatusCode = 0;
        if (visited.size === 1) {
          initialNavError = err.message;
        }
      }

      // Wait brief duration for AJAX
      const waitTime = safeWaitDuration;
      await page.waitForTimeout(crawlMode === "multi" ? 2000 : waitTime);

      // Capture screenshot of the first page
      if (visited.size === 1 && captureScreenshot) {
        try {
          const buffer = await page.screenshot({ fullPage: false, type: "jpeg", quality: 60 });
          screenshotBase64 = buffer.toString("base64");
        } catch {
          screenshotBase64 = null;
        }
      }

      // If multi-crawl, discover internal links on this page
      if (crawlMode === "multi" && visited.size < pageLimit) {
        try {
          const links = await page.$$eval("a[href]", (anchors) =>
            anchors.map((a) => (a as HTMLAnchorElement).href).filter(Boolean)
          );

          for (const rawHref of links) {
            try {
              const parsedHref = new URL(rawHref);
              // Must match the same origin hostname
              if (parsedHref.hostname === originHostname) {
                // Ignore hash jumps and static media files
                parsedHref.hash = "";
                const cleanHref = parsedHref.href;
                const ext = cleanHref.split("?")[0].split(".").pop()?.toLowerCase();
                const ignoredExtensions = [
                  "jpg", "jpeg", "png", "gif", "webp", "svg", "ico",
                  "pdf", "zip", "tar", "gz", "mp4", "mp3", "css", "js"
                ];

                if (!ext || !ignoredExtensions.includes(ext)) {
                  if (!visited.has(cleanHref) && !queue.includes(cleanHref)) {
                    queue.push(cleanHref);
                  }
                }
              }
            } catch {
              // skip invalid URL
            }
          }
        } catch (crawlErr: any) {
          console.warn("Failed collecting links on page:", crawlErr.message);
        }
      }

      const afterErrorsCount = Array.from(requestsMap.values()).filter((r) => r.isError).length;
      const afterConsoleCount = consoleLogs.filter((c) => c.type === "error").length;

      crawledPages.push({
        url: currentUrl,
        pageTitle: pageTitle || currentUrl,
        status: pageStatusCode,
        durationMs: Date.now() - pageStart,
        errorRequestsCount: afterErrorsCount - beforeErrorsCount,
        consoleErrorsCount: afterConsoleCount - beforeConsoleCount,
      });
    }

    const finalUrl = page.url();
    const primaryTitle = crawledPages[0]?.pageTitle || (await page.title().catch(() => ""));

    // Convert map to array
    const allRequests = Array.from(requestsMap.values());
    const apiRequests = allRequests.filter((r) =>
      ["fetch", "xhr"].includes(r.resourceType)
    );
    const errorRequests = allRequests.filter((r) => r.isError);
    const consoleErrors = consoleLogs.filter((c) => c.type === "error");

    // Calculate Health Score
    let healthScore = 100;
    if (initialNavError) healthScore -= 50;
    healthScore -= pageErrors.length * 20;
    healthScore -= errorRequests.filter((r) => r.status && r.status >= 500).length * 15;
    healthScore -= errorRequests.filter((r) => r.status && r.status >= 400 && r.status < 500).length * 5;
    healthScore -= errorRequests.filter((r) => r.failed).length * 10;
    healthScore -= consoleErrors.length * 5;
    healthScore = Math.max(0, Math.min(100, healthScore));

    // Generate Diagnostics
    const diagnostics = generateDiagnostics({
      navError: initialNavError,
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
        pageTitle: primaryTitle,
        crawlMode,
        device: isMobile ? "mobile" : "desktop",
        healthScore,
        navigationTimeMs: Date.now() - navStartTime,
        totalRequestsCount: allRequests.length,
        apiRequestsCount: apiRequests.length,
        errorRequestsCount: errorRequests.length,
        consoleErrorsCount: consoleErrors.length,
        pageErrorsCount: pageErrors.length,
        screenshot: screenshotBase64 ? `data:image/jpeg;base64,${screenshotBase64}` : null,
        crawledPages,
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
      pageTitle: primaryTitle,
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
