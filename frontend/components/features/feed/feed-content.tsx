"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Inbox, LayoutGrid, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useActiveProject } from "@/components/features/app/project-context";
import {
  fetchPostsAction,
  fetchUnseenCountAction,
  type PostWithDetails,
} from "@/lib/actions/feed";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { FeedCard } from "./feed-card";

interface FeedContentProps {
  currentUserId: string;
  isAdmin?: boolean;
}

export function FeedContent({ currentUserId, isAdmin = false }: FeedContentProps) {
  const { activeProjectId, activeProject } = useActiveProject();
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, startLoadMoreTransition] = useTransition();
  const loadedProjectRef = useRef<string | null>(null);
  const [unseenCount, setUnseenCount] = useState(0);

  const refreshUnseenCount = useCallback(async (projectId: string) => {
    const r = await fetchUnseenCountAction(projectId);
    if (!r.error) setUnseenCount(r.count);
  }, []);

  const loadPosts = useCallback(
    async (projectId: string, targetPage: number, append: boolean) => {
      setIsLoading(true);
      try {
        const result = await fetchPostsAction(projectId, targetPage);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setPosts((prev) => (append ? [...prev, ...result.posts] : result.posts));
        setHasMore(result.hasMore);
        setPage(targetPage);
        void refreshUnseenCount(projectId);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshUnseenCount],
  );

  // Wenn sich das aktive Projekt ändert, Feed neu laden.
  // useEffect ist hier zwingend nötig, da activeProjectId client-seitiger State ist
  // und nicht in einer Server Component ausgelesen werden kann.
  useEffect(() => {
    if (!activeProjectId) return;
    if (loadedProjectRef.current === activeProjectId) return;
    loadedProjectRef.current = activeProjectId;
    setPosts([]);
    setPage(0);
    setHasMore(false);
    void loadPosts(activeProjectId, 0, false);
  }, [activeProjectId, loadPosts]);

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

  function handleCaptionUpdated(postId: string, caption: string) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, caption: caption || null } : p)),
    );
  }

  function handleCommentCountChange(postId: string, delta: number) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count + delta) } : p,
      ),
    );
  }

  function handleMarkedViewedFeed() {
    if (!activeProjectId) return;
    void refreshUnseenCount(activeProjectId);
  }

  function handleRefresh() {
    if (!activeProjectId) return;
    loadedProjectRef.current = null;
    setPosts([]);
    setPage(0);
    setHasMore(false);
    void loadPosts(activeProjectId, 0, false);
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
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Feed</h1>
          {activeProject && (
            <p className="mt-0.5 text-sm text-zinc-500">{activeProject.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/feed/verpasst"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-orange-400"
            aria-label={
              unseenCount > 0
                ? `Verpasste Memes: ${unseenCount} ungesehen`
                : "Verpasste Memes öffnen"
            }
          >
            <Inbox className="h-5 w-5" />
            {unseenCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                {unseenCount > 99 ? "99+" : unseenCount}
              </span>
            )}
          </Link>
          <Link
            href="/feed/raster"
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-orange-400"
            aria-label="Projekt als Raster anzeigen"
          >
            <LayoutGrid className="h-5 w-5" />
          </Link>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="Feed aktualisieren"
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Loading skeleton */}
      {isLoading && posts.length === 0 && (
        <div className="mt-6 flex flex-col gap-6 px-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-800" />
                <div className="space-y-1.5">
                  <div className="h-3 w-24 animate-pulse rounded bg-zinc-800" />
                  <div className="h-2 w-16 animate-pulse rounded bg-zinc-800" />
                </div>
              </div>
              <div className="aspect-[2/3] w-full animate-pulse bg-zinc-800" />
              <div className="flex gap-4 px-4 py-3">
                <div className="h-5 w-14 animate-pulse rounded bg-zinc-800" />
                <div className="h-5 w-14 animate-pulse rounded bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <p className="text-zinc-400">Noch keine Memes in diesem Projekt.</p>
          <p className="mt-2 text-sm text-zinc-500">
            Sei der Erste und lade ein Meme hoch!
          </p>
        </div>
      )}

      {/* Post list */}
      {posts.length > 0 && (
        <div className="mt-6 flex flex-col gap-6 px-4">
          {posts.map((post) => (
            <FeedCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onDeleted={handlePostDeleted}
              onCaptionUpdated={handleCaptionUpdated}
              onCommentCountChange={handleCommentCountChange}
              onMarkedViewed={handleMarkedViewedFeed}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll: Sentinel + Ladehinweis */}
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
