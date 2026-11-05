import { NextRequest, NextResponse } from "next/server";
import { listMonitors, createMonitor } from "@/lib/db";
import { validateTargetUrl } from "@/lib/security";

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

    // SSRF validation for target website URL
    const urlCheck = await validateTargetUrl(url);
    if (!urlCheck.valid) {
      return NextResponse.json(
        { success: false, error: urlCheck.reason || "URL target tidak aman (SSRF Protection)." },
        { status: 400 }
      );
    }

    // If webhook, validate destination against SSRF as well
    if (alertType === "webhook") {
      const webhookCheck = await validateTargetUrl(alertDestination);
      if (!webhookCheck.valid) {
        return NextResponse.json(
          { success: false, error: `URL Webhook tidak aman: ${webhookCheck.reason}` },
          { status: 400 }
        );
      }
    }

    const created = createMonitor({
      name: name.slice(0, 120),
      url: urlCheck.sanitizedUrl!,
      intervalMinutes: Math.min(Math.max(Number(intervalMinutes) || 60, 15), 10080),
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
