import { NextRequest, NextResponse } from "next/server";
import { testAlertChannel } from "@/lib/alerts";

export async function POST(req: NextRequest) {
  try {
    const { alertType, alertDestination } = await req.json();

    if (!alertDestination) {
      return NextResponse.json(
        { success: false, error: "Tujuan notifikasi (Telegram Bot atau Webhook) tidak boleh kosong." },
        { status: 400 }
      );
    }

    const res = await testAlertChannel(alertType || "telegram", alertDestination);

    if (!res.success) {
      return NextResponse.json(
        { success: false, error: res.error || "Gagal mengirim pesan uji coba." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Pesan uji coba berhasil terkirim!" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menguji notifikasi." },
      { status: 500 }
    );
  }
}
