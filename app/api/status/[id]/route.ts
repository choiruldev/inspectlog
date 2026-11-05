import { NextRequest, NextResponse } from "next/server";
import { getMonitor, getMonitorLogs } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !/^[a-zA-Z0-9_-]{5,80}$/.test(id)) {
      return NextResponse.json({ success: false, error: "ID format tidak valid." }, { status: 400 });
    }

    const monitor = getMonitor(id);
    if (!monitor) {
      return NextResponse.json({ success: false, error: "Monitor tidak ditemukan." }, { status: 404 });
    }

    const logs = getMonitorLogs(id, 30);

    // Calculate uptime statistics
    const totalChecks = logs.length;
    const successfulChecks = logs.filter((l) => l.health_score >= 80).length;
    const uptimePercentage = totalChecks > 0 ? ((successfulChecks / totalChecks) * 100).toFixed(1) : "100.0";

    return NextResponse.json({
      success: true,
      monitor: {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        intervalMinutes: monitor.interval_minutes,
        status: monitor.status,
        lastCheckedAt: monitor.last_checked_at,
        lastStatus: monitor.last_status,
        lastHealthScore: monitor.last_health_score,
        createdAt: monitor.created_at,
        uptimePercentage,
      },
      logs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat status publik." },
      { status: 500 }
    );
  }
}
