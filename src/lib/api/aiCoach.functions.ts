import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const coachInput = z.object({
  wave: z.number().int().min(0),
  totalWaves: z.number().int().min(1),
  hp: z.number().min(0),
  maxHp: z.number().min(1),
  level: z.number().int().min(1),
  clones: z.number().int().min(0),
  enemiesLeft: z.number().int().min(0),
  coins: z.number().int().min(0),
  shadowCoins: z.number().int().min(0),
  gameMode: z.string(),
  playMode: z.string(),
  bossName: z.string().nullable(),
  eventName: z.string().nullable(),
});

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export const getAiCoachTip = createServerFn({ method: "POST" })
  .inputValidator(coachInput)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set on the server.");
    }

    const prompt = [
      "You are an in-game AI coach for Shadow Clone Survivor.",
      "Give one short tactical tip in 1-2 sentences.",
      "Be specific, practical, and avoid spoilers or long explanations.",
      `State: wave ${data.wave}/${data.totalWaves}, hp ${Math.round(data.hp)}/${Math.round(data.maxHp)}, level ${data.level}, clones ${data.clones}, enemies left ${data.enemiesLeft}, coins ${data.coins}, shadow coins ${data.shadowCoins}, game mode ${data.gameMode}, play mode ${data.playMode}, boss ${data.bossName ?? "none"}, event ${data.eventName ?? "none"}.`,
    ].join("\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 80,
            temperature: 0.7,
          },
        }),
      },
    );

    const body = (await response.json()) as GeminiResponse;
    if (!response.ok) {
      throw new Error(body.error?.message || `Gemini request failed (${response.status})`);
    }

    const tip = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      tip: tip || "Keep moving in wide arcs, preserve space, and let your clones thin the closest enemies.",
    };
  });
