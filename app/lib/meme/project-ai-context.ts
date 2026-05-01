/** Supabase-Browser/Server-Client (Cookies) */
export type SupabaseServer = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

/** Maximale Länge des eingebetteten Kontexts (alle KI-Prompts) */
export const PROJECT_AI_CONTEXT_MAX_LEN = 800;

/** Normalisiert Rohkontext wie in allen Prompts (Trim, Whitespace, Cap) */
export function normalizeStoredProjectAiContext(
  raw: string | null | undefined,
): string | null {
  const t = raw?.trim();
  if (!t) return null;
  return t.replace(/\s+/g, " ").slice(0, PROJECT_AI_CONTEXT_MAX_LEN);
}

/** Für OpenAI `images.edit` — direkt nach dem Basistext (ein Leerzeichen) */
export function inlineImageEditProjectContext(
  normalized: string | null,
): string {
  if (!normalized) return "";
  return ` Projektkontext: ${normalized}`;
}

/** Für Chat-Instructions (System/User-Text), eingebettet vor weitere Regeln */
export function canvasSystemPromptInset(
  normalized: string | null,
): string {
  if (!normalized) return "";
  return `\nProjekt-Kontext (Organizer — Ton/Themenwelt): ${normalized}`;
}

/** Block für reine Textaufgaben (Caption, Canvas-API ohne JSON-Regeln im selben String-Block) */
export function chatTaskProjectContextBlock(
  normalized: string | null,
): string {
  if (!normalized) return "";
  return `\n\nProjekt-Kontext (Organizer — Ton/Themenwelt): ${normalized}`;
}

/** Vier-Ideen-Assistant: Kontext + Hinweis für alle Ideen */
export function ideasPromptProjectContextBlock(
  normalized: string | null,
): string {
  if (!normalized) return "";
  return `\nProjekt-Kontext (Organizer — Ton/Themenwelt): ${normalized} Berücksichtige dies konsistent bei allen vier Ideen.`;
}

export type LoadProjectContextResult =
  | { ok: true; normalized: string | null }
  | { ok: false; status: 403 | 500; message: string };

/**
 * Lädt Projekt per Session-RLS. `strict`: fehlendes Projekt → Fehler (z. B. explizite projectId).
 */
export async function loadProjectAiContextNormalized(
  supabase: SupabaseServer,
  projectId: string,
  strict: boolean,
): Promise<LoadProjectContextResult> {
  const id = projectId.trim();
  if (!id) {
    return { ok: true, normalized: null };
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, ai_prompt_context")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      message: "Projekt konnte nicht geladen werden.",
    };
  }

  if (!data) {
    if (strict) {
      return {
        ok: false,
        status: 403,
        message: "Projekt nicht gefunden oder kein Zugriff.",
      };
    }
    return { ok: true, normalized: null };
  }

  return {
    ok: true,
    normalized: normalizeStoredProjectAiContext(data.ai_prompt_context),
  };
}

/** Kontext optional laden; bei fehlendem Zugriff leerer Kontext (kein 403) — z. B. Inferenz aus Pfad */
export async function tryLoadProjectAiContextNormalized(
  supabase: SupabaseServer,
  projectId: string | null | undefined,
): Promise<string | null> {
  const id = projectId?.trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("ai_prompt_context")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("[project-ai-context]", error.message);
    return null;
  }
  if (!data) return null;

  return normalizeStoredProjectAiContext(data.ai_prompt_context);
}

/** Erste Pfadkomponente = UUID → Projekt-ID (Storage: projekt/user/post.jpg) */
const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function inferProjectIdFromMemeStoragePath(imagePath: string): string | null {
  const first = imagePath.split("/")[0]?.trim() ?? "";
  return UUID_SEGMENT.test(first) ? first : null;
}
