import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ProjectProvider,
  type ProjectInfo,
} from "@/components/features/app/project-context";
import { BottomNav } from "@/components/features/app/bottom-nav";
import { JobProvider } from "@/components/features/app/job-context";
import { GlobalProgressBar } from "@/components/features/app/job-progress-bar";
import { JobCompletionHandler } from "@/components/features/upload/job-completion-handler";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  // Projekte des Users laden – zuerst Mitgliedschaften, dann Projekt-Stammdaten.
  // Zwei einfache Queries sind hier robuster als ein Embedded-Select.
  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id);

  const projectIds = (memberships ?? []).map((m) => m.project_id);
  let initialProjects: ProjectInfo[] = [];

  if (projectIds.length > 0) {
    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, name")
      .in("id", projectIds)
      .order("name", { ascending: true });

    initialProjects = (projectsData ?? []).map((p) => ({
      id: p.id,
      name: p.name,
    }));
  }

  return (
    <ProjectProvider initialProjects={initialProjects}>
      <JobProvider>
        <GlobalProgressBar />
        <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
          <main className="mx-auto w-full max-w-md flex-1 pb-24">
            {children}
          </main>
          <BottomNav userId={user.id} isAdmin={isAdmin} />
        </div>
        <JobCompletionHandler />
      </JobProvider>
    </ProjectProvider>
  );
}
