import type { JobStatusResponse } from "@/lib/meme/job-status-types";

export function shouldOpenMemeCompletionUI(d: JobStatusResponse): boolean {
  if (d.status !== "completed" || d.errorMsg) return false;
  if (
    d.memeType === "ai_generated" &&
    d.variantSignedUrls &&
    d.variantSignedUrls.length > 0
  ) {
    return true;
  }
  if (
    d.memeType === "canvas_overlay" &&
    d.originalSignedUrl &&
    (d.overlayTextTop || d.overlayTextBottom)
  ) {
    return true;
  }
  return false;
}

export function getMemeCompletionActionLabel(d: JobStatusResponse): string {
  if (
    d.memeType === "ai_generated" &&
    d.variantSignedUrls &&
    d.variantSignedUrls.length >= 2
  ) {
    return "Variante wählen";
  }
  return "Meme ansehen";
}
