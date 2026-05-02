"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useActiveProject } from "@/components/features/app/project-context";
import { fetchPostsAction, type PostWithDetails } from "@/lib/actions/feed";
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
      } finally {
        setIsLoading(false);
      }
    },
    [],
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

  function handleLoadMore() {
    if (!activeProjectId) return;
    startLoadMoreTransition(() => {
      void loadPosts(activeProjectId, page + 1, true);
    });
  }

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
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="mt-6 flex justify-center px-4">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore || isLoading}
            className="flex h-11 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-800 px-6 text-sm font-medium text-zinc-300 transition-colors hover:border-orange-500 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Lädt…
              </>
            ) : (
              "Mehr laden"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
