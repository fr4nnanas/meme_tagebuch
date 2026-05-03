"use client";

import { useEffect, useRef } from "react";

/**
 * Ruft onLoadMore auf, sobald das Sentinel-Element in den sichtbaren Bereich kommt
 * (mit rootMargin für etwas Vorlauf beim Scrollen).
 */
export function useLoadMoreOnIntersect(
  enabled: boolean,
  hasMore: boolean,
  isBusy: boolean,
  onLoadMore: () => void,
  rootMargin = "400px 0px 0px 0px",
) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;
  const isBusyRef = useRef(isBusy);
  isBusyRef.current = isBusy;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !enabled) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (!hasMoreRef.current || isBusyRef.current) return;
        onLoadMoreRef.current();
      },
      { root: null, rootMargin, threshold: 0 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [enabled, hasMore, rootMargin]);

  return sentinelRef;
}
