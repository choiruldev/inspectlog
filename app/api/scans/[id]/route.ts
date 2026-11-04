import { NextRequest, NextResponse } from "next/server";
import { getScan, deleteScan } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scan = getScan(id);

    if (!scan) {
      return NextResponse.json(
        { success: false, error: "Data scan tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, scan });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil data scan." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = deleteScan(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Data scan tidak ditemukan atau gagal dihapus." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Scan berhasil dihapus." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus scan." },
      { status: 500 }
    );
  }
}
