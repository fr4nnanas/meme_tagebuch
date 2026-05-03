/** Anzeige: nur volle Sterne (arithmetisch gerundet), Wert 1–5. */
export function fullStarsFromAverage(avg: number | null | undefined): number {
  if (avg == null || Number.isNaN(avg)) return 0;
  return Math.min(5, Math.max(0, Math.round(Number(avg))));
}
