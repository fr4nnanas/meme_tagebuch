export function coerceOriginalSources(
  original: string | string[] | null | undefined,
): string[] {
  if (!original) return [];
  if (Array.isArray(original)) {
    return original.filter((src): src is string => Boolean(src?.trim()));
  }
  return original.trim() ? [original] : [];
}

export function originalPageLabel(
  pageIndex: number,
  originalCount: number,
): string {
  if (pageIndex <= 0) return "Meme";
  if (originalCount <= 1) return "Original";
  return `Original ${pageIndex}`;
}
