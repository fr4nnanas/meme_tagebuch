"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import {
  fullStarsFromAverage,
  fullStarsFromUserRating,
} from "@/lib/meme/star-display";
import {
  setMyPostStarRatingAction,
  type SetMyPostStarRatingResult,
} from "@/lib/actions/feed";

export type PostStarRatingSnapshot = {
  star_rating_avg: number | null;
  star_rating_count: number;
  my_star_rating: number | null;
};

interface PostStarRatingProps {
  postId: string;
  starRatingAvg: number | null;
  starRatingCount: number;
  myStarRating: number | null;
  /** true = Sterne sind klickbar (eigene Bewertung); gilt für alle Posts mit Meme, nicht nur für den Autor. */
  interactive: boolean;
  /**
   * false = nach erfolgreichem Speichern Ø/Anzahl und Sortierung im Parent unverändert lassen
   * (z. B. Projekt-Raster bis Reload). Eigene Bewertung wird trotzdem gespeichert; der Ø im
   * Tooltip bleibt bis zum Neuladen der alte Stand.
   */
  updateAggregateDisplayAfterSubmit?: boolean;
  onUpdated?: (next: PostStarRatingSnapshot) => void;
  className?: string;
  compact?: boolean;
}

export function PostStarRating({
  postId,
  starRatingAvg,
  starRatingCount,
  myStarRating,
  interactive,
  updateAggregateDisplayAfterSubmit = true,
  onUpdated,
  className = "",
  compact = false,
}: PostStarRatingProps) {
  const [avg, setAvg] = useState(starRatingAvg);
  const [count, setCount] = useState(starRatingCount);
  const [mine, setMine] = useState(myStarRating);
  const [, startTransition] = useTransition();
  /** Verhindert, dass Props-Updates nach Submit die lokale Bewertung wieder überschreiben (Raster mit defer). */
  const lastSyncedPostIdRef = useRef<string | null>(null);
  const lastPropsMineRef = useRef(myStarRating);
  const lastPropsAvgRef = useRef(starRatingAvg);
  const lastPropsCountRef = useRef(starRatingCount);

  useEffect(() => {
    if (lastSyncedPostIdRef.current !== postId) {
      lastSyncedPostIdRef.current = postId;
      setAvg(starRatingAvg);
      setCount(starRatingCount);
      setMine(myStarRating);
      lastPropsMineRef.current = myStarRating;
      lastPropsAvgRef.current = starRatingAvg;
      lastPropsCountRef.current = starRatingCount;
      return;
    }

    if (myStarRating !== lastPropsMineRef.current) {
      lastPropsMineRef.current = myStarRating;
      setMine(myStarRating);
    }

    if (starRatingAvg !== lastPropsAvgRef.current) {
      lastPropsAvgRef.current = starRatingAvg;
      setAvg(starRatingAvg);
    }
    if (starRatingCount !== lastPropsCountRef.current) {
      lastPropsCountRef.current = starRatingCount;
      setCount(starRatingCount);
    }
  }, [
    postId,
    starRatingAvg,
    starRatingCount,
    myStarRating,
    updateAggregateDisplayAfterSubmit,
  ]);

  const outlineStarCount = fullStarsFromAverage(avg);
  const innerStarCount = fullStarsFromUserRating(mine);

  const baseTitle =
    avg != null && count > 0
      ? `Ø ${avg.toFixed(2)} von 5 · ${count} ${count === 1 ? "Bewertung" : "Bewertungen"}`
      : count === 0
        ? "Noch keine Bewertungen"
        : "Bewertung";
  const titleHint =
    mine != null
      ? `${baseTitle} · Deine Bewertung: ${mine} Stern${mine === 1 ? "" : "e"}`
      : baseTitle;

  function applyStar(clicked: number) {
    if (!interactive) return;
    const nextMine = mine === clicked ? null : clicked;
    startTransition(async () => {
      const res = (await setMyPostStarRatingAction(
        postId,
        nextMine,
      )) as SetMyPostStarRatingResult;
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if ("error" in res) return;
      const snap: PostStarRatingSnapshot = {
        star_rating_avg: res.star_rating_avg,
        star_rating_count: res.star_rating_count,
        my_star_rating: res.my_star_rating,
      };
      setMine(snap.my_star_rating);
      if (updateAggregateDisplayAfterSubmit) {
        setAvg(snap.star_rating_avg);
        setCount(snap.star_rating_count);
      }
      onUpdated?.(snap);
    });
  }

  /**
   * Kompakt (Feed / Raster / Profil): enge Abstände + schmale Mindestbreite,
   * damit alle 5 Sterne in schmalen Leisten sichtbar bleiben; Höhe bleibt tap-freundlich.
   */
  const starSz = compact ? "h-3.5 w-3.5" : "h-5 w-5 sm:h-6 sm:w-6";
  const btnInteractive = compact
    ? "min-h-10 min-w-6 shrink-0 touch-manipulation sm:min-w-7"
    : "min-h-10 min-w-9 shrink-0 touch-manipulation sm:min-w-10";

  const innerGap = compact ? "gap-0" : "gap-0.5";

  return (
    <div
      className={`flex items-center ${className}`}
      role={interactive ? "group" : undefined}
      title={titleHint}
      aria-label={titleHint}
    >
      <div className={`flex items-center ${innerGap}`}>
        {[1, 2, 3, 4, 5].map((n) => {
          const hasOutline = outlineStarCount >= n;
          const hasFill = innerStarCount >= n;
          const starClassName = hasFill
            ? "fill-amber-400"
            : "fill-none";
          const strokeClassName = hasOutline
            ? "stroke-red-500"
            : hasFill
              ? "stroke-amber-400"
              : "stroke-zinc-500";
          const strokeWidth = hasOutline || !hasFill ? 1.8 : 0;
          return (
            <button
              key={n}
              type="button"
              disabled={!interactive}
              onClick={() => applyStar(n)}
              className={
                interactive
                  ? `flex items-center justify-center rounded-md text-amber-400 transition-colors hover:bg-amber-400/15 active:bg-amber-400/25 [@media(hover:hover)]:hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:pointer-events-none ${btnInteractive}`
                  : `pointer-events-none flex items-center justify-center p-1 text-amber-400/90`
              }
              aria-label={`${n} von 5 Sternen vergeben`}
              aria-pressed={mine === n}
            >
              <Star
                className={`${starSz} ${starClassName} ${strokeClassName}`}
                strokeWidth={strokeWidth}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
