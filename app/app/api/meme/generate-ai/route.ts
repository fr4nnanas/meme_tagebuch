import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  inlineImageEditProjectContext,
  loadProjectAiContextNormalized,
} from "@/lib/meme/project-ai-context";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maximale Laufzeit für KI-Bildgenerierung erhöhen
export const maxDuration = 120;

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
      contextInset = inlineImageEditProjectContext(loaded.normalized);
    }

    const imageBuffer = Buffer.from(body.imageBase64, "base64");
    const imageFile = new File([imageBuffer], "photo.jpg", {
      type: "image/jpeg",
    });

    const basePrompt =
      "Verwandle dieses Foto in ein lustiges, teilbares Meme im Stil deutschsprachiger Internet-Memes. " +
      "Behalte wiedererkennbare Motive. Nutze witzige Effekte und Meme-typische Elemente. " +
      "Stil: knalliger Internet-Meme-Look. Alle sichtbaren Texte auf dem Bild müssen auf Deutsch sein (natürliche deutsche Meme-Sprache)." +
      contextInset;

    const prompt = body.userText
      ? `${basePrompt} Meme-Idee vom Nutzer: ${body.userText}`
      : basePrompt;

    const response = await openai.images.edit({
      model: "gpt-image-2",
      image: imageFile,
      prompt,
      n: 1,
      size: "1024x1536",
    });

    const variants = response.data;
    if (!variants?.[0]?.b64_json) {
      return NextResponse.json(
        { error: "KI hat kein Bild generiert" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      variants: variants.filter((v) => v.b64_json).map((v) => v.b64_json),
    });
  } catch (err) {
    console.error("[generate-ai]", err);
    const message =
      err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
