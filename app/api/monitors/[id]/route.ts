import { NextRequest, NextResponse } from "next/server";
import { deleteMonitor, toggleMonitorStatus, getMonitor } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = deleteMonitor(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Monitor tidak ditemukan atau gagal dihapus." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Monitor berhasil dihapus." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus monitor." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await req.json();

    if (status !== "active" && status !== "paused") {
      return NextResponse.json(
        { success: false, error: "Status harus 'active' atau 'paused'." },
        { status: 400 }
      );
    }

    const updated = toggleMonitorStatus(id, status);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Monitor tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengubah status monitor." },
      { status: 500 }
    );
  }
}
