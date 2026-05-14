/** Anzeige: nur volle Sterne (arithmetisch gerundet), Wert 1–5. */
export function fullStarsFromAverage(avg: number | null | undefined): number {
  if (avg == null || Number.isNaN(avg)) return 0;
  return Math.min(5, Math.max(0, Math.round(Number(avg))));
}

/** Eigene Bewertung als volle Sterne (1–5), sonst 0. */
export function fullStarsFromUserRating(
  rating: number | null | undefined,
): number {
  if (rating == null || Number.isNaN(rating)) return 0;
  return Math.min(5, Math.max(0, Math.round(Number(rating))));
}
