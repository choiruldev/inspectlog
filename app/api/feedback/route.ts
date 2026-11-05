import { NextRequest, NextResponse } from "next/server";
import { saveFeedback, listFeedbacks } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(req: NextRequest) {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
    const rateCheck = checkRateLimit(`feedback:${clientIp}`, 10, 3600000); // Max 10 feedbacks/hour

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Batas pengiriman feedback tercapai. Silakan coba lagi nanti." },
        { status: 429 }
      );
    }

    const { email, message } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Pesan feedback wajib diisi." },
        { status: 400 }
      );
    }

    const cleanEmail = (email || "").slice(0, 150).trim();
    const cleanMessage = message.slice(0, 3000).trim();

    const result = saveFeedback(cleanEmail, cleanMessage);
    return NextResponse.json({ success: true, id: result.id });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menyimpan feedback." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Only authenticated users can view feedback lists
    const user = await getCurrentUser();
    const adminKey = req.headers.get("x-admin-key") || req.nextUrl.searchParams.get("admin_key");
    const isAuthorized = (user && user.role === "pro") || (process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Akses ditolak. Endpoint ini hanya untuk administrator." },
        { status: 403 }
      );
    }

    const feedbacks = listFeedbacks();
    return NextResponse.json({ success: true, feedbacks });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil data feedback." },
      { status: 500 }
    );
  }
}
