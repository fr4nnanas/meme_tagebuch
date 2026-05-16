import { resolvePostMediaPublicUrl } from "@/lib/storage/r2-url";

export const POST_GRID_PAGE_SIZE = 60;

export interface PostGridThumbUrls {
  thumb_url: string | null;
  full_fallback_url: string | null;
}

/** Raster: Meme-Thumb, sonst Original-Thumb; Fallback auf volles JPEG bei fehlender WebP-Variante. */
export function resolvePostGridThumbUrls(
  memeImageUrl: string | null,
  originalImageUrl: string,
): PostGridThumbUrls {
  const primaryRaw = memeImageUrl ?? originalImageUrl;
  return {
    thumb_url: resolvePostMediaPublicUrl(primaryRaw, "thumb"),
    full_fallback_url: resolvePostMediaPublicUrl(primaryRaw, "full"),
  };
}
