"use client";

import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  coerceOriginalSources,
  originalPageLabel,
} from "@/lib/media/original-sources";

export interface MemeImageLightboxProps {
  open: boolean;
  onClose: () => void;
  /** Fertiges Meme (Nachbearbeitung/Zuschnitt) */
  memeSrc: string | null;
  /** Upload / Rohfoto vor Nachbearbeitung — wenn gesetzt: Wisch-Galerie Original ↔ Meme */
  originalSrc: string | string[] | null;
  memeAlt?: string;
  originalAlt?: string;
  /**
   * Bei true: History-Eintrag wie bei `UserAvatarLightbox`, damit Browser-/Gesten-Zurück
   * die Lightbox schließt statt unerwartet die Feed-Route zu verlassen.
   */
  historySync?: boolean;
  /** z. B. Like/Kommentar/Teilen — unter dem Bild, wie im Feed */
  footer?: ReactNode;
  /** Aktionen in der Kopfzeile neben Schließen (z. B. Remix) */
  headerActions?: ReactNode;
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
  headerActions,
}: MemeImageLightboxProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const onCloseRef = useRef(onClose);
  const historyPushedRef = useRef(false);
  const originals = useMemo(
    () => coerceOriginalSources(originalSrc),
    [originalSrc],
  );
  const pageCount = originals.length > 0 ? originals.length + 1 : 1;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const hasGallery = Boolean(memeSrc && originals.length > 0);

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

  const scrollToPage = useCallback(
    (target: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const clamped = Math.min(Math.max(target, 0), pageCount - 1);
      const w = el.clientWidth;
      el.scrollTo({ left: clamped * w, behavior: "smooth" });
      setPage(clamped);
    },
    [pageCount],
  );

  useEffect(() => {
    if (open) return;
    const id = requestAnimationFrame(() => setPage(0));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el || !hasGallery) return;
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
  }, [open, memeSrc, originals, hasGallery]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
      if (!hasGallery) return;
      if (e.key === "ArrowLeft") scrollToPage(page - 1);
      if (e.key === "ArrowRight") scrollToPage(page + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hasGallery, page, scrollToPage, requestClose]);

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
      <div
        role="presentation"
        className="absolute inset-0 cursor-default bg-zinc-950/65 backdrop-blur-[3px] transition-colors hover:bg-zinc-950/75"
        onClick={requestClose}
      />

      <div className="relative z-10 flex max-h-[min(92dvh,960px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-900 shadow-2xl ring-1 ring-black/30 sm:max-w-lg">
        <div className="flex shrink-0 items-center justify-end gap-1 border-b border-zinc-800/90 bg-zinc-900/95 px-1.5 py-1">
          {headerActions}
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
          {hasGallery ? (
            <>
              <div
                ref={scrollerRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const w = el.clientWidth;
                  if (w < 1) return;
                  const i = Math.round(el.scrollLeft / w);
                  setPage(Math.min(Math.max(i, 0), pageCount - 1));
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
                {originals.map((src, index) => (
                  <div
                    key={`${src}-${index}`}
                    className="flex h-full w-full min-w-full shrink-0 snap-center snap-always items-center justify-center bg-zinc-950/50 p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={
                        originals.length > 1
                          ? `${originalAlt} ${index + 1}`
                          : originalAlt
                      }
                      className="max-h-[min(58dvh,640px)] max-w-full object-contain"
                    />
                  </div>
                ))}
              </div>

              {footer ? (
                <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/95 px-2 pt-2">
                  {footer}
                </div>
              ) : null}

              <div className="flex shrink-0 flex-col items-center gap-2 bg-zinc-900/40 px-2 pb-3 pt-2">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => scrollToPage(page - 1)}
                    disabled={page <= 0}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-600 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Vorheriges Bild"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </button>
                  <span className="rounded-full border border-orange-500/60 bg-orange-500/15 px-3 py-1.5 text-xs font-medium text-orange-300">
                    {originalPageLabel(page, originals.length)}
                  </span>
                  <button
                    type="button"
                    onClick={() => scrollToPage(page + 1)}
                    disabled={page >= pageCount - 1}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-600 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Nächstes Bild"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <p className="max-w-md px-1 text-center text-[11px] leading-snug text-zinc-500">
                  Wie im Feed: nach links wischen zeigt die Originale vor Bearbeitung
                  und Zuschnitt. Tastatur: ← →
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
