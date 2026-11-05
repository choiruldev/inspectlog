import { NextRequest, NextResponse } from "next/server";
import { findOrCreateGoogleUser, createSession } from "@/lib/db";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  const searchParams = req.nextUrl.searchParams;
  const demo = searchParams.get("demo");
  const code = searchParams.get("code");

  try {
    let googleUser = {
      googleId: "google_demo_10928374",
      email: "user.google@gmail.com",
      name: "Google User",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=GoogleUser",
    };

    if (code) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = `${baseUrl}/api/auth/google/callback`;

      if (clientId && clientSecret) {
        // Exchange code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });

        const tokenData = await tokenRes.json();
        if (tokenData.access_token) {
          // Fetch profile info
          const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          const profile = await profileRes.json();

          if (profile.email) {
            googleUser = {
              googleId: profile.sub || `google_${profile.email}`,
              email: profile.email,
              name: profile.name || profile.email.split("@")[0],
              avatarUrl: profile.picture || null,
            };
          }
        }
      }
    } else if (demo) {
      // Demo simulated user
      googleUser = {
        googleId: "google_dev_demo_9921",
        email: "irul.developer@gmail.com",
        name: "Irul (Google)",
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=IrulDev",
      };
    }

    const user = findOrCreateGoogleUser(googleUser);
    const sessionToken = createSession(user.id);

    const redirectRes = NextResponse.redirect(baseUrl);
    redirectRes.cookies.set("inspect_session", sessionToken, {
      httpOnly: true,
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
    });

    return redirectRes;
  } catch (err: any) {
    console.error("Google Auth Callback Error:", err);
    return NextResponse.redirect(`${baseUrl}?auth_error=google_failed`);
  }
}
