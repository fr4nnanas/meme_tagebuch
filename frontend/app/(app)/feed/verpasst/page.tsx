import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UnseenFeedContent } from "@/components/features/feed/unseen-feed-content";

export default async function FeedVerpasstPage() {
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

  return <UnseenFeedContent currentUserId={user.id} isAdmin={isAdmin} />;
}
