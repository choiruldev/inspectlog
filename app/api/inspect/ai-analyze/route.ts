import { NextRequest, NextResponse } from "next/server";
import { analyzeErrorWithGemini } from "@/lib/gemini";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(req: NextRequest) {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
    const rateCheck = checkRateLimit(`ai:${clientIp}`, 30, 3600000); // Max 30 AI requests per hour

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Batas permintaan analisis AI tercapai (30 kali per jam). Silakan coba lagi nanti.",
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const diagnosis = await analyzeErrorWithGemini(body);

    return NextResponse.json({
      success: true,
      diagnosis,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal melakukan analisis AI." },
      { status: 500 }
    );
  }
}
