const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_TIMEOUT_MS = 15_000;

interface GeminiGenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export interface GeminiCallResult {
  contentTh: string;
  model: string;
}

// Plain REST call instead of the @google/generative-ai SDK — one endpoint, one JSON shape,
// not worth the extra dependency per backend-engineer's minimal-footprint rule.
export async function callGemini(prompt: string): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY ไม่ได้ตั้งค่าไว้");
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Gemini API ไม่ตอบสนองภายใน ${GEMINI_TIMEOUT_MS / 1000} วินาที`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Gemini API ตอบกลับผิดพลาด (${response.status}): ${errorBody.slice(0, 500)}`);
  }

  const data = (await response.json()) as GeminiGenerateContentResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Gemini API ไม่ได้ส่งข้อความกลับมา");
  }

  return { contentTh: text, model };
}
