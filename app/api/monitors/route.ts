import { NextRequest, NextResponse } from "next/server";
import { listMonitors, createMonitor } from "@/lib/db";

export async function GET() {
  try {
    const monitors = listMonitors();
    return NextResponse.json({ success: true, monitors });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil daftar monitor." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, url, intervalMinutes, alertType, alertDestination } = body;

    if (!url || !name || !alertDestination) {
      return NextResponse.json(
        { success: false, error: "Nama, URL Target, dan Tujuan Alert wajib diisi." },
        { status: 400 }
      );
    }

    const created = createMonitor({
      name,
      url: url.startsWith("http") ? url : `https://${url}`,
      intervalMinutes: Number(intervalMinutes) || 60,
      alertType: alertType || "telegram",
      alertDestination,
    });

    return NextResponse.json({ success: true, ...created });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal membuat monitor." },
      { status: 500 }
    );
  }
}
