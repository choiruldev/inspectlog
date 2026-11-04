// Alert Dispatcher for Telegram Bot & Webhooks (Discord, Slack, Custom)

interface AlertPayload {
  url: string;
  monitorName: string;
  healthScore: number;
  statusCode?: number | string;
  errorCount: number;
  criticalIssues: string[];
  reportUrl?: string;
}

export async function sendTelegramAlert(
  destination: string, // format: "BOT_TOKEN:CHAT_ID" or JSON
  payload: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    let botToken = "";
    let chatId = "";

    if (destination.includes(":") && !destination.startsWith("http")) {
      const parts = destination.split(":");
      botToken = parts.slice(0, 2).join(":"); // bot tokens usually look like 123456789:ABCdef...
      // if format is BOT_TOKEN#CHAT_ID or BOT_TOKEN:CHAT_ID
      const lastColon = destination.lastIndexOf(":");
      botToken = destination.substring(0, lastColon);
      chatId = destination.substring(lastColon + 1);
    } else {
      try {
        const parsed = JSON.parse(destination);
        botToken = parsed.botToken;
        chatId = parsed.chatId;
      } catch {
        return { success: false, error: "Format Telegram Destination salah. Gunakan BOT_TOKEN:CHAT_ID" };
      }
    }

    if (!botToken || !chatId) {
      return { success: false, error: "Bot Token atau Chat ID Telegram kosong." };
    }

    const issuesList = payload.criticalIssues.length > 0
      ? payload.criticalIssues.map((issue) => `• ${issue}`).join("\n")
      : "• HTTP Error / Health score di bawah ambang batas";

    const text = `🚨 *INSPECT-WEB: INCIDENT ALERT!*
----------------------------------
🎯 *Target:* \`${payload.url}\`
🏷️ *Monitor:* ${payload.monitorName}
❤️ *Health Score:* ${payload.healthScore}/100
❌ *Total API Error:* ${payload.errorCount}

📋 *Rincian Masalah:*
${issuesList}

${payload.reportUrl ? `🔗 [Buka Laporan Lengkap](${payload.reportUrl})` : ""}
⏰ *Waktu:* ${new Date().toLocaleString("id-ID")}`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { success: false, error: data.description || "Gagal mengirim pesan Telegram." };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error Telegram API." };
  }
}

export async function sendWebhookAlert(
  webhookUrl: string,
  payload: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const isDiscord = webhookUrl.includes("discord.com");
    const isSlack = webhookUrl.includes("slack.com");

    let body: any;

    if (isDiscord) {
      body = {
        embeds: [
          {
            title: `🚨 Incident Alert: ${payload.monitorName}`,
            description: `**URL:** ${payload.url}\n**Health Score:** ${payload.healthScore}/100\n**API Errors:** ${payload.errorCount}`,
            color: 15158332, // Red
            fields: [
              {
                name: "Masalah Terdeteksi",
                value: payload.criticalIssues.join("\n").substring(0, 1000) || "Endpoint failure",
              },
            ],
            url: payload.reportUrl,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    } else if (isSlack) {
      body = {
        text: `🚨 *Alert ${payload.monitorName}*: ${payload.url} mengalami error (Score: ${payload.healthScore}/100, Errors: ${payload.errorCount}). ${payload.reportUrl || ""}`,
      };
    } else {
      // Generic Webhook
      body = {
        event: "api_failure_detected",
        ...payload,
        timestamp: new Date().toISOString(),
      };
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { success: false, error: `Webhook gagal dengan status HTTP ${res.status}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error Webhook." };
  }
}

export async function testAlertChannel(
  type: "telegram" | "webhook",
  destination: string
): Promise<{ success: boolean; error?: string }> {
  const dummyPayload: AlertPayload = {
    url: "https://example.com/checkout",
    monitorName: "Uji Coba Notifikasi",
    healthScore: 45,
    statusCode: 500,
    errorCount: 1,
    criticalIssues: ["Test Koneksi: Integrasi Notifikasi Alert Berhasil Aktif!"],
  };

  if (type === "telegram") {
    return sendTelegramAlert(destination, dummyPayload);
  } else {
    return sendWebhookAlert(destination, dummyPayload);
  }
}
