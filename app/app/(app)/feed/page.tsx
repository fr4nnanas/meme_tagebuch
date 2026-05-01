import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FeedContent } from "@/components/features/feed/feed-content";

export default async function FeedPage() {
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

  return <FeedContent currentUserId={user.id} isAdmin={isAdmin} />;
}
