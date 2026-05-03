"use server";

import { createClient } from "@/lib/supabase/server";
import { buildJobStatusResponse } from "@/lib/meme/build-job-status-response";
import type { JobStatusResponse } from "@/lib/meme/job-status-types";

export type GetJobStatusForPostResult =
  | { ok: true; data: JobStatusResponse }
  | { ok: true; noJob: true }
  | { ok: false; error: string };

/** Liest den neuesten Meme-Job zum Post (nur wenn der Post dem Nutzer gehört). */
export async function getJobStatusForPostAction(
  postId: string,
): Promise<GetJobStatusForPostResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Nicht angemeldet" };

    const { data: post } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .maybeSingle();

    if (!post || post.user_id !== user.id) {
      return { ok: false, error: "Kein Zugriff" };
    }

    const { data: job } = await supabase
      .from("jobs")
      .select("id, status, post_id, error_msg, updated_at")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!job) return { ok: true, noJob: true };

    const data = await buildJobStatusResponse(supabase, job);
    return { ok: true, data };
  } catch (err) {
    console.error("[getJobStatusForPostAction]", err);
    return { ok: false, error: "Job-Status konnte nicht geladen werden" };
  }
}
