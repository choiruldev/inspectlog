import { NextRequest, NextResponse } from "next/server";
import { saveFeedback, listFeedbacks } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email, message } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Pesan feedback wajib diisi." },
        { status: 400 }
      );
    }

    const result = saveFeedback(email?.trim() || "", message.trim());
    return NextResponse.json({ success: true, id: result.id });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menyimpan feedback." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const feedbacks = listFeedbacks();
    return NextResponse.json({ success: true, feedbacks });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil data feedback." },
      { status: 500 }
    );
  }
}
