"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck, ArrowRight, RefreshCw, CreditCard } from "lucide-react";

function SimulatorContent() {
  const searchParams = useSearchParams();
  const invoice = searchParams.get("invoice") || "INV-202611-PRO01";
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
        }, 1500);
      }
    } catch {
      alert("Failed to process payment simulation.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090a0f] text-zinc-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-[#0c0e14] border border-zinc-800 rounded-xl w-full max-w-sm p-5 shadow-2xl space-y-4">
        <div className="text-center space-y-1">
          <div className="w-9 h-9 bg-zinc-900 text-zinc-300 rounded-lg border border-zinc-800 flex items-center justify-center mx-auto mb-2">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-900/60 uppercase">
              Mode Simulasi Sandbox
            </span>
          </div>
          <h2 className="text-sm font-semibold text-zinc-100 font-mono">Gateway Pembayaran Uji Coba</h2>
          <p className="text-[11px] text-zinc-400 font-sans">
            {provider === "midtrans" ? "Simulasi Pembayaran Midtrans (QRIS / Virtual Account)" : "Simulasi Checkout Stripe"}
          </p>
        </div>

        <div className="bg-[#090a0f] border border-zinc-800 rounded-lg p-3 text-xs space-y-1.5 font-mono">
          <div className="flex justify-between">
            <span className="text-zinc-500">Invoice:</span>
            <span className="text-zinc-300">{invoice}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Item:</span>
            <span className="text-zinc-300 font-sans text-xs">InspectLog PRO (Langganan 1 Bulan)</span>
          </div>
          <div className="flex justify-between border-t border-zinc-800/80 pt-1.5 font-semibold">
            <span className="text-zinc-300 font-sans">Total Tagihan:</span>
            <span className="text-emerald-400">
              {provider === "stripe" ? `$${(Number(amount) / 100).toFixed(2)}` : `Rp ${Number(amount).toLocaleString("id-ID")}`}
            </span>
          </div>
        </div>

        <div className="p-2.5 bg-zinc-900/50 border border-zinc-800 rounded text-[11px] text-zinc-400 leading-relaxed font-sans">
          ℹ️ <strong>Catatan Pengujian:</strong> Ini adalah lingkungan simulasi aman. Tidak ada uang atau saldo kartu riil yang akan dipotong. Klik tombol di bawah untuk memverifikasi otomatisasi webhook.
        </div>

        {paid ? (
          <div className="p-3 bg-emerald-950/30 border border-emerald-900/60 rounded-lg text-center space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <h4 className="font-semibold text-emerald-300 text-xs font-mono">Pembayaran Berhasil Diverifikasi</h4>
            <p className="text-[11px] text-zinc-400">Akun Anda otomatis di-upgrade ke PRO. Mengalihkan ke dashboard monitor...</p>
          </div>
        ) : (
          <button
            onClick={handlePay}
            disabled={processing}
            className="w-full bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 font-medium py-2 rounded-md text-xs transition border border-zinc-200 flex items-center justify-center gap-1.5 shadow-sm"
          >
            {processing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses Webhook Pembayaran...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Konfirmasi Bayar Berhasil (Simulasi)</span>
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
        <main className="min-h-screen bg-[#090a0f] text-zinc-100 flex items-center justify-center font-mono text-xs">
          <p className="text-zinc-500">Initializing sandbox gateway...</p>
        </main>
      }
    >
      <SimulatorContent />
    </Suspense>
  );
}
