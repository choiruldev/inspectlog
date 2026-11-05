"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Check,
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
  ChevronRight,
  SlidersHorizontal,
  Code2,
  Download,
  Monitor,
  Smartphone,
} from "lucide-react";
import { convertRequestsToHAR, downloadHARFile } from "@/lib/har";

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
    device?: "desktop" | "mobile";
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
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [maxPages, setMaxPages] = useState(3);
  const [waitDuration, setWaitDuration] = useState(3000);
  const [authMode, setAuthMode] = useState<"none" | "cookies" | "headers" | "loginFlow">("none");
  const [rawCookies, setRawCookies] = useState("");
  const [rawHeaders, setRawHeaders] = useState('{\n  "Authorization": "Bearer eyJhbGciOiJIUzI1Ni... (Contoh token otentikasi JWT)",\n  "Content-Type": "application/json"\n}');
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

  // User Auth toggle (Set to true to re-enable Login & User Accounts, see PRO_MONETIZATION_GUIDE.md)
  const ENABLE_AUTH_SYSTEM = false;
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: "free" | "pro";
    avatar_url?: string | null;
  } | null>(null);
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

  // PWA Install state
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

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

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    if (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches) {
      setIsStandalone(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const outcome = await installPrompt.userChoice;
    if (outcome && outcome.outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  const loadPastScan = async (scanId: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/scans/${scanId}`);
      const data = await res.json();
      if (data.success && data.scan) {
        setResult(data.scan);
        setUrl(data.scan.meta.targetUrl || "");
        setCrawlMode(data.scan.meta.crawlMode || "single");
        setDevice(data.scan.meta.device || "desktop");
        setShowHistory(false);
        if (data.scan.meta.crawlMode === "multi" && data.scan.meta.crawledPages?.length > 1) {
          setActiveTab("crawled");
        } else if (data.scan.diagnostics?.length > 0) {
          setActiveTab("diagnostics");
        } else {
          setActiveTab("requests");
        }
      }
    } catch {
      setErrorMsg("Gagal memuat riwayat scan.");
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
          device,
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

  const exportHAR = () => {
    if (!result) return;
    const har = convertRequestsToHAR(result.meta, result.requests);
    downloadHARFile(`inspect-${result.id || "export"}.har`, har);
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
        return "text-sky-400 bg-sky-950/50 border-sky-900/60";
      case "POST":
        return "text-emerald-400 bg-emerald-950/50 border-emerald-900/60";
      case "PUT":
      case "PATCH":
        return "text-amber-400 bg-amber-950/50 border-amber-900/60";
      case "DELETE":
        return "text-rose-400 bg-rose-950/50 border-rose-900/60";
      default:
        return "text-zinc-400 bg-zinc-900 border-zinc-800";
    }
  };

  return (
    <main className="min-h-screen bg-[#090a0f] text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white">
      {/* Top Application Bar */}
      <nav className="border-b border-zinc-800/80 bg-[#090a0f]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20 group-hover:scale-110 transition"></span>
              <span className="font-semibold text-sm tracking-tight text-zinc-100 font-mono">InspectLog</span>
            </Link>
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
              v1.0
            </span>
            <span className="hidden lg:inline-block text-xs text-zinc-500">
              Web & API Network Runtime Inspector
            </span>
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-2">
            {/* Desktop Navigation Links */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => {
                  fetchHistory();
                  setShowHistory(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition"
              >
                <History className="w-3.5 h-3.5 text-zinc-400" />
                <span>Riwayat</span>
                <span className="text-[10px] text-zinc-400 font-mono">({historyList.length})</span>
              </button>

              <Link
                href="/monitoring"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition"
              >
                <Bell className="w-3.5 h-3.5 text-zinc-400" />
                <span>Monitor</span>
              </Link>

              <button
                onClick={() => setShowFeedback(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Feedback</span>
              </button>

              <div className="h-4 w-px bg-zinc-800"></div>
            </div>

            {/* User Account / Sign In Button (Guarded by ENABLE_AUTH_SYSTEM) */}
            {ENABLE_AUTH_SYSTEM && (
              currentUser ? (
                <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 pl-1.5 pr-2.5 py-1 rounded-lg text-xs">
                  {currentUser.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUser.avatar_url} alt={currentUser.name} className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono text-[10px] text-zinc-300">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium text-zinc-200 max-w-[90px] sm:max-w-[120px] truncate">{currentUser.name}</span>
                  <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                    {currentUser.role === "pro" ? "PRO" : "MEMBER"}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-zinc-500 hover:text-rose-400 p-0.5 transition ml-0.5"
                    title="Keluar"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAuthTab("login");
                    setShowAuthModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-500 shadow-sm transition active:scale-95"
                >
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Masuk</span>
                </button>
              )
            )}

            {/* Quick Export/Share Icons when result is present */}
            {result && (
              <div className="flex items-center gap-1 pl-1 border-l border-zinc-800 ml-1">
                <button
                  onClick={copyShareLink}
                  title="Salin tautan laporan"
                  className="p-1.5 rounded-md text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={exportHAR}
                  title="Unduh file .HAR 1.2"
                  className="p-1.5 rounded-md text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition font-mono text-[11px] flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline text-[10px]">HAR</span>
                </button>
                <button
                  onClick={exportReport}
                  title="Unduh JSON report"
                  className="p-1.5 rounded-md text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition font-mono text-[11px]"
                >
                  <FileJson className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Workspace Frame */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-8 space-y-6">
        {/* Terminal Input Station */}
        <section className="border border-zinc-800/80 bg-zinc-950/70 rounded-xl overflow-hidden shadow-sm">
          <form onSubmit={handleInspect} className="divide-y divide-zinc-800/80">
            {/* Primary Command Input Bar */}
            <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center">
              <div className="relative flex-1 flex items-center">
                <Globe className="absolute left-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="https://website-kamu.com/checkout atau endpoint API..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-[#0d0f17] border border-zinc-800 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 rounded-lg pl-10 pr-9 py-2.5 text-zinc-100 placeholder-zinc-500 font-mono text-xs sm:text-sm focus:outline-none transition"
                />
                {url && (
                  <button
                    type="button"
                    onClick={() => setUrl("")}
                    className="absolute right-3 text-zinc-500 hover:text-zinc-300 p-0.5"
                    title="Hapus URL"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Execution CTA */}
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-semibold px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm transition shadow-sm active:scale-95 shrink-0"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{crawlMode === "multi" ? "Menjelajah..." : "Memindai..."}</span>
                  </>
                ) : (
                  <>
                    <span>Periksa Website</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            {/* Quick Segmented Options Strip (Horizontal scrollable, touch-friendly, intuitive) */}
            <div className="px-3 py-2.5 sm:px-4 bg-[#0a0c13] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 overflow-x-auto text-xs">
              <div className="flex items-center gap-2 shrink-0">
                {/* Viewport / Layar */}
                <div className="flex items-center bg-[#0d0f17] border border-zinc-800 rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setDevice("desktop")}
                    className={`px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1.5 ${
                      device === "desktop"
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                    title="Mode Desktop (1440x900)"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDevice("mobile")}
                    className={`px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1.5 ${
                      device === "mobile"
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                    title="Mode Mobile (iPhone 390x844)"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                  </button>
                </div>

                {/* Scope / Cakupan */}
                <div className="flex items-center bg-[#0d0f17] border border-zinc-800 rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setCrawlMode("single")}
                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                      crawlMode === "single"
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    1 Halaman
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrawlMode("multi")}
                    className={`px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1.5 ${
                      crawlMode === "multi"
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Crawler</span>
                  </button>
                </div>

                {/* Crawler limit dropdown */}
                {crawlMode === "multi" && (
                  <div className="flex items-center bg-[#0d0f17] border border-zinc-800 rounded-lg px-2 py-1 text-xs">
                    <span className="text-zinc-500 mr-1.5 font-mono text-[11px]">Batas:</span>
                    <select
                      value={maxPages}
                      onChange={(e) => setMaxPages(Number(e.target.value))}
                      className="bg-transparent text-zinc-200 focus:outline-none font-mono text-xs cursor-pointer"
                    >
                      <option value={3} className="bg-zinc-900">3 Hal</option>
                      <option value={5} className="bg-zinc-900">5 Hal</option>
                      <option value={10} className="bg-zinc-900">10 Hal</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Auth / Credential toggle */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-zinc-500 hidden md:inline">Otentikasi:</span>
                <div className="flex items-center bg-[#0d0f17] border border-zinc-800 rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAuthMode("none")}
                    className={`px-2 py-1 rounded transition text-xs font-mono ${
                      authMode === "none"
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Publik
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("cookies")}
                    className={`px-2 py-1 rounded transition text-xs font-mono flex items-center gap-1 ${
                      authMode === "cookies"
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Cookie className="w-3 h-3 text-amber-400" />
                    <span>Cookies</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("headers")}
                    className={`px-2 py-1 rounded transition text-xs font-mono flex items-center gap-1 ${
                      authMode === "headers"
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Key className="w-3 h-3 text-sky-400" />
                    <span>Token</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("loginFlow")}
                    className={`px-2 py-1 rounded transition text-xs font-mono flex items-center gap-1 ${
                      authMode === "loginFlow"
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Layers className="w-3 h-3 text-purple-400" />
                    <span>Login Form</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Conditional Auth Form Drawer (only shown when not public) */}
            {authMode !== "none" && (
              <div className="p-3 sm:px-4 bg-[#0a0c13] border-t border-zinc-800/80 flex flex-col gap-2">
                <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    {authMode === "cookies" && "Pengaturan Custom Cookie"}
                    {authMode === "headers" && "Pengaturan Custom HTTP Headers / Bearer Token"}
                    {authMode === "loginFlow" && "Pengaturan Otomasi Form Login"}
                  </span>
                </div>

                {authMode === "cookies" && (
                  <textarea
                    rows={2}
                    placeholder="session_id=abcd1234ef; token=xyz..."
                    value={rawCookies}
                    onChange={(e) => setRawCookies(e.target.value)}
                    className="w-full bg-[#0d0f17] border border-zinc-800 rounded-md p-2.5 text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-600"
                  />
                )}

                {authMode === "headers" && (
                  <textarea
                    rows={3}
                    placeholder='{"Authorization": "Bearer ...", "X-Custom-Auth": "..."}'
                    value={rawHeaders}
                    onChange={(e) => setRawHeaders(e.target.value)}
                    className="w-full bg-[#0d0f17] border border-zinc-800 rounded-md p-2.5 text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-600"
                  />
                )}

                {authMode === "loginFlow" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Login page URL"
                      value={loginConfig.loginUrl}
                      onChange={(e) => setLoginConfig({ ...loginConfig, loginUrl: e.target.value })}
                      className="bg-[#0d0f17] border border-zinc-800 rounded-md p-2 text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-600"
                    />
                    <input
                      type="text"
                      placeholder="Username / Email"
                      value={loginConfig.username}
                      onChange={(e) => setLoginConfig({ ...loginConfig, username: e.target.value })}
                      className="bg-[#0d0f17] border border-zinc-800 rounded-md p-2 text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-600"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={loginConfig.password}
                      onChange={(e) => setLoginConfig({ ...loginConfig, password: e.target.value })}
                      className="bg-[#0d0f17] border border-zinc-800 rounded-md p-2 text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Quick Preset Chips */}
            <div className="p-3 sm:px-4 bg-[#0a0c13] border-t border-zinc-800/60 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] text-zinc-400 font-medium">Contoh Live Cepat:</span>
              <button
                type="button"
                onClick={() => {
                  setUrl("https://httpbin.org/status/500");
                  setAuthMode("none");
                  setCrawlMode("single");
                }}
                className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-mono text-[11px] transition inline-flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                <span>Error 500 (httpbin)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrl("https://httpbin.org/status/401");
                  setAuthMode("none");
                  setCrawlMode("single");
                }}
                className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-mono text-[11px] transition inline-flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>Error 401 (httpbin)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrl("https://jsonplaceholder.typicode.com");
                  setAuthMode("none");
                  setCrawlMode("multi");
                  setMaxPages(3);
                }}
                className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-mono text-[11px] transition inline-flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span>Crawler Multi-Page</span>
              </button>
              <span className="text-[10px] text-zinc-500 italic hidden sm:inline">
                (Klik untuk simulasi instan)
              </span>
            </div>
          </form>
        </section>

        {/* PWA Mobile Install Banner */}
        {installPrompt && !isStandalone && (
          <div className="bg-gradient-to-r from-sky-950/60 to-emerald-950/60 border border-sky-800/60 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/icon-192.png" alt="InspectLog" className="w-6 h-6 rounded" />
              </div>
              <div>
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span>Pasang Aplikasi InspectLog</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-900/60 text-sky-300 border border-sky-800">PWA</span>
                </div>
                <div className="text-[11px] text-zinc-400">Jalankan cepat di layar utama HP Anda tanpa buka browser berulang kali.</div>
              </div>
            </div>
            <button
              onClick={handleInstallApp}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold px-3.5 py-1.5 rounded-lg text-xs transition shrink-0 active:scale-95 shadow-sm"
            >
              Pasang App
            </button>
          </div>
        )}

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="border border-rose-900/80 bg-rose-950/20 text-rose-200 p-3.5 rounded-lg flex items-start gap-2.5 text-xs">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-300">Inspection Failure</div>
              <div className="text-zinc-300 mt-0.5 font-mono">{errorMsg}</div>
            </div>
          </div>
        )}

        {/* Showcase / Panduan Contoh Pengujian (When no inspection active) */}
        {!result && !loading && (
          <section className="border border-zinc-800/80 bg-[#0c0e14] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  <span>Panduan & Contoh Skenario Uji Coba Langsung (Live Sandbox)</span>
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  InspectLog menganalisis lalu lintas HTTP riil. Klik salah satu contoh di bawah ini untuk melihat simulasi hasil inspeksi lengkap tanpa perlu mengetik URL.
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 shrink-0 self-start sm:self-auto">
                Status: Siap Uji Coba
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: 500 Server Error */}
              <div className="bg-[#090a0f] border border-zinc-800 hover:border-zinc-700 rounded-lg p-3.5 flex flex-col justify-between space-y-3 transition">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-900/60 uppercase">
                      HTTP 500 Internal Error
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">httpbin.org</span>
                  </div>
                  <h4 className="text-xs font-semibold text-zinc-200">Simulasi Kerusakan Server</h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Melihat bagaimana InspectLog mendeteksi error HTTP 500, membaca respons gagal dari server, dan memberikan diagnosa penyebab kerusakan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUrl("https://httpbin.org/status/500");
                    setAuthMode("none");
                    setCrawlMode("single");
                  }}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 rounded py-1.5 text-xs font-medium transition flex items-center justify-center gap-1.5"
                >
                  <span>Pilih Contoh 500 Ini</span>
                  <ArrowRight className="w-3 h-3 text-zinc-400" />
                </button>
              </div>

              {/* Card 2: 401 Unauthorized */}
              <div className="bg-[#090a0f] border border-zinc-800 hover:border-zinc-700 rounded-lg p-3.5 flex flex-col justify-between space-y-3 transition">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-900/60 uppercase">
                      HTTP 401 Unauthorized
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">httpbin.org</span>
                  </div>
                  <h4 className="text-xs font-semibold text-zinc-200">Simulasi Gagal Otentikasi</h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Melihat deteksi endpoint terlindungi yang menolak akses karena ketiadaan token otentikasi atau session cookie yang sah.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUrl("https://httpbin.org/status/401");
                    setAuthMode("none");
                    setCrawlMode("single");
                  }}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 rounded py-1.5 text-xs font-medium transition flex items-center justify-center gap-1.5"
                >
                  <span>Pilih Contoh 401 Ini</span>
                  <ArrowRight className="w-3 h-3 text-zinc-400" />
                </button>
              </div>

              {/* Card 3: Multi-Page Crawler */}
              <div className="bg-[#090a0f] border border-zinc-800 hover:border-zinc-700 rounded-lg p-3.5 flex flex-col justify-between space-y-3 transition">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-900/60 uppercase">
                      Multi-Page Crawler
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">jsonplaceholder</span>
                  </div>
                  <h4 className="text-xs font-semibold text-zinc-200">Simulasi Jelajah Sub-Halaman</h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Menelusuri link halaman internal secara otomatis untuk memindai seluruh request backend, AJAX fetch, dan script error antar halaman.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUrl("https://jsonplaceholder.typicode.com");
                    setAuthMode("none");
                    setCrawlMode("multi");
                    setMaxPages(3);
                  }}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 rounded py-1.5 text-xs font-medium transition flex items-center justify-center gap-1.5"
                >
                  <span>Pilih Contoh Crawler</span>
                  <ArrowRight className="w-3 h-3 text-zinc-400" />
                </button>
              </div>
            </div>

            {/* Note on past history if available */}
            {historyList.length > 0 && (
              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
                <span className="text-[11px]">
                  💡 Tersedia <strong>{historyList.length} riwayat hasil inspeksi tersimpan</strong> dari sesi pengujian sebelumnya.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    fetchHistory();
                    setShowHistory(true);
                  }}
                  className="text-zinc-300 hover:text-white underline text-[11px] font-medium"
                >
                  Buka Daftar Riwayat ({historyList.length}) →
                </button>
              </div>
            )}
          </section>
        )}

        {/* Results Deck */}
        {result && (
          <section className="space-y-4">
            {/* Live Test Notice Banner if sample URL */}
            {(result.meta.targetUrl.includes("httpbin.org") || result.meta.targetUrl.includes("jsonplaceholder")) && (
              <div className="bg-[#0c0e14] border border-sky-900/50 rounded-lg px-3.5 py-2.5 text-xs flex items-center justify-between gap-3 text-sky-200">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                  <span className="text-[11px]">
                    <strong>Target Contoh Pengujian Live:</strong> Hasil di bawah ini merupakan respon nyata dari server simulasi <code>{result.meta.targetUrl}</code>. Anda dapat menguji website atau API Anda sendiri kapan saja dengan mengganti URL di atas.
                  </span>
                </div>
              </div>
            )}
            {/* Horizontal Metric Strip (Anti-Slop: clean 1px border division, quiet semantic colors) */}
            <div className="border border-zinc-800/80 bg-[#0c0e14] rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/80 grid grid-cols-2 sm:grid-cols-5 text-left">
              {/* Score */}
              <div className="p-3.5 space-y-1">
                <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider block">Health Score</span>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-2xl font-semibold tracking-tight font-mono ${
                      result.meta.healthScore >= 80
                        ? "text-emerald-400"
                        : result.meta.healthScore >= 50
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {result.meta.healthScore}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">/100</span>
                </div>
                <div className="text-[10px] text-zinc-400">
                  {result.meta.healthScore >= 80 ? "Nominal status" : "Action required"}
                </div>
              </div>

              {/* Total Requests */}
              <div className="p-3.5 space-y-1">
                <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider block">Network Requests</span>
                <div className="text-2xl font-semibold tracking-tight font-mono text-zinc-100">
                  {result.meta.totalRequestsCount}
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                  {result.meta.apiRequestsCount} Fetch/XHR
                </div>
              </div>

              {/* Failed / Error APIs */}
              <div className="p-3.5 space-y-1">
                <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider block">Failed / 4xx / 5xx</span>
                <div
                  className={`text-2xl font-semibold tracking-tight font-mono ${
                    result.meta.errorRequestsCount > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {result.meta.errorRequestsCount}
                </div>
                <div className="text-[10px] text-zinc-400">
                  {result.meta.errorRequestsCount > 0 ? "Detected anomalies" : "Zero HTTP errors"}
                </div>
              </div>

              {/* Console & Crashes */}
              <div className="p-3.5 space-y-1">
                <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider block">Console / Crashes</span>
                <div
                  className={`text-2xl font-semibold tracking-tight font-mono ${
                    result.meta.consoleErrorsCount > 0 || result.meta.pageErrorsCount > 0
                      ? "text-amber-400"
                      : "text-zinc-300"
                  }`}
                >
                  {result.meta.consoleErrorsCount + result.meta.pageErrorsCount}
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                  {result.meta.pageErrorsCount} uncaught crashes
                </div>
              </div>

              {/* Target & Quick Actions */}
              <div className="p-3.5 space-y-1 col-span-2 sm:col-span-1">
                <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider block">Target & Report</span>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {result.meta.screenshot && (
                    <button
                      onClick={() => setShowScreenshot(true)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[11px] text-zinc-300 transition"
                    >
                      <Eye className="w-3 h-3 text-zinc-400" />
                      Visual
                    </button>
                  )}
                  <Link
                    href={`/report/${result.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[11px] text-zinc-300 transition"
                  >
                    <ExternalLink className="w-3 h-3 text-zinc-400" />
                    Report
                  </Link>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono truncate" title={result.meta.finalUrl}>
                  {(result.meta.navigationTimeMs / 1000).toFixed(2)}s load time
                </div>
              </div>
            </div>

            {/* Sub-header Toolbar & Export Bug Dev Format */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="text-xs text-zinc-400 flex items-center gap-2">
                <span className="font-mono text-zinc-500">target:</span>
                <span className="font-mono text-zinc-200 truncate max-w-sm sm:max-w-md">{result.meta.finalUrl}</span>
                {result.meta.crawlMode === "multi" && result.meta.crawledPages && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 font-mono">
                    {result.meta.crawledPages.length} pages
                  </span>
                )}
                {result.meta.device && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 font-mono inline-flex items-center gap-1">
                    {result.meta.device === "mobile" ? (
                      <>
                        <Smartphone className="w-3 h-3 text-sky-400" />
                        <span>Mobile (390px)</span>
                      </>
                    ) : (
                      <>
                        <Monitor className="w-3 h-3 text-zinc-400" />
                        <span>Desktop (1440px)</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportHAR}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition"
                  title="Download HAR 1.2 file for Chrome DevTools / Postman / Charles"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Export .HAR</span>
                </button>
                <button
                  onClick={copyMarkdownBugReport}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition"
                >
                  {copiedBugReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                  <span>{copiedBugReport ? "Copied" : "Copy Bug Format (Markdown)"}</span>
                </button>
              </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="border-b border-zinc-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 sm:gap-2">
                {result.meta.crawledPages && result.meta.crawledPages.length > 1 && (
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
                    <span className="font-mono text-[10px] text-zinc-400">({result.meta.crawledPages.length})</span>
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
                  <span className="font-mono text-[10px] text-zinc-400">({result.diagnostics.length})</span>
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
                  <span>Network Traffic</span>
                  <span className="font-mono text-[10px] text-zinc-400">({result.requests.length})</span>
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
                  <span>Console & Runtime</span>
                  <span className="font-mono text-[10px] text-zinc-400">({result.consoleLogs.length + result.pageErrors.length})</span>
                </button>
              </div>
            </div>

            {/* TAB: CRAWLER PAGES */}
            {activeTab === "crawled" && result.meta.crawledPages && (
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
                        <th className="py-2.5 px-3 text-right font-sans w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {result.meta.crawledPages.map((page, idx) => (
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
                          <td className="py-2.5 px-3 text-right font-sans">
                            <button
                              onClick={() => {
                                setSearchTerm(page.url);
                                setActiveTab("requests");
                              }}
                              className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 transition"
                            >
                              Filter
                            </button>
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
                {result.diagnostics.length === 0 ? (
                  <div className="border border-zinc-800 bg-[#0c0e14] rounded-lg p-8 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <h3 className="text-sm font-semibold text-zinc-200">No Critical Anomalies Found</h3>
                    <p className="text-xs text-zinc-500 max-w-md mx-auto">
                      All inspected API requests and page execution scripts ran normally without 4xx/5xx status codes or runtime exceptions.
                    </p>
                  </div>
                ) : (
                  result.diagnostics.map((item, idx) => (
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
                      {/* Diagnostic Header */}
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

                      {/* Endpoint */}
                      {item.endpoint && (
                        <div className="bg-[#090a0f] p-2 rounded border border-zinc-800/80 font-mono text-xs text-zinc-300 break-all select-all flex items-center justify-between gap-2">
                          <div>
                            <span className="text-zinc-500 mr-2">endpoint:</span>
                            {item.endpoint}
                          </div>
                        </div>
                      )}

                      {/* Details text */}
                      <p className="text-xs text-zinc-300 leading-relaxed font-sans">{item.details}</p>

                      {/* Payload preview if available */}
                      {item.payload && (
                        <div className="bg-[#090a0f] rounded border border-zinc-800/80 p-2.5 text-xs font-mono">
                          <span className="text-[11px] text-zinc-500 font-sans block mb-1">
                            Lemparan (Request Payload):
                          </span>
                          <pre className="text-zinc-300 overflow-x-auto max-h-36 text-[11px]">
                            {typeof item.payload === "string"
                              ? item.payload
                              : JSON.stringify(item.payload, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Response preview if available */}
                      {item.response && (
                        <div className="bg-[#090a0f] rounded border border-zinc-800/80 p-2.5 text-xs font-mono">
                          <span className="text-[11px] text-zinc-500 font-sans block mb-1">
                            Balasan (Response Body):
                          </span>
                          <pre className="text-zinc-300 overflow-x-auto max-h-36 text-[11px]">
                            {typeof item.response === "string"
                              ? item.response
                              : JSON.stringify(item.response, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Recommendation block */}
                      <div className="bg-zinc-900/60 border border-zinc-800 rounded p-2.5 text-xs text-zinc-300">
                        <span className="text-[11px] text-zinc-400 font-medium block mb-0.5">
                          💡 Solusi / Tindakan Perbaikan:
                        </span>
                        {item.recommendation}
                      </div>

                      {/* Gemini AI Diagnosis Card */}
                      {aiDiagnoses[idx] ? (
                        <div className="bg-[#090a0f] border border-zinc-700/80 rounded-lg p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                            <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-200">
                              <Bot className="w-3.5 h-3.5 text-zinc-400" />
                              <span>Gemini Diagnosis ({aiDiagnoses[idx].aiEngine})</span>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                              Fault: {aiDiagnoses[idx].sideFault} ({aiDiagnoses[idx].confidence}% conf)
                            </span>
                          </div>

                          <div className="text-xs text-zinc-300">
                            <span className="font-semibold text-zinc-200">Root Cause:</span> {aiDiagnoses[idx].rootCause}
                          </div>

                          <div className="text-xs text-zinc-400">
                            <span className="font-semibold text-zinc-300">Technical Advice:</span> {aiDiagnoses[idx].recommendation}
                          </div>

                          {aiDiagnoses[idx].suggestedFixCode && (
                            <div>
                              <span className="text-[10px] font-mono text-zinc-500 block mb-1">Suggested Code Fix:</span>
                              <pre className="bg-[#0d0f17] border border-zinc-800 rounded p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                                {aiDiagnoses[idx].suggestedFixCode}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => requestAiDiagnosis(idx, item)}
                            disabled={loadingAiIdx === idx}
                            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1.5"
                          >
                            <Bot className={`w-3.5 h-3.5 ${loadingAiIdx === idx ? "animate-spin" : "text-zinc-400"}`} />
                            {loadingAiIdx === idx ? "Analyzing with Gemini..." : "Ask Gemini AI (Root Cause & Fix Code)"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: REQUESTS TABLE */}
            {activeTab === "requests" && (
              <div className="space-y-3">
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                  <div className="flex items-center gap-1 bg-[#0c0e14] border border-zinc-800 p-0.5 rounded-lg text-xs">
                    <button
                      onClick={() => setReqFilter("errors")}
                      className={`px-2.5 py-1 rounded-md transition ${
                        reqFilter === "errors"
                          ? "bg-zinc-800 text-rose-300 font-medium"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Errors Only ({result.meta.errorRequestsCount})
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
                      All ({result.requests.length})
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

                {/* Table */}
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
                          <th className="py-2.5 px-3 w-16 text-right font-sans">Inspect</th>
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
                          filteredRequests.map((req, idx) => {
                            const isFail = req.isError;
                            return (
                              <tr
                                key={idx}
                                onClick={() => {
                                  setSelectedReq(req);
                                  setDetailTab(req.requestPayload ? "payload" : "response");
                                }}
                                className={`hover:bg-zinc-800/40 transition cursor-pointer ${
                                  isFail ? "bg-rose-950/10" : ""
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
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getMethodBadgeClass(
                                      req.method
                                    )}`}
                                  >
                                    {req.method}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 max-w-md truncate text-zinc-300" title={req.url}>
                                  <span className="text-zinc-200">{req.url}</span>
                                  {req.pageOriginUrl && (
                                    <span className="block text-[10px] text-zinc-500 truncate">
                                      from: {req.pageOriginUrl}
                                    </span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-zinc-400">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                                    {req.resourceType}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-right text-zinc-400 font-mono">
                                  {req.durationMs !== null ? `${req.durationMs}ms` : "-"}
                                </td>

                                <td className="py-2.5 px-3 text-right font-sans">
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
                            );
                          })
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
                {result.consoleLogs.length === 0 && result.pageErrors.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 font-sans">
                    No console logs or uncaught runtime exceptions recorded.
                  </div>
                ) : (
                  <>
                    {/* Uncaught Errors */}
                    {result.pageErrors.map((err) => (
                      <div
                        key={err.id}
                        className="bg-rose-950/20 border border-rose-900/60 rounded p-3 text-rose-200 space-y-1"
                      >
                        <div className="flex items-center gap-1.5 font-bold text-rose-400 text-xs">
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

                    {/* Console Logs */}
                    {result.consoleLogs.map((log) => (
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
          </section>
        )}

        {/* Modal: Deep Request Inspector (Clean Developer Split Drawer) */}
        {selectedReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0c0e14] border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
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

              {/* Subtabs for Detail */}
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

              {/* Body */}
              <div className="p-4 overflow-y-auto space-y-3 text-xs font-mono">
                {/* Full URL */}
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

                {/* Subtab: Payload */}
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
                        <span className="text-zinc-500 font-sans text-xs">
                          ℹ️ Tidak ada body payload pada request ini (metode HTTP GET mengirimkan parameter langsung via URL).
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Subtab: Response */}
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
                        <span className="text-zinc-500 font-sans text-xs">
                          ℹ️ Respon server kosong (HTTP 204/304) atau berupa berkas streaming/biner (gambar/font).
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Subtab: Params */}
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
                        <span className="text-zinc-500 font-sans text-xs">
                          ℹ️ URL endpoint ini tidak menyertakan query parameter tambahan (seperti ?sort=asc&page=1).
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Subtab: Headers */}
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

              {/* Footer */}
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

        {/* Modal: Screenshot Preview */}
        {showScreenshot && result?.meta.screenshot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
                  src={result.meta.screenshot}
                  alt="Page screenshot"
                  className="max-h-[75vh] object-contain rounded border border-zinc-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* Drawer: History */}
        {showHistory && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
            <div className="bg-[#0c0e14] border-l border-zinc-800 w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
              <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-xs text-zinc-200 font-mono">
                  <History className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Recorded Scan History</span>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loadingHistory ? (
                  <div className="text-center py-8 text-zinc-500 text-xs font-mono">Loading history...</div>
                ) : historyList.length === 0 ? (
                  <div className="text-center py-12 text-zinc-600 text-xs">
                    No scan records saved.
                  </div>
                ) : (
                  historyList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => loadPastScan(item.id)}
                      className="p-2.5 bg-[#090a0f] hover:bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 rounded-lg cursor-pointer transition space-y-1 group"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-[10px] text-zinc-400 truncate max-w-[180px]">
                          #{item.id}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {new Date(item.created_at).toLocaleDateString("id-ID", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <button
                            onClick={(e) => deletePastScan(e, item.id)}
                            className="text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition p-0.5"
                            title="Delete scan"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="font-mono text-xs text-zinc-200 truncate" title={item.target_url}>
                        {item.target_url}
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span className="bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-800">
                          {item.total_requests} req
                        </span>
                        {item.error_requests > 0 ? (
                          <span className="bg-rose-950 text-rose-400 border border-rose-900/60 px-1.5 py-0.5 rounded font-bold">
                            {item.error_requests} err
                          </span>
                        ) : (
                          <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-900/40 px-1.5 py-0.5 rounded">
                            0 err
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

        {/* Modal: Feedback */}
        {showFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0c0e14] border border-zinc-800 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                  <h3 className="font-semibold text-xs text-zinc-100">Send Beta Feedback</h3>
                </div>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {fbSuccess ? (
                <div className="p-6 text-center space-y-1.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h4 className="font-semibold text-zinc-100 text-xs">Feedback Received</h4>
                  <p className="text-[11px] text-zinc-500">Thank you for shaping the next developer release.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitFeedback} className="space-y-3 text-xs">
                  <div>
                    <label className="text-zinc-400 block mb-1 font-medium">Your Email (Optional):</label>
                    <input
                      type="email"
                      placeholder="dev@company.com"
                      value={fbEmail}
                      onChange={(e) => setFbEmail(e.target.value)}
                      className="w-full bg-[#090a0f] border border-zinc-800 rounded-md p-2 text-zinc-200 focus:outline-none focus:border-zinc-600 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1 font-medium">Feedback / Feature Request: *</label>
                    <textarea
                      rows={4}
                      required
                      placeholder="e.g. Export HAR file, integrate Slack webhook alerts, or filter by response latency..."
                      value={fbMessage}
                      onChange={(e) => setFbMessage(e.target.value)}
                      className="w-full bg-[#090a0f] border border-zinc-800 rounded-md p-2 text-zinc-200 focus:outline-none focus:border-zinc-600 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setShowFeedback(false)}
                      className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded text-xs transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={fbSubmitting || !fbMessage.trim()}
                      className="bg-zinc-100 hover:bg-white text-zinc-950 font-medium px-3.5 py-1.5 rounded text-xs transition border border-zinc-200 disabled:opacity-50"
                    >
                      {fbSubmitting ? "Sending..." : "Submit Feedback"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Modal: User Auth (Guarded by ENABLE_AUTH_SYSTEM, see PRO_MONETIZATION_GUIDE.md) */}
        {ENABLE_AUTH_SYSTEM && showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#0c0e14] border border-zinc-800 rounded-xl w-full max-w-sm p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <div>
                  <h3 className="font-semibold text-sm text-zinc-100 font-mono">
                    {authTab === "login" ? "Masuk ke InspectLog" : "Buat Akun Baru"}
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {authTab === "login"
                      ? "Akses riwayat inspeksi permanen & probe monitoring otomatis."
                      : "Simpan riwayat debug dan konfigurasi alert Telegram/Discord."}
                  </p>
                </div>
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1-Click Google Sign-in Button */}
              <a
                href="/api/auth/google"
                className="w-full bg-[#11131c] hover:bg-[#181b28] text-zinc-200 hover:text-white font-medium py-2.5 px-3 rounded-lg text-xs transition flex items-center justify-center gap-2.5 border border-zinc-800 hover:border-zinc-700 shadow-sm active:scale-95"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Lanjutkan dengan Google</span>
              </a>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-zinc-800 w-full"></div>
                <span className="bg-[#0c0e14] px-2 text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                  atau email
                </span>
                <div className="border-t border-zinc-800 w-full"></div>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-[#090a0f] p-0.5 rounded-lg border border-zinc-800 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setAuthTab("login")}
                  className={`flex-1 py-1.5 rounded-md transition font-medium ${
                    authTab === "login" ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab("register")}
                  className={`flex-1 py-1.5 rounded-md transition font-medium ${
                    authTab === "register" ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Daftar Akun
                </button>
              </div>

              {authError && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-900/60 rounded-lg text-xs text-rose-300 font-mono">
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
                {authTab === "register" && (
                  <div>
                    <label className="text-zinc-400 block mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      placeholder="Irul Developer"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full bg-[#090a0f] border border-zinc-800 focus:border-emerald-500/80 rounded-lg p-2.5 text-zinc-200 focus:outline-none transition"
                    />
                  </div>
                )}

                <div>
                  <label className="text-zinc-400 block mb-1">Alamat Email</label>
                  <input
                    type="email"
                    required
                    placeholder="kamu@perusahaan.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-[#090a0f] border border-zinc-800 focus:border-emerald-500/80 rounded-lg p-2.5 text-zinc-200 focus:outline-none font-mono transition"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Kata Sandi</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-[#090a0f] border border-zinc-800 focus:border-emerald-500/80 rounded-lg p-2.5 text-zinc-200 focus:outline-none font-mono transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold py-2.5 rounded-lg text-xs transition shadow-sm mt-2 flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95"
                >
                  {authSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : authTab === "login" ? (
                    "Masuk ke Akun"
                  ) : (
                    "Buat Akun Sekarang"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Ergonomic Bottom Navigation Bar (PWA Experience) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090a0f]/95 backdrop-blur-md border-t border-zinc-800/80 px-4 py-2 flex items-center justify-around text-[10px] safe-area-pb">
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex flex-col items-center gap-1 text-zinc-300 hover:text-white"
        >
          <Search className="w-4 h-4 text-emerald-400" />
          <span>Periksa</span>
        </button>

        <button
          onClick={() => {
            fetchHistory();
            setShowHistory(true);
          }}
          className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white relative"
        >
          <History className="w-4 h-4" />
          <span>Riwayat</span>
          {historyList.length > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-zinc-800 border border-zinc-700 text-[8px] font-mono flex items-center justify-center text-zinc-300">
              {historyList.length}
            </span>
          )}
        </button>

        <Link
          href="/monitoring"
          className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white relative"
        >
          <Bell className="w-4 h-4" />
          <span>Monitor</span>
        </Link>

        {ENABLE_AUTH_SYSTEM && (
          currentUser ? (
            <button
              onClick={handleLogout}
              className="flex flex-col items-center gap-1 text-zinc-400 hover:text-rose-400"
              title="Keluar akun"
            >
              <LogOut className="w-4 h-4" />
              <span className="truncate max-w-[50px]">{currentUser.name.split(" ")[0]}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setAuthTab("login");
                setShowAuthModal(true);
              }}
              className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white"
            >
              <User className="w-4 h-4" />
              <span>Masuk</span>
            </button>
          )
        )}
      </nav>
    </main>
  );
}
