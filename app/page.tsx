"use client";

import { useState } from "react";
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
} from "lucide-react";

interface RequestItem {
  id: string;
  url: string;
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

interface InspectResult {
  meta: {
    targetUrl: string;
    finalUrl: string;
    pageTitle: string;
    navigationTimeMs: number;
    totalRequestsCount: number;
    apiRequestsCount: number;
    errorRequestsCount: number;
    consoleErrorsCount: number;
    pageErrorsCount: number;
    screenshot: string | null;
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

export default function Home() {
  const [url, setUrl] = useState("");
  const [waitDuration, setWaitDuration] = useState(4000);
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
  const [activeTab, setActiveTab] = useState<"diagnostics" | "requests" | "console">("diagnostics");
  const [reqFilter, setReqFilter] = useState<"all" | "errors" | "api">("errors");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReq, setSelectedReq] = useState<RequestItem | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);

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
      if (data.diagnostics?.length > 0) {
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

  const exportReport = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `inspect-report-${Date.now()}.json`;
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
      return matchUrl || matchMethod || matchStatus;
    }
    return true;
  });

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
              Deep inspection: pantau lemparan (payload), balasan (response), status code, dan console runtime error.
            </p>
          </div>
          {result && (
            <button
              onClick={exportReport}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium border border-slate-700 transition"
            >
              <FileJson className="w-4 h-4 text-indigo-400" />
              Export JSON Report
            </button>
          )}
        </header>

        {/* Input Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <form onSubmit={handleInspect} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="https://example.com/checkout atau https://my-app.internal/dashboard"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
              </div>

              <div className="w-full sm:w-44 flex items-center bg-slate-950 border border-slate-700 rounded-lg px-3">
                <span className="text-xs text-slate-400 mr-2">Wait:</span>
                <select
                  value={waitDuration}
                  onChange={(e) => setWaitDuration(Number(e.target.value))}
                  className="bg-transparent text-sm text-slate-200 focus:outline-none w-full py-3"
                >
                  <option value={2000}>2 detik</option>
                  <option value={4000}>4 detik (standar)</option>
                  <option value={8000}>8 detik (SPA/Ajax)</option>
                  <option value={12000}>12 detik (Lambat)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 text-white font-medium px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition min-w-[140px]"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Inspecting...</span>
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
                    Masukkan Cookies (Bisa format string <code>session_id=abc; token=123</code> atau format JSON cookie export):
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
            <span>Contoh uji cepat:</span>
            <button
              onClick={() => {
                setUrl("https://httpbin.org/status/500");
                setAuthMode("none");
              }}
              className="text-slate-400 hover:text-indigo-400 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700"
            >
              Test API 500
            </button>
            <button
              onClick={() => {
                setUrl("https://httpbin.org/status/401");
                setAuthMode("none");
              }}
              className="text-slate-400 hover:text-indigo-400 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700"
            >
              Test 401 Unauthorized
            </button>
            <button
              onClick={() => {
                setUrl("https://jsonplaceholder.typicode.com");
                setAuthMode("none");
              }}
              className="text-slate-400 hover:text-indigo-400 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700"
            >
              Test Normal Site
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
                <span className="text-xs text-slate-400">Total Requests</span>
                <span className="text-2xl font-bold text-white mt-1">
                  {result.meta.totalRequestsCount}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  {result.meta.apiRequestsCount} Fetch/XHR
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
                <span className="text-xs text-slate-400">Console Errors</span>
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

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-xs text-slate-400">Navigation Time</span>
                <span className="text-2xl font-bold text-slate-200 mt-1">
                  {(result.meta.navigationTimeMs / 1000).toFixed(2)}s
                </span>
                <span className="text-[11px] text-slate-500 mt-1 truncate" title={result.meta.pageTitle}>
                  {result.meta.pageTitle || "No title"}
                </span>
              </div>

              <div className="col-span-2 md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-xs text-slate-400">Page Screenshot</span>
                {result.meta.screenshot ? (
                  <button
                    onClick={() => setShowScreenshot(true)}
                    className="mt-2 text-xs flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 py-1.5 px-3 rounded-lg border border-slate-700 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Lihat Tampilan
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 mt-2">Tidak tersedia</span>
                )}
                <span className="text-[10px] text-slate-500 mt-1 truncate" title={result.meta.finalUrl}>
                  {result.meta.finalUrl}
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 gap-4">
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

            {/* TAB 1: DIAGNOSTICS */}
            {activeTab === "diagnostics" && (
              <div className="space-y-4">
                {result.diagnostics.length === 0 ? (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center">
                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-white">Tidak Ditemukan Error Kritis</h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                      Semua request API dan eksekusi skrip halaman berjalan normal tanpa HTTP 4xx/5xx atau uncaught exception.
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
                            <td colSpan={6} className="py-8 text-center text-slate-500">
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
                                onClick={() => setSelectedReq(req)}
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
                                <td className="py-3 px-4 font-bold text-slate-300">
                                  {req.method}
                                </td>
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
                                    }}
                                    className="bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2.5 py-1 rounded text-[11px] font-sans transition"
                                  >
                                    Detail Payload
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

        {/* Modal: Request Detail (Lemparan & Balasan) */}
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

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-5 text-xs font-mono">
                {/* URL */}
                <div>
                  <span className="text-slate-400 font-sans font-semibold block mb-1">
                    URL Endpoint:
                  </span>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-200 break-all select-all">
                    {selectedReq.url}
                  </div>
                </div>

                {/* Failure Reason if failed */}
                {selectedReq.failed && (
                  <div className="bg-red-950/40 border border-red-800 p-3 rounded text-red-200 font-sans">
                    <span className="font-semibold block mb-0.5">Penyebab Kegagalan Network:</span>
                    {selectedReq.failureReason || "Koneksi terputus / diblokir"}
                  </div>
                )}

                {/* Grid for Lemparan (Request) vs Balasan (Response) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Request Payload / Lemparan */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-sans">
                      <span className="font-semibold text-slate-300">
                        Lemparan (Request Payload):
                      </span>
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
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-72 overflow-y-auto">
                      {selectedReq.requestPayload ? (
                        <pre className="text-slate-300 text-[11px] whitespace-pre-wrap break-all">
                          {typeof selectedReq.requestPayload === "string"
                            ? selectedReq.requestPayload
                            : JSON.stringify(selectedReq.requestPayload, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-slate-600 font-sans">
                          (Tidak ada body payload / GET request)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Response Body / Balasan */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-sans">
                      <span className="font-semibold text-slate-300">
                        Balasan (Response Body):
                      </span>
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
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-72 overflow-y-auto">
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
                </div>

                {/* Collapsible Headers */}
                <details className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <summary className="cursor-pointer text-slate-400 font-sans font-medium text-xs">
                    Tampilkan Request & Response Headers
                  </summary>
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
                    <div>
                      <span className="text-slate-500 font-sans text-[11px] block mb-1">
                        Request Headers:
                      </span>
                      <pre className="text-[11px] text-slate-400 overflow-x-auto">
                        {JSON.stringify(selectedReq.requestHeaders, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <span className="text-slate-500 font-sans text-[11px] block mb-1">
                        Response Headers:
                      </span>
                      <pre className="text-[11px] text-slate-400 overflow-x-auto">
                        {JSON.stringify(selectedReq.responseHeaders, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
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
      </div>
    </main>
  );
}
