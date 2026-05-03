import webpush from "web-push";
import { createServiceRoleClient } from "@/lib/supabase/server";

function initWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    "mailto:localhost";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

/**
 * Sendet Web-Push an alle Projektmitglieder mit aktivierten Einstellungen,
 * sobald ein Meme veröffentlicht wurde (meme_image_url gesetzt).
 */
export async function notifyProjectMembersNewMeme(params: {
  postId: string;
  projectId: string;
  authorUserId: string;
}): Promise<void> {
  if (!initWebPush()) {
    return;
  }

  const supabase = createServiceRoleClient();

  const [{ data: authorRow }, { data: members }] = await Promise.all([
    supabase.from("users").select("username").eq("id", params.authorUserId).maybeSingle(),
    supabase.from("project_members").select("user_id").eq("project_id", params.projectId),
  ]);

  const authorName = authorRow?.username ?? "Jemand";
  const title = "Neues Meme";
  const body = `${authorName} hat ein Meme gepostet`;
  const payload = JSON.stringify({
    title,
    body,
    url: "/feed",
    postId: params.postId,
  });

  const memberIds = [...new Set((members ?? []).map((m) => m.user_id))];
  if (memberIds.length === 0) return;

  const { data: settingsRows } = await supabase
    .from("user_feed_notification_settings")
    .select("user_id, push_enabled, include_own_posts")
    .in("user_id", memberIds);

  const settingsMap = new Map<
    string,
    { push_enabled: boolean; include_own_posts: boolean }
  >();
  for (const row of settingsRows ?? []) {
    settingsMap.set(row.user_id, {
      push_enabled: row.push_enabled,
      include_own_posts: row.include_own_posts,
    });
  }

  for (const memberId of memberIds) {
    const s = settingsMap.get(memberId);
    const pushEnabled = s?.push_enabled ?? false;
    if (!pushEnabled) continue;

    const includeOwn = s?.include_own_posts ?? false;
    if (memberId === params.authorUserId && !includeOwn) continue;

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", memberId);

    if (!subs?.length) continue;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 3600 },
        );
      } catch (err: unknown) {
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        if (statusCode === 410 || statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("[notifyProjectMembersNewMeme] send failed", err);
        }
      }
    }
  }
}
