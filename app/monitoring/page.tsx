"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CheckCircle,
  ExternalLink,
  Flame,
  Globe,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

interface Monitor {
  id: string;
  name: string;
  url: string;
  interval_minutes: number;
  alert_type: "telegram" | "webhook";
  alert_destination: string;
  status: "active" | "paused";
  last_checked_at: string | null;
  last_status: number | null;
  last_health_score: number | null;
  created_at: string;
}

export default function MonitoringPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Monitor Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newInterval, setNewInterval] = useState(60);
  const [newAlertType, setNewAlertType] = useState<"telegram" | "webhook">("telegram");
  const [newDestination, setNewDestination] = useState("");
  const [savingMonitor, setSavingMonitor] = useState(false);

  // Test Alert state
  const [testingAlert, setTestingAlert] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Run Now state
  const [runningId, setRunningId] = useState<string | null>(null);

  // Pro Pricing Modal state
  const [showPricingModal, setShowPricingModal] = useState(false);

  const fetchMonitors = async () => {
    try {
      const res = await fetch("/api/monitors");
      const data = await res.json();
      if (data.success) {
        setMonitors(data.monitors || []);
      }
    } catch {
      setErrorMsg("Gagal memuat daftar monitor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
  }, []);

  const handleTestAlert = async () => {
    if (!newDestination.trim()) {
      setTestResult({ success: false, message: "Masukkan tujuan alert (Bot token:Chat ID atau URL Webhook)." });
      return;
    }
    setTestingAlert(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/monitors/test-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertType: newAlertType,
          alertDestination: newDestination.trim(),
        }),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success ? "Notifikasi uji coba berhasil terkirim!" : data.error || "Gagal kirim notifikasi.",
      });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Gagal menghubungi API test alert." });
    } finally {
      setTestingAlert(false);
    }
  };

  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newUrl || !newDestination) return;

    setSavingMonitor(true);
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          url: newUrl.trim(),
          intervalMinutes: newInterval,
          alertType: newAlertType,
          alertDestination: newDestination.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal membuat monitor.");
      }

      setShowAddModal(false);
      setNewName("");
      setNewUrl("");
      setNewDestination("");
      setTestResult(null);
      fetchMonitors();
    } catch (err: any) {
      alert(err.message || "Gagal membuat monitor.");
    } finally {
      setSavingMonitor(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: "active" | "paused") => {
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    try {
      await fetch(`/api/monitors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      setMonitors((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: nextStatus } : m))
      );
    } catch {
      alert("Gagal mengubah status monitor.");
    }
  };

  const handleDeleteMonitor = async (id: string) => {
    if (!confirm("Hapus monitor ini?")) return;
    try {
      await fetch(`/api/monitors/${id}`, { method: "DELETE" });
      setMonitors((prev) => prev.filter((m) => m.id !== id));
    } catch {
      alert("Gagal menghapus monitor.");
    }
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    try {
      const res = await fetch(`/api/monitors/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchMonitors();
      } else {
        alert(data.error || "Gagal menjalankan pemindaian.");
      }
    } catch (err: any) {
      alert(err.message || "Gagal memindai.");
    } finally {
      setRunningId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <header className="border-b border-slate-800 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition"
                title="Kembali ke Inspector"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-600/20 text-rose-400 rounded-lg border border-rose-500/30">
                  <Bell className="w-5 h-5" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Automated Monitor & Incident Alerts (Pro)
                </h1>
              </div>
            </div>
            <p className="text-slate-400 text-xs md:text-sm pl-12">
              Pantau website penting otomatis tiap jam. Dapatkan notifikasi instan via Telegram Bot / Webhook jika API 500 atau tombol checkout error.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPricingModal(true)}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 px-3.5 py-2 rounded-lg text-xs font-semibold transition"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              Paket Pro & Harga
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              Tambah Monitor
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Total Monitor Terpasang</span>
            <div className="text-2xl font-bold text-white mt-1">{monitors.length}</div>
            <span className="text-[11px] text-slate-500">Website & Halaman Kritis</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Status Aktif</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {monitors.filter((m) => m.status === "active").length}
            </div>
            <span className="text-[11px] text-slate-500">Otomatis dipantau scheduler</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Kanal Notifikasi Terhubung</span>
            <div className="text-2xl font-bold text-indigo-400 mt-1">
              {monitors.filter((m) => m.alert_destination).length}
            </div>
            <span className="text-[11px] text-slate-500">Telegram Bot & Webhooks</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400">Status Gateway Cron</span>
            <div className="text-sm font-bold text-emerald-400 mt-2 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live & Ready
            </div>
            <span className="text-[10px] text-slate-500 mt-1">Endpoint: /api/cron/check</span>
          </div>
        </div>

        {/* Monitors List */}
        {loading ? (
          <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400">Memuat data monitor...</p>
          </div>
        ) : monitors.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-4">
            <ShieldAlert className="w-12 h-12 text-slate-500 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Belum Ada Website yang Dipantau</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Pasang monitor untuk halaman krusial seperti checkout, login, atau API dashboard agar Anda mendapatkan peringatan Telegram saat terjadi masalah.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition"
            >
              <Plus className="w-4 h-4" />
              Pasang Monitor Pertama
            </button>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Nama Monitor</th>
                    <th className="py-3 px-4">Target URL</th>
                    <th className="py-3 px-4">Interval</th>
                    <th className="py-3 px-4">Alert Channel</th>
                    <th className="py-3 px-4">Health Terakhir</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {monitors.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4 font-sans">
                        <button
                          onClick={() => handleToggleStatus(m.id, m.status)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition ${
                            m.status === "active"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {m.status === "active" ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3" />}
                          {m.status.toUpperCase()}
                        </button>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-200 font-sans">
                        {m.name}
                      </td>

                      <td className="py-3 px-4 max-w-xs truncate text-slate-300">
                        <span title={m.url}>{m.url}</span>
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-sans">
                        Tiap {m.interval_minutes} menit
                      </td>

                      <td className="py-3 px-4 text-slate-300 font-sans">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-indigo-300">
                          {m.alert_type}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-sans">
                        {m.last_health_score !== null ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              m.last_health_score >= 80
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : "bg-red-950 text-red-400 border border-red-800"
                            }`}
                          >
                            {m.last_health_score}/100
                          </span>
                        ) : (
                          <span className="text-slate-500">Belum dipindai</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-sans space-x-1.5">
                        <button
                          onClick={() => handleRunNow(m.id)}
                          disabled={runningId === m.id}
                          className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 px-2.5 py-1 rounded text-[11px] transition inline-flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${runningId === m.id ? "animate-spin" : ""}`} />
                          Scan Sekarang
                        </button>

                        <button
                          onClick={() => handleDeleteMonitor(m.id)}
                          className="bg-slate-800 hover:bg-red-950/80 text-slate-400 hover:text-red-400 p-1 rounded transition"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Add Monitor */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-bold text-base text-white">Pasang Monitor Website Baru</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateMonitor} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Nama Label Monitor *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Checkout Production Toko Online"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Target URL yang Dipantau *</label>
                  <input
                    type="text"
                    required
                    placeholder="https://toko.com/checkout"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 block mb-1 font-medium">Interval Pengecekan</label>
                    <select
                      value={newInterval}
                      onChange={(e) => setNewInterval(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                    >
                      <option value={30}>Tiap 30 Menit</option>
                      <option value={60}>Tiap 1 Jam (Standar)</option>
                      <option value={360}>Tiap 6 Jam</option>
                      <option value={1440}>Tiap 24 Jam</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-medium">Kanal Alert</label>
                    <select
                      value={newAlertType}
                      onChange={(e) => setNewAlertType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none"
                    >
                      <option value="telegram">Telegram Bot</option>
                      <option value="webhook">Webhook (Discord / Slack)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-medium">
                      {newAlertType === "telegram"
                        ? "Telegram BOT_TOKEN:CHAT_ID *"
                        : "URL Webhook (Discord / Slack) *"}
                    </label>
                    <button
                      type="button"
                      onClick={handleTestAlert}
                      disabled={testingAlert || !newDestination.trim()}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 disabled:opacity-40 inline-flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      {testingAlert ? "Menguji..." : "Test Kirim"}
                    </button>
                  </div>

                  <input
                    type="text"
                    required
                    placeholder={
                      newAlertType === "telegram"
                        ? "123456789:AAH...:987654321"
                        : "https://discord.com/api/webhooks/..."
                    }
                    value={newDestination}
                    onChange={(e) => setNewDestination(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {newAlertType === "telegram"
                      ? "Format: BOT_TOKEN dari @BotFather dan CHAT_ID dari @userinfobot (dipisah titik dua ':')."
                      : "Salin webhook URL dari server Discord atau Slack channel Anda."}
                  </p>
                </div>

                {/* Test Result Message */}
                {testResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                      testResult.success
                        ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                        : "bg-red-950/40 border-red-800 text-red-300"
                    }`}
                  >
                    {testResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2 rounded-lg font-medium transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingMonitor}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition"
                  >
                    {savingMonitor ? "Menyimpan..." : "Simpan & Aktifkan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Pricing & Pro Tier */}
        {showPricingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-lg text-white">Paket Langganan & Fitur Pro</h3>
                </div>
                <button
                  onClick={() => setShowPricingModal(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Free Tier */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Free Beta</div>
                  <div className="text-2xl font-bold text-white">Rp 0 <span className="text-xs text-slate-500 font-normal">/ selamanya</span></div>
                  <p className="text-xs text-slate-400">Cocok untuk pengecekan manual dan uji coba awal.</p>

                  <ul className="text-xs text-slate-300 space-y-2 pt-2">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Scan manual tanpa batas</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Multi-Page Crawler (max 3 halaman)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Shareable Report URL publik</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-500">
                      <X className="w-3.5 h-3.5 shrink-0" />
                      <span>Tanpa background auto-monitoring</span>
                    </li>
                  </ul>

                  <button
                    disabled
                    className="w-full bg-slate-800 text-slate-400 py-2 rounded-lg text-xs font-medium cursor-not-allowed mt-4"
                  >
                    Paket Aktif Saat Ini
                  </button>
                </div>

                {/* Pro Tier */}
                <div className="bg-gradient-to-b from-indigo-950/40 to-slate-950 border border-indigo-500/50 rounded-xl p-5 space-y-3 relative shadow-lg shadow-indigo-500/10">
                  <div className="absolute -top-2.5 right-4 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    Paling Populer
                  </div>
                  <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Pro Monitoring</div>
                  <div className="text-2xl font-bold text-white">Rp 149.000 <span className="text-xs text-slate-500 font-normal">/ bulan</span></div>
                  <p className="text-xs text-slate-300">Untuk pemilik bisnis, e-commerce, & agency digital.</p>

                  <ul className="text-xs text-slate-200 space-y-2 pt-2">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>10 Website Monitor</strong> otomatis berkala</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Interval fleksibel (Tiap 15-30 menit)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Notifikasi instan Telegram Bot & Discord</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Multi-Page Crawler (hingga 10 halaman)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Peringatan checkout breakdown otomatis</span>
                    </li>
                  </ul>

                  <button
                    onClick={() => {
                      alert("Integrasi Checkout Payment Gateway (Midtrans / Stripe / LemonSqueezy) siap dihubungkan!");
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-xs font-bold transition shadow-md mt-4"
                  >
                    Upgrade ke Pro Sekarang
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
