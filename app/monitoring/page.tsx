"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
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
      setErrorMsg("Failed to load monitor configurations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
  }, []);

  const handleTestAlert = async () => {
    if (!newDestination.trim()) {
      setTestResult({ success: false, message: "Enter alert target (Bot token:Chat ID or Webhook URL)." });
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
        message: data.success ? "Test alert dispatched successfully!" : data.error || "Failed to dispatch test notification.",
      });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Failed to connect to alert API." });
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
        throw new Error(data.error || "Failed to create monitor.");
      }

      setShowAddModal(false);
      setNewName("");
      setNewUrl("");
      setNewDestination("");
      setTestResult(null);
      fetchMonitors();
    } catch (err: any) {
      alert(err.message || "Failed to create monitor.");
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
      alert("Failed to update monitor status.");
    }
  };

  const handleDeleteMonitor = async (id: string) => {
    if (!confirm("Delete this monitoring probe?")) return;
    try {
      await fetch(`/api/monitors/${id}`, { method: "DELETE" });
      setMonitors((prev) => prev.filter((m) => m.id !== id));
    } catch {
      alert("Failed to delete monitor probe.");
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
        alert(data.error || "Failed to execute monitor probe.");
      }
    } catch (err: any) {
      alert(err.message || "Execution failed.");
    } finally {
      setRunningId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#090a0f] text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white">
      {/* Top Application Bar */}
      <nav className="border-b border-zinc-800/80 bg-[#090a0f]/90 backdrop-blur sticky top-0 z-40">
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
              <span className="w-2 h-2 rounded-full bg-amber-400 ring-4 ring-amber-500/20"></span>
              <span className="font-semibold text-sm tracking-tight text-zinc-100 font-mono">
                InspectLog Monitor
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-900/60 uppercase">
              Pro Tier
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPricingModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-950/60 border border-amber-900/70 transition"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Plans & Pricing</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 transition border border-zinc-200 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Monitor</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Workspace Frame */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Metric Strip */}
        <div className="border border-zinc-800/80 bg-[#0c0e14] rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 text-left">
          <div className="p-3.5 space-y-1">
            <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider block">Installed Probes</span>
            <div className="text-2xl font-semibold tracking-tight font-mono text-zinc-100">{monitors.length}</div>
            <div className="text-[10px] text-zinc-400">Critical target URLs</div>
          </div>

          <div className="p-3.5 space-y-1">
            <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider block">Active Probes</span>
            <div className="text-2xl font-semibold tracking-tight font-mono text-emerald-400">
              {monitors.filter((m) => m.status === "active").length}
            </div>
            <div className="text-[10px] text-zinc-400">Scheduled by cron engine</div>
          </div>

          <div className="p-3.5 space-y-1">
            <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider block">Alert Destinations</span>
            <div className="text-2xl font-semibold tracking-tight font-mono text-zinc-100">
              {monitors.filter((m) => m.alert_destination).length}
            </div>
            <div className="text-[10px] text-zinc-400 font-mono">Telegram & Webhooks</div>
          </div>

          <div className="p-3.5 space-y-1">
            <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider block">Cron Gateway</span>
            <div className="text-sm font-semibold text-emerald-400 mt-2 flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Live & Ready
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">/api/cron/check</div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="text-center py-16 border border-zinc-800 bg-[#0c0e14] rounded-lg">
            <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-zinc-500 font-mono">Loading probe configurations...</p>
          </div>
        ) : monitors.length === 0 ? (
          <div className="border border-zinc-800 bg-[#0c0e14] rounded-lg p-10 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-zinc-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-zinc-200">No Web Monitors Configured</h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto font-sans">
                Set up automated recurring inspections for checkout, user authentication, or primary API routes. Instant Telegram or Webhook alerts will trigger on HTTP 500 or script crash.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 bg-zinc-100 hover:bg-white text-zinc-950 px-3.5 py-1.5 rounded-md text-xs font-medium transition border border-zinc-200 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Configure First Probe
            </button>
          </div>
        ) : (
          <div className="border border-zinc-800/80 rounded-lg overflow-hidden bg-[#0c0e14]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0e1017] text-zinc-400 font-sans border-b border-zinc-800 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 w-20">State</th>
                    <th className="py-2.5 px-3">Probe Label</th>
                    <th className="py-2.5 px-3">Target Endpoint URL</th>
                    <th className="py-2.5 px-3 w-28">Interval</th>
                    <th className="py-2.5 px-3 w-24">Channel</th>
                    <th className="py-2.5 px-3 w-28">Last Health</th>
                    <th className="py-2.5 px-3 text-right font-sans w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {monitors.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-900/40 transition">
                      <td className="py-2.5 px-3 font-sans">
                        <button
                          onClick={() => handleToggleStatus(m.id, m.status)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition ${
                            m.status === "active"
                              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-900/70"
                              : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                          }`}
                        >
                          {m.status === "active" ? <Play className="w-2.5 h-2.5 fill-current" /> : <Pause className="w-2.5 h-2.5" />}
                          {m.status.toUpperCase()}
                        </button>
                      </td>

                      <td className="py-2.5 px-3 font-sans font-medium text-zinc-200">
                        {m.name}
                      </td>

                      <td className="py-2.5 px-3 max-w-xs truncate text-zinc-300">
                        <span title={m.url}>{m.url}</span>
                      </td>

                      <td className="py-2.5 px-3 text-zinc-400">
                        Every {m.interval_minutes}m
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono text-zinc-300">
                          {m.alert_type}
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        {m.last_health_score !== null ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              m.last_health_score >= 80
                                ? "bg-emerald-950/60 text-emerald-300 border border-emerald-900/70"
                                : "bg-rose-950/60 text-rose-300 border border-rose-900/70"
                            }`}
                          >
                            {m.last_health_score}/100
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-sans text-[11px]">Pending</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-sans space-x-1.5">
                        <button
                          onClick={() => handleRunNow(m.id)}
                          disabled={runningId === m.id}
                          className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-zinc-300 px-2 py-0.5 rounded text-[11px] border border-zinc-800 transition inline-flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${runningId === m.id ? "animate-spin" : ""}`} />
                          Run
                        </button>

                        <button
                          onClick={() => handleDeleteMonitor(m.id)}
                          className="bg-zinc-900 hover:bg-rose-950 text-zinc-500 hover:text-rose-400 p-1 rounded border border-zinc-800 transition"
                          title="Delete probe"
                        >
                          <Trash2 className="w-3 h-3" />
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
            <div className="bg-[#0c0e14] border border-zinc-800 rounded-xl w-full max-w-lg p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-zinc-400" />
                  <h3 className="font-semibold text-xs text-zinc-100 font-mono">Create Scheduled Probe</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateMonitor} className="space-y-3.5 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Probe Label *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Production Checkout Flow"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-[#090a0f] border border-zinc-800 rounded-md p-2 text-zinc-200 focus:outline-none focus:border-zinc-600 font-sans text-xs"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Target Endpoint URL *</label>
                  <input
                    type="text"
                    required
                    placeholder="https://mycompany.com/checkout"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full bg-[#090a0f] border border-zinc-800 rounded-md p-2 text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 block mb-1">Probe Frequency</label>
                    <select
                      value={newInterval}
                      onChange={(e) => setNewInterval(Number(e.target.value))}
                      className="w-full bg-[#090a0f] border border-zinc-800 rounded-md p-2 text-zinc-200 focus:outline-none text-xs font-mono"
                    >
                      <option value={30}>Every 30 mins</option>
                      <option value={60}>Every 1 hour (Default)</option>
                      <option value={360}>Every 6 hours</option>
                      <option value={1440}>Every 24 hours</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">Alert Channel</label>
                    <select
                      value={newAlertType}
                      onChange={(e) => setNewAlertType(e.target.value as any)}
                      className="w-full bg-[#090a0f] border border-zinc-800 rounded-md p-2 text-zinc-200 focus:outline-none text-xs font-mono"
                    >
                      <option value="telegram">Telegram Bot</option>
                      <option value="webhook">Webhook (Discord / Slack)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-zinc-400">
                      {newAlertType === "telegram"
                        ? "Telegram BOT_TOKEN:CHAT_ID *"
                        : "Webhook URL (Discord / Slack) *"}
                    </label>
                    <button
                      type="button"
                      onClick={handleTestAlert}
                      disabled={testingAlert || !newDestination.trim()}
                      className="text-[11px] text-zinc-400 hover:text-white disabled:opacity-40 inline-flex items-center gap-1 font-mono"
                    >
                      <Send className="w-3 h-3" />
                      {testingAlert ? "Testing..." : "Send Test"}
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
                    className="w-full bg-[#090a0f] border border-zinc-800 rounded-md p-2 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-zinc-600"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {newAlertType === "telegram"
                      ? "Format: BOT_TOKEN from @BotFather and CHAT_ID from @userinfobot (separated by ':')."
                      : "Paste the webhook URL from Discord or Slack channel integrations."}
                  </p>
                </div>

                {/* Test Result Message */}
                {testResult && (
                  <div
                    className={`p-2.5 rounded border text-xs flex items-center gap-2 ${
                      testResult.success
                        ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                        : "bg-rose-950/40 border-rose-800 text-rose-300"
                    }`}
                  >
                    {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingMonitor}
                    className="bg-zinc-100 hover:bg-white text-zinc-950 font-medium px-3.5 py-1.5 rounded text-xs transition border border-zinc-200 disabled:opacity-50"
                  >
                    {savingMonitor ? "Saving..." : "Save Probe"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Pricing & Pro Tier */}
        {showPricingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0c0e14] border border-zinc-800 rounded-xl w-full max-w-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <h3 className="font-semibold text-sm text-zinc-100 font-mono">Subscription Tiers & Pro Monitoring</h3>
                </div>
                <button
                  onClick={() => setShowPricingModal(false)}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Free Tier */}
                <div className="bg-[#090a0f] border border-zinc-800 rounded-lg p-4 space-y-2.5">
                  <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Free Community</div>
                  <div className="text-xl font-semibold text-white font-mono">
                    Rp 0 <span className="text-xs text-zinc-500 font-normal">/ forever</span>
                  </div>
                  <p className="text-xs text-zinc-400">Essential for manual inspection and individual debugging.</p>

                  <ul className="text-xs text-zinc-300 space-y-2 pt-2 border-t border-zinc-800/80">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Unlimited manual deep inspections</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Multi-Page Crawler (max 3 pages)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Shareable public report links</span>
                    </li>
                    <li className="flex items-center gap-2 text-zinc-600">
                      <X className="w-3.5 h-3.5 shrink-0" />
                      <span>No background recurring probe alerts</span>
                    </li>
                  </ul>

                  <button
                    disabled
                    className="w-full bg-zinc-900 text-zinc-500 py-1.5 rounded text-xs font-mono border border-zinc-800 mt-2 cursor-not-allowed"
                  >
                    Active Tier
                  </button>
                </div>

                {/* Pro Tier */}
                <div className="bg-[#090a0f] border border-amber-900/60 rounded-lg p-4 space-y-2.5 relative">
                  <div className="absolute top-3.5 right-3.5 bg-amber-950/80 text-amber-300 border border-amber-800/80 text-[10px] font-mono px-2 py-0.5 rounded">
                    Popular
                  </div>
                  <div className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">Pro Monitoring</div>
                  <div className="text-xl font-semibold text-white font-mono">
                    Rp 149.000 <span className="text-xs text-zinc-500 font-normal">/ month</span>
                  </div>
                  <p className="text-xs text-zinc-300">Continuous health checks for agencies & e-commerce teams.</p>

                  <ul className="text-xs text-zinc-200 space-y-2 pt-2 border-t border-zinc-800/80">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>10 Automated recurring probes</strong></span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Flexible intervals (Every 15-30m)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Instant Telegram & Discord incident alerts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Deep crawler (up to 10 pages per run)</span>
                    </li>
                  </ul>

                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/payment/create", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ provider: "midtrans" }),
                        });
                        const data = await res.json();
                        if (data.success && data.paymentUrl) {
                          window.location.href = data.paymentUrl;
                        } else {
                          alert(data.error || "Failed to create invoice. Please ensure you are signed in.");
                        }
                      } catch {
                        alert("Failed to connect to billing server.");
                      }
                    }}
                    className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-medium py-1.5 rounded text-xs transition border border-zinc-200 shadow-sm mt-2"
                  >
                    Upgrade to Pro Tier
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
