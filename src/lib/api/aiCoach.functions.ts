import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const coachInput = z.object({
  language: z.string().default("en"),
  question: z.string().max(500).optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "coach"]),
    text: z.string().max(2000),
  })).max(8).default([]),
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

const FALLBACK_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ru: "Russian",
  kk: "Kazakh",
  uk: "Ukrainian",
  tr: "Turkish",
  de: "German",
  ko: "Korean",
  zh: "Chinese",
  mn: "Mongolian",
};

function compactMessage(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 700 ? `${cleaned.slice(0, 700)}...` : cleaned;
}

function cleanCoachTip(text: string) {
  return text
    .split("\n")
    .map((line) => line
      .replace(/^\s*[-*•]\s+/, "")
      .replace(/^\s*\d+[.)]\s+/, "")
      .replace(/\*\*/g, "")
      .trim())
    .filter(Boolean)
    .join("\n");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTemporaryGeminiError(status: number, message?: string) {
  return status === 429 || status === 500 || status === 503 || /high demand|overloaded|temporar|try again/i.test(message ?? "");
}

function localCoachTip(language: string) {
  if (language === "Russian") {
    return [
      "Gemini сейчас перегружен, но вот быстрый разбор:",
      "Движение: Двигайся широкими кругами, чтобы не загонять себя в угол.",
      "Клоны: Держи клонов между собой и ближайшими врагами.",
      "Улучшения: Перед боссом лучше брать выживаемость или урон, а не случайные слабые улучшения.",
      "Экономика: Если врагов много, сначала освободи пространство, потом собирай монеты.",
    ].join("\n");
  }

  return [
    "Gemini is busy right now, but here is a quick coach read:",
    "Movement: Move in wide arcs so you do not trap yourself.",
    "Clones: Keep clones between you and the closest enemies.",
    "Upgrades: Before bosses, prioritize survival or damage over weak random upgrades.",
    "Economy: If the screen is crowded, make space first, then collect coins.",
  ].join("\n");
}

export const getAiCoachTip = createServerFn({ method: "POST" })
  .inputValidator(coachInput)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set on the server.");
    }

    const language = LANGUAGE_NAMES[data.language] ?? "English";
    const history = data.messages
      .slice(-6)
      .map((message) => `${message.role === "coach" ? "Coach" : "Player"}: ${compactMessage(message.text)}`)
      .join("\n");

    const prompt = [
      "You are an in-game AI coach for Shadow Clone Survivor.",
      `Answer only in ${language}. If the language is Russian, use natural Russian.`,
      "Explain clearly so a new player can understand, but keep it useful for experienced players.",
      "Give varied advice, not the same one-line tip every time.",
      "Respond like a chat coach: answer the player's question, then add 3-5 practical points about movement, clones, upgrades, bosses, economy, or survival based on the current state.",
      "Do not use markdown, asterisks, bullet dots, bullet symbols, or numbered lists.",
      "Format practical points as plain lines like 'Movement: advice' or, in Russian, 'Движение: совет'.",
      "Keep the answer compact: short paragraphs, no markdown table.",
      `State: wave ${data.wave}/${data.totalWaves}, hp ${Math.round(data.hp)}/${Math.round(data.maxHp)}, level ${data.level}, clones ${data.clones}, enemies left ${data.enemiesLeft}, coins ${data.coins}, shadow coins ${data.shadowCoins}, game mode ${data.gameMode}, play mode ${data.playMode}, boss ${data.bossName ?? "none"}, event ${data.eventName ?? "none"}.`,
      history ? `Recent chat:\n${history}` : "",
      `Player question: ${data.question?.trim() || "Analyze my current run and tell me what I should understand and do next."}`,
    ].join("\n");

    const models = Array.from(new Set([model, ...FALLBACK_MODELS]));
    let lastError = "";

    for (const candidateModel of models) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`,
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
                maxOutputTokens: 260,
                temperature: 0.85,
              },
            }),
          },
        );

        const body = (await response.json()) as GeminiResponse;
        if (response.ok) {
          const tip = body.candidates?.[0]?.content?.parts
            ?.map((part) => part.text)
            .filter(Boolean)
            .join(" ")
            .trim();

          return {
            tip: cleanCoachTip(tip || localCoachTip(language)),
          };
        }

        lastError = body.error?.message || `Gemini request failed (${response.status})`;
        if (!isTemporaryGeminiError(response.status, lastError)) {
          throw new Error(lastError);
        }

        await sleep(400 + attempt * 700);
      }
    }

    return {
      tip: localCoachTip(language),
      temporary: true,
      error: lastError,
    };
  });
