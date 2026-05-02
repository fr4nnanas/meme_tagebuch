import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadAdminDashboardData } from "@/lib/admin/load-dashboard-data";
import { SettingsShell } from "@/components/features/settings/settings-shell";

type SearchParams = Promise<{ tab?: string }>;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
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

  const isAdmin = profile?.role === "admin";
  const { tab } = await searchParams;
  const initialMainTab = tab === "admin" ? "admin" : "einstellungen";

  if (isAdmin) {
    const adminData = await loadAdminDashboardData(supabase);
    return (
      <SettingsShell
        isAdmin
        initialMainTab={initialMainTab}
        currentUserId={user.id}
        adminData={adminData}
      />
    );
  }

  return (
    <SettingsShell
      isAdmin={false}
      initialMainTab="einstellungen"
      currentUserId={user.id}
      adminData={null}
    />
  );
}
