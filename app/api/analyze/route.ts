import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODELS = ["gemini-3.6-flash", "gemini-3.8-flash"];
const MAX_ATTEMPTS_PER_MODEL = 3;

function isRetryableGeminiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(408|429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|timeout/i.test(
    message
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithFallback(
  
  ai: GoogleGenAI,
  prompt: string
) {
  const preferredModel = process.env.GEMINI_MODEL?.trim();
  const models = [...new Set([preferredModel, ...DEFAULT_MODELS].filter((model): model is string => Boolean(model)))];
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
      try {
        return await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });
      } catch (error) {
        lastError = error;

        if (!isRetryableGeminiError(error)) {
          throw error;
        }

        if (attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
          const backoffMs = 500 * 2 ** attempt + Math.floor(Math.random() * 250);
          await delay(backoffMs);
        }
      }
    }
  }

  throw lastError ?? new Error("Gemini could not generate a response.");
}
export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || !text.trim()) {
      return Response.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY is missing from .env.local" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const today = new Date().toISOString().split("T")[0];

    const prompt = `
You are ITACHI, an AI Commitment Intelligence System.

Today's date is ${today}.

Analyze this user input and identify real commitments, promises,
tasks, deadlines and responsibilities.

INPUT:
"${text}"

Return ONLY valid JSON:

{
  "summary": "short summary",
  "commitments": [
    {
      "title": "short commitment",
      "description": "clear description",
      "deadline": "YYYY-MM-DD or null",
      "project": "project name or General",
      "priority": "LOW | MEDIUM | HIGH",
      "risk": "LOW | MEDIUM | HIGH",
      "confidence": 0.0
    }
  ]
}

Rules:
- Do not invent commitments.
- Split multiple commitments into separate objects.
- Resolve relative dates.
- If there is no deadline, use null.
- Use General if project is unknown.
- Confidence must be between 0 and 1.
- Return JSON only.
`;

    const response = await generateWithFallback(ai, prompt);

    const raw = response.text;

    if (!raw) {
      throw new Error("Gemini returned an empty response.");
    }

    const result = JSON.parse(raw);

    return Response.json(result);

  } catch (error: unknown) {
    console.error("🔥 GEMINI ERROR:", error);

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return Response.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}