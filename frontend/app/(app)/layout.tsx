import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ProjectProvider,
  type ProjectInfo,
} from "@/components/features/app/project-context";
import { ProjectDeepLinkSync } from "@/components/features/app/project-deeplink-sync";
import { BottomNav } from "@/components/features/app/bottom-nav";
import { JobProvider } from "@/components/features/app/job-context";
import { GlobalProgressBar } from "@/components/features/app/job-progress-bar";
import { MemeJobBanner } from "@/components/features/app/meme-job-banner";
import { JobCompletionHandler } from "@/components/features/upload/job-completion-handler";
import { InterimWelcomeBanner } from "@/components/features/app/interim-welcome-banner";
import { shouldShowInterimWelcomeBanner } from "@/lib/app/interim-welcome";

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

  // Projekte des Users laden – zuerst Mitgliedschaften, dann Projekt-Stammdaten.
  // Zwei einfache Queries sind hier robuster als ein Embedded-Select.
  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id);

  const projectIds = (memberships ?? []).map((m) => m.project_id);
  let initialProjects: ProjectInfo[] = [];

  const { data: profile } = await supabase
    .from("users")
    .select("username, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const showInterimWelcome =
    profile?.created_at != null &&
    shouldShowInterimWelcomeBanner(profile.created_at);

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
      <Suspense fallback={null}>
        <ProjectDeepLinkSync />
      </Suspense>
      <JobProvider>
        <GlobalProgressBar />
        <MemeJobBanner />
        <div className="flex min-h-screen flex-col bg-zinc-900 text-zinc-100">
          <main className="mx-auto w-full max-w-md flex-1 pb-24">
            {showInterimWelcome ? (
              <InterimWelcomeBanner
                userId={user.id}
                username={profile?.username ?? ""}
              />
            ) : null}
            {children}
          </main>
          <BottomNav userId={user.id} />
        </div>
        <JobCompletionHandler />
      </JobProvider>
    </ProjectProvider>
  );
}
