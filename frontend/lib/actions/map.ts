"use server";

import { createClient } from "@/lib/supabase/server";

export interface MapPost {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  meme_image_url: string | null;
  caption: string | null;
  created_at: string;
  signed_url: string | null;
  user: {
    username: string;
    avatar_url: string | null;
  };
}

export interface MapUser {
  id: string;
  username: string;
}

export interface FetchMapPostsResult {
  posts: MapPost[];
  users: MapUser[];
  error?: string;
}

export async function fetchMapPostsAction(
  projectId: string,
): Promise<FetchMapPostsResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { posts: [], users: [], error: "Nicht angemeldet" };

    const { data: raw, error: postsError } = await supabase
      .from("posts")
      .select(
        "id, user_id, lat, lng, meme_image_url, caption, created_at, users!user_id(username, avatar_url)",
      )
      .eq("project_id", projectId)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .not("meme_image_url", "is", null)
      .order("created_at", { ascending: false });

    if (postsError) return { posts: [], users: [], error: postsError.message };
    if (!raw || raw.length === 0) return { posts: [], users: [] };

    // Signed URLs für alle Meme-Thumbnails erstellen
    const memePaths = raw
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

    const posts: MapPost[] = raw.map((p) => {
      const userRaw = Array.isArray(p.users) ? p.users[0] : p.users;
      return {
        id: p.id,
        user_id: p.user_id,
        lat: p.lat as number,
        lng: p.lng as number,
        meme_image_url: p.meme_image_url,
        caption: p.caption,
        created_at: p.created_at,
        signed_url: p.meme_image_url ? (signedUrlMap[p.meme_image_url] ?? null) : null,
        user: {
          username: userRaw?.username ?? "Unbekannt",
          avatar_url: userRaw?.avatar_url ?? null,
        },
      };
    });

    // Eindeutige User-Liste für den Filter
    const userMap = new Map<string, string>();
    for (const p of posts) {
      userMap.set(p.user_id, p.user.username);
    }
    const users: MapUser[] = Array.from(userMap.entries()).map(([id, username]) => ({
      id,
      username,
    }));

    return { posts, users };
  } catch (err) {
    console.error("fetchMapPostsAction:", err);
    return { posts: [], users: [], error: "Unbekannter Fehler beim Laden der Karte." };
  }
}
