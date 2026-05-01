import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { JobResult } from "@/lib/meme/process-job";

export interface JobStatusResponse {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  postId: string | null;
  memeType?: "ai_generated" | "canvas_overlay";
  // Für Typ A (ai_generated) bei status=completed (länge 1 oder 2):
  variantSignedUrls?: string[];
  variantPaths?: string[];
  originalImagePath?: string;
  // Für Typ B (canvas_overlay) bei status=completed:
  overlayTextTop?: string | null;
  overlayTextBottom?: string;
  // Original-Bild (signed URL) für Canvas-Rendering:
  originalSignedUrl?: string;
  // Bei status=failed:
  errorMsg?: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const { data: job, error } = await supabase
      .from("jobs")
      .select("id, status, post_id, error_msg")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !job) {
      return NextResponse.json({ error: "Job nicht gefunden" }, { status: 404 });
    }

    const base: JobStatusResponse = {
      id: job.id,
      status: job.status as JobStatusResponse["status"],
      postId: job.post_id,
    };

    if (job.status === "failed") {
      return NextResponse.json({ ...base, errorMsg: job.error_msg ?? "Unbekannter Fehler" });
    }

    if (job.status !== "completed" || !job.error_msg) {
      return NextResponse.json(base);
    }

    // Job abgeschlossen: Ergebnisdaten aus error_msg parsen
    let result: JobResult;
    try {
      result = JSON.parse(job.error_msg) as JobResult;
    } catch {
      return NextResponse.json({ ...base, errorMsg: "Ergebnisdaten konnten nicht gelesen werden" });
    }

    if (result.type === "ai_generated") {
      const signedResults = await Promise.all(
        result.variantPaths.map((path) =>
          supabase.storage.from("memes").createSignedUrl(path, 3600),
        ),
      );

      const variantSignedUrls = signedResults
        .map((r) => r.data?.signedUrl)
        .filter((u): u is string => Boolean(u));

      if (variantSignedUrls.length !== result.variantPaths.length) {
        return NextResponse.json({
          ...base,
          errorMsg: "Signed URLs konnten nicht erstellt werden",
        });
      }

      const { data: post } = await supabase
        .from("posts")
        .select("original_image_url")
        .eq("id", job.post_id!)
        .maybeSingle();

      return NextResponse.json({
        ...base,
        memeType: "ai_generated",
        variantSignedUrls,
        variantPaths: result.variantPaths,
        originalImagePath: post?.original_image_url,
      });
    }

    if (result.type === "canvas_overlay") {
      // Signed URL für Original-Bild (für Canvas-Rendering)
      const { data: post } = await supabase
        .from("posts")
        .select("original_image_url")
        .eq("id", job.post_id!)
        .maybeSingle();

      let originalSignedUrl: string | undefined;
      if (post?.original_image_url) {
        const { data: signedData } = await supabase.storage
          .from("originals")
          .createSignedUrl(post.original_image_url, 3600);
        originalSignedUrl = signedData?.signedUrl ?? undefined;
      }

      return NextResponse.json({
        ...base,
        memeType: "canvas_overlay",
        overlayTextTop: result.overlayTextTop,
        overlayTextBottom: result.overlayTextBottom,
        originalSignedUrl,
      });
    }

    return NextResponse.json(base);
  } catch (err) {
    console.error("[job-status]", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}
