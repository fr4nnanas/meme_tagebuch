"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

const SCROLL_SETTLE_MS = 60;
const SNAP_TOLERANCE_PX = 2;

export const HORIZONTAL_PAGE_SCROLLER_CLASS =
  "flex w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function horizontalPageSlideClassName(base?: string): string {
  return ["relative shrink-0 min-w-full snap-center snap-always", base]
    .filter(Boolean)
    .join(" ");
}

function readActivePage(scrollLeft: number, clientWidth: number, pageCount: number): number {
  const width = Math.max(1, clientWidth);
  return Math.min(pageCount - 1, Math.max(0, Math.round(scrollLeft / width)));
}

export function useHorizontalPageSnap(
  ref: RefObject<HTMLDivElement | null>,
  pageCount: number,
  onPageChange?: (page: number) => void,
): { onScrollerScroll: () => void } {
  const settleTimerRef = useRef<number | null>(null);
  const supportsScrollEndRef = useRef<boolean | null>(null);

  if (supportsScrollEndRef.current === null) {
    supportsScrollEndRef.current =
      typeof window !== "undefined" && "onscrollend" in window;
  }

  const snapToNearestPage = useCallback(() => {
    const el = ref.current;
    if (!el || pageCount <= 1) return;

    const page = readActivePage(el.scrollLeft, el.clientWidth, pageCount);
    const target = page * Math.max(1, el.clientWidth);
    if (Math.abs(el.scrollLeft - target) > SNAP_TOLERANCE_PX) {
      el.scrollTo({ left: target });
    }
    onPageChange?.(page);
  }, [onPageChange, pageCount, ref]);

  const syncActivePageFromScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    onPageChange?.(readActivePage(el.scrollLeft, el.clientWidth, pageCount));
  }, [onPageChange, pageCount, ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el || pageCount <= 1) return;

    syncActivePageFromScroll();

    if (!supportsScrollEndRef.current) return;

    const onScrollEnd = () => snapToNearestPage();
    el.addEventListener("scrollend", onScrollEnd, { passive: true });
    return () => el.removeEventListener("scrollend", onScrollEnd);
  }, [pageCount, ref, snapToNearestPage, syncActivePageFromScroll]);

  const onScrollerScroll = useCallback(() => {
    syncActivePageFromScroll();

    if (supportsScrollEndRef.current) return;

    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }
    settleTimerRef.current = window.setTimeout(() => {
      snapToNearestPage();
      settleTimerRef.current = null;
    }, SCROLL_SETTLE_MS);
  }, [snapToNearestPage, syncActivePageFromScroll]);

  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    },
    [],
  );

  return { onScrollerScroll };
}
