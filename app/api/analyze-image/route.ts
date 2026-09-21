import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image || typeof image !== "string") {
      return Response.json(
        { error: "No camera image provided." },
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

    const match = image.match(/^data:(image\/[^;]+);base64,(.+)$/);

    if (!match) {
      return Response.json(
        { error: "Invalid camera image format." },
        { status: 400 }
      );
    }

    const mimeType = match[1];
    const base64Data = match[2];

    const ai = new GoogleGenAI({ apiKey });
    const today = new Date().toISOString().split("T")[0];

    const prompt = `
You are ITACHI, an AI Commitment Intelligence System.

Today's date is ${today}.

Analyze this camera image. It may contain a whiteboard,
handwritten note, meeting note, task list, or screen.

Identify only real commitments, promises, tasks, deadlines,
and responsibilities that are visible in the image.

Return ONLY valid JSON:

{
  "summary": "short summary of what was found",
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
- Do not invent text or commitments.
- If text is unclear, do not guess.
- Split multiple commitments into separate objects.
- Resolve relative dates when the image provides enough information.
- If there is no deadline, use null.
- Use General if the project is unknown.
- Confidence must be between 0 and 1.
- Return JSON only.
`;

    const models = [
      process.env.GEMINI_MODEL || "gemini-3.6-flash",
      "gemini-3.8-flash",
      "gemini-3.5-flash",
    ];

    let lastError: unknown = null;

    for (const model of [...new Set(models)]) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(
            `📷 ITACHI Camera AI: trying ${model} (attempt ${attempt})`
          );

          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            config: {
              responseMimeType: "application/json",
            },
          });

          const raw = response.text;

          if (!raw) {
            throw new Error("Gemini returned an empty response.");
          }

          const result = JSON.parse(raw);

          console.log(
            `✅ ITACHI Camera AI succeeded with ${model}`
          );

          return Response.json(result);
        } catch (error: unknown) {
          lastError = error;

          const message =
            error instanceof Error
              ? error.message
              : String(error);

          console.error(
            `⚠️ Camera AI ${model} attempt ${attempt} failed:`,
            message
          );

          const isTemporary =
            message.includes("503") ||
            message.includes("UNAVAILABLE") ||
            message.includes("high demand") ||
            message.includes("overloaded");

          if (!isTemporary) {
            break;
          }

          if (attempt === 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, 1200)
            );
          }
        }
      }
    }

    const message =
      lastError instanceof Error
        ? lastError.message
        : String(lastError);

    return Response.json(
      {
        error:
          "Gemini is temporarily busy. ITACHI tried multiple available models. Please try the camera again in a moment.",
        details: message,
      },
      { status: 503 }
    );
  } catch (error: unknown) {
    console.error("🔥 GEMINI IMAGE ERROR:", error);

    const message =
      error instanceof Error ? error.message : String(error);

    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
}