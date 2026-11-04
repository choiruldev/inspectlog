import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTransaction } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Silakan login terlebih dahulu untuk upgrade ke Pro." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const provider = body.provider || "midtrans";
    const planAmount = provider === "stripe" ? 1500 : 149000; // $15.00 vs Rp 149.000
    const txId = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // If Midtrans Server Key is present in environment, connect to Midtrans Snap
    const midtransServerKey = process.env.MIDTRANS_SERVER_KEY;
    let paymentUrl = "";

    if (midtransServerKey && provider === "midtrans") {
      const isProduction = process.env.NODE_ENV === "production";
      const snapEndpoint = isProduction
        ? "https://app.midtrans.com/snap/v1/transactions"
        : "https://app.sandbox.midtrans.com/snap/v1/transactions";

      const authHeader = Buffer.from(`${midtransServerKey}:`).toString("base64");
      const snapRes = await fetch(snapEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authHeader}`,
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: txId,
            gross_amount: planAmount,
          },
          customer_details: {
            first_name: user.name,
            email: user.email,
          },
          item_details: [
            {
              id: "inspect-web-pro",
              price: planAmount,
              quantity: 1,
              name: "InspectLog Pro - 1 Bulan Langganan",
            },
          ],
        }),
      });

      const snapData = await snapRes.json();
      if (snapData.redirect_url) {
        paymentUrl = snapData.redirect_url;
      }
    }

    // Fallback sandbox simulation URL if no keys configured yet
    if (!paymentUrl) {
      paymentUrl = `/payment/simulate?invoice=${txId}&amount=${planAmount}&provider=${provider}`;
    }

    const tx = createTransaction({
      id: txId,
      userId: user.id,
      amount: planAmount,
      provider,
      paymentUrl,
    });

    return NextResponse.json({
      success: true,
      transaction: tx,
      paymentUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal membuat invoice pembayaran." },
      { status: 500 }
    );
  }
}
