"use server";

import { createClient } from "@/lib/supabase/server";
import { resolvePostMediaPublicUrl } from "@/lib/storage/r2-url";

async function assertProjectMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export type RemixSourceResult =
  | {
      ok: true;
      postId: string;
      projectId: string;
      sourceUsername: string;
      pipeline: "direct" | "assisted" | "manual";
      pipelineInputText: string | null;
      originalSignedUrl: string;
      secondOriginalSignedUrl: string | null;
      memeSignedUrl: string | null;
    }
  | { ok: false; error: string };

/** Quell-Post für Remix (sichtbar für Projektmitglieder). */
export async function getRemixSourceAction(
  postId: string,
): Promise<RemixSourceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet" };

  const { data: post, error } = await supabase
    .from("posts")
    .select(
      "id, project_id, original_image_url, original_image_url_2, meme_image_url, pipeline, pipeline_input_text, users!user_id(username)",
    )
    .eq("id", postId)
    .maybeSingle();

  if (error || !post) {
    return { ok: false, error: "Post nicht gefunden" };
  }

  const isMember = await assertProjectMember(supabase, user.id, post.project_id);
  if (!isMember) {
    return { ok: false, error: "Kein Zugriff auf diesen Post" };
  }

  const originalSignedUrl = resolvePostMediaPublicUrl(
    post.original_image_url,
    "full",
  );
  if (!originalSignedUrl) {
    return { ok: false, error: "Originalbild nicht verfügbar" };
  }

  const secondOriginalSignedUrl = post.original_image_url_2
    ? resolvePostMediaPublicUrl(post.original_image_url_2, "full")
    : null;

  const memeSignedUrl = post.meme_image_url
    ? resolvePostMediaPublicUrl(post.meme_image_url, "full")
    : null;

  const rawUser = post.users;
  const userInfo = Array.isArray(rawUser) ? rawUser[0] : rawUser;
  const sourceUsername =
    (userInfo as { username?: string } | null)?.username ?? "Unbekannt";

  return {
    ok: true,
    postId: post.id,
    projectId: post.project_id,
    sourceUsername,
    pipeline: post.pipeline as "direct" | "assisted" | "manual",
    pipelineInputText: post.pipeline_input_text ?? null,
    originalSignedUrl,
    secondOriginalSignedUrl,
    memeSignedUrl,
  };
}
