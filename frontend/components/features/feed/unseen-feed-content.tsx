"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CheckCheck, ChevronLeft, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useActiveProject } from "@/components/features/app/project-context";
import {
  fetchUnseenPostsAction,
  markAllProjectPostsViewedAction,
  type PostWithDetails,
} from "@/lib/actions/feed";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import type { PostStarRatingSnapshot } from "@/components/shared/post-star-rating";
import { FeedCard } from "./feed-card";

interface UnseenFeedContentProps {
  currentUserId: string;
  isAdmin?: boolean;
}

export function UnseenFeedContent({
  currentUserId,
  isAdmin = false,
}: UnseenFeedContentProps) {
  const { activeProjectId, activeProject } = useActiveProject();
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, startLoadMoreTransition] = useTransition();
  const [isMarkingAll, startMarkAllTransition] = useTransition();
  const loadedProjectRef = useRef<string | null>(null);
  const leadPostsBlockRef = useRef<HTMLDivElement>(null);
  const [showScrollTopFab, setShowScrollTopFab] = useState(false);

  const loadPosts = useCallback(
    async (projectId: string, targetPage: number, append: boolean) => {
      setIsLoading(true);
      try {
        const result = await fetchUnseenPostsAction(projectId, targetPage);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setPosts((prev) => (append ? [...prev, ...result.posts] : result.posts));
        setHasMore(result.hasMore);
        setPage(targetPage);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!activeProjectId) return;
    if (loadedProjectRef.current === activeProjectId) return;
    loadedProjectRef.current = activeProjectId;
    setPosts([]);
    setPage(0);
    setHasMore(false);
    void loadPosts(activeProjectId, 0, false);
  }, [activeProjectId, loadPosts]);

  useEffect(() => {
    let rafId = 0;
    const updateFab = () => {
      if (posts.length === 0) {
        setShowScrollTopFab(false);
        return;
      }
      const el = leadPostsBlockRef.current;
      if (!el) {
        setShowScrollTopFab(false);
        return;
      }
      const rect = el.getBoundingClientRect();
      const scrolledPastLead = rect.bottom < 140;
      const notAtTop = window.scrollY > 56;
      setShowScrollTopFab(scrolledPastLead && notAtTop);
    };
    rafId = requestAnimationFrame(updateFab);
    window.addEventListener("scroll", updateFab, { passive: true });
    window.addEventListener("resize", updateFab);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", updateFab);
      window.removeEventListener("resize", updateFab);
    };
  }, [posts]);

  const handleLoadMore = useCallback(() => {
    if (!activeProjectId) return;
    startLoadMoreTransition(() => {
      void loadPosts(activeProjectId, page + 1, true);
    });
  }, [activeProjectId, page, loadPosts]);

  const loadMoreSentinelRef = useLoadMoreOnIntersect(
    Boolean(activeProjectId && hasMore && posts.length > 0),
    hasMore,
    isLoading || isLoadingMore,
    handleLoadMore,
  );

  function handlePostDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  function handlePostMovedAway(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  function handleCaptionUpdated(postId: string, caption: string) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, caption: caption || null } : p)),
    );
  }

  function handleStarRatingUpdated(postId: string, snap: PostStarRatingSnapshot) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              star_rating_avg: snap.star_rating_avg,
              star_rating_count: snap.star_rating_count,
              my_star_rating: snap.my_star_rating,
            }
          : p,
      ),
    );
  }

  function handleCommentCountChange(postId: string, delta: number) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count + delta) } : p,
      ),
    );
  }

  function handleRefresh() {
    if (!activeProjectId) return;
    loadedProjectRef.current = null;
    setPosts([]);
    setPage(0);
    setHasMore(false);
    void loadPosts(activeProjectId, 0, false);
  }

  function handleMarkAllSeen() {
    if (!activeProjectId) return;
    startMarkAllTransition(async () => {
      const result = await markAllProjectPostsViewedAction(activeProjectId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setPosts([]);
      setPage(0);
      setHasMore(false);
      loadedProjectRef.current = null;
      if (result.marked === 0) {
        toast.message("Es gab keine weiteren ungesehenen Memes.");
      } else {
        toast.success(
          result.marked === 1
            ? "1 Meme als gesehen markiert."
            : `${result.marked} Memes als gesehen markiert.`,
        );
      }
    });
  }

  function scrollFeedToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!activeProjectId) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <p className="text-zinc-400">
          Kein Projekt ausgewählt. Wähle ein Projekt im Profil-Tab aus.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-6">
      <header className="flex items-center justify-between gap-2 px-4 pt-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link
            href="/feed"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Zurück zum Feed"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Verpasste Memes
            </h1>
            {activeProject && (
              <p className="mt-0.5 truncate text-sm text-zinc-500">{activeProject.name}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          aria-label="Liste aktualisieren"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
        >
          <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </header>

      <p className="mt-3 px-4 text-sm text-zinc-500">
        Ungesehene Memes im Feed und Memes mit neuen Kommentaren seit deinem letzten Lesen.
        Scrollen oder Öffnen aktualisiert den Stand; „Alles als gesehen“ markiert alle Memes des
        Projekts.
      </p>

      <div className="mt-4 px-4">
        <button
          type="button"
          onClick={handleMarkAllSeen}
          disabled={isLoading || isMarkingAll}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-orange-500/50 hover:bg-zinc-800 hover:text-orange-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isMarkingAll ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <CheckCheck className="h-4 w-4" aria-hidden />
          )}
          Alles als gesehen markieren
        </button>
      </div>

      {isLoading && posts.length === 0 && (
        <div className="mt-6 flex flex-col gap-6 px-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800"
            >
              <div className="aspect-[2/3] w-full animate-pulse bg-zinc-800" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-zinc-400">Du bist auf dem neuesten Stand.</p>
          <p className="mt-2 text-sm text-zinc-500">
            Keine ungesehenen Memes in diesem Projekt.
          </p>
          <Link
            href="/feed"
            className="mt-6 text-sm font-medium text-orange-400 hover:text-orange-300"
          >
            Zum Feed
          </Link>
        </div>
      )}

      {posts.length > 0 && (
        <div className="mt-6 px-4">
          <div ref={leadPostsBlockRef} className="flex flex-col gap-6">
            {posts.slice(0, 3).map((post) => (
              <FeedCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onDeleted={handlePostDeleted}
                onCaptionUpdated={handleCaptionUpdated}
                onStarRatingUpdated={handleStarRatingUpdated}
                onCommentCountChange={handleCommentCountChange}
                onPostMovedAway={handlePostMovedAway}
              />
            ))}
          </div>
          {posts.length > 3 && (
            <div className="mt-6 flex flex-col gap-6">
              {posts.slice(3).map((post) => (
                <FeedCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onDeleted={handlePostDeleted}
                  onCaptionUpdated={handleCaptionUpdated}
                  onStarRatingUpdated={handleStarRatingUpdated}
                  onCommentCountChange={handleCommentCountChange}
                  onPostMovedAway={handlePostMovedAway}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showScrollTopFab && (
        <button
          type="button"
          onClick={scrollFeedToTop}
          className="fixed left-1/2 z-40 flex max-w-[min(calc(100vw-1rem),24rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-600 bg-zinc-800/95 px-4 py-2.5 text-sm font-medium text-zinc-100 shadow-lg backdrop-blur-sm transition-colors hover:border-orange-500/50 hover:bg-zinc-800 hover:text-orange-200 top-[calc(0.75rem+env(safe-area-inset-top,0px))]"
          aria-label="An den Anfang scrollen"
        >
          <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
          An den Anfang scrollen
        </button>
      )}

      {hasMore && posts.length > 0 && (
        <div className="mt-6 flex flex-col items-center px-4 pb-2">
          <div
            ref={loadMoreSentinelRef}
            className="h-2 w-full shrink-0"
            aria-hidden
          />
          {(isLoadingMore || isLoading) && (
            <div
              className="flex h-11 items-center gap-2 text-sm text-zinc-400"
              aria-live="polite"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Lädt…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
