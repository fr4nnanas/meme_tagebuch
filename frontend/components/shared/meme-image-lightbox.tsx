"use client";

import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  /**
   * Bei true: History-Eintrag wie bei `UserAvatarLightbox`, damit Browser-/Gesten-Zurück
   * die Lightbox schließt statt unerwartet die Feed-Route zu verlassen.
   */
  historySync?: boolean;
  /** z. B. Like/Kommentar/Teilen — unter dem Bild, wie im Feed */
  footer?: ReactNode;
}

export function MemeImageLightbox({
  open,
  onClose,
  memeSrc,
  originalSrc,
  memeAlt = "Meme",
  originalAlt = "Originalfoto",
  historySync = true,
  footer,
}: MemeImageLightboxProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  /** 0 = Meme (links, wie FeedMediaStrip), 1 = Original (rechts) */
  const [page, setPage] = useState<0 | 1>(0);
  const onCloseRef = useRef(onClose);
  const historyPushedRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const hasPair = Boolean(memeSrc && originalSrc);

  const requestClose = useCallback(() => {
    if (historySync) window.history.back();
    else onCloseRef.current();
  }, [historySync]);

  useLayoutEffect(() => {
    if (!historySync || !open) return;

    function onPopState() {
      historyPushedRef.current = false;
      onCloseRef.current();
    }

    window.history.pushState(
      { memeImageLightbox: true },
      "",
      window.location.href,
    );
    historyPushedRef.current = true;
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      if (historyPushedRef.current) {
        window.history.back();
        historyPushedRef.current = false;
      }
    };
  }, [open, historySync]);

  const scrollToPage = useCallback((target: 0 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({ left: target * w, behavior: "smooth" });
    setPage(target);
  }, []);

  useEffect(() => {
    if (open) return;
    const id = requestAnimationFrame(() => setPage(0));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el || !hasPair) return;
    // Direkte Zuweisung + scroll-auto am Container: vermeidet Weich-Scroll beim Öffnen
    // (CSS scroll-behavior: smooth würde scrollTo/„auto“ oft noch animieren).
    const w = el.clientWidth;
    if (w > 0) {
      el.scrollLeft = 0;
      return;
    }
    const id = requestAnimationFrame(() => {
      const w2 = el.clientWidth;
      if (w2 > 0) el.scrollLeft = 0;
    });
    return () => cancelAnimationFrame(id);
  }, [open, memeSrc, originalSrc, hasPair]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
      if (!hasPair) return;
      if (e.key === "ArrowLeft") scrollToPage(0);
      if (e.key === "ArrowRight") scrollToPage(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hasPair, scrollToPage, requestClose]);

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
      className="fixed inset-0 z-[60] flex items-center justify-center px-3 py-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Vergrößertes Bild"
    >
      {/* Backdrop: Klick außerhalb der Karte schließt */}
      <div
        role="presentation"
        className="absolute inset-0 cursor-default bg-zinc-950/65 backdrop-blur-[3px] transition-colors hover:bg-zinc-950/75"
        onClick={requestClose}
      />

      <div className="relative z-10 flex max-h-[min(92dvh,960px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-900 shadow-2xl ring-1 ring-black/30 sm:max-w-lg">
        <div className="flex shrink-0 items-center justify-end border-b border-zinc-800/90 bg-zinc-900/95 px-1.5 py-1">
          <button
            type="button"
            onClick={requestClose}
            aria-label="Schließen"
            className="rounded-full p-2.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-zinc-950/40">
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
                className="flex min-h-[min(42dvh,320px)] min-w-0 shrink-0 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-auto sm:min-h-[min(48dvh,380px)]"
              >
                <div className="flex h-full w-full min-w-full shrink-0 snap-center snap-always items-center justify-center bg-zinc-950/50 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={memeSrc}
                    alt={memeAlt}
                    className="max-h-[min(58dvh,640px)] max-w-full object-contain"
                  />
                </div>
                <div className="flex h-full w-full min-w-full shrink-0 snap-center snap-always items-center justify-center bg-zinc-950/50 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={originalSrc!}
                    alt={originalAlt}
                    className="max-h-[min(58dvh,640px)] max-w-full object-contain"
                  />
                </div>
              </div>

              {footer ? (
                <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/95 px-2 pt-2">
                  {footer}
                </div>
              ) : null}

              <div className="flex shrink-0 flex-col items-center gap-2 bg-zinc-900/40 px-2 pb-3 pt-2">
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
                    Meme
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
                    Original
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <p className="max-w-md px-1 text-center text-[11px] leading-snug text-zinc-500">
                  Wie im Feed: nach links wischen zeigt das Original vor Bearbeitung und Zuschnitt. Tastatur: ← →
                </p>
              </div>
            </>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex min-h-[min(42dvh,280px)] min-w-0 flex-1 items-center justify-center bg-zinc-950/50 p-3 sm:min-h-[min(48dvh,320px)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={memeSrc}
                  alt={memeAlt}
                  className="max-h-[min(58dvh,640px)] max-w-full object-contain"
                />
              </div>
              {footer ? (
                <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/95 px-2 pb-3 pt-2">
                  {footer}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
