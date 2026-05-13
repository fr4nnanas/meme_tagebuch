import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STANDARD_AI_MEME_BASE_PROMPT } from "@/lib/meme/ai-meme-master-styles";
import { memeIdeaFromUserClause } from "@/lib/meme/ai-user-text-prompt";
import {
  inlineImageEditProjectContext,
  loadProjectAiContextNormalized,
} from "@/lib/meme/project-ai-context";
import { openaiClient } from "@/lib/meme/openai-client";

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

    const basePrompt = `${STANDARD_AI_MEME_BASE_PROMPT}${contextInset}`;
    const userClause = body.userText ? memeIdeaFromUserClause(body.userText) : "";
    const prompt = `${basePrompt}${userClause}`;

    const response = await openaiClient().images.edit({
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
