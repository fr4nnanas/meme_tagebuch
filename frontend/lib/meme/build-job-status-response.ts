import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeR2Key, r2Url } from "@/lib/storage/r2-url";
import type { JobStatusResponse } from "@/lib/meme/job-status-types";
import type { JobResult } from "@/lib/meme/process-job";

type JobRow = {
  id: string;
  status: string;
  post_id: string | null;
  error_msg: string | null;
  updated_at?: string | null;
};

export async function buildJobStatusResponse(
  supabase: SupabaseClient,
  job: JobRow,
): Promise<JobStatusResponse> {
  const base: JobStatusResponse = {
    id: job.id,
    status: job.status as JobStatusResponse["status"],
    postId: job.post_id,
    ...(job.updated_at ? { jobUpdatedAt: job.updated_at } : {}),
  };

  if (job.status === "failed") {
    return { ...base, errorMsg: job.error_msg ?? "Unbekannter Fehler" };
  }

  if (job.status !== "completed" || !job.error_msg) {
    return base;
  }

  let result: JobResult;
  try {
    result = JSON.parse(job.error_msg) as JobResult;
  } catch {
    return { ...base, errorMsg: "Ergebnisdaten konnten nicht gelesen werden" };
  }

  if (result.type === "ai_generated") {
    let variantSignedUrls: string[];
    try {
      variantSignedUrls = result.variantPaths.map((path) =>
        r2Url(normalizeR2Key(path), "full"),
      );
    } catch {
      return {
        ...base,
        errorMsg: "CDN-URLs für Varianten konnten nicht gebaut werden",
      };
    }

    if (variantSignedUrls.length !== result.variantPaths.length) {
      return {
        ...base,
        errorMsg: "CDN-URLs für Varianten fehlen",
      };
    }

    const { data: post } = await supabase
      .from("posts")
      .select("original_image_url")
      .eq("id", job.post_id!)
      .maybeSingle();

    return {
      ...base,
      memeType: "ai_generated",
      variantSignedUrls,
      variantPaths: result.variantPaths,
      originalImagePath: post?.original_image_url,
      secondVariantPending: result.secondVariantPending === true,
      secondVariantError: result.secondVariantError ?? null,
    };
  }

  if (result.type === "canvas_overlay") {
    const { data: post } = await supabase
      .from("posts")
      .select("original_image_url")
      .eq("id", job.post_id!)
      .maybeSingle();

    let originalSignedUrl: string | undefined;
    if (post?.original_image_url) {
      try {
        originalSignedUrl = r2Url(
          normalizeR2Key(post.original_image_url),
          "full",
        );
      } catch {
        originalSignedUrl = undefined;
      }
    }

    return {
      ...base,
      memeType: "canvas_overlay",
      overlayTextTop: result.overlayTextTop,
      overlayTextBottom: result.overlayTextBottom,
      originalSignedUrl,
    };
  }

  return base;
}
