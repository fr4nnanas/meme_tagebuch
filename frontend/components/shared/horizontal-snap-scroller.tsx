"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  HORIZONTAL_PAGE_SCROLLER_CLASS,
  horizontalPageSlideClassName,
  useHorizontalPageSnap,
} from "@/lib/ui/use-horizontal-page-snap";

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

  const handleActiveIndexChange = (next: number) => {
    setActiveIndex(next);
    onActiveIndexChange?.(next);
  };

  const { onScrollerScroll } = useHorizontalPageSnap(
    scrollerRef,
    slides.length,
    handleActiveIndexChange,
  );

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
        onScroll={onScrollerScroll}
        className={scrollerClassName ?? HORIZONTAL_PAGE_SCROLLER_CLASS}
        role="region"
        aria-label="Bilder horizontal blättern"
      >
        {slides.map((slide, index) => (
          <div
            key={slide.key ?? `${slide.src}-${index}`}
            className={horizontalPageSlideClassName(slideClassName ?? "w-full")}
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
