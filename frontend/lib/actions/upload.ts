"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  appendSecondAiVariantToJob,
  processJob,
  type JobResult,
} from "@/lib/meme/process-job";

const DAILY_AI_IMAGE_SETTING_KEY = "daily_ai_image_limit";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/** Gleiche Quellen wie Enforcement in startMemeJob / requestSecondAiMemeVariant. */
async function readDailyAiImageQuota(
  supabase: ServerSupabase,
  userId: string,
): Promise<{
  dailyLimit: number;
  used: number;
  today: string;
  usage: { ai_images_used: number } | null;
}> {
  const { data: settings } = await supabase
    .from("settings")
    .select("value")
    .eq("key", DAILY_AI_IMAGE_SETTING_KEY)
    .maybeSingle();

  const dailyLimit = parseInt(settings?.value ?? "5", 10);

  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("ai_images_used")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  const used = usage?.ai_images_used ?? 0;

  return {
    dailyLimit,
    used,
    today,
    usage: usage ?? null,
  };
}

async function tryConsumeAiQuota(
  supabase: ServerSupabase,
  userId: string,
): Promise<{ error?: string }> {
  const { dailyLimit, used, today, usage } = await readDailyAiImageQuota(
    supabase,
    userId,
  );

  if (used >= dailyLimit) {
    return {
      error: `Tageslimit erreicht – heute noch ${dailyLimit} KI-Generierungen möglich. Du hast alle ${dailyLimit} aufgebraucht.`,
    };
  }

  if (usage) {
    await supabase
      .from("daily_usage")
      .update({ ai_images_used: used + 1 })
      .eq("user_id", userId)
      .eq("date", today);
  } else {
    await supabase
      .from("daily_usage")
      .insert({ user_id: userId, date: today, ai_images_used: 1 });
  }

  return {};
}

/** Für UI (Upload): aktuelles Tages-KI-Kontingent wie in den Server-Checks. */
export async function getDailyAiQuota(): Promise<
  | { limit: number; used: number }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const { dailyLimit, used } = await readDailyAiImageQuota(supabase, user.id);
  return { limit: dailyLimit, used };
}

interface StartJobResult {
  jobId: string;
  postId: string;
  originalPath: string;
  error?: never;
}

interface StartJobError {
  error: string;
  jobId?: never;
  postId?: never;
  originalPath?: never;
}

export async function startMemeJob(
  formData: FormData,
): Promise<StartJobResult | StartJobError> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Nicht angemeldet" };

  const croppedImageFile = formData.get("croppedImage") as File | null;
  const memeType = formData.get("memeType") as
    | "ai_generated"
    | "canvas_overlay"
    | null;
  const pipeline = formData.get("pipeline") as
    | "direct"
    | "assisted"
    | "manual"
    | null;
  const projectId = formData.get("projectId") as string | null;
  const userText = formData.get("userText") as string | null;
  const aiMasterStyleRaw = formData.get("aiMasterStyle") as string | null;
  const latRaw = formData.get("lat") as string | null;
  const lngRaw = formData.get("lng") as string | null;

  if (!croppedImageFile || !memeType || !pipeline || !projectId) {
    return { error: "Pflichtfelder fehlen" };
  }

  if (pipeline === "manual" && memeType !== "canvas_overlay") {
    return { error: "Manuelle Texteingabe ist nur bei Text-Overlay möglich." };
  }

  const lat = latRaw ? parseFloat(latRaw) : null;
  const lng = lngRaw ? parseFloat(lngRaw) : null;

  const pipelineInputText =
    userText && String(userText).trim() ? String(userText).trim() : null;

  // Tageslimit für Typ A prüfen und vorab erhöhen
  if (memeType === "ai_generated") {
    const quota = await tryConsumeAiQuota(supabase, user.id);
    if (quota.error) return { error: quota.error };
  }

  // Bild-Bytes lesen
  const imageBytes = await croppedImageFile.arrayBuffer();
  const imageBuffer = Buffer.from(imageBytes);

  // Post-ID vorab generieren, damit Storagepfad und Post-ID übereinstimmen
  const postIdResult = await supabase.rpc("uuid_generate_v4" as never);
  // Fallback: eigene UUID-Generierung
  const postId =
    typeof postIdResult.data === "string"
      ? postIdResult.data
      : crypto.randomUUID();

  const originalPath = `${projectId}/${user.id}/${postId}.jpg`;

  // Original in 'originals' Bucket hochladen
  const { error: uploadError } = await supabase.storage
    .from("originals")
    .upload(originalPath, imageBuffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    return { error: `Upload fehlgeschlagen: ${uploadError.message}` };
  }

  // Post-Eintrag anlegen (meme_image_url = null solange Job läuft)
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      id: postId,
      user_id: user.id,
      project_id: projectId,
      original_image_url: originalPath,
      meme_image_url: null,
      meme_type: memeType,
      pipeline,
      pipeline_input_text: pipelineInputText,
      caption: null,
      lat: lat && !isNaN(lat) ? lat : null,
      lng: lng && !isNaN(lng) ? lng : null,
    })
    .select("id")
    .single();

  if (postError || !post) {
    // Cleanup: hochgeladenes Bild wieder löschen
    await supabase.storage.from("originals").remove([originalPath]);
    return { error: `Post konnte nicht erstellt werden: ${postError?.message}` };
  }

  // Job-Eintrag anlegen
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      post_id: post.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return { error: `Job konnte nicht erstellt werden: ${jobError?.message}` };
  }

  // KI-Verarbeitung asynchron nach Response starten
  const aiMasterStyleTrimmed = aiMasterStyleRaw?.trim();
  after(async () => {
    await processJob({
      jobId: job.id,
      postId: post.id,
      projectId,
      userId: user.id,
      memeType,
      pipeline,
      userText: userText ?? undefined,
      originalPath,
      aiMasterStyle:
        memeType === "ai_generated" && aiMasterStyleTrimmed
          ? aiMasterStyleTrimmed
          : undefined,
    });
  });

  return { jobId: job.id, postId: post.id, originalPath };
}

export type MemeRetryDraftResult =
  | {
      ok: true;
      postId: string;
      projectId: string;
      originalSignedUrl: string;
      memeType: "ai_generated" | "canvas_overlay";
      pipeline: "direct" | "assisted" | "manual";
      pipelineInputText: string | null;
      lat: number | null;
      lng: number | null;
    }
  | { ok: false; error: string };

/** Serverseitige Daten für Upload-Flow bei ?retry=postId (gespeicherter Zuschnitt + Kontext). */
export async function getMemeRetryDraftAction(
  postId: string,
): Promise<MemeRetryDraftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet" };

  const { data: post, error } = await supabase
    .from("posts")
    .select(
      "id, user_id, project_id, original_image_url, meme_image_url, meme_type, pipeline, pipeline_input_text, lat, lng",
    )
    .eq("id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !post) {
    return { ok: false, error: "Post nicht gefunden" };
  }

  if (post.meme_image_url) {
    return { ok: false, error: "Post ist bereits veröffentlicht" };
  }

  const { data: signed } = await supabase.storage
    .from("originals")
    .createSignedUrl(post.original_image_url, 3600);

  if (!signed?.signedUrl) {
    return { ok: false, error: "Bild-Link konnte nicht erstellt werden" };
  }

  return {
    ok: true,
    postId: post.id,
    projectId: post.project_id,
    originalSignedUrl: signed.signedUrl,
    memeType: post.meme_type as "ai_generated" | "canvas_overlay",
    pipeline: post.pipeline as "direct" | "assisted" | "manual",
    pipelineInputText: post.pipeline_input_text ?? null,
    lat: post.lat,
    lng: post.lng,
  };
}

/**
 * Erneuter Job-Lauf für einen bestehenden Entwurf (gleicher Post, optional neues Crop-Bild / geänderte Pipeline).
 * Zählt ein zusätzliches KI-Kontingent nur, wenn von Nicht-KI auf KI gewechselt wird.
 */
export async function retryMemeJobFromDraftAction(
  formData: FormData,
): Promise<StartJobResult | StartJobError> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const postId = formData.get("postId") as string | null;
  const croppedImageFile = formData.get("croppedImage") as File | null;
  const memeType = formData.get("memeType") as
    | "ai_generated"
    | "canvas_overlay"
    | null;
  const pipeline = formData.get("pipeline") as
    | "direct"
    | "assisted"
    | "manual"
    | null;
  const projectId = formData.get("projectId") as string | null;
  const userText = formData.get("userText") as string | null;
  const aiMasterStyleRaw = formData.get("aiMasterStyle") as string | null;
  const latRaw = formData.get("lat") as string | null;
  const lngRaw = formData.get("lng") as string | null;

  if (
    !postId ||
    !croppedImageFile ||
    !memeType ||
    !pipeline ||
    !projectId
  ) {
    return { error: "Pflichtfelder fehlen" };
  }

  if (pipeline === "manual" && memeType !== "canvas_overlay") {
    return { error: "Manuelle Texteingabe ist nur bei Text-Overlay möglich." };
  }

  const lat = latRaw ? parseFloat(latRaw) : null;
  const lng = lngRaw ? parseFloat(lngRaw) : null;
  const pipelineInputText =
    userText && String(userText).trim() ? String(userText).trim() : null;

  const { data: postRow, error: postFetchError } = await supabase
    .from("posts")
    .select(
      "id, user_id, project_id, original_image_url, meme_image_url, meme_type",
    )
    .eq("id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (postFetchError || !postRow) {
    return { error: "Post nicht gefunden" };
  }

  if (postRow.meme_image_url) {
    return { error: "Bereits veröffentlicht" };
  }

  if (postRow.project_id !== projectId) {
    return { error: "Projekt passt nicht zu diesem Post" };
  }

  const previousMemeType = postRow.meme_type;
  const needNewAiQuota =
    memeType === "ai_generated" && previousMemeType !== "ai_generated";

  if (needNewAiQuota) {
    const quota = await tryConsumeAiQuota(supabase, user.id);
    if (quota.error) return { error: quota.error };
  }

  const originalPath = postRow.original_image_url;
  const imageBytes = await croppedImageFile.arrayBuffer();
  const imageBuffer = Buffer.from(imageBytes);

  const { error: uploadError } = await supabase.storage
    .from("originals")
    .upload(originalPath, imageBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    return { error: `Upload fehlgeschlagen: ${uploadError.message}` };
  }

  const { error: postUpdateError } = await supabase
    .from("posts")
    .update({
      meme_type: memeType,
      pipeline,
      pipeline_input_text: pipelineInputText,
      lat: lat && !isNaN(lat) ? lat : null,
      lng: lng && !isNaN(lng) ? lng : null,
    })
    .eq("id", postId)
    .eq("user_id", user.id);

  if (postUpdateError) {
    return { error: `Post konnte nicht aktualisiert werden: ${postUpdateError.message}` };
  }

  const { data: job, error: jobFetchError } = await supabase
    .from("jobs")
    .select("id, status, error_msg")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (jobFetchError || !job) {
    return { error: "Kein Job zu diesem Post gefunden" };
  }

  if (job.status === "completed" && job.error_msg) {
    try {
      const result = JSON.parse(job.error_msg) as JobResult;
      if (result.type === "ai_generated" && result.variantPaths?.length > 0) {
        return {
          error:
            "Dieser Entwurf ist fertig – bitte wähle im Abschlussdialog eine Variante.",
        };
      }
      if (result.type === "canvas_overlay") {
        return {
          error:
            "Dieser Entwurf ist fertig – bitte schließe die Meme-Auswahl ab.",
        };
      }
    } catch {
      /* defektes Ergebnis → Retry erlaubt */
    }
  } else if (
    job.status !== "failed" &&
    job.status !== "pending" &&
    job.status !== "processing"
  ) {
    return {
      error:
        "Ein erneuter Versuch ist nur bei fehlgeschlagenem oder laufendem Job möglich.",
    };
  }

  const { error: jobResetError } = await supabase
    .from("jobs")
    .update({
      status: "pending",
      error_msg: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (jobResetError) {
    return { error: "Job konnte nicht zurückgesetzt werden" };
  }

  const aiMasterStyleTrimmed = aiMasterStyleRaw?.trim();

  after(async () => {
    await processJob({
      jobId: job.id,
      postId,
      projectId,
      userId: user.id,
      memeType,
      pipeline,
      userText: userText ?? undefined,
      originalPath,
      aiMasterStyle:
        memeType === "ai_generated" && aiMasterStyleTrimmed
          ? aiMasterStyleTrimmed
          : undefined,
    });
  });

  return { jobId: job.id, postId, originalPath };
}

/** Zweites KI-Vollbild nachziehen (zusätzlicher API-Aufruf; zählt gegen Tageslimit). */
export async function requestSecondAiMemeVariant(
  jobId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const { data: job, error: jobFetchError } = await supabase
    .from("jobs")
    .select("id, status, error_msg")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (jobFetchError || !job || job.status !== "completed" || !job.error_msg) {
    return { error: "Job nicht gefunden oder nicht abgeschlossen" };
  }

  let result: JobResult;
  try {
    result = JSON.parse(job.error_msg) as JobResult;
  } catch {
    return { error: "Ungültige Job-Daten" };
  }

  if (result.type !== "ai_generated" || result.variantPaths.length !== 1) {
    return {
      error:
        "Eine zweite Variante gibt es nur, wenn aktuell genau eine vorliegt.",
    };
  }

  const { dailyLimit, used, today, usage } = await readDailyAiImageQuota(
    supabase,
    user.id,
  );

  if (used >= dailyLimit) {
    return {
      error: `Tageslimit erreicht – heute noch maximal ${dailyLimit} KI-Bilder.`,
    };
  }

  try {
    await appendSecondAiVariantToJob(jobId, user.id);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Generierung fehlgeschlagen";
    return { error: message };
  }

  if (usage) {
    await supabase
      .from("daily_usage")
      .update({ ai_images_used: used + 1 })
      .eq("user_id", user.id)
      .eq("date", today);
  } else {
    await supabase
      .from("daily_usage")
      .insert({ user_id: user.id, date: today, ai_images_used: used + 1 });
  }

  return {};
}

export async function finalizePost(
  postId: string,
  chosenVariantPath: string,
  caption?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const { error } = await supabase
    .from("posts")
    .update({
      meme_image_url: chosenVariantPath,
      caption: caption ?? null,
    })
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  const { data: meta } = await supabase
    .from("posts")
    .select("project_id, user_id")
    .eq("id", postId)
    .maybeSingle();

  if (meta) {
    const { notifyProjectMembersNewMeme } = await import("@/lib/push/notify-new-meme");
    void notifyProjectMembersNewMeme({
      postId,
      projectId: meta.project_id,
      authorUserId: meta.user_id,
    }).catch((e) => console.error("[finalizePost] push notify", e));
  }

  return {};
}

export async function deleteVariant(variantPath: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from("memes").remove([variantPath]);
}

/**
 * Unveröffentlichten Entwurf komplett entfernen (Storage + Post; Jobs per CASCADE).
 * Nur wenn `meme_image_url` noch null ist — sonst bereits final gepostet.
 */
export async function discardUnpublishedMeme(
  postId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const { data: post, error: postFetchError } = await supabase
    .from("posts")
    .select(
      "id, user_id, meme_image_url, original_image_url, meme_type",
    )
    .eq("id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (postFetchError || !post) {
    return { error: "Post nicht gefunden" };
  }
  if (post.meme_image_url !== null && post.meme_image_url !== "") {
    return { error: "Bereits veröffentlicht" };
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("status, error_msg")
    .eq("post_id", postId)
    .maybeSingle();

  if (job?.status === "completed" && job.error_msg && post.meme_type === "ai_generated") {
    try {
      const result = JSON.parse(job.error_msg) as JobResult;
      if (result.type === "ai_generated" && result.variantPaths?.length) {
        await supabase.storage.from("memes").remove(result.variantPaths);
      }
    } catch {
      /* ignoriieren */
    }
  }

  if (post.original_image_url) {
    await supabase.storage.from("originals").remove([post.original_image_url]);
  }

  const { error: deleteError } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);

  if (deleteError) {
    return { error: deleteError.message };
  }

  return {};
}

export async function generateCaption(
  postId: string,
  memeImagePath: string,
): Promise<{ caption?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const response = await fetch(`/api/meme/generate-caption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, memeImagePath }),
  });

  if (!response.ok) {
    return { error: "Caption-Generierung fehlgeschlagen" };
  }

  const data = (await response.json()) as { caption?: string; error?: string };
  return data;
}
