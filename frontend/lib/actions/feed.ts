"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 10;

export interface PostUser {
  username: string;
  avatar_url: string | null;
}

export interface PostWithDetails {
  id: string;
  user_id: string;
  project_id: string;
  caption: string | null;
  meme_image_url: string | null;
  meme_type: string;
  created_at: string;
  user: PostUser;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
  signed_url: string | null;
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
        "id, user_id, project_id, caption, meme_image_url, meme_type, created_at, users!user_id(username, avatar_url)",
      )
      .eq("project_id", projectId)
      .not("meme_image_url", "is", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (postsError) return { posts: [], hasMore: false, error: postsError.message };
    if (!postsRaw || postsRaw.length === 0) return { posts: [], hasMore: false };

    const postIds = postsRaw.map((p) => p.id);

    const [{ data: likesRaw }, { data: commentsRaw }] = await Promise.all([
      supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
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

    const likeCountMap: Record<string, number> = {};
    const likedByMeSet = new Set<string>();
    for (const like of likesRaw ?? []) {
      likeCountMap[like.post_id] = (likeCountMap[like.post_id] ?? 0) + 1;
      if (like.user_id === user.id) likedByMeSet.add(like.post_id);
    }

    const commentCountMap: Record<string, number> = {};
    for (const c of commentsRaw ?? []) {
      commentCountMap[c.post_id] = (commentCountMap[c.post_id] ?? 0) + 1;
    }

    const posts: PostWithDetails[] = postsRaw.map((p) => {
      const rawUser = p.users;
      const userInfo = Array.isArray(rawUser) ? rawUser[0] : rawUser;
      return {
        id: p.id,
        user_id: p.user_id,
        project_id: p.project_id,
        caption: p.caption,
        meme_image_url: p.meme_image_url,
        meme_type: p.meme_type,
        created_at: p.created_at,
        user: {
          username: (userInfo as PostUser | null)?.username ?? "Unbekannt",
          avatar_url: (userInfo as PostUser | null)?.avatar_url ?? null,
        },
        like_count: likeCountMap[p.id] ?? 0,
        liked_by_me: likedByMeSet.has(p.id),
        comment_count: commentCountMap[p.id] ?? 0,
        signed_url: p.meme_image_url ? (signedUrlMap[p.meme_image_url] ?? null) : null,
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

    const [{ data: usersData }, { data: likesRaw }, { data: commentsRaw }] =
      await Promise.all([
        supabase.from("users").select("id, username, avatar_url").in("id", userIds),
        supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
        supabase.from("comments").select("post_id").in("post_id", postIds),
      ]);

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

    const likeCountMap: Record<string, number> = {};
    const likedByMeSet = new Set<string>();
    for (const like of likesRaw ?? []) {
      likeCountMap[like.post_id] = (likeCountMap[like.post_id] ?? 0) + 1;
      if (like.user_id === user.id) likedByMeSet.add(like.post_id);
    }

    const commentCountMap: Record<string, number> = {};
    for (const c of commentsRaw ?? []) {
      commentCountMap[c.post_id] = (commentCountMap[c.post_id] ?? 0) + 1;
    }

    const posts: PostWithDetails[] = unseenRows.map((p) => {
      const uinfo = userMap.get(p.user_id);
      return {
        id: p.id,
        user_id: p.user_id,
        project_id: p.project_id,
        caption: p.caption,
        meme_image_url: p.meme_image_url,
        meme_type: p.meme_type,
        created_at: p.created_at,
        user: {
          username: uinfo?.username ?? "Unbekannt",
          avatar_url: uinfo?.avatar_url ?? null,
        },
        like_count: likeCountMap[p.id] ?? 0,
        liked_by_me: likedByMeSet.has(p.id),
        comment_count: commentCountMap[p.id] ?? 0,
        signed_url: p.meme_image_url ? (signedUrlMap[p.meme_image_url] ?? null) : null,
      };
    });

    return { posts, hasMore: unseenRows.length === PAGE_SIZE };
  } catch (err) {
    console.error("[fetchUnseenPostsAction]", err);
    return { posts: [], hasMore: false, error: "Fehler beim Laden" };
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
        "id, user_id, project_id, caption, meme_image_url, original_image_url, meme_type, created_at, users!user_id(username, avatar_url)",
      )
      .eq("id", postId)
      .maybeSingle();

    if (postError || !p) {
      return { post: null, error: postError?.message ?? "Post nicht gefunden" };
    }

    const [{ data: likesRaw }, { data: commentsRaw }] = await Promise.all([
      supabase.from("post_likes").select("post_id, user_id").eq("post_id", postId),
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

    let like_count = 0;
    let liked_by_me = false;
    for (const like of likesRaw ?? []) {
      like_count++;
      if (like.user_id === user.id) liked_by_me = true;
    }

    const rawUser = p.users;
    const userInfo = Array.isArray(rawUser) ? rawUser[0] : rawUser;

    const post: PostWithDetails = {
      id: p.id,
      user_id: p.user_id,
      project_id: p.project_id,
      caption: p.caption,
      meme_image_url: p.meme_image_url,
      meme_type: p.meme_type,
      created_at: p.created_at,
      user: {
        username: (userInfo as PostUser | null)?.username ?? "Unbekannt",
        avatar_url: (userInfo as PostUser | null)?.avatar_url ?? null,
      },
      like_count,
      liked_by_me,
      comment_count: (commentsRaw ?? []).length,
      signed_url: signedUrl,
    };

    return { post };
  } catch (err) {
    console.error("[fetchPostDetailAction]", err);
    return { post: null, error: "Fehler beim Laden des Posts" };
  }
}

export async function togglePostLikeAction(
  postId: string,
): Promise<{ liked: boolean; like_count: number; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { liked: false, like_count: 0, error: "Nicht angemeldet" };

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

    return { liked: !existing, like_count: count ?? 0 };
  } catch (err) {
    console.error("[togglePostLikeAction]", err);
    return { liked: false, like_count: 0, error: "Fehler beim Liken" };
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
