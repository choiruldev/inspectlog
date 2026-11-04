import { NextRequest, NextResponse } from "next/server";
import { analyzeErrorWithGemini } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
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
