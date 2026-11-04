"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Shield,
  Cookie,
  Key,
  RefreshCw,
  FileJson,
  Activity,
  Layers,
  Terminal,
  ArrowRight,
  Eye,
  X,
  Search,
  Filter,
  History,
  Share2,
  Trash2,
  Globe,
  Compass,
  MessageSquare,
  Sparkles,
  Bell,
  User,
  Bot,
  LogOut,
  Lock,
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
  pageOriginUrl?: string;
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

interface InspectResult {
  id: string;
  meta: {
    id: string;
    targetUrl: string;
    finalUrl: string;
    pageTitle: string;
    crawlMode: "single" | "multi";
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
    pageOriginUrl?: string;
    timestamp: number;
  }>;
  pageErrors: Array<{
    id: string;
    message: string;
    stack?: string;
    pageOriginUrl?: string;
    timestamp: number;
  }>;
}

interface HistoryItem {
  id: string;
  target_url: string;
  final_url: string;
  page_title: string;
  created_at: string;
  total_requests: number;
  error_requests: number;
  console_errors: number;
  navigation_time_ms: number;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [crawlMode, setCrawlMode] = useState<"single" | "multi">("single");
  const [maxPages, setMaxPages] = useState(3);
  const [waitDuration, setWaitDuration] = useState(3000);
  const [authMode, setAuthMode] = useState<"none" | "cookies" | "headers" | "loginFlow">("none");
  const [rawCookies, setRawCookies] = useState("");
  const [rawHeaders, setRawHeaders] = useState('{\n  "Authorization": "Bearer YOUR_TOKEN_HERE"\n}');
  const [loginConfig, setLoginConfig] = useState({
    loginUrl: "",
    usernameSelector: "input[type='email'], input[name='username']",
    username: "",
    passwordSelector: "input[type='password']",
    password: "",
    submitSelector: "button[type='submit']",
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<InspectResult | null>(null);

  // Filter & detail state
  const [activeTab, setActiveTab] = useState<"diagnostics" | "requests" | "console" | "crawled">("diagnostics");
  const [reqFilter, setReqFilter] = useState<"all" | "errors" | "api">("errors");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReq, setSelectedReq] = useState<RequestItem | null>(null);
  const [detailTab, setDetailTab] = useState<"payload" | "response" | "params" | "headers">("payload");

  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedBugReport, setCopiedBugReport] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Beta Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [fbEmail, setFbEmail] = useState("");
  const [fbMessage, setFbMessage] = useState("");
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbSuccess, setFbSuccess] = useState(false);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbMessage.trim()) return;
    setFbSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fbEmail, message: fbMessage }),
      });
      const data = await res.json();
      if (data.success) {
        setFbSuccess(true);
        setTimeout(() => {
          setFbSuccess(false);
          setShowFeedback(false);
          setFbMessage("");
        }, 1500);
      }
    } catch {
      // silent
    } finally {
      setFbSubmitting(false);
    }
  };

  // User Auth state
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string; role: "free" | "pro" } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Gemini AI Analysis state
  const [aiDiagnoses, setAiDiagnoses] = useState<Record<number, any>>({});
  const [loadingAiIdx, setLoadingAiIdx] = useState<number | null>(null);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      // silent
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const endpoint = authTab === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = authTab === "login"
        ? { email: authEmail, password: authPassword }
        : { email: authEmail, name: authName, password: authPassword };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal melakukan autentikasi.");
      }

      setCurrentUser(data.user);
      setShowAuthModal(false);
      setAuthPassword("");
    } catch (err: any) {
      setAuthError(err.message || "Terjadi kesalahan.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
    } catch {
      // silent
    }
  };

  const requestAiDiagnosis = async (idx: number, item: DiagnosticItem) => {
    setLoadingAiIdx(idx);
    try {
      const res = await fetch("/api/inspect/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: item.endpoint || url,
          method: "POST/GET",
          status: item.status,
          payload: item.payload,
          response: item.response,
          failureReason: item.details,
        }),
      });
      const data = await res.json();
      if (data.success && data.diagnosis) {
        setAiDiagnoses((prev) => ({ ...prev, [idx]: data.diagnosis }));
      }
    } catch {
      alert("Gagal menghubungi AI Analyzer.");
    } finally {
      setLoadingAiIdx(null);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/scans");
      const data = await res.json();
      if (data.success) {
        setHistoryList(data.scans || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchCurrentUser();
  }, []);

  const loadPastScan = async (scanId: string) => {
    setLoading(true);
    setErrorMsg(null);
    setShowHistory(false);
    try {
      const res = await fetch(`/api/scans/${scanId}`);
      const data = await res.json();
      if (!data.success || !data.scan?.data) {
        throw new Error(data.error || "Gagal memuat scan lama.");
      }
      setResult(data.scan.data);
      setUrl(data.scan.data.meta.targetUrl);
      if (data.scan.data.diagnostics?.length > 0) {
        setActiveTab("diagnostics");
      } else {
        setActiveTab("requests");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memuat data scan.");
    } finally {
      setLoading(false);
    }
  };

  const deletePastScan = async (e: React.MouseEvent, scanId: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/scans/${scanId}`, { method: "DELETE" });
      setHistoryList((prev) => prev.filter((item) => item.id !== scanId));
      if (result?.id === scanId) {
        setResult(null);
      }
    } catch {
      // silent
    }
  };

  const handleInspect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url) {
      setErrorMsg("Masukkan URL website target terlebih dahulu.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    setSelectedReq(null);

    try {
      const res = await fetch("/api/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.startsWith("http") ? url : `https://${url}`,
          crawlMode,
          maxPages: crawlMode === "multi" ? maxPages : 1,
          waitDuration,
          authMode,
          rawCookies: authMode === "cookies" ? rawCookies : "",
          rawHeaders: authMode === "headers" ? rawHeaders : "",
          loginConfig: authMode === "loginFlow" ? loginConfig : undefined,
          captureScreenshot: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal melakukan inspect website.");
      }

      setResult(data);
      fetchHistory();
      if (crawlMode === "multi" && data.meta?.crawledPages?.length > 1) {
        setActiveTab("crawled");
      } else if (data.diagnostics?.length > 0) {
        setActiveTab("diagnostics");
      } else {
        setActiveTab("requests");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan internal.");
    } finally {
      setLoading(false);
    }
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

  const copyShareLink = () => {
    if (!result?.id) return;
    const shareUrl = `${window.location.origin}/report/${result.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyMarkdownBugReport = () => {
    if (!result) return;
    const shareUrl = `${window.location.origin}/report/${result.id}`;
    const md = `### 🐛 Web & API Error Report
**Target URL**: \`${result.meta.targetUrl}\`
**Mode**: ${result.meta.crawlMode === "multi" ? `Crawler (${result.meta.crawledPages?.length || 1} Halaman)` : "Halaman Tunggal"}
**Health Score**: ${result.meta.healthScore}/100
**Total Error API**: ${result.meta.errorRequestsCount}
**Console Errors**: ${result.meta.consoleErrorsCount}

---
#### 🚨 Diagnosa Masalah:
${result.diagnostics
  .map(
    (d, i) =>
      `${i + 1}. **[${d.severity}] ${d.title}** (Status: \`${d.status || "-"}\`)\n   - Endpoint: \`${d.endpoint || "-"}\`\n   - Detail: ${d.details}\n   - Rekomendasi: ${d.recommendation}`
  )
  .join("\n\n")}

---
*Laporan lengkap & payload: ${shareUrl}*
`;
    navigator.clipboard.writeText(md);
    setCopiedBugReport(true);
    setTimeout(() => setCopiedBugReport(false), 2500);
  };

  const exportReport = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `inspect-report-${result.id || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  };

  const filteredRequests = (result?.requests || []).filter((req) => {
    if (reqFilter === "errors" && !req.isError) return false;
    if (reqFilter === "api" && !["fetch", "xhr"].includes(req.resourceType)) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchUrl = req.url.toLowerCase().includes(search);
      const matchMethod = req.method.toLowerCase().includes(search);
      const matchStatus = String(req.status || "").includes(search);
      const matchOrigin = req.pageOriginUrl?.toLowerCase().includes(search);
      return matchUrl || matchMethod || matchStatus || matchOrigin;
    }
    return true;
  });

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "text-blue-400 bg-blue-950/40 border-blue-800/60";
      case "POST":
        return "text-emerald-400 bg-emerald-950/40 border-emerald-800/60";
      case "PUT":
        return "text-amber-400 bg-amber-950/40 border-amber-800/60";
      case "DELETE":
        return "text-rose-400 bg-rose-950/40 border-rose-800/60";
      default:
        return "text-slate-300 bg-slate-800 border-slate-700";
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="border-b border-slate-800 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                <Activity className="w-6 h-6" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                InspectLog & API Error Analyzer
              </h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Deep inspection: lemparan (payload), balasan (response), query parameters, dan multi-page crawler.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchHistory();
                setShowHistory(true);
              }}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-700 transition"
            >
              <History className="w-4 h-4 text-indigo-400" />
              Riwayat ({historyList.length})
            </button>

            <Link
              href="/monitoring"
              className="inline-flex items-center gap-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 px-3 py-2 rounded-lg text-xs font-semibold transition"
            >
              <Bell className="w-3.5 h-3.5 text-rose-400" />
              Auto Monitor (Pro)
            </Link>

            <button
              onClick={() => setShowFeedback(true)}
              className="inline-flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-3 py-2 rounded-lg text-xs font-medium transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Feedback (Beta)
            </button>

            {currentUser ? (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs">
                <span className="font-semibold text-white">{currentUser.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    currentUser.role === "pro"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {currentUser.role}
                </span>
                <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 p-0.5 ml-1" title="Logout">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthTab("login");
                  setShowAuthModal(true);
                }}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-3 py-2 rounded-lg text-xs font-medium transition"
              >
                <User className="w-3.5 h-3.5 text-indigo-400" />
                Masuk / Daftar
              </button>
            )}

            {result && (
              <>
                <button
                  onClick={copyShareLink}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-700 transition"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-indigo-400" />}
                  {copiedLink ? "Link Disalin" : "Share Link"}
                </button>

                <button
                  onClick={exportReport}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-700 transition"
                >
                  <FileJson className="w-4 h-4 text-indigo-400" />
                  JSON
                </button>
              </>
            )}
          </div>
        </header>

        {/* Input Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <form onSubmit={handleInspect} className="space-y-4">
            {/* Top row: URL + Mode + Inspect CTA */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="https://example.com atau https://my-store.com/checkout"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
              </div>

              {/* Mode Switcher: Single vs Multi */}
              <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setCrawlMode("single")}
                  className={`px-3 py-2 rounded-md font-medium transition ${
                    crawlMode === "single"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  1 Halaman
                </button>
                <button
                  type="button"
                  onClick={() => setCrawlMode("multi")}
                  className={`px-3 py-2 rounded-md font-medium transition flex items-center gap-1 ${
                    crawlMode === "multi"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  Crawler (Multi)
                </button>
              </div>

              {/* Max Pages selector if multi */}
              {crawlMode === "multi" && (
                <div className="w-full sm:w-36 flex items-center bg-slate-950 border border-slate-700 rounded-lg px-3">
                  <span className="text-xs text-slate-400 mr-2">Limit:</span>
                  <select
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="bg-transparent text-sm text-slate-200 focus:outline-none w-full py-3"
                  >
                    <option value={3}>3 Halaman</option>
                    <option value={5}>5 Halaman</option>
                    <option value={10}>10 Halaman</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 text-white font-medium px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition min-w-[140px] shadow-lg shadow-indigo-600/20"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{crawlMode === "multi" ? "Crawling..." : "Inspecting..."}</span>
                  </>
                ) : (
                  <>
                    <span>Inspect Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Auth Mode Switcher */}
            <div className="pt-2 border-t border-slate-800/70">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  Mode Akses / Autentikasi
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setAuthMode("none")}
                  className={`p-2.5 rounded-lg text-xs font-medium border text-left transition flex items-center gap-2 ${
                    authMode === "none"
                      ? "bg-indigo-950/60 border-indigo-500 text-indigo-200"
                      : "bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Tanpa Login (Publik)
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMode("cookies")}
                  className={`p-2.5 rounded-lg text-xs font-medium border text-left transition flex items-center gap-2 ${
                    authMode === "cookies"
                      ? "bg-indigo-950/60 border-indigo-500 text-indigo-200"
                      : "bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <Cookie className="w-3.5 h-3.5 text-amber-400" />
                  Cookie / Session
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMode("headers")}
                  className={`p-2.5 rounded-lg text-xs font-medium border text-left transition flex items-center gap-2 ${
                    authMode === "headers"
                      ? "bg-indigo-950/60 border-indigo-500 text-indigo-200"
                      : "bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <Key className="w-3.5 h-3.5 text-cyan-400" />
                  Custom Headers / Token
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMode("loginFlow")}
                  className={`p-2.5 rounded-lg text-xs font-medium border text-left transition flex items-center gap-2 ${
                    authMode === "loginFlow"
                      ? "bg-indigo-950/60 border-indigo-500 text-indigo-200"
                      : "bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  Auto-Login Form
                </button>
              </div>

              {/* Dynamic Auth Inputs */}
              {authMode === "cookies" && (
                <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2">
                  <div className="text-slate-300 font-medium">
                    Masukkan Cookies (string <code>session_id=abc; token=123</code> atau JSON array):
                  </div>
                  <textarea
                    rows={3}
                    value={rawCookies}
                    onChange={(e) => setRawCookies(e.target.value)}
                    placeholder="session_id=xyz987; connect.sid=s%3A..."
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 font-mono text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              {authMode === "headers" && (
                <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2">
                  <div className="text-slate-300 font-medium">
                    Masukkan Extra Headers (format JSON key-value):
                  </div>
                  <textarea
                    rows={3}
                    value={rawHeaders}
                    onChange={(e) => setRawHeaders(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 font-mono text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              {authMode === "loginFlow" && (
                <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-slate-300 block mb-1">Login URL</label>
                    <input
                      type="text"
                      placeholder="https://example.com/login"
                      value={loginConfig.loginUrl}
                      onChange={(e) => setLoginConfig({ ...loginConfig, loginUrl: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">Username / Email Value</label>
                    <input
                      type="text"
                      placeholder="user@example.com"
                      value={loginConfig.username}
                      onChange={(e) => setLoginConfig({ ...loginConfig, username: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1">Password Value</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={loginConfig.password}
                      onChange={(e) => setLoginConfig({ ...loginConfig, password: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-500">
            <span>Uji coba cepat:</span>
            <button
              onClick={() => {
                setUrl("https://httpbin.org/status/500");
                setAuthMode("none");
                setCrawlMode("single");
              }}
              className="text-slate-400 hover:text-indigo-400 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700"
            >
              Test API 500
            </button>
            <button
              onClick={() => {
                setUrl("https://httpbin.org/status/401");
                setAuthMode("none");
                setCrawlMode("single");
              }}
              className="text-slate-400 hover:text-indigo-400 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700"
            >
              Test 401 Unauthorized
            </button>
            <button
              onClick={() => {
                setUrl("https://jsonplaceholder.typicode.com");
                setAuthMode("none");
                setCrawlMode("multi");
                setMaxPages(3);
              }}
              className="text-slate-400 hover:text-indigo-400 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700"
            >
              Test Crawler Multi-Halaman
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-xl flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm">Gagal Melakukan Inspect</div>
              <div className="text-xs text-red-300 mt-0.5">{errorMsg}</div>
            </div>
          </div>
        )}

        {/* Results Container */}
        {result && (
          <div className="space-y-6">
            {/* Meta & Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-xs text-slate-400">Health Score</span>
                <span
                  className={`text-3xl font-extrabold mt-1 ${
                    result.meta.healthScore >= 80
                      ? "text-emerald-400"
                      : result.meta.healthScore >= 50
                      ? "text-amber-400"
                      : "text-red-400"
                  }`}
                >
                  {result.meta.healthScore}/100
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  {result.meta.healthScore >= 80 ? "Normal" : "Perlu Perbaikan"}
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-xs text-slate-400">Total Requests</span>
                <span className="text-2xl font-bold text-white mt-1">
                  {result.meta.totalRequestsCount}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  {result.meta.crawledPages && result.meta.crawledPages.length > 1
                    ? `Dari ${result.meta.crawledPages.length} halaman internal`
                    : `${result.meta.apiRequestsCount} Fetch/XHR`}
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-xs text-slate-400">API Error (4xx/5xx/Fail)</span>
                <span
                  className={`text-2xl font-bold mt-1 ${
                    result.meta.errorRequestsCount > 0 ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {result.meta.errorRequestsCount}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  {result.meta.errorRequestsCount > 0 ? "Perlu perhatian!" : "Semua 2xx/3xx"}
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-xs text-slate-400">Console & Crashes</span>
                <span
                  className={`text-2xl font-bold mt-1 ${
                    result.meta.consoleErrorsCount > 0 ? "text-amber-400" : "text-slate-300"
                  }`}
                >
                  {result.meta.consoleErrorsCount}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  {result.meta.pageErrorsCount} Uncaught crash
                </span>
              </div>

              <div className="col-span-2 md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-xs text-slate-400">Screenshot & Report</span>
                <div className="flex items-center gap-1.5 mt-2">
                  {result.meta.screenshot && (
                    <button
                      onClick={() => setShowScreenshot(true)}
                      className="text-xs flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 py-1.5 px-2.5 rounded-lg border border-slate-700 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Visual
                    </button>
                  )}
                  <Link
                    href={`/report/${result.id}`}
                    target="_blank"
                    className="text-xs flex items-center justify-center gap-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 py-1.5 px-2.5 rounded-lg border border-indigo-500/40 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Shareable
                  </Link>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 truncate" title={result.meta.finalUrl}>
                  {result.meta.finalUrl}
                </span>
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3">
              <span className="text-xs text-slate-400">
                Mode: <strong className="text-indigo-300">{result.meta.crawlMode === "multi" ? "Crawler Multi-Halaman" : "Halaman Tunggal"}</strong>
                {result.meta.crawledPages && result.meta.crawledPages.length > 1 && (
                  <span className="ml-1 text-slate-500">({result.meta.crawledPages.length} halaman dijelajahi)</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyMarkdownBugReport}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300 px-3 py-1.5 rounded-lg border border-slate-700 transition"
                >
                  {copiedBugReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedBugReport ? "Disalin ke Clipboard!" : "Salin Format Bug Dev (Markdown)"}
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 gap-4">
              {result.meta.crawledPages && result.meta.crawledPages.length > 1 && (
                <button
                  onClick={() => setActiveTab("crawled")}
                  className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
                    activeTab === "crawled"
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  Halaman Dijelajahi ({result.meta.crawledPages.length})
                </button>
              )}

              <button
                onClick={() => setActiveTab("diagnostics")}
                className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
                  activeTab === "diagnostics"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                Diagnosa & Analisis ({result.diagnostics.length})
              </button>

              <button
                onClick={() => setActiveTab("requests")}
                className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
                  activeTab === "requests"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Activity className="w-4 h-4" />
                Traffic Network & API ({result.requests.length})
              </button>

              <button
                onClick={() => setActiveTab("console")}
                className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
                  activeTab === "console"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Terminal className="w-4 h-4" />
                Console Logs ({result.consoleLogs.length})
              </button>
            </div>

            {/* TAB: CRAWLED PAGES (Multi-Page mode) */}
            {activeTab === "crawled" && result.meta.crawledPages && (
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
                        {result.meta.crawledPages.map((page, idx) => (
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
                {result.diagnostics.length === 0 ? (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center">
                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-white">Tidak Ditemukan Error Kritis</h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                      Semua request API dan skrip halaman berjalan normal tanpa HTTP 4xx/5xx atau runtime crash.
                    </p>
                  </div>
                ) : (
                  result.diagnostics.map((item, idx) => (
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
                          <span className="text-xs font-mono text-slate-400">
                            [{item.category}]
                          </span>
                          <h4 className="text-base font-semibold text-white">
                            {item.title}
                          </h4>
                        </div>
                        {item.status && (
                          <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-red-300">
                            Status: {item.status}
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

                      {/* Payload preview if available */}
                      {item.payload && (
                        <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-xs">
                          <span className="text-slate-400 font-semibold block mb-1">
                            Lemparan (Request Payload):
                          </span>
                          <pre className="font-mono text-slate-300 overflow-x-auto max-h-40">
                            {typeof item.payload === "string"
                              ? item.payload
                              : JSON.stringify(item.payload, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Response preview if available */}
                      {item.response && (
                        <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-xs">
                          <span className="text-slate-400 font-semibold block mb-1">
                            Balasan (Response Body):
                          </span>
                          <pre className="font-mono text-slate-300 overflow-x-auto max-h-40">
                            {typeof item.response === "string"
                              ? item.response
                              : JSON.stringify(item.response, null, 2)}
                          </pre>
                        </div>
                      )}

                      <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-lg p-3 text-xs text-indigo-200">
                        <span className="font-semibold text-indigo-300 block mb-0.5">
                          💡 Analisis Solusi / Rekomendasi:
                        </span>
                        {item.recommendation}
                      </div>

                      {/* Gemini AI Deep Diagnosis Card */}
                      {aiDiagnoses[idx] ? (
                        <div className="bg-slate-950 border border-indigo-500/40 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-xs">
                              <Bot className="w-4 h-4 text-indigo-400" />
                              <span>Diagnosa AI ({aiDiagnoses[idx].aiEngine})</span>
                            </div>
                            <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
                              Pihak Bermasalah: {aiDiagnoses[idx].sideFault} ({aiDiagnoses[idx].confidence}% Akurasi)
                            </span>
                          </div>

                          <div className="text-xs text-slate-200">
                            <strong>Penyebab Utama:</strong> {aiDiagnoses[idx].rootCause}
                          </div>

                          <div className="text-xs text-indigo-200">
                            <strong>Rekomendasi Teknisi:</strong> {aiDiagnoses[idx].recommendation}
                          </div>

                          {aiDiagnoses[idx].suggestedFixCode && (
                            <div>
                              <span className="text-[11px] font-bold text-slate-400 block mb-1">Rekomendasi Kode Perbaikan:</span>
                              <pre className="bg-slate-900 border border-slate-800 rounded p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                                {aiDiagnoses[idx].suggestedFixCode}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <button
                            onClick={() => requestAiDiagnosis(idx, item)}
                            disabled={loadingAiIdx === idx}
                            className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                          >
                            <Bot className={`w-3.5 h-3.5 ${loadingAiIdx === idx ? "animate-spin" : ""}`} />
                            {loadingAiIdx === idx ? "Sedang Dianalisis AI..." : "Tanya AI Gemini (Diagnosa Pintar & Kode Solusi)"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 2: REQUESTS TABLE */}
            {activeTab === "requests" && (
              <div className="space-y-4">
                {/* Search & Filter toolbar */}
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
                      Hanya Error ({result.meta.errorRequestsCount})
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
                      Semua ({result.requests.length})
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

                {/* Table */}
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
                          <th className="py-3 px-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {filteredRequests.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                              Tidak ada request yang cocok dengan filter.
                            </td>
                          </tr>
                        ) : (
                          filteredRequests.map((req, idx) => {
                            const isFail = req.isError;
                            return (
                              <tr
                                key={idx}
                                className={`hover:bg-slate-800/50 transition cursor-pointer ${
                                  isFail ? "bg-red-950/10" : ""
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
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getMethodBadgeClass(
                                      req.method
                                    )}`}
                                  >
                                    {req.method}
                                  </span>
                                </td>
                                <td className="py-3 px-4 max-w-md truncate text-slate-300">
                                  <span title={req.url}>{req.url}</span>
                                  {req.pageOriginUrl && (
                                    <span className="block text-[10px] text-slate-500 truncate mt-0.5">
                                      page: {req.pageOriginUrl}
                                    </span>
                                  )}
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
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CONSOLE LOGS */}
            {activeTab === "console" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 font-mono text-xs">
                {result.consoleLogs.length === 0 && result.pageErrors.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 font-sans">
                    Tidak ada log console atau error runtime.
                  </div>
                ) : (
                  <>
                    {/* Uncaught Page Errors */}
                    {result.pageErrors.map((err) => (
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

                    {/* Console Logs */}
                    {result.consoleLogs.map((log) => (
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
                          <span className="uppercase font-bold tracking-wider">
                            [{log.type}]
                          </span>
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
          </div>
        )}

        {/* Modal: Deep Request Inspection */}
        {selectedReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
              {/* Modal Header */}
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

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono">
                {/* URL */}
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-200 break-all select-all">
                  <span className="text-slate-500 mr-2 font-sans">Full URL:</span>
                  {selectedReq.url}
                </div>

                {/* Failure Reason */}
                {selectedReq.failed && (
                  <div className="bg-red-950/40 border border-red-800 p-3 rounded text-red-200 font-sans">
                    <span className="font-semibold block mb-0.5">Penyebab Kegagalan Network:</span>
                    {selectedReq.failureReason || "Koneksi terputus / diblokir"}
                  </div>
                )}

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
                          (Tidak ada body payload / Request GET)
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

              {/* Modal Footer */}
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

        {/* Modal: Screenshot Preview */}
        {showScreenshot && result?.meta.screenshot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-200">
                  Screenshot Halaman saat Di-inspect
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
                  src={result.meta.screenshot}
                  alt="Page screenshot"
                  className="max-h-[75vh] object-contain rounded border border-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* Drawer: History */}
        {showHistory && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <History className="w-4 h-4 text-indigo-400" />
                  <span>Riwayat Scan Tersimpan</span>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {loadingHistory ? (
                  <div className="text-center py-8 text-slate-400 text-xs">Memuat riwayat...</div>
                ) : historyList.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    Belum ada riwayat scan.
                  </div>
                ) : (
                  historyList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => loadPastScan(item.id)}
                      className="p-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 rounded-xl cursor-pointer transition space-y-1.5 group"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-[11px] text-indigo-400 truncate max-w-[200px]">
                          #{item.id}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">
                            {new Date(item.created_at).toLocaleDateString("id-ID", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <button
                            onClick={(e) => deletePastScan(e, item.id)}
                            className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-1"
                            title="Hapus riwayat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="font-mono text-xs text-slate-200 truncate" title={item.target_url}>
                        {item.target_url}
                      </div>

                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                          {item.total_requests} req
                        </span>
                        {item.error_requests > 0 ? (
                          <span className="bg-red-950/80 text-red-400 border border-red-800/60 px-1.5 py-0.5 rounded font-bold">
                            {item.error_requests} errors
                          </span>
                        ) : (
                          <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                            0 error
                          </span>
                        )}
                        {item.console_errors > 0 && (
                          <span className="bg-amber-950/80 text-amber-400 border border-amber-800/60 px-1.5 py-0.5 rounded">
                            {item.console_errors} console err
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        {/* Modal: Feedback & Pro Wishlist */}
        {showFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-bold text-sm text-white">Beri Masukan / Request Fitur</h3>
                </div>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {fbSuccess ? (
                <div className="p-6 text-center space-y-2">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h4 className="font-bold text-white text-sm">Terima Kasih atas Masukan Anda!</h4>
                  <p className="text-xs text-slate-400">Masukan Anda sangat berharga untuk pengembangan rilis publik berikutnya.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitFeedback} className="space-y-3 text-xs">
                  <p className="text-slate-400">
                    Bantu kami menyempurnakan tool ini. Tulis saran fitur, kritik bug, atau email Anda jika ingin diinfokan saat fitur Pro (Monitoring berkala & alert bot) rilis.
                  </p>

                  <div>
                    <label className="text-slate-300 block mb-1 font-medium">Email Anda (Opsional):</label>
                    <input
                      type="email"
                      placeholder="nama@perusahaan.com"
                      value={fbEmail}
                      onChange={(e) => setFbEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-medium">Pesan Masukan / Fitur yang Diinginkan: *</label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Contoh: Tolong tambahkan integrasi notifikasi ke Telegram atau export file HAR..."
                      value={fbMessage}
                      onChange={(e) => setFbMessage(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowFeedback(false)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2 rounded-lg font-medium transition"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={fbSubmitting || !fbMessage.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-1.5"
                    >
                      {fbSubmitting ? "Mengirim..." : "Kirim Masukan"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
        {/* Modal: User Auth (Login & Register) */}
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-base text-white">
                    {authTab === "login" ? "Masuk ke InspectLog" : "Daftar Akun Baru"}
                  </h3>
                </div>
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setAuthTab("login")}
                  className={`flex-1 py-2 font-medium border-b-2 transition ${
                    authTab === "login" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400"
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab("register")}
                  className={`flex-1 py-2 font-medium border-b-2 transition ${
                    authTab === "register" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400"
                  }`}
                >
                  Register
                </button>
              </div>

              {authError && (
                <div className="p-2.5 bg-red-950/60 border border-red-800 rounded-lg text-xs text-red-300">
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
                {authTab === "register" && (
                  <div>
                    <label className="text-slate-300 block mb-1 font-medium">Nama Lengkap *</label>
                    <input
                      type="text"
                      required
                      placeholder="Irul Developer"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="nama@email.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-xs transition shadow-md mt-2"
                >
                  {authSubmitting ? "Memproses..." : authTab === "login" ? "Masuk Sekarang" : "Buat Akun Gratis"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
