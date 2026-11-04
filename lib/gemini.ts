// Google Gemini API Deep Analysis Engine

interface AnalysisInput {
  url: string;
  method: string;
  status: number | string | null;
  payload: any;
  response: any;
  failureReason?: string | null;
  consoleErrors?: string[];
}

export interface AIDiagnosisResult {
  rootCause: string;
  sideFault: "Frontend" | "Backend" | "Network / CORS" | "Database / Infrastructure";
  confidence: number;
  recommendation: string;
  suggestedFixCode?: string;
  aiEngine: "Gemini 2.5 Flash" | "Built-in Expert Engine";
}

export async function analyzeErrorWithGemini(input: AnalysisInput): Promise<AIDiagnosisResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const prompt = `Anda adalah Senior Fullstack Engineer & Debugging Expert.
Analisis error API/Web berikut dengan sangat detail:
- Endpoint: ${input.method} ${input.url}
- HTTP Status: ${input.status || "Failed"}
- Request Payload (Lemparan): ${JSON.stringify(input.payload || null)}
- Response Body (Balasan): ${JSON.stringify(input.response || null)}
- Failure Reason: ${input.failureReason || "None"}
- Console Logs: ${JSON.stringify(input.consoleErrors || [])}

Kembalikan jawaban HANYA berupa JSON valid dengan format:
{
  "rootCause": "Penjelasan rinci mengapa error ini terjadi dalam bahasa Indonesia",
  "sideFault": "Frontend" | "Backend" | "Network / CORS" | "Database / Infrastructure",
  "confidence": 95,
  "recommendation": "Langkah perbaikan teknis yang konkrit untuk engineer",
  "suggestedFixCode": "Contoh potongan kode solusi jika relevan"
}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        return {
          ...parsed,
          aiEngine: "Gemini 2.5 Flash",
        };
      }
    } catch (e: any) {
      console.warn("Gemini API call failed, falling back to expert rule engine:", e.message);
    }
  }

  // Intelligent Fallback Expert Engine (Runs zero-latency when API key not configured)
  const statusNum = Number(input.status);

  if (input.failureReason?.includes("CORS") || input.failureReason?.includes("Failed to fetch")) {
    return {
      rootCause: "Browser memblokir request karena kebijakan CORS (Cross-Origin Resource Sharing). Server backend tidak menyertakan header 'Access-Control-Allow-Origin' yang mengizinkan origin frontend ini.",
      sideFault: "Backend",
      confidence: 98,
      recommendation: "Tambahkan middleware CORS di backend Anda dan pastikan header 'Access-Control-Allow-Origin' menyertakan domain frontend.",
      suggestedFixCode: `// Express.js CORS fix:\napp.use(cors({\n  origin: ['https://yourfrontend.com'],\n  credentials: true\n}));`,
      aiEngine: "Built-in Expert Engine",
    };
  }

  if (statusNum === 401) {
    return {
      rootCause: "Autentikasi gagal atau tidak disertakan. Header 'Authorization: Bearer <token>' atau session cookie tidak ada, tidak valid, atau sudah kedaluwarsa (expired).",
      sideFault: "Frontend",
      confidence: 95,
      recommendation: "Pastikan frontend melakukan refresh token sebelum request, atau arahkan user ke login page saat token expired.",
      suggestedFixCode: `// Axios interceptor refresh token:\nif (error.response?.status === 401) {\n  await refreshToken();\n  return retryOriginalRequest();\n}`,
      aiEngine: "Built-in Expert Engine",
    };
  }

  if (statusNum === 403) {
    return {
      rootCause: "Izin akses ditolak (Forbidden). Pengguna sudah terautentikasi tetapi role/permissions akun tidak memenuhi syarat untuk mengakses endpoint ini.",
      sideFault: "Backend",
      confidence: 90,
      recommendation: "Periksa Role-Based Access Control (RBAC) pada controller backend untuk endpoint terkait.",
      aiEngine: "Built-in Expert Engine",
    };
  }

  if (statusNum === 400 || statusNum === 422) {
    return {
      rootCause: "Validasi payload gagal (Bad Request). Struktur JSON atau tipe data yang dikirim oleh frontend tidak cocok dengan schema validasi yang diminta oleh backend.",
      sideFault: "Frontend",
      confidence: 92,
      recommendation: "Bandingkan 'Lemparan (Request Payload)' dengan schema DTO/Zod/Joi backend. Pastikan semua field wajib terisi dengan tipe data yang tepat.",
      aiEngine: "Built-in Expert Engine",
    };
  }

  if (statusNum >= 500) {
    return {
      rootCause: "Server backend mengalami Unhandled Exception atau Crash saat memproses endpoint ini. Biasanya disebabkan database timeout, null pointer dereference, atau uncaught Promise rejection.",
      sideFault: "Backend",
      confidence: 96,
      recommendation: "Buka log terminal/cloud server backend pada timestamp kejadian untuk membaca stack trace exception.",
      suggestedFixCode: `try {\n  const result = await processData();\n  return res.json(result);\n} catch (err) {\n  console.error("Critical API error:", err);\n  return res.status(500).json({ error: "Internal Server Error" });\n}`,
      aiEngine: "Built-in Expert Engine",
    };
  }

  return {
    rootCause: `Request mengembalikan kode status ${input.status}. Periksa isi balasan response body untuk rincian pesan kesalahan.`,
    sideFault: "Frontend",
    confidence: 85,
    recommendation: "Periksa kembali flow pemanggilan API dari halaman frontend.",
    aiEngine: "Built-in Expert Engine",
  };
}
