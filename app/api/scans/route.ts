import { NextResponse } from "next/server";
import { listRecentScans } from "@/lib/db";

export async function GET() {
  try {
    const scans = listRecentScans(30);
    return NextResponse.json({ success: true, scans });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil daftar scan." },
      { status: 500 }
    );
  }
}
