"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { fetchPostLikersAction, type PostLiker } from "@/lib/actions/feed";
import { UserAvatarLightbox } from "@/components/shared/user-avatar-lightbox";

const HISTORY_KEY = "postLikersOverlay";

interface PostLikersOverlayProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostLikersOverlay({
  postId,
  open,
  onOpenChange,
}: PostLikersOverlayProps) {
  const router = useRouter();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  const pushedRef = useRef(false);

  const [likers, setLikers] = useState<PostLiker[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setLikers([]);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    void fetchPostLikersAction(postId).then((res) => {
      if (cancelled) return;
      if (res.error) {
        setLoadError(res.error);
        setLikers([]);
      } else {
        setLikers(res.likers);
        setLoadError(null);
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, postId]);

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ [HISTORY_KEY]: postId }, "");
    pushedRef.current = true;
  }, [open, postId]);

  useEffect(() => {
    const onPopState = () => {
      if (openRef.current) {
        pushedRef.current = false;
        onOpenChange(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [onOpenChange]);

  const closeFromUi = useCallback(() => {
    if (pushedRef.current) {
      window.history.back();
    } else {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  const navigateToProfile = useCallback(
    (userId: string, e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (pushedRef.current) {
        pushedRef.current = false;
        window.history.back();
      } else {
        onOpenChange(false);
      }
      queueMicrotask(() => router.push(`/profile/${userId}`));
    },
    [onOpenChange, router],
  );

  if (!mounted || !open) return null;

  const panel = (
    <div
      className="fixed inset-0 z-[50] flex items-end justify-center sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={closeFromUi}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] flex max-h-[min(70vh,520px)] w-full max-w-md flex-col rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:max-h-[min(80vh,560px)] sm:rounded-2xl"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-zinc-100">
            Geliked von
          </h2>
          <button
            type="button"
            onClick={closeFromUi}
            aria-label="Liste schließen"
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {isLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
          )}
          {!isLoading && loadError && (
            <p className="px-3 py-6 text-center text-sm text-red-400">{loadError}</p>
          )}
          {!isLoading && !loadError && likers.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">
              Noch keine Likes.
            </p>
          )}
          {!isLoading && !loadError && likers.length > 0 && (
            <ul className="space-y-0.5 pb-2">
              {likers.map((liker) => (
                <li key={liker.user_id}>
                  <Link
                    href={`/profile/${liker.user_id}`}
                    onClick={(e) => navigateToProfile(liker.user_id, e)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-zinc-800"
                  >
                    <UserAvatarLightbox
                      avatarUrl={liker.avatar_url}
                      username={liker.username}
                      sizeClassName="h-10 w-10"
                    />
                    <span className="min-w-0 truncate text-sm font-medium text-zinc-100">
                      {liker.username}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
