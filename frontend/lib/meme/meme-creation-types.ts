export type PostingMode =
  | "ai_full"
  | "ai_experiment"
  | "text_overlay"
  | "fully_manual";

export type MemeType = "ai_generated" | "canvas_overlay";
export type Pipeline = "direct" | "assisted" | "manual";

export const MODE_LABEL: Record<PostingMode, string> = {
  ai_full: "Neues Meme von der KI",
  ai_experiment: "KI experimentell (Master-Prompts)",
  text_overlay: "Text auf mein Foto",
  fully_manual: "Alles selbst",
};

export function toMemeType(mode: PostingMode): MemeType {
  return mode === "ai_full" || mode === "ai_experiment"
    ? "ai_generated"
    : "canvas_overlay";
}

export function toPipeline(
  mode: PostingMode,
  selectedIdea: string | null,
): Pipeline {
  if (mode === "fully_manual") return "manual";
  if (selectedIdea?.trim()) return "assisted";
  return "direct";
}

export function postingModeFromDb(
  memeType: MemeType,
  pipeline: Pipeline,
): PostingMode {
  if (memeType === "ai_generated") return "ai_full";
  if (pipeline === "manual") return "fully_manual";
  return "text_overlay";
}

export function applySourcePipelineText(
  pipeline: Pipeline,
  text: string,
): { userText: string; selectedCaption: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { userText: "", selectedCaption: null };
  if (pipeline === "assisted") {
    return { userText: "", selectedCaption: trimmed };
  }
  return { userText: trimmed, selectedCaption: null };
}
