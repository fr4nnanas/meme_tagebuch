"use client";

import { User } from "lucide-react";
import type { PostLiker } from "@/lib/actions/feed";

interface PostRecentLikersOnImageProps {
  /** Neueste zuerst (max. vier vom Server). */
  likers: PostLiker[];
  likeCount: number;
  onOpenList: () => void;
}

const MAX_VISIBLE = 4;

/**
 * Überlappende Profilbilder unten rechts auf dem Meme (älteste links, neueste oben rechts).
 */
export function PostRecentLikersOnImage({
  likers,
  likeCount,
  onOpenList,
}: PostRecentLikersOnImageProps) {
  if (likeCount <= 0 || likers.length === 0) return null;

  const display = [...likers].slice(0, MAX_VISIBLE).reverse();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenList();
      }}
      aria-haspopup="dialog"
      aria-label={`${likeCount} Likes, Liste der Liker öffnen`}
      className="absolute bottom-2 right-2 z-[1] flex items-center rounded-full bg-black/45 py-1 pl-1 pr-2 shadow-lg ring-1 ring-white/15 backdrop-blur-[2px] transition hover:bg-black/60"
    >
      <span className="flex items-center" aria-hidden>
        {display.map((liker, index) => (
          <span
            key={liker.user_id}
            className={`relative flex h-7 w-7 shrink-0 overflow-hidden rounded-full bg-zinc-800 ring-2 ring-black/60 ${
              index > 0 ? "-ml-2" : ""
            }`}
            style={{ zIndex: index }}
            title={liker.username}
          >
            {liker.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={liker.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-zinc-500">
                <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </span>
            )}
          </span>
        ))}
      </span>
    </button>
  );
}
