import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { AdminTabs } from "@/components/features/admin/admin-tabs";

export type ProjectWithMembers = {
  id: string;
  name: string;
  description: string | null;
  ai_prompt_context: string | null;
  created_at: string;
  project_members: { user_id: string }[];
};

export type UserRow = {
  id: string;
  username: string;
  role: string;
  created_at: string;
};

export type TokenRow = {
  id: string;
  token: string;
  created_at: string;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  ai_prompt_context: string | null;
  created_at: string;
};

type DbClient = Awaited<ReturnType<typeof createClient>>;

async function fetchProjectsBulk(
  db: DbClient,
): Promise<{ data: ProjectRow[] | null; errorMsg: string | null }> {
  const res = await db
    .from("projects")
    .select("id, name, description, ai_prompt_context, created_at")
    .order("created_at", { ascending: false });
  if (!res.error) {
    return { data: (res.data ?? []) as ProjectRow[], errorMsg: null };
  }
  const msg = res.error.message.toLowerCase();
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
      data: rows.map((r) => ({ ...r, ai_prompt_context: null })),
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

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/feed");

  const hasServiceRoleKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );

  // Zwei Queries wie im App-Layout: eingebettetes project_members() ist in PostgREST/RLS
  // weniger stabil; Fallback mit Service Role bei Session-Fehlern.
  const [projectsPkg, membersPkg, rawUsersPkg, tokensPkg, aiLimitPkg] =
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
        .select("value")
        .eq("key", "daily_ai_image_limit")
        .maybeSingle(),
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

  const projects = projectRows.map((row) => ({
    ...row,
    project_members: membersByProjectId.get(row.id) ?? [],
  })) satisfies ProjectWithMembers[];

  const dataErrors = [
    projectsPkg.errorMsg && `Projekte: ${projectsPkg.errorMsg}`,
    membersPkg.errorMsg && `Mitgliedschaften: ${membersPkg.errorMsg}`,
  ].filter(Boolean) as string[];

  const adminDataDiagnostics =
    dataErrors.length > 0
      ? dataErrors.join(" · ")
      : projectsPkg.fellBackToServiceRole || membersPkg.fellBackToServiceRole
        ? "Hinweis: Daten wurden mit Service-Role geladen (Session-Queries schlugen fehl). Prüfe RLS und JWT."
        : null;
  const rawUsers = rawUsersPkg.data;
  const tokens = tokensPkg.data;
  const aiLimitSetting = aiLimitPkg.data;

  const users = (rawUsers ?? []) as UserRow[];
  const tokenList = (tokens ?? []) as TokenRow[];
  const aiLimit = parseInt(aiLimitSetting?.value ?? "5", 10);

  return (
    <div className="px-4 pt-6 pb-28">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-orange-400" />
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          Admin
        </h1>
      </div>

      <AdminTabs
        projects={projects}
        users={users}
        tokens={tokenList}
        aiLimit={aiLimit}
        currentUserId={user.id}
        diagnostics={adminDataDiagnostics}
      />
    </div>
  );
}
