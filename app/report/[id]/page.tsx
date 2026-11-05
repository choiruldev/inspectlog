"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  ExternalLink,
  Eye,
  FileJson,
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
    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/scans/${id}`);
        const data = await res.json();
        if (data.success && data.scan) {
          setScan(data.scan);
          setCreatedAt(data.created_at || null);
          if (data.scan.meta?.crawledPages && data.scan.meta.crawledPages.length > 1) {
            setActiveTab("crawled");
          } else if (data.scan.diagnostics?.length > 0) {
            setActiveTab("diagnostics");
          } else {
            setActiveTab("requests");
          }
        } else {
          setErrorMsg(data.error || "Report not found.");
        }
      } catch {
        setErrorMsg("Failed to connect to inspection database.");
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
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
*Generated via InspectLog (${typeof window !== "undefined" ? window.location.href : ""})*
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
      <main className="min-h-screen bg-[#090a0f] text-zinc-100 flex items-center justify-center font-mono text-xs">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-5 h-5 text-zinc-400 animate-spin" />
          <p className="text-zinc-500">Loading inspection report #{id}...</p>
        </div>
      </main>
    );
  }

  if (errorMsg || !scan) {
    return (
      <main className="min-h-screen bg-[#090a0f] text-zinc-100 p-6 flex items-center justify-center font-sans">
        <div className="border border-zinc-800 bg-[#0c0e14] rounded-xl p-8 max-w-sm text-center space-y-3">
          <XCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <h2 className="text-sm font-semibold text-zinc-100">Report Not Found</h2>
          <p className="text-xs text-zinc-500">{errorMsg || "This scan ID is not registered or was deleted."}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs px-3 py-1.5 rounded-md font-medium transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Inspector
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090a0f] text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white">
      {/* Top Application Bar */}
      <nav className="border-b border-zinc-800/80 bg-[#090a0f]/90 backdrop-blur sticky top-0 z-40 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-md text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition"
              title="Return to Inspector"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20"></span>
              <span className="font-semibold text-sm tracking-tight text-zinc-100 font-mono">
                InspectLog Report
              </span>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
              #{scan.meta.id}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyShareLink}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{copiedLink ? "Link Copied" : "Share"}</span>
            </button>

            <button
              onClick={copyMarkdownBugReport}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 transition border border-zinc-200 shadow-sm"
            >
              {copiedMarkdown ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedMarkdown ? "Copied" : "Copy Markdown"}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Workspace Frame */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Target Header Deck */}
        <div className="border border-zinc-800/80 bg-[#0c0e14] rounded-lg p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-500">target:</span>
              <span className="font-mono text-sm font-semibold text-zinc-100 break-all select-all">
                {scan.meta.targetUrl}
              </span>
            </div>
            {createdAt && (
              <span className="text-[11px] font-mono text-zinc-500">
                {new Date(createdAt).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            <span>Title: <strong className="text-zinc-300 font-medium">{scan.meta.pageTitle || "Untitled"}</strong></span>
            <span className="text-zinc-600">•</span>
            <span className="font-mono text-zinc-500">{(scan.meta.navigationTimeMs / 1000).toFixed(2)}s load time</span>
          </div>
        </div>

        {/* Metric Strip */}
        <div className="border border-zinc-800/80 bg-[#0c0e14] rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 text-left">
          {/* Health */}
          <div className="p-3.5 space-y-1">
            <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider block">Health Score</span>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-semibold tracking-tight font-mono ${
                  scan.meta.healthScore >= 80
                    ? "text-emerald-400"
                    : scan.meta.healthScore >= 50
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                {scan.meta.healthScore}
              </span>
              <span className="text-xs text-zinc-500 font-mono">/100</span>
            </div>
            <div className="text-[10px] text-zinc-400">
              {scan.meta.healthScore >= 80 ? "Nominal status" : "Attention needed"}
            </div>
          </div>

          {/* Traffic */}
          <div className="p-3.5 space-y-1">
            <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider block">Total Traffic</span>
            <div className="text-2xl font-semibold tracking-tight font-mono text-zinc-100">
              {scan.meta.totalRequestsCount}
            </div>
            <div className="text-[10px] text-zinc-400 font-mono">
              {scan.meta.apiRequestsCount} Fetch/XHR
            </div>
          </div>

          {/* Failed / Errors */}
          <div className="p-3.5 space-y-1">
            <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider block">Failed / 4xx / 5xx</span>
            <div
              className={`text-2xl font-semibold tracking-tight font-mono ${
                scan.meta.errorRequestsCount > 0 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {scan.meta.errorRequestsCount}
            </div>
            <div className="text-[10px] text-zinc-400">
              {scan.meta.errorRequestsCount > 0 ? "API failures detected" : "Zero errors"}
            </div>
          </div>

          {/* Console / Crashes */}
          <div className="p-3.5 space-y-1">
            <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider block">Console / Crashes</span>
            <div
              className={`text-2xl font-semibold tracking-tight font-mono ${
                scan.meta.consoleErrorsCount > 0 || scan.meta.pageErrorsCount > 0
                  ? "text-amber-400"
                  : "text-zinc-300"
              }`}
            >
              {scan.meta.consoleErrorsCount + scan.meta.pageErrorsCount}
            </div>
            <div className="text-[10px] text-zinc-400 font-mono">
              {scan.meta.pageErrorsCount} uncaught crashes
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-zinc-800 flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-1 sm:gap-2">
            {scan.meta.crawledPages && scan.meta.crawledPages.length > 1 && (
              <button
                onClick={() => setActiveTab("crawled")}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === "crawled"
                    ? "border-zinc-200 text-zinc-100"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Crawled Pages</span>
                <span className="font-mono text-[10px] text-zinc-400">({scan.meta.crawledPages.length})</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab("diagnostics")}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "diagnostics"
                  ? "border-zinc-200 text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Diagnostics</span>
              <span className="font-mono text-[10px] text-zinc-400">({scan.diagnostics.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("requests")}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "requests"
                  ? "border-zinc-200 text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Network Requests</span>
              <span className="font-mono text-[10px] text-zinc-400">({scan.requests.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("console")}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "console"
                  ? "border-zinc-200 text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Console Logs</span>
              <span className="font-mono text-[10px] text-zinc-400">({scan.consoleLogs.length + scan.pageErrors.length})</span>
            </button>
          </div>

          {scan.meta.screenshot && (
            <button
              onClick={() => setShowScreenshot(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs text-zinc-300 transition"
            >
              <Eye className="w-3.5 h-3.5 text-zinc-400" />
              <span>Screenshot</span>
            </button>
          )}
        </div>

        {/* TAB: CRAWLED PAGES */}
        {activeTab === "crawled" && scan.meta.crawledPages && (
          <div className="border border-zinc-800/80 rounded-lg overflow-hidden bg-[#0c0e14]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0e1017] text-zinc-400 font-sans border-b border-zinc-800 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 w-16">Status</th>
                    <th className="py-2.5 px-3">Internal Path URL</th>
                    <th className="py-2.5 px-3 font-sans">Title</th>
                    <th className="py-2.5 px-3 w-24">Timing</th>
                    <th className="py-2.5 px-3 w-28">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {scan.meta.crawledPages.map((page, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/40 transition">
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium ${
                            page.status >= 400 || page.status === 0
                              ? "bg-rose-950/60 text-rose-300 border border-rose-900/70"
                              : "bg-emerald-950/60 text-emerald-300 border border-emerald-900/70"
                          }`}
                        >
                          {page.status || "ERR"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-300 max-w-sm truncate" title={page.url}>
                        {page.url}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400 font-sans max-w-xs truncate">
                        {page.pageTitle || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400 font-mono">
                        {(page.durationMs / 1000).toFixed(2)}s
                      </td>
                      <td className="py-2.5 px-3">
                        {page.errorRequestsCount > 0 ? (
                          <span className="text-rose-400 font-medium">
                            {page.errorRequestsCount} error
                          </span>
                        ) : (
                          <span className="text-zinc-500">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: DIAGNOSTICS */}
        {activeTab === "diagnostics" && (
          <div className="space-y-3">
            {scan.diagnostics.length === 0 ? (
              <div className="border border-zinc-800 bg-[#0c0e14] rounded-lg p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h3 className="text-sm font-semibold text-zinc-200">No Critical Anomalies Found</h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  All inspected API requests and page execution scripts ran normally without 4xx/5xx status codes or runtime exceptions.
                </p>
              </div>
            ) : (
              scan.diagnostics.map((item, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-4 space-y-3 bg-[#0c0e14] ${
                    item.severity === "CRITICAL"
                      ? "border-rose-900/60"
                      : item.severity === "HIGH"
                      ? "border-amber-900/60"
                      : "border-zinc-800"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          item.severity === "CRITICAL"
                            ? "bg-rose-950/70 text-rose-300 border border-rose-900/80"
                            : item.severity === "HIGH"
                            ? "bg-amber-950/70 text-amber-300 border border-amber-900/80"
                            : "bg-sky-950/70 text-sky-300 border border-sky-900/80"
                        }`}
                      >
                        {item.severity}
                      </span>
                      <span className="text-xs font-mono text-zinc-500">[{item.category}]</span>
                      <h4 className="text-xs sm:text-sm font-semibold text-zinc-100">
                        {item.title}
                      </h4>
                    </div>

                    {item.status && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-rose-300 border border-zinc-800">
                        Status {item.status}
                      </span>
                    )}
                  </div>

                  {item.endpoint && (
                    <div className="bg-[#090a0f] p-2 rounded border border-zinc-800/80 font-mono text-xs text-zinc-300 break-all select-all">
                      <span className="text-zinc-500 mr-2">endpoint:</span>
                      {item.endpoint}
                    </div>
                  )}

                  <p className="text-xs text-zinc-300 leading-relaxed font-sans">{item.details}</p>

                  {(item.payload || item.response) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {item.payload && (
                        <div className="bg-[#090a0f] rounded border border-zinc-800/80 p-2.5 text-xs font-mono">
                          <span className="text-[11px] text-zinc-500 font-sans block mb-1">
                            Lemparan (Request Payload):
                          </span>
                          <pre className="text-zinc-300 overflow-x-auto max-h-36 text-[11px]">
                            {typeof item.payload === "string" ? item.payload : JSON.stringify(item.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                      {item.response && (
                        <div className="bg-[#090a0f] rounded border border-zinc-800/80 p-2.5 text-xs font-mono">
                          <span className="text-[11px] text-zinc-500 font-sans block mb-1">
                            Balasan (Response Body):
                          </span>
                          <pre className="text-zinc-300 overflow-x-auto max-h-36 text-[11px]">
                            {typeof item.response === "string" ? item.response : JSON.stringify(item.response, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-zinc-900/60 border border-zinc-800 rounded p-2.5 text-xs text-zinc-300">
                    <span className="text-[11px] text-zinc-400 font-medium block mb-0.5">
                      💡 Solusi / Tindakan Perbaikan:
                    </span>
                    {item.recommendation}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: REQUESTS */}
        {activeTab === "requests" && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between print:hidden">
              <div className="flex items-center gap-1 bg-[#0c0e14] border border-zinc-800 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setReqFilter("errors")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    reqFilter === "errors"
                      ? "bg-zinc-800 text-rose-300 font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Errors Only ({scan.meta.errorRequestsCount})
                </button>
                <button
                  onClick={() => setReqFilter("api")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    reqFilter === "api"
                      ? "bg-zinc-800 text-zinc-100 font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Fetch / XHR Only
                </button>
                <button
                  onClick={() => setReqFilter("all")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    reqFilter === "all"
                      ? "bg-zinc-800 text-zinc-100 font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  All ({scan.requests.length})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter path, method, status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0c0e14] border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-zinc-600"
                />
              </div>
            </div>

            <div className="border border-zinc-800/80 rounded-lg overflow-hidden bg-[#0c0e14]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0e1017] text-zinc-400 font-sans border-b border-zinc-800 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 w-16">Status</th>
                      <th className="py-2.5 px-3 w-16">Method</th>
                      <th className="py-2.5 px-3">Endpoint Path / URL</th>
                      <th className="py-2.5 px-3 w-20">Type</th>
                      <th className="py-2.5 px-3 w-20 text-right">Duration</th>
                      <th className="py-2.5 px-3 w-16 text-right font-sans print:hidden">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-zinc-500 font-sans">
                          No requests match the selected filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map((req, idx) => (
                        <tr
                          key={idx}
                          onClick={() => {
                            setSelectedReq(req);
                            setDetailTab(req.requestPayload ? "payload" : "response");
                          }}
                          className={`hover:bg-zinc-900/40 transition cursor-pointer ${
                            req.isError ? "bg-rose-950/10" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            {req.failed ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-900/80">
                                FAIL
                              </span>
                            ) : req.status ? (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  req.status >= 500
                                    ? "bg-rose-950 text-rose-300 border border-rose-900/80"
                                    : req.status >= 400
                                    ? "bg-amber-950 text-amber-300 border border-amber-900/80"
                                    : "bg-emerald-950/60 text-emerald-300 border border-emerald-900/60"
                                }`}
                              >
                                {req.status}
                              </span>
                            ) : (
                              <span className="text-zinc-600">-</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-300">
                              {req.method}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 max-w-md truncate text-zinc-300" title={req.url}>
                            {req.url}
                          </td>

                          <td className="py-2.5 px-3 text-zinc-400">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                              {req.resourceType}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right text-zinc-400 font-mono">
                            {req.durationMs !== null ? `${req.durationMs}ms` : "-"}
                          </td>

                          <td className="py-2.5 px-3 text-right font-sans print:hidden">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReq(req);
                                setDetailTab(req.requestPayload ? "payload" : "response");
                              }}
                              className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] transition"
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

        {/* TAB: CONSOLE LOGS */}
        {activeTab === "console" && (
          <div className="border border-zinc-800/80 rounded-lg p-4 bg-[#0c0e14] space-y-2.5 font-mono text-xs">
            {scan.consoleLogs.length === 0 && scan.pageErrors.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 font-sans">
                No console logs or uncaught runtime exceptions recorded.
              </div>
            ) : (
              <>
                {scan.pageErrors.map((err) => (
                  <div
                    key={err.id}
                    className="bg-rose-950/20 border border-rose-900/60 rounded p-3 text-rose-200 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-rose-400 text-xs font-sans">
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Uncaught Runtime Exception:</span>
                    </div>
                    <div className="font-semibold text-xs">{err.message}</div>
                    {err.stack && (
                      <pre className="text-[10px] text-rose-300/80 overflow-x-auto whitespace-pre-wrap pt-1 font-mono">
                        {err.stack}
                      </pre>
                    )}
                  </div>
                ))}

                {scan.consoleLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded border flex flex-col gap-0.5 ${
                      log.type === "error"
                        ? "bg-rose-950/20 border-rose-900/60 text-rose-300"
                        : log.type === "warning"
                        ? "bg-amber-950/20 border-amber-900/60 text-amber-300"
                        : "bg-[#090a0f] border-zinc-800 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-sans">
                      <span className="uppercase font-bold tracking-wider font-mono">
                        [{log.type}]
                      </span>
                      {log.location?.url && (
                        <span className="truncate max-w-sm font-mono">
                          {log.location.url}:{log.location.lineNumber}
                        </span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap break-all text-xs">{log.text}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Modal: Deep Request Inspector */}
        {selectedReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm print:hidden">
            <div className="bg-[#0c0e14] border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3.5 border-b border-zinc-800 bg-[#0e1017] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      selectedReq.failed || (selectedReq.status && selectedReq.status >= 400)
                        ? "bg-rose-950 text-rose-300 border border-rose-900/80"
                        : "bg-emerald-950 text-emerald-300 border border-emerald-900/80"
                    }`}
                  >
                    {selectedReq.failed ? "FAILED" : selectedReq.status || "STATUS ?"}
                  </span>
                  <span className="font-mono font-semibold text-xs text-zinc-200">
                    {selectedReq.method}
                  </span>
                  <span className="text-zinc-500 text-xs font-mono">
                    ({selectedReq.durationMs ? `${selectedReq.durationMs}ms` : "-"})
                  </span>
                </div>
                <button
                  onClick={() => setSelectedReq(null)}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex border-b border-zinc-800 px-4 bg-[#0a0c12] gap-4 text-xs font-mono">
                <button
                  onClick={() => setDetailTab("payload")}
                  className={`py-2 border-b-2 transition ${
                    detailTab === "payload"
                      ? "border-zinc-200 text-zinc-100"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Lemparan (Payload)
                </button>
                <button
                  onClick={() => setDetailTab("response")}
                  className={`py-2 border-b-2 transition ${
                    detailTab === "response"
                      ? "border-zinc-200 text-zinc-100"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Balasan (Response)
                </button>
                <button
                  onClick={() => setDetailTab("params")}
                  className={`py-2 border-b-2 transition ${
                    detailTab === "params"
                      ? "border-zinc-200 text-zinc-100"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Query Params
                </button>
                <button
                  onClick={() => setDetailTab("headers")}
                  className={`py-2 border-b-2 transition ${
                    detailTab === "headers"
                      ? "border-zinc-200 text-zinc-100"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Headers
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-3 text-xs font-mono">
                <div className="bg-[#090a0f] p-2.5 rounded border border-zinc-800 text-zinc-300 break-all select-all">
                  <span className="text-zinc-500 mr-2 font-sans">Full URL:</span>
                  {selectedReq.url}
                </div>

                {selectedReq.failed && (
                  <div className="bg-rose-950/20 border border-rose-900/60 p-2.5 rounded text-rose-300 font-sans">
                    <span className="font-semibold block mb-0.5">Network Failure Cause:</span>
                    {selectedReq.failureReason || "Connection terminated / aborted"}
                  </div>
                )}

                {detailTab === "payload" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between font-sans">
                      <span className="font-medium text-zinc-400">Request Body / Payload:</span>
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
                          className="text-[11px] flex items-center gap-1 text-zinc-400 hover:text-white"
                        >
                          {copiedPayload ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedPayload ? "Copied" : "Copy JSON"}
                        </button>
                      )}
                    </div>
                    <div className="bg-[#090a0f] border border-zinc-800 rounded-lg p-3 max-h-96 overflow-y-auto">
                      {selectedReq.requestPayload ? (
                        <pre className="text-zinc-300 text-[11px] whitespace-pre-wrap break-all">
                          {typeof selectedReq.requestPayload === "string"
                            ? selectedReq.requestPayload
                            : JSON.stringify(selectedReq.requestPayload, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-zinc-600 font-sans">
                          (No payload body / Standard GET request)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {detailTab === "response" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between font-sans">
                      <span className="font-medium text-zinc-400">Response Body / Balasan:</span>
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
                          className="text-[11px] flex items-center gap-1 text-zinc-400 hover:text-white"
                        >
                          {copiedResponse ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedResponse ? "Copied" : "Copy JSON"}
                        </button>
                      )}
                    </div>
                    <div className="bg-[#090a0f] border border-zinc-800 rounded-lg p-3 max-h-96 overflow-y-auto">
                      {selectedReq.responseBody ? (
                        <pre className="text-zinc-300 text-[11px] whitespace-pre-wrap break-all">
                          {typeof selectedReq.responseBody === "string"
                            ? selectedReq.responseBody
                            : JSON.stringify(selectedReq.responseBody, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-zinc-600 font-sans">
                          (Empty response body or binary content)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {detailTab === "params" && (
                  <div className="space-y-1.5">
                    <span className="font-medium text-zinc-400 font-sans block">
                      Parsed Query Parameters:
                    </span>
                    <div className="bg-[#090a0f] border border-zinc-800 rounded-lg p-3 max-h-96 overflow-y-auto">
                      {selectedReq.queryParams && Object.keys(selectedReq.queryParams).length > 0 ? (
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="text-zinc-500 border-b border-zinc-800">
                              <th className="pb-1.5">Key</th>
                              <th className="pb-1.5">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/60">
                            {Object.entries(selectedReq.queryParams).map(([k, v]) => (
                              <tr key={k}>
                                <td className="py-1.5 text-zinc-300 font-medium">{k}</td>
                                <td className="py-1.5 text-zinc-400 break-all">{v}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <span className="text-zinc-600 font-sans">(No query parameters in URL)</span>
                      )}
                    </div>
                  </div>
                )}

                {detailTab === "headers" && (
                  <div className="space-y-3 font-mono">
                    <div>
                      <span className="text-zinc-500 font-sans text-xs block mb-1">
                        Request Headers:
                      </span>
                      <pre className="bg-[#090a0f] border border-zinc-800 rounded-lg p-2.5 text-[11px] text-zinc-300 overflow-x-auto">
                        {JSON.stringify(selectedReq.requestHeaders, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-sans text-xs block mb-1">
                        Response Headers:
                      </span>
                      <pre className="bg-[#090a0f] border border-zinc-800 rounded-lg p-2.5 text-[11px] text-zinc-300 overflow-x-auto">
                        {JSON.stringify(selectedReq.responseHeaders, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-zinc-800 bg-[#0e1017] flex justify-end">
                <button
                  onClick={() => setSelectedReq(null)}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-sans transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Screenshot Modal */}
        {showScreenshot && scan.meta.screenshot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:hidden">
            <div className="bg-[#0c0e14] border border-zinc-800 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between">
                <span className="font-semibold text-xs text-zinc-200 font-mono">
                  Inspect Page Visual Capture
                </span>
                <button
                  onClick={() => setShowScreenshot(false)}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 overflow-auto flex items-center justify-center bg-[#090a0f]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scan.meta.screenshot}
                  alt="Page screenshot"
                  className="max-h-[75vh] object-contain rounded border border-zinc-800"
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
        <main className="min-h-screen bg-[#090a0f] text-zinc-100 flex items-center justify-center font-mono text-xs">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 text-zinc-400 animate-spin" />
            <p className="text-zinc-500">Initializing report viewer...</p>
          </div>
        </main>
      }
    >
      <ReportContent />
    </Suspense>
  );
}
