import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function openaiClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY ist nicht gesetzt");
  }

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}
