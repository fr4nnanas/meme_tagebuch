/** Schrift für Canvas-Overlays (Text auf Foto / Alles selbst / KI-Text-Overlay). */
export const MEME_CANVAS_FONT_FAMILY =
  '"Meme Impact", Impact, "Arial Black", sans-serif';

export function buildMemeCanvasFontSpec(fontSize: number): string {
  return `700 ${fontSize}px ${MEME_CANVAS_FONT_FAMILY}`;
}

const FONT_LOAD_TIMEOUT_MS = 2_000;

/** Impact (bzw. Fallback) laden, bevor Canvas misst und zeichnet. */
export async function ensureMemeCanvasFontLoaded(
  fontSize: number,
): Promise<void> {
  if (typeof document === "undefined") return;
  const spec = buildMemeCanvasFontSpec(fontSize);
  try {
    await Promise.race([
      (async () => {
        await document.fonts.load(spec);
        await document.fonts.ready;
      })(),
      new Promise<void>((resolve) => {
        setTimeout(resolve, FONT_LOAD_TIMEOUT_MS);
      }),
    ]);
  } catch {
    /* System-Fallback reicht */
  }
}

export function applyMemeCanvasTextStyle(
  ctx: CanvasRenderingContext2D,
  fontSize: number,
): void {
  ctx.font = buildMemeCanvasFontSpec(fontSize);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = Math.max(5, Math.round(fontSize * 0.14));
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#ffffff";
}

/** Weiße Impact-Füllung mit schwarzem Rand (klassischer Meme-Look). */
export function drawMemeCanvasTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
): void {
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}
