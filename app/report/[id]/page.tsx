"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle,
  Compass,
  Copy,
  ExternalLink,
  Eye,
  FileJson,
  Filter,
  Layers,
  Printer,
  RefreshCw,
  Search,
  Share2,
  Terminal,
  X,
  XCircle,
} from "lucide-react";

interface RequestItem {
  id: string;
  url: string;
  pathname: string;
  queryParams?: Record<string, string>;
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

interface DiagnosticItem {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
  category: string;
  title: string;
  details: string;
  endpoint?: string;
  status?: number | string;
  payload?: any;
  response?: any;
  recommendation: string;
}

interface CrawledPageItem {
  url: string;
  pageTitle: string;
  status: number;
  durationMs: number;
  errorRequestsCount: number;
  consoleErrorsCount: number;
}

interface ScanData {
  id: string;
  meta: {
    id: string;
    targetUrl: string;
    finalUrl: string;
    pageTitle: string;
    crawlMode?: "single" | "multi";
    healthScore: number;
    navigationTimeMs: number;
    totalRequestsCount: number;
    apiRequestsCount: number;
    errorRequestsCount: number;
    consoleErrorsCount: number;
    pageErrorsCount: number;
    screenshot: string | null;
    crawledPages?: CrawledPageItem[];
  };
  diagnostics: DiagnosticItem[];
  requests: RequestItem[];
  consoleLogs: Array<{
    id: string;
    type: string;
    text: string;
    location?: { url?: string; lineNumber?: number };
    timestamp: number;
  }>;
  pageErrors: Array<{
    id: string;
    message: string;
    stack?: string;
    timestamp: number;
  }>;
}

function ReportContent() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanData | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"diagnostics" | "requests" | "console" | "crawled">("diagnostics");
  const [reqFilter, setReqFilter] = useState<"all" | "errors" | "api">("errors");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReq, setSelectedReq] = useState<RequestItem | null>(null);
  const [detailTab, setDetailTab] = useState<"payload" | "response" | "params" | "headers">("payload");

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/scans/${id}`)
      .then((res) => res.json())
      .then((res) => {
        if (!res.success || !res.scan?.data) {
          throw new Error(res.error || "Laporan tidak ditemukan.");
        }
        setScan(res.scan.data);
        setCreatedAt(res.scan.created_at);
        if (res.scan.data.diagnostics?.length > 0) {
          setActiveTab("diagnostics");
        } else {
          setActiveTab("requests");
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || "Gagal memuat laporan.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyMarkdownBugReport = () => {
    if (!scan) return;
    const md = `### 🐛 Web & API Error Report
**Target URL**: \`${scan.meta.targetUrl}\`
**Final URL**: \`${scan.meta.finalUrl}\`
**Health Score**: ${scan.meta.healthScore}/100
**Total Error API**: ${scan.meta.errorRequestsCount}
**Console Errors**: ${scan.meta.consoleErrorsCount}

---
#### 🚨 Diagnosa Masalah:
${scan.diagnostics
  .map(
    (d, i) =>
      `${i + 1}. **[${d.severity}] ${d.title}** (Status: \`${d.status || "-"}\`)\n   - Endpoint: \`${d.endpoint || "-"}\`\n   - Detail: ${d.details}\n   - Rekomendasi: ${d.recommendation}`
  )
  .join("\n\n")}

---
*Laporan digenerate otomatis via InspectLog (${typeof window !== "undefined" ? window.location.href : ""})*
`;
    navigator.clipboard.writeText(md);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2500);
  };

  const copyToClipboard = (text: string, type: "payload" | "response") => {
    navigator.clipboard.writeText(text);
    if (type === "payload") {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } else {
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    }
  };

  const filteredRequests = (scan?.requests || []).filter((req) => {
    if (reqFilter === "errors" && !req.isError) return false;
    if (reqFilter === "api" && !["fetch", "xhr"].includes(req.resourceType)) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchUrl = req.url.toLowerCase().includes(search);
      const matchMethod = req.method.toLowerCase().includes(search);
      const matchStatus = String(req.status || "").includes(search);
      return matchUrl || matchMethod || matchStatus;
    }
    return true;
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-sm text-slate-400">Memuat laporan inspeksi #{id}...</p>
        </div>
      </main>
    );
  }

  if (errorMsg || !scan) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md text-center space-y-4">
          <XCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Laporan Tidak Ditemukan</h2>
          <p className="text-xs text-slate-400">{errorMsg || "ID scan ini tidak terdaftar."}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Halaman Utama
          </Link>
        </div>
      </main>
    );
  }

  const scoreColor =
    scan.meta.healthScore >= 80
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-950/20"
      : scan.meta.healthScore >= 50
      ? "text-amber-400 border-amber-500/30 bg-amber-950/20"
      : "text-red-400 border-red-500/30 bg-red-950/20";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Navbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Scan URL Lain
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={copyShareLink}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-indigo-400" />}
              {copiedLink ? "Link Disalin!" : "Bagikan Link"}
            </button>

            <button
              onClick={copyMarkdownBugReport}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition shadow-md"
            >
              {copiedMarkdown ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedMarkdown ? "Laporan Disalin!" : "Salin Format Bug Dev"}
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              Cetak PDF
            </button>
          </div>
        </div>

        {/* Report Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded">
                REPORT #{scan.meta.id}
              </span>
              {createdAt && (
                <span className="text-xs text-slate-500">
                  {new Date(createdAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white break-all">
              {scan.meta.targetUrl}
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              Title: <span className="text-slate-300 font-medium">{scan.meta.pageTitle || "Tanpa Title"}</span>
            </p>
          </div>

          {/* Health Score Pill */}
          <div className={`flex flex-col items-center justify-center p-4 rounded-xl border ${scoreColor} min-w-[140px]`}>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Health Score</span>
            <span className="text-3xl font-extrabold mt-1">{scan.meta.healthScore}</span>
            <span className="text-[11px] font-medium mt-0.5">
              {scan.meta.healthScore >= 80 ? "Normal" : scan.meta.healthScore >= 50 ? "Butuh Perbaikan" : "Kritis / Rusak"}
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Total Traffic</span>
            <div className="text-2xl font-bold text-white mt-1">{scan.meta.totalRequestsCount}</div>
            <span className="text-[11px] text-slate-500">{scan.meta.apiRequestsCount} Fetch / XHR API</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">API Error (4xx/5xx/Fail)</span>
            <div className={`text-2xl font-bold mt-1 ${scan.meta.errorRequestsCount > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {scan.meta.errorRequestsCount}
            </div>
            <span className="text-[11px] text-slate-500">
              {scan.meta.errorRequestsCount > 0 ? "Lemparan/Balasan bermasalah" : "Semua endpoint aman"}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Console & Script Errors</span>
            <div className={`text-2xl font-bold mt-1 ${scan.meta.consoleErrorsCount > 0 ? "text-amber-400" : "text-slate-300"}`}>
              {scan.meta.consoleErrorsCount}
            </div>
            <span className="text-[11px] text-slate-500">{scan.meta.pageErrorsCount} Uncaught JS Crash</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400">Screenshot Visual</span>
            {scan.meta.screenshot ? (
              <button
                onClick={() => setShowScreenshot(true)}
                className="mt-2 text-xs flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 py-1.5 px-3 rounded-lg border border-slate-700 transition"
              >
                <Eye className="w-3.5 h-3.5" />
                Buka Screenshot
              </button>
            ) : (
              <span className="text-xs text-slate-500 mt-2">Tidak tersedia</span>
            )}
            <span className="text-[10px] text-slate-500 mt-1">{(scan.meta.navigationTimeMs / 1000).toFixed(2)}s load time</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 gap-4">
          {scan.meta.crawledPages && scan.meta.crawledPages.length > 1 && (
            <button
              onClick={() => setActiveTab("crawled")}
              className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
                activeTab === "crawled" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Compass className="w-4 h-4" />
              Halaman Dijelajahi ({scan.meta.crawledPages.length})
            </button>
          )}

          <button
            onClick={() => setActiveTab("diagnostics")}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
              activeTab === "diagnostics" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Diagnosa & Masalah ({scan.diagnostics.length})
          </button>

          <button
            onClick={() => setActiveTab("requests")}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
              activeTab === "requests" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4" />
            API & Lemparan Payload ({scan.requests.length})
          </button>

          <button
            onClick={() => setActiveTab("console")}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
              activeTab === "console" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-4 h-4" />
            Console Error Logs ({scan.consoleLogs.length})
          </button>
        </div>

        {/* TAB: CRAWLED PAGES */}
        {activeTab === "crawled" && scan.meta.crawledPages && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800 font-sans">
                    <tr>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">URL Halaman Internal</th>
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">Load Time</th>
                      <th className="py-3 px-4">API Errors</th>
                      <th className="py-3 px-4 text-right">Filter Request</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {scan.meta.crawledPages.map((page, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/50 transition">
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              page.status >= 400 || page.status === 0
                                ? "bg-red-900/60 text-red-300 border border-red-800"
                                : "bg-emerald-900/40 text-emerald-300 border border-emerald-800"
                            }`}
                          >
                            {page.status || "ERR"}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-sm truncate text-slate-200">
                          <span title={page.url}>{page.url}</span>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-400 font-sans">
                          {page.pageTitle}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {(page.durationMs / 1000).toFixed(2)}s
                        </td>
                        <td className="py-3 px-4">
                          {page.errorRequestsCount > 0 ? (
                            <span className="text-red-400 font-bold bg-red-950/80 px-2 py-0.5 rounded border border-red-900">
                              {page.errorRequestsCount} error
                            </span>
                          ) : (
                            <span className="text-emerald-400">0 error</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          <button
                            onClick={() => {
                              setSearchTerm(page.url);
                              setActiveTab("requests");
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2.5 py-1 rounded text-[11px] transition"
                          >
                            Lihat Traffic
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: DIAGNOSTICS */}
        {activeTab === "diagnostics" && (
          <div className="space-y-4">
            {scan.diagnostics.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-white">Tidak Ditemukan Error Kritis</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                  Website berjalan stabil. Seluruh API dan eksekusi skrip browser berhasil tanpa kendala HTTP 4xx/5xx atau JS crash.
                </p>
              </div>
            ) : (
              scan.diagnostics.map((item, idx) => (
                <div
                  key={idx}
                  className={`bg-slate-900 border rounded-xl p-5 space-y-3 ${
                    item.severity === "CRITICAL"
                      ? "border-red-900/80 bg-red-950/20"
                      : item.severity === "HIGH"
                      ? "border-amber-900/80 bg-amber-950/20"
                      : "border-slate-800"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                          item.severity === "CRITICAL"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : item.severity === "HIGH"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        }`}
                      >
                        {item.severity}
                      </span>
                      <span className="text-xs font-mono text-slate-400">[{item.category}]</span>
                      <h4 className="text-base font-semibold text-white">{item.title}</h4>
                    </div>
                    {item.status && (
                      <span className="text-xs font-mono bg-slate-800 px-2.5 py-1 rounded text-red-300">
                        Status Code: {item.status}
                      </span>
                    )}
                  </div>

                  {item.endpoint && (
                    <div className="text-xs font-mono bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-300 break-all">
                      <span className="text-slate-500 mr-2">Endpoint:</span>
                      {item.endpoint}
                    </div>
                  )}

                  <div className="text-sm text-slate-300">{item.details}</div>

                  {/* Payload & Response preview */}
                  {(item.payload || item.response) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      {item.payload && (
                        <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-xs">
                          <span className="text-slate-400 font-semibold block mb-1">
                            Lemparan (Request Payload):
                          </span>
                          <pre className="font-mono text-slate-300 overflow-x-auto max-h-40">
                            {typeof item.payload === "string" ? item.payload : JSON.stringify(item.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                      {item.response && (
                        <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-xs">
                          <span className="text-slate-400 font-semibold block mb-1">
                            Balasan (Response Body):
                          </span>
                          <pre className="font-mono text-slate-300 overflow-x-auto max-h-40">
                            {typeof item.response === "string" ? item.response : JSON.stringify(item.response, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-lg p-3 text-xs text-indigo-200">
                    <span className="font-semibold text-indigo-300 block mb-0.5">
                      💡 Solusi / Rekomendasi Perbaikan:
                    </span>
                    {item.recommendation}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: REQUESTS TABLE */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setReqFilter("errors")}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    reqFilter === "errors"
                      ? "bg-red-600/30 text-red-300 border border-red-500/50"
                      : "bg-slate-900 text-slate-400 border border-slate-800"
                  }`}
                >
                  Hanya Error ({scan.meta.errorRequestsCount})
                </button>
                <button
                  onClick={() => setReqFilter("api")}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    reqFilter === "api"
                      ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/50"
                      : "bg-slate-900 text-slate-400 border border-slate-800"
                  }`}
                >
                  API Saja (Fetch/XHR)
                </button>
                <button
                  onClick={() => setReqFilter("all")}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    reqFilter === "all"
                      ? "bg-slate-700 text-white border border-slate-600"
                      : "bg-slate-900 text-slate-400 border border-slate-800"
                  }`}
                >
                  Semua ({scan.requests.length})
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari URL, status, method..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Endpoint URL</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4 text-right">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          Tidak ada data yang cocok.
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map((req, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-800/50 transition cursor-pointer ${
                            req.isError ? "bg-red-950/10" : ""
                          }`}
                          onClick={() => {
                            setSelectedReq(req);
                            setDetailTab(req.requestPayload ? "payload" : "response");
                          }}
                        >
                          <td className="py-3 px-4">
                            {req.failed ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-900/60 text-red-300 border border-red-800">
                                FAILED
                              </span>
                            ) : req.status ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  req.status >= 500
                                    ? "bg-red-900/60 text-red-300 border border-red-800"
                                    : req.status >= 400
                                    ? "bg-amber-900/60 text-amber-300 border border-amber-800"
                                    : "bg-emerald-900/40 text-emerald-300 border border-emerald-800"
                                }`}
                              >
                                {req.status}
                              </span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-300">{req.method}</td>
                          <td className="py-3 px-4 max-w-md truncate text-slate-300">
                            <span title={req.url}>{req.url}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-400">
                            <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                              {req.resourceType}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400">
                            {req.durationMs !== null ? `${req.durationMs}ms` : "-"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReq(req);
                                setDetailTab(req.requestPayload ? "payload" : "response");
                              }}
                              className="bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2.5 py-1 rounded text-[11px] font-sans transition"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CONSOLE */}
        {activeTab === "console" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 font-mono text-xs">
            {scan.consoleLogs.length === 0 && scan.pageErrors.length === 0 ? (
              <div className="text-center py-8 text-slate-500 font-sans">
                Tidak ada log console atau runtime exception.
              </div>
            ) : (
              <>
                {scan.pageErrors.map((err) => (
                  <div
                    key={err.id}
                    className="bg-red-950/40 border border-red-800/80 rounded-lg p-3 text-red-200 space-y-1"
                  >
                    <div className="flex items-center gap-2 font-bold text-red-400 font-sans">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>Uncaught Runtime Exception:</span>
                    </div>
                    <div className="font-semibold">{err.message}</div>
                    {err.stack && (
                      <pre className="text-[11px] text-red-300/80 overflow-x-auto whitespace-pre-wrap pt-1">
                        {err.stack}
                      </pre>
                    )}
                  </div>
                ))}

                {scan.consoleLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border flex flex-col gap-1 ${
                      log.type === "error"
                        ? "bg-red-950/20 border-red-900/60 text-red-300"
                        : log.type === "warning"
                        ? "bg-amber-950/20 border-amber-900/60 text-amber-300"
                        : "bg-slate-950 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-sans">
                      <span className="uppercase font-bold tracking-wider">[{log.type}]</span>
                      {log.location?.url && (
                        <span className="truncate max-w-sm">
                          {log.location.url}:{log.location.lineNumber}
                        </span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap break-all">{log.text}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Modal: Deep Request Inspection */}
        {selectedReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
              {/* Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                      selectedReq.failed || (selectedReq.status && selectedReq.status >= 400)
                        ? "bg-red-900/60 text-red-300 border border-red-800"
                        : "bg-emerald-900/40 text-emerald-300 border border-emerald-800"
                    }`}
                  >
                    {selectedReq.failed ? "FAILED" : selectedReq.status || "STATUS ?"}
                  </span>
                  <span className="font-mono font-bold text-sm text-slate-200">
                    {selectedReq.method}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ({selectedReq.durationMs ? `${selectedReq.durationMs}ms` : "-"})
                  </span>
                </div>
                <button
                  onClick={() => setSelectedReq(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Subtabs for Detail */}
              <div className="flex border-b border-slate-800 px-4 bg-slate-950/50 gap-4 text-xs font-medium">
                <button
                  onClick={() => setDetailTab("payload")}
                  className={`py-2.5 border-b-2 transition ${
                    detailTab === "payload"
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Lemparan (Payload)
                </button>
                <button
                  onClick={() => setDetailTab("response")}
                  className={`py-2.5 border-b-2 transition ${
                    detailTab === "response"
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Balasan (Response Body)
                </button>
                <button
                  onClick={() => setDetailTab("params")}
                  className={`py-2.5 border-b-2 transition ${
                    detailTab === "params"
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Query Parameters
                </button>
                <button
                  onClick={() => setDetailTab("headers")}
                  className={`py-2.5 border-b-2 transition ${
                    detailTab === "headers"
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Headers
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono">
                {/* URL */}
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-200 break-all select-all">
                  <span className="text-slate-500 mr-2 font-sans">Full URL:</span>
                  {selectedReq.url}
                </div>

                {/* Subtab Content: Payload */}
                {detailTab === "payload" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-sans">
                      <span className="font-semibold text-slate-300">Request Body / Lemparan:</span>
                      {selectedReq.requestPayload && (
                        <button
                          onClick={() =>
                            copyToClipboard(
                              typeof selectedReq.requestPayload === "string"
                                ? selectedReq.requestPayload
                                : JSON.stringify(selectedReq.requestPayload, null, 2),
                              "payload"
                            )
                          }
                          className="text-[11px] flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                        >
                          {copiedPayload ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedPayload ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-96 overflow-y-auto">
                      {selectedReq.requestPayload ? (
                        <pre className="text-slate-300 text-[11px] whitespace-pre-wrap break-all">
                          {typeof selectedReq.requestPayload === "string"
                            ? selectedReq.requestPayload
                            : JSON.stringify(selectedReq.requestPayload, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-slate-600 font-sans">
                          (Tidak ada payload dikirimkan / Request GET)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Subtab Content: Response */}
                {detailTab === "response" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-sans">
                      <span className="font-semibold text-slate-300">Response Body / Balasan:</span>
                      {selectedReq.responseBody && (
                        <button
                          onClick={() =>
                            copyToClipboard(
                              typeof selectedReq.responseBody === "string"
                                ? selectedReq.responseBody
                                : JSON.stringify(selectedReq.responseBody, null, 2),
                              "response"
                            )
                          }
                          className="text-[11px] flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                        >
                          {copiedResponse ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedResponse ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-96 overflow-y-auto">
                      {selectedReq.responseBody ? (
                        <pre className="text-slate-300 text-[11px] whitespace-pre-wrap break-all">
                          {typeof selectedReq.responseBody === "string"
                            ? selectedReq.responseBody
                            : JSON.stringify(selectedReq.responseBody, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-slate-600 font-sans">
                          (Tidak ada response body atau binary)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Subtab Content: Query Params */}
                {detailTab === "params" && (
                  <div className="space-y-2">
                    <span className="font-semibold text-slate-300 font-sans block">
                      Parsed Query Parameters:
                    </span>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-96 overflow-y-auto">
                      {selectedReq.queryParams && Object.keys(selectedReq.queryParams).length > 0 ? (
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-slate-500 border-b border-slate-800">
                              <th className="pb-2">Key</th>
                              <th className="pb-2">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {Object.entries(selectedReq.queryParams).map(([k, v]) => (
                              <tr key={k}>
                                <td className="py-2 text-indigo-300 font-bold">{k}</td>
                                <td className="py-2 text-slate-300 break-all">{v}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <span className="text-slate-600 font-sans">(Tidak ada query parameter pada URL)</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Subtab Content: Headers */}
                {detailTab === "headers" && (
                  <div className="space-y-4">
                    <div>
                      <span className="text-slate-400 font-sans font-semibold block mb-1">
                        Request Headers:
                      </span>
                      <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-300 overflow-x-auto">
                        {JSON.stringify(selectedReq.requestHeaders, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans font-semibold block mb-1">
                        Response Headers:
                      </span>
                      <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-300 overflow-x-auto">
                        {JSON.stringify(selectedReq.responseHeaders, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setSelectedReq(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-sans transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Screenshot */}
        {showScreenshot && scan.meta.screenshot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-200">
                  Screenshot Halaman: {scan.meta.targetUrl}
                </span>
                <button
                  onClick={() => setShowScreenshot(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-auto flex items-center justify-center bg-slate-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scan.meta.screenshot}
                  alt="Page screenshot"
                  className="max-h-[75vh] object-contain rounded border border-slate-800"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm text-slate-400">Memuat laporan...</p>
          </div>
        </main>
      }
    >
      <ReportContent />
    </Suspense>
  );
}
