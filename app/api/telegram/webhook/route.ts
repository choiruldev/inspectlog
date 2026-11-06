import { NextRequest, NextResponse } from "next/server";
import { createMonitor, listMonitors, getMonitor } from "@/lib/db";
import { analyzeErrorWithGemini } from "@/lib/gemini";
import { validateTargetUrl } from "@/lib/security";

export const maxDuration = 120;

// Helper to send message to Telegram
async function sendTelegramMessage(botToken: string, chatId: number | string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
  } catch (err: any) {
    console.error("Failed to send telegram message:", err.message);
  }
}

// GET: Helper / Healthcheck / Easy Webhook Setup
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const token = searchParams.get("token") || process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = searchParams.get("url");

  if (action === "set_webhook" && token && webhookUrl) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
      );
      const data = await res.json();
      return NextResponse.json({ success: true, result: data });
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    status: "active",
    message: "InspectLog Telegram Webhook Endpoint is ready.",
    guide: {
      step1: "Dapatkan BOT_TOKEN dari @BotFather di Telegram.",
      step2: "Set Webhook URL ke: https://domain-anda.com/api/telegram/webhook?token=BOT_TOKEN",
      step3: "Atau gunakan query ?action=set_webhook&token=BOT_TOKEN&url=https://domain-anda.com/api/telegram/webhook",
    },
  });
}

// POST: Incoming Updates from Telegram
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const botToken = searchParams.get("token") || process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return NextResponse.json(
        { error: "Bot token not configured. Pass ?token=BOT_TOKEN or set TELEGRAM_BOT_TOKEN env." },
        { status: 400 }
      );
    }

    const update = await req.json();
    const message = update.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";

    // 1. Command: /start or /help
    if (text === "/start" || text === "/help") {
      const helpMsg = `🤖 *InspectLog Autonomous Bug Inspector Bot*
━━━━━━━━━━━━━━━━━━
Bot ini dapat memindai website secara otonom menggunakan headless browser Playwright, mendeteksi runtime crash, API failures (4xx/5xx), CORS, serta memberikan rekomendasi perbaikan dengan AI.

📌 *Perintah Utama:*
• \`/scan <url>\` — Pindai website & cari semua bug sekarang
• \`/monitor <url> [menit]\` — Daftarkan website untuk pemantauan otomatis berkala
• \`/monitors\` — Lihat daftar website yang sedang dipantau
• \`/test\` — Uji coba scan pada Bug Testing Lab internal

💡 *Contoh:*
\`/scan https://example.com/checkout\`
\`/monitor https://mysite.com 30\``;

      await sendTelegramMessage(botToken, chatId, helpMsg);
      return NextResponse.json({ ok: true });
    }

    // 2. Command: /test (Scan Local Bug Simulator)
    if (text === "/test") {
      const targetUrl = `${protocol}://${host}/playground?autobug=true`;
      await sendTelegramMessage(
        botToken,
        chatId,
        `🧪 *Menjalankan Uji Coba Bug Playground...*\nMemindai: \`${targetUrl}\`\nMohon tunggu 3-5 detik.`
      );
      await executeAndReportScan(botToken, chatId, targetUrl, host, protocol);
      return NextResponse.json({ ok: true });
    }

    // 3. Command: /scan or /inspect
    if (text.startsWith("/scan") || text.startsWith("/inspect")) {
      const parts = text.split(/\s+/);
      let targetUrl = parts[1];

      if (!targetUrl) {
        await sendTelegramMessage(
          botToken,
          chatId,
          "⚠️ *Format salah.*\nGunakan: `/scan <url>`\nContoh: `/scan https://google.com`"
        );
        return NextResponse.json({ ok: true });
      }

      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        targetUrl = `https://${targetUrl}`;
      }

      await sendTelegramMessage(
        botToken,
        chatId,
        `🔍 *Memulai Pemindaian Otonom...*\nTarget: \`${targetUrl}\`\nSedang memonitor Network, Console, & Exception...`
      );

      await executeAndReportScan(botToken, chatId, targetUrl, host, protocol);
      return NextResponse.json({ ok: true });
    }

    // 4. Command: /monitor <url> [intervalMinutes]
    if (text.startsWith("/monitor")) {
      const parts = text.split(/\s+/);
      let targetUrl = parts[1];
      const interval = parseInt(parts[2], 10) || 60;

      if (!targetUrl) {
        await sendTelegramMessage(
          botToken,
          chatId,
          "⚠️ *Format salah.*\nGunakan: `/monitor <url> [interval_menit]`\nContoh: `/monitor https://tokosaya.com 30`"
        );
        return NextResponse.json({ ok: true });
      }

      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        targetUrl = `https://${targetUrl}`;
      }

      const monitorName = new URL(targetUrl).hostname;
      const destination = `${botToken}:${chatId}`;

      const newMon = createMonitor({
        name: monitorName,
        url: targetUrl,
        intervalMinutes: interval,
        alertType: "telegram",
        alertDestination: destination,
      });

      const confirmMsg = `✅ *Pemantauan Otonom Aktif!*
━━━━━━━━━━━━━━━━━━
🏷️ *Nama:* ${monitorName}
🎯 *Target URL:* \`${targetUrl}\`
⏱️ *Interval Cek:* Setiap ${interval} menit
📢 *Notifikasi:* Dikirim otomatis ke chat ini jika ada bug/crash!
🆔 *Monitor ID:* \`${newMon.id}\``;

      await sendTelegramMessage(botToken, chatId, confirmMsg);
      return NextResponse.json({ ok: true });
    }

    // 5. Command: /monitors or /status
    if (text === "/monitors" || text === "/status") {
      const monitors = listMonitors();
      if (monitors.length === 0) {
        await sendTelegramMessage(
          botToken,
          chatId,
          "ℹ️ Belum ada website yang dipantau.\nGunakan `/monitor <url> 60` untuk menambahkan pemantauan."
        );
        return NextResponse.json({ ok: true });
      }

      let listText = `📋 *Daftar Pemantauan Otonom (${monitors.length}):*\n━━━━━━━━━━━━━━━━━━\n`;
      monitors.forEach((m, idx) => {
        const statusEmoji = m.status === "active" ? "🟢" : "⏸️";
        const health = m.last_health_score !== null && m.last_health_score !== undefined
          ? `${m.last_health_score}/100`
          : "Belum dicek";
        listText += `${idx + 1}. ${statusEmoji} *${m.name}*\n   URL: \`${m.url}\`\n   Interval: ${m.interval_minutes}m | Health: ${health}\n\n`;
      });

      await sendTelegramMessage(botToken, chatId, listText);
      return NextResponse.json({ ok: true });
    }

    // Default unknown command
    await sendTelegramMessage(
      botToken,
      chatId,
      "❓ Perintah tidak dikenali. Ketik `/help` untuk melihat panduan."
    );
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// Core Execution: Runs Headless Playwright Scan & Produces AI Solutions
async function executeAndReportScan(
  botToken: string,
  chatId: number | string,
  targetUrl: string,
  host: string,
  protocol: string
) {
  try {
    const inspectRes = await fetch(`${protocol}://${host}/api/inspect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: targetUrl,
        waitDuration: 3500,
        captureScreenshot: false,
      }),
    });

    const inspectData = await inspectRes.json();

    if (!inspectRes.ok || !inspectData.success) {
      await sendTelegramMessage(
        botToken,
        chatId,
        `❌ *Gagal memindai:* ${inspectData.error || "Terjadi kesalahan internal saat pemindaian."}`
      );
      return;
    }

    const meta = inspectData.meta;
    const diagnostics = inspectData.diagnostics || [];
    const reportUrl = `${protocol}://${host}/report/${inspectData.id}`;

    // If clean website
    if (meta.errorRequestsCount === 0 && meta.pageErrorsCount === 0 && meta.consoleErrorsCount === 0) {
      const cleanMsg = `✅ *WEBSITE BERSIH & SEHAT!*
━━━━━━━━━━━━━━━━━━
🎯 *Target:* \`${targetUrl}\`
❤️ *Health Score:* 100/100
📊 *Total Requests:* ${meta.totalRequestsCount}
⏱️ *Load Time:* ${meta.navigationTimeMs}ms

Tidak ditemukan HTTP 4xx/5xx, CORS error, atau runtime crash JavaScript.`;
      await sendTelegramMessage(botToken, chatId, cleanMsg);
      return;
    }

    // If bugs were detected
    let reportMsg = `🚨 *HASIL TEMUAN BUG & ERROR*
━━━━━━━━━━━━━━━━━━
🎯 *Target:* \`${targetUrl}\`
❤️ *Health Score:* ${meta.healthScore}/100
❌ *Error Requests:* ${meta.errorRequestsCount}
💣 *JS Runtime Crashes:* ${meta.pageErrorsCount}
⚠️ *Console Errors:* ${meta.consoleErrorsCount}

📋 *Daftar Masalah Terdeteksi:*
`;

    // Take top 3 critical issues
    const topIssues = diagnostics.slice(0, 3);
    topIssues.forEach((issue: any, i: number) => {
      reportMsg += `${i + 1}. *[${issue.severity}]* ${issue.title}\n   ${issue.endpoint ? `Endpoint: \`${issue.endpoint}\`\n` : ""}`;
    });

    // Run AI Diagnosis on the primary critical issue
    if (topIssues.length > 0) {
      const prime = topIssues[0];
      const ai = await analyzeErrorWithGemini({
        url: prime.endpoint || targetUrl,
        method: "API/PAGE",
        status: prime.status || 500,
        payload: prime.payload,
        response: prime.response,
        failureReason: prime.details,
      });

      reportMsg += `
💡 *Diagnosa & Solusi AI (${ai.aiEngine}):*
• *Sumber Masalah:* ${ai.sideFault} (Keyakinan: ${ai.confidence}%)
• *Akar Masalah:* ${ai.rootCause}
• *Saran Perbaikan:* ${ai.recommendation}
`;

      if (ai.suggestedFixCode) {
        reportMsg += `\n💻 *Contoh Kode Solusi:*\n\`\`\`javascript\n${ai.suggestedFixCode}\n\`\`\`\n`;
      }
    }

    reportMsg += `\n🔗 [Buka Laporan Interaktif di Web](${reportUrl})`;

    await sendTelegramMessage(botToken, chatId, reportMsg);
  } catch (err: any) {
    await sendTelegramMessage(
      botToken,
      chatId,
      `❌ *Error selama pemindaian:* ${err.message}`
    );
  }
}
