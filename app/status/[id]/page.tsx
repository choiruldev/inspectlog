"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

interface StatusData {
  id: string;
  name: string;
  url: string;
  intervalMinutes: number;
  status: string;
  lastCheckedAt: string | null;
  lastStatus: number | null;
  lastHealthScore: number | null;
  createdAt: string;
  uptimePercentage: string;
}

interface LogItem {
  id: string;
  status_code: number;
  health_score: number;
  scan_id: string | null;
  alert_sent: number;
  created_at: string;
}

function StatusContent() {
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [monitor, setMonitor] = useState<StatusData | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/status/${id}`);
      const data = await res.json();
      if (data.success && data.monitor) {
        setMonitor(data.monitor);
        setLogs(data.logs || []);
      } else {
        setErrorMsg(data.error || "Halaman status tidak ditemukan.");
      }
    } catch {
      setErrorMsg("Gagal memuat status server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchStatus();
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090a0f] text-zinc-100 flex items-center justify-center font-mono text-xs">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-5 h-5 text-zinc-400 animate-spin" />
          <p className="text-zinc-500">Memuat status publik...</p>
        </div>
      </main>
    );
  }

  if (errorMsg || !monitor) {
    return (
      <main className="min-h-screen bg-[#090a0f] text-zinc-100 p-6 flex items-center justify-center font-sans">
        <div className="border border-zinc-800 bg-[#0c0e14] rounded-xl p-8 max-w-sm text-center space-y-3">
          <XCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <h2 className="text-sm font-semibold text-zinc-100">Status Page Tidak Ditemukan</h2>
          <p className="text-xs text-zinc-500">{errorMsg || "Monitor ini tidak terdaftar atau telah dihapus."}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs px-3 py-1.5 rounded-md font-medium transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Ke Halaman Utama
          </Link>
        </div>
      </main>
    );
  }

  const isOperational = (monitor.lastHealthScore ?? 100) >= 80;

  return (
    <main className="min-h-screen bg-[#090a0f] text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white">
      {/* Top Application Bar */}
      <nav className="border-b border-zinc-800/80 bg-[#090a0f]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/monitoring"
              className="p-1.5 rounded-md text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isOperational ? "bg-emerald-400 ring-4 ring-emerald-500/20" : "bg-rose-400 ring-4 ring-rose-500/20"}`}></span>
              <span className="font-semibold text-sm tracking-tight text-zinc-100 font-mono">
                {monitor.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span>Uptime:</span>
            <span className="text-emerald-400 font-bold">{monitor.uptimePercentage}%</span>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Status Hero Card */}
        <div
          className={`border rounded-xl p-5 sm:p-6 transition ${
            isOperational
              ? "bg-[#0c0e14] border-emerald-900/60"
              : "bg-[#0c0e14] border-rose-900/60"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isOperational ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-8 h-8 text-rose-400 shrink-0" />
              )}
              <div>
                <h1 className="text-base sm:text-lg font-bold text-zinc-100">
                  {isOperational ? "Seluruh Sistem Beroperasi Normal" : "Terdeteksi Gangguan Sistem (Incident)"}
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                  Target: <a href={monitor.url} target="_blank" rel="noreferrer" className="text-zinc-300 hover:underline">{monitor.url}</a>
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right text-xs font-mono text-zinc-500 shrink-0">
              <div>Pengecekan tiap {monitor.intervalMinutes} menit</div>
              {monitor.lastCheckedAt && (
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Terakhir: {new Date(monitor.lastCheckedAt).toLocaleTimeString("id-ID")} WIB
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 30-Check Telemetry Bar */}
        <div className="border border-zinc-800/80 bg-[#0c0e14] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-300 font-sans">Riwayat Pengecekan Berkala (30 Pengecekan Terakhir)</span>
            <span className="text-[11px] font-mono text-emerald-400">{monitor.uptimePercentage}% Operasional</span>
          </div>

          {/* Ticks Bar */}
          <div className="flex items-center gap-1 h-8">
            {logs.length === 0 ? (
              <div className="w-full text-center text-xs text-zinc-600 font-mono py-1">
                Belum ada data rekaman pemantauan.
              </div>
            ) : (
              logs.slice(0, 30).reverse().map((log, idx) => (
                <div
                  key={idx}
                  className={`flex-1 h-full rounded-sm transition ${
                    log.health_score >= 80
                      ? "bg-emerald-500/80 hover:bg-emerald-400"
                      : "bg-rose-500/80 hover:bg-rose-400"
                  }`}
                  title={`${new Date(log.created_at).toLocaleTimeString()}: Health ${log.health_score}/100 (Status ${log.status_code})`}
                />
              ))
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>30 pengecekan lalu</span>
            <span>Saat ini</span>
          </div>
        </div>

        {/* Recent Activity Log Table */}
        <div className="border border-zinc-800/80 rounded-lg overflow-hidden bg-[#0c0e14] space-y-0">
          <div className="p-3 border-b border-zinc-800 bg-[#0e1017] text-xs font-semibold text-zinc-300">
            Log Pemantauan & Insiden Terakhir
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0e1017] text-zinc-400 font-sans border-b border-zinc-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Waktu Pengecekan</th>
                  <th className="py-2.5 px-3">Status Code</th>
                  <th className="py-2.5 px-3">Health Score</th>
                  <th className="py-2.5 px-3">Notifikasi Alert</th>
                  <th className="py-2.5 px-3 text-right font-sans">Detail Scan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-zinc-500 font-sans">
                      Belum ada catatan log pemantauan.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-900/40 transition">
                      <td className="py-2.5 px-3 text-zinc-300">
                        {new Date(log.created_at).toLocaleString("id-ID", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            log.status_code >= 400 || log.status_code === 0
                              ? "bg-rose-950 text-rose-300 border border-rose-900/80"
                              : "bg-emerald-950/60 text-emerald-300 border border-emerald-900/60"
                          }`}
                        >
                          HTTP {log.status_code || "FAIL"}
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold ${
                            log.health_score >= 80 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {log.health_score}/100
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-sans text-[11px]">
                        {log.alert_sent ? (
                          <span className="text-amber-400">Terkirim ke Telegram/Webhook</span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-sans">
                        {log.scan_id ? (
                          <Link
                            href={`/report/${log.scan_id}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded transition"
                          >
                            <span>Laporan</span>
                            <ExternalLink className="w-2.5 h-2.5 text-zinc-400" />
                          </Link>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Credit */}
        <div className="pt-4 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-2 font-mono">
          <span>Powered by InspectLog Uptime Engine</span>
          <Link href="/" className="text-zinc-400 hover:text-zinc-200 underline font-sans">
            Buat Halaman Status Website Anda Sendiri →
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function StatusPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#090a0f] text-zinc-100 flex items-center justify-center font-mono text-xs">
          <p className="text-zinc-500">Memuat status publik...</p>
        </main>
      }
    >
      <StatusContent />
    </Suspense>
  );
}
