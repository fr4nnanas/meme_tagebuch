const SUMMARY_MAX = 72;

/** Kurzfassung für einklappbare Zeile (Wortgrenze bevorzugt). */
export function summarizePipelinePrompt(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= SUMMARY_MAX) return t;
  const slice = t.slice(0, SUMMARY_MAX);
  const lastSpace = slice.lastIndexOf(" ");
  const head = lastSpace > 24 ? slice.slice(0, lastSpace) : slice;
  return `${head}…`;
}

export function hasPipelinePromptContent(pipelineInputText: string | null | undefined): boolean {
  return Boolean(pipelineInputText && pipelineInputText.trim().length > 0);
}
