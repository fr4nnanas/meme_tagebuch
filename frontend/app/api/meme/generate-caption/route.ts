import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import {
  chatTaskProjectContextBlock,
  inferProjectIdFromMemeStoragePath,
  tryLoadProjectAiContextNormalized,
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
      postId?: string;
      memeImagePath?: string;
      /** Optional überschreibt Inferenz aus Post/Pfad */
      projectId?: string;
    };

    let imagePath: string | null = body.memeImagePath ?? null;
    let resolvedProjectId =
      typeof body.projectId === "string" ? body.projectId.trim() : "";

    if (!imagePath && body.postId) {
      const { data: post } = await supabase
        .from("posts")
        .select("meme_image_url, user_id, project_id")
        .eq("id", body.postId)
        .maybeSingle();

      if (!post) {
        return NextResponse.json({ error: "Post nicht gefunden" }, { status: 404 });
      }
      imagePath = post.meme_image_url ?? null;
      if (!resolvedProjectId && post.project_id) {
        resolvedProjectId = post.project_id;
      }
    }

    if (!imagePath) {
      return NextResponse.json({ error: "Kein Meme-Bild gefunden" }, { status: 400 });
    }

    if (!resolvedProjectId) {
      const inferred = inferProjectIdFromMemeStoragePath(imagePath);
      if (inferred) resolvedProjectId = inferred;
    }

    const projectContextInset = chatTaskProjectContextBlock(
      await tryLoadProjectAiContextNormalized(supabase, resolvedProjectId || null),
    );

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("memes")
      .createSignedUrl(imagePath, 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json(
        { error: "Bild-URL konnte nicht erstellt werden" },
        { status: 500 },
      );
    }

    const imageResponse = await fetch(signedUrlData.signedUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Bild konnte nicht geladen werden" },
        { status: 500 },
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString("base64");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
                detail: "low",
              },
            },
            {
              type: "text",
              text: `Schreibe einen kurzen, witzigen Caption-Text für dieses Meme-Bild.${projectContextInset}
Maximal 2 Sätze, maximal 25 Wörter, auf Deutsch.
Antworte NUR mit dem Caption-Text, ohne Anführungszeichen oder Erklärungen.`,
            },
          ],
        },
      ],
      max_tokens: 150,
    });

    const caption = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ caption });
  } catch (err) {
    console.error("[generate-caption]", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
