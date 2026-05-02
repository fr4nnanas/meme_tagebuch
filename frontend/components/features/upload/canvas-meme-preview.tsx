"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Send, Trash2 } from "lucide-react";

interface CanvasMemePreviewProps {
  originalImageUrl: string;
  overlayTextTop: string | null;
  overlayTextBottom: string;
  onPost: (memeBlob: Blob, caption: string) => void;
  /** Entwurf verwerfen (ohne Upload in den Feed). */
  onDiscard: () => void;
  isPosting?: boolean;
  discardBusy?: boolean;
}

const CANVAS_W = 1024;
const CANVAS_H = 1536;
/** Oben: klassisches Meme-Setup, nicht zu hoch. */
const MAX_LINES_TOP = 2;
/** Unten: etwas mehr Platz für längere Pointen. */
const MAX_LINES_BOTTOM = 3;
/**
 * Meme-Schrift (Impact) ist sehr breit – schmaler messen, damit früher umgebrochen wird.
 */
const LINE_WRAP_WIDTH_FACTOR = 0.82;

function setMemeFont(ctx: CanvasRenderingContext2D, fontSize: number) {
  ctx.font = `bold ${fontSize}px Impact, Arial Black, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = Math.max(3, fontSize * 0.1);
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "black";
  ctx.fillStyle = "white";
}

function ellipsizeLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ell = "…";
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const test = text.slice(0, mid) + ell;
    if (ctx.measureText(test).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return text.slice(0, Math.max(0, low)) + ell;
}

/** Wörter umbrechen (OHNE \n-Segmentierung). */
function wrapWordsToLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const w = maxWidth * LINE_WRAP_WIDTH_FACTOR;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines: string[] = [];
  let i = 0;

  while (i < words.length && lines.length < maxLines) {
    const word = words[i]!;
    if (ctx.measureText(word).width > w) {
      lines.push(ellipsizeLine(ctx, word, w));
      i++;
      continue;
    }

    let line = word;
    i++;
    while (i < words.length) {
      const next = `${line} ${words[i]!}`;
      if (ctx.measureText(next).width <= w) {
        line = next;
        i++;
      } else {
        break;
      }
    }
    lines.push(line);
  }

  if (i < words.length && lines.length > 0) {
    const tail = words.slice(i).join(" ");
    const merged = `${lines[lines.length - 1]!} ${tail}`.trim();
    lines[lines.length - 1] = ellipsizeLine(ctx, merged, w);
  }

  return lines;
}

/** Bis zu maxLines Zeilen: zuerst bei Zeilenumbrüchen trennen, dann Wortumbruch. */
function wrapMemeLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const chunks = text
    .trim()
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!chunks.length) return [];

  const lines: string[] = [];
  for (const chunk of chunks) {
    if (lines.length >= maxLines) break;
    const remaining = maxLines - lines.length;
    const part = wrapWordsToLines(ctx, chunk, maxWidth, remaining);
    lines.push(...part);
  }
  return lines.slice(0, maxLines);
}

function drawMemeLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) {
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

export function CanvasMemePreview({
  originalImageUrl,
  overlayTextTop,
  overlayTextBottom,
  onPost,
  onDiscard,
  isPosting,
  discardBusy = false,
}: CanvasMemePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [caption, setCaption] = useState("");
  const [rendered, setRendered] = useState(false);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const W = CANVAS_W;
      const H = CANVAS_H;
      canvas.width = W;
      canvas.height = H;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imgAspect = img.width / img.height;
      const canvasAspect = W / H;
      let sx = 0,
        sy = 0,
        sw = img.width,
        sh = img.height;

      if (imgAspect > canvasAspect) {
        sw = img.height * canvasAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / canvasAspect;
        sy = (img.height - sh) / 2;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);

      const padding = Math.round(W * 0.04);
      const maxTextWidth = W - padding * 2;
      const fontSize = Math.round(W * 0.078);
      const lineHeight = fontSize * 1.18;

      setMemeFont(ctx, fontSize);

      const topLines = overlayTextTop
        ? wrapMemeLines(ctx, overlayTextTop, maxTextWidth, MAX_LINES_TOP)
        : [];
      const bottomLines = wrapMemeLines(
        ctx,
        overlayTextBottom || "",
        maxTextWidth,
        MAX_LINES_BOTTOM,
      );

      // Oben: erste Zeile mit Abstand zur oberen Kante, bis zu 2 Zeilen nach unten
      if (topLines.length > 0) {
        let y = padding + fontSize * 0.95;
        for (const line of topLines) {
          drawMemeLine(ctx, line, W / 2, y);
          y += lineHeight;
        }
      }

      // Unten: letzte Zeile knapp über dem unteren Rand, weitere Zeilen darüber
      if (bottomLines.length > 0) {
        const lastBaseline = H - padding - fontSize * 0.1;
        for (let i = 0; i < bottomLines.length; i++) {
          const line = bottomLines[i]!;
          const baseline =
            lastBaseline - (bottomLines.length - 1 - i) * lineHeight;
          drawMemeLine(ctx, line, W / 2, baseline);
        }
      }

      setRendered(true);
    };

    img.onerror = () => console.error("Originalbild konnte nicht geladen werden");
    img.src = originalImageUrl;
  }, [originalImageUrl, overlayTextTop, overlayTextBottom]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const getMemeBlob = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        reject(new Error("Canvas nicht verfügbar"));
        return;
      }
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Export fehlgeschlagen"));
        },
        "image/jpeg",
        0.92,
      );
    });
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const blob = await getMemeBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meme.jpg";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download fehlgeschlagen:", err);
    }
  }, [getMemeBlob]);

  const handlePost = useCallback(async () => {
    try {
      const blob = await getMemeBlob();
      onPost(blob, caption);
    } catch (err) {
      console.error("Post fehlgeschlagen:", err);
    }
  }, [getMemeBlob, onPost, caption]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-0">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-0.5">
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <canvas
            ref={canvasRef}
            className="aspect-[2/3] w-full object-contain"
            style={{ display: rendered ? "block" : "none" }}
          />
          {!rendered && (
            <div className="aspect-[2/3] w-full animate-pulse bg-zinc-800" />
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm">
          <p className="text-zinc-400">
            <span className="font-medium text-zinc-200">Oben:</span>{" "}
            {overlayTextTop ?? <em className="text-zinc-500">kein Text</em>}
          </p>
          <p className="mt-1 text-zinc-400">
            <span className="font-medium text-zinc-200">Unten:</span>{" "}
            {overlayTextBottom}
          </p>
        </div>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption hinzufügen (optional)..."
          rows={2}
          className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500"
        />
      </div>

      <div className="mt-4 shrink-0 space-y-2 border-t border-zinc-800 bg-zinc-950/98 pt-4 backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={!rendered || discardBusy}
            className="inline-flex min-h-[3rem] flex-1 min-w-[43%] items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 disabled:opacity-50"
          >
            <Download className="h-4 w-4 shrink-0" />
            Download
          </button>
          <button
            type="button"
            onClick={() => void handlePost()}
            disabled={!rendered || isPosting || discardBusy}
            className="inline-flex min-h-[3rem] flex-1 min-w-[43%] items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-[2]"
          >
            <Send className="h-4 w-4 shrink-0" />
            {isPosting ? "Wird gepostet..." : "Posten"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            void onDiscard();
          }}
          disabled={isPosting || discardBusy || !rendered}
          className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-red-950/70 bg-red-950/25 py-3 text-sm font-medium text-red-300/95 transition-colors hover:border-red-500/50 hover:bg-red-950/45 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {discardBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Wird verworfen…
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              Verwerfen
            </>
          )}
        </button>
      </div>
    </div>
  );
}
