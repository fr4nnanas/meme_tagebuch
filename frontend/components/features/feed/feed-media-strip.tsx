"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  HORIZONTAL_PAGE_SCROLLER_CLASS,
  horizontalPageSlideClassName,
  useHorizontalPageSnap,
} from "@/lib/ui/use-horizontal-page-snap";
import {
  coerceOriginalSources,
  originalPageLabel,
} from "@/lib/media/original-sources";

const DOUBLE_TAP_MS = 320;
const TAP_MOVE_TOLERANCE_PX = 14;

interface FeedMediaStripProps {
  memeSrc: string;
  originalSrc: string | string[] | null;
  memeAlt?: string;
  originalAlt?: string;
  onDoubleTapLike: () => void;
  /** Wird nur über dem Meme (erste Seite) positioniert, z. B. Liker-Avatare. */
  memeOverlay?: ReactNode;
}

/**
 * Feed-Medien: horizontal wischen (Original rechts vom Meme), Doppeltipp zum Liken.
 * Vertikales Scrollen der Seite bleibt erhalten (eigener X-Scroller).
 */
export function FeedMediaStrip({
  memeSrc,
  originalSrc,
  memeAlt = "Meme",
  originalAlt = "Originalfoto",
  onDoubleTapLike,
  memeOverlay,
}: FeedMediaStripProps) {
  const lastTapRef = useRef(0);
  const tapStartRef = useRef<{ x: number; y: number } | null>(null);
  const stripScrollRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);
  const originals = coerceOriginalSources(originalSrc);
  const pageCount = 1 + originals.length;

  const { onScrollerScroll } = useHorizontalPageSnap(
    stripScrollRef,
    pageCount,
    setActivePage,
  );

  const tryRegisterDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      onDoubleTapLike();
    } else {
      lastTapRef.current = now;
    }
  }, [onDoubleTapLike]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    tapStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const start = tapStartRef.current;
      tapStartRef.current = null;
      if (!start) return;
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > TAP_MOVE_TOLERANCE_PX || dy > TAP_MOVE_TOLERANCE_PX) return;
      tryRegisterDoubleTap();
    },
    [tryRegisterDoubleTap],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onDoubleTapLike();
    },
    [onDoubleTapLike],
  );

  if (originals.length === 0) {
    return (
      <div
        className="relative h-full w-full touch-manipulation bg-zinc-800"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={memeSrc}
          alt={memeAlt}
          className="h-full w-full object-cover select-none"
          loading="lazy"
          draggable={false}
        />
        {memeOverlay}
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full touch-manipulation bg-zinc-800"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      <div
        ref={stripScrollRef}
        onScroll={onScrollerScroll}
        className={`${HORIZONTAL_PAGE_SCROLLER_CLASS} h-full`}
        aria-label="Meme; nach links wischen für Originalfoto"
        role="region"
      >
        <div className={horizontalPageSlideClassName("h-full w-full")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={memeSrc}
            alt={memeAlt}
            className="h-full w-full object-cover select-none"
            loading="lazy"
            draggable={false}
          />
          {memeOverlay}
        </div>
        {originals.map((src, index) => (
          <div
            key={`${src}-${index}`}
            className={horizontalPageSlideClassName("h-full w-full")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={
                originals.length > 1
                  ? `${originalAlt} ${index + 1}`
                  : originalAlt
              }
              className="h-full w-full object-cover select-none"
              loading="lazy"
              draggable={false}
            />
          </div>
        ))}
      </div>
      <span className="pointer-events-none absolute bottom-2 left-2 z-[2] rounded bg-zinc-950/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300">
        {originalPageLabel(activePage, originals.length)}
      </span>
    </div>
  );
}
