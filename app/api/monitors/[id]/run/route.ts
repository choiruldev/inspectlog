import { NextRequest, NextResponse } from "next/server";
import { getMonitor, updateMonitorCheck } from "@/lib/db";
import { sendTelegramAlert, sendWebhookAlert } from "@/lib/alerts";
import { checkRateLimit } from "@/lib/rate-limiter";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
    const rateCheck = checkRateLimit(`monitor_run:${clientIp}`, 15, 10 * 60 * 1000);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Batas eksekusi pemindaian monitor tercapai. Harap tunggu beberapa saat." },
        { status: 429 }
      );
    }

    const { id } = await params;
    if (!id || !/^[a-zA-Z0-9_-]{5,80}$/.test(id)) {
      return NextResponse.json({ success: false, error: "ID format tidak valid." }, { status: 400 });
    }
    const monitor = getMonitor(id);

    if (!monitor) {
      return NextResponse.json(
        { success: false, error: "Monitor tidak ditemukan." },
        { status: 404 }
      );
    }

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const inspectUrl = `${protocol}://${host}/api/inspect`;

    // Trigger internal inspect
    const inspectRes = await fetch(inspectUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: monitor.url,
        waitDuration: 3000,
        authMode: "none",
        crawlMode: "single",
        captureScreenshot: true,
      }),
    });

    const inspectData = await inspectRes.json();
    if (!inspectRes.ok || !inspectData.success) {
      throw new Error(inspectData.error || "Gagal melakukan inspect otomatis.");
    }

    const healthScore = inspectData.meta.healthScore;
    const errorCount = inspectData.meta.errorRequestsCount;
    const statusCode = inspectData.meta.errorRequestsCount > 0 ? 500 : 200;
    const scanId = inspectData.id;

    let alertSent = false;
    let alertError: string | null = null;

    // Send alert if health score is critically low or has error requests
    if (healthScore < 85 || errorCount > 0) {
      const criticalIssues = (inspectData.diagnostics || [])
        .map((d: any) => `[${d.severity}] ${d.title}: ${d.endpoint || ""}`)
        .slice(0, 5);

      const reportUrl = `${protocol}://${host}/report/${scanId}`;

      const alertPayload = {
        url: monitor.url,
        monitorName: monitor.name,
        healthScore,
        statusCode,
        errorCount,
        criticalIssues,
        reportUrl,
      };

      if (monitor.alert_type === "telegram") {
        const alertRes = await sendTelegramAlert(monitor.alert_destination, alertPayload);
        alertSent = alertRes.success;
        if (!alertRes.success) alertError = alertRes.error || null;
      } else {
        const alertRes = await sendWebhookAlert(monitor.alert_destination, alertPayload);
        alertSent = alertRes.success;
        if (!alertRes.success) alertError = alertRes.error || null;
      }
    }

    // Update monitor last check record
    updateMonitorCheck(monitor.id, statusCode, healthScore, scanId, alertSent);

    return NextResponse.json({
      success: true,
      healthScore,
      errorCount,
      scanId,
      alertSent,
      alertError,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menjalankan pemindaian monitor." },
      { status: 500 }
    );
  }
}
