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
  const failureReasonLower = (input.failureReason || "").toLowerCase();
  const urlLower = (input.url || "").toLowerCase();

  // JavaScript Runtime Crashes & Exceptions
  if (
    failureReasonLower.includes("cannot read properties") ||
    failureReasonLower.includes("undefined") ||
    failureReasonLower.includes("null") ||
    failureReasonLower.includes("typeerror") ||
    failureReasonLower.includes("referenceerror") ||
    failureReasonLower.includes("uncaught")
  ) {
    return {
      rootCause: `Script JavaScript frontend mengalami runtime exception: "${input.failureReason || "Null pointer dereference"}". Kode mencoba mengakses properti atau memanggil fungsi pada objek yang bernilai undefined atau null.`,
      sideFault: "Frontend",
      confidence: 98,
      recommendation: "Gunakan optional chaining (`?.`), null-coalescing operator (`??`), atau defensive null-checking sebelum mengakses properti objek.",
      suggestedFixCode: `// Contoh perbaikan dengan optional chaining & fallback:\nconst result = data?.items?.map(item => item?.title) ?? [];\n\n// Atau penanganan defensive if-check:\nif (order && typeof order.calculateTotal === "function") {\n  order.calculateTotal();\n}`,
      aiEngine: "Built-in Expert Engine",
    };
  }

  // Unhandled Promise Rejections
  if (failureReasonLower.includes("promise") || failureReasonLower.includes("unhandled")) {
    return {
      rootCause: "Pemanggilan fungsi asinkron (Promise) mengalami penolakan (rejection) tanpa blok penanganan error (`.catch()` atau `try-catch`).",
      sideFault: "Frontend",
      confidence: 96,
      recommendation: "Bungkus setiap asynchronous execution / Promise dengan blok `try-catch` atau rantai `.catch()` agar thread browser tidak crash.",
      suggestedFixCode: `// Pola try-catch untuk async/await:\ntry {\n  const res = await performAsyncTask();\n} catch (err) {\n  console.error("Async error tertangkap:", err);\n}`,
      aiEngine: "Built-in Expert Engine",
    };
  }

  if (failureReasonLower.includes("cors") || failureReasonLower.includes("failed to fetch")) {
    return {
      rootCause: "Browser memblokir request karena kebijakan CORS (Cross-Origin Resource Sharing). Server backend tidak menyertakan header 'Access-Control-Allow-Origin' yang mengizinkan origin frontend ini.",
      sideFault: "Network / CORS",
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
      suggestedFixCode: `// Verifikasi role middleware backend:\nfunction requireRole(role) {\n  return (req, res, next) => {\n    if (req.user?.role !== role) {\n      return res.status(403).json({ error: "Access denied" });\n    }\n    next();\n  };\n}`,
      aiEngine: "Built-in Expert Engine",
    };
  }

  if (statusNum === 404) {
    return {
      rootCause: `Endpoint atau file resource '${input.url}' tidak ditemukan di server (HTTP 404). Route belum terdaftar di backend atau path URL pada frontend salah ketik (typo).`,
      sideFault: "Backend",
      confidence: 94,
      recommendation: "Pastikan router backend mendefinisikan URL endpoint ini dan periksa kembali base URL API pada konfigurasi frontend.",
      suggestedFixCode: `// Daftarkan route di router backend:\nrouter.get('/api/endpoint-target', handlerController);`,
      aiEngine: "Built-in Expert Engine",
    };
  }

  if (statusNum === 400 || statusNum === 422) {
    return {
      rootCause: "Validasi payload gagal (Bad Request / Unprocessable Entity). Struktur JSON atau tipe data yang dikirim oleh frontend tidak cocok dengan schema validasi yang diminta oleh backend.",
      sideFault: "Frontend",
      confidence: 92,
      recommendation: "Bandingkan 'Lemparan (Request Payload)' dengan schema DTO/Zod/Joi backend. Pastikan semua field wajib terisi dengan tipe data yang tepat.",
      suggestedFixCode: `// Schema validasi (contoh Zod):\nconst payloadSchema = z.object({\n  email: z.string().email(),\n  quantity: z.number().int().min(1)\n});`,
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
