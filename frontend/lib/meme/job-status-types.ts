/** Antwortform wie `/api/meme/job-status/[jobId]` – auch für Server Actions nutzbar. */
export interface JobStatusResponse {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  postId: string | null;
  memeType?: "ai_generated" | "canvas_overlay";
  variantSignedUrls?: string[];
  variantPaths?: string[];
  originalImagePath?: string;
  overlayTextTop?: string | null;
  overlayTextBottom?: string;
  originalSignedUrl?: string;
  errorMsg?: string;
}
