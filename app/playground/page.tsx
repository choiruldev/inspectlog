"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bug,
  CheckCircle,
  Clock,
  ExternalLink,
  Flame,
  Globe,
  Lock,
  Play,
  RotateCcw,
  ShieldAlert,
  Terminal,
  Zap,
} from "lucide-react";

interface BugLog {
  id: string;
  timestamp: string;
  type: string;
  status: "pending" | "success" | "error";
  details: string;
}

export default function BugPlaygroundPage() {
  const [logs, setLogs] = useState<BugLog[]>([]);
  const [activeRunning, setActiveRunning] = useState<string | null>(null);
  const [autoRan, setAutoRan] = useState(false);

  const addLog = (type: string, status: "pending" | "success" | "error", details: string) => {
    setLogs((prev) => [
      {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString(),
        type,
        status,
        details,
      },
      ...prev,
    ]);
  };

  // 1. Bug: 500 Internal Server Error
  const trigger500Error = async () => {
    setActiveRunning("500");
    addLog("API 500", "pending", "Memanggil /api/test-bugs?type=500 ...");
    try {
      const res = await fetch("/api/test-bugs?type=500");
      const data = await res.json();
      addLog("API 500", "error", `HTTP 500: ${data.error || "Server Crash"}`);
    } catch (e: any) {
      addLog("API 500", "error", `Network Error: ${e.message}`);
    } finally {
      setActiveRunning(null);
    }
  };

  // 2. Bug: 422 Bad Request / Validation Error
  const trigger422Error = async () => {
    setActiveRunning("422");
    addLog("API 422", "pending", "Mengirim payload cacat ke /api/test-bugs?type=422 ...");
    try {
      const res = await fetch("/api/test-bugs?type=422", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid-email-format", age: -15 }),
      });
      const data = await res.json();
      addLog("API 422", "error", `HTTP 422: ${data.error || "Validasi gagal"}`);
    } catch (e: any) {
      addLog("API 422", "error", `Network Error: ${e.message}`);
    } finally {
      setActiveRunning(null);
    }
  };

  // 3. Bug: 401 Unauthorized
  const trigger401Error = async () => {
    setActiveRunning("401");
    addLog("API 401", "pending", "Memanggil /api/test-bugs?type=401 tanpa token ...");
    try {
      const res = await fetch("/api/test-bugs?type=401");
      const data = await res.json();
      addLog("API 401", "error", `HTTP 401: ${data.error || "Unauthorized"}`);
    } catch (e: any) {
      addLog("API 401", "error", `Network Error: ${e.message}`);
    } finally {
      setActiveRunning(null);
    }
  };

  // 4. Bug: 403 Forbidden
  const trigger403Error = async () => {
    setActiveRunning("403");
    addLog("API 403", "pending", "Meminta akses admin /api/test-bugs?type=403 dengan akun viewer ...");
    try {
      const res = await fetch("/api/test-bugs?type=403");
      const data = await res.json();
      addLog("API 403", "error", `HTTP 403: ${data.error || "Forbidden"}`);
    } catch (e: any) {
      addLog("API 403", "error", `Network Error: ${e.message}`);
    } finally {
      setActiveRunning(null);
    }
  };

  // 5. Bug: 404 Route Not Found
  const trigger404Error = async () => {
    setActiveRunning("404");
    addLog("API 404", "pending", "Memanggil route yang tidak ada /api/test-bugs?type=404 ...");
    try {
      const res = await fetch("/api/test-bugs?type=404");
      const data = await res.json();
      addLog("API 404", "error", `HTTP 404: ${data.error || "Not Found"}`);
    } catch (e: any) {
      addLog("API 404", "error", `Network Error: ${e.message}`);
    } finally {
      setActiveRunning(null);
    }
  };

  // 6. Bug: CORS Policy Block
  const triggerCorsError = async () => {
    setActiveRunning("cors");
    addLog("CORS Block", "pending", "Mencoba fetch cross-origin ke server tanpa CORS header ...");
    try {
      // Intentionally call a non-CORS endpoint or bad schema
      await fetch("https://example.com/api/no-cors-allowed", {
        method: "GET",
        mode: "cors",
      });
      addLog("CORS Block", "success", "Response diterima (CORS didukung)");
    } catch (e: any) {
      addLog("CORS Block", "error", `CORS Error: ${e.message || "Failed to fetch due to CORS"}`);
      console.error("CORS Policy Violation:", e);
    } finally {
      setActiveRunning(null);
    }
  };

  // 7. Bug: Uncaught JavaScript Crash
  const triggerJsCrash = () => {
    setActiveRunning("js-crash");
    addLog("JS Crash", "pending", "Mengeksekusi null pointer exception...");
    setTimeout(() => {
      setActiveRunning(null);
      // Log to console first
      console.error("CRITICAL RUNTIME ERROR: Cannot read properties of undefined (reading 'calculateTax')");
      // Intentionally throw uncaught error
      const buggyObj: any = undefined;
      buggyObj.calculateTax();
    }, 100);
  };

  // 8. Bug: Unhandled Promise Rejection
  const triggerUnhandledRejection = () => {
    setActiveRunning("unhandled-promise");
    addLog("Unhandled Promise", "pending", "Membuat Promise rejection tanpa .catch()...");
    setTimeout(() => {
      setActiveRunning(null);
      console.error("Uncaught (in promise) Error: FatalAsyncOperationFailed at worker.ts:88");
      new Promise((_, reject) => {
        reject(new Error("FatalAsyncOperationFailed: Payment webhook worker process died unexpectedly"));
      });
      addLog("Unhandled Promise", "error", "Promise rejection dilempar ke window listener");
    }, 100);
  };

  // 9. Bug: Broken Asset / Resource 404
  const triggerBrokenAsset = () => {
    setActiveRunning("broken-asset");
    addLog("Asset 404", "pending", "Memuat script eksternal fiktif /assets/corrupted-bundle.js ...");
    const script = document.createElement("script");
    script.src = "/assets/corrupted-bundle.js";
    script.onerror = () => {
      addLog("Asset 404", "error", "Script /assets/corrupted-bundle.js gagal dimuat (404 Not Found)");
      console.error("Failed to load resource: the server responded with a status of 404 (Not Found)");
      setActiveRunning(null);
    };
    document.body.appendChild(script);
  };

  // 10. Bug: Slow API Latency
  const triggerSlowApi = async () => {
    setActiveRunning("slow");
    addLog("Slow API", "pending", "Memanggil API lambat (delay 3.5s) ...");
    const start = Date.now();
    try {
      const res = await fetch("/api/test-bugs?type=slow");
      await res.json();
      const elapsed = Date.now() - start;
      addLog("Slow API", "error", `API selesai dalam ${elapsed}ms (Peringatan Latensi Tinggi)`);
    } catch (e: any) {
      addLog("Slow API", "error", `Error: ${e.message}`);
    } finally {
      setActiveRunning(null);
    }
  };

  // Trigger All Bugs
  const triggerAllBugs = async () => {
    addLog("BATCH TEST", "pending", "🔥 Menjalankan seluruh simulasi bug secara berurutan...");
    await trigger500Error();
    await trigger422Error();
    await trigger401Error();
    await trigger403Error();
    await trigger404Error();
    await triggerCorsError();
    triggerBrokenAsset();
    triggerUnhandledRejection();
    addLog("BATCH TEST", "success", "Semua bug berhasil dipicu! InspectLog siap menangkap.");
  };

  // Auto trigger if URL has ?autobug=true
  useEffect(() => {
    if (typeof window === "undefined" || autoRan) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autobug") === "true") {
      setAutoRan(true);
      // Wait 300ms for page initialization then fire bugs
      setTimeout(() => {
        triggerAllBugs();
      }, 300);
    }
  }, [autoRan]);

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-zinc-400 hover:text-zinc-200 text-sm font-mono flex items-center gap-1.5 transition"
            >
              ← Kembali ke InspectLog
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs rounded-full bg-rose-950/80 text-rose-300 border border-rose-800 flex items-center gap-1.5 font-mono">
              <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> Bug Testing Lab
            </span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-zinc-900/90 to-[#0c0f18] border border-zinc-800 rounded-xl p-6 relative overflow-hidden shadow-2xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Bug className="w-8 h-8 text-rose-500" />
                InspectLog Bug Simulator & Testing Lab
              </h1>
              <p className="text-zinc-400 text-sm max-w-2xl leading-relaxed">
                Halaman ini dibuat khusus untuk memicu berbagai jenis bug nyata (Backend 500 Crash, 422 Bad Payload,
                401/403 Auth, CORS violation, Runtime JS Crash, dan Broken Assets). Anda dapat menguji bagaimana
                InspectLog menangkap seluruh error tersebut beserta diagnosis akar masalah & solusinya.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <button
                onClick={triggerAllBugs}
                className="bg-rose-600 hover:bg-rose-500 text-white font-medium px-4 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 transition"
              >
                <Flame className="w-4 h-4" />
                Picu Semua Bug Sekarang
              </button>

              <Link
                href="/?inspectUrl=http://localhost:3000/playground?autobug=true"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition"
              >
                <Zap className="w-4 h-4" />
                Scan Page Ini di InspectLog
              </Link>
            </div>
          </div>
        </div>

        {/* Bug Trigger Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: 500 Server Crash */}
          <div className="bg-[#0b0e17] border border-zinc-800/80 rounded-xl p-4 space-y-3 hover:border-zinc-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-900/60 font-semibold">
                HTTP 500
              </span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Backend Server Crash</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Database timeout & unhandled exception di server backend.
              </p>
            </div>
            <button
              onClick={trigger500Error}
              disabled={activeRunning === "500"}
              className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 py-1.5 px-3 rounded text-xs font-medium transition flex items-center justify-center gap-2"
            >
              <Play className="w-3 h-3 text-rose-400" />
              {activeRunning === "500" ? "Mengirim..." : "Trigger Error 500"}
            </button>
          </div>

          {/* Card 2: 422 Bad Request */}
          <div className="bg-[#0b0e17] border border-zinc-800/80 rounded-xl p-4 space-y-3 hover:border-zinc-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-900/60 font-semibold">
                HTTP 422
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Bad Payload / Validation</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Payload format cacat (email tidak valid, umur negatif).
              </p>
            </div>
            <button
              onClick={trigger422Error}
              disabled={activeRunning === "422"}
              className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 py-1.5 px-3 rounded text-xs font-medium transition flex items-center justify-center gap-2"
            >
              <Play className="w-3 h-3 text-amber-400" />
              {activeRunning === "422" ? "Mengirim..." : "Trigger Error 422"}
            </button>
          </div>

          {/* Card 3: 401 Unauthorized */}
          <div className="bg-[#0b0e17] border border-zinc-800/80 rounded-xl p-4 space-y-3 hover:border-zinc-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-yellow-950 text-yellow-300 border border-yellow-900/60 font-semibold">
                HTTP 401
              </span>
              <Lock className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Token Expired / Missing</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Header Authorization Bearer token tidak disertakan.
              </p>
            </div>
            <button
              onClick={trigger401Error}
              disabled={activeRunning === "401"}
              className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 py-1.5 px-3 rounded text-xs font-medium transition flex items-center justify-center gap-2"
            >
              <Play className="w-3 h-3 text-yellow-400" />
              {activeRunning === "401" ? "Mengirim..." : "Trigger Error 401"}
            </button>
          </div>

          {/* Card 4: 403 Forbidden */}
          <div className="bg-[#0b0e17] border border-zinc-800/80 rounded-xl p-4 space-y-3 hover:border-zinc-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-900/60 font-semibold">
                HTTP 403
              </span>
              <ShieldAlert className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Permission Denied (RBAC)</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Role akun tidak mencukupi untuk mengakses resource ini.
              </p>
            </div>
            <button
              onClick={trigger403Error}
              disabled={activeRunning === "403"}
              className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 py-1.5 px-3 rounded text-xs font-medium transition flex items-center justify-center gap-2"
            >
              <Play className="w-3 h-3 text-orange-400" />
              {activeRunning === "403" ? "Mengirim..." : "Trigger Error 403"}
            </button>
          </div>

          {/* Card 5: CORS Block */}
          <div className="bg-[#0b0e17] border border-zinc-800/80 rounded-xl p-4 space-y-3 hover:border-zinc-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-900/60 font-semibold">
                CORS
              </span>
              <Globe className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">CORS Policy Block</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Browser memblokir fetch karena header Allow-Origin tidak ada.
              </p>
            </div>
            <button
              onClick={triggerCorsError}
              disabled={activeRunning === "cors"}
              className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 py-1.5 px-3 rounded text-xs font-medium transition flex items-center justify-center gap-2"
            >
              <Play className="w-3 h-3 text-purple-400" />
              {activeRunning === "cors" ? "Mengecek..." : "Trigger CORS Error"}
            </button>
          </div>

          {/* Card 6: Runtime JS Crash */}
          <div className="bg-[#0b0e17] border border-zinc-800/80 rounded-xl p-4 space-y-3 hover:border-zinc-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-900/60 font-semibold">
                JS CRASH
              </span>
              <Flame className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Uncaught JS Exception</h3>
              <p className="text-xs text-zinc-400 mt-1">
                TypeError: Cannot read properties of undefined.
              </p>
            </div>
            <button
              onClick={triggerJsCrash}
              disabled={activeRunning === "js-crash"}
              className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 py-1.5 px-3 rounded text-xs font-medium transition flex items-center justify-center gap-2"
            >
              <Play className="w-3 h-3 text-red-400" />
              Trigger JS Crash
            </button>
          </div>

          {/* Card 7: Unhandled Promise */}
          <div className="bg-[#0b0e17] border border-zinc-800/80 rounded-xl p-4 space-y-3 hover:border-zinc-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-900/60 font-semibold">
                PROMISE
              </span>
              <Terminal className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Unhandled Promise Reject</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Async Promise rejection tanpa blok penanganan .catch().
              </p>
            </div>
            <button
              onClick={triggerUnhandledRejection}
              disabled={activeRunning === "unhandled-promise"}
              className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 py-1.5 px-3 rounded text-xs font-medium transition flex items-center justify-center gap-2"
            >
              <Play className="w-3 h-3 text-sky-400" />
              Trigger Rejection
            </button>
          </div>

          {/* Card 8: Broken Asset 404 */}
          <div className="bg-[#0b0e17] border border-zinc-800/80 rounded-xl p-4 space-y-3 hover:border-zinc-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold">
                ASSET 404
              </span>
              <AlertTriangle className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Broken Script Resource</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Script JS eksternal tidak ditemukan (404 Not Found).
              </p>
            </div>
            <button
              onClick={triggerBrokenAsset}
              disabled={activeRunning === "broken-asset"}
              className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 py-1.5 px-3 rounded text-xs font-medium transition flex items-center justify-center gap-2"
            >
              <Play className="w-3 h-3 text-zinc-400" />
              Muat Asset Rusak
            </button>
          </div>

          {/* Card 9: Slow Latency */}
          <div className="bg-[#0b0e17] border border-zinc-800/80 rounded-xl p-4 space-y-3 hover:border-zinc-700 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-900/60 font-semibold">
                LATENCY
              </span>
              <Clock className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">High Latency Response</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Delay server 3.5 detik memicu indikator response lambat.
              </p>
            </div>
            <button
              onClick={triggerSlowApi}
              disabled={activeRunning === "slow"}
              className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 py-1.5 px-3 rounded text-xs font-medium transition flex items-center justify-center gap-2"
            >
              <Play className="w-3 h-3 text-indigo-400" />
              {activeRunning === "slow" ? "Menunggu (3.5s)..." : "Trigger Slow API"}
            </button>
          </div>
        </div>

        {/* Live Execution Console */}
        <div className="bg-[#090b12] border border-zinc-800 rounded-xl p-4 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Live Console Log Simulasi ({logs.length} kejadian)</span>
            </div>
            {logs.length > 0 && (
              <button
                onClick={() => setLogs([])}
                className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3 h-3" /> Bersihkan Log
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-zinc-500 py-4 text-center italic">
                Belum ada bug yang dipicu. Klik salah satu tombol di atas atau "Picu Semua Bug Sekarang".
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded flex items-start gap-2 border ${
                    log.status === "error"
                      ? "bg-rose-950/20 border-rose-900/40 text-rose-300"
                      : log.status === "pending"
                      ? "bg-amber-950/20 border-amber-900/40 text-amber-300"
                      : "bg-emerald-950/20 border-emerald-900/40 text-emerald-300"
                  }`}
                >
                  <span className="text-[10px] text-zinc-500 shrink-0">[{log.timestamp}]</span>
                  <span className="font-semibold shrink-0">[{log.type}]</span>
                  <span className="text-zinc-200 break-all">{log.details}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
