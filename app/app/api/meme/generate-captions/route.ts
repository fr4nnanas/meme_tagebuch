import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  ideasPromptProjectContextBlock,
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
      hints?: string;
      projectId?: string;
    };

    if (!body.imageBase64) {
      return NextResponse.json(
        { error: "Bild (base64) fehlt" },
        { status: 400 },
      );
    }

    const hintsTrimmed = body.hints?.trim();
    const safeHints = hintsTrimmed
      ? hintsTrimmed.replace(/\s+/g, " ").slice(0, 240)
      : "";
    const hintsBlock = safeHints
      ? `\nOptionale Stichworte vom Nutzer (sinnvoll in alle vier Ideen einbeziehen): ${safeHints}`
      : "";

    let projectContextBlock = "";
    const rawProjectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (rawProjectId) {
      const loaded = await loadProjectAiContextNormalized(
        supabase,
        rawProjectId,
        true,
      );
      if (!loaded.ok) {
        return NextResponse.json(
          { error: loaded.message },
          { status: loaded.status },
        );
      }
      projectContextBlock = ideasPromptProjectContextBlock(loaded.normalized);
    }

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
            {
              type: "text",
              text: `Analysiere dieses Bild und generiere 4 verschiedene, witzige Meme-Ideen dafür.${projectContextBlock}${hintsBlock}
Antworte NUR mit einem JSON-Objekt: {"ideas": ["Idee 1", "Idee 2", "Idee 3", "Idee 4"]}
Jede Idee ist eine kurze Beschreibung des Meme-Konzepts (max. 15 Wörter).
Sei kreativ, humorvoll und originell. Formuliere alle vier Ideen ausschließlich auf Deutsch (deutscher Internet-Meme-Ton).`,
            },
          ],
        },
      ],
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "KI hat keine Ideen generiert" },
        { status: 500 },
      );
    }

    const parsed = JSON.parse(content) as { ideas?: string[] };
    const ideas = parsed.ideas ?? [];

    if (ideas.length === 0) {
      return NextResponse.json(
        { error: "Keine Ideen generiert" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ideas });
  } catch (err) {
    console.error("[generate-captions]", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
