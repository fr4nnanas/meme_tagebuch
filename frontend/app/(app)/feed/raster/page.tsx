import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectMemeGrid } from "@/components/features/feed/project-meme-grid";

export default async function FeedRasterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  return <ProjectMemeGrid currentUserId={user.id} isAdmin={isAdmin} />;
}
