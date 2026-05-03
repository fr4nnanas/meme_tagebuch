"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { fetchMyStarRatingsForPostIds } from "@/lib/meme/fetch-my-star-ratings";
import type { JobResult } from "@/lib/meme/process-job";

const PAGE_SIZE = 10;

/** Neueste Liker zuerst; max. so viele für die Bild-Vorschau. */
const RECENT_LIKERS_PREVIEW = 4;

type PostLikeJoinRow = {
  post_id: string;
  user_id: string;
  created_at: string;
  users: unknown;
};

export interface PostLiker {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

function likerFromJoinRow(row: { user_id: string; users: unknown }): PostLiker {
  const rawUser = row.users;
  const userInfo = Array.isArray(rawUser) ? rawUser[0] : rawUser;
  return {
    user_id: row.user_id,
    username: (userInfo as PostUser | null)?.username ?? "Unbekannt",
    avatar_url: (userInfo as PostUser | null)?.avatar_url ?? null,
  };
}

/** Gruppiert Like-Zeilen pro Post, sortiert nach `created_at` absteigend, je Post max. vier Einträge. */
function buildRecentLikersByPostId(rows: PostLikeJoinRow[]): Map<string, PostLiker[]> {
  const byPost = new Map<string, PostLikeJoinRow[]>();
  for (const row of rows) {
    const list = byPost.get(row.post_id) ?? [];
    list.push(row);
    byPost.set(row.post_id, list);
  }
  const out = new Map<string, PostLiker[]>();
  for (const [postId, list] of byPost) {
    list.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    out.set(
      postId,
      list.slice(0, RECENT_LIKERS_PREVIEW).map(likerFromJoinRow),
    );
  }
  return out;
}

export interface PostUser {
  username: string;
  avatar_url: string | null;
}

export interface PostWithDetails {
  id: string;
  user_id: string;
  project_id: string;
  caption: string | null;
  /** Durchschnitt aller Sterne (2 Dezimalstellen); Anzeige: gerundete volle Sterne */
  star_rating_avg: number | null;
  star_rating_count: number;
  /** Eigene Bewertung 1–5, falls abgegeben */
  my_star_rating: number | null;
  meme_image_url: string | null;
  meme_type: string;
  pipeline: string;
  pipeline_input_text: string | null;
  original_image_url: string;
  /** Signierte URL zum Original-Upload (für Lightbox / Transparenz) */
  original_signed_url: string | null;
  created_at: string;
  user: PostUser;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
  signed_url: string | null;
  /** Bis zu vier neueste Liker (neueste zuerst), für Avatar-Stapel auf dem Meme. */
  recent_likers: PostLiker[];
}

export interface CommentUser {
  username: string;
  avatar_url: string | null;
}

export interface CommentWithDetails {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: CommentUser;
  like_count: number;
  liked_by_me: boolean;
}

export async function fetchPostsAction(
  projectId: string,
  page: number = 0,
): Promise<{ posts: PostWithDetails[]; hasMore: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { posts: [], hasMore: false, error: "Nicht angemeldet" };

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: postsRaw, error: postsError } = await supabase
      .from("posts")
      .select(
        "id, user_id, project_id, caption, star_rating_avg, star_rating_count, meme_image_url, original_image_url, pipeline, pipeline_input_text, meme_type, created_at, users!user_id(username, avatar_url)",
      )
      .eq("project_id", projectId)
      .not("meme_image_url", "is", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (postsError) return { posts: [], hasMore: false, error: postsError.message };
    if (!postsRaw || postsRaw.length === 0) return { posts: [], hasMore: false };

    const postIds = postsRaw.map((p) => p.id);
    const myStars = await fetchMyStarRatingsForPostIds(supabase, user.id, postIds);

    const [{ data: likesRaw }, { data: commentsRaw }] = await Promise.all([
      supabase
        .from("post_likes")
        .select(
          "post_id, user_id, created_at, users!user_id(username, avatar_url)",
        )
        .in("post_id", postIds),
      supabase.from("comments").select("post_id").in("post_id", postIds),
    ]);

    const memePaths = postsRaw
      .filter((p) => p.meme_image_url)
      .map((p) => p.meme_image_url as string);

    const signedUrlMap: Record<string, string> = {};
    if (memePaths.length > 0) {
      const { data: signedUrls } = await supabase.storage
        .from("memes")
        .createSignedUrls(memePaths, 3600);
      if (signedUrls) {
        memePaths.forEach((path, i) => {
          const su = signedUrls[i];
          if (su?.signedUrl) signedUrlMap[path] = su.signedUrl;
        });
      }
    }

    const originalPaths = [
      ...new Set(
        postsRaw.map((p) => p.original_image_url as string).filter(Boolean),
      ),
    ];
    const originalSignedMap: Record<string, string> = {};
    if (originalPaths.length > 0) {
      const { data: signedOrig } = await supabase.storage
        .from("originals")
        .createSignedUrls(originalPaths, 3600);
      if (signedOrig) {
        originalPaths.forEach((path, i) => {
          const su = signedOrig[i];
          if (su?.signedUrl) originalSignedMap[path] = su.signedUrl;
        });
      }
    }

    const likeCountMap: Record<string, number> = {};
    const likedByMeSet = new Set<string>();
    for (const like of likesRaw ?? []) {
      likeCountMap[like.post_id] = (likeCountMap[like.post_id] ?? 0) + 1;
      if (like.user_id === user.id) likedByMeSet.add(like.post_id);
    }

    const recentLikersByPost = buildRecentLikersByPostId(
      (likesRaw ?? []) as PostLikeJoinRow[],
    );

    const commentCountMap: Record<string, number> = {};
    for (const c of commentsRaw ?? []) {
      commentCountMap[c.post_id] = (commentCountMap[c.post_id] ?? 0) + 1;
    }

    const posts: PostWithDetails[] = postsRaw.map((p) => {
      const rawUser = p.users;
      const userInfo = Array.isArray(rawUser) ? rawUser[0] : rawUser;
      const origPath = p.original_image_url as string;
      const pr = p as typeof p & {
        star_rating_avg?: number | null;
        star_rating_count?: number | null;
      };
      const cnt = Number(pr.star_rating_count ?? 0);
      return {
        id: p.id,
        user_id: p.user_id,
        project_id: p.project_id,
        caption: p.caption,
        star_rating_avg:
          pr.star_rating_avg != null ? Number(pr.star_rating_avg) : null,
        star_rating_count: Number.isFinite(cnt) ? cnt : 0,
        my_star_rating: myStars.get(p.id) ?? null,
        meme_image_url: p.meme_image_url,
        meme_type: p.meme_type,
        pipeline: p.pipeline as string,
        pipeline_input_text: (p as { pipeline_input_text?: string | null })
          .pipeline_input_text ?? null,
        original_image_url: origPath,
        original_signed_url: originalSignedMap[origPath] ?? null,
        created_at: p.created_at,
        user: {
          username: (userInfo as PostUser | null)?.username ?? "Unbekannt",
          avatar_url: (userInfo as PostUser | null)?.avatar_url ?? null,
        },
        like_count: likeCountMap[p.id] ?? 0,
        liked_by_me: likedByMeSet.has(p.id),
        comment_count: commentCountMap[p.id] ?? 0,
        signed_url: p.meme_image_url ? (signedUrlMap[p.meme_image_url] ?? null) : null,
        recent_likers: recentLikersByPost.get(p.id) ?? [],
      };
    });

    return { posts, hasMore: postsRaw.length === PAGE_SIZE };
  } catch (err) {
    console.error("[fetchPostsAction]", err);
    return { posts: [], hasMore: false, error: "Fehler beim Laden des Feeds" };
  }
}

export async function fetchUnseenCountAction(
  projectId: string,
): Promise<{ count: number; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { count: 0, error: "Nicht angemeldet" };

    const { data, error } = await supabase.rpc("feed_unseen_count", {
      p_project_id: projectId,
    });
    if (error) return { count: 0, error: error.message };
    return { count: Number(data ?? 0) };
  } catch (err) {
    console.error("[fetchUnseenCountAction]", err);
    return { count: 0, error: "Fehler beim Zählen" };
  }
}

export async function fetchUnseenPostsAction(
  projectId: string,
  page: number = 0,
): Promise<{ posts: PostWithDetails[]; hasMore: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { posts: [], hasMore: false, error: "Nicht angemeldet" };

    const from = page * PAGE_SIZE;
    const { data: rows, error: rpcError } = await supabase.rpc(
      "feed_unseen_posts_page",
      {
        p_project_id: projectId,
        p_limit: PAGE_SIZE,
        p_offset: from,
      },
    );

    if (rpcError) return { posts: [], hasMore: false, error: rpcError.message };
    if (!rows || rows.length === 0) return { posts: [], hasMore: false };

    type UnseenRow = {
      id: string;
      user_id: string;
      project_id: string;
      caption: string | null;
      meme_image_url: string | null;
      meme_type: string;
      created_at: string;
    };
    const unseenRows = rows as UnseenRow[];

    const postIds = unseenRows.map((p) => p.id);
    const userIds = [...new Set(unseenRows.map((p) => p.user_id))];
    const myStars = await fetchMyStarRatingsForPostIds(supabase, user.id, postIds);

    const [{ data: usersData }, { data: likesRaw }, { data: commentsRaw }, { data: postExtras }] =
      await Promise.all([
        supabase.from("users").select("id, username, avatar_url").in("id", userIds),
        supabase
          .from("post_likes")
          .select(
            "post_id, user_id, created_at, users!user_id(username, avatar_url)",
          )
          .in("post_id", postIds),
        supabase.from("comments").select("post_id").in("post_id", postIds),
        supabase
          .from("posts")
          .select(
            "id, pipeline, pipeline_input_text, original_image_url, star_rating_avg, star_rating_count",
          )
          .in("id", postIds),
      ]);

    const extraById = new Map(
      (postExtras ?? []).map((row) => {
        const r = row as {
          id: string;
          pipeline: string;
          pipeline_input_text: string | null;
          original_image_url: string;
          star_rating_avg?: number | null;
          star_rating_count?: number | null;
        };
        return [
          r.id,
          {
            pipeline: r.pipeline,
            pipeline_input_text: r.pipeline_input_text,
            original_image_url: r.original_image_url,
            star_rating_avg:
              r.star_rating_avg != null ? Number(r.star_rating_avg) : null,
            star_rating_count: Number(r.star_rating_count ?? 0),
          },
        ] as const;
      }),
    );

    const userMap = new Map(
      (usersData ?? []).map((u) => [
        u.id,
        { username: u.username, avatar_url: u.avatar_url },
      ]),
    );

    const memePaths = unseenRows
      .filter((p) => p.meme_image_url)
      .map((p) => p.meme_image_url as string);

    const signedUrlMap: Record<string, string> = {};
    if (memePaths.length > 0) {
      const { data: signedUrls } = await supabase.storage
        .from("memes")
        .createSignedUrls(memePaths, 3600);
      if (signedUrls) {
        memePaths.forEach((path, i) => {
          const su = signedUrls[i];
          if (su?.signedUrl) signedUrlMap[path] = su.signedUrl;
        });
      }
    }

    const unseenOriginalPaths = [
      ...new Set(
        [...extraById.values()]
          .map((v) => v.original_image_url)
          .filter(Boolean),
      ),
    ];
    const originalSignedMap: Record<string, string> = {};
    if (unseenOriginalPaths.length > 0) {
      const { data: signedOrig } = await supabase.storage
        .from("originals")
        .createSignedUrls(unseenOriginalPaths, 3600);
      if (signedOrig) {
        unseenOriginalPaths.forEach((path, i) => {
          const su = signedOrig[i];
          if (su?.signedUrl) originalSignedMap[path] = su.signedUrl;
        });
      }
    }

    const likeCountMap: Record<string, number> = {};
    const likedByMeSet = new Set<string>();
    for (const like of likesRaw ?? []) {
      likeCountMap[like.post_id] = (likeCountMap[like.post_id] ?? 0) + 1;
      if (like.user_id === user.id) likedByMeSet.add(like.post_id);
    }

    const recentLikersByPost = buildRecentLikersByPostId(
      (likesRaw ?? []) as PostLikeJoinRow[],
    );

    const commentCountMap: Record<string, number> = {};
    for (const c of commentsRaw ?? []) {
      commentCountMap[c.post_id] = (commentCountMap[c.post_id] ?? 0) + 1;
    }

    const posts: PostWithDetails[] = unseenRows.map((p) => {
      const uinfo = userMap.get(p.user_id);
      const ex = extraById.get(p.id);
      const origPath = ex?.original_image_url ?? "";
      return {
        id: p.id,
        user_id: p.user_id,
        project_id: p.project_id,
        caption: p.caption,
        star_rating_avg: ex?.star_rating_avg ?? null,
        star_rating_count: ex?.star_rating_count ?? 0,
        my_star_rating: myStars.get(p.id) ?? null,
        meme_image_url: p.meme_image_url,
        meme_type: p.meme_type,
        pipeline: ex?.pipeline ?? "direct",
        pipeline_input_text: ex?.pipeline_input_text ?? null,
        original_image_url: origPath,
        original_signed_url: origPath ? (originalSignedMap[origPath] ?? null) : null,
        created_at: p.created_at,
        user: {
          username: uinfo?.username ?? "Unbekannt",
          avatar_url: uinfo?.avatar_url ?? null,
        },
        like_count: likeCountMap[p.id] ?? 0,
        liked_by_me: likedByMeSet.has(p.id),
        comment_count: commentCountMap[p.id] ?? 0,
        signed_url: p.meme_image_url ? (signedUrlMap[p.meme_image_url] ?? null) : null,
        recent_likers: recentLikersByPost.get(p.id) ?? [],
      };
    });

    return { posts, hasMore: unseenRows.length === PAGE_SIZE };
  } catch (err) {
    console.error("[fetchUnseenPostsAction]", err);
    return { posts: [], hasMore: false, error: "Fehler beim Laden" };
  }
}

export async function markAllProjectPostsViewedAction(
  projectId: string,
): Promise<{ marked: number; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { marked: 0, error: "Nicht angemeldet" };

    const { data, error } = await supabase.rpc("feed_mark_all_project_posts_seen", {
      p_project_id: projectId,
    });

    if (error) return { marked: 0, error: error.message };
    return { marked: Number(data ?? 0) };
  } catch (err) {
    console.error("[markAllProjectPostsViewedAction]", err);
    return { marked: 0, error: "Fehler beim Speichern" };
  }
}

export async function markPostViewedAction(
  postId: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Nicht angemeldet" };

    const { data: postExists } = await supabase
      .from("posts")
      .select("id")
      .eq("id", postId)
      .maybeSingle();
    if (!postExists) return { error: "Post nicht gefunden" };

    const { error } = await supabase.from("post_views").upsert(
      {
        user_id: user.id,
        post_id: postId,
        viewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,post_id" },
    );

    if (error) return { error: error.message };
    return {};
  } catch (err) {
    console.error("[markPostViewedAction]", err);
    return { error: "Fehler beim Speichern" };
  }
}

export async function fetchPostDetailAction(
  postId: string,
): Promise<{ post: PostWithDetails | null; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { post: null, error: "Nicht angemeldet" };

    const { data: p, error: postError } = await supabase
      .from("posts")
      .select(
        "id, user_id, project_id, caption, star_rating_avg, star_rating_count, meme_image_url, original_image_url, pipeline, pipeline_input_text, meme_type, created_at, users!user_id(username, avatar_url)",
      )
      .eq("id", postId)
      .maybeSingle();

    if (postError || !p) {
      return { post: null, error: postError?.message ?? "Post nicht gefunden" };
    }

    const myStars = await fetchMyStarRatingsForPostIds(supabase, user.id, [postId]);

    const [{ data: likesRaw }, { data: commentsRaw }] = await Promise.all([
      supabase
        .from("post_likes")
        .select("user_id, created_at, users!user_id(username, avatar_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: false }),
      supabase.from("comments").select("post_id").eq("post_id", postId),
    ]);

    let signedUrl: string | null = null;
    if (p.meme_image_url) {
      const { data: signedUrls } = await supabase.storage
        .from("memes")
        .createSignedUrls([p.meme_image_url], 3600);
      signedUrl = signedUrls?.[0]?.signedUrl ?? null;
    } else if (p.original_image_url) {
      const { data: signedUrls } = await supabase.storage
        .from("originals")
        .createSignedUrls([p.original_image_url], 3600);
      signedUrl = signedUrls?.[0]?.signedUrl ?? null;
    }

    let originalSignedUrl: string | null = null;
    if (p.original_image_url) {
      const { data: signedOrig } = await supabase.storage
        .from("originals")
        .createSignedUrls([p.original_image_url], 3600);
      originalSignedUrl = signedOrig?.[0]?.signedUrl ?? null;
    }

    const likeRows = likesRaw ?? [];
    const like_count = likeRows.length;
    const liked_by_me = likeRows.some((like) => like.user_id === user.id);
    const recent_likers: PostLiker[] = likeRows
      .slice(0, RECENT_LIKERS_PREVIEW)
      .map((row) => likerFromJoinRow(row));

    const rawUser = p.users;
    const userInfo = Array.isArray(rawUser) ? rawUser[0] : rawUser;

    const row = p as typeof p & {
      pipeline: string;
      pipeline_input_text: string | null;
      star_rating_avg?: number | null;
      star_rating_count?: number | null;
    };

    const prc = Number(row.star_rating_count ?? 0);

    const post: PostWithDetails = {
      id: p.id,
      user_id: p.user_id,
      project_id: p.project_id,
      caption: p.caption,
      star_rating_avg:
        row.star_rating_avg != null ? Number(row.star_rating_avg) : null,
      star_rating_count: Number.isFinite(prc) ? prc : 0,
      my_star_rating: myStars.get(p.id) ?? null,
      meme_image_url: p.meme_image_url,
      meme_type: p.meme_type,
      pipeline: row.pipeline,
      pipeline_input_text: row.pipeline_input_text,
      original_image_url: p.original_image_url as string,
      original_signed_url: originalSignedUrl,
      created_at: p.created_at,
      user: {
        username: (userInfo as PostUser | null)?.username ?? "Unbekannt",
        avatar_url: (userInfo as PostUser | null)?.avatar_url ?? null,
      },
      like_count,
      liked_by_me,
      comment_count: (commentsRaw ?? []).length,
      signed_url: signedUrl,
      recent_likers,
    };

    return { post };
  } catch (err) {
    console.error("[fetchPostDetailAction]", err);
    return { post: null, error: "Fehler beim Laden des Posts" };
  }
}

/** Projektmitglieder: Liste der Nutzer, die diesen Post geliked haben (neueste zuerst). */
export async function fetchPostLikersAction(
  postId: string,
): Promise<{ likers: PostLiker[]; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { likers: [], error: "Nicht angemeldet" };

    const { data: rows, error } = await supabase
      .from("post_likes")
      .select("user_id, created_at, users!user_id(username, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: false });

    if (error) return { likers: [], error: error.message };
    if (!rows?.length) return { likers: [] };

    const likers: PostLiker[] = rows.map((row) => likerFromJoinRow(row));

    return { likers };
  } catch (err) {
    console.error("[fetchPostLikersAction]", err);
    return { likers: [], error: "Fehler beim Laden der Likes" };
  }
}

export async function togglePostLikeAction(
  postId: string,
): Promise<{
  liked: boolean;
  like_count: number;
  recent_likers: PostLiker[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return { liked: false, like_count: 0, recent_likers: [], error: "Nicht angemeldet" };

    const { data: existing } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
    }

    const { count } = await supabase
      .from("post_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", postId);

    const { data: recentRows } = await supabase
      .from("post_likes")
      .select("user_id, created_at, users!user_id(username, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .limit(RECENT_LIKERS_PREVIEW);

    const recent_likers: PostLiker[] = (recentRows ?? []).map((row) =>
      likerFromJoinRow(row),
    );

    return { liked: !existing, like_count: count ?? 0, recent_likers };
  } catch (err) {
    console.error("[togglePostLikeAction]", err);
    return {
      liked: false,
      like_count: 0,
      recent_likers: [],
      error: "Fehler beim Liken",
    };
  }
}

export async function fetchCommentsAction(
  postId: string,
): Promise<{ comments: CommentWithDetails[]; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { comments: [], error: "Nicht angemeldet" };

    const { data: commentsRaw, error: commentsError } = await supabase
      .from("comments")
      .select("id, post_id, user_id, content, created_at, users!user_id(username, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (commentsError) return { comments: [], error: commentsError.message };
    if (!commentsRaw || commentsRaw.length === 0) return { comments: [] };

    const commentIds = commentsRaw.map((c) => c.id);

    const { data: likesRaw } = await supabase
      .from("comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", commentIds);

    const likeCountMap: Record<string, number> = {};
    const likedByMeSet = new Set<string>();
    for (const like of likesRaw ?? []) {
      likeCountMap[like.comment_id] = (likeCountMap[like.comment_id] ?? 0) + 1;
      if (like.user_id === user.id) likedByMeSet.add(like.comment_id);
    }

    const comments: CommentWithDetails[] = commentsRaw.map((c) => {
      const rawUser = c.users;
      const userInfo = Array.isArray(rawUser) ? rawUser[0] : rawUser;
      return {
        id: c.id,
        post_id: c.post_id,
        user_id: c.user_id,
        content: c.content,
        created_at: c.created_at,
        user: {
          username: (userInfo as CommentUser | null)?.username ?? "Unbekannt",
          avatar_url: (userInfo as CommentUser | null)?.avatar_url ?? null,
        },
        like_count: likeCountMap[c.id] ?? 0,
        liked_by_me: likedByMeSet.has(c.id),
      };
    });

    return { comments };
  } catch (err) {
    console.error("[fetchCommentsAction]", err);
    return { comments: [], error: "Fehler beim Laden der Kommentare" };
  }
}

export async function addCommentAction(
  postId: string,
  content: string,
): Promise<{ comment?: CommentWithDetails; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Nicht angemeldet" };

    const trimmed = content.trim();
    if (!trimmed) return { error: "Kommentar darf nicht leer sein" };
    if (trimmed.length > 500) return { error: "Kommentar zu lang (max. 500 Zeichen)" };

    const { data: newComment, error: insertError } = await supabase
      .from("comments")
      .insert({ post_id: postId, user_id: user.id, content: trimmed })
      .select("id, post_id, user_id, content, created_at")
      .single();

    if (insertError || !newComment) {
      return { error: insertError?.message ?? "Fehler beim Erstellen des Kommentars" };
    }

    const { data: userInfo } = await supabase
      .from("users")
      .select("username, avatar_url")
      .eq("id", user.id)
      .single();

    const comment: CommentWithDetails = {
      ...newComment,
      user: {
        username: userInfo?.username ?? "Unbekannt",
        avatar_url: userInfo?.avatar_url ?? null,
      },
      like_count: 0,
      liked_by_me: false,
    };

    return { comment };
  } catch (err) {
    console.error("[addCommentAction]", err);
    return { error: "Fehler beim Hinzufügen des Kommentars" };
  }
}

export async function deleteCommentAction(
  commentId: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Nicht angemeldet" };

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
    return {};
  } catch (err) {
    console.error("[deleteCommentAction]", err);
    return { error: "Fehler beim Löschen des Kommentars" };
  }
}

export async function toggleCommentLikeAction(
  commentId: string,
): Promise<{ liked: boolean; like_count: number; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { liked: false, like_count: 0, error: "Nicht angemeldet" };

    const { data: existing } = await supabase
      .from("comment_likes")
      .select("comment_id")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("comment_likes")
        .insert({ comment_id: commentId, user_id: user.id });
    }

    const { count } = await supabase
      .from("comment_likes")
      .select("*", { count: "exact", head: true })
      .eq("comment_id", commentId);

    return { liked: !existing, like_count: count ?? 0 };
  } catch (err) {
    console.error("[toggleCommentLikeAction]", err);
    return { liked: false, like_count: 0, error: "Fehler beim Liken des Kommentars" };
  }
}

export async function deletePostAction(postId: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Nicht angemeldet" };

    const { data: post } = await supabase
      .from("posts")
      .select("meme_image_url, original_image_url, user_id")
      .eq("id", postId)
      .single();

    if (!post) return { error: "Post nicht gefunden" };

    const isOwner = post.user_id === user.id;
    if (!isOwner) {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role !== "admin") return { error: "Keine Berechtigung" };
    }

    const storageCleanup: Promise<unknown>[] = [];
    if (post.meme_image_url) {
      storageCleanup.push(supabase.storage.from("memes").remove([post.meme_image_url]));
    }
    if (post.original_image_url) {
      storageCleanup.push(
        supabase.storage.from("originals").remove([post.original_image_url]),
      );
    }
    await Promise.all(storageCleanup);

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId);

    if (error) return { error: error.message };

    revalidatePath("/feed");
    return {};
  } catch (err) {
    console.error("[deletePostAction]", err);
    return { error: "Fehler beim Löschen des Posts" };
  }
}

export interface MovePostProjectOption {
  id: string;
  name: string;
}

/** Zielprojekte zum Verschieben: eigene Mitgliedschaften; Admin sieht alle Projekte. */
export async function fetchDestinationProjectsForMoveAction(
  excludeProjectId: string,
): Promise<{ projects: MovePostProjectOption[]; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { projects: [], error: "Nicht angemeldet" };

    const { data: me, error: roleErr } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (roleErr) return { projects: [], error: roleErr.message };

    if (me?.role === "admin") {
      const { data: rows, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");
      if (error) return { projects: [], error: error.message };
      return {
        projects: (rows ?? [])
          .filter((p) => p.id !== excludeProjectId)
          .map((p) => ({ id: p.id, name: p.name })),
      };
    }

    const { data: mems, error: mErr } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.id);

    if (mErr) return { projects: [], error: mErr.message };

    const ids = [...new Set((mems ?? []).map((m) => m.project_id))].filter(
      (id) => id !== excludeProjectId,
    );
    if (ids.length === 0) return { projects: [] };

    const { data: projs, error: pErr } = await supabase
      .from("projects")
      .select("id, name")
      .in("id", ids)
      .order("name");

    if (pErr) return { projects: [], error: pErr.message };
    return { projects: (projs ?? []).map((p) => ({ id: p.id, name: p.name })) };
  } catch (err) {
    console.error("[fetchDestinationProjectsForMoveAction]", err);
    return { projects: [], error: "Projekte konnten nicht geladen werden." };
  }
}

async function collectPathsToRelocate(
  svc: ReturnType<typeof createServiceRoleClient>,
  postId: string,
  oldProjectId: string,
  originalPath: string,
  memePath: string | null,
): Promise<Map<string, "originals" | "memes">> {
  const map = new Map<string, "originals" | "memes">();
  if (originalPath.startsWith(`${oldProjectId}/`)) {
    map.set(originalPath, "originals");
  }
  if (memePath && memePath.startsWith(`${oldProjectId}/`)) {
    map.set(memePath, "memes");
  }

  const { data: job } = await svc
    .from("jobs")
    .select("error_msg")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (job?.error_msg) {
    try {
      const parsed = JSON.parse(job.error_msg) as JobResult;
      if (parsed.type === "ai_generated" && Array.isArray(parsed.variantPaths)) {
        for (const p of parsed.variantPaths) {
          if (typeof p === "string" && p.startsWith(`${oldProjectId}/`)) {
            map.set(p, "memes");
          }
        }
      }
    } catch {
      /* ignorieren */
    }
  }

  return map;
}

/**
 * Post in ein anderes Projekt verschieben (Storage-Pfade mitziehen).
 * Mitglied: nur eigene Posts, Ziel nur eigene Projekte. Admin: beliebig.
 */
export async function movePostToProjectAction(
  postId: string,
  targetProjectId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  if (!targetProjectId?.trim()) {
    return { error: "Zielprojekt fehlt" };
  }

  const { data: actor } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = actor?.role === "admin";

  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, user_id, project_id, original_image_url, meme_image_url")
    .eq("id", postId)
    .maybeSingle();

  if (postErr || !post) return { error: "Post nicht gefunden" };
  if (!post.meme_image_url) {
    return { error: "Nur veröffentlichte Memes können verschoben werden." };
  }

  const isOwner = post.user_id === user.id;
  if (!isOwner && !isAdmin) {
    return { error: "Keine Berechtigung" };
  }

  if (post.project_id === targetProjectId) {
    return { error: "Post ist bereits in diesem Projekt." };
  }

  if (!isAdmin) {
    const { data: tgtMem } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("project_id", targetProjectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!tgtMem) return { error: "Zielprojekt nicht verfügbar oder kein Mitglied." };
  } else {
    const { data: exists } = await supabase
      .from("projects")
      .select("id")
      .eq("id", targetProjectId)
      .maybeSingle();
    if (!exists) return { error: "Zielprojekt existiert nicht." };
  }

  const oldProjectId = post.project_id as string;
  const authorId = post.user_id as string;

  const svc = createServiceRoleClient();
  const pathMap = await collectPathsToRelocate(
    svc,
    postId,
    oldProjectId,
    post.original_image_url as string,
    post.meme_image_url as string,
  );

  const newPrefix = `${targetProjectId}/${authorId}/`;
  const oldPrefix = `${oldProjectId}/${authorId}/`;

  const copies: { bucket: "originals" | "memes"; from: string; to: string }[] =
    [];
  for (const [fromPath, bucket] of pathMap) {
    if (!fromPath.startsWith(oldPrefix)) continue;
    const suffix = fromPath.slice(oldPrefix.length);
    const toPath = `${newPrefix}${suffix}`;
    copies.push({ bucket, from: fromPath, to: toPath });
  }

  if (copies.length === 0) {
    return { error: "Keine verschiebbaren Dateien gefunden." };
  }

  for (const c of copies) {
    const { data: blob, error: dlErr } = await svc.storage
      .from(c.bucket)
      .download(c.from);
    if (dlErr || !blob) {
      return { error: `Download fehlgeschlagen (${c.from}): ${dlErr?.message ?? ""}` };
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    const { error: upErr } = await svc.storage
      .from(c.bucket)
      .upload(c.to, buf, { contentType: "image/jpeg", upsert: true });
    if (upErr) {
      return { error: `Upload fehlgeschlagen (${c.to}): ${upErr.message}` };
    }
  }

  const newOriginal =
    post.original_image_url &&
    String(post.original_image_url).startsWith(oldPrefix)
      ? `${newPrefix}${String(post.original_image_url).slice(oldPrefix.length)}`
      : (post.original_image_url as string);

  const newMeme =
    post.meme_image_url &&
    String(post.meme_image_url).startsWith(oldPrefix)
      ? `${newPrefix}${String(post.meme_image_url).slice(oldPrefix.length)}`
      : (post.meme_image_url as string);

  const { error: updErr } = await svc
    .from("posts")
    .update({
      project_id: targetProjectId,
      original_image_url: newOriginal,
      meme_image_url: newMeme,
    })
    .eq("id", postId);

  if (updErr) {
    return { error: updErr.message };
  }

  const { data: jobRow } = await svc
    .from("jobs")
    .select("id, error_msg")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (jobRow?.error_msg) {
    try {
      const parsed = JSON.parse(jobRow.error_msg) as JobResult;
      if (parsed.type === "ai_generated" && Array.isArray(parsed.variantPaths)) {
        const nextPaths = parsed.variantPaths.map((p) =>
          typeof p === "string" && p.startsWith(oldPrefix)
            ? `${newPrefix}${p.slice(oldPrefix.length)}`
            : p,
        );
        const updated: JobResult = {
          ...parsed,
          variantPaths: nextPaths,
        };
        await svc
          .from("jobs")
          .update({
            error_msg: JSON.stringify(updated),
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobRow.id);
      }
    } catch {
      /* ignorieren */
    }
  }

  const fromPaths = [...pathMap.keys()];
  for (const fromPath of fromPaths) {
    const b = pathMap.get(fromPath)!;
    await svc.storage.from(b).remove([fromPath]);
  }

  revalidatePath("/feed");
  revalidatePath("/profile");
  return {};
}

export async function updatePostCaptionAction(
  postId: string,
  caption: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Nicht angemeldet" };

    const { error } = await supabase
      .from("posts")
      .update({ caption: caption.trim() || null })
      .eq("id", postId)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
    return {};
  } catch (err) {
    console.error("[updatePostCaptionAction]", err);
    return { error: "Fehler beim Speichern der Caption" };
  }
}

export type SetMyPostStarRatingResult =
  | {
      error?: undefined;
      star_rating_avg: number | null;
      star_rating_count: number;
      my_star_rating: number | null;
    }
  | { error: string };

/**
 * Eigene Sterne-Bewertung setzen oder entfernen (Durchschnitt aller Nutzer, 2 Dezimalstellen).
 * Erlaubt für jeden eingeloggten Projektmitglied-Post (RLS), nicht nur für eigene Memes.
 */
export async function setMyPostStarRatingAction(
  postId: string,
  stars: number | null,
): Promise<SetMyPostStarRatingResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Nicht angemeldet" };

    if (
      stars !== null &&
      (!Number.isInteger(stars) || stars < 1 || stars > 5)
    ) {
      return { error: "Ungültige Sterne-Bewertung" };
    }

    if (stars === null) {
      const { error: delErr } = await supabase
        .from("post_star_ratings")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
      if (delErr) return { error: delErr.message };
    } else {
      const { error: upErr } = await supabase.from("post_star_ratings").upsert(
        {
          post_id: postId,
          user_id: user.id,
          rating: stars,
        },
        { onConflict: "post_id,user_id" },
      );
      if (upErr) return { error: upErr.message };
    }

    const { data: prow, error: readErr } = await supabase
      .from("posts")
      .select("star_rating_avg, star_rating_count, user_id")
      .eq("id", postId)
      .maybeSingle();

    if (readErr || !prow) {
      return { error: readErr?.message ?? "Post nicht gefunden" };
    }

    const pr = prow as {
      star_rating_avg?: number | null;
      star_rating_count?: number | null;
      user_id?: string;
    };
    const cnt = Number(pr.star_rating_count ?? 0);
    const postAuthorId = pr.user_id;

    revalidatePath("/feed");
    revalidatePath("/feed/raster");
    revalidatePath("/feed/verpasst");
    revalidatePath("/settings");
    revalidatePath(`/profile/${user.id}`);
    if (postAuthorId && postAuthorId !== user.id) {
      revalidatePath(`/profile/${postAuthorId}`);
    }

    return {
      star_rating_avg: pr.star_rating_avg != null ? Number(pr.star_rating_avg) : null,
      star_rating_count: Number.isFinite(cnt) ? cnt : 0,
      my_star_rating: stars === null ? null : stars,
    };
  } catch (err) {
    console.error("[setMyPostStarRatingAction]", err);
    return { error: "Fehler beim Speichern der Bewertung" };
  }
}
