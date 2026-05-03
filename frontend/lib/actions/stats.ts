"use server";

import { createClient } from "@/lib/supabase/server";

export interface MemeScoreRow {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  meme_count: number;
}

export interface ProjectDestination {
  id: string;
  name: string;
}

/** Rangliste: veröffentlichte Memes (meme_image_url gesetzt) pro Autor im Projekt. */
export async function fetchProjectMemeScoreboardAction(
  projectId: string,
): Promise<{ rows: MemeScoreRow[]; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { rows: [], error: "Nicht angemeldet" };

    const { data: membership } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      const { data: prof } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.role !== "admin") return { rows: [], error: "Kein Zugriff" };
    }

    const { data: posts, error } = await supabase
      .from("posts")
      .select("user_id, users!user_id(username, avatar_url)")
      .eq("project_id", projectId)
      .not("meme_image_url", "is", null);

    if (error) return { rows: [], error: error.message };

    const byUser = new Map<
      string,
      { username: string; avatar_url: string | null; count: number }
    >();

    for (const row of posts ?? []) {
      const uid = row.user_id as string;
      const raw = row.users;
      const u = (Array.isArray(raw) ? raw[0] : raw) as {
        username?: string;
        avatar_url?: string | null;
      } | null;
      const prev = byUser.get(uid);
      const username = u?.username ?? "Unbekannt";
      const avatar_url =
        u?.avatar_url !== undefined && u?.avatar_url !== null
          ? String(u.avatar_url)
          : null;
      if (prev) {
        prev.count += 1;
      } else {
        byUser.set(uid, { username, avatar_url, count: 1 });
      }
    }

    const sorted = [...byUser.entries()].sort((a, b) => b[1].count - a[1].count);
    const rows: MemeScoreRow[] = sorted.map(([user_id, v], i) => ({
      rank: i + 1,
      user_id,
      username: v.username,
      avatar_url: v.avatar_url,
      meme_count: v.count,
    }));

    return { rows };
  } catch (err) {
    console.error("[fetchProjectMemeScoreboardAction]", err);
    return { rows: [], error: "Rangliste konnte nicht geladen werden." };
  }
}

/**
 * Gesamt-Rangliste über alle Projekte, in denen der Nutzer Mitglied ist:
 * zählt nur Memes in diesen Projekten (keine fremden Projekte).
 */
export async function fetchOverallMemeScoreboardForMyProjectsAction(): Promise<{
  rows: MemeScoreRow[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { rows: [], error: "Nicht angemeldet" };

    const { data: memberships, error: mErr } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.id);

    if (mErr) return { rows: [], error: mErr.message };
    const projectIds = [...new Set((memberships ?? []).map((m) => m.project_id))];
    if (projectIds.length === 0) return { rows: [] };

    const { data: posts, error } = await supabase
      .from("posts")
      .select("user_id, users!user_id(username, avatar_url)")
      .in("project_id", projectIds)
      .not("meme_image_url", "is", null);

    if (error) return { rows: [], error: error.message };

    const byUser = new Map<
      string,
      { username: string; avatar_url: string | null; count: number }
    >();

    for (const row of posts ?? []) {
      const uid = row.user_id as string;
      const raw = row.users;
      const u = (Array.isArray(raw) ? raw[0] : raw) as {
        username?: string;
        avatar_url?: string | null;
      } | null;
      const prev = byUser.get(uid);
      const username = u?.username ?? "Unbekannt";
      const avatar_url =
        u?.avatar_url !== undefined && u?.avatar_url !== null
          ? String(u.avatar_url)
          : null;
      if (prev) {
        prev.count += 1;
      } else {
        byUser.set(uid, { username, avatar_url, count: 1 });
      }
    }

    const sorted = [...byUser.entries()].sort((a, b) => b[1].count - a[1].count);
    const rows: MemeScoreRow[] = sorted.map(([user_id, v], i) => ({
      rank: i + 1,
      user_id,
      username: v.username,
      avatar_url: v.avatar_url,
      meme_count: v.count,
    }));

    return { rows };
  } catch (err) {
    console.error("[fetchOverallMemeScoreboardForMyProjectsAction]", err);
    return { rows: [], error: "Gesamt-Rangliste konnte nicht geladen werden." };
  }
}
