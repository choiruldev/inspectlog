"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, ShieldCheck, ArrowRight, RefreshCw, CreditCard } from "lucide-react";

function SimulatorContent() {
  const searchParams = useSearchParams();
  const invoice = searchParams.get("invoice") || "INV-SAMPLE";
  const amount = searchParams.get("amount") || "149000";
  const provider = searchParams.get("provider") || "midtrans";
  const router = useRouter();

  const [processing, setProcessing] = useState(false);
  const [paid, setPaid] = useState(false);

  const handlePay = async () => {
    setProcessing(true);
    try {
      const res = await fetch("/api/payment/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice,
          action: "simulate_paid",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPaid(true);
        setTimeout(() => {
          router.push("/monitoring");
        }, 2000);
      }
    } catch {
      alert("Gagal memproses pembayaran simulasi.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30 flex items-center justify-center mx-auto mb-3">
            <CreditCard className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Payment Gateway Sandbox</h2>
          <p className="text-xs text-slate-400">
            {provider === "midtrans" ? "Simulasi Pembayaran Midtrans QRIS / Virtual Account" : "Stripe Checkout Simulator"}
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs space-y-2 font-mono">
          <div className="flex justify-between">
            <span className="text-slate-500">Invoice ID:</span>
            <span className="text-slate-200">{invoice}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Item:</span>
            <span className="text-slate-200">InspectLog PRO (1 Bulan)</span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-2 font-bold font-sans text-sm">
            <span className="text-white">Total Bayar:</span>
            <span className="text-emerald-400">
              {provider === "stripe" ? `$${(Number(amount) / 100).toFixed(2)}` : `Rp ${Number(amount).toLocaleString("id-ID")}`}
            </span>
          </div>
        </div>

        {paid ? (
          <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-xl text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="font-bold text-emerald-300 text-sm">Pembayaran Berhasil!</h4>
            <p className="text-xs text-slate-300">Akun Anda otomatis di-upgrade ke PRO. Mengalihkan ke dashboard...</p>
          </div>
        ) : (
          <button
            onClick={handlePay}
            disabled={processing}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memproses Verifikasi Webhook...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Simulasikan Bayar Sukses (QRIS / Kartu)</span>
              </>
            )}
          </button>
        )}
      </div>
    </main>
  );
}

export default function SimulatorPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
          <p className="text-xs text-slate-400">Memuat gateway pembayaran...</p>
        </main>
      }
    >
      <SimulatorContent />
    </Suspense>
  );
}
