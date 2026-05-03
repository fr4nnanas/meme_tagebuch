import type { SupabaseClient } from "@supabase/supabase-js";

/** Eigene Bewertungen des Nutzers für die gegebenen Post-IDs (1–5). */
export async function fetchMyStarRatingsForPostIds(
  supabase: SupabaseClient,
  userId: string,
  postIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (postIds.length === 0) return map;
  const { data, error } = await supabase
    .from("post_star_ratings")
    .select("post_id, rating")
    .eq("user_id", userId)
    .in("post_id", postIds);
  if (error) return map;
  for (const row of data ?? []) {
    map.set(String(row.post_id), Number(row.rating));
  }
  return map;
}
