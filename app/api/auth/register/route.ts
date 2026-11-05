import { NextRequest, NextResponse } from "next/server";
import { createUser, findUserByEmail, createSession } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(req: NextRequest) {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
    const rateCheck = checkRateLimit(`register:${clientIp}`, 5, 10 * 60 * 1000); // Max 5 registrations per 10 mins

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Batas pendaftaran tercapai dari alamat IP ini. Silakan coba lagi dalam beberapa menit.`,
        },
        { status: 429 }
      );
    }

    const { email, name, password } = await req.json();

    if (!email || !name || !password) {
      return NextResponse.json(
        { success: false, error: "Email, nama, dan password wajib diisi." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: "Format alamat email tidak valid." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password minimal 6 karakter." },
        { status: 400 }
      );
    }

    const existing = findUserByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Email ini sudah terdaftar." },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(password);
    const user = createUser(normalizedEmail, name.slice(0, 100).trim(), passwordHash);
    const sessionToken = createSession(user.id);

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    res.cookies.set("inspect_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
    });

    return res;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal melakukan registrasi." },
      { status: 500 }
    );
  }
}
