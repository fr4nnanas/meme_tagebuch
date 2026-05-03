/**
 * Experimentelle Master-Prompt-Zusätze (KI-Vollbild) — ergänzen den Basis-Prompt, ersetzen ihn nicht.
 */
export const STANDARD_AI_MASTER_KEY = "standard";

/** Sentinel: Post-spezifische Rotation zwischen experimentellen Stilen */
export const ROTATING_EXPERIMENTAL_KEY = "rotate";

export const EXPERIMENTAL_AI_MASTER_STYLES: Record<
  string,
  { label: string; promptInset: string }
> = {
  classic_panel: {
    label: "Klassisches Panel (Text oben/unten)",
    promptInset:
      "Gestalte das Bild wie ein klassisches Meme-Panel mit klarer Aufhänger-Pointe: kräftige Kontraste, gut lesbare Textzeilen oben und/oder unten, typischer „Impact“-Look.",
  },
  reaction_zoom: {
    label: "Reaction / Gesichts-Zoom",
    promptInset:
      "Betone Gesichtsausdruck oder Reaktion: enger Bildausschnitt, komischer Zoom, übertriebene Mimik wie in Reaction-Memes.",
  },
  wholesome_absurd: {
    label: "Wholesome vs. absurd",
    promptInset:
      "Spiele mit Kontrast zwischen harmloser Stimmung und absurder Pointe; freundliche Farben, dann visueller oder textlicher Twist.",
  },
  label_meme: {
    label: "Label-Meme / Figuren",
    promptInset:
      "Nutze beschriftete Figuren oder Pfeile (auf dem Bild sichtbar, deutsch), die sich gegenseitig kommentieren — wie ein Label-Meme mit mehreren Akteuren.",
  },
  chart_graph: {
    label: "Diagramm- / Chart-Witz",
    promptInset:
      "Integriere ein einfaches, spaßiges Diagramm oder Chart (Säulen, Linie, Tortenstück) als zentralen Witz, kurz und lesbar auf Deutsch.",
  },
  expanding_brain: {
    label: "Stufen / „immer weiter“",
    promptInset:
      "Baue eine mehrstufige Steigerung (von harmlos zu übertrieben) visuell in eine Szene ein — erkennbar als Progression / Eskalation.",
  },
  vintage_lowfi: {
    label: "Vintage / Deep-Fried",
    promptInset:
      "Leicht verrauschter, übersättigter oder ironisch „schlechter“ Bildlook — ohne unleserlich zu werden; typischer ironischer Low-Fi-Shitpost.",
  },
};

const EXPERIMENTAL_KEYS = Object.keys(EXPERIMENTAL_AI_MASTER_STYLES);

export function pickRotatingExperimentalStyle(seed: string): string {
  if (EXPERIMENTAL_KEYS.length === 0) return STANDARD_AI_MASTER_KEY;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % EXPERIMENTAL_KEYS.length;
  return EXPERIMENTAL_KEYS[idx] ?? EXPERIMENTAL_KEYS[0]!;
}

export function resolveAiMasterStyleKey(
  raw: string | null | undefined,
  postId: string,
): string {
  const t = raw?.trim();
  if (!t || t === STANDARD_AI_MASTER_KEY) return STANDARD_AI_MASTER_KEY;
  if (t === ROTATING_EXPERIMENTAL_KEY) return pickRotatingExperimentalStyle(postId);
  if (EXPERIMENTAL_AI_MASTER_STYLES[t]) return t;
  return STANDARD_AI_MASTER_KEY;
}

export function experimentalPromptInset(styleKey: string): string {
  if (styleKey === STANDARD_AI_MASTER_KEY) return "";
  return EXPERIMENTAL_AI_MASTER_STYLES[styleKey]?.promptInset ?? "";
}

/** Kuratierte Meme-Formate für die Ideen-Taxonomie (nur Text-Ideen, nicht Bildgenerierung). */
export const MEME_FORMAT_TAXONOMY: readonly string[] = [
  "Klassisches Text-oben/unten (Impact-Setup)",
  "Drake / Ja–Nein-Kontrast",
  "Expanding Brain / mehrstufige Steigerung",
  "Reaction Face / Zoom auf Mimik",
  "„They don't know“ / Innenperspektive",
  "Label-Meme (Figuren mit Sprechblasen)",
  "Chart / Diagramm-Witz",
  "Changing opinions / Button-Wahl",
  "Wholesome vs. dunkle Pointe",
  "Surreale Collage / absurder Mix",
  "Tier-Meme / anthropomorph",
  "„Me vs. …“ Spaltung",
];

export function memeFormatTaxonomyBlock(): string {
  return MEME_FORMAT_TAXONOMY.map((line, i) => `${i + 1}. ${line}`).join("\n");
}
