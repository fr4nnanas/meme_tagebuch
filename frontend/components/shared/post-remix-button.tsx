"use client";

import Link from "next/link";
import { Shuffle } from "lucide-react";

interface PostRemixButtonProps {
  postId: string;
  /** `grid` = kleines Overlay auf Raster-Thumbnails */
  size?: "grid" | "default";
  /** `inline` = in Toolbars (Lightbox-Header), ohne absolute Position */
  variant?: "overlay" | "inline";
  className?: string;
}

export function PostRemixButton({
  postId,
  size = "grid",
  variant = "overlay",
  className = "",
}: PostRemixButtonProps) {
  const isGrid = size === "grid";
  const isInline = variant === "inline";

  return (
    <Link
      href={`/remix?source=${postId}`}
      aria-label="Remixen"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`touch-manipulation ${
        isInline
          ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-orange-400"
          : `absolute z-20 ${
              isGrid
                ? "right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950/75 text-zinc-200 shadow-md ring-1 ring-white/10 transition-colors hover:bg-zinc-800/90 hover:text-orange-400"
                : "right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950/70 text-zinc-100 shadow-md ring-1 ring-white/10 backdrop-blur-sm transition-colors hover:bg-zinc-900/90 hover:text-orange-400"
            }`
      } ${className}`}
    >
      <Shuffle
        className={
          isGrid
            ? "h-3.5 w-3.5 shrink-0 text-orange-400"
            : "h-5 w-5 shrink-0 text-orange-400"
        }
      />
    </Link>
  );
}
