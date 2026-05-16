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

/** Ohne Minimal-Haken: bis zu vier klar erkennbare grafische Elemente. */
export const EXPERIMENTAL_GRAPHIC_ELEMENTS_STANDARD_MAX = 4;

/** Mit Minimal-Haken: maximal zwei — reduziert, aber nicht leer. */
export const EXPERIMENTAL_GRAPHIC_ELEMENTS_MINIMAL_MAX = 2;

/**
 * Vollbild-KI: eigener Basistext für experimentelle Master-Stile — Text trägt die Pointe, Grafik bewusst begrenzt.
 */
export const EXPERIMENTAL_AI_MEME_BASE_PROMPT =
  "Verwandle dieses Foto in ein witziges, teilbares Meme im Ton deutschsprachiger Internet-Memes. " +
  "Setze den Witz vor allem über eine oder zwei kräftige, gut lesbare Überschriften- oder Meme-Textzeilen (oben/unten oder klar als Hauptzeile); der Text soll die Pointe tragen. " +
  `Nutze höchstens ${EXPERIMENTAL_GRAPHIC_ELEMENTS_STANDARD_MAX} klar erkennbare grafische Elemente (z. B. Kontrast, Fokus, Akzent, Pfeil, Figur oder Panel) — keine überladenen Collagen und keine Vielzahl an Nebenpanels. ` +
  "Behalte wiedererkennbare Motive aus dem Foto. Komposition ruhig und lesbar; zurückhaltende Farben, keine kitschig übersättigte Optik. " +
  "Alle sichtbaren Texte und Beschriftungen ausschließlich auf Deutsch (natürliche Meme-/Umgangssprache).";

/** Optional im experimentellen Modus: noch stärker reduzierte Bildkomplexität (zusätzlich zum Basis-Experimentelltext). */
export const AI_EXPERIMENTAL_MINIMAL_LAYOUT_INSET =
  `Zusätzlich: reduzierte Bildkomposition — höchstens ${EXPERIMENTAL_GRAPHIC_ELEMENTS_MINIMAL_MAX} klar erkennbare grafische Elemente neben dem Text; deutlich weniger Deko als sonst, aber nicht leer oder nur Text auf Foto. Keine zweite Szene, keine Bild-in-Bild-Ebenen.`;

export const STANDARD_AI_MASTER_KEY = "standard";

/** Sentinel: Post-spezifische Rotation zwischen benannten Masterprompts */
export const ROTATING_EXPERIMENTAL_KEY = "rotate";

const MASTER_PREFIX = "master:";
const FORMAT_PREFIX = "format:";
const STYLIZATION_PREFIX = "stylization:";

export type ExperimentalPromptCatalogEntry = {
  label: string;
  promptInset: string;
};

/** Meme-Arten: Formate/Typen — steuern die Bildkomposition über einen Zusatz zum Basis-Prompt. */
export const EXPERIMENTAL_MEME_ART_STYLES: Record<
  string,
  ExperimentalPromptCatalogEntry
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

/** Visuelle Stilisierung: Ästhetik/Look — kombinierbar mit Meme-Art oder Masterprompt. */
export const EXPERIMENTAL_STYLIZATION_STYLES: Record<
  string,
  ExperimentalPromptCatalogEntry
> = {
  oil_painting: {
    label: "Ölgemälde / klassisches Gemälde",
    promptInset:
      "Rendere die Szene als klassisches Ölgemälde mit sichtbarer Pinselstruktur und warmem Galerie-Licht; Motive aus dem Foto bleiben erkennbar, Meme-Texte klar lesbar auf Deutsch.",
  },
  van_gogh: {
    label: "Post-Impressionismus / expressive Pinselstriche (Van Gogh)",
    promptInset:
      "Interpretiere die Szene post-impressionistisch: wirbelnde Pinselstriche, kräftige Farben, expressive Konturen — ohne Motiv oder deutschen Meme-Text unleserlich zu machen.",
  },
  gta_san_andreas: {
    label: "GTA San Andreas",
    promptInset:
      "Optik wie GTA San Andreas: leicht kantige 3D-Spielgrafik der PS2-Ära, satte Farben, urbaner Action-Look; erkennbare Foto-Motive und gut lesbare deutsche Meme-Beschriftung.",
  },
  gta_v: {
    label: "Moderne Open-World-3D-Grafik (GTA V)",
    promptInset:
      "Optik wie moderne Open-World-3D-Grafik: realistischere Spielwelt mit filmischer Beleuchtung; Motive aus dem Foto bleiben identifizierbar, Texte auf Deutsch klar lesbar.",
  },
  lego: {
    label: "Klemmbausteine (Lego)",
    promptInset:
      "Baue die Szene aus Klemmbausteinen: klare Noppen, modulare Formen, spielerischer Look; erkennbare Motive und deutsche Meme-Texte bleiben gut lesbar.",
  },
  fps_scene: {
    label: "Ego-Shooter-Szene",
    promptInset:
      "Inszeniere die Szene wie ein Ego-Shooter-Screenshot: HUD-Anmutung, waffenähnliche Perspektive oder Action-Frame — Motive aus dem Foto erkennbar, Meme-Text auf Deutsch gut lesbar.",
  },
  counter_strike: {
    label: "Taktischer Shooter-Look (Counter-Strike)",
    promptInset:
      "Visueller Look wie ein taktischer Ego-Shooter: Ego-Perspektive, kontrastreiche Map-Beleuchtung, leicht grittiger Action-Frame; Foto-Motive und deutsche Meme-Texte bleiben klar.",
  },
  anime: {
    label: "Japanischer Zeichenfilmstil (Anime)",
    promptInset:
      "Zeichne die Szene im japanischen Zeichenfilmstil: klare Linien, zellulare Flächen, ausdrucksstarke Augen — Motive aus dem Foto erkennbar, deutsche Meme-Texte gut lesbar.",
  },
  studio_ghibli: {
    label: "Sanfter Animations-Märchenlook (Studio Ghibli)",
    promptInset:
      "Stilisiere weich und detailreich wie ein handgezeichneter Animations-Märchenfilm: warme Naturfarben, malerische Flächen, verspielte Lichtstimmung; erkennbare Motive, deutsche Meme-Texte klar lesbar.",
  },
  minecraft_voxel: {
    label: "Voxel / 8-Bit-Pixel (Minecraft)",
    promptInset:
      "Rendere als Voxel- oder 8-Bit-Pixelwelt: blockige Formen, begrenzte Farbpalette, Retro-Charme — Motive aus dem Foto noch erkennbar, deutscher Meme-Text gut lesbar.",
  },
  comic: {
    label: "Comic / Graphic Novel",
    promptInset:
      "Gestalte als Comic oder Graphic Novel: kräftige Konturen, flächige Farben, optional Halbton oder Panel-Anmutung; erkennbare Motive, deutsche Meme-Texte klar und lesbar.",
  },
  vaporwave: {
    label: "Retro-Neon-Ästhetik (Vaporwave)",
    promptInset:
      "Nutze eine Retro-Neon-Ästhetik: Neon-Verläufe, Retro-PC- oder Mall-Vibes, leicht verträumte 80er/90er-Anmutung — Motive aus dem Foto erkennbar, deutscher Meme-Text gut lesbar.",
  },
  pixar_3d: {
    label: "Hochwertiger 3D-Animationsfilmlook (Pixar)",
    promptInset:
      "Rendere als hochwertigen 3D-Animationsfilm: weiche Formen, freundliches Licht, saubere Render-Optik; erkennbare Motive, deutsche Meme-Texte klar lesbar.",
  },
};

/** Benannte Masterprompts: kreative Varianten für Ton und Ausarbeitung. */
export const EXPERIMENTAL_NAMED_MASTER_PROMPTS: Record<
  string,
  ExperimentalPromptCatalogEntry
> = {
  knackig: {
    label: "Knackig",
    promptInset:
      "Kurze, harte Pointe; knappe deutsche Überschrift, wenig Drumherum — der Witz soll sofort sitzen.",
  },
  trocken: {
    label: "Trocken-deadpan",
    promptInset:
      "Trockener, fast emotionsloser Unterton; die Pointe wirkt durch Understatement statt durch laute Effekte.",
  },
  surreal_kurz: {
    label: "Surreal-kurz",
    promptInset:
      "Leicht absurde, überraschende Wendung mit nur einem klaren visuellen Twist — nicht chaotisch, sondern präzise seltsam.",
  },
  typo_first: {
    label: "Typo-first",
    promptInset:
      "Die Schrift ist der Star: sehr gut lesbare, mutige Meme-Typografie; Bild nur als Bühne für den Text.",
  },
  cozy_ironic: {
    label: "Cozy-ironisch",
    promptInset:
      "Warme, freundliche Stimmung mit ironischem Unterton — harmlos wirkend, aber mit leicht bissiger Pointe.",
  },
  genz_chaos: {
    label: "Gen-Z-Chaos",
    promptInset:
      "Jüngerer Internet-Ton: schnell, leicht chaotisch, aber noch lesbar; ein klarer Gag statt Meme-Salat.",
  },
  office_humor: {
    label: "Büro-Alltag",
    promptInset:
      "Alltags- oder Arbeitskontext-Humor: erkennbare Situation, trockene deutsche Pointe, wenig Fantasy.",
  },
  cinematic: {
    label: "Cinematic",
    promptInset:
      "Leicht filmischer Blickwinkel oder Licht — ein dramatischer Moment, der durch eine kurze deutsche Meme-Zeile entlarvt wird.",
  },
  wholesome_twist: {
    label: "Wholesome-Twist",
    promptInset:
      "Zuerst harmlos-niedlich, dann ein kleiner, überraschender Twist — freundlich, nicht zynisch.",
  },
  spicy_safe: {
    label: "Spicy-safe",
    promptInset:
      "Frech und pointiert, aber ohne Grenzverletzung: scharfer Witz über Situation oder Erwartung, nicht über Personen.",
  },
};

/** @deprecated Nutze EXPERIMENTAL_MEME_ART_STYLES oder EXPERIMENTAL_NAMED_MASTER_PROMPTS. */
export const EXPERIMENTAL_AI_MASTER_STYLES = EXPERIMENTAL_MEME_ART_STYLES;

const NAMED_MASTER_KEYS = Object.keys(EXPERIMENTAL_NAMED_MASTER_PROMPTS);

function toMasterKey(key: string): string {
  return `${MASTER_PREFIX}${key}`;
}

function toFormatKey(key: string): string {
  return `${FORMAT_PREFIX}${key}`;
}

function stripPrefix(value: string, prefix: string): string | null {
  return value.startsWith(prefix) ? value.slice(prefix.length) : null;
}

export function pickRotatingExperimentalStyle(seed: string): string {
  if (NAMED_MASTER_KEYS.length === 0) return STANDARD_AI_MASTER_KEY;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % NAMED_MASTER_KEYS.length;
  const key = NAMED_MASTER_KEYS[idx] ?? NAMED_MASTER_KEYS[0]!;
  return toMasterKey(key);
}

export function resolveAiMasterStyleKey(
  raw: string | null | undefined,
  postId: string,
): string {
  const t = raw?.trim();
  if (!t || t === STANDARD_AI_MASTER_KEY) return STANDARD_AI_MASTER_KEY;
  if (t === ROTATING_EXPERIMENTAL_KEY) {
    return pickRotatingExperimentalStyle(postId);
  }

  const formatKey = stripPrefix(t, FORMAT_PREFIX);
  if (formatKey && EXPERIMENTAL_MEME_ART_STYLES[formatKey]) {
    return toFormatKey(formatKey);
  }

  const masterKey = stripPrefix(t, MASTER_PREFIX);
  if (masterKey && EXPERIMENTAL_NAMED_MASTER_PROMPTS[masterKey]) {
    return toMasterKey(masterKey);
  }

  if (EXPERIMENTAL_MEME_ART_STYLES[t]) return toFormatKey(t);
  if (EXPERIMENTAL_NAMED_MASTER_PROMPTS[t]) return toMasterKey(t);

  return STANDARD_AI_MASTER_KEY;
}

export function experimentalPromptInset(styleKey: string): string {
  if (styleKey === STANDARD_AI_MASTER_KEY) return "";

  const formatKey = stripPrefix(styleKey, FORMAT_PREFIX);
  if (formatKey) {
    return EXPERIMENTAL_MEME_ART_STYLES[formatKey]?.promptInset ?? "";
  }

  const masterKey = stripPrefix(styleKey, MASTER_PREFIX);
  if (masterKey) {
    return EXPERIMENTAL_NAMED_MASTER_PROMPTS[masterKey]?.promptInset ?? "";
  }

  return (
    EXPERIMENTAL_MEME_ART_STYLES[styleKey]?.promptInset ??
    EXPERIMENTAL_NAMED_MASTER_PROMPTS[styleKey]?.promptInset ??
    ""
  );
}

export function resolveAiStylizationKey(
  raw: string | null | undefined,
): string | null {
  const t = raw?.trim();
  if (!t) return null;

  const stylizationKey = stripPrefix(t, STYLIZATION_PREFIX);
  if (stylizationKey && EXPERIMENTAL_STYLIZATION_STYLES[stylizationKey]) {
    return stylizationKey;
  }

  if (EXPERIMENTAL_STYLIZATION_STYLES[t]) return t;

  return null;
}

export function experimentalStylizationPromptInset(
  raw: string | null | undefined,
): string {
  const key = resolveAiStylizationKey(raw);
  if (!key) return "";
  return EXPERIMENTAL_STYLIZATION_STYLES[key]?.promptInset ?? "";
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

export function encodeExperimentalMemeArtChoice(key: string): string {
  return toFormatKey(key);
}

export function encodeExperimentalMasterChoice(
  key: string,
): string {
  if (key === ROTATING_EXPERIMENTAL_KEY) return ROTATING_EXPERIMENTAL_KEY;
  return toMasterKey(key);
}

export function encodeExperimentalStylizationChoice(key: string): string {
  return `${STYLIZATION_PREFIX}${key}`;
}
