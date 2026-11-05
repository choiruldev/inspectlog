import { NextRequest, NextResponse } from "next/server";
import { markTransactionPaid } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Midtrans Webhook Handler
    if (body.order_id && body.transaction_status) {
      const orderId = body.order_id;
      const status = body.transaction_status;

      if (status === "settlement" || status === "capture") {
        markTransactionPaid(orderId);
        return NextResponse.json({ success: true, message: "Midtrans transaction marked as paid." });
      }
    }

    // 2. Stripe Webhook Handler
    if (body.type === "checkout.session.completed") {
      const orderId = body.data?.object?.client_reference_id || body.data?.object?.id;
      if (orderId) {
        markTransactionPaid(orderId);
        return NextResponse.json({ success: true, message: "Stripe checkout marked as paid." });
      }
    }

    // 3. Sandbox Simulator Webhook (Allowed in development or when ENABLE_PAYMENT_SIMULATOR is set)
    if (body.invoice && body.action === "simulate_paid") {
      if (process.env.NODE_ENV === "production" && process.env.ENABLE_PAYMENT_SIMULATOR !== "true") {
        return NextResponse.json(
          { success: false, error: "Simulasi pembayaran sandbox dinonaktifkan di lingkungan produksi." },
          { status: 403 }
        );
      }
      markTransactionPaid(body.invoice);
      return NextResponse.json({ success: true, message: "Sandbox simulated payment confirmed!" });
    }

    return NextResponse.json({ success: true, message: "Event received." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses webhook." },
      { status: 500 }
    );
  }
}
