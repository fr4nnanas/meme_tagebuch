"use server";

import { createClient } from "@/lib/supabase/server";

export interface ProjectMemberPreview {
  id: string;
  username: string;
  avatar_url: string | null;
}

export async function fetchProjectMembersAction(
  projectId: string,
): Promise<{ members: ProjectMemberPreview[]; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { members: [], error: "Nicht angemeldet." };

    const { data: myMembership } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!myMembership) {
      return { members: [], error: "Kein Zugriff auf dieses Projekt." };
    }

    const { data: rows, error } = await supabase
      .from("project_members")
      .select("users(id, username, avatar_url)")
      .eq("project_id", projectId);

    if (error) return { members: [], error: error.message };

    const members: ProjectMemberPreview[] = (rows ?? [])
      .map((r) => {
        const raw = r.users;
        const u = Array.isArray(raw) ? raw[0] : raw;
        if (!u || typeof u !== "object" || !("id" in u) || !("username" in u)) {
          return null;
        }
        return {
          id: String(u.id),
          username: String(u.username),
          avatar_url:
            "avatar_url" in u && u.avatar_url != null
              ? String(u.avatar_url)
              : null,
        };
      })
      .filter((m): m is ProjectMemberPreview => m !== null)
      .sort((a, b) => a.username.localeCompare(b.username, "de"));

    return { members };
  } catch (err) {
    console.error("[fetchProjectMembersAction]", err);
    return { members: [], error: "Mitglieder konnten nicht geladen werden." };
  }
}
