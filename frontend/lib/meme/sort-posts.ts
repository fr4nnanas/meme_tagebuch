export type MemeStarSortMode =
  | "created_desc"
  | "stars_asc"
  | "stars_desc"
  | "my_stars_asc"
  | "my_stars_desc";

type WithSortKeys = {
  created_at: string;
  star_rating_avg?: number | null;
  my_star_rating?: number | null;
};

function byCreatedDesc<T extends WithSortKeys>(a: T, b: T): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function compareNumericRating<T extends WithSortKeys>(
  a: T,
  b: T,
  ar: number | null,
  br: number | null,
  direction: "asc" | "desc",
): number {
  if (ar == null && br == null) return byCreatedDesc(a, b);
  if (ar == null) return 1;
  if (br == null) return -1;
  if (br !== ar) return direction === "desc" ? br - ar : ar - br;
  return byCreatedDesc(a, b);
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
    if (mode === "my_stars_desc" || mode === "my_stars_asc") {
      return compareNumericRating(
        a,
        b,
        a.my_star_rating ?? null,
        b.my_star_rating ?? null,
        mode === "my_stars_desc" ? "desc" : "asc",
      );
    }
    return compareNumericRating(
      a,
      b,
      a.star_rating_avg ?? null,
      b.star_rating_avg ?? null,
      mode === "stars_desc" ? "desc" : "asc",
    );
  });
  return copy;
}
