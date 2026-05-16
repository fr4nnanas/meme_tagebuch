"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/media/download-blob";
import { fetchRemoteImageBlob } from "@/lib/media/fetch-remote-image";
import {
  applyMemeCanvasTextStyle,
  drawMemeCanvasTextLine,
  ensureMemeCanvasFontLoaded,
} from "@/lib/meme/meme-canvas-font";

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
/** Wenn alles in einem Block nur „unten“ ankommt: gesamte Bildhöhe nutzen (oben + unten). */
const MAX_COMBINED_LINES = MAX_LINES_TOP + MAX_LINES_BOTTOM;
/**
 * Meme-Schrift (Impact) ist sehr breit – schmaler messen, damit früher umgebrochen wird.
 */
const LINE_WRAP_WIDTH_FACTOR = 0.82;

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

/** Ein zu langes Wort (URL, Zusammensetzung) zeichenweise auf mehrere Zeilen verteilen. */
function breakLongWordToLines(
  ctx: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  if (maxLines <= 0) return [];
  const out: string[] = [];
  let rest = word;
  while (rest.length > 0 && out.length < maxLines) {
    if (ctx.measureText(rest).width <= maxWidth) {
      out.push(rest);
      break;
    }
    let low = 1;
    let high = rest.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (ctx.measureText(rest.slice(0, mid)).width <= maxWidth) low = mid;
      else high = mid - 1;
    }
    const take = Math.max(1, low);
    out.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  if (rest.length > 0 && out.length > 0) {
    const last = out.length - 1;
    out[last] = ellipsizeLine(ctx, out[last]! + rest, maxWidth);
  }
  return out;
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
      const budget = maxLines - lines.length;
      const parts = breakLongWordToLines(ctx, word, w, budget);
      lines.push(...parts);
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

/**
 * Am ersten Komma trennen: bei mehreren Kommas bleibt der obere Teil so kurz
 * wie möglich, der Rest (inkl. weiterer Kommas) steht unten.
 */
function splitAtFirstComma(text: string): { top: string; bottom: string } | null {
  const t = text.trim();
  const i = t.indexOf(",");
  if (i === -1) return null;
  const top = t.slice(0, i + 1).trim();
  const bottom = t.slice(i + 1).trim();
  if (!top || !bottom) return null;
  return { top, bottom };
}

async function paintMemeOnCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  overlayTextTop: string | null,
  overlayTextBottom: string,
): Promise<void> {
  const W = CANVAS_W;
  const H = CANVAS_H;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas-Kontext fehlt");

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

  await ensureMemeCanvasFontLoaded(fontSize);
  applyMemeCanvasTextStyle(ctx, fontSize);

  const topTrim = overlayTextTop?.trim() ?? "";
  const bottomTrim = (overlayTextBottom || "").trim();

  const useCombinedVertical =
    (!topTrim && bottomTrim) || (topTrim && !bottomTrim);

  let topLines: string[] = [];
  let bottomLines: string[] = [];

  if (useCombinedVertical) {
    const block = topTrim || bottomTrim;
    const comma = splitAtFirstComma(block);
    if (comma) {
      topLines = wrapMemeLines(ctx, comma.top, maxTextWidth, MAX_LINES_TOP);
      bottomLines = wrapMemeLines(
        ctx,
        comma.bottom,
        maxTextWidth,
        MAX_LINES_BOTTOM,
      );
    } else {
      const all = wrapMemeLines(ctx, block, maxTextWidth, MAX_COMBINED_LINES);
      if (all.length <= MAX_LINES_BOTTOM) {
        topLines = [];
        bottomLines = all;
      } else {
        bottomLines = all.slice(-MAX_LINES_BOTTOM);
        const overflowCount = all.length - bottomLines.length;
        topLines = all.slice(0, Math.min(overflowCount, MAX_LINES_TOP));
      }
    }
  } else {
    topLines = topTrim
      ? wrapMemeLines(ctx, topTrim, maxTextWidth, MAX_LINES_TOP)
      : [];
    bottomLines = bottomTrim
      ? wrapMemeLines(ctx, bottomTrim, maxTextWidth, MAX_LINES_BOTTOM)
      : [];
  }

  if (topLines.length > 0) {
    let y = padding + fontSize * 0.95;
    for (const line of topLines) {
      drawMemeCanvasTextLine(ctx, line, W / 2, y);
      y += lineHeight;
    }
  }

  if (bottomLines.length > 0) {
    const lastBaseline = H - padding - fontSize * 0.1;
    for (let i = 0; i < bottomLines.length; i++) {
      const line = bottomLines[i]!;
      const baseline =
        lastBaseline - (bottomLines.length - 1 - i) * lineHeight;
      drawMemeCanvasTextLine(ctx, line, W / 2, baseline);
    }
  }
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
  const objectUrlRef = useRef<string | null>(null);
  const [caption, setCaption] = useState("");
  const [rendered, setRendered] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    setRendered(false);

    void (async () => {
      const fetched = await fetchRemoteImageBlob(originalImageUrl);
      if (cancelled) return;
      if (!fetched.ok) {
        toast.error(fetched.message);
        return;
      }

      const objectUrl = URL.createObjectURL(fetched.blob);
      objectUrlRef.current = objectUrl;

      const img = new Image();
      try {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("decode"));
          img.src = objectUrl;
        });
        if (cancelled) return;

        await paintMemeOnCanvas(
          canvas,
          img,
          overlayTextTop,
          overlayTextBottom,
        );
        if (!cancelled) setRendered(true);
      } catch {
        if (!cancelled) {
          toast.error("Meme-Vorschau konnte nicht erstellt werden");
        }
      } finally {
        URL.revokeObjectURL(objectUrl);
        if (objectUrlRef.current === objectUrl) {
          objectUrlRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [originalImageUrl, overlayTextTop, overlayTextBottom]);

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
    setDownloadBusy(true);
    try {
      const blob = await getMemeBlob();
      downloadBlob(blob, "meme.jpg");
    } catch {
      toast.error("Download fehlgeschlagen");
    } finally {
      setDownloadBusy(false);
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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
        <canvas
          ref={canvasRef}
          className="max-h-full max-w-full object-contain"
          style={{
            display: rendered ? "block" : "none",
            width: "auto",
            height: "auto",
          }}
        />
        {!rendered && (
          <div
            className="aspect-[2/3] h-full max-h-full w-auto animate-pulse bg-zinc-800"
            aria-hidden
          />
        )}
      </div>

      <div className="mt-2 shrink-0 space-y-2">

        <div className="rounded-lg border border-zinc-800 bg-zinc-800/80 px-3 py-2 text-xs">
          <p className="truncate text-zinc-400">
            <span className="font-medium text-zinc-300">Oben:</span>{" "}
            {overlayTextTop ?? <em className="text-zinc-500">kein Text</em>}
          </p>
          <p className="mt-0.5 truncate text-zinc-400">
            <span className="font-medium text-zinc-300">Unten:</span>{" "}
            {overlayTextBottom}
          </p>
        </div>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption (optional)…"
          rows={1}
          className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500"
        />
      </div>

      <div className="mt-2 shrink-0 space-y-2 border-t border-zinc-800 pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={!rendered || discardBusy || downloadBusy || isPosting}
            className="inline-flex min-h-10 flex-1 min-w-[43%] items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 disabled:opacity-50"
          >
            {downloadBusy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Download className="h-4 w-4 shrink-0" />
            )}
            {downloadBusy ? "Download läuft…" : "Download"}
          </button>
          <button
            type="button"
            onClick={() => void handlePost()}
            disabled={!rendered || isPosting || discardBusy}
            className="inline-flex min-h-10 flex-1 min-w-[43%] items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-[2]"
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
          className="flex w-full min-h-10 items-center justify-center gap-2 rounded-xl border border-red-950/70 bg-red-950/25 py-2.5 text-sm font-medium text-red-300/95 transition-colors hover:border-red-500/50 hover:bg-red-950/45 disabled:cursor-not-allowed disabled:opacity-50"
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
