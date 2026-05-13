"use client";

import { useState } from "react";

interface GridPostThumbnailProps {
  thumbSrc: string | null;
  fallbackSrc: string | null;
  alt: string;
  onClick?: () => void;
  className?: string;
  dimmed?: boolean;
}

export function GridPostThumbnail({
  thumbSrc,
  fallbackSrc,
  alt,
  onClick,
  className = "",
  dimmed = false,
}: GridPostThumbnailProps) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const preferred = thumbSrc ?? fallbackSrc;

  if (!preferred) return null;

  const displaySrc =
    thumbFailed && fallbackSrc ? fallbackSrc : (thumbSrc ?? fallbackSrc);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc ?? preferred}
      alt={alt}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      width={400}
      height={600}
      onClick={onClick}
      onError={() => {
        if (thumbSrc && fallbackSrc && !thumbFailed) setThumbFailed(true);
      }}
      className={`${className}${dimmed ? " opacity-50" : ""}`}
    />
  );
}
