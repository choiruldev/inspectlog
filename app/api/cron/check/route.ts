import { NextRequest, NextResponse } from "next/server";
import { listMonitors } from "@/lib/db";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  try {
    // Secret protection for scheduled cron jobs in production
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get("authorization");
      const querySecret = req.nextUrl.searchParams.get("secret");
      const isAuthorized = authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret;

      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Unauthorized cron execution. Provide CRON_SECRET header or query parameter." },
          { status: 401 }
        );
      }
    }

    const monitors = listMonitors().filter((m) => m.status === "active");
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";

    const results = [];
    const now = Date.now();

    for (const monitor of monitors) {
      const lastChecked = monitor.last_checked_at ? new Date(monitor.last_checked_at).getTime() : 0;
      const intervalMs = (monitor.interval_minutes || 60) * 60 * 1000;

      // Check if it's time to run
      if (now - lastChecked >= intervalMs || !monitor.last_checked_at) {
        try {
          const runRes = await fetch(`${protocol}://${host}/api/monitors/${monitor.id}/run`, {
            method: "POST",
          });
          const runData = await runRes.json();
          results.push({ monitorId: monitor.id, name: monitor.name, ...runData });
        } catch (err: any) {
          results.push({ monitorId: monitor.id, name: monitor.name, error: err.message });
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      checkedCount: results.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menjalankan siklus cron." },
      { status: 500 }
    );
  }
}
