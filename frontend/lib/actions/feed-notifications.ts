"use server";

import { createClient } from "@/lib/supabase/server";

export interface FeedNotificationSettings {
  push_enabled: boolean;
  include_own_posts: boolean;
}

export async function getFeedNotificationSettingsAction(): Promise<{
  settings: FeedNotificationSettings;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        settings: { push_enabled: false, include_own_posts: false },
        error: "Nicht angemeldet",
      };
    }

    const { data } = await supabase
      .from("user_feed_notification_settings")
      .select("push_enabled, include_own_posts")
      .eq("user_id", user.id)
      .maybeSingle();

    return {
      settings: {
        push_enabled: data?.push_enabled ?? false,
        include_own_posts: data?.include_own_posts ?? false,
      },
    };
  } catch (err) {
    console.error("[getFeedNotificationSettingsAction]", err);
    return {
      settings: { push_enabled: false, include_own_posts: false },
      error: "Fehler beim Laden",
    };
  }
}

export async function saveFeedNotificationSettingsAction(
  patch: Partial<FeedNotificationSettings>,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Nicht angemeldet" };

    const { data: existing } = await supabase
      .from("user_feed_notification_settings")
      .select("push_enabled, include_own_posts")
      .eq("user_id", user.id)
      .maybeSingle();

    const next = {
      push_enabled: patch.push_enabled ?? existing?.push_enabled ?? false,
      include_own_posts:
        patch.include_own_posts ?? existing?.include_own_posts ?? false,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("user_feed_notification_settings").upsert(
      {
        user_id: user.id,
        ...next,
      },
      { onConflict: "user_id" },
    );

    if (error) return { error: error.message };
    return {};
  } catch (err) {
    console.error("[saveFeedNotificationSettingsAction]", err);
    return { error: "Fehler beim Speichern" };
  }
}
