import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { ProjectWithMembers, TokenRow, UserRow } from "@/lib/admin/types";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  ai_prompt_context: string | null;
  daily_ai_generated_limit?: number;
  created_at: string;
};

type DbClient = Awaited<ReturnType<typeof createClient>>;

async function fetchProjectsBulk(
  db: DbClient,
): Promise<{ data: ProjectRow[] | null; errorMsg: string | null }> {
  const res = await db
    .from("projects")
    .select(
      "id, name, description, ai_prompt_context, daily_ai_generated_limit, created_at",
    )
    .order("created_at", { ascending: false });
  if (!res.error) {
    return { data: (res.data ?? []) as ProjectRow[], errorMsg: null };
  }
  const msg = res.error.message.toLowerCase();
  const maybeMissingLimit =
    msg.includes("daily_ai_generated_limit") ||
    (msg.includes("column") && msg.includes("does not exist"));
  if (maybeMissingLimit) {
    const withoutLimit = await db
      .from("projects")
      .select("id, name, description, ai_prompt_context, created_at")
      .order("created_at", { ascending: false });
    if (!withoutLimit.error) {
      const rows = (withoutLimit.data ?? []) as Omit<
        ProjectRow,
        "daily_ai_generated_limit"
      >[];
      return {
        data: rows.map((r) => ({ ...r, daily_ai_generated_limit: 5 })),
        errorMsg: null,
      };
    }
  }
  const maybeMissingAiColumn =
    msg.includes("ai_prompt_context") ||
    (msg.includes("column") && msg.includes("does not exist"));
  if (maybeMissingAiColumn) {
    const min = await db
      .from("projects")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: false });
    if (min.error) {
      return { data: null, errorMsg: min.error.message };
    }
    const rows = (min.data ?? []) as Omit<ProjectRow, "ai_prompt_context">[];
    return {
      data: rows.map((r) => ({
        ...r,
        ai_prompt_context: null,
        daily_ai_generated_limit: 5,
      })),
      errorMsg: null,
    };
  }
  return { data: null, errorMsg: res.error.message };
}

async function fetchMemberRows(
  db: DbClient,
): Promise<{ data: { project_id: string; user_id: string }[] | null; errorMsg: string | null }> {
  const res = await db.from("project_members").select("project_id, user_id");
  if (res.error) {
    return { data: null, errorMsg: res.error.message };
  }
  return { data: res.data ?? [], errorMsg: null };
}

async function withServiceRoleFallback<T extends { errorMsg: string | null }>(
  sessionFirst: Promise<T>,
  retry: () => Promise<T>,
  hasSr: boolean,
): Promise<T & { fellBackToServiceRole: boolean }> {
  const first = await sessionFirst;
  if (!first.errorMsg) {
    return { ...first, fellBackToServiceRole: false };
  }
  if (!hasSr) {
    return { ...first, fellBackToServiceRole: false };
  }
  const second = await retry();
  return {
    ...second,
    fellBackToServiceRole: Boolean(first.errorMsg && !second.errorMsg),
  };
}

export type AdminDashboardData = {
  projects: ProjectWithMembers[];
  users: UserRow[];
  tokens: TokenRow[];
  aiLimit: number;
  /** Gespeicherte Projekt-UUID oder leer → kein Auto-Beitritt */
  defaultMemberProjectId: string | null;
  diagnostics: string | null;
};

export async function loadAdminDashboardData(
  supabase: DbClient,
): Promise<AdminDashboardData> {
  const hasServiceRoleKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );

  const [projectsPkg, membersPkg, rawUsersPkg, tokensPkg, settingsPkg] =
    await Promise.all([
      withServiceRoleFallback(
        fetchProjectsBulk(supabase),
        () => fetchProjectsBulk(createServiceRoleClient()),
        hasServiceRoleKey,
      ),
      withServiceRoleFallback(
        fetchMemberRows(supabase),
        () => fetchMemberRows(createServiceRoleClient()),
        hasServiceRoleKey,
      ),

      supabase
        .from("users")
        .select("id, username, role, created_at")
        .order("created_at", { ascending: true }),

      supabase
        .from("invitation_tokens")
        .select("id, token, created_at")
        .order("created_at", { ascending: false }),

      supabase
        .from("settings")
        .select("key, value")
        .in("key", ["daily_ai_image_limit", "default_member_project_id"]),
    ]);

  const projectRows = projectsPkg.data ?? [];
  const membersByProjectId = new Map<
    string,
    ProjectWithMembers["project_members"]
  >();

  for (const m of membersPkg.data ?? []) {
    const list = membersByProjectId.get(m.project_id) ?? [];
    list.push({ user_id: m.user_id });
    membersByProjectId.set(m.project_id, list);
  }

  const projects = projectRows.map((row) => {
    const lim =
      typeof row.daily_ai_generated_limit === "number" &&
      row.daily_ai_generated_limit >= 1 &&
      row.daily_ai_generated_limit <= 100
        ? row.daily_ai_generated_limit
        : 5;
    return {
      ...row,
      daily_ai_generated_limit: lim,
      project_members: membersByProjectId.get(row.id) ?? [],
    };
  }) satisfies ProjectWithMembers[];

  const dataErrors = [
    projectsPkg.errorMsg && `Projekte: ${projectsPkg.errorMsg}`,
    membersPkg.errorMsg && `Mitgliedschaften: ${membersPkg.errorMsg}`,
  ].filter(Boolean) as string[];

  const diagnostics =
    dataErrors.length > 0
      ? dataErrors.join(" · ")
      : projectsPkg.fellBackToServiceRole || membersPkg.fellBackToServiceRole
        ? "Hinweis: Daten wurden mit Service-Role geladen (Session-Queries schlugen fehl). Prüfe RLS und JWT."
        : null;

  const rawUsers = rawUsersPkg.data;
  const tokens = tokensPkg.data;
  const settingsRows = settingsPkg.data ?? [];
  const settingsMap = new Map(settingsRows.map((r) => [r.key, r.value]));
  const aiLimitSetting = settingsMap.get("daily_ai_image_limit");
  const lobbyRaw = settingsMap.get("default_member_project_id")?.trim() ?? "";

  const aiLimit = parseInt(aiLimitSetting ?? "5", 10);

  return {
    projects,
    users: (rawUsers ?? []) as UserRow[],
    tokens: (tokens ?? []) as TokenRow[],
    aiLimit,
    defaultMemberProjectId: lobbyRaw.length > 0 ? lobbyRaw : null,
    diagnostics,
  };
}
