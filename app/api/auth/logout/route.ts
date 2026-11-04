import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession } from "@/lib/db";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("inspect_session")?.value;
    if (token) {
      deleteSession(token);
    }

    const res = NextResponse.json({ success: true, message: "Berhasil logout." });
    res.cookies.delete("inspect_session");
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal logout." },
      { status: 500 }
    );
  }
}
