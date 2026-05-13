"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface SnapScrollerSlide {
  key?: string;
  src: string;
  alt: string;
  label?: string;
  overlay?: ReactNode;
}

interface HorizontalSnapScrollerProps {
  slides: SnapScrollerSlide[];
  className?: string;
  scrollerClassName?: string;
  slideClassName?: string;
  imgClassName?: string;
  showPageBadge?: boolean;
  onActiveIndexChange?: (index: number) => void;
}

export function HorizontalSnapScroller({
  slides,
  className,
  scrollerClassName,
  slideClassName,
  imgClassName,
  showPageBadge = false,
  onActiveIndexChange,
}: HorizontalSnapScrollerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const syncActiveIndexFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const page = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    const next = Math.min(Math.max(page, 0), Math.max(0, slides.length - 1));
    setActiveIndex(next);
    onActiveIndexChange?.(next);
  }, [onActiveIndexChange, slides.length]);

  useEffect(() => {
    syncActiveIndexFromScroll();
  }, [slides, syncActiveIndexFromScroll]);

  if (slides.length === 0) return null;

  if (slides.length === 1) {
    const slide = slides[0]!;
    return (
      <div className={className}>
        <div className={`relative ${slideClassName ?? ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slide.src} alt={slide.alt} className={imgClassName} />
          {slide.overlay}
        </div>
      </div>
    );
  }

  const activeLabel = slides[activeIndex]?.label;

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        ref={scrollerRef}
        onScroll={syncActiveIndexFromScroll}
        className={
          scrollerClassName ??
          "flex w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
        role="region"
        aria-label="Bilder horizontal blättern"
      >
        {slides.map((slide, index) => (
          <div
            key={slide.key ?? `${slide.src}-${index}`}
            className={`relative shrink-0 snap-start ${slideClassName ?? "w-full"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slide.src} alt={slide.alt} className={imgClassName} />
            {slide.overlay}
          </div>
        ))}
      </div>
      {showPageBadge && activeLabel ? (
        <span className="pointer-events-none absolute bottom-2 left-2 z-[2] rounded bg-zinc-950/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300">
          {activeLabel}
        </span>
      ) : null}
    </div>
  );
}
