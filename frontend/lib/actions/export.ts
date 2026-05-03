"use server";

import { createClient } from "@/lib/supabase/server";
import {
  sortPostsForDisplay,
  type MemeStarSortMode,
} from "@/lib/meme/sort-posts";

export type { MemeStarSortMode } from "@/lib/meme/sort-posts";

const EXPORT_POST_PAGE = 500;
const IN_CHUNK = 150;

/** Rohdaten für offline ZIP / data.json (Pfad im Storage wie in der DB). */
export interface ExportPayloadUser {
  id: string;
  username: string;
  avatar_url: string | null;
}

export interface ExportPayloadComment {
  id: string;
  created_at: string;
  content: string;
  like_count: number;
  user: ExportPayloadUser;
}

export interface ExportPayloadPost {
  id: string;
  created_at: string;
  caption: string | null;
  star_rating_avg: number | null;
  star_rating_count: number;
  meme_type: string;
  pipeline: string;
  pipeline_input_text: string | null;
  meme_image_url: string;
  /** Storage-Pfad Original-Upload (für spätere Offline-Nutzung / Transparenz) */
  original_image_url: string;
  user: ExportPayloadUser;
  like_count: number;
  comments: ExportPayloadComment[];
}

export interface ProjectExportPayload {
  exported_at: string;
  project: { id: string; name: string };
  posts: ExportPayloadPost[];
}

type UsersJoin = {
  id: string;
  username: string;
  avatar_url: string | null;
} | null;

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function readUser(joined: unknown): ExportPayloadUser {
  const u = (Array.isArray(joined) ? joined[0] : joined) as UsersJoin;
  return {
    id: u?.id ?? "",
    username: u?.username ?? "Unbekannt",
    avatar_url: u?.avatar_url ?? null,
  };
}

export async function fetchProjectExportDataAction(
  projectId: string,
  sort: MemeStarSortMode = "created_desc",
): Promise<{ payload?: ProjectExportPayload; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Nicht angemeldet" };

    const { data: projectRow, error: projectError } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) return { error: projectError.message };
    if (!projectRow) return { error: "Projekt nicht gefunden" };

    type ExportPostRow = {
      id: string;
      caption: string | null;
      star_rating_avg: number | string | null;
      star_rating_count: number | string | null;
      meme_image_url: string;
      meme_type: string;
      pipeline: string;
      pipeline_input_text: string | null;
      original_image_url: string;
      created_at: string;
      users: unknown;
    };

    const allPosts: ExportPostRow[] = [];

    for (let page = 0; ; page++) {
      const from = page * EXPORT_POST_PAGE;
      const to = from + EXPORT_POST_PAGE - 1;
      const { data: batch, error: postsError } = await supabase
        .from("posts")
        .select(
          "id, caption, star_rating_avg, star_rating_count, meme_image_url, meme_type, pipeline, pipeline_input_text, original_image_url, created_at, users!user_id(id, username, avatar_url)",
        )
        .eq("project_id", projectId)
        .not("meme_image_url", "is", null)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (postsError) return { error: postsError.message };
      if (!batch?.length) break;
      allPosts.push(...(batch as ExportPostRow[]));
      if (batch.length < EXPORT_POST_PAGE) break;
    }

    const postIds = allPosts.map((p) => p.id);
    if (postIds.length === 0) {
      return {
        payload: {
          exported_at: new Date().toISOString(),
          project: { id: projectRow.id, name: projectRow.name },
          posts: [],
        },
      };
    }

    const commentRows: {
      id: string;
      post_id: string;
      content: string;
      created_at: string;
      users: unknown;
    }[] = [];

    for (const ids of chunkIds(postIds, IN_CHUNK)) {
      const { data: cBatch, error: cErr } = await supabase
        .from("comments")
        .select(
          "id, post_id, content, created_at, users!user_id(id, username, avatar_url)",
        )
        .in("post_id", ids)
        .order("created_at", { ascending: true });
      if (cErr) return { error: cErr.message };
      if (cBatch?.length) commentRows.push(...cBatch);
    }

    const commentIds = commentRows.map((c) => c.id);
    const commentLikeCount = new Map<string, number>();
    if (commentIds.length > 0) {
      for (const ids of chunkIds(commentIds, IN_CHUNK)) {
        const { data: clBatch, error: clErr } = await supabase
          .from("comment_likes")
          .select("comment_id")
          .in("comment_id", ids);
        if (clErr) return { error: clErr.message };
        for (const row of clBatch ?? []) {
          const k = row.comment_id;
          commentLikeCount.set(k, (commentLikeCount.get(k) ?? 0) + 1);
        }
      }
    }

    const commentsByPost = new Map<string, ExportPayloadComment[]>();
    for (const c of commentRows) {
      const item: ExportPayloadComment = {
        id: c.id,
        created_at: c.created_at,
        content: c.content,
        like_count: commentLikeCount.get(c.id) ?? 0,
        user: readUser(c.users),
      };
      const list = commentsByPost.get(c.post_id) ?? [];
      list.push(item);
      commentsByPost.set(c.post_id, list);
    }

    const postLikeCount = new Map<string, number>();
    for (const ids of chunkIds(postIds, IN_CHUNK)) {
      const { data: plBatch, error: plErr } = await supabase
        .from("post_likes")
        .select("post_id")
        .in("post_id", ids);
      if (plErr) return { error: plErr.message };
      for (const row of plBatch ?? []) {
        const k = row.post_id;
        postLikeCount.set(k, (postLikeCount.get(k) ?? 0) + 1);
      }
    }

    const postsMapped: ExportPayloadPost[] = allPosts.map((p) => ({
      id: p.id,
      created_at: p.created_at,
      caption: p.caption,
      star_rating_avg:
        p.star_rating_avg != null && p.star_rating_avg !== ""
          ? Number(p.star_rating_avg)
          : null,
      star_rating_count: Number(p.star_rating_count ?? 0),
      meme_type: p.meme_type,
      pipeline: p.pipeline,
      pipeline_input_text: p.pipeline_input_text,
      meme_image_url: p.meme_image_url,
      original_image_url: p.original_image_url,
      user: readUser(p.users),
      like_count: postLikeCount.get(p.id) ?? 0,
      comments: commentsByPost.get(p.id) ?? [],
    }));

    const posts = sortPostsForDisplay(postsMapped, sort);

    return {
      payload: {
        exported_at: new Date().toISOString(),
        project: { id: projectRow.id, name: projectRow.name },
        posts,
      },
    };
  } catch (err) {
    console.error("[fetchProjectExportDataAction]", err);
    return { error: "Fehler beim Laden der Export-Daten" };
  }
}
