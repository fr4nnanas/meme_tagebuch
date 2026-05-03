export type MemeStarSortMode = "created_desc" | "stars_asc" | "stars_desc";

type WithSortKeys = {
  created_at: string;
  star_rating_avg?: number | null;
};

function byCreatedDesc<T extends WithSortKeys>(a: T, b: T): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/** Sortiert Posts für Raster/Export: Standard chronologisch (neu zuerst); optional nach Sternen. */
export function sortPostsForDisplay<T extends WithSortKeys>(
  posts: readonly T[],
  mode: MemeStarSortMode,
): T[] {
  const copy = [...posts];
  if (mode === "created_desc") {
    copy.sort(byCreatedDesc);
    return copy;
  }
  copy.sort((a, b) => {
    const ar = a.star_rating_avg ?? null;
    const br = b.star_rating_avg ?? null;
    if (mode === "stars_desc") {
      if (ar == null && br == null) return byCreatedDesc(a, b);
      if (ar == null) return 1;
      if (br == null) return -1;
      if (br !== ar) return br - ar;
      return byCreatedDesc(a, b);
    }
    if (ar == null && br == null) return byCreatedDesc(a, b);
    if (ar == null) return 1;
    if (br == null) return -1;
    if (ar !== br) return ar - br;
    return byCreatedDesc(a, b);
  });
  return copy;
}
