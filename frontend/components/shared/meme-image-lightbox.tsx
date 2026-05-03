"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface MemeImageLightboxProps {
  open: boolean;
  onClose: () => void;
  /** Fertiges Meme (Nachbearbeitung/Zuschnitt) */
  memeSrc: string | null;
  /** Upload / Rohfoto vor Nachbearbeitung — wenn gesetzt: Wisch-Galerie Original ↔ Meme */
  originalSrc: string | null;
  memeAlt?: string;
  originalAlt?: string;
}

export function MemeImageLightbox({
  open,
  onClose,
  memeSrc,
  originalSrc,
  memeAlt = "Meme",
  originalAlt = "Originalfoto",
}: MemeImageLightboxProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<0 | 1>(1);

  const hasPair = Boolean(memeSrc && originalSrc);

  const scrollToPage = useCallback((target: 0 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({ left: target * w, behavior: "smooth" });
    setPage(target);
  }, []);

  useEffect(() => {
    if (!open) return;
    setPage(1);
    const el = scrollerRef.current;
    if (el && hasPair) {
      requestAnimationFrame(() => {
        el.scrollTo({ left: el.clientWidth, behavior: "auto" });
      });
    }
  }, [open, memeSrc, originalSrc, hasPair]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (!hasPair) return;
      if (e.key === "ArrowLeft") scrollToPage(0);
      if (e.key === "ArrowRight") scrollToPage(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, hasPair, scrollToPage]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !memeSrc) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Vergrößertes Bild"
      onClick={onClose}
    >
      <div
        className="flex shrink-0 justify-end px-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="rounded-full p-2.5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-7 w-7" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col px-2 pb-2">
        {hasPair ? (
          <>
            <div
              ref={scrollerRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const w = el.clientWidth;
                if (w < 1) return;
                const i = Math.round(el.scrollLeft / w);
                setPage(i === 0 ? 0 : 1);
              }}
              className="flex min-h-0 min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth"
            >
              <div
                className="flex h-full w-full min-w-full shrink-0 snap-center snap-always items-center justify-center p-1"
                onClick={onClose}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalSrc!}
                  alt={originalAlt}
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[min(88dvh,920px)] max-w-full object-contain"
                />
              </div>
              <div
                className="flex h-full w-full min-w-full shrink-0 snap-center snap-always items-center justify-center p-1"
                onClick={onClose}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={memeSrc}
                  alt={memeAlt}
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-[min(88dvh,920px)] max-w-full object-contain"
                />
              </div>
            </div>

            <div
              className="flex shrink-0 flex-col items-center gap-2 pb-[env(safe-area-inset-bottom,8px)] pt-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollToPage(0)}
                  aria-current={page === 0 ? "true" : undefined}
                  className={`flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors ${
                    page === 0
                      ? "border-orange-500/60 bg-orange-500/15 text-orange-300"
                      : "border-zinc-600 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Original
                </button>
                <button
                  type="button"
                  onClick={() => scrollToPage(1)}
                  aria-current={page === 1 ? "true" : undefined}
                  className={`flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors ${
                    page === 1
                      ? "border-orange-500/60 bg-orange-500/15 text-orange-300"
                      : "border-zinc-600 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  Meme
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <p className="max-w-md text-center text-[11px] leading-snug text-zinc-500">
                Nach rechts wischen zeigt das Original vor Bearbeitung und Zuschnitt. Tastatur: ← →
              </p>
            </div>
          </>
        ) : (
          <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center p-2">
            <button
              type="button"
              aria-label="Schließen"
              className="absolute inset-0 z-0 cursor-default border-0 bg-transparent"
              onClick={onClose}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={memeSrc}
              alt={memeAlt}
              className="relative z-10 max-h-[min(88dvh,920px)] max-w-full object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
}
