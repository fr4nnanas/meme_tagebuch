import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileView } from "@/components/features/profile/profile-view";

interface ProfilePageProps {
  params: Promise<{ userId: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { userId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, bio, avatar_url, role")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  return (
    <ProfileView
      profile={profile}
      isOwner={user.id === profile.id}
      currentUserId={user.id}
    />
  );
}
