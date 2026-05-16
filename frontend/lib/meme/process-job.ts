import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  memeAiVariantObjectKey,
  normalizeR2Key,
  storageKeyFromPostMediaField,
} from "@/lib/storage/r2-url";
import { r2Get } from "@/lib/storage/r2";
import { uploadMemeJpegWithWebpVariants } from "@/lib/storage/image-pipeline";
import { compositeReferenceJpegs } from "@/lib/storage/reference-composite";
import { openaiClient } from "@/lib/meme/openai-client";
import {
  AI_EXPERIMENTAL_MINIMAL_LAYOUT_INSET,
  encodeExperimentalStylizationChoice,
  experimentalPromptInset,
  experimentalStylizationPromptInset,
  EXPERIMENTAL_AI_MEME_BASE_PROMPT,
  resolveAiMasterStyleKey,
  resolveAiStylizationKey,
  STANDARD_AI_MASTER_KEY,
  STANDARD_AI_MEME_BASE_PROMPT,
} from "@/lib/meme/ai-meme-master-styles";
import { memeIdeaFromUserClause } from "@/lib/meme/ai-user-text-prompt";
import {
  canvasSystemPromptInset,
  inlineImageEditProjectContext,
  normalizeStoredProjectAiContext,
} from "@/lib/meme/project-ai-context";

export interface ProcessJobParams {
  jobId: string;
  postId: string;
  projectId: string;
  userId: string;
  memeType: "ai_generated" | "canvas_overlay";
  pipeline: "direct" | "assisted" | "manual";
  userText?: string;
  originalPath: string;
  /** Rohwert aus dem Formular: Preset-Key, „rotate“ oder leer (Standard) */
  aiMasterStyle?: string | null;
  /** Experimenteller Modus: visuelle Stilisierung (optional, kombinierbar) */
  aiStylization?: string | null;
  /** Experimenteller Modus: sehr reduzierte Bildelemente (nur bei nicht-Standard-Master) */
  aiExperimentalMinimal?: boolean;
}

const DUAL_REFERENCE_PROMPT_INSET =
  " Der Nutzer hat zwei Referenzfotos gewählt; im Eingabebild links steht Bild 1, rechts Bild 2. Beziehe beide inhaltlich ein.";

// error_msg-Feld wird bei status='completed' als Ergebnisspeicher zweckentfremdet.
// Struktur: JSON-String mit type + Ergebnisdaten.
export type JobResult =
  | {
      type: "ai_generated";
      variantPaths: string[];
      /** Gespeicherter Nutzertext zur Reproduktion der zweiten Variante */
      userText?: string;
      /** Aufgelöster Master-Stil (nach Rotation), damit Variante 2 denselben Prompt nutzt */
      aiMasterStyle?: string;
      /** Gewählte Stilisierung für Variante 2 */
      aiStylization?: string;
      /** Zweite Variante läuft asynchron im Hintergrund */
      secondVariantPending?: boolean;
      /** Fehlertext der letzten Hintergrund-Generierung */
      secondVariantError?: string | null;
    }
  | {
      type: "canvas_overlay";
      overlayTextTop: string | null;
      overlayTextBottom: string;
    };

function resolveOriginalStorageKey(originalPath: string): string {
  return (
    storageKeyFromPostMediaField(originalPath) ?? normalizeR2Key(originalPath)
  );
}

async function downloadOriginalBuffer(originalPath: string): Promise<Buffer> {
  try {
    return await r2Get(resolveOriginalStorageKey(originalPath));
  } catch {
    throw new Error("Original-Bild konnte nicht geladen werden");
  }
}

async function loadReferenceBuffers(
  originalPath: string,
  originalPath2: string | null | undefined,
): Promise<{ buffer: Buffer; dual: boolean; secondBuffer?: Buffer }> {
  const first = await downloadOriginalBuffer(originalPath);
  if (!originalPath2) {
    return { buffer: first, dual: false };
  }
  const second = await downloadOriginalBuffer(originalPath2);
  return {
    buffer: await compositeReferenceJpegs(first, second),
    dual: true,
    secondBuffer: second,
  };
}

/** Erster Zeilenumbruch trennt oben/unten; eine Zeile nur unten. Text bleibt inhaltlich erhalten (nur äußeres Trim). */
function parseManualMemeText(raw: string): {
  top: string | null;
  bottom: string | null;
} {
  const t = raw.trim();
  if (!t) return { top: null, bottom: null };
  const nl = t.indexOf("\n");
  if (nl === -1) {
    return { top: null, bottom: t };
  }
  const tail = t.slice(nl + 1);
  const head = t.slice(0, nl).trimEnd();
  const tailTrimmed = tail.trim();
  if (!head) {
    return { top: null, bottom: tailTrimmed || null };
  }
  if (!tailTrimmed) {
    return { top: null, bottom: head };
  }
  return { top: head, bottom: tailTrimmed };
}

/**
 * Assistent: typisch „Stichwort — KI-Idee“ (siehe upload-flow).
 * Eine Zeile ohne Zeilenumbruch → oben/unten.
 * Zeilenumbrüche wie bei manueller Eingabe.
 */
function parseAssistedMemeText(raw: string): {
  top: string | null;
  bottom: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { top: null, bottom: null };

  if (trimmed.includes("\n")) {
    return parseManualMemeText(raw);
  }

  const dashParts = trimmed.split(/\s[—–]\s/);
  if (dashParts.length >= 2) {
    const topPart = dashParts[0]!.trim();
    const bottomPart = dashParts.slice(1).join(" — ").trim();
    if (topPart && bottomPart) {
      return { top: topPart, bottom: bottomPart };
    }
  }

  return parseManualMemeText(raw);
}

/** Nutzertext direkt auf den Post übernehmen (manuell eingegeben oder ausgewählte Assistenten-Idee, keine zweite Text-KI). */
async function applyManualCanvasOverlay(
  params: ProcessJobParams,
): Promise<JobResult> {
  const supabase = createServiceRoleClient();
  const { top, bottom } =
    params.pipeline === "assisted"
      ? parseAssistedMemeText(params.userText ?? "")
      : parseManualMemeText(params.userText ?? "");
  if (!top && !bottom) {
    throw new Error("Kein Text für das Text-Overlay angegeben.");
  }

  await supabase
    .from("posts")
    .update({
      overlay_text_top: top,
      overlay_text_bottom: bottom,
    })
    .eq("id", params.postId);

  return {
    type: "canvas_overlay",
    overlayTextTop: top,
    overlayTextBottom: bottom ?? "",
  };
}

export async function processJob(params: ProcessJobParams): Promise<void> {
  const supabase = createServiceRoleClient();

  try {
    await supabase
      .from("jobs")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", params.jobId);

    let result: JobResult;
    const { data: postRow } = await supabase
      .from("posts")
      .select("original_image_url_2")
      .eq("id", params.postId)
      .maybeSingle();
    const originalPath2 = postRow?.original_image_url_2 ?? null;

    if (params.memeType === "ai_generated") {
      const reference = await loadReferenceBuffers(
        params.originalPath,
        originalPath2,
      );
      result = await generateAiMeme(params, reference.buffer, reference.dual);
    } else if (params.memeType === "canvas_overlay") {
      if (params.pipeline === "manual" || params.pipeline === "assisted") {
        result = await applyManualCanvasOverlay(params);
      } else {
        const first = await downloadOriginalBuffer(params.originalPath);
        const second = originalPath2
          ? await downloadOriginalBuffer(originalPath2)
          : null;
        result = await generateCanvasText(
          params,
          first,
          Boolean(second),
          second ?? undefined,
        );
      }
    } else {
      throw new Error("Unbekannte Meme-/Pipeline-Konfiguration.");
    }

    await supabase
      .from("jobs")
      .update({
        status: "completed",
        error_msg: JSON.stringify(result),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.jobId);
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unbekannter Fehler bei der KI-Verarbeitung";

    console.error(`[processJob] Job ${params.jobId} fehlgeschlagen:`, err);

    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error_msg: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.jobId);
  }
}

async function buildAiMemePrompt(
  supabase: ReturnType<typeof createServiceRoleClient>,
  projectId: string,
  userText?: string,
  resolvedMasterStyleKey: string = STANDARD_AI_MASTER_KEY,
  aiExperimentalMinimal: boolean = false,
  dualReference: boolean = false,
  aiStylization?: string | null,
): Promise<string> {
  const { data: project } = await supabase
    .from("projects")
    .select("ai_prompt_context")
    .eq("id", projectId)
    .maybeSingle();

  const styleExtra = experimentalPromptInset(resolvedMasterStyleKey);
  const stylizationExtra = experimentalStylizationPromptInset(aiStylization);
  const baseCore =
    resolvedMasterStyleKey === STANDARD_AI_MASTER_KEY
      ? STANDARD_AI_MEME_BASE_PROMPT
      : EXPERIMENTAL_AI_MEME_BASE_PROMPT;
  const minimalExtra =
    aiExperimentalMinimal &&
    resolvedMasterStyleKey !== STANDARD_AI_MASTER_KEY
      ? ` ${AI_EXPERIMENTAL_MINIMAL_LAYOUT_INSET}`
      : "";
  const basePrompt =
    baseCore +
    (styleExtra ? ` ${styleExtra}` : "") +
    (stylizationExtra ? ` ${stylizationExtra}` : "") +
    minimalExtra;

  const normalized = normalizeStoredProjectAiContext(project?.ai_prompt_context);
  const contextPart = inlineImageEditProjectContext(normalized);

  const userClause = userText ? memeIdeaFromUserClause(userText) : "";
  const dualClause = dualReference ? DUAL_REFERENCE_PROMPT_INSET : "";
  return `${basePrompt}${contextPart}${dualClause}${userClause}`;
}

async function generateAiMeme(
  params: ProcessJobParams,
  imageBuffer: Buffer,
  dualReference: boolean,
): Promise<JobResult> {
  const supabase = createServiceRoleClient();

  const imageFile = new File([new Uint8Array(imageBuffer)], "photo.jpg", {
    type: "image/jpeg",
  });

  const resolvedMasterKey = resolveAiMasterStyleKey(
    params.aiMasterStyle ?? null,
    params.postId,
  );
  const resolvedStylizationKey = resolveAiStylizationKey(
    params.aiStylization ?? null,
  );

  const prompt = await buildAiMemePrompt(
    supabase,
    params.projectId,
    params.userText,
    resolvedMasterKey,
    Boolean(params.aiExperimentalMinimal),
    dualReference,
    params.aiStylization ?? null,
  );

  const response = await openaiClient().images.edit({
    model: "gpt-image-2",
    image: imageFile,
    prompt,
    n: 1,
    size: "1024x1536",
  });

  const variants = response.data;
  if (!variants?.[0]) {
    throw new Error("KI hat kein Bild generiert");
  }

  const v1Path = memeAiVariantObjectKey(
    params.projectId,
    params.userId,
    params.postId,
    1,
  );
  const variantData = variants[0];
  if (!variantData.b64_json) {
    throw new Error("Variante enthält keine Bilddaten");
  }

  const variantBuffer = Buffer.from(variantData.b64_json, "base64");

  await uploadMemeJpegWithWebpVariants(v1Path, variantBuffer);

  return {
    type: "ai_generated",
    variantPaths: [v1Path],
    ...(params.userText ? { userText: params.userText } : {}),
    ...(resolvedMasterKey !== STANDARD_AI_MASTER_KEY
      ? { aiMasterStyle: resolvedMasterKey }
      : {}),
    ...(resolvedStylizationKey
      ? {
          aiStylization: encodeExperimentalStylizationChoice(
            resolvedStylizationKey,
          ),
        }
      : {}),
  };
}

/** Zweite KI-Variante nachträglich (gleicher Prompt, erneuter images.edit-Aufruf mit n: 1). */
export async function appendSecondAiVariantToJob(
  jobId: string,
  userId: string,
): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, status, error_msg, post_id, user_id")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (jobError || !job || job.status !== "completed" || !job.error_msg || !job.post_id) {
    throw new Error("Job nicht gefunden oder nicht abgeschlossen");
  }

  let result: JobResult;
  try {
    result = JSON.parse(job.error_msg) as JobResult;
  } catch {
    throw new Error("Job-Ergebnis konnte nicht gelesen werden");
  }

  if (result.type !== "ai_generated" || result.variantPaths.length !== 1) {
    throw new Error("Zweite Variante ist hier nicht verfügbar");
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select(
      "id, project_id, user_id, original_image_url, original_image_url_2, ai_experimental_minimal",
    )
    .eq("id", job.post_id)
    .maybeSingle();

  if (postError || !post?.original_image_url || post.user_id !== userId) {
    throw new Error("Post nicht gefunden");
  }

  const reference = await loadReferenceBuffers(
    post.original_image_url,
    post.original_image_url_2,
  );
  const imageFile = new File([new Uint8Array(reference.buffer)], "photo.jpg", {
    type: "image/jpeg",
  });

  const postRow = post as typeof post & { ai_experimental_minimal?: boolean };

  const prompt = await buildAiMemePrompt(
    supabase,
    post.project_id,
    result.userText,
    result.aiMasterStyle ?? STANDARD_AI_MASTER_KEY,
    Boolean(postRow.ai_experimental_minimal),
    reference.dual,
    result.aiStylization ?? null,
  );

  const response = await openaiClient().images.edit({
    model: "gpt-image-2",
    image: imageFile,
    prompt,
    n: 1,
    size: "1024x1536",
  });

  const variants = response.data;
  if (!variants?.[0]?.b64_json) {
    throw new Error("KI hat kein zweites Bild generiert");
  }

  const v2Path = memeAiVariantObjectKey(
    post.project_id,
    userId,
    post.id,
    2,
  );
  const variantBuffer = Buffer.from(variants[0].b64_json, "base64");

  await uploadMemeJpegWithWebpVariants(v2Path, variantBuffer);

  const updated: JobResult = {
    type: "ai_generated",
    variantPaths: [...result.variantPaths, v2Path],
    ...(result.userText !== undefined ? { userText: result.userText } : {}),
    ...(result.aiMasterStyle !== undefined
      ? { aiMasterStyle: result.aiMasterStyle }
      : {}),
    ...(result.aiStylization !== undefined
      ? { aiStylization: result.aiStylization }
      : {}),
  };

  const { error: updateError } = await supabase
    .from("jobs")
    .update({
      error_msg: JSON.stringify(updated),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (updateError) {
    throw new Error(`Job konnte nicht aktualisiert werden: ${updateError.message}`);
  }
}

export async function recordSecondAiVariantFailure(
  jobId: string,
  userId: string,
  message: string,
): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, status, error_msg")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (jobError || !job || job.status !== "completed" || !job.error_msg) {
    return;
  }

  let result: JobResult;
  try {
    result = JSON.parse(job.error_msg) as JobResult;
  } catch {
    return;
  }

  if (result.type !== "ai_generated") return;

  const failed: JobResult = {
    ...result,
    secondVariantPending: false,
    secondVariantError: message,
  };

  await supabase
    .from("jobs")
    .update({
      error_msg: JSON.stringify(failed),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

async function generateCanvasText(
  params: ProcessJobParams,
  imageBuffer: Buffer,
  dualReference: boolean,
  secondBuffer?: Buffer,
): Promise<JobResult> {
  const supabase = createServiceRoleClient();

  const base64Image = imageBuffer.toString("base64");
  const base64Second = secondBuffer?.toString("base64") ?? null;

  // Projekt-Kontext aus der Datenbank laden
  const { data: project } = await supabase
    .from("projects")
    .select("ai_prompt_context")
    .eq("id", params.projectId)
    .maybeSingle();

  const contextNote = canvasSystemPromptInset(
    normalizeStoredProjectAiContext(project?.ai_prompt_context),
  );

  const dualNote = dualReference
    ? " Es liegen zwei Referenzfotos vor; beziehe beide inhaltlich ein."
    : "";

  const systemPrompt = `Du bist ein Meme-Texter für deutschsprachige Memes. Analysiere das Foto und erstelle kurzen, witzigen Meme-Text.${contextNote}${dualNote}
Antworte NUR mit einem JSON-Objekt: {"top": string|null, "bottom": string}
Typisches Setup–Pointe-Meme – setze wenn möglich BEIDE Felder:
- "top": Aufhänger, Setup oder Reaktion OBEN (höchstens zwei Zeilen; zusätzliche Zeile nur durch Zeilenumbruch im Text).
- "bottom": Pointe oder Punchline UNTEN (Pflichtfeld). Schreibe den unteren Teil gern auf zwei oder drei kurze Zeilen mit Zeilenumbrüchen, statt eines einzig langen Satzes – wenige Wörter pro Zeile.
Nutze top: null NUR wenn wirklich ein einzeiliges Bottom-Overlay besser wirkt als Setup+Pointe.

- Sprache: ausschließlich Deutsch (typische Meme-/Umgangssprache)`;

  const userContent = params.userText
    ? `Erstelle Meme-Text für ${dualReference ? "diese beiden Fotos" : "dieses Foto"}. Thema/Idee des Users: ${params.userText}`
    : `Erstelle lustigen Meme-Text für ${dualReference ? "diese beiden Fotos" : "dieses Foto"}.`;

  const visionParts: Array<
    | { type: "image_url"; image_url: { url: string; detail: "low" } }
    | { type: "text"; text: string }
  > = [
    {
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${base64Image}`,
        detail: "low",
      },
    },
  ];
  if (base64Second) {
    visionParts.push({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${base64Second}`,
        detail: "low",
      },
    });
  }
  visionParts.push({
    type: "text",
    text: `${systemPrompt}\n\n${userContent}`,
  });

  const response = await openaiClient().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: visionParts,
      },
    ],
    max_tokens: 150,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("KI hat keinen Text generiert");

  const parsed = JSON.parse(content) as {
    top?: string | null;
    bottom?: string;
  };

  const overlayTextTop = parsed.top ?? null;
  const overlayTextBottom = parsed.bottom ?? "Meme-Modus: an 😎";

  // Overlay-Texte direkt in den Post schreiben
  await supabase
    .from("posts")
    .update({
      overlay_text_top: overlayTextTop,
      overlay_text_bottom: overlayTextBottom,
    })
    .eq("id", params.postId);

  return { type: "canvas_overlay", overlayTextTop, overlayTextBottom };
}
