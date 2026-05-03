/**
 * Experimentelle Master-Prompt-Zusätze (KI-Vollbild) — ergänzen den experimentellen Basis-Prompt, ersetzen ihn nicht.
 * Der Standard-Modus nutzt einen separaten, in process-job definierten Basis-Text.
 */

/** Vollbild-KI: fester Basistext im Standard-Modus (ohne Stil-Zusätze). */
export const STANDARD_AI_MEME_BASE_PROMPT =
  "Verwandle dieses Foto in ein lustiges, teilbares Meme im Stil deutschsprachiger Internet-Memes. " +
  "Behalte wiedererkennbare Motive aus dem Foto. " +
  "Nutze witzige visuelle Effekte, klassische Meme-Textleisten oder humorvolle Verfremdungen. " +
  "Stil: knalliger Internet-Meme-Look. Alle sichtbaren Texte, Überschriften und Beschriftungen auf dem Bild müssen auf Deutsch formuliert sein (natürliche deutsche Meme-Sprache, Umgangssprache erlaubt).";

/**
 * Vollbild-KI: eigener Basistext für experimentelle Master-Stile — weniger Bildelemente, stärkerer Fokus auf Überschriften.
 */
export const EXPERIMENTAL_AI_MEME_BASE_PROMPT =
  "Verwandle dieses Foto in ein witziges, teilbares Meme im Ton deutschsprachiger Internet-Memes. " +
  "Setze den Witz vor allem über eine oder zwei kräftige, gut lesbare Überschriften- oder Meme-Textzeilen (oben/unten oder klar als Hauptzeile); der Text soll die Pointe tragen. " +
  "Nutze nur sehr wenige, klar pointierte Bildelemente (z. B. ein Kontrast, ein Fokus, ein einzelner visueller Akzent) — keine überladenen Collagen, keine Vielzahl an Figuren, Pfeilen oder Nebenpanels. " +
  "Behalte wiedererkennbare Motive aus dem Foto. Komposition ruhig und lesbar; zurückhaltende Farben, keine kitschig übersättigte Optik. " +
  "Alle sichtbaren Texte und Beschriftungen ausschließlich auf Deutsch (natürliche Meme-/Umgangssprache).";

/** Optional im experimentellen Modus: noch stärker reduzierte Bildkomplexität (zusätzlich zum Basis-Experimentelltext). */
export const AI_EXPERIMENTAL_MINIMAL_LAYOUT_INSET =
  "Zusätzlich: maximal minimalistisch — höchstens ein einziges pointiertes Bildelement neben dem Text; keine weiteren Deko-Elemente, keine zweite Szene, keine Bild-in-Bild-Ebenen.";

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
  drake_style: {
    label: "Drake-Setup (Ja–Nein-Kontrast)",
    promptInset:
      "Zwei klar getrennte Felder oder Zustände (z. B. links ablehnend, rechts begeistert): ein Setup lehnt etwas ab, das andere feiert die Alternative — Pointe über den Kontrast, Texte knapp auf Deutsch.",
  },
  distracted_focus: {
    label: "Ablenkung / falscher Fokus",
    promptInset:
      "Spiele mit Blickrichtung oder Aufmerksamkeit: eine Figur oder ein Motiv „schielt“ zu etwas Off-Topic, während das eigentliche Thema ignoriert wird — wie Distracted-Boyfriend-Logik, aber frei umgesetzt.",
  },
  pov_meme: {
    label: "POV / Ich-wenn…",
    promptInset:
      "Erste-Person-Perspektive oder klares „Ich, wenn …“-Szenario: der Betrachter soll sich hineinversetzen können; eine prägnante deutsche Überschrift trägt die Pointe.",
  },
  before_after: {
    label: "Früher vs. jetzt",
    promptInset:
      "Zeitlicher oder Erwartungskontrast in zwei klaren Momenten (z. B. links Anfang, rechts Ende): der Witz liegt im Unterschied, Beschriftungen kurz und deutsch.",
  },
  trade_offer: {
    label: "Tausch-Angebot (ich / du)",
    promptInset:
      "Zwei Seiten eines Deals: humorvoll ungleichwertiges Angebot („Ich biete X, du …“) — wie Trade-Offer-Meme, Texte klar lesbar auf Deutsch.",
  },
  animal_anthro: {
    label: "Tier-Meme / anthropomorph",
    promptInset:
      "Ein Tier oder Tiergesicht mit menschlich wirkender Pose oder Sprechblasen-Pointe; harmloser Look, Witz über Untertitel oder eine einzige deutsche Meme-Zeile.",
  },
  split_me_vs: {
    label: "Geteilt: ich vs. andere",
    promptInset:
      "Zwei Spalten oder Hälften (z. B. „Ich“ vs. „die anderen“ / Erwartung vs. Realität): ein einziger visueller Kontrast, Pointe über die Gegenüberstellung, Text auf Deutsch.",
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
  "Distracted boyfriend / Ablenkung: eigentliches Ziel vs. neuer Fokus",
  "Zwei-Buttons / schwitzender Entscheidungs-Struggle",
  "Stonks / absurde Wirtschafts- oder Erfolgs-Logik",
  "Woman–cat / lautstarkes Genervt-sein vs. unschuldig-trockene Antwort",
  "Trade offer / Tausch: ich biete X, du lieferst Y",
  "Always has been / Pistol-Panel – Kurswechsel, war schon immer so",
  "Wojak / Feels: hohle Maske vs. echtes Gefühl",
  "This is fine / entspannt im Chaos (alles brennt)",
  "POV / Ich-wenn… – Ich-erst-person-Szenario aus Nutzersicht",
  "„Nobody: / Literally niemand: / …:“ – Setup aus dem Nichts",
  "How it started / how it's going – Zeit- oder Erwartungskontrast",
  "Clown-Makeup / Eskalation in mehreren Stufen zum Selbstzitat",
  "Venn / Mengen – Überschneidung als Witz (nicht nur Chart)",
];

export function memeFormatTaxonomyBlock(): string {
  return MEME_FORMAT_TAXONOMY.map((line, i) => `${i + 1}. ${line}`).join("\n");
}
