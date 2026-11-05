"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck, ArrowRight, RefreshCw, CreditCard } from "lucide-react";

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
          <h2 className="text-sm font-semibold text-zinc-100 font-mono">Sandbox Payment Gateway</h2>
          <p className="text-[11px] text-zinc-500 font-sans">
            {provider === "midtrans" ? "Simulated Midtrans QRIS / Virtual Account" : "Stripe Checkout Simulator"}
          </p>
        </div>

        <div className="bg-[#090a0f] border border-zinc-800 rounded-lg p-3 text-xs space-y-1.5 font-mono">
          <div className="flex justify-between">
            <span className="text-zinc-500">Invoice:</span>
            <span className="text-zinc-300">{invoice}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Item:</span>
            <span className="text-zinc-300 font-sans text-xs">InspectLog PRO (1 Month)</span>
          </div>
          <div className="flex justify-between border-t border-zinc-800/80 pt-1.5 font-semibold">
            <span className="text-zinc-300 font-sans">Total Amount:</span>
            <span className="text-emerald-400">
              {provider === "stripe" ? `$${(Number(amount) / 100).toFixed(2)}` : `Rp ${Number(amount).toLocaleString("id-ID")}`}
            </span>
          </div>
        </div>

        {paid ? (
          <div className="p-3 bg-emerald-950/30 border border-emerald-900/60 rounded-lg text-center space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <h4 className="font-semibold text-emerald-300 text-xs font-mono">Payment Verified</h4>
            <p className="text-[11px] text-zinc-400">Your account is upgraded to PRO. Redirecting to monitors...</p>
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
                <span>Simulating Webhook Event...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Simulate Successful Payment</span>
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
