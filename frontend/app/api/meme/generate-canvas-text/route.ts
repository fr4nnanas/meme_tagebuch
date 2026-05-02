import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  canvasSystemPromptInset,
  loadProjectAiContextNormalized,
} from "@/lib/meme/project-ai-context";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const body = (await request.json()) as {
      imageBase64: string;
      userText?: string;
      projectId?: string;
    };

    if (!body.imageBase64) {
      return NextResponse.json(
        { error: "Bild (base64) fehlt" },
        { status: 400 },
      );
    }

    const rawPid =
      typeof body.projectId === "string" ? body.projectId.trim() : "";

    let contextInset = "";
    if (rawPid) {
      const loaded = await loadProjectAiContextNormalized(supabase, rawPid, true);
      if (!loaded.ok) {
        return NextResponse.json(
          { error: loaded.message },
          { status: loaded.status },
        );
      }
      contextInset = canvasSystemPromptInset(loaded.normalized);
    }

    const systemPrompt = `Du bist ein Meme-Texter für deutschsprachige Memes. Analysiere das Foto und erstelle kurzen, witzigen Meme-Text.${contextInset}
Antworte NUR mit einem JSON-Objekt: {"top": string|null, "bottom": string}
- "top": optional für OBEN (null wenn nur unten passt). Höchstens zwei Textzeilen (Zeilenumbruch im String).
- "bottom": Pflicht für UNTEN, bei Bedarf zwei oder drei kurze Zeilen (Zeilenumbrüche im Text); keine extrem langen Einzeiler.
- Sprache: ausschließlich Deutsch (typische deutsche Meme-/Umgangssprache)`;

    const userContent = body.userText
      ? `Erstelle Meme-Text. Thema: ${body.userText}`
      : "Erstelle lustigen Meme-Text für dieses Foto.";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${body.imageBase64}`,
                detail: "low",
              },
            },
            { type: "text", text: `${systemPrompt}\n\n${userContent}` },
          ],
        },
      ],
      max_tokens: 150,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "KI hat keinen Text generiert" },
        { status: 500 },
      );
    }

    const parsed = JSON.parse(content) as {
      top?: string | null;
      bottom?: string;
    };

    return NextResponse.json({
      top: parsed.top ?? null,
      bottom: parsed.bottom ?? "Meme-Modus: an 😎",
    });
  } catch (err) {
    console.error("[generate-canvas-text]", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
